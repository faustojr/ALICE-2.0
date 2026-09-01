/**
 * GET /api/module — conteúdo a servir para um módulo.
 *
 * Ordem de preferência:
 *   1. Variante PROMOTED do tenant (o que já provou ensinar melhor ali)
 *   2. Variante PROMOTED global
 *   3. Conteúdo base do tópico, escrito à mão na trilha
 *   4. Nada — e o cliente usa o texto genérico do app
 *
 * Custo de IA: zero. Esta rota nunca chama o Gemini. A geração acontece
 * exclusivamente em /api/generateModule, quando o aluno erra o quiz.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handleError, methodNotAllowed } from '../lib/http.js';
import { resolveUnverifiedStudent } from '../lib/auth.js';
import {
  findPromotedVariant,
  getTrail,
  incrementVariantServed,
  moduleKeyOf,
  topicForIndex,
} from '../lib/repositories.js';
import type { LearningLevel } from '../types.js';

const LEVELS: LearningLevel[] = ['Básico', 'Intermediário', 'Especialista'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    const trailSlug = String(req.query.trail || '');
    const level = String(req.query.level || '') as LearningLevel;
    const index = Number(req.query.index);
    const email = req.query.email ? String(req.query.email) : undefined;

    if (!trailSlug) return res.status(400).json({ error: 'Trilha não informada.' });
    if (!LEVELS.includes(level)) return res.status(400).json({ error: 'Nível inválido.' });
    if (!Number.isInteger(index) || index < 0) {
      return res.status(400).json({ error: 'Index inválido.' });
    }

    const tenantId = email ? (await resolveUnverifiedStudent(email)).tenantId : null;

    const [variant, trail] = await Promise.all([
      findPromotedVariant(moduleKeyOf(trailSlug, level, index), tenantId),
      getTrail(trailSlug),
    ]);

    // Uma variante promovida já foi validada pelo acerto de alunos reais e
    // tem precedência sobre o texto original da trilha.
    if (variant) {
      incrementVariantServed(variant.id).catch(() => {});
      return res.json({
        source: 'PROMOTED',
        variant: {
          id: variant.id,
          variationId: variant.variationId,
          content: variant.content,
          origin: variant.origin,
        },
        topic: null,
      });
    }

    if (!trail) {
      return res.status(404).json({ error: 'Trilha não encontrada.' });
    }

    const position = topicForIndex(trail, index);
    if (!position) {
      return res.status(404).json({ error: 'Trilha sem tópicos.' });
    }

    const { topic, cycle } = position;

    return res.json({
      source: topic.baseContent ? 'TRAIL_BASE' : 'EMPTY',
      variant: topic.baseContent
        ? {
            id: null,
            variationId: `base_${trail.slug}_${topic.id}`,
            content: topic.baseContent,
            origin: 'STANDARD',
          }
        : null,
      topic: {
        id: topic.id,
        title: topic.title,
        legalReference: topic.legalReference ?? null,
        cycle,
      },
      trail: { slug: trail.slug, name: trail.name, topicCount: trail.topics.length },
    });
  } catch (err) {
    return handleError(res, err, 'module');
  }
}
