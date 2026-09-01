/**
 * Console de administração da ALICE.
 *
 * Diferente do Dashboard (que é o painel do gestor de UMA prefeitura), este é
 * o painel da operação: todas as prefeituras, receita, adoção e custo de IA.
 * Exige login Google e e-mail na allowlist SUPER_ADMIN_EMAILS.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  TrendingUp,
  Users,
  Sparkles,
  AlertTriangle,
  Clock,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ArrowLeft,
  X,
  FileText,
  ThumbsDown,
  Building,
} from 'lucide-react';
import {
  AdminApiError,
  createTenant,
  fetchOverview,
  fetchTenants,
  fetchVariants,
  formatBRL,
  setVariantStatus,
  updateTenant,
  type AdminOverview,
  type AdminVariant,
} from '../services/adminApi';
import { auth, googleProvider, signInWithPopup, isVerifiedSession } from '../firebase';
import { PLANS, type PlanId, type Tenant, type TenantStatus } from '../types';

const UF_LIST = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

const STATUS_STYLES: Record<TenantStatus, string> = {
  ATIVO: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  TRIAL: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  SUSPENSO: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  CANCELADO: 'bg-red-500/15 text-red-300 border-red-500/30',
};

// ---------------------------------------------------------------------------

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warn';
}> = ({ icon, label, value, hint, tone = 'default' }) => (
  <div
    className={`rounded-2xl border p-5 ${
      tone === 'warn'
        ? 'bg-amber-500/5 border-amber-500/25'
        : 'bg-white/5 border-white/10'
    }`}
  >
    <div className="flex items-center gap-2 text-slate-400 mb-3">
      {icon}
      <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
    {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
  </div>
);

// ---------------------------------------------------------------------------

const NewTenantModal: React.FC<{
  onClose: () => void;
  onCreated: () => void;
}> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({
    name: '',
    uf: 'SC',
    population: '',
    plan: 'PILOTO' as PlanId,
    contactName: '',
    contactEmail: '',
    contactRole: '',
    allowedEmailDomains: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await createTenant({
        name: form.name,
        uf: form.uf,
        population: form.population ? Number(form.population) : undefined,
        plan: form.plan,
        allowedEmailDomains: form.allowedEmailDomains
          .split(',')
          .map((d) => d.trim().replace(/^@/, ''))
          .filter(Boolean),
        contact: {
          name: form.contactName,
          email: form.contactEmail,
          role: form.contactRole || undefined,
        },
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao cadastrar.');
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
            <h2 className="text-2xl font-bold text-white">Nova prefeitura</h2>
            <p className="text-slate-400 text-sm mt-1">
              Cria o tenant e inicia 90 dias de piloto.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-white p-1"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <input
              required
              className={`${field} col-span-2`}
              placeholder="Prefeitura de Blumenau"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className={field}
              value={form.uf}
              onChange={(e) => setForm({ ...form, uf: e.target.value })}
            >
              {UF_LIST.map((uf) => (
                <option key={uf} value={uf} className="bg-slate-900">
                  {uf}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              className={field}
              placeholder="População"
              value={form.population}
              onChange={(e) => setForm({ ...form, population: e.target.value })}
            />
            <select
              className={field}
              value={form.plan}
              onChange={(e) => setForm({ ...form, plan: e.target.value as PlanId })}
            >
              {Object.values(PLANS).map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 border-t border-white/10">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Responsável pela capacitação
            </p>
            <div className="space-y-3">
              <input
                required
                className={field}
                placeholder="Nome do responsável"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              />
              <input
                required
                type="email"
                className={field}
                placeholder="email@municipio.sc.gov.br"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              />
              <input
                className={field}
                placeholder="Cargo (ex: Secretário de Administração)"
                value={form.contactRole}
                onChange={(e) => setForm({ ...form, contactRole: e.target.value })}
              />
            </div>
          </div>

          <div>
            <input
              className={field}
              placeholder="Domínios: municipio.sc.gov.br, blumenau.sc.gov.br"
              value={form.allowedEmailDomains}
              onChange={(e) => setForm({ ...form, allowedEmailDomains: e.target.value })}
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Servidores com e-mail nesses domínios são vinculados a esta prefeitura
              automaticamente.
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            {error}
          </p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors disabled:opacity-50"
          >
            {saving ? 'Cadastrando...' : 'Cadastrar prefeitura'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  PROMOTED: 'Em uso',
  CANDIDATE: 'Candidata',
  REJECTED: 'Rejeitada',
};

const VARIANT_STATUS_STYLES: Record<string, string> = {
  PROMOTED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  CANDIDATE: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  REJECTED: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

/**
 * Auditoria do conteúdo gerado por IA.
 *
 * A promoção é automática após três alunos distintos acertarem. Com três
 * alternativas por quiz, isso acontece por acaso em cerca de 3,7% dos casos,
 * e nenhum texto passou por revisão jurídica antes de virar padrão. Esta tela
 * é o contrapeso: mostra o que está em uso e permite tirar do ar.
 */
