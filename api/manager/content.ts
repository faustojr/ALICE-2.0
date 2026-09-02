/**
 * /api/manager/content — conteúdo próprio da prefeitura.
 *
 * O gestor cadastra os temas que importam ao município (um decreto local, uma
 * instrução normativa da controladoria) e a IA monta os reels e o quiz. Nada
 * chega ao servidor antes de o gestor aprovar: conteúdo sobre norma municipal
 * gerado sem revisão pode induzir alguém a errar num processo real, e a
 * responsabilidade recai sobre quem assina, não sobre a ferramenta.
 *
 * GET   lista a trilha da prefeitura e o estado de cada tema
 * POST  cria a trilha ou adiciona um tema (?action=topic)
 * PATCH gera o conteúdo de um tema (?action=generate) ou aprova (?action=approve)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handleError, methodNotAllowed } from '../../lib/http.js';
import { requireTenantScope } from '../../lib/auth.js';
import {
  checkAiQuota,
  getTenant,
  getTrail,
  listTrailsFor,
  recordAiUsage,
  upsertTrail,
} from '../../lib/repositories.js';
import { generateModuleWithGemini } from '../../lib/moduleGenerator.js';
import type { Trail, TrailTopic, VariantContent } from '../../types.js';

/** Trilha própria de um tenant tem slug previsível: uma por prefeitura. */
function ownTrailSlug(tenantId: string): string {
  return `tenant-${tenantId}`;
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/**
 * Conteúdo aguardando aprovação. Fica fora de `baseContent` de propósito: o
 * que está em `baseContent` já é servido ao aluno, e um rascunho não pode ser.
 */
interface PendingTopic extends TrailTopic {
  draftContent?: VariantContent;
  draftGeneratedAt?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  try {
    const scope = await requireTenantScope(
      req.headers.authorization,
      req.query.tenantId ? String(req.query.tenantId) : undefined
    );

    if (!scope.tenantId) {
      return res.status(400).json({ error: 'Prefeitura não identificada.' });
    }
    const tenantId = scope.tenantId;
    const slug = ownTrailSlug(tenantId);

    if (req.method === 'GET') {
      const [own, available] = await Promise.all([
        getTrail(slug),
        listTrailsFor(tenantId),
      ]);

      const topics = ((own?.topics ?? []) as PendingTopic[]).map((t) => ({
        id: t.id,
        title: t.title,
        legalReference: t.legalReference ?? null,
        // Três estados que o gestor precisa distinguir no painel.
        status: t.baseContent
          ? 'PUBLICADO'
          : t.draftContent
            ? 'AGUARDANDO_APROVACAO'
            : 'SEM_CONTEUDO',
        draft: t.draftContent ?? null,
        published: t.baseContent ?? null,
      }));

      return res.json({
        trail: own
          ? { slug: own.slug, name: own.name, description: own.description, isPublished: own.isPublished }
          : null,
        topics,
        pendingApproval: topics.filter((t) => t.status === 'AGUARDANDO_APROVACAO').length,
        availableTrails: available.map((t) => ({ slug: t.slug, name: t.name })),
      });
    }

    if (req.method === 'POST') {
      const existing = (await getTrail(slug)) as Trail | null;
      const now = new Date().toISOString();

      // Adiciona um tema à trilha da prefeitura, criando-a se for o primeiro.
      if (req.query.action === 'topic') {
        const title = String(req.body?.title ?? '').trim();
        if (!title) return res.status(400).json({ error: 'Informe o tema.' });

        const tenant = await getTenant(tenantId);
        const trail: Trail = existing ?? {
          id: slug,
          slug,
          name: `Conteúdo de ${tenant?.name ?? 'sua prefeitura'}`,
          description: 'Temas cadastrados pela própria prefeitura.',
          tenantId,
          topics: [],
          levels: ['Básico', 'Intermediário', 'Especialista'],
          // Nasce despublicada: publica quando houver conteúdo aprovado.
          isPublished: false,
          order: 50,
          createdAt: now,
          updatedAt: now,
        };

        if (trail.topics.length >= 100) {
          return res.status(400).json({ error: 'Limite de 100 temas por trilha.' });
        }

        const id = slugify(title) || `tema-${trail.topics.length + 1}`;
        if (trail.topics.some((t) => t.id === id)) {
          return res.status(409).json({ error: 'Já existe um tema com esse nome.' });
        }

        trail.topics.push({
          id,
          title: title.slice(0, 200),
          legalReference: req.body?.legalReference
            ? String(req.body.legalReference).slice(0, 120)
            : undefined,
        });

        await upsertTrail(trail);
        return res.status(201).json({ ok: true, topicId: id });
      }

      return res.status(400).json({ error: 'Ação não reconhecida.' });
    }

    if (req.method === 'PATCH') {
      const trail = (await getTrail(slug)) as Trail | null;
      if (!trail) return res.status(404).json({ error: 'Nenhum conteúdo próprio ainda.' });

      const topicId = String(req.body?.topicId ?? '');
      const index = trail.topics.findIndex((t) => t.id === topicId);
      if (index < 0) return res.status(404).json({ error: 'Tema não encontrado.' });

      const topic = trail.topics[index] as PendingTopic;

      // --- Gerar rascunho -------------------------------------------------
      if (req.query.action === 'generate') {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return res.status(503).json({ error: 'Serviço de IA não configurado.' });
        }

        const quota = await checkAiQuota(tenantId);
        if (!quota.allowed) {
          return res.status(429).json({ error: quota.reason, quotaExceeded: true });
        }

        const { module, model } = await generateModuleWithGemini(
          {
            trail: trail.name,
            index,
            level: 'Básico',
            topicTitle: topic.title,
            legalReference: topic.legalReference,
          },
          apiKey
        );

        topic.draftContent = {
          title: module.title,
          slideTexts: module.slideTexts,
          question: module.question,
          options: module.options,
          feedbackCorrect: module.feedbackCorrect,
          feedbackWrong: module.feedbackWrong,
        };
        topic.draftGeneratedAt = new Date().toISOString();

        trail.topics[index] = topic;
        await upsertTrail(trail);

        recordAiUsage({
          tenantId,
          email: scope.email,
          trail: trail.slug,
          level: 'Básico',
          moduleIndex: index,
          model,
          cacheHit: false,
        }).catch((err) => console.error('[aiUsage] falha ao registrar', err));

        return res.json({ ok: true, draft: topic.draftContent });
      }

      // --- Aprovar ou descartar -------------------------------------------
      if (req.query.action === 'approve') {
        if (!topic.draftContent) {
          return res.status(400).json({ error: 'Não há rascunho para aprovar.' });
        }

        if (req.body?.approved === false) {
          delete topic.draftContent;
          delete topic.draftGeneratedAt;
          trail.topics[index] = topic;
          await upsertTrail(trail);
          return res.json({ ok: true, approved: false });
        }

        // O gestor pode corrigir o texto antes de aprovar; o que ele enviar
        // prevalece sobre o que a IA escreveu.
        const edited = req.body?.content;
        const content: VariantContent = edited?.question
          ? {
              title: String(edited.title ?? topic.draftContent.title).slice(0, 200),
              slideTexts: (Array.isArray(edited.slideTexts) ? edited.slideTexts : [])
                .slice(0, 5)
                .map((t: unknown) => String(t).slice(0, 600)),
              question: String(edited.question).slice(0, 600),
              options: (Array.isArray(edited.options) ? edited.options : [])
                .slice(0, 6)
                .map((o: any) => ({
                  label: String(o?.label ?? '').slice(0, 400),
                  value: o?.value === 'correct' ? 'correct' : 'wrong',
                }))
                .filter((o: any) => o.label),
              feedbackCorrect: String(edited.feedbackCorrect ?? '').slice(0, 600),
              feedbackWrong: String(edited.feedbackWrong ?? '').slice(0, 600),
            }
          : topic.draftContent;

        if (!content.options.some((o) => o.value === 'correct')) {
          return res
            .status(400)
            .json({ error: 'O quiz precisa de uma alternativa correta.' });
        }

        topic.baseContent = content;
        delete topic.draftContent;
        delete topic.draftGeneratedAt;
        trail.topics[index] = topic;

        // Com o primeiro tema aprovado, a trilha passa a valer para os alunos.
        if (!trail.isPublished) trail.isPublished = true;

        await upsertTrail(trail);
        return res.json({ ok: true, approved: true, published: trail.isPublished });
      }

      return res.status(400).json({ error: 'Ação não reconhecida.' });
    }

    return methodNotAllowed(res, ['GET', 'POST', 'PATCH']);
  } catch (err) {
    return handleError(res, err, 'manager/content');
  }
}
