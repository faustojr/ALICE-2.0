
import React, { useState, createContext, useContext, useEffect } from 'react';
import type { UserRole, AccessibilityState, FontSize } from './types';
import RoleSelector from './components/RoleSelector';
import Dashboard from './components/Dashboard';
import MicrolearningFeed from './components/MicrolearningFeed';
import PrePilotSurvey from './components/PrePilotSurvey';
import { Trophy, Sparkles } from 'lucide-react';
import { GoogleWorkspaceWorkspace } from './components/GoogleWorkspaceWorkspace';
import { auth, db, onAuthStateChanged } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

// Contexto de Acessibilidade
export const AccessibilityContext = createContext<AccessibilityState>({
  highContrast: false,
  fontSize: 'normal',
  screenReaderMode: false,
  toggleHighContrast: () => {},
  setFontSize: () => {},
  toggleScreenReaderMode: () => {},
});

export const useAccessibility = () => useContext(AccessibilityContext);

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [view, setView] = useState<'MAIN' | 'REELS' | 'CHAT' | 'LEVEL_SELECT' | 'PRE_SURVEY' | 'GOOGLE_WORKSPACE'>('MAIN');
  const [selectedLevel, setSelectedLevel] = useState<'Básico' | 'Intermediário' | 'Especialista'>('Básico');
  const [resume, setResume] = useState(false);
  const [startSurvey, setStartSurvey] = useState(false);
  
  // Estado de Acessibilidade
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>('normal');
  const [screenReaderMode, setScreenReaderMode] = useState(false);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [hasPreSurveyCompleted, setHasPreSurveyCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user || null);
      if (user) {
        try {
          const emailKey = user.email!.toLowerCase();
          let surveyExists = false;
          let data: any = null;

          try {
            const surveyDocRef = doc(db, 'pilotSurveys', emailKey);
            const surveyDocSnapshot = await getDoc(surveyDocRef);
            if (surveyDocSnapshot.exists()) {
              surveyExists = true;
              data = surveyDocSnapshot.data();
            }
          } catch (dbErr: any) {
            const isOffline = dbErr instanceof Error && dbErr.message.toLowerCase().includes('offline');
            if (isOffline) {
              console.log("Firestore está offline ao verificar questionário pré-piloto. Verificando no localStorage.");
              const cachedSurvey = localStorage.getItem(`pilotSurveys_${emailKey}`);
              if (cachedSurvey) {
                try {
                  data = JSON.parse(cachedSurvey);
                  surveyExists = true;
                } catch (jsonErr) {}
              } else {
                // Se não há cache, mas estamos offline no piloto, podemos verificar se salvamos status ativo de outras formas
                const activeProgress = localStorage.getItem(`alice_progress_v3_${emailKey}`) || localStorage.getItem('alice_progress_v3');
                if (activeProgress) {
                  try {
                    const parsed = JSON.parse(activeProgress);
                    if (parsed.status === 'ativo' || parsed.pilotStatus === 'ativo' || parsed.pilotStatus === 'completed') {
                      surveyExists = true;
                      data = { pre_generalKnowledge: 5 }; // Mock data para o check passar offline
                    }
                  } catch (jsonErr) {}
                }
              }
            } else {
              throw dbErr;
            }
          }
          
          if (surveyExists) {
            if (data && (
              data.pre_generalKnowledge !== undefined || 
              data.pre_tempoAtuacao !== undefined || 
              data.pre_experienceTime !== undefined ||
              data.email !== undefined
            )) {
              setHasPreSurveyCompleted(true);
            } else {
              setHasPreSurveyCompleted(false);
            }
          } else {
            setHasPreSurveyCompleted(false);
          }
        } catch (err) {
          const isOffline = err instanceof Error && err.message.toLowerCase().includes('offline');
          if (isOffline) {
            console.log("Firestore offline durante a validação do pré-piloto. Ativando fallback.");
            setHasPreSurveyCompleted(true);
          } else {
            console.error("Erro ao verificar questionário pré-piloto no App:", err);
            setHasPreSurveyCompleted(true); // Fallback seguro
          }
        }
      } else {
        setHasPreSurveyCompleted(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleRoleSelect = (
    selectedRole: UserRole, 
    shouldResume: boolean = false, 
    savedLevel?: 'Básico' | 'Intermediário' | 'Especialista'
  ) => {
    setRole(selectedRole);
    setResume(shouldResume);
    if (selectedRole === 'ALUNO') {
      if (hasPreSurveyCompleted === false) {
        setView('MAIN'); // renderContent irá interceptar e mandar para o questionário
      } else {
        if (shouldResume) {
          if (savedLevel) {
            setSelectedLevel(savedLevel);
          }
          setView('REELS');
        } else {
          setView('LEVEL_SELECT');
        }
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

  const accessibilityValues: AccessibilityState = {
    highContrast,
    fontSize,
    screenReaderMode,
    toggleHighContrast: () => setHighContrast(prev => !prev),
    setFontSize: (size) => setFontSize(size),
    toggleScreenReaderMode: () => setScreenReaderMode(prev => !prev),
  };

  const renderContent = () => {
    if (!role) {
      return <RoleSelector onSelectRole={handleRoleSelect} />;
    }

    if (role === 'GESTOR') {
      return <Dashboard onBack={handleBack} />;
    }

    if (role === 'ALUNO' && hasPreSurveyCompleted === null) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
          <div className="relative w-16 h-16 mb-4">
            <div className={`absolute inset-0 border-4 rounded-full border-t-transparent animate-spin ${highContrast ? 'border-yellow-400' : 'border-blue-500'}`}></div>
          </div>
          <p className="text-slate-400 font-bold">Verificando status do piloto...</p>
        </div>
      );
    }

    if (role === 'ALUNO' && hasPreSurveyCompleted === false) {
      return (
        <PrePilotSurvey 
          onComplete={() => {
            setHasPreSurveyCompleted(true);
            setView('LEVEL_SELECT');
          }}
          onBack={async () => {
            setRole(null);
            setView('MAIN');
            try {
              await auth.signOut();
            } catch (err) {
              console.error("Erro ao sair no questionário:", err);
            }
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

    if (view === 'GOOGLE_WORKSPACE') {
      const defaultUserState = {
        currentLevel: selectedLevel,
        currentModuleIndex: 0,
        currentSlideIndex: 0,
        completedQuizzes: [],
        quizCount: 0,
        correctQuizzesCount: { Básico: 0, Intermediário: 0, Especialista: 0 },
        points: 0,
        level: 1,
        feedbackNeeded: false
      };
      return (
        <GoogleWorkspaceWorkspace 
          onBack={handleBack} 
          userState={defaultUserState} 
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
          onClick={() => setView('REELS')}
          className="w-full group relative overflow-hidden bg-gradient-to-br from-purple-600 to-blue-700 p-8 rounded-3xl shadow-xl hover:scale-[1.02] transition-all active:scale-95"
        >
          <div className="relative z-10 flex flex-col items-start text-left">
            <span className="text-xs font-bold uppercase tracking-widest text-white/60 mb-2">Novo Formato</span>
            <h2 className="text-2xl font-bold text-white mb-1">Reels de Conhecimento</h2>
            <p className="text-white/70 text-sm">Aprenda com pílulas rápidas e dinâmicas</p>
          </div>
          <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-20 group-hover:opacity-40 transition-opacity">
            <svg className="w-24 h-24 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M10 15l5.19-3L10 9v6zM21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9-2 2-2h14c0 1.1.9-2 2-2zM5 19V5h14v14H5z"/></svg>
          </div>
        </button>

        <button 
          onClick={() => setView('GOOGLE_WORKSPACE')}
          className="w-full group relative overflow-hidden bg-gradient-to-br from-indigo-600 to-blue-800 p-8 rounded-3xl shadow-xl hover:scale-[1.02] transition-all active:scale-95 border border-indigo-500/30"
        >
          <div className="relative z-10 flex flex-col items-start text-left">
            <span className="text-xs font-bold uppercase tracking-widest text-white/60 mb-2 flex items-center gap-1.5 animate-pulse">
              INTEGRAÇÃO GOOGLE WORKSPACE <Sparkles className="w-3 h-3 text-cyan-300" />
            </span>
            <h2 className="text-2xl font-bold text-white mb-1">Ferramentas de Estudo</h2>
            <p className="text-white/70 text-sm">Agenda, Planilhas, PDFs e Lembretes Integrados</p>
          </div>
          <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-20 group-hover:opacity-45 transition-opacity">
            <svg className="w-20 h-20 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.053.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
            </svg>
          </div>
        </button>

        <button 
          onClick={() => {
            setStartSurvey(true);
            setView('REELS');
          }}
          className="w-full group relative overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-700 p-8 rounded-3xl shadow-xl hover:scale-[1.02] transition-all active:scale-95 border border-emerald-500/30"
          id="btn-direct-survey"
        >
          <div className="relative z-10 flex flex-col items-start text-left">
            <span className="text-xs font-bold uppercase tracking-widest text-white/60 mb-2 flex items-center gap-1.5">
              Avaliação do Piloto <Trophy className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
            </span>
            <h2 className="text-2xl font-bold text-white mb-1">Encerrar e Responder Pesquisa</h2>
            <p className="text-white/70 text-sm">Responda o questionário final de pós-uso</p>
          </div>
          <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-25 group-hover:opacity-45 transition-opacity">
            <Trophy className="w-20 h-20 text-white" />
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
    <AccessibilityContext.Provider value={accessibilityValues}>
      <div className={getAppClasses()}>
        <div className="w-full max-w-4xl h-full">
           {renderContent()}
        </div>
      </div>
    </AccessibilityContext.Provider>
  );
};

export default App;
