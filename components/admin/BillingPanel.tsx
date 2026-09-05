/**
 * Contratos e faturas das prefeituras.
 *
 * Não há débito automático: prefeitura paga por empenho, nota fiscal e
 * transferência. O que a operação precisa saber é o que foi faturado, o que
 * venceu e o que entrou — e, principalmente, o que precisa ser emitido antes
 * de virar atraso.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Receipt, AlertTriangle, Plus, X, CircleDollarSign, Send } from 'lucide-react';
import {
  createContract,
  fetchBilling,
  formatBRL,
  setInvoiceStatus,
  type AdminInvoice,
  type BillingOverview,
} from '../../services/adminApi';
import { PLANS, type PlanId, type Tenant } from '../../types';

const STATUS_STYLE: Record<AdminInvoice['status'], string> = {
  PREVISTA: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  EMITIDA: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  PAGA: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  VENCIDA: 'bg-red-500/15 text-red-300 border-red-500/30',
  CANCELADA: 'bg-slate-700/30 text-slate-500 border-slate-700',
};

const NewContractModal: React.FC<{
  tenants: Tenant[];
  onClose: () => void;
  onCreated: (invoices: number) => void;
}> = ({ tenants, onClose, onCreated }) => {
  const today = new Date().toISOString().slice(0, 10);
  const inOneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [form, setForm] = useState({
    tenantId: tenants[0]?.id ?? '',
    plan: 'ESSENCIAL' as PlanId,
    cycle: 'ANUAL',
    amount: String(PLANS.ESSENCIAL.priceCents / 100),
    startDate: today,
    endDate: inOneYear,
    processNumber: '',
    procurementBasis: 'Dispensa de licitação',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await createContract({
        tenantId: form.tenantId,
        plan: form.plan,
        cycle: form.cycle,
        amountCents: Math.round(Number(form.amount) * 100),
        startDate: form.startDate,
        endDate: form.endDate,
        processNumber: form.processNumber || undefined,
        procurementBasis: form.procurementBasis || undefined,
      });
      onCreated(result.invoicesCreated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar o contrato.');
    } finally {
      setSaving(false);
    }
  };

  const field =
    'w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white ' +
    'placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <form
        onSubmit={submit}
        className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-lg my-8"
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Novo contrato</h2>
            <p className="text-slate-400 text-sm mt-1">
              As faturas do período são geradas automaticamente.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <select
            required
            className={field}
            value={form.tenantId}
            onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id} className="bg-slate-900">
                {t.name} / {t.uf}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <select
              className={field}
              value={form.plan}
              onChange={(e) => {
                const plan = e.target.value as PlanId;
                setForm({ ...form, plan, amount: String(PLANS[plan].priceCents / 100) });
              }}
            >
              {Object.values(PLANS).map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900">
                  {p.name}
                </option>
              ))}
            </select>
            <select
              className={field}
              value={form.cycle}
              onChange={(e) => setForm({ ...form, cycle: e.target.value })}
            >
              {['MENSAL', 'SEMESTRAL', 'ANUAL'].map((c) => (
                <option key={c} value={c} className="bg-slate-900">
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">
              Valor por cobrança (R$)
            </label>
            <input
              required
              type="number"
              step="0.01"
              className={field}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Início</label>
              <input
                required
                type="date"
                className={field}
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Fim da vigência</label>
              <input
                required
                type="date"
                className={field}
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 space-y-3">
            <input
              className={field}
              placeholder="Processo administrativo (ex: 1234/2026)"
              value={form.processNumber}
              onChange={(e) => setForm({ ...form, processNumber: e.target.value })}
            />
            <input
              className={field}
              placeholder="Enquadramento da contratação"
              value={form.procurementBasis}
              onChange={(e) => setForm({ ...form, procurementBasis: e.target.value })}
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || !form.tenantId}
          className="w-full mt-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors disabled:opacity-50"
        >
          {saving ? 'Registrando...' : 'Registrar contrato'}
        </button>
      </form>
    </div>
  );
};

const BillingPanel: React.FC<{ tenants: Tenant[] }> = ({ tenants }) => {
  const [data, setData] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('ABERTAS');
  const [showNew, setShowNew] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await fetchBilling());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar a cobrança.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (invoice: AdminInvoice, status: AdminInvoice['status']) => {
    const previous = data;
    setData((d) =>
      d
        ? {
            ...d,
            invoices: d.invoices.map((i) => (i.id === invoice.id ? { ...i, status } : i)),
          }
        : d
    );
    try {
      await setInvoiceStatus(invoice.id, status);
      // Recarrega para os totais refletirem a mudança.
      load();
    } catch (err) {
      setData(previous);
      setError(err instanceof Error ? err.message : 'Falha ao atualizar a fatura.');
    }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === 'ABERTAS') {
      return data.invoices.filter(
        (i) => i.status === 'EMITIDA' || i.status === 'VENCIDA' || i.status === 'PREVISTA'
      );
    }
    if (filter === 'TODAS') return data.invoices;
    return data.invoices.filter((i) => i.status === filter);
  }, [data, filter]);

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {showNew && (
        <NewContractModal
          tenants={tenants}
          onClose={() => setShowNew(false)}
          onCreated={(n) => {
            setNotice(`Contrato registrado. ${n} fatura(s) prevista(s) geradas.`);
            load();
          }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Cobrança</h2>
          <p className="text-slate-500 text-sm">
            Faturamento por nota fiscal — prefeitura paga por empenho, não por cartão.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          disabled={tenants.length === 0}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Novo contrato
        </button>
      </div>

      {notice && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 text-emerald-300 text-sm">
          {notice}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
              <div className="flex items-center gap-2 text-emerald-400 mb-3">
                <CircleDollarSign className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Recebido no ano
                </span>
              </div>
              <p className="text-3xl font-bold text-white tabular-nums">
                {formatBRL(data.summary.receivedThisYearCents)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-2 text-slate-400 mb-3">
                <Receipt className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Em aberto
                </span>
              </div>
              <p className="text-3xl font-bold text-white tabular-nums">
                {formatBRL(data.summary.openCents)}
              </p>
            </div>

            <div
              className={`rounded-2xl border p-5 ${
                data.summary.overdueCount > 0
                  ? 'border-red-500/30 bg-red-500/5'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <div
                className={`flex items-center gap-2 mb-3 ${
                  data.summary.overdueCount > 0 ? 'text-red-400' : 'text-slate-400'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Vencido
                </span>
              </div>
              <p className="text-3xl font-bold text-white tabular-nums">
                {formatBRL(data.summary.overdueCents)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {data.summary.overdueCount} fatura(s)
              </p>
            </div>

            <div
              className={`rounded-2xl border p-5 ${
                data.summary.toIssueCount > 0
                  ? 'border-amber-500/25 bg-amber-500/5'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <div
                className={`flex items-center gap-2 mb-3 ${
                  data.summary.toIssueCount > 0 ? 'text-amber-400' : 'text-slate-400'
                }`}
              >
                <Send className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  A emitir
                </span>
              </div>
              <p className="text-3xl font-bold text-white tabular-nums">
                {data.summary.toIssueCount}
              </p>
              <p className="text-xs text-slate-500 mt-1">vencem em 15 dias</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {['ABERTAS', 'VENCIDA', 'PAGA', 'TODAS'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
              <Receipt className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">
                {data.invoices.length === 0
                  ? 'Nenhum contrato registrado ainda.'
                  : 'Nenhuma fatura neste filtro.'}
              </p>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="text-left font-semibold px-5 py-3">Prefeitura</th>
                      <th className="text-left font-semibold px-5 py-3">Competência</th>
                      <th className="text-right font-semibold px-5 py-3">Valor</th>
                      <th className="text-left font-semibold px-5 py-3">Vencimento</th>
                      <th className="text-left font-semibold px-5 py-3">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                      >
                        <td className="px-5 py-4 text-white font-medium">
                          {invoice.tenantName}
                        </td>
                        <td className="px-5 py-4 text-slate-400 tabular-nums">
                          {invoice.reference}
                        </td>
                        <td className="px-5 py-4 text-right text-slate-300 tabular-nums">
                          {formatBRL(invoice.amountCents)}
                        </td>
                        <td className="px-5 py-4 text-slate-400 tabular-nums">
                          {new Date(`${invoice.dueDate}T12:00:00`).toLocaleDateString('pt-BR')}
                          {invoice.daysOverdue > 0 && (
                            <span className="text-red-400 text-xs ml-2">
                              {invoice.daysOverdue}d
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <select
                            value={invoice.status}
                            onChange={(e) =>
                              changeStatus(invoice, e.target.value as AdminInvoice['status'])
                            }
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg border cursor-pointer focus:outline-none ${
                              STATUS_STYLE[invoice.status]
                            }`}
                          >
                            {(
                              ['PREVISTA', 'EMITIDA', 'PAGA', 'VENCIDA', 'CANCELADA'] as const
                            ).map((s) => (
                              <option key={s} value={s} className="bg-slate-900 text-white">
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default BillingPanel;
