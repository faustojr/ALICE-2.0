/**
 * /api/admin/billing — contratos e faturas das prefeituras.
 *
 * Não há gateway de pagamento: prefeitura paga por empenho, nota fiscal e
 * transferência, respeitando a ordem cronológica de exigibilidade (Art. 141).
 * Cobrar no cartão não é opção, então o que a operação precisa é saber o que
 * foi faturado, o que venceu e o que entrou.
 *
 * GET   contratos, faturas e o consolidado da carteira
 * POST  cria contrato (?action=contract) e já gera as faturas previstas
 * PATCH muda o status de uma fatura (?action=invoice)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handleError, methodNotAllowed } from '../../lib/http.js';
import { requireSuperAdmin } from '../../lib/auth.js';
import {
  generateInvoicesForContract,
  listInvoices,
  listTenants,
  refreshOverdueInvoices,
  upsertContract,
  upsertInvoice,
} from '../../lib/repositories.js';
import { PLANS, type BillingCycle, type InvoiceStatus, type PlanId } from '../../types.js';

const CYCLES: BillingCycle[] = ['MENSAL', 'SEMESTRAL', 'ANUAL'];
const STATUSES: InvoiceStatus[] = ['PREVISTA', 'EMITIDA', 'PAGA', 'VENCIDA', 'CANCELADA'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  try {
    await requireSuperAdmin(req.headers.authorization);

    if (req.method === 'GET') {
      // Sem agendador, a virada para VENCIDA acontece quando alguém olha —
      // que é exatamente quando a informação importa.
      const marked = await refreshOverdueInvoices().catch(() => 0);

      const [tenants, invoices] = await Promise.all([listTenants(), listInvoices()]);
      const byTenant = new Map(tenants.map((t) => [t.id, t]));
      const today = new Date().toISOString().slice(0, 10);
      const year = String(new Date().getUTCFullYear());

      const overdue = invoices.filter((i) => i.status === 'VENCIDA');
      const issued = invoices.filter((i) => i.status === 'EMITIDA');
      const paidThisYear = invoices.filter(
        (i) => i.status === 'PAGA' && i.paidAt?.startsWith(year)
      );

      // Faturas previstas cujo vencimento se aproxima: a fila de emissão.
      const soon = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const toIssue = invoices.filter(
        (i) => i.status === 'PREVISTA' && i.dueDate <= soon
      );

      return res.json({
        markedOverdue: marked,
        summary: {
          receivedThisYearCents: paidThisYear.reduce((s, i) => s + i.amountCents, 0),
          openCents: issued.reduce((s, i) => s + i.amountCents, 0),
          overdueCents: overdue.reduce((s, i) => s + i.amountCents, 0),
          overdueCount: overdue.length,
          toIssueCount: toIssue.length,
        },
        invoices: invoices.slice(0, 300).map((i) => ({
          ...i,
          tenantName: byTenant.get(i.tenantId)?.name ?? 'Prefeitura removida',
          daysOverdue:
            i.status === 'VENCIDA'
              ? Math.floor(
                  (Date.parse(today) - Date.parse(i.dueDate)) / (24 * 60 * 60 * 1000)
                )
              : 0,
        })),
      });
    }

    if (req.method === 'POST' && req.query.action === 'contract') {
      const body = req.body ?? {};
      const tenantId = String(body.tenantId ?? '');
      const plan = String(body.plan ?? '') as PlanId;

      if (!tenantId) return res.status(400).json({ error: 'Prefeitura não informada.' });
      if (!(plan in PLANS)) return res.status(400).json({ error: 'Plano inválido.' });

      const cycle = CYCLES.includes(body.cycle) ? (body.cycle as BillingCycle) : 'ANUAL';
      const amountCents = Number(body.amountCents ?? PLANS[plan].priceCents);
      if (!Number.isFinite(amountCents) || amountCents < 0) {
        return res.status(400).json({ error: 'Valor inválido.' });
      }

      const startDate = String(body.startDate ?? new Date().toISOString().slice(0, 10));
      const endDate = String(
        body.endDate ??
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      );
      if (endDate <= startDate) {
        return res.status(400).json({ error: 'A vigência termina antes de começar.' });
      }

      const contract = await upsertContract({
        id: body.id ? String(body.id) : undefined,
        tenantId,
        plan,
        status: body.status === 'EM_NEGOCIACAO' ? 'EM_NEGOCIACAO' : 'ATIVO',
        cycle,
        amountCents,
        seats: Number(body.seats) || PLANS[plan].seats || 0,
        startDate,
        endDate,
        processNumber: body.processNumber ? String(body.processNumber).slice(0, 80) : undefined,
        commitmentNumber: body.commitmentNumber
          ? String(body.commitmentNumber).slice(0, 80)
          : undefined,
        procurementBasis: body.procurementBasis
          ? String(body.procurementBasis).slice(0, 160)
          : undefined,
        notes: body.notes ? String(body.notes).slice(0, 1000) : undefined,
      });

      // Gerar as faturas na assinatura evita depender de alguém lembrar de
      // faturar todo mês — o modo de falha mais comum de operação enxuta.
      const created =
        contract.status === 'ATIVO' ? await generateInvoicesForContract(contract) : 0;

      return res.status(201).json({ contract, invoicesCreated: created });
    }

    if (req.method === 'PATCH' && req.query.action === 'invoice') {
      const body = req.body ?? {};
      const id = String(req.query.id ?? body.id ?? '');
      const status = String(body.status ?? '') as InvoiceStatus;

      if (!id) return res.status(400).json({ error: 'Fatura não informada.' });
      if (!STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Status inválido.' });
      }

      const invoices = await listInvoices();
      const invoice = invoices.find((i) => i.id === id);
      if (!invoice) return res.status(404).json({ error: 'Fatura não encontrada.' });

      const now = new Date().toISOString();
      await upsertInvoice({
        ...invoice,
        status,
        issuedAt: status === 'EMITIDA' && !invoice.issuedAt ? now : invoice.issuedAt,
        paidAt: status === 'PAGA' ? (body.paidAt ? String(body.paidAt) : now) : invoice.paidAt,
        invoiceNumber: body.invoiceNumber
          ? String(body.invoiceNumber).slice(0, 60)
          : invoice.invoiceNumber,
        notes: body.notes !== undefined ? String(body.notes).slice(0, 1000) : invoice.notes,
      });

      return res.json({ ok: true });
    }

    return methodNotAllowed(res, ['GET', 'POST', 'PATCH']);
  } catch (err) {
    return handleError(res, err, 'admin/billing');
  }
}
