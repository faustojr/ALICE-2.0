/**
 * POST /api/quizResult — resultado de um quiz.
 *
 * É aqui que o ciclo de aprendizado fecha: quando alunos distintos acertam
 * com uma variante gerada pela IA, ela é promovida e vira o conteúdo padrão
 * daquele módulo. O acerto é a evidência de que a nova explicação ensinou.
 *
 * Contamos alunos distintos, não tentativas: o mesmo aluno acertando de novo
 * não diz nada novo sobre a qualidade do conteúdo.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, clientIp, handleError, methodNotAllowed, rateLimit } from '../lib/http.js';
import { resolveUnverifiedStudent } from '../lib/auth.js';
import { recordVariantOutcome } from '../lib/repositories.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const limit = rateLimit(`quiz:${clientIp(req)}`, 200, 15 * 60 * 1000);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({ error: 'Muitas respostas em sequência.' });
    }

    const { email, variantId, correct } = req.body ?? {};

    if (!email) return res.status(400).json({ error: 'E-mail não informado.' });
    if (typeof correct !== 'boolean') {
      return res.status(400).json({ error: 'Resultado do quiz não informado.' });
    }

    const session = await resolveUnverifiedStudent(String(email));

    // Sem variante, o aluno respondeu ao conteúdo padrão: nada a promover.
    if (!variantId) {
      return res.json({ ok: true, promoted: false });
    }

    const outcome = await recordVariantOutcome(String(variantId), session.email, correct);

    return res.json({
      ok: true,
      promoted: outcome.promoted,
      correctCount: outcome.correctCount,
      threshold: outcome.threshold,
    });
  } catch (err) {
    return handleError(res, err, 'quizResult');
  }
}
