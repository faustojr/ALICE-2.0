
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
  Loader2
} from 'lucide-react';
import { generateReelsModule } from '../services/geminiService';
import type { ModuleContent, UserState } from '../types';
import { db, auth } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

const MicrolearningFeed: React.FC<{ onBack: () => void, initialLevel: 'Básico' | 'Intermediário' | 'Especialista' }> = ({ onBack, initialLevel }) => {
  const [userState, setUserState] = useState<UserState>(() => {
    const saved = localStorage.getItem('alice_progress_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Erro ao carregar progresso:", e);
      }
    }
    return {
      currentLevel: initialLevel,
      currentModuleIndex: 0,
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
      feedbackNeeded: false
    };
  });

  // Salva o progresso sempre que o estado mudar
  useEffect(() => {
    localStorage.setItem('alice_progress_v2', JSON.stringify(userState));

    // Sincroniza com o servidor para o Dashboard do Gestor via Firestore
    const syncWithFirestore = async () => {
      const user = auth.currentUser;
      if (user && user.email) {
        try {
          const emailKey = user.email.toLowerCase();
          await setDoc(doc(db, 'users', emailKey), {
            email: emailKey,
            name: user.displayName || `Aluno ${initialLevel}`,
            points: userState.points,
            currentLevel: userState.currentLevel,
            correctQuizzesCount: userState.correctQuizzesCount,
            quizCount: userState.quizCount,
            area: 'Geral',
            bestTopic: 'Lei 14.133',
            softSkillsLevel: userState.points >= 3000 ? 'Especialista' : 'Básico',
            lastAccess: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.error("Erro ao sincronizar com Firestore:", e);
        }
      }
    };

    syncWithFirestore();
  }, [userState, initialLevel]);

  const LEVEL_REQUIREMENTS = {
    'Básico': 100,
    'Intermediário': 200,
    'Especialista': 100
  };

  const [currentModule, setCurrentModule] = useState<ModuleContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showReward, setShowReward] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [streak] = useState(7);
  
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchModule = async (index: number, level: 'Básico' | 'Intermediário' | 'Especialista') => {
    setLoading(true);
    try {
      const module = await generateReelsModule("Lei 14.133/2021", index, level);
      setCurrentModule(module);
    } catch (error) {
      console.error("Error fetching module:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModule(userState.currentModuleIndex, userState.currentLevel);
  }, [userState.currentModuleIndex, userState.currentLevel]);

  const handleScroll = () => {
    if (containerRef.current && currentModule) {
      const index = Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight);
      if (index !== userState.currentSlideIndex) {
        setUserState(prev => ({ ...prev, currentSlideIndex: index }));
      }
    }
  };

  const handleCompleteLesson = () => {
    setShowQuiz(true);
  };

  const handleQuizAnswer = (value: string) => {
    setSelectedOption(value);
    setQuizAnswered(true);
    
    if (value === 'correct') {
      setUserState(prev => {
        const newCorrectCount = { ...prev.correctQuizzesCount };
        newCorrectCount[prev.currentLevel] += 1;
        
        return { 
          ...prev, 
          points: prev.points + 100,
          quizCount: prev.quizCount + 1,
          correctQuizzesCount: newCorrectCount
        };
      });
      setShowReward(true);
      setTimeout(() => setShowReward(false), 2000);
    }
  };

  const handleNextModule = () => {
    setShowQuiz(false);
    setQuizAnswered(false);
    setSelectedOption(null);
    
    const currentCorrect = userState.correctQuizzesCount[userState.currentLevel];
    const required = LEVEL_REQUIREMENTS[userState.currentLevel];

    // Check for Level Up
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
      setUserState(prev => ({ ...prev, feedbackNeeded: true }));
    } else {
      setUserState(prev => ({ 
        ...prev, 
        currentModuleIndex: prev.currentModuleIndex + 1,
        currentSlideIndex: 0 
      }));
    }
  };

  const handleFeedback = (score: 'positivo' | 'neutro' | 'negativo') => {
    if (score === 'positivo') {
      setUserState(prev => ({ 
        ...prev, 
        feedbackNeeded: false,
        currentModuleIndex: prev.currentModuleIndex + 1,
        currentSlideIndex: 0
      }));
    } else if (score === 'neutro') {
      // Refazer conteúdo da próxima trilha (Gemini já adapta pelo prompt se soubermos o score, 
      // mas aqui vamos apenas avançar e o prompt de geração pode ser ajustado se passarmos o score)
      setUserState(prev => ({ 
        ...prev, 
        feedbackNeeded: false,
        currentModuleIndex: prev.currentModuleIndex + 1,
        currentSlideIndex: 0,
        lastFeedbackScore: 'neutro'
      }));
    } else {
      // Negativo: repetir a trilha (voltar 1 módulo ou reiniciar o atual)
      setUserState(prev => ({ 
        ...prev, 
        feedbackNeeded: false,
        currentModuleIndex: Math.max(0, prev.currentModuleIndex - 1),
        currentSlideIndex: 0,
        lastFeedbackScore: 'negativo'
      }));
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-slate-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <p className="text-blue-400 font-medium animate-pulse">ALICE está preparando sua trilha...</p>
      </div>
    );
  }

  if (userState.feedbackNeeded) {
    return (
      <div className="h-screen w-full bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center">
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
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden flex flex-col">
      {/* Header Gamificado */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={onBack} className="text-white/70 hover:text-white transition-colors">
          Voltar
        </button>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
            <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
            <span className="text-white font-bold text-sm">{streak} dias</span>
          </div>
          
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1">
              <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="text-white font-bold text-sm">{userState.points} XP</span>
            </div>
            <div className="text-[10px] text-white/50 font-bold uppercase mt-0.5">
              {userState.correctQuizzesCount[userState.currentLevel]} / {LEVEL_REQUIREMENTS[userState.currentLevel]} Quizzes
            </div>
            <div className="w-24 h-1 bg-white/20 rounded-full mt-1 overflow-hidden">
              <div 
                className="h-full bg-yellow-400 transition-all duration-500" 
                style={{ width: `${(userState.correctQuizzesCount[userState.currentLevel] / LEVEL_REQUIREMENTS[userState.currentLevel]) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

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
            <div className="absolute inset-0">
              <img 
                src={slide.imageUrl} 
                alt="Background" 
                className="w-full h-full object-cover opacity-40"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60"></div>
            </div>
            
            {/* Card Content */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex justify-between items-start mb-6">
                <span className="px-3 py-1 bg-blue-500/20 rounded-full text-[10px] font-bold text-blue-400 uppercase tracking-widest border border-blue-500/30">
                  {userState.currentLevel} • {index + 1}/3
                </span>
                <div className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
                  Lei 14.133/21
                </div>
              </div>

              <h2 className="text-2xl font-bold text-white mb-4 leading-tight">
                {currentModule.title}
              </h2>
              
              <p className="text-white/90 text-lg leading-relaxed mb-8">
                {slide.text}
              </p>

              {index === currentModule.slides.length - 1 && (
                <button 
                  onClick={handleCompleteLesson}
                  className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-500 active:scale-95 transition-all shadow-lg shadow-blue-900/20"
                >
                  <CheckCircle2 className="w-5 h-5" />
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
            className="absolute inset-0 z-[60] bg-slate-950 flex items-center justify-center p-6"
          >
            <div className="w-full max-w-md">
              <div className="mb-8 text-center">
                <div className="inline-block p-3 bg-blue-500/20 rounded-2xl mb-4">
                  <Zap className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Desafio Rápido</h3>
                <p className="text-gray-400 text-sm">Responda corretamente para ganhar +100 XP</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-6">
                <p className="text-white text-lg font-medium mb-6">{currentModule?.question}</p>
                
                <div className="space-y-3">
                  {currentModule?.options.map((option, i) => (
                    <button
                      key={i}
                      disabled={quizAnswered}
                      onClick={() => handleQuizAnswer(option.value)}
                      className={`w-full p-4 rounded-2xl text-left transition-all border ${
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
                  className={`p-4 rounded-2xl mb-6 flex gap-3 ${
                    selectedOption === 'correct' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {selectedOption === 'correct' ? <CheckCircle2 className="shrink-0" /> : <AlertCircle className="shrink-0" />}
                  <p className="text-sm">
                    {selectedOption === 'correct' ? currentModule?.feedbackCorrect : currentModule?.feedbackWrong}
                  </p>
                </motion.div>
              )}

              {quizAnswered && (
                <button 
                  onClick={handleNextModule}
                  className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-opacity-90 active:scale-95 transition-all"
                >
                  Próxima Lição
                </button>
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
    </div>
  );
};

export default MicrolearningFeed;
