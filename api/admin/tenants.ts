/**
 * /api/admin/tenants — CRUD de prefeituras. Exclusivo da equipe ALICE.
 *
 * GET    lista todas as prefeituras com estatísticas
 * POST   cria uma prefeitura
 * PATCH  atualiza uma prefeitura (?id=...)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handleError, methodNotAllowed } from '../../lib/http.js';
import { requireSuperAdmin } from '../../lib/auth.js';
import {
  createTenant,
  listTenants,
  refreshTenantStats,
  updateTenant,
  upsertMembership,
} from '../../lib/repositories.js';
import { PLANS, type AuthMode, type PlanId, type TenantStatus } from '../../types.js';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  try {
    await requireSuperAdmin(req.headers.authorization);

    if (req.method === 'GET') {
      const tenants = await listTenants();

      // Recalcula estatísticas sob demanda quando o console pede refresh.
      if (req.query.refresh === 'true') {
        await Promise.all(
          tenants.map((t) =>
            refreshTenantStats(t.id).catch((err) =>
              console.error(`[stats] falha no tenant ${t.id}`, err)
            )
          )
        );
        return res.json({ tenants: await listTenants() });
      }

      return res.json({ tenants });
    }

    if (req.method === 'POST') {
      const body = req.body ?? {};
      const { name, uf, plan, contact } = body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Nome da prefeitura é obrigatório.' });
      }
      if (!uf || typeof uf !== 'string' || uf.length !== 2) {
        return res.status(400).json({ error: 'UF inválida (use a sigla, ex: SC).' });
      }
      if (plan && !(plan in PLANS)) {
        return res.status(400).json({ error: 'Plano inválido.' });
      }
      if (!contact?.email || !contact?.name) {
        return res.status(400).json({ error: 'Contato responsável é obrigatório.' });
      }

      const now = new Date();
      const trialEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      const tenant = await createTenant({
        slug: body.slug ? slugify(body.slug) : slugify(name),
        name: name.trim(),
        uf: uf.toUpperCase(),
        ibgeCode: body.ibgeCode,
        population: body.population ? Number(body.population) : undefined,
        plan: (plan as PlanId) || 'PILOTO',
        status: (body.status as TenantStatus) || 'TRIAL',
        authMode: (body.authMode as AuthMode) || 'OPEN_PILOT',
        allowedEmailDomains: Array.isArray(body.allowedEmailDomains)
          ? body.allowedEmailDomains.map((d: string) => d.toLowerCase().replace(/^@/, ''))
          : [],
        enabledTrails: Array.isArray(body.enabledTrails)
          ? body.enabledTrails
          : ['lei-14133'],
        contact: {
          name: contact.name,
          email: contact.email.toLowerCase(),
          phone: contact.phone,
          role: contact.role,
        },
        branding: body.branding,
        trialEndsAt: trialEnd.toISOString(),
      });

      // O responsável vira TENANT_ADMIN junto com o cadastro. Sem esse
      // vínculo o painel do gestor recusa o acesso dele, e a prefeitura
      // recém-cadastrada ficaria sem quem acompanhe o piloto.
      let managerLinked = false;
      try {
        await upsertMembership(tenant.id, contact.email, 'TENANT_ADMIN', {
          role: 'TENANT_ADMIN',
          status: 'ATIVO',
          invitedAt: now.toISOString(),
        });
        managerLinked = true;
      } catch (err) {
        console.error('[tenants] falha ao vincular o gestor', err);
      }

      return res.status(201).json({ tenant, managerLinked });
    }

    if (req.method === 'PATCH') {
      const id = String(req.query.id || req.body?.id || '');
      if (!id) return res.status(400).json({ error: 'Id da prefeitura não informado.' });

      const body = req.body ?? {};
      if (body.plan && !(body.plan in PLANS)) {
        return res.status(400).json({ error: 'Plano inválido.' });
      }

      await updateTenant(id, body);
      return res.json({ ok: true });
    }

    return methodNotAllowed(res, ['GET', 'POST', 'PATCH']);
  } catch (err) {
    return handleError(res, err, 'admin/tenants');
  }
}
