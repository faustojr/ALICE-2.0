/**
 * GET /api/module — conteúdo a servir para um módulo.
 *
 * Ordem de preferência:
 *   1. Variante PROMOTED do tenant (conteúdo que já provou ensinar melhor ali)
 *   2. Variante PROMOTED global
 *   3. Nada — e o cliente usa o conteúdo padrão embutido no app
 *
 * Custo de IA: zero. Esta rota nunca chama o Gemini; ela só entrega o que já
 * existe. A geração acontece exclusivamente em /api/generateModule, quando o
 * aluno erra o quiz.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handleError, methodNotAllowed } from '../lib/http.js';
import { resolveUnverifiedStudent } from '../lib/auth.js';
import {
  findPromotedVariant,
  incrementVariantServed,
  moduleKeyOf,
} from '../lib/repositories.js';
import type { LearningLevel } from '../types.js';

const LEVELS: LearningLevel[] = ['Básico', 'Intermediário', 'Especialista'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    const trail = String(req.query.trail || '');
    const level = String(req.query.level || '') as LearningLevel;
    const index = Number(req.query.index);
    const email = req.query.email ? String(req.query.email) : undefined;

    if (!trail) return res.status(400).json({ error: 'Trilha não informada.' });
    if (!LEVELS.includes(level)) return res.status(400).json({ error: 'Nível inválido.' });
    if (!Number.isInteger(index) || index < 0) {
      return res.status(400).json({ error: 'Index inválido.' });
    }

    const tenantId = email ? (await resolveUnverifiedStudent(email)).tenantId : null;
    const variant = await findPromotedVariant(moduleKeyOf(trail, level, index), tenantId);

    if (!variant) {
      // Sem variante promovida: o cliente serve o conteúdo padrão do app.
      return res.json({ source: 'STANDARD', variant: null });
    }

    incrementVariantServed(variant.id).catch(() => {});

    return res.json({
      source: 'PROMOTED',
      variant: {
        id: variant.id,
        variationId: variant.variationId,
        content: variant.content,
        origin: variant.origin,
      },
    });
  } catch (err) {
    return handleError(res, err, 'module');
  }
}
