/**
 * POST /api/quizResult — resultado de um quiz.
 *
 * Faz três coisas que dependem umas das outras:
 *
 * 1. **Pontua com peso cognitivo.** Acertar "qual o prazo do Art. X" não é a
 *    mesma conquista que julgar a regularidade de uma decisão sob pressão.
 *    Pontuar igual apagaria a diferença justamente no número que o gestor usa
 *    para avaliar a equipe.
 *
 * 2. **Promove variantes.** Quando alunos distintos acertam com um conteúdo
 *    gerado pela IA, ele vira o padrão daquele módulo — o acerto é a evidência
 *    de que a nova explicação ensinou.
 *
 * 3. **Controla o desbloqueio de nível.** O avanço entre camadas é por
 *    desempenho acumulado, não por escolha do aluno.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, clientIp, handleError, methodNotAllowed, rateLimit } from '../lib/http.js';
import { resolveUnverifiedStudent } from '../lib/auth.js';
import { recordQuizOutcome, recordVariantOutcome } from '../lib/repositories.js';
import { COGNITIVE_WEIGHTS, type CognitiveLevel } from '../lib/moduleGenerator.js';
import {
  BASE_QUIZ_POINTS,
  careerTier,
  highestUnlockedLevel,
  LEVEL_UNLOCK_CORRECT_ANSWERS,
} from '../types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const limit = rateLimit(`quiz:${clientIp(req)}`, 200, 15 * 60 * 1000);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({ error: 'Muitas respostas em sequência.' });
    }

    const { email, variantId, correct, cognitiveLevel, attempt } = req.body ?? {};

    if (!email) return res.status(400).json({ error: 'E-mail não informado.' });
    if (typeof correct !== 'boolean') {
      return res.status(400).json({ error: 'Resultado do quiz não informado.' });
    }

    const session = await resolveUnverifiedStudent(String(email));

    // O peso vem da declaração do modelo, validada aqui: um rótulo
    // desconhecido cai no neutro em vez de inflar o placar.
    const level = String(cognitiveLevel ?? '') as CognitiveLevel;
    const weight = COGNITIVE_WEIGHTS[level] ?? 1.0;
    const pointsAwarded = correct ? Math.round(BASE_QUIZ_POINTS * weight) : 0;

    // Grava o acerto e a pontuação ponderada. É aqui que a progressão passa a
    // existir: `correctAnswersTotal` é o contador que abre os níveis, e ele
    // não chega por nenhum outro caminho — o cliente não o envia, e não deve.
    const totals = await recordQuizOutcome(session.email, {
      correct,
      pointsAwarded,
      // Cliente antigo não manda `attempt`. Tratar como primeira tentativa
      // mantém o denominador honesto: nunca conta um acerto de segunda como
      // se fosse de primeira.
      attempt: Number(attempt) || 1,
    });

    const correctAfter = totals.correctAnswersTotal;
    const correctBefore = correctAfter - (correct ? 1 : 0);

    const levelBefore = highestUnlockedLevel(correctBefore);
    const levelAfter = highestUnlockedLevel(correctAfter);

    const nextThreshold =
      levelAfter === 'Básico'
        ? LEVEL_UNLOCK_CORRECT_ANSWERS.Intermediário
        : levelAfter === 'Intermediário'
          ? LEVEL_UNLOCK_CORRECT_ANSWERS.Especialista
          : null;

    // Sem variante, o aluno respondeu ao conteúdo base: nada a promover, mas a
    // pontuação e a progressão valem igual.
    let promoted = false;
    let correctCount: number | undefined;
    let threshold: number | undefined;

    if (variantId) {
      const outcome = await recordVariantOutcome(
        String(variantId),
        session.email,
        correct
      );
      promoted = outcome.promoted;
      correctCount = outcome.correctCount;
      threshold = outcome.threshold;
    }

    return res.json({
      ok: true,
      promoted,
      correctCount,
      threshold,
      // Devolvidos ao cliente para que ele mostre o ganho real e celebre o
      // desbloqueio no momento em que ele acontece.
      pointsAwarded,
      cognitiveLevel: COGNITIVE_WEIGHTS[level] ? level : null,
      progression: {
        correctAnswersTotal: correctAfter,
        totalPoints: totals.points,
        unlockedLevel: levelAfter,
        levelUnlockedNow: levelAfter !== levelBefore,
        nextLevelAt: nextThreshold,
        remainingToNextLevel: nextThreshold ? Math.max(0, nextThreshold - correctAfter) : null,
        careerTier: careerTier(totals.points),
      },
    });
  } catch (err) {
    return handleError(res, err, 'quizResult');
  }
}
