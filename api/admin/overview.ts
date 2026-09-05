/**
 * GET /api/admin/overview
 *
 * Painel executivo da operação: receita recorrente, adoção, engajamento e
 * consumo de IA agregados. É a tela que responde "como vai a startup hoje".
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handleError, methodNotAllowed } from '../../lib/http.js';
import { requireSuperAdmin } from '../../lib/auth.js';
import { listLeads, listTenants } from '../../lib/repositories.js';
import { PLANS } from '../../types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    await requireSuperAdmin(req.headers.authorization);

    const [tenants, leads] = await Promise.all([listTenants(), listLeads(100)]);

    const paying = tenants.filter(
      (t) => t.status === 'ATIVO' && PLANS[t.plan].priceCents > 0
    );

    const mrrCents = paying.reduce((sum, t) => sum + PLANS[t.plan].priceCents, 0);

    const totalSeats = tenants.reduce((sum, t) => sum + (t.stats?.totalUsers ?? 0), 0);
    const activeSeats = tenants.reduce((sum, t) => sum + (t.stats?.activeUsers30d ?? 0), 0);
    const totalQuizzes = tenants.reduce((sum, t) => sum + (t.stats?.totalQuizzes ?? 0), 0);
    const aiGenerations = tenants.reduce(
      (sum, t) => sum + (t.stats?.aiGenerationsThisMonth ?? 0),
      0
    );

    const byStatus = tenants.reduce<Record<string, number>>((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {});

    const byUf = tenants.reduce<Record<string, number>>((acc, t) => {
      acc[t.uf] = (acc[t.uf] ?? 0) + 1;
      return acc;
    }, {});

    // Trials que vencem nos próximos 15 dias — a fila de conversão comercial.
    const soon = Date.now() + 15 * 24 * 60 * 60 * 1000;
    const expiringTrials = tenants
      .filter(
        (t) =>
          t.status === 'TRIAL' &&
          t.trialEndsAt &&
          Date.parse(t.trialEndsAt) < soon
      )
      .map((t) => ({
        id: t.id,
        name: t.name,
        uf: t.uf,
        trialEndsAt: t.trialEndsAt,
        activeUsers30d: t.stats?.activeUsers30d ?? 0,
      }))
      .sort((a, b) => (a.trialEndsAt ?? '').localeCompare(b.trialEndsAt ?? ''));

    // Tenants sem atividade recente — risco de churn antes da renovação.
    const staleCutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const atRisk = tenants
      .filter((t) => {
        if (t.status !== 'ATIVO' && t.status !== 'TRIAL') return false;
        const last = t.stats?.lastActivityAt ? Date.parse(t.stats.lastActivityAt) : 0;
        return last < staleCutoff;
      })
      .map((t) => ({
        id: t.id,
        name: t.name,
        uf: t.uf,
        lastActivityAt: t.stats?.lastActivityAt ?? null,
        totalUsers: t.stats?.totalUsers ?? 0,
      }));

    return res.json({
      generatedAt: new Date().toISOString(),
      revenue: {
        mrrCents,
        arrCents: mrrCents * 12,
        payingTenants: paying.length,
      },
      adoption: {
        totalTenants: tenants.length,
        byStatus,
        byUf,
        totalSeats,
        activeSeats,
        activationRate: totalSeats > 0 ? Math.round((activeSeats / totalSeats) * 100) : 0,
      },
      engagement: {
        totalQuizzes,
        quizzesPerActiveUser:
          activeSeats > 0 ? Math.round((totalQuizzes / activeSeats) * 10) / 10 : 0,
      },
      ai: {
        generationsThisMonth: aiGenerations,
      },
      pipeline: {
        newLeads: leads.length,
        expiringTrials,
        atRisk,
      },
    });
  } catch (err) {
    return handleError(res, err, 'admin/overview');
  }
}
