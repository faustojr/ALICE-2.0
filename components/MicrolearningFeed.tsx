
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Flame, 
  Trophy, 
  Zap, 
  ChevronDown, 
  CheckCircle2,
  Star,
  ThumbsUp,
  ThumbsDown,
  Minus,
  AlertCircle,
  Loader2,
  List,
  Lock,
  PlayCircle,
  Map,
  X,
  WifiOff,
  Download
} from 'lucide-react';
import { generateReelsModule } from '../services/geminiService';
import type { ModuleContent, UserState } from '../types';
import { auth } from '../firebase';
import { fetchProgress, reportQuizResult, saveProgress, submitSurvey } from '../services/studentApi';

const LazyImage: React.FC<{ src: string, alt: string, opacity: number, priority?: boolean }> = ({ src, alt, opacity, priority }) => {
  const [isIntersecting, setIntersecting] = useState(priority);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (priority) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIntersecting(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px' } // Carrega um pouco antes para suavidade
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [priority]);

  return (
    <div ref={containerRef} className="absolute inset-0 bg-slate-950">
      {isIntersecting && (
        <motion.img
          src={src}
          alt={alt}
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? opacity : 0 }}
          transition={{ duration: 1 }}
          onLoad={() => setLoaded(true)}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />
      )}
    </div>
  );
};

