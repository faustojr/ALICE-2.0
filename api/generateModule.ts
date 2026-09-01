/**
 * POST /api/generateModule
 *
 * Gera um módulo de microaprendizagem via Gemini, respeitando a cota mensal
 * do tenant. O e-mail do aluno não é verificado (modo piloto): ele só atribui
 * consumo e progresso, nunca concede privilégio.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, clientIp, handleError, methodNotAllowed, rateLimit } from '../lib/http.js';
import { resolveUnverifiedStudent } from '../lib/auth.js';
import {
  checkAiQuota,
  createVariant,
  moduleKeyOf,
  recordAiUsage,
} from '../lib/repositories.js';
import { generateModuleWithGemini } from '../lib/moduleGenerator.js';
import type { LearningLevel } from '../types.js';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 20;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'Serviço de IA não configurado.' });
    }

    const { trail, index, level, failCount, email } = req.body ?? {};

    if (!trail) return res.status(400).json({ error: 'Trilha não informada.' });
    if (index === undefined) return res.status(400).json({ error: 'Index não informado.' });
    if (!level) return res.status(400).json({ error: 'Nível não informado.' });

    const moduleIndex = Number(index);
    if (!Number.isInteger(moduleIndex) || moduleIndex < 0 || moduleIndex > 10_000) {
      return res.status(400).json({ error: 'Index inválido.' });
    }

    const validLevels: LearningLevel[] = ['Básico', 'Intermediário', 'Especialista'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({ error: 'Nível inválido.' });
    }

    // Rate limit por identidade declarada, com o IP como piso.
    const limitKey = email ? `email:${String(email).toLowerCase()}` : `ip:${clientIp(req)}`;
    const limit = rateLimit(limitKey, MAX_PER_WINDOW, WINDOW_MS);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({
        error: `Limite de geração atingido. Tente novamente em ${Math.ceil(
          limit.retryAfterSeconds / 60
        )} minutos.`,
      });
    }

    // Cota mensal do tenant — o controle que protege o custo da operação.
    const session = email
      ? await resolveUnverifiedStudent(String(email))
      : { email: 'anonimo', tenantId: null, role: 'ALUNO' as const, displayName: '', verified: false };

    const quota = await checkAiQuota(session.tenantId);
    if (!quota.allowed) {
      return res.status(429).json({ error: quota.reason, quotaExceeded: true });
    }

    const { module, model } = await generateModuleWithGemini(
      { trail, index: moduleIndex, level, failCount: Number(failCount) || 0 },
      apiKey
    );

    // A variante é persistida como candidata em vez de descartada depois do
    // uso. Se levar alunos distintos ao acerto, /api/quizResult a promove a
    // padrão do módulo — e a geração deixa de ser paga de novo por cada aluno
    // que erra a mesma questão.
    let variantId: string | null = null;
    try {
      const variant = await createVariant({
        moduleKey: moduleKeyOf(String(trail), level, moduleIndex),
        trail: String(trail),
        level,
        moduleIndex,
        variationId: module.variationId,
        content: {
          title: module.title,
          slideTexts: module.slideTexts,
          question: module.question,
          options: module.options,
          feedbackCorrect: module.feedbackCorrect,
          feedbackWrong: module.feedbackWrong,
        },
        origin: 'AI',
        tenantId: session.tenantId ?? null,
        createdBy: session.email,
      });
      variantId = variant.id;
    } catch (err) {
      // Falha ao persistir não impede o aluno de estudar agora.
      console.error('[moduleVariants] falha ao registrar variante', err);
    }

    // Telemetria não pode derrubar a resposta do aluno.
    recordAiUsage({
      tenantId: session.tenantId ?? 'sem-tenant',
      email: session.email,
      trail: String(trail),
      level,
      moduleIndex,
      model,
      cacheHit: false,
    }).catch((err) => console.error('[aiUsage] falha ao registrar telemetria', err));

    return res.json({ ...module, variantId });
  } catch (err) {
    return handleError(res, err, 'generateModule');
  }
}
