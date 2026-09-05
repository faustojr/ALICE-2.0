/**
 * /api/admin/trails — gestão das trilhas de conteúdo.
 *
 * GET   lista todas as trilhas com seus tópicos
 * POST  cria uma trilha
 * PATCH atualiza uma trilha (?id=...)
 *
 * Criar uma trilha nova deixou de exigir deploy: o conteúdo vive no banco.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handleError, methodNotAllowed } from '../../lib/http.js';
import { requireSuperAdmin } from '../../lib/auth.js';
import { getTrail, listAllTrails, upsertTrail } from '../../lib/repositories.js';
import type { LearningLevel, Trail, TrailTopic } from '../../types.js';

const ALL_LEVELS: LearningLevel[] = ['Básico', 'Intermediário', 'Especialista'];

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** Normaliza os tópicos vindos do cliente, descartando o que não reconhecemos. */
function sanitizeTopics(input: unknown): TrailTopic[] {
  if (!Array.isArray(input)) return [];

  return input.slice(0, 200).map((raw: any, i: number) => {
    const title = String(raw?.title ?? '').trim().slice(0, 200);
    const topic: TrailTopic = {
      id: raw?.id ? slugify(String(raw.id)) : slugify(title) || `topico-${i + 1}`,
      title,
      legalReference: raw?.legalReference
        ? String(raw.legalReference).slice(0, 120)
        : undefined,
    };

    const base = raw?.baseContent;
    if (base?.question && Array.isArray(base?.options)) {
      const options = base.options
        .slice(0, 6)
        .map((o: any) => ({
          label: String(o?.label ?? '').slice(0, 400),
          value: o?.value === 'correct' ? 'correct' : 'wrong',
        }))
        .filter((o: any) => o.label);

      // Um quiz sem alternativa correta trava o aluno: descartamos o conteúdo
      // base em vez de gravar algo impossível de acertar.
      if (options.some((o: any) => o.value === 'correct') && options.length >= 2) {
        topic.baseContent = {
          title: String(base.title ?? title).slice(0, 200),
          slideTexts: (Array.isArray(base.slideTexts) ? base.slideTexts : [])
            .slice(0, 5)
            .map((t: any) => String(t).slice(0, 600)),
          question: String(base.question).slice(0, 600),
          options,
          feedbackCorrect: String(base.feedbackCorrect ?? '').slice(0, 600),
          feedbackWrong: String(base.feedbackWrong ?? '').slice(0, 600),
        };
      }
    }

    return topic;
  }).filter((t) => t.title);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  try {
    await requireSuperAdmin(req.headers.authorization);

    if (req.method === 'GET') {
      const trails = await listAllTrails();
      return res.json({
        trails: trails.map((t) => ({
          ...t,
          topicCount: t.topics.length,
          topicsWithContent: t.topics.filter((tp) => tp.baseContent).length,
        })),
      });
    }

    if (req.method === 'POST') {
      const body = req.body ?? {};
      const name = String(body.name ?? '').trim();

      if (!name) return res.status(400).json({ error: 'Nome da trilha é obrigatório.' });

      const slug = slugify(body.slug ? String(body.slug) : name);
      if (!slug) return res.status(400).json({ error: 'Identificador inválido.' });

      const existing = await getTrail(slug);
      if (existing) {
        return res.status(409).json({ error: `Já existe uma trilha "${slug}".` });
      }

      const topics = sanitizeTopics(body.topics);
      if (topics.length === 0) {
        return res.status(400).json({ error: 'Informe ao menos um tópico.' });
      }

      const now = new Date().toISOString();
      const trail: Trail = {
        id: slug,
        slug,
        name: name.slice(0, 160),
        description: String(body.description ?? '').slice(0, 600),
        tenantId: body.tenantId ? String(body.tenantId) : null,
        topics,
        levels: Array.isArray(body.levels)
          ? body.levels.filter((l: string) => ALL_LEVELS.includes(l as LearningLevel))
          : ALL_LEVELS,
        isPublished: body.isPublished === true,
        order: Number(body.order) || 99,
        createdAt: now,
        updatedAt: now,
      };

      await upsertTrail(trail);
      return res.status(201).json({ trail });
    }

    if (req.method === 'PATCH') {
      const id = String(req.query.id || req.body?.id || '');
      if (!id) return res.status(400).json({ error: 'Id da trilha não informado.' });

      const existing = await getTrail(id);
      if (!existing) return res.status(404).json({ error: 'Trilha não encontrada.' });

      const body = req.body ?? {};
      const patch: Trail = {
        ...existing,
        name: body.name ? String(body.name).slice(0, 160) : existing.name,
        description:
          body.description !== undefined
            ? String(body.description).slice(0, 600)
            : existing.description,
        topics: body.topics !== undefined ? sanitizeTopics(body.topics) : existing.topics,
        isPublished:
          body.isPublished !== undefined ? body.isPublished === true : existing.isPublished,
        order: body.order !== undefined ? Number(body.order) || 99 : existing.order,
        updatedAt: new Date().toISOString(),
      };

      if (patch.topics.length === 0) {
        return res.status(400).json({ error: 'A trilha precisa de ao menos um tópico.' });
      }

      await upsertTrail(patch);
      return res.json({ ok: true, trail: patch });
    }

    return methodNotAllowed(res, ['GET', 'POST', 'PATCH']);
  } catch (err) {
    return handleError(res, err, 'admin/trails');
  }
}
