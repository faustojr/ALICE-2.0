/**
 * Landing page de aprendacomalice.com.
 *
 * Público: secretário de administração, controlador interno e responsável de
 * RH de municípios pequenos e médios. A dor que abre a conversa não é
 * "capacitação" — é responsabilização pessoal sob a Lei 14.133 e a rotatividade
 * de servidores que leva o conhecimento embora.
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  Clock,
  TrendingUp,
  FileCheck2,
  Smartphone,
  BarChart3,
  ArrowRight,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { PLANS } from '../types';

const UF_LIST = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

const Section: React.FC<{
  children: React.ReactNode;
  className?: string;
  id?: string;
}> = ({ children, className = '', id }) => (
  <section id={id} className={`px-6 py-20 sm:py-28 ${className}`}>
    <div className="max-w-6xl mx-auto">{children}</div>
  </section>
);

// ---------------------------------------------------------------------------

const LeadForm: React.FC = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    municipality: '',
    uf: 'SC',
    role: '',
    phone: '',
    population: '',
    message: '',
  });
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setState('sending');
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao enviar.');
      setState('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar.');
      setState('idle');
    }
  };

  if (state === 'sent') {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-10 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-5">
          <Check className="w-7 h-7 text-emerald-400" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-3">Solicitação recebida</h3>
        <p className="text-slate-300">
          Retornamos em até um dia útil com o acesso ao piloto do seu município.
        </p>
      </div>
    );
  }

  const field =
    'w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white ' +
    'placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow';

  return (
    <form onSubmit={submit} className="bg-white/5 border border-white/10 rounded-3xl p-8">
      <h3 className="text-2xl font-bold text-white mb-2">Solicitar piloto gratuito</h3>
      <p className="text-slate-400 mb-7">
        90 dias, até 30 servidores, sem cartão de crédito.
      </p>

      <div className="space-y-4">
        <input
          required
          className={field}
          placeholder="Seu nome"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          required
          type="email"
          className={field}
          placeholder="E-mail institucional"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <div className="grid grid-cols-3 gap-3">
          <input
            required
            className={`${field} col-span-2`}
            placeholder="Município"
            value={form.municipality}
            onChange={(e) => setForm({ ...form, municipality: e.target.value })}
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
            className={field}
            placeholder="Seu cargo"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          />
          <input
            className={field}
            placeholder="Telefone (opcional)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <textarea
          className={`${field} min-h-24 resize-y`}
          placeholder="Quantos servidores lidam com contratações hoje? (opcional)"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'sending'}
        className="w-full mt-6 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {state === 'sending' ? 'Enviando...' : 'Quero o piloto no meu município'}
        {state !== 'sending' && <ArrowRight className="w-5 h-5" />}
      </button>

      <p className="text-xs text-slate-500 mt-4 text-center">
        Usamos seus dados apenas para este contato comercial, conforme a LGPD.
      </p>
    </form>
  );
};

// ---------------------------------------------------------------------------

const LandingPage: React.FC<{ appUrl: string }> = ({ appUrl }) => {
  const problems = [
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      title: 'A responsabilização é pessoal',
      body: 'A Lei 14.133 responsabiliza o agente de contratação, não a prefeitura. Quem assina o ETP responde pelo que assinou.',
    },
    {
      icon: <Clock className="w-5 h-5" />,
      title: 'Ninguém tem 8 horas para um curso',
      body: 'O servidor que cuida de licitação também cuida de outras cinco coisas. Treinamento presencial de um dia inteiro não acontece.',
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: 'A cada eleição, o conhecimento vai embora',
      body: 'A rotatividade em municípios pequenos apaga o aprendizado acumulado. O ciclo de capacitação recomeça do zero.',
    },
  ];

  const features = [
    {
      icon: <Smartphone className="w-6 h-6" />,
      title: 'Três minutos por dia, no celular',
      body: 'Conteúdo em formato de reels: o servidor aprende na fila do café, não numa sala de treinamento. Sem instalar aplicativo.',
    },
    {
      icon: <FileCheck2 className="w-6 h-6" />,
      title: 'Conteúdo ancorado no artigo',
      body: 'Cada pílula aponta o dispositivo legal correspondente. Dispensa, inexigibilidade, ETP, ata de registro de preços, sanções.',
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'O gestor vê quem está preparado',
      body: 'Painel com quem estudou, onde cada um erra mais e quais temas a equipe ainda não domina. Dado para decidir, não para arquivar.',
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: 'Registro de capacitação continuada',
      body: 'Histórico por servidor, exportável. Serve como evidência de capacitação diante do controle interno e do Tribunal de Contas.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Cabeçalho */}
      <header className="border-b border-white/5 sticky top-0 bg-slate-950/85 backdrop-blur-lg z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-black italic bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            ALICE
          </span>
          <nav className="flex items-center gap-6">
            <a href="#planos" className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block">
              Planos
            </a>
            <a
              href={appUrl}
              className="text-sm font-semibold text-white bg-white/10 hover:bg-white/15 px-4 py-2 rounded-lg transition-colors"
            >
              Acessar o app
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <Section className="pt-16 sm:pt-24 pb-12">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/25 rounded-full px-4 py-1.5 mb-7">
            <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">
              Lei 14.133/21 · Capacitação continuada
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-white leading-[1.08] mb-6 text-balance">
            Sua equipe de contratações sabe o que assina?
          </h1>

          <p className="text-xl text-slate-400 leading-relaxed mb-9">
            A ALICE capacita servidores municipais na Nova Lei de Licitações em pílulas
            de três minutos no celular — e mostra ao gestor, em números, quem está
            preparado e onde está o risco.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#piloto"
              className="px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg transition-colors text-center flex items-center justify-center gap-2"
            >
              Solicitar piloto gratuito
              <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href="#como-funciona"
              className="px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-lg transition-colors text-center"
            >
              Como funciona
            </a>
          </div>

          <p className="text-sm text-slate-500 mt-6">
            90 dias · até 30 servidores · sem cartão de crédito
          </p>
        </div>
      </Section>

      {/* Problema */}
      <Section className="border-t border-white/5">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 text-balance">
          Por que capacitação em licitações não pega em município pequeno
        </h2>
        <p className="text-slate-400 text-lg mb-12 max-w-2xl">
          Não é falta de vontade. É que o formato disponível não cabe na rotina de quem
          faz o trabalho.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {problems.map((p) => (
            <div key={p.title} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mb-4">
                {p.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{p.title}</h3>
              <p className="text-slate-400 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Solução */}
      <Section id="como-funciona" className="border-t border-white/5">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 text-balance">
          O que a ALICE faz diferente
        </h2>
        <p className="text-slate-400 text-lg mb-12 max-w-2xl">
          Microaprendizagem no formato que o servidor já usa todo dia, com o
          acompanhamento que o gestor precisa apresentar.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl p-7"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center mb-5">
                {f.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{f.title}</h3>
              <p className="text-slate-400 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Como começa */}
      <Section className="border-t border-white/5">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-12 text-balance">
          Do primeiro contato ao primeiro servidor estudando
        </h2>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              n: '1',
              t: 'Solicitação',
              d: 'Você preenche o formulário. Cadastramos o município e liberamos o acesso em até um dia útil.',
            },
            {
              n: '2',
              t: 'Convite aos servidores',
              d: 'Sua equipe entra pelo navegador com o e-mail institucional. Nada a instalar, nada a configurar.',
            },
            {
              n: '3',
              t: 'Acompanhamento',
              d: 'Em duas semanas você já vê no painel quem estudou, quanto avançou e onde a equipe erra mais.',
            },
          ].map((s) => (
            <li key={s.n}>
              <div className="w-11 h-11 rounded-full bg-blue-600 text-white font-black text-lg flex items-center justify-center mb-4">
                {s.n}
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{s.t}</h3>
              <p className="text-slate-400 leading-relaxed">{s.d}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Planos */}
      <Section id="planos" className="border-t border-white/5">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Planos</h2>
        <p className="text-slate-400 text-lg mb-12 max-w-2xl">
          Dimensionados para o porte do município. Contratação por dispensa de licitação
          quando aplicável ao valor.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {Object.values(PLANS).map((plan) => {
            const highlighted = plan.id === 'ESSENCIAL';
            return (
              <div
                key={plan.id}
                className={`rounded-2xl p-7 border flex flex-col ${
                  highlighted
                    ? 'bg-blue-600/10 border-blue-500/40 ring-1 ring-blue-500/20'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                {highlighted && (
                  <span className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-3">
                    Mais contratado
                  </span>
                )}
                <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-3xl font-black text-white mb-1">
                  {plan.priceCents === 0
                    ? plan.id === 'PILOTO'
                      ? 'Gratuito'
                      : 'Sob consulta'
                    : (plan.priceCents / 100).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                        maximumFractionDigits: 0,
                      })}
                </p>
                <p className="text-sm text-slate-500 mb-6">
                  {plan.priceCents > 0 ? 'por mês' : plan.id === 'PILOTO' ? '90 dias' : ''}
                </p>

                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="#piloto"
                  className={`mt-7 py-3 rounded-xl font-bold text-center transition-colors ${
                    highlighted
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                  }`}
                >
                  {plan.id === 'ENTERPRISE' ? 'Falar com a equipe' : 'Começar'}
                </a>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Formulário */}
      <Section id="piloto" className="border-t border-white/5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5 text-balance">
              Comece pelo piloto, decida com dados
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed mb-8">
              Noventa dias com até 30 servidores, sem custo e sem cartão. Ao final você
              tem um relatório de participação e desempenho da sua equipe — e aí decide se
              faz sentido contratar.
            </p>
            <ul className="space-y-4">
              {[
                'Sem instalação: funciona no navegador do celular',
                'Sem integração com sistemas da prefeitura',
                'Dados tratados conforme a LGPD',
                'Cancelamento a qualquer momento',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-300">
                  <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <LeadForm />
        </div>
      </Section>

      <footer className="border-t border-white/5 px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <span className="font-black italic text-slate-400">ALICE</span>
          <p>Capacitação continuada para servidores municipais.</p>
          <a href={appUrl} className="hover:text-white transition-colors">
            appalice.cloud
          </a>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
