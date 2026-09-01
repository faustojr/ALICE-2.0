/**
 * /api/admin/variants — auditoria do conteúdo gerado por IA.
 *
 * A promoção é automática: três alunos distintos acertando bastam para uma
 * variante virar o conteúdo padrão de um módulo. Com três alternativas por
 * quiz, isso pode acontecer por acaso em cerca de 3,7% dos casos — e ninguém
 * revisou o texto do ponto de vista jurídico.
 *
 * Esta rota existe para que a equipe ALICE veja o que foi promovido e possa
 * rejeitar o que não deveria ter sido. Sem ela, a promoção automática seria
 * uma caixa-preta.
 *
 * GET   lista variantes (filtro por status)
 * PATCH promove ou rejeita manualmente (?id=...)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handleError, methodNotAllowed } from '../../lib/http.js';
import { requireSuperAdmin } from '../../lib/auth.js';
import { listVariants, setVariantStatus } from '../../lib/repositories.js';
import type { VariantStatus } from '../../types.js';

const VALID_STATUS: VariantStatus[] = ['CANDIDATE', 'PROMOTED', 'REJECTED'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  try {
    const session = await requireSuperAdmin(req.headers.authorization);

    if (req.method === 'GET') {
      const status = req.query.status ? String(req.query.status) : undefined;
      if (status && !VALID_STATUS.includes(status as VariantStatus)) {
        return res.status(400).json({ error: 'Status inválido.' });
      }

      const variants = await listVariants({
        status,
        limit: Math.min(Number(req.query.limit) || 100, 200),
      });

      return res.json({
        variants: variants.map((v) => {
          const distinctCorrect = v.stats?.correctBy?.length ?? 0;
          const total = (v.stats?.correct ?? 0) + (v.stats?.wrong ?? 0);

          return {
            id: v.id,
            moduleKey: v.moduleKey,
            trail: v.trail,
            level: v.level,
            moduleIndex: v.moduleIndex,
            status: v.status,
            origin: v.origin,
            tenantId: v.tenantId,
            title: v.content?.title ?? '',
            question: v.content?.question ?? '',
            slideTexts: v.content?.slideTexts ?? [],
            options: v.content?.options ?? [],
            feedbackCorrect: v.content?.feedbackCorrect ?? '',
            stats: {
              served: v.stats?.served ?? 0,
              correct: v.stats?.correct ?? 0,
              wrong: v.stats?.wrong ?? 0,
              distinctCorrect,
              // Taxa de acerto: o sinal mais direto de que o conteúdo ensina.
              successRate: total > 0 ? Math.round(((v.stats?.correct ?? 0) / total) * 100) : null,
            },
            createdAt: v.createdAt,
            promotedAt: v.promotedAt ?? null,
          };
        }),
      });
    }

    if (req.method === 'PATCH') {
      const id = String(req.query.id || req.body?.id || '');
      const status = String(req.body?.status || '');

      if (!id) return res.status(400).json({ error: 'Id da variante não informado.' });
      if (status !== 'PROMOTED' && status !== 'REJECTED') {
        return res.status(400).json({ error: 'Status deve ser PROMOTED ou REJECTED.' });
      }

      await setVariantStatus(id, status, session.email);
      return res.json({ ok: true });
    }

    return methodNotAllowed(res, ['GET', 'PATCH']);
  } catch (err) {
    return handleError(res, err, 'admin/variants');
  }
}
