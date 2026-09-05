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
  getTrail,
  getUser,
  moduleKeyOf,
  recordAiUsage,
  topicForIndex,
} from '../lib/repositories.js';
import { generateModuleWithGemini } from '../lib/moduleGenerator.js';
import { highestUnlockedLevel, type LearningLevel } from '../types.js';

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

    const { trail, index, level, failCount, email, wrongAnswerChosen, previousQuestion } =
      req.body ?? {};

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

    // O nível pedido é limitado pelo que os acertos já abriram. O cliente
    // guarda o nível no localStorage, então sem isto basta editar o navegador
    // para receber caso concreto sem ter passado pelo repertório — o oposto da
    // calibragem que a trilha existe para fazer.
    const student = email ? await getUser(session.email) : null;
    const unlocked = highestUnlockedLevel(Number(student?.correctAnswersTotal ?? 0));
    const effectiveLevel: LearningLevel =
      validLevels.indexOf(level) <= validLevels.indexOf(unlocked) ? level : unlocked;

    // O tópico vem da trilha no banco. Sem isso o gerador só saberia produzir
    // conteúdo da Lei 14.133, que era o limite da versão anterior.
    const trailDoc = await getTrail(String(trail));
    const position = trailDoc ? topicForIndex(trailDoc, moduleIndex) : null;

    const { module, model } = await generateModuleWithGemini(
      {
        trail: trailDoc?.name ?? String(trail),
        index: moduleIndex,
        level: effectiveLevel,
        failCount: Number(failCount) || 0,
        topicTitle: position?.topic.title,
        legalReference: position?.topic.legalReference,
        cycle: position?.cycle,
        // A alternativa marcada é o diagnóstico do erro. Sem repassá-la aqui,
        // o bloco de remediação do prompt recebe apenas "houve erro" e volta a
        // reexplicar o tema inteiro em vez da confusão específica.
        wrongAnswerChosen:
          typeof wrongAnswerChosen === 'string' ? wrongAnswerChosen.slice(0, 500) : undefined,
        previousQuestion:
          typeof previousQuestion === 'string' ? previousQuestion.slice(0, 1000) : undefined,
      },
      apiKey
    );

    // A variante é persistida como candidata em vez de descartada depois do
    // uso. Se levar alunos distintos ao acerto, /api/quizResult a promove a
    // padrão do módulo — e a geração deixa de ser paga de novo por cada aluno
    // que erra a mesma questão.
    let variantId: string | null = null;
    try {
      const variant = await createVariant({
        moduleKey: moduleKeyOf(String(trail), effectiveLevel, moduleIndex),
        trail: String(trail),
        level: effectiveLevel,
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
      level: effectiveLevel,
      moduleIndex,
      model,
      cacheHit: false,
    }).catch((err) => console.error('[aiUsage] falha ao registrar telemetria', err));

    // `levelServed` avisa o app quando o nível pedido foi rebaixado, para ele
    // corrigir o próprio estado em vez de seguir exibindo um nível que não tem.
    return res.json({ ...module, variantId, levelServed: effectiveLevel });
  } catch (err) {
    return handleError(res, err, 'generateModule');
  }
}
