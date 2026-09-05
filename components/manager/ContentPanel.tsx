/**
 * Conteúdo próprio da prefeitura.
 *
 * O gestor cadastra os temas do município — um decreto local, uma instrução
 * da controladoria — e a IA monta os reels e o quiz. O rascunho fica visível
 * para ele revisar e nada chega ao servidor sem aprovação: material sobre
 * norma municipal gerado sem revisão pode induzir alguém a errar num processo,
 * e quem responde por isso é quem assina.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  FileText,
  Plus,
  Sparkles,
  Check,
  X,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  addTopic,
  approveTopic,
  fetchOwnContent,
  generateTopicContent,
  type DraftContent,
  type ManagerTopic,
} from '../../services/managerApi';

const STATUS_LABEL: Record<ManagerTopic['status'], string> = {
  PUBLICADO: 'No ar',
  AGUARDANDO_APROVACAO: 'Aguardando você',
  SEM_CONTEUDO: 'Sem conteúdo',
};

const STATUS_STYLE: Record<ManagerTopic['status'], string> = {
  PUBLICADO: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  AGUARDANDO_APROVACAO: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  SEM_CONTEUDO: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const DraftReview: React.FC<{
  topic: ManagerTopic;
  draft: DraftContent;
  onDone: () => void;
  onError: (msg: string) => void;
}> = ({ topic, draft, onDone, onError }) => {
  const [working, setWorking] = useState(false);

  const decide = async (approved: boolean) => {
    setWorking(true);
    try {
      await approveTopic(topic.id, approved);
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Falha ao registrar a decisão.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="border-t border-white/10 bg-black/20 p-5 space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Slides
        </p>
        <ol className="space-y-2">
          {draft.slideTexts.map((text, i) => (
            <li key={i} className="text-sm text-slate-300 flex gap-3">
              <span className="text-slate-600 shrink-0">{i + 1}.</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Pergunta
        </p>
        <p className="text-sm text-slate-300 mb-2">{draft.question}</p>
        <ul className="space-y-1.5">
          {draft.options.map((opt, i) => (
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

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 flex gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          Confira se a informação está correta antes de publicar. Este conteúdo
          será estudado pelos servidores como orientação oficial do município.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => decide(true)}
          disabled={working}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" />
          Aprovar e publicar
        </button>
        <button
          onClick={() => decide(false)}
          disabled={working}
          className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Descartar
        </button>
      </div>
    </div>
  );
};

const ContentPanel: React.FC = () => {
  const [topics, setTopics] = useState<ManagerTopic[]>([]);
  const [trail, setTrail] = useState<{ name: string; isPublished: boolean } | null>(null);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [newRef, setNewRef] = useState('');
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchOwnContent();
      setTopics(data.topics);
      setTrail(data.trail);
      setPending(data.pendingApproval);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar o conteúdo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTopic.trim();
    if (!title) return;

    setAdding(true);
    setError('');
    try {
      await addTopic(title, newRef.trim() || undefined);
      setNewTopic('');
      setNewRef('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao adicionar o tema.');
    } finally {
      setAdding(false);
    }
  };

  const generate = async (topic: ManagerTopic) => {
    setGenerating(topic.id);
    setError('');
    try {
      await generateTopicContent(topic.id);
      setExpanded(topic.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar o conteúdo.');
    } finally {
      setGenerating(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  const field =
    'px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm ' +
    'placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Conteúdo do município</h2>
        <p className="text-slate-500 text-sm">
          {trail
            ? `${topics.length} temas${trail.isPublished ? ' · no ar para os servidores' : ' · ainda não publicado'}`
            : 'Cadastre temas próprios da sua prefeitura.'}
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {pending > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/25 rounded-2xl p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200">
            <strong>{pending} tema(s) aguardando sua aprovação.</strong>{' '}
            <span className="text-slate-400">
              Nada é publicado antes de você revisar.
            </span>
          </p>
        </div>
      )}

      <form onSubmit={submitTopic} className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Novo tema
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            placeholder="Decreto Municipal 123/2026 — Compras diretas"
            className={`${field} flex-1`}
          />
          <input
            value={newRef}
            onChange={(e) => setNewRef(e.target.value)}
            placeholder="Base legal (opcional)"
            className={`${field} sm:w-56`}
          />
          <button
            type="submit"
            disabled={adding || !newTopic.trim()}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>
      </form>

      {topics.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-1">Nenhum tema próprio ainda.</p>
          <p className="text-slate-600 text-sm">
            Seus servidores continuam estudando as trilhas da ALICE normalmente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((topic) => (
            <div
              key={topic.id}
              className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
            >
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                          STATUS_STYLE[topic.status]
                        }`}
                      >
                        {STATUS_LABEL[topic.status]}
                      </span>
                      {topic.legalReference && (
                        <span className="text-xs text-slate-500">
                          {topic.legalReference}
                        </span>
                      )}
                    </div>
                    <h3 className="text-white font-bold">{topic.title}</h3>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {topic.status === 'SEM_CONTEUDO' && (
                      <button
                        onClick={() => generate(topic)}
                        disabled={generating === topic.id}
                        className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {generating === topic.id ? 'Gerando...' : 'Gerar conteúdo'}
                      </button>
                    )}
                    {topic.status === 'AGUARDANDO_APROVACAO' && (
                      <button
                        onClick={() =>
                          setExpanded(expanded === topic.id ? null : topic.id)
                        }
                        className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold transition-colors"
                      >
                        {expanded === topic.id ? 'Fechar' : 'Revisar'}
                      </button>
                    )}
                    {topic.status === 'PUBLICADO' && (
                      <span className="px-3 py-1.5 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Publicado
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {expanded === topic.id && topic.draft && (
                <DraftReview
                  topic={topic}
                  draft={topic.draft}
                  onDone={() => {
                    setExpanded(null);
                    load();
                  }}
                  onError={setError}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContentPanel;