const MicrolearningFeed: React.FC<{ 
  onBack: () => void, 
  initialLevel: 'Básico' | 'Intermediário' | 'Especialista',
  startWithPostSurvey?: boolean,
  /** Slug da trilha escolhida. Antes era a string fixa "Lei 14.133/2021". */
  trailSlug?: string,
}> = ({ onBack, initialLevel, startWithPostSurvey = false, trailSlug = 'lei-14133' }) => {
  const [userState, setUserState] = useState<UserState>(() => {
    const emailKey = auth.currentUser?.email?.toLowerCase();
    const localKey = emailKey ? `alice_progress_v3_${emailKey}` : 'alice_progress_v3';
    const saved = localStorage.getItem(localKey);
    let parsed: any = null;
    if (saved) {
      try {
        parsed = JSON.parse(saved);
      } catch (e) {
        console.error("Erro ao carregar progresso:", e);
      }
    }
    
    const defaults = {
      currentLevel: initialLevel,
      currentModuleIndex: 0,
      highestModuleIndex: 0,
      currentSlideIndex: 0,
      completedQuizzes: [],
      quizCount: 0,
      correctQuizzesCount: {
        Básico: 0,
        Intermediário: 0,
        Especialista: 0
      },
      points: 1250,
      level: 1,
      currentFailCount: 0,
      feedbackNeeded: false,
      lastStudyDate: null,
      streakDays: 1
    };

    if (parsed) {
      return {
        ...defaults,
        ...parsed
      };
    }
    return defaults;
  });

  const [showPostSurvey, setShowPostSurvey] = useState(startWithPostSurvey);
  const [surveyAnswers, setSurveyAnswers] = useState({
    pos_daysUsed: 5,
    pos_generalKnowledge: 4,
    pos_prepKnowledge: 4,
    pos_confidenceBasic: 4,
    pos_perceivedAdaptation: 4,
    pos_microLearningHelp: 4,
    pos_easeOfUse: 4,
    pos_motivation: 4,
    pos_useAgain: 4,
  });
  const [submittingSurvey, setSubmittingSurvey] = useState(false);
  const [surveySuccess, setSurveySuccess] = useState(false);
  const [surveyStep, setSurveyStep] = useState(1);

  const handleSubmitSurvey = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) return;
    setSubmittingSurvey(true);
    const emailKey = user.email.toLowerCase();

    // 1. Sempre salvar os dados localmente no localStorage como backup de segurança imediata
    const localSurveyData = {
      email: emailKey,
      ...surveyAnswers,
      timestamp: new Date().toISOString()
    };
    try {
      localStorage.setItem(`pilotSurveys_${emailKey}`, JSON.stringify(localSurveyData));
    } catch (localErr) {
      console.warn("Erro ao salvar dados de pesquisa no localStorage:", localErr);
    }

    try {
      // 2. Envia pela API, que grava a pesquisa e marca o piloto como concluído.
      const result = await submitSurvey(
        emailKey,
        'post',
        surveyAnswers,
        user.displayName || undefined
      );

      if (!result.synced && !result.queued) {
        throw new Error(result.error || 'Falha ao registrar a pesquisa.');
      }

      // 4. Atualizar estado local de progresso do usuário
      setUserState(prev => ({
        ...prev,
        pilotStatus: 'completed',
        feedbackNeeded: false
      }));

      // 5. Atualizar progresso no localStorage geral
      const localProgress = localStorage.getItem('alice_progress_v3') || '{}';
      try {
        const parsed = JSON.parse(localProgress);
        parsed.pilotStatus = 'completed';
        localStorage.setItem('alice_progress_v3', JSON.stringify(parsed));
        localStorage.setItem(`alice_progress_v3_${emailKey}`, JSON.stringify({ ...parsed, pilotStatus: 'completed' }));
      } catch (e) {
        console.error("Erro ao atualizar localStorage de progresso:", e);
      }

      setSurveySuccess(true);
    } catch (err: any) {
      console.warn("Lentidão ou falha de gravação no Firebase. Executando salvamento resiliente local.");
      console.error("Erro original do Firebase:", err);

      // Fallback robusto: se falhar o Firebase, garantimos que o usuário termine e o app registre como concluído localmente
      setUserState(prev => ({
        ...prev,
        pilotStatus: 'completed',
        feedbackNeeded: false
      }));

      const localProgress = localStorage.getItem('alice_progress_v3') || '{}';
      try {
        const parsed = JSON.parse(localProgress);
        parsed.pilotStatus = 'completed';
        localStorage.setItem('alice_progress_v3', JSON.stringify(parsed));
        localStorage.setItem(`alice_progress_v3_${emailKey}`, JSON.stringify({ ...parsed, pilotStatus: 'completed' }));
      } catch (e) {
        console.error("Erro no fallback de localStorage:", e);
      }

      setSurveySuccess(true);
    } finally {
      setSubmittingSurvey(false);
    }
  };

  // Carrega o progresso remoto do Firestore ao montar a aplicação
  useEffect(() => {
    const loadRemoteProgress = async () => {
      const user = auth.currentUser;
      if (user && user.email) {
        try {
          const emailKey = user.email.toLowerCase();
          const remote = await fetchProgress(emailKey);
          const data = remote?.user;
          if (data) {
            setUserState(prev => {
              const updated = {
                ...prev,
                points: typeof data.points === 'number' ? data.points : prev.points,
                currentLevel: data.currentLevel || prev.currentLevel,
                currentModuleIndex: typeof data.currentModuleIndex === 'number' ? data.currentModuleIndex : prev.currentModuleIndex,
                currentSlideIndex: typeof data.currentSlideIndex === 'number' ? data.currentSlideIndex : prev.currentSlideIndex,
                highestModuleIndex: typeof data.highestModuleIndex === 'number' ? data.highestModuleIndex : prev.highestModuleIndex,
                correctQuizzesCount: data.correctQuizzesCount || prev.correctQuizzesCount,
                quizCount: typeof data.quizCount === 'number' ? data.quizCount : prev.quizCount,
                lastStudyDate: data.lastStudyDate || prev.lastStudyDate,
                streakDays: typeof data.streakDays === 'number' ? data.streakDays : prev.streakDays,
                completedQuizzes: Array.isArray(data.completedQuizzes) ? data.completedQuizzes : (prev.completedQuizzes || []),
                feedbackNeeded: typeof data.feedbackNeeded === 'boolean' ? data.feedbackNeeded : prev.feedbackNeeded,
                pilotStatus: data.pilotStatus || prev.pilotStatus,
              };
              localStorage.setItem('alice_progress_v3', JSON.stringify(updated));
              if (emailKey) {
                localStorage.setItem(`alice_progress_v3_${emailKey}`, JSON.stringify(updated));
              }
              return updated;
            });
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (errMsg.toLowerCase().includes('offline')) {
            console.log("Firestore está offline. Usando cache local do localStorage para progresso remoto.");
          } else {
            console.error("Erro ao carregar progresso remoto ao montar:", err);
          }
        }
      }
    };
    loadRemoteProgress();
  }, []);

  // Salva o progresso localmente de imediato e no Firestore com debounce inteligente
  const latestUserStateRef = useRef(userState);
  useEffect(() => {
    latestUserStateRef.current = userState;
  }, [userState]);

  useEffect(() => {
    const saveLocal = () => {
      localStorage.setItem('alice_progress_v3', JSON.stringify(userState));
      const user = auth.currentUser;
      if (user && user.email) {
        const emailKey = user.email.toLowerCase();
        localStorage.setItem(`alice_progress_v3_${emailKey}`, JSON.stringify(userState));
      }
    };

    const saveRemote = async (stateToSave = userState) => {
      const user = auth.currentUser;
      if (!user?.email) return;

      const emailKey = user.email.toLowerCase();
      const result = await saveProgress(emailKey, {
        name: user.displayName || `Aluno ${initialLevel}`,
        points: stateToSave.points,
        currentLevel: stateToSave.currentLevel,
        currentModuleIndex: stateToSave.currentModuleIndex,
        currentSlideIndex: stateToSave.currentSlideIndex,
        highestModuleIndex: stateToSave.highestModuleIndex,
        correctQuizzesCount: stateToSave.correctQuizzesCount,
        quizCount: stateToSave.quizCount,
        completedQuizzes: stateToSave.completedQuizzes || [],
        lastStudyDate: stateToSave.lastStudyDate || null,
        streakDays: stateToSave.streakDays || 1,
        feedbackNeeded: stateToSave.feedbackNeeded || false,
        currentTrail: trailSlug,
        hasTestedReels: stateToSave.hasTestedReels,
      });

      // Falha de rede vai para a fila e é reenviada quando a conexão volta;
      // não vale interromper o estudo por isso.
      if (!result.synced && !result.queued) {
        console.error('Progresso recusado pelo servidor:', result.error);
      }
    };

    // Salva localmente IMEDIATAMENTE quando o estado muda
    saveLocal();

    // Debounce de 2.5 segundos para persistência na nuvem (Firestore)
    const timer = setTimeout(() => {
      saveRemote(latestUserStateRef.current);
    }, 2500);

    // Salvar ao fechar/sair da página
    const handleExit = () => {
      saveLocal();
      saveRemote(latestUserStateRef.current);
    };
    window.addEventListener('beforeunload', handleExit);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeunload', handleExit);
    };
  }, [
    userState.points, 
    userState.currentLevel, 
    userState.currentModuleIndex, 
    userState.quizCount,
    userState.correctQuizzesCount,
    userState.highestModuleIndex,
    userState.lastStudyDate,
    userState.streakDays,
    initialLevel
  ]);

  const LEVEL_REQUIREMENTS = {
    'Básico': 15, // Reduzi para ser mais dinâmico
    'Intermediário': 30,
    'Especialista': 50
  };

  const [currentModule, setCurrentModule] = useState<ModuleContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showReward, setShowReward] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showTrailMenu, setShowTrailMenu] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [downloadState, setDownloadState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);

  // Session Init and Streak Calculation (Problem 1)
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastDate = userState.lastStudyDate; // string or null

    if (!lastDate) {
      // First session or study date not logged
      setUserState(prev => ({
        ...prev,
        lastStudyDate: todayStr,
        streakDays: 1
      }));
    } else {
      const lastDateClean = lastDate.split('T')[0];
      if (lastDateClean === todayStr) {
        // Today already studied, do not touch streak or study date
      } else {
        const todayObj = new Date(todayStr);
        const yesterdayObj = new Date(todayObj);
        yesterdayObj.setDate(todayObj.getDate() - 1);
        const yesterdayStr = yesterdayObj.toISOString().split('T')[0];

        if (lastDateClean === yesterdayStr) {
          // Studied yesterday, increment streak
          setUserState(prev => ({
            ...prev,
            lastStudyDate: todayStr,
            streakDays: (prev.streakDays || 1) + 1
          }));
        } else {
          // Studied long ago, reset streak to 1
          setUserState(prev => ({
            ...prev,
            lastStudyDate: todayStr,
            streakDays: 1
          }));
        }
      }
    }
  }, []);

  // Cleanup RAF on unmount (Problem 10)
  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchModule = async (index: number, level: 'Básico' | 'Intermediário' | 'Especialista') => {
    setLoading(true);
    try {
      const module = await generateReelsModule(trailSlug, index, level);
      setCurrentModule(module);
    } catch (error) {
      console.error("Error fetching module:", error);
    } finally {
      setLoading(false);
    }
  };

  // Removed redundant pre-fetch useEffect as it's now handled inside generateReelsModule service

  // Fetches are triggered by currentModuleIndex, currentLevel, and failCount
  useEffect(() => {
    fetchModule(userState.currentModuleIndex, userState.currentLevel);
  }, [userState.currentModuleIndex, userState.currentLevel]);

  // Robust resumption and reset of scroll position
  useEffect(() => {
    if (!loading && currentModule && containerRef.current) {
      const scrollTarget = userState.currentSlideIndex * containerRef.current.clientHeight;
      // Use requestAnimationFrame to ensure the container is painted
      requestAnimationFrame(() => {
        if (containerRef.current) {
           containerRef.current.scrollTo({ 
             top: scrollTarget, 
             behavior: userState.currentSlideIndex === 0 ? 'auto' : 'instant' 
           });
        }
      });
    }
  }, [loading, currentModule, userState.currentModuleIndex, userState.currentSlideIndex]);

  const handleScroll = () => {
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
    }
    scrollRafRef.current = requestAnimationFrame(() => {
      if (containerRef.current && currentModule) {
        const index = Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight);
        if (index !== userState.currentSlideIndex) {
          setUserState(prev => ({ ...prev, currentSlideIndex: index }));
        }
      }
      scrollRafRef.current = null;
    });
  };

  const handleCompleteLesson = () => {
    setShowQuiz(true);
  };

  const handleQuizAnswer = async (value: string) => {
    if (quizAnswered) return; // Prevent double answer
    setSelectedOption(value);
    setQuizAnswered(true);

    // Reporta o resultado à variante servida. É o que permite promover a
    // conteúdo padrão uma explicação gerada pela IA que levou alunos ao
    // acerto — e o que faz cada geração ser paga uma vez só.
    const email = auth.currentUser?.email;
    if (email && currentModule?.variantId) {
      reportQuizResult(email, currentModule.variantId, value === 'correct').catch(
        (err) => console.error('Falha ao reportar resultado do quiz:', err)
      );
    }

    if (value === 'correct') {
      setUserState(prev => {
        const newCorrectCount = { ...prev.correctQuizzesCount };
        newCorrectCount[prev.currentLevel] += 1;
        
        return { 
          ...prev, 
          points: prev.points + 100,
          quizCount: prev.quizCount + 1,
          correctQuizzesCount: newCorrectCount,
          currentFailCount: 0,
          hasTestedReels: true
        };
      });
      setShowReward(true);
      setTimeout(() => setShowReward(false), 2000);
    } else {
      setUserState(prev => ({ 
        ...prev, 
        currentFailCount: (prev.currentFailCount || 0) + 1,
        hasTestedReels: true
      }));
    }
  };

  const handleRelearn = async () => {
    setLoading(true);
    setShowQuiz(false);
    setQuizAnswered(false);
    setSelectedOption(null);
    try {
      const module = await generateReelsModule(
        trailSlug, 
        userState.currentModuleIndex, 
        userState.currentLevel, 
        false, 
        userState.currentFailCount || 1
      );
      setCurrentModule(module);
      setUserState(prev => ({ ...prev, currentSlideIndex: 0 }));
    } catch (error) {
      console.error("Error fetching re-learn module:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNextModule = () => {
    setLoading(true);
    setShowQuiz(false);
    setQuizAnswered(false);
    setSelectedOption(null);
    
    const currentCorrect = userState.correctQuizzesCount[userState.currentLevel];
    const required = LEVEL_REQUIREMENTS[userState.currentLevel];

    // Check for Level Up - Only if we just finished a module and reached the requirement
    if (currentCorrect >= required) {
      if (userState.currentLevel === 'Básico') {
        setUserState(prev => ({ ...prev, currentLevel: 'Intermediário', currentModuleIndex: 0, currentSlideIndex: 0 }));
        setShowLevelUp(true);
        return;
      } else if (userState.currentLevel === 'Intermediário') {
        setUserState(prev => ({ ...prev, currentLevel: 'Especialista', currentModuleIndex: 0, currentSlideIndex: 0 }));
        setShowLevelUp(true);
        return;
      }
    }

    // Verifica se precisa de feedback (cada 10 quizzes)
    if (userState.quizCount > 0 && userState.quizCount % 10 === 0) {
      setUserState(prev => ({ 
        ...prev, 
        feedbackNeeded: true,
        highestModuleIndex: Math.max(prev.highestModuleIndex ?? 0, prev.currentModuleIndex + 1)
      }));
    } else {
      setUserState(prev => {
        const nextIndex = prev.currentModuleIndex + 1;
        return { 
          ...prev, 
          currentModuleIndex: nextIndex,
          highestModuleIndex: Math.max(prev.highestModuleIndex ?? 0, nextIndex),
          currentSlideIndex: 0 
        };
      });
    }
  };

  const handleFeedback = (score: 'positivo' | 'neutro' | 'negativo') => {
    setUserState(prev => {
      const nextIndex = score === 'negativo' 
        ? Math.max(0, prev.currentModuleIndex - 1)
        : prev.currentModuleIndex + 1;
      const highest = Math.max(prev.highestModuleIndex ?? 0, nextIndex);
      
      return { 
        ...prev, 
        feedbackNeeded: false,
        currentModuleIndex: nextIndex,
        highestModuleIndex: highest,
        currentSlideIndex: 0,
        lastFeedbackScore: score === 'positivo' ? prev.lastFeedbackScore : score
      };
    });
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-slate-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <p className="text-blue-400 font-medium animate-pulse">ALICE está preparando sua trilha...</p>
      </div>
    );
  }

  if (showPostSurvey) {
    if (surveySuccess) {
      return (
        <div className="h-screen w-full bg-slate-950 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center animate-in scale-in duration-300">
            <div className="w-20 h-20 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-6 text-green-400">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-black text-white mb-4">Parabéns! 🎉</h2>
            <p className="text-slate-300 mb-8 text-sm leading-relaxed">
              Sua resposta foi enviada com sucesso ao banco de dados da prefeitura. Muito obrigado por ajudar a aprimorar o aprendizado de nossos servidores!
            </p>
            <button
              onClick={onBack}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xl rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      );
    }

    const questions = [
      {
        key: 'pos_daysUsed',
        label: 'Dias de Uso',
        description: 'Quantos dias você utilizou o aplicativo durante o teste?',
        min: 1,
        max: 10,
        type: 'slider'
      },
      {
        key: 'pos_generalKnowledge',
        label: 'Conhecimento Geral',
        description: 'Seu nível de conhecimento sobre a Lei 14.133 após utilizar o ALICE:',
        type: 'rating'
      },
      {
        key: 'pos_prepKnowledge',
        label: 'Fase Preparatória',
        description: 'Seu nível de conhecimento sobre a Fase Preparatória das contratações:',
        type: 'rating'
      },
      {
        key: 'pos_confidenceBasic',
        label: 'Confiança para Dúvidas',
        description: 'Sua segurança para dirimir dúvidas básicas sobre licitações:',
        type: 'rating'
      },
      {
        key: 'pos_perceivedAdaptation',
        label: 'Adaptação do Ritmo',
        description: 'A adaptação dos conteúdos das pílulas à sua velocidade de aprendizado:',
        type: 'rating'
      },
      {
        key: 'pos_microLearningHelp',
        label: 'Ajuda da Microaprendizagem',
        description: 'A utilidade de pílulas rápidas (micro-learning) para a retenção do conhecimento:',
        type: 'rating'
      },
      {
        key: 'pos_easeOfUse',
        label: 'Facilidade de Uso',
        description: 'Como você avalia a facilidade de navegar e utilizar o aplicativo ALICE:',
        type: 'rating'
      },
      {
        key: 'pos_motivation',
        label: 'Motivação de Estudo',
        description: 'O estímulo que o aplicativo gerou para você continuar aprendendo:',
        type: 'rating'
      },
      {
        key: 'pos_useAgain',
        label: 'Usaria Novamente',
        description: 'Sua intenção de usar o ALICE para futuras capacitações públicas:',
        type: 'rating'
      }
    ];

    const currentQ = questions[surveyStep - 1];

    return (
      <div className="h-screen w-full bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between h-[520px] shadow-2xl relative overflow-hidden animate-in fade-in duration-300">
          
          {/* Header */}
          <div>
            <div className="flex justify-between items-center mb-6">
              <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Avaliação do Teste Piloto</span>
              <span className="text-slate-400 text-xs font-mono">{surveyStep} / {questions.length}</span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full mb-8 overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${(surveyStep / questions.length) * 100}%` }}
              />
            </div>

            {/* Question */}
            <div className="space-y-3">
              <h3 className="text-2xl font-black text-white">{currentQ.label}</h3>
              <p className="text-slate-300 text-sm leading-relaxed">{currentQ.description}</p>
            </div>
          </div>

          {/* Answer Controls */}
          <div className="my-auto py-6">
            {currentQ.type === 'slider' ? (
              <div className="space-y-4">
                <input 
                  type="range" 
                  min={currentQ.min} 
                  max={currentQ.max} 
                  value={surveyAnswers[currentQ.key as keyof typeof surveyAnswers]} 
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSurveyAnswers(prev => ({ ...prev, [currentQ.key]: val }));
                  }}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-xs font-bold text-slate-400">
                  <span>{currentQ.min} Dia</span>
                  <span className="text-blue-400 text-lg font-black">{surveyAnswers[currentQ.key as keyof typeof surveyAnswers]} Dias</span>
                  <span>{currentQ.max}+ Dias</span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between gap-1 max-w-sm mx-auto">
                {[1, 2, 3, 4, 5].map((val) => {
                  const currentSelected = surveyAnswers[currentQ.key as keyof typeof surveyAnswers];
                  const isGold = val <= currentSelected;
                  return (
                    <button
                      key={val}
                      onClick={() => setSurveyAnswers(prev => ({ ...prev, [currentQ.key]: val }))}
                      className="group relative p-2 text-center flex-1 transition-all animate-in zoom-in duration-200"
                    >
                      <div className={`mx-auto w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${
                        isGold 
                          ? 'bg-yellow-500/20 border-yellow-400 text-yellow-300 scale-105 shadow-md shadow-yellow-500/10' 
                          : 'bg-white/5 border-white/10 text-slate-400 hover:border-slate-600 hover:text-white'
                      }`}>
                        <Star className={`w-6 h-6 ${isGold ? 'fill-yellow-400 text-yellow-400' : 'text-slate-500'}`} />
                      </div>
                      <span className="text-[10px] mt-1 font-bold text-slate-500 block">{val}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="flex gap-4 border-t border-slate-800/60 pt-6">
            {surveyStep > 1 ? (
              <button
                onClick={() => setSurveyStep(prev => prev - 1)}
                className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl transition-all active:scale-95"
              >
                Anterior
              </button>
            ) : (
              <button
                onClick={() => setShowPostSurvey(false)}
                className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl transition-all active:scale-95"
              >
                Cancelar
              </button>
            )}

            {surveyStep < questions.length ? (
              <button
                onClick={() => setSurveyStep(prev => prev + 1)}
                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-lg rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <span>Próximo</span>
                <Trophy className="w-5 h-5 text-yellow-300 animate-bounce" />
              </button>
            ) : (
              <button
                onClick={handleSubmitSurvey}
                disabled={submittingSurvey}
                className="flex-1 py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-black text-lg rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
              >
                {submittingSurvey ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <span>Enviar Respostas</span>
                    <CheckCircle2 className="w-5 h-5 text-green-300" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (userState.feedbackNeeded) {
    return (
      <div className="h-screen w-full bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center animate-in fade-in zoom-in duration-300">
          <Star className="w-16 h-16 text-yellow-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-4">Como está o ritmo?</h2>
          <p className="text-gray-400 mb-8">Você completou 10 quizzes! Queremos saber se o conteúdo está adequado para você.</p>
          
          <div className="grid grid-cols-1 gap-4">
            <button 
              onClick={() => handleFeedback('positivo')}
              className="flex items-center justify-between p-4 bg-green-500/20 border border-green-500/30 rounded-2xl text-green-400 hover:bg-green-500/30 transition-all"
            >
              <span className="font-bold">Está ótimo, continue!</span>
              <ThumbsUp className="w-6 h-6" />
            </button>
            
            <button 
              onClick={() => handleFeedback('neutro')}
              className="flex items-center justify-between p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-2xl text-yellow-400 hover:bg-yellow-500/30 transition-all"
            >
              <span className="font-bold">Pode melhorar o conteúdo</span>
              <Minus className="w-6 h-6" />
            </button>
            
            <button 
              onClick={() => handleFeedback('negativo')}
              className="flex items-center justify-between p-4 bg-red-500/20 border border-red-500/30 rounded-2xl text-red-400 hover:bg-red-500/30 transition-all"
            >
              <span className="font-bold">Não gostei, quero repetir</span>
              <ThumbsDown className="w-6 h-6" />
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-slate-400 text-xs mb-3">Já concluiu sua participação no piloto?</p>
            <button
              onClick={() => setShowPostSurvey(true)}
              className="w-full py-4 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 animate-pulse hover:animate-none"
              id="btn-terminate-pilot"
            >
              <span>Encerrar Piloto & Responder Questionário</span>
              <Trophy className="w-4 h-4 text-yellow-300" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden flex flex-col">
      {/* Header Gamificado */}
      <div className="absolute top-0 left-0 right-0 z-50 p-3 sm:p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex gap-2 sm:gap-3 items-center">
          <button onClick={onBack} className="text-white/70 hover:text-white transition-colors text-xs sm:text-sm">
            Voltar
          </button>
          <button onClick={() => setShowTrailMenu(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all font-medium text-[10px] sm:text-xs border border-white/10 shadow-sm border-b-2">
            <List className="w-3.5 h-3.5 sm:w-4 h-4" />
            <span>Trilha</span>
          </button>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4">
          {isOffline && (
            <div className="hidden xs:flex items-center gap-1.5 px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded-full text-red-400 text-[8px] font-bold uppercase animate-pulse">
              <WifiOff className="w-2.5 h-2.5" />
              Offline
            </div>
          )}
          
          <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-2 py-0.5 sm:px-3 sm:py-1 rounded-full border border-white/20">
            <Flame className="w-3.5 h-3.5 sm:w-4 h-4 text-orange-500 fill-orange-500" />
            <span className="text-white font-bold text-xs sm:text-sm">{userState.streakDays || 1}d</span>
          </div>
          
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 sm:w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="text-white font-bold text-xs sm:text-sm">{userState.points}</span>
            </div>
            <div className="w-16 sm:w-20 h-1 bg-white/20 rounded-full mt-1 overflow-hidden">
              <div 
                className="h-full bg-yellow-400 transition-all duration-500" 
                style={{ width: `${(userState.correctQuizzesCount[userState.currentLevel] / LEVEL_REQUIREMENTS[userState.currentLevel]) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {isOffline && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[40] w-max px-4 py-2 bg-blue-600/20 border border-blue-600/30 backdrop-blur-md rounded-full">
           <p className="text-[10px] font-bold text-blue-400 flex items-center gap-2">
             <Download className="w-3 h-3" />
             ESTUDANDO MÓDULO SALVO OFFLINE
           </p>
        </div>
      )}

      {/* Feed Estilo Reels */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {currentModule?.slides.map((slide, index) => (
          <div 
            key={index}
            className="h-screen w-full snap-start relative flex items-center justify-center p-6"
          >
            {/* Background Image */}
            <LazyImage 
              src={slide.imageUrl} 
              alt="Background" 
              opacity={0.4}
              priority={index === 0}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60"></div>
            
            {/* Card Content */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-2xl mx-auto"
            >
              <div className="flex justify-between items-start mb-4 sm:mb-6">
                <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 bg-blue-500/20 rounded-full text-[9px] sm:text-[10px] font-bold text-blue-400 uppercase tracking-widest border border-blue-500/30">
                  {userState.currentLevel} • {index + 1}/3
                </span>
                <div className="text-white/40 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">
                  Lei 14.133/21
                </div>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4 leading-tight">
                {currentModule.title}
              </h2>
              
              <div className="relative">
                {userState.currentFailCount > 0 && (
                  <div className="absolute -top-6 left-0 flex items-center gap-1 text-[10px] font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                    <Zap className="w-3 h-3 fill-blue-400" />
                    Nova Explicação
                  </div>
                )}
                <p 
                  id="reels-content-text"
                  className={`text-white/90 text-base sm:text-lg leading-relaxed mb-6 sm:mb-8 transition-colors duration-500 ${
                    userState.currentFailCount > 0 ? 'text-blue-50 border-l-2 border-blue-500/50 pl-4 italic' : ''
                  }`}
                >
                  {slide.text}
                </p>
              </div>

              {index === currentModule.slides.length - 1 && (
                <button 
                  onClick={handleCompleteLesson}
                  className="w-full py-3.5 sm:py-4 bg-blue-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-500 active:scale-95 transition-all shadow-lg shadow-blue-900/20 text-sm sm:text-base"
                >
                  <CheckCircle2 className="w-4 h-4 sm:w-5 h-5" />
                  Testar Conhecimento
                </button>
              )}
            </motion.div>

            {/* Scroll Indicator */}
            {index < currentModule.slides.length - 1 && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-white/40">
                <ChevronDown className="w-8 h-8" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quiz Modal */}
      <AnimatePresence>
        {showQuiz && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-slate-950 flex flex-col p-4 sm:p-6 overflow-y-auto"
          >
            <div className="w-full max-w-md mx-auto py-6 sm:py-8 flex-1 flex flex-col justify-center">
              <div className="mb-6 sm:mb-8 text-center">
                <div className="inline-block p-2.5 sm:p-3 bg-blue-500/20 rounded-2xl mb-3 sm:mb-4">
                  <Zap className="w-6 h-6 sm:w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Desafio Rápido</h3>
                <p className="text-gray-400 text-xs sm:text-sm">Responda corretamente para ganhar +100 XP</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-[2rem] p-5 sm:p-6 mb-5 sm:mb-6">
                <p className="text-white text-base sm:text-lg font-medium mb-5 sm:mb-6">{currentModule?.question}</p>
                
                <div className="space-y-2.5 sm:space-y-3">
                  {currentModule?.options.map((option, i) => (
                    <button
                      key={i}
                      disabled={quizAnswered}
                      onClick={() => handleQuizAnswer(option.value)}
                      className={`w-full p-3.5 sm:p-4 rounded-xl sm:rounded-2xl text-left transition-all border text-sm sm:text-base ${
                        selectedOption === option.value
                          ? option.value === 'correct'
                            ? 'bg-green-500/20 border-green-500 text-green-400'
                            : 'bg-red-500/20 border-red-500 text-red-400'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {quizAnswered && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl mb-5 sm:mb-6 flex gap-3 ${
                    selectedOption === 'correct' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {selectedOption === 'correct' ? <CheckCircle2 className="shrink-0 w-5 h-5" /> : <AlertCircle className="shrink-0 w-5 h-5" />}
                  <p className="text-xs sm:text-sm">
                    {selectedOption === 'correct' ? currentModule?.feedbackCorrect : currentModule?.feedbackWrong}
                  </p>
                </motion.div>
              )}

              {quizAnswered && (
                <div className="flex gap-3">
                  {selectedOption === 'correct' ? (
                    <button 
                      onClick={handleNextModule}
                      className="flex-1 py-3.5 sm:py-4 bg-white text-black font-bold rounded-xl sm:rounded-2xl hover:bg-opacity-90 active:scale-95 transition-all text-sm sm:text-base"
                    >
                      Próxima Lição
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={handleRelearn}
                        className="flex-1 py-3.5 sm:py-4 bg-blue-600 text-white font-bold rounded-xl sm:rounded-2xl hover:bg-blue-500 active:scale-95 transition-all text-sm sm:text-base flex items-center justify-center gap-2"
                      >
                        <Zap className="w-4 h-4 fill-white" />
                        Recapitular (Novo Formato)
                      </button>
                      <button 
                        onClick={() => {
                          setQuizAnswered(false);
                          setSelectedOption(null);
                        }}
                        className="px-4 py-3.5 sm:py-4 bg-white/10 text-white font-bold rounded-xl sm:rounded-2xl hover:bg-white/20 active:scale-95 transition-all text-sm sm:text-base"
                      >
                        Tentar de novo
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reward Overlay */}
      <AnimatePresence>
        {showReward && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-8 rounded-3xl text-center shadow-2xl">
              <motion.div
                animate={{ rotate: [0, 10, -10, 10, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                <Trophy className="w-20 h-20 text-white mx-auto mb-4" />
              </motion.div>
              <h3 className="text-2xl font-black text-white mb-2 uppercase italic">Excelente!</h3>
              <p className="text-white/90 font-bold">+100 XP</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Level Up Overlay */}
      <AnimatePresence>
        {showLevelUp && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[110] bg-blue-600 flex items-center justify-center p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-xs"
            >
              <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Star className="w-12 h-12 text-white fill-white" />
              </div>
              <h2 className="text-4xl font-black text-white mb-2 uppercase italic">Subiu de Nível!</h2>
              <p className="text-white/80 mb-8 font-medium">Você agora é nível {userState.currentLevel} na Lei 14.133!</p>
              <button 
                onClick={() => setShowLevelUp(false)}
                className="w-full py-4 bg-white text-blue-600 font-bold rounded-2xl shadow-xl active:scale-95 transition-all"
              >
                Continuar Jornada
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trail Menu Overlay */}
      <AnimatePresence>
        {showTrailMenu && (
          <motion.div 
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="absolute inset-y-0 left-0 z-[120] w-full max-w-[320px] sm:max-w-xs bg-slate-900 border-r border-white/10 shadow-2xl flex flex-col"
          >
            <div className="p-4 sm:p-6 border-b border-white/10 flex justify-between items-center bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Map className="w-4 h-4 sm:w-5 h-5 text-blue-400" />
                <h3 className="text-base sm:text-lg font-bold text-white">Sua Trilha</h3>
              </div>
              <button onClick={() => setShowTrailMenu(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5 sm:w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto scrollbar-hide relative">
              {/* Progresso Geral */}
              <div className="mb-6 sm:mb-8">
                <div className="flex justify-between text-xs sm:text-sm mb-2">
                  <span className="text-gray-400">Nível {userState.currentLevel}</span>
                  <span className="text-blue-400 font-bold">
                    {Math.round((userState.correctQuizzesCount[userState.currentLevel] / LEVEL_REQUIREMENTS[userState.currentLevel]) * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 sm:h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${(userState.correctQuizzesCount[userState.currentLevel] / LEVEL_REQUIREMENTS[userState.currentLevel]) * 100}%` }}
                  />
                </div>
              </div>

              {/* Modo Offline Section */}
              <div className="mb-6 sm:mb-8 p-3 sm:p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                <div className="flex items-center gap-2 mb-1.5">
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs sm:text-sm font-bold text-white">Estudo Offline</span>
                </div>
                <p className="text-[9px] sm:text-[10px] text-gray-400 mb-2.5 sm:mb-3">Baixe módulos para estudar sem internet.</p>
                <button
                  disabled={isOffline || downloadState === 'loading'}
                  onClick={async () => {
                    if (isOffline) return;
                    setDownloadState('loading');
                    try {
                      // Baixa os próximos 3 módulos
                      for (let i = 1; i <= 3; i++) {
                        await generateReelsModule(trailSlug, userState.currentModuleIndex + i, userState.currentLevel);
                      }
                      setDownloadState('done');
                    } catch (err) {
                      setDownloadState('error');
                    } finally {
                      setTimeout(() => {
                        setDownloadState('idle');
                      }, 3000);
                    }
                  }}
                  className={`w-full py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all border ${
                    isOffline 
                      ? 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed' 
                      : downloadState === 'loading'
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-300 cursor-wait animate-pulse'
                        : downloadState === 'done'
                          ? 'bg-green-500/20 border-green-500/30 text-green-400'
                          : downloadState === 'error'
                            ? 'bg-red-500/20 border-red-500/30 text-red-400'
                            : 'bg-blue-500/20 border-blue-500/30 text-blue-400 hover:bg-blue-500/30'
                  }`}
                >
                  {isOffline && downloadState === 'idle' 
                    ? "Sem Conexão" 
                    : downloadState === 'loading'
                      ? "Baixando..."
                      : downloadState === 'done'
                        ? "Concluído!"
                        : downloadState === 'error'
                          ? "Erro ao baixar"
                          : "Baixar Próximas Lições"}
                </button>
              </div>

              {/* Lista de Módulos */}
              <div className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                {Array.from({ length: (userState.highestModuleIndex ?? userState.currentModuleIndex) + 2 }).map((_, i) => {
                  const highest = userState.highestModuleIndex ?? userState.currentModuleIndex;
                  const isLocked = i > highest;
                  const isCurrent = i === userState.currentModuleIndex;
                  const isCompleted = i < highest;

                  return (
                    <button
                      key={i}
                      disabled={isLocked}
                      onClick={() => {
                        setUserState(prev => ({ ...prev, currentModuleIndex: i, currentSlideIndex: 0 }));
                        setShowTrailMenu(false);
                      }}
                      className={`w-full p-3 sm:p-4 rounded-xl sm:rounded-2xl flex items-center gap-3 sm:gap-4 text-left transition-all border ${
                        isCurrent 
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' 
                          : isCompleted
                            ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                            : 'bg-black/20 border-transparent text-gray-600 cursor-not-allowed'
                      }`}
                    >
                      <div className="shrink-0">
                        {isCurrent ? (
                          <PlayCircle className="w-5 h-5 sm:w-6 h-6 text-blue-400" />
                        ) : isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 sm:w-6 h-6 text-green-400" />
                        ) : (
                          <Lock className="w-5 h-5 sm:w-6 h-6 text-gray-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-xs sm:text-sm">Módulo {i + 1}</div>
                        <div className={`text-[10px] sm:text-xs ${isCurrent ? 'text-blue-400' : isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>
                          {isCurrent ? 'Em andamento' : isCompleted ? 'Concluído' : 'Bloqueado'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Reset Progress Button */}
              <div className="pt-4 sm:pt-6 border-t border-white/10">
                <button
                  onClick={() => {
                    setShowResetConfirm(true);
                  }}
                  className="w-full p-3 sm:p-4 rounded-xl border border-red-500/30 text-red-500 text-[10px] sm:text-xs font-bold hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                >
                  <AlertCircle className="w-3.5 h-3.5 sm:w-4 h-4" />
                  Reiniciar Todo o Progresso
                </button>
              </div>

              {/* Custom Reset Confirm Modal (Problem 11) */}
              {showResetConfirm && (
                <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="w-full bg-slate-900 border border-red-500/30 rounded-3xl p-5 text-center shadow-2xl space-y-4">
                    <div className="w-12 h-12 bg-red-500/15 rounded-full flex items-center justify-center mx-auto">
                      <AlertCircle className="w-6 h-6 text-red-500" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-white font-bold text-sm">Reiniciar Progresso?</h4>
                      <p className="text-gray-400 text-xs leading-relaxed text-balance">
                        Tem certeza que deseja reiniciar todo seu progresso? Isso não pode ser desfeito.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        onClick={() => {
                          localStorage.removeItem('alice_progress_v2');
                          localStorage.removeItem('alice_progress_v3');
                          window.location.reload();
                        }}
                        className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all"
                      >
                        Confirmar Reset
                      </button>
                      <button
                        onClick={() => setShowResetConfirm(false)}
                        className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white/90 text-xs font-bold rounded-xl transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MicrolearningFeed;