const ContentAudit: React.FC = () => {
  const [variants, setVariants] = useState<AdminVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('PROMOTED');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (status: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchVariants(status || undefined);
      setVariants(data.variants);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar variantes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  const reject = async (variant: AdminVariant) => {
    const previous = variants;
    setVariants((list) => list.filter((v) => v.id !== variant.id));
    try {
      await setVariantStatus(variant.id, 'REJECTED');
    } catch (err) {
      setVariants(previous);
      setError(err instanceof Error ? err.message : 'Falha ao rejeitar.');
    }
  };

  const promote = async (variant: AdminVariant) => {
    try {
      await setVariantStatus(variant.id, 'PROMOTED');
      load(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao promover.');
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-bold text-white">Conteúdo gerado por IA</h2>
          <p className="text-slate-500 text-sm">
            Promovido automaticamente após 3 acertos de alunos distintos.
          </p>
        </div>
        <div className="flex gap-2">
          {[
            { id: 'PROMOTED', label: 'Em uso' },
            { id: 'CANDIDATE', label: 'Candidatas' },
            { id: 'REJECTED', label: 'Rejeitadas' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                filter === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-4 text-red-300 text-sm mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : variants.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">
            {filter === 'PROMOTED'
              ? 'Nenhum conteúdo gerado por IA foi promovido ainda. Os alunos estão usando o conteúdo padrão.'
              : 'Nada aqui.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {variants.map((v) => (
            <div
              key={v.id}
              className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
            >
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                          VARIANT_STATUS_STYLES[v.status]
                        }`}
                      >
                        {STATUS_LABEL[v.status] ?? v.status}
                      </span>
                      <span className="text-xs text-slate-500">
                        Módulo {v.moduleIndex + 1} · {v.level}
                      </span>
                    </div>
                    <h3 className="text-white font-bold">{v.title}</h3>
                  </div>

                  <div className="flex items-center gap-4 text-sm shrink-0">
                    <div className="text-right">
                      <p className="text-white font-bold tabular-nums">
                        {v.stats.successRate !== null ? `${v.stats.successRate}%` : '—'}
                      </p>
                      <p className="text-xs text-slate-500">acerto</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold tabular-nums">
                        {v.stats.distinctCorrect}
                      </p>
                      <p className="text-xs text-slate-500">alunos</p>
                    </div>
                  </div>
                </div>

                <p className="text-slate-400 text-sm mb-3">{v.question}</p>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setExpanded(expanded === v.id ? null : v.id)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors"
                  >
                    {expanded === v.id ? 'Ocultar conteúdo' : 'Ver conteúdo'}
                  </button>

                  {v.status === 'PROMOTED' && (
                    <button
                      onClick={() => reject(v)}
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                      Tirar do ar
                    </button>
                  )}

                  {v.status !== 'PROMOTED' && (
                    <button
                      onClick={() => promote(v)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold transition-colors"
                    >
                      Colocar em uso
                    </button>
                  )}

                  {v.tenantId && (
                    <span className="text-xs text-slate-600 flex items-center gap-1">
                      <Building className="w-3 h-3" />
                      específico de uma prefeitura
                    </span>
                  )}
                </div>
              </div>

              {expanded === v.id && (
                <div className="border-t border-white/10 bg-black/20 p-5 space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Slides
                    </p>
                    <ol className="space-y-2">
                      {v.slideTexts.map((text, i) => (
                        <li key={i} className="text-sm text-slate-300 flex gap-3">
                          <span className="text-slate-600 shrink-0">{i + 1}.</span>
                          <span>{text}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Alternativas
                    </p>
                    <ul className="space-y-1.5">
                      {v.options.map((opt, i) => (
                        <li
                          key={i}
                          className={`text-sm flex gap-2 ${
                            opt.value === 'correct' ? 'text-emerald-300' : 'text-slate-400'
                          }`}
                        >
                          <span>{opt.value === 'correct' ? '✓' : '·'}</span>
                          <span>{opt.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Feedback do acerto
                    </p>
                    <p className="text-sm text-slate-300">{v.feedbackCorrect}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const AdminConsole: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<{ message: string; status: number } | null>(null);
  const [search, setSearch] = useState('');
  const [showNewTenant, setShowNewTenant] = useState(false);
  const [tab, setTab] = useState<'OPERACAO' | 'CONTEUDO'>('OPERACAO');

  const load = useCallback(async (refreshStats = false) => {
    setError(null);
    try {
      const [ov, tn] = await Promise.all([fetchOverview(), fetchTenants(refreshStats)]);
      setOverview(ov);
      setTenants(tn.tenants);
    } catch (err) {
      if (err instanceof AdminApiError) {
        setError({ message: err.message, status: err.status });
      } else {
        setError({
          message: err instanceof Error ? err.message : 'Falha ao carregar.',
          status: 500,
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setLoading(true);
      load();
    } catch (err) {
      setError({ message: 'Falha no login com Google.', status: 401 });
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.uf.toLowerCase().includes(q) ||
        t.contact?.email?.toLowerCase().includes(q)
    );
  }, [tenants, search]);

  const changeStatus = async (tenant: Tenant, status: TenantStatus) => {
    const previous = tenants;
    setTenants((list) =>
      list.map((t) => (t.id === tenant.id ? { ...t, status } : t))
    );
    try {
      await updateTenant(tenant.id, { status });
    } catch (err) {
      setTenants(previous); // desfaz o otimismo se o servidor recusar
      setError({
        message: err instanceof Error ? err.message : 'Falha ao atualizar status.',
        status: 500,
      });
    }
  };

  // --- Estados de acesso ---------------------------------------------------

  if (error?.status === 401 || (!isVerifiedSession() && error)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-white/5 border border-white/10 rounded-3xl p-10">
          <div className="w-16 h-16 rounded-full bg-blue-500/15 flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Console da ALICE</h1>
          <p className="text-slate-400 mb-8">
            Este painel exige login com a conta Google da equipe. O acesso por e-mail
            do piloto não vale aqui.
          </p>
          <button
            onClick={handleLogin}
            className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors"
          >
            Entrar com Google
          </button>
          <button
            onClick={onBack}
            className="mt-4 text-slate-500 hover:text-white text-sm"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (error?.status === 403) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-white/5 border border-white/10 rounded-3xl p-10">
          <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Acesso negado</h1>
          <p className="text-slate-400 mb-8">{error.message}</p>
          <button
            onClick={onBack}
            className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400">Carregando console...</p>
      </div>
    );
  }

  // --- Console -------------------------------------------------------------

  return (
    <div className="min-h-screen p-4 sm:p-8">
      {showNewTenant && (
        <NewTenantModal onClose={() => setShowNewTenant(false)} onCreated={() => load()} />
      )}

      <header className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Console ALICE</h1>
              <p className="text-slate-500 text-sm">
                Operação da plataforma · {overview?.adoption.totalTenants ?? 0} prefeituras
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Recalcular
            </button>
            <button
              onClick={() => setShowNewTenant(true)}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova prefeitura
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-8">
        {error && error.status >= 500 && (
          <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-4 text-red-300 text-sm">
            {error.message}
          </div>
        )}

        <div className="flex gap-1 border-b border-white/10">
          {[
            { id: 'OPERACAO' as const, label: 'Operação' },
            { id: 'CONTEUDO' as const, label: 'Conteúdo' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 font-semibold text-sm border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'CONTEUDO' && <ContentAudit />}

        {tab === 'OPERACAO' && (
          <>
        {/* Indicadores */}
        {overview && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="Receita recorrente"
              value={formatBRL(overview.revenue.mrrCents)}
              hint={`${overview.revenue.payingTenants} pagantes · ${formatBRL(
                overview.revenue.arrCents
              )}/ano`}
            />
            <StatCard
              icon={<Building2 className="w-4 h-4" />}
              label="Prefeituras"
              value={String(overview.adoption.totalTenants)}
              hint={Object.entries(overview.adoption.byStatus)
                .map(([k, v]) => `${v} ${k.toLowerCase()}`)
                .join(' · ')}
            />
            <StatCard
              icon={<Users className="w-4 h-4" />}
              label="Servidores ativos"
              value={String(overview.adoption.activeSeats)}
              hint={`${overview.adoption.activationRate}% de ${overview.adoption.totalSeats} cadastrados`}
            />
            <StatCard
              icon={<Sparkles className="w-4 h-4" />}
              label="Gerações de IA"
              value={String(overview.ai.generationsThisMonth)}
              hint="no mês corrente"
            />
          </section>
        )}

        {/* Fila comercial */}
        {overview &&
          (overview.pipeline.expiringTrials.length > 0 ||
            overview.pipeline.atRisk.length > 0) && (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {overview.pipeline.expiringTrials.length > 0 && (
                <div className="bg-blue-500/5 border border-blue-500/25 rounded-2xl p-5">
                  <div className="flex items-center gap-2 text-blue-300 mb-4">
                    <Clock className="w-4 h-4" />
                    <h3 className="font-bold text-sm uppercase tracking-wider">
                      Pilotos vencendo em 15 dias
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {overview.pipeline.expiringTrials.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0"
                      >
                        <span className="text-white font-medium">
                          {t.name} <span className="text-slate-500">/{t.uf}</span>
                        </span>
                        <span className="text-slate-400 tabular-nums">
                          {t.activeUsers30d} ativos ·{' '}
                          {t.trialEndsAt
                            ? new Date(t.trialEndsAt).toLocaleDateString('pt-BR')
                            : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {overview.pipeline.atRisk.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/25 rounded-2xl p-5">
                  <div className="flex items-center gap-2 text-amber-300 mb-4">
                    <AlertTriangle className="w-4 h-4" />
                    <h3 className="font-bold text-sm uppercase tracking-wider">
                      Sem atividade há 14 dias
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {overview.pipeline.atRisk.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0"
                      >
                        <span className="text-white font-medium">
                          {t.name} <span className="text-slate-500">/{t.uf}</span>
                        </span>
                        <span className="text-slate-400 tabular-nums">
                          {t.lastActivityAt
                            ? new Date(t.lastActivityAt).toLocaleDateString('pt-BR')
                            : 'nunca'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

        {/* Prefeituras */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-bold text-white">Prefeituras</h2>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, UF ou contato"
                className="pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
              <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">
                {tenants.length === 0
                  ? 'Nenhuma prefeitura cadastrada ainda.'
                  : 'Nenhuma prefeitura corresponde à busca.'}
              </p>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="text-left font-semibold px-5 py-3">Prefeitura</th>
                      <th className="text-left font-semibold px-5 py-3">Plano</th>
                      <th className="text-right font-semibold px-5 py-3">Servidores</th>
                      <th className="text-right font-semibold px-5 py-3">Ativos 30d</th>
                      <th className="text-right font-semibold px-5 py-3">Quizzes</th>
                      <th className="text-left font-semibold px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                      >
                        <td className="px-5 py-4">
                          <p className="text-white font-medium">{t.name}</p>
                          <p className="text-slate-500 text-xs">
                            {t.uf}
                            {t.contact?.email ? ` · ${t.contact.email}` : ''}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-slate-300">
                          {PLANS[t.plan]?.name ?? t.plan}
                          <span className="block text-xs text-slate-500">
                            {PLANS[t.plan]?.priceCents
                              ? `${formatBRL(PLANS[t.plan].priceCents)}/mês`
                              : 'sem cobrança'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right text-slate-300 tabular-nums">
                          {t.stats?.totalUsers ?? 0}
                          <span className="text-slate-600">
                            {PLANS[t.plan]?.seats ? ` / ${PLANS[t.plan].seats}` : ''}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right text-slate-300 tabular-nums">
                          {t.stats?.activeUsers30d ?? 0}
                        </td>
                        <td className="px-5 py-4 text-right text-slate-300 tabular-nums">
                          {t.stats?.totalQuizzes ?? 0}
                        </td>
                        <td className="px-5 py-4">
                          <select
                            value={t.status}
                            onChange={(e) =>
                              changeStatus(t, e.target.value as TenantStatus)
                            }
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg border cursor-pointer focus:outline-none ${
                              STATUS_STYLES[t.status]
                            }`}
                          >
                            {(['ATIVO', 'TRIAL', 'SUSPENSO', 'CANCELADO'] as const).map(
                              (s) => (
                                <option key={s} value={s} className="bg-slate-900 text-white">
                                  {s}
                                </option>
                              )
                            )}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

          </>
        )}

        {overview && tab === 'OPERACAO' && (
          <p className="text-xs text-slate-600 text-center pb-8">
            Atualizado em {new Date(overview.generatedAt).toLocaleString('pt-BR')}
          </p>
        )}
      </main>
    </div>
  );
};

export default AdminConsole;
