/**
 * /api/manager/groups — turmas por secretaria dentro da prefeitura.
 *
 * A prefeitura compra assentos e distribui a equipe: Educação, Saúde, Obras,
 * Compras. O gestor precisa ver o desempenho de cada uma separadamente e
 * atribuir trilhas diferentes por área.
 *
 * GET    lista grupos com contadores e os membros sem grupo
 * POST   cria um grupo
 * PATCH  atualiza um grupo, ou move um servidor de grupo (?action=assign)
 * DELETE remove um grupo (os servidores permanecem na prefeitura)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handleError, methodNotAllowed } from '../../lib/http.js';
import { requireTenantScope } from '../../lib/auth.js';
import {
  assignMemberToGroup,
  createGroup,
  deleteGroup,
  listGroups,
  listTenantMembers,
  refreshGroupStats,
  updateGroup,
} from '../../lib/repositories.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  try {
    const scope = await requireTenantScope(
      req.headers.authorization,
      req.query.tenantId ? String(req.query.tenantId) : undefined
    );

    if (!scope.tenantId) {
      return res.status(400).json({ error: 'Prefeitura não identificada.' });
    }
    const tenantId = scope.tenantId;

    if (req.method === 'GET') {
      if (req.query.refresh === 'true') {
        await refreshGroupStats(tenantId).catch((err) =>
          console.error('[groups] falha ao recalcular', err)
        );
      }

      const [groups, members] = await Promise.all([
        listGroups(tenantId),
        listTenantMembers(tenantId),
      ]);

      return res.json({
        groups,
        members: members.map((m) => ({
          id: m.id,
          email: m.email,
          role: m.role,
          status: m.status,
          groupId: m.groupId ?? null,
          lastAccessAt: m.lastAccessAt ?? null,
        })),
        // Servidores sem grupo ficam invisíveis nos relatórios por secretaria;
        // o painel destaca esse número para o gestor resolver.
        ungrouped: members.filter((m) => !m.groupId && m.role === 'ALUNO').length,
      });
    }

    if (req.method === 'POST') {
      const name = String(req.body?.name ?? '').trim();
      if (!name) return res.status(400).json({ error: 'Nome do grupo é obrigatório.' });

      const group = await createGroup(tenantId, name, {
        description: req.body?.description
          ? String(req.body.description).slice(0, 300)
          : undefined,
        assignedTrails: Array.isArray(req.body?.assignedTrails)
          ? req.body.assignedTrails.map(String).slice(0, 20)
          : [],
      });

      return res.status(201).json({ group });
    }

    if (req.method === 'PATCH') {
      // Mover um servidor entre grupos é a operação mais frequente do gestor.
      if (req.query.action === 'assign') {
        const membershipId = String(req.body?.membershipId ?? '');
        const groupId = req.body?.groupId ? String(req.body.groupId) : null;

        if (!membershipId) {
          return res.status(400).json({ error: 'Servidor não informado.' });
        }
        if (!membershipId.startsWith(`${tenantId}__`)) {
          return res.status(403).json({ error: 'Servidor de outra prefeitura.' });
        }
        if (groupId && !groupId.startsWith(`${tenantId}__`)) {
          return res.status(403).json({ error: 'Grupo de outra prefeitura.' });
        }

        await assignMemberToGroup(membershipId, groupId);
        return res.json({ ok: true });
      }

      const id = String(req.query.id ?? req.body?.id ?? '');
      if (!id) return res.status(400).json({ error: 'Grupo não informado.' });
      if (!id.startsWith(`${tenantId}__`)) {
        return res.status(403).json({ error: 'Grupo de outra prefeitura.' });
      }

      await updateGroup(id, {
        name: req.body?.name ? String(req.body.name).slice(0, 120) : undefined,
        description:
          req.body?.description !== undefined
            ? String(req.body.description).slice(0, 300)
            : undefined,
        assignedTrails: Array.isArray(req.body?.assignedTrails)
          ? req.body.assignedTrails.map(String).slice(0, 20)
          : undefined,
      });

      return res.json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id ?? '');
      if (!id) return res.status(400).json({ error: 'Grupo não informado.' });
      if (!id.startsWith(`${tenantId}__`)) {
        return res.status(403).json({ error: 'Grupo de outra prefeitura.' });
      }

      await deleteGroup(id);
      return res.json({ ok: true });
    }

    return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE']);
  } catch (err) {
    return handleError(res, err, 'manager/groups');
  }
}
