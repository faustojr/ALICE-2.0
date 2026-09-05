/**
 * GET /api/trails — trilhas disponíveis para o aluno.
 *
 * Substitui a string fixa "Lei 14.133/2021" que o app carregava. A lista sai
 * do banco e respeita `enabledTrails` do tenant, então habilitar uma trilha
 * nova para uma prefeitura é mudar um campo, não publicar código.
 *
 * Devolve só o resumo: o conteúdo de cada módulo vem por /api/module, quando
 * o aluno chega nele.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handleError, methodNotAllowed } from '../lib/http.js';
import { resolveUnverifiedStudent } from '../lib/auth.js';
import { listTrailsFor } from '../lib/repositories.js';
import type { TrailSummary } from '../types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    const email = req.query.email ? String(req.query.email) : undefined;
    const tenantId = email ? (await resolveUnverifiedStudent(email)).tenantId : null;

    const trails = await listTrailsFor(tenantId);

    const summaries: TrailSummary[] = trails.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      description: t.description,
      topicCount: t.topics.length,
      levels: t.levels,
    }));

    // Catálogo muda raramente; o CDN evita uma leitura por abertura do app.
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');

    return res.json({ trails: summaries });
  } catch (err) {
    return handleError(res, err, 'trails');
  }
}
