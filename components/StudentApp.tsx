import React, { useState, useEffect, lazy, Suspense } from 'react';
import type { UserRole } from '../types';
import RoleSelector from './RoleSelector';
import MicrolearningFeed from './MicrolearningFeed';
import PrePilotSurvey from './PrePilotSurvey';
import { Trophy, ClipboardList, CheckCircle } from 'lucide-react';
import { auth, onAuthStateChanged } from '../firebase';
import { fetchSurveyStatus } from '../services/studentApi';
import { useAccessibility } from '../App';

// O painel do gestor só é baixado por quem realmente abre o painel.
const Dashboard = lazy(() => import('./Dashboard'));

/**
 * Aplicativo do servidor municipal (aluno) e do gestor da prefeitura.
 *
 * Vive fora do App.tsx para que a landing page e o console administrativo
 * não carreguem o SDK do Firebase nem o feed de microaprendizagem.
 */
/**
 * Estado das pesquisas a partir do cache local, para quando a API não
 * responde. Sem isto o aluno offline veria o passo 1 desbloqueado de novo e
 * responderia a pesquisa duas vezes.
 */
function readCachedSurveyStatus(emailKey: string): {
  preCompleted: boolean;
  postCompleted: boolean;
} {
  try {
    const cachedSurvey = localStorage.getItem(`pilotSurveys_${emailKey}`);
    if (cachedSurvey) {
      const data = JSON.parse(cachedSurvey);
      return {
        preCompleted:
          data.pre_generalKnowledge !== undefined ||
          data.pre_tempoAtuacao !== undefined ||
          data.pre_experienceTime !== undefined ||
          data.timestampPre !== undefined,
        postCompleted:
          data.pos_daysUsed !== undefined ||
          data.pos_generalKnowledge !== undefined ||
          data.timestamp !== undefined,
      };
    }

    const activeProgress = localStorage.getItem(`alice_progress_v3_${emailKey}`);
    if (activeProgress) {
      const parsed = JSON.parse(activeProgress);
      const started =
        parsed.status === 'ativo' ||
        parsed.pilotStatus === 'ativo' ||
        parsed.pilotStatus === 'completed';
      return {
        preCompleted: started,
        postCompleted: parsed.pilotStatus === 'completed',
      };
    }
  } catch {
    // Cache ilegível equivale a cache ausente.
  }

  return { preCompleted: false, postCompleted: false };
}

