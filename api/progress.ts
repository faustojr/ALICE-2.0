/**
 * /api/progress — leitura e gravação do progresso do aluno.
 *
 * Substitui a escrita direta do cliente no Firestore. Mesmo no modo piloto
 * (e-mail não verificado), passar por aqui permite validar os limites do
 * progresso e vincular o aluno ao tenant correto.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, clientIp, handleError, methodNotAllowed, rateLimit } from '../lib/http.js';
import { resolveUnverifiedStudent } from '../lib/auth.js';
import { findTenantByEmailDomain } from '../lib/auth.js';
import { getUser, upsertMembership, upsertUser } from '../lib/repositories.js';
import type { LearningLevel } from '../types.js';

const LEVELS: LearningLevel[] = ['Básico', 'Intermediário', 'Especialista'];

/**
 * Pontos crescem apenas dentro de um teto por requisição. Sem isso, um
 * cliente adulterado poderia gravar um placar arbitrário.
 */
const MAX_POINTS_DELTA = 500;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  try {
    if (req.method === 'GET') {
      const email = String(req.query.email || '');
      if (!email) return res.status(400).json({ error: 'E-mail não informado.' });

      const session = await resolveUnverifiedStudent(email);
      const user = await getUser(session.email);

      return res.json({
        user,
        tenantId: session.tenantId,
      });
    }

    if (req.method === 'POST') {
      const limit = rateLimit(`progress:${clientIp(req)}`, 120, 15 * 60 * 1000);
      if (!limit.allowed) {
        res.setHeader('Retry-After', String(limit.retryAfterSeconds));
        return res.status(429).json({ error: 'Muitas gravações. Aguarde um momento.' });
      }

      const { email, progress } = req.body ?? {};
      if (!email) return res.status(400).json({ error: 'E-mail não informado.' });
      if (!progress || typeof progress !== 'object') {
        return res.status(400).json({ error: 'Progresso não informado.' });
      }

      const session = await resolveUnverifiedStudent(String(email));
      const existing = (await getUser(session.email)) as Record<string, any> | null;

      // Vincula ao tenant pelo domínio na primeira gravação, quando aplicável.
      let tenantId = session.tenantId;
      if (!tenantId) {
        tenantId = await findTenantByEmailDomain(session.email);
        if (tenantId) {
          await upsertMembership(tenantId, session.email, 'ALUNO');
        }
      }

      const currentPoints = Number(existing?.points ?? 0);
      const incomingPoints = Number(progress.points ?? currentPoints);

      // Nunca retrocede e nunca salta além do teto por requisição.
      const points = Math.max(
        currentPoints,
        Math.min(incomingPoints, currentPoints + MAX_POINTS_DELTA)
      );

      const level = LEVELS.includes(progress.currentLevel)
        ? progress.currentLevel
        : (existing?.currentLevel ?? 'Básico');

      await upsertUser(session.email, {
        name: progress.name || existing?.name || session.email.split('@')[0],
        tenantId: tenantId ?? existing?.tenantId ?? null,
        points,
        level: Number(progress.level) || existing?.level || 1,
        currentLevel: level,
        currentTrail: progress.currentTrail ?? existing?.currentTrail ?? null,
        currentModuleIndex: Number(progress.currentModuleIndex) || 0,
        highestModuleIndex: Math.max(
          Number(existing?.highestModuleIndex ?? 0),
          Number(progress.highestModuleIndex ?? 0)
        ),
        quizCount: Math.max(
          Number(existing?.quizCount ?? 0),
          Number(progress.quizCount ?? 0)
        ),
        correctQuizzesCount: progress.correctQuizzesCount ?? existing?.correctQuizzesCount,
        completedQuizzes: Array.isArray(progress.completedQuizzes)
          ? progress.completedQuizzes.slice(0, 2000)
          : existing?.completedQuizzes,
        badges: Array.isArray(progress.badges) ? progress.badges.slice(0, 200) : existing?.badges,
        streakDays: Number(progress.streakDays) || existing?.streakDays || 0,
        lastStudyDate: progress.lastStudyDate ?? existing?.lastStudyDate ?? null,
        hasTestedReels: Boolean(progress.hasTestedReels ?? existing?.hasTestedReels),
        status: 'ativo',
        pilotStatus: existing?.pilotStatus ?? 'ativo',
      });

      return res.json({ ok: true, points, tenantId });
    }

    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (err) {
    return handleError(res, err, 'progress');
  }
}