const StudentApp: React.FC = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [view, setView] = useState<'MAIN' | 'REELS' | 'CHAT' | 'LEVEL_SELECT' | 'PRE_SURVEY'>('MAIN');
  const [selectedLevel, setSelectedLevel] = useState<'Básico' | 'Intermediário' | 'Especialista'>('Básico');
  const [resume, setResume] = useState(false);
  const [startSurvey, setStartSurvey] = useState(false);
  
  const { highContrast } = useAccessibility();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [hasPreSurveyCompleted, setHasPreSurveyCompleted] = useState<boolean | null>(null);
  const [hasPostSurveyCompleted, setHasPostSurveyCompleted] = useState<boolean | null>(null);
  const [hasTestedReels, setHasTestedReels] = useState<boolean>(false);

  const checkSurveysStatus = async (user: any) => {
    if (!user || !user.email) return;
    try {
      const emailKey = user.email.toLowerCase();

      // A API é a fonte de verdade; o localStorage cobre o caso offline.
      const status = await fetchSurveyStatus(emailKey);

      if (status) {
        setHasPreSurveyCompleted(status.preCompleted);
        setHasPostSurveyCompleted(status.postCompleted);
      } else {
        const cached = readCachedSurveyStatus(emailKey);
        setHasPreSurveyCompleted(cached.preCompleted);
        setHasPostSurveyCompleted(cached.postCompleted);
      }

      // Verificar se testou os reels e respondeu um quiz
      let tested = false;
      const activeProgress = localStorage.getItem(`alice_progress_v3_${emailKey}`);
      if (activeProgress) {
        try {
          const parsed = JSON.parse(activeProgress);
          if (parsed.hasTestedReels || parsed.quizCount > 0 || parsed.points > 1250 || (parsed.completedQuizzes && parsed.completedQuizzes.length > 0)) {
            tested = true;
          }
        } catch (jsonErr) {}
      }
      setHasTestedReels(tested);
    } catch (err) {
      console.error("Erro geral ao verificar questionários no App:", err);
      // Fallback seguro de permissão / sandbox: deixa ativo para o usuário poder responder
      setHasPreSurveyCompleted(false);
      setHasPostSurveyCompleted(false);
      setHasTestedReels(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user || null);
      if (user) {
        await checkSurveysStatus(user);
      } else {
        setHasPreSurveyCompleted(null);
        setHasPostSurveyCompleted(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (view === 'MAIN' && currentUser) {
      checkSurveysStatus(currentUser);
    }
  }, [view, currentUser]);

  const handleRoleSelect = (
    selectedRole: UserRole, 
    shouldResume: boolean = false, 
    savedLevel?: 'Básico' | 'Intermediário' | 'Especialista'
  ) => {
    setRole(selectedRole);
    setResume(shouldResume);
    if (selectedRole === 'ALUNO') {
      setView('MAIN');
      if (shouldResume && savedLevel) {
        setSelectedLevel(savedLevel);
      }
    }
  };

  const handleLevelSelect = (level: 'Básico' | 'Intermediário' | 'Especialista') => {
    setSelectedLevel(level);
    setView('REELS');
  };

  const handleBack = async () => {
    setStartSurvey(false);
    if (view === 'LEVEL_SELECT') {
      setRole(null);
      setView('MAIN');
    } else if (view !== 'MAIN') {
      setView('MAIN');
    } else {
      try {
        await auth.signOut();
      } catch (err) {
        console.error("Erro ao sair da conta no App:", err);
      }
      setRole(null);
      setResume(false);
    }
  };

  const renderContent = () => {
    if (!role) {
      return <RoleSelector onSelectRole={handleRoleSelect} />;
    }

    if (role === 'GESTOR') {
      return <Dashboard onBack={handleBack} />;
    }

    if (role === 'ALUNO' && (hasPreSurveyCompleted === null || hasPostSurveyCompleted === null)) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
          <div className="relative w-16 h-16 mb-4">
            <div className={`absolute inset-0 border-4 rounded-full border-t-transparent animate-spin ${highContrast ? 'border-yellow-400' : 'border-blue-500'}`}></div>
          </div>
          <p className="text-slate-400 font-bold">Verificando status do piloto...</p>
        </div>
      );
    }

    if (view === 'PRE_SURVEY') {
      return (
        <PrePilotSurvey 
          onComplete={() => {
            setHasPreSurveyCompleted(true);
            setView('LEVEL_SELECT');
          }}
          onBack={() => {
            setView('MAIN');
          }}
        />
      );
    }

    if (view === 'LEVEL_SELECT') {
      return (
        <div className="flex flex-col gap-6 items-center justify-center h-full max-w-md mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-8">Escolha seu Nível</h2>
          <div className="grid grid-cols-1 gap-4 w-full">
            {(['Básico', 'Intermediário', 'Especialista'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => handleLevelSelect(lvl)}
                className="p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all text-left group"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-white">{lvl}</h3>
                    <p className="text-gray-400 text-sm">
                      {lvl === 'Básico' && 'Conceitos fundamentais e definições.'}
                      {lvl === 'Intermediário' && 'Aplicação prática e prazos.'}
                      {lvl === 'Especialista' && 'Jurisprudência e casos complexos.'}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                    →
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button onClick={handleBack} className="mt-8 text-gray-500 hover:text-white">Voltar</button>
        </div>
      );
    }

    // Lógica para o ALUNO
    if (view === 'REELS') {
      return (
        <MicrolearningFeed 
          onBack={handleBack} 
          initialLevel={selectedLevel} 
          startWithPostSurvey={startSurvey} 
        />
      );
    }

    return (
      <div className="flex flex-col gap-6 items-center justify-center h-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent italic">ALICE</h1>
          <p className="text-gray-400">Escolha como você quer aprender hoje</p>
        </div>

        <button 
          onClick={() => {
            if (!hasPreSurveyCompleted) {
              setView('PRE_SURVEY');
            }
          }}
          disabled={!!hasPreSurveyCompleted}
          className={`w-full group relative overflow-hidden p-8 rounded-3xl shadow-xl transition-all ${
            hasPreSurveyCompleted
              ? highContrast
                ? 'bg-black border border-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                : 'bg-slate-900/40 border border-white/5 text-slate-500 cursor-not-allowed opacity-50 saturate-50'
              : highContrast
                ? 'bg-black border-yellow-400 text-yellow-300 hover:bg-yellow-400 hover:text-black cursor-pointer active:scale-95 hover:scale-[1.02]'
                : 'bg-gradient-to-br from-blue-600 to-emerald-600 border border-blue-500/30 text-white cursor-pointer active:scale-95 hover:scale-[1.02]'
          }`}
          id="btn-pre-survey"
        >
          <div className="relative z-10 flex flex-col items-start text-left">
            <span className={`text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 ${
              hasPreSurveyCompleted 
                ? 'text-slate-500' 
                : 'text-white/60'
            }`}>
              {hasPreSurveyCompleted ? 'Concluído' : 'Passo 1: Diagnóstico'}
              {hasPreSurveyCompleted ? (
                <CheckCircle className={`w-3.5 h-3.5 ${highContrast ? 'text-slate-500' : 'text-emerald-500'}`} />
              ) : (
                <ClipboardList className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
              )}
            </span>
            <h2 className={`text-2xl font-bold mb-1 ${hasPreSurveyCompleted ? 'text-slate-500' : 'text-white'}`}>
              Pesquisa Pré-Uso
            </h2>
            <p className={`${hasPreSurveyCompleted ? 'text-slate-600' : 'text-white/70'} text-sm`}>
              {hasPreSurveyCompleted 
                ? 'Obrigado! Seu diagnóstico inicial de pré-piloto já foi respondido.' 
                : 'Responda antes de iniciar seus estudos para registrar seus resultados.'}
            </p>
          </div>
          <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-15 group-hover:opacity-30 transition-opacity">
            {hasPreSurveyCompleted ? (
              <CheckCircle className="w-20 h-20 text-slate-600" />
            ) : (
              <ClipboardList className="w-20 h-20 text-white" />
            )}
          </div>
        </button>

        <button 
          onClick={() => {
            if (hasPreSurveyCompleted) {
              setView('LEVEL_SELECT');
            }
          }}
          disabled={!hasPreSurveyCompleted}
          className={`w-full group relative overflow-hidden p-8 rounded-3xl shadow-xl transition-all ${
            !hasPreSurveyCompleted
              ? highContrast
                ? 'bg-black border border-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                : 'bg-slate-900/40 border border-white/5 text-slate-500 cursor-not-allowed opacity-50 saturate-50'
              : highContrast
                ? 'bg-black border-yellow-400 text-yellow-300 hover:bg-yellow-400 hover:text-black cursor-pointer active:scale-95 hover:scale-[1.02]'
                : 'bg-gradient-to-br from-purple-600 to-blue-700 border border-purple-500/30 text-white cursor-pointer active:scale-95 hover:scale-[1.02]'
          }`}
          id="btn-reels-knowledge"
        >
          <div className="relative z-10 flex flex-col items-start text-left">
            <span className={`text-xs font-bold uppercase tracking-widest mb-2 ${!hasPreSurveyCompleted ? 'text-slate-500' : 'text-white/60'}`}>
              {!hasPreSurveyCompleted ? 'Bloqueado' : 'Passo 2: Estudo'}
            </span>
            <h2 className={`text-2xl font-bold mb-1 ${!hasPreSurveyCompleted ? 'text-slate-500' : 'text-white'}`}>Reels de Conhecimento</h2>
            <p className={`${!hasPreSurveyCompleted ? 'text-slate-600' : 'text-white/70'} text-sm`}>
              {!hasPreSurveyCompleted 
                ? 'Bloqueado: Faça primeiro a pesquisa pré-uso (Passo 1).' 
                : 'Aprenda com pílulas rápidas e dinâmicas'}
            </p>
          </div>
          <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-20 group-hover:opacity-40 transition-opacity">
            <svg className={`w-24 h-24 ${!hasPreSurveyCompleted ? 'text-slate-600' : 'text-white'}`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 15l5.19-3L10 9v6zM21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9-2 2-2h14c0 1.1.9-2 2-2zM5 19V5h14v14H5z"/>
            </svg>
          </div>
        </button>

        <button 
          onClick={() => {
            if (hasPreSurveyCompleted && hasTestedReels && !hasPostSurveyCompleted) {
              setStartSurvey(true);
              setView('REELS');
            }
          }}
          disabled={!hasPreSurveyCompleted || !hasTestedReels || !!hasPostSurveyCompleted}
          className={`w-full group relative overflow-hidden p-8 rounded-3xl shadow-xl transition-all ${
            hasPostSurveyCompleted
              ? highContrast
                ? 'bg-black border border-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                : 'bg-slate-900/40 border border-white/5 text-slate-500 cursor-not-allowed opacity-50 saturate-50'
              : (!hasPreSurveyCompleted || !hasTestedReels)
                ? highContrast
                  ? 'bg-black border border-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                  : 'bg-slate-900/40 border border-white/5 text-slate-500 cursor-not-allowed opacity-50 saturate-50'
                : highContrast
                  ? 'bg-black border-yellow-400 text-yellow-300 hover:bg-yellow-400 hover:text-black cursor-pointer active:scale-95 hover:scale-[1.02]'
                  : 'bg-gradient-to-br from-emerald-600 to-teal-700 border border-emerald-500/30 text-white cursor-pointer active:scale-95 hover:scale-[1.02]'
          }`}
          id="btn-direct-survey"
        >
          <div className="relative z-10 flex flex-col items-start text-left">
            <span className={`text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 ${
              hasPostSurveyCompleted 
                ? 'text-slate-500' 
                : 'text-white/60'
            }`}>
              {hasPostSurveyCompleted ? 'Concluído' : 'Passo 3: Avaliação do Piloto'}
              {hasPostSurveyCompleted ? (
                <CheckCircle className={`w-3.5 h-3.5 ${highContrast ? 'text-slate-500' : 'text-emerald-500'}`} />
              ) : (
                <Trophy className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
              )}
            </span>
            <h2 className={`text-2xl font-bold mb-1 ${hasPostSurveyCompleted ? 'text-slate-500' : 'text-white'}`}>
              Encerrar e Responder Pesquisa
            </h2>
            <p className={`${hasPostSurveyCompleted ? 'text-slate-600' : 'text-white/70'} text-sm`}>
              {hasPostSurveyCompleted 
                ? 'Obrigado! Seu questionário final de pós-uso já foi enviado com sucesso.' 
                : !hasPreSurveyCompleted
                  ? 'Bloqueado: Faça primeiro a pesquisa pré-uso (Passo 1).'
                  : !hasTestedReels
                    ? 'Bloqueado: Assista aos Reels e responda pelo menos 1 quiz para liberar a avaliação.'
                    : 'Responda o questionário final de pós-uso ao encerrar o piloto.'}
            </p>
          </div>
          <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-15 group-hover:opacity-30 transition-opacity">
            {hasPostSurveyCompleted ? (
              <CheckCircle className="w-20 h-20 text-slate-600" />
            ) : (
              <Trophy className="w-20 h-20 text-white" />
            )}
          </div>
        </button>

        <button 
          onClick={handleBack}
          className="mt-8 text-gray-500 hover:text-white transition-colors"
        >
          Sair da conta
        </button>
      </div>
    );
  };

  // Classes dinâmicas baseadas no estado de acessibilidade
  const getAppClasses = () => {
    let classes = "min-h-screen w-full flex items-center justify-center font-sans p-2 sm:p-4 transition-all duration-300 ";
    if (highContrast) {
      classes += "bg-black text-yellow-300";
    } else {
      classes += "bg-slate-950 text-gray-200";
    }
    return classes;
  };

  return (
    <div className={getAppClasses()}>
      <div className="w-full max-w-4xl h-full">
        <Suspense fallback={<AppFallback />}>{renderContent()}</Suspense>
      </div>
    </div>
  );
};

const AppFallback: React.FC = () => (
  <div className="min-h-screen w-full flex items-center justify-center">
    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

export default StudentApp;
