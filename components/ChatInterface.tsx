
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ModuleContent, UserState, ConversationStage, Option } from '../types';
import { generateReelsModule } from '../services/geminiService';
import { ArrowLeftIcon, SparklesIcon, MedalIcon, CheckCircleIcon, ExclamationCircleIcon, ChevronUpIcon, ChevronDownIcon } from './Icons';

const ChatInterface: React.FC<{ onBack: () => void; resume?: boolean }> = ({ onBack, resume }) => {
    const [userState, setUserState] = useState<UserState>(() => {
        const saved = localStorage.getItem('alice_reels_state');
        if (resume && saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Erro ao parsear estado salvo:", e);
            }
        }
        return {
            points: 0, level: 1, currentModuleIndex: 0, currentSlideIndex: 0, 
            completedQuizzes: [], badges: [],
            currentTrail: 'Lei 14.133', goal: 'Iniciante'
        };
    });

    const [moduleCache, setModuleCache] = useState<Record<number, ModuleContent>>({});
    const [stage, setStage] = useState<ConversationStage>('REELS_VIEW');
    const [quizResult, setQuizResult] = useState<'correct' | 'wrong' | null>(null);
    const [isPreloading, setIsPreloading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPointsModal, setShowPointsModal] = useState(false);
    const [tempEmail, setTempEmail] = useState('');
    const [tempName, setTempName] = useState('');
    const [loginStep, setLoginStep] = useState<'EMAIL' | 'NAME'>('EMAIL');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [averagePoints, setAveragePoints] = useState<number | null>(null);
    
    const touchStart = useRef<number | null>(null);
    const content = moduleCache[userState.currentModuleIndex];

    // Salva o estado no localStorage para persistência
    useEffect(() => {
        localStorage.setItem('alice_reels_state', JSON.stringify(userState));

        // Sincroniza com o servidor se tiver e-mail
        if (userState.email) {
            fetch('/api/users/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: userState.email,
                    name: userState.name,
                    points: userState.points,
                    level: userState.level,
                    currentTrail: userState.currentTrail,
                    area: 'Geral',
                    bestTopic: userState.currentTrail || 'N/A',
                    softSkillsLevel: userState.points >= 6000 ? 'Avançado' : 'Iniciante'
                })
            }).catch(err => console.error("Erro ao sincronizar:", err));
        }
    }, [userState.points, userState.level, userState.currentModuleIndex, userState.currentTrail, userState.goal, userState.email, userState.name]);

    useEffect(() => {
        if (showPointsModal) {
            fetch('/api/users/stats')
                .then(res => res.json())
                .then(data => setAveragePoints(data.averagePoints))
                .catch(err => console.error("Erro ao buscar stats:", err));
        }
    }, [showPointsModal]);

    /**
     * WORKER DE ANTECIPAÇÃO E RECUPERAÇÃO
     * Prioriza sempre o módulo ATUAL se ele não estiver no cache.
     */
    const fillCache = useCallback(async () => {
        if (isPreloading) return;
        
        const bufferSize = 2; // Quantos módulos manter à frente
        
        // Limpeza de cache para evitar consumo excessivo de memória em tempo de execução
        const currentIdx = userState.currentModuleIndex;
        const cacheKeys = Object.keys(moduleCache).map(Number);
        if (cacheKeys.length > 10) {
            const keysToRemove = cacheKeys.filter(k => k < currentIdx - 1 || k > currentIdx + 5);
            if (keysToRemove.length > 0) {
                setModuleCache(prev => {
                    const newCache = { ...prev };
                    keysToRemove.forEach(k => delete newCache[k]);
                    return newCache;
                });
                return; // Sai para processar a limpeza antes de carregar novos
            }
        }

        // Verifica do módulo atual até o buffer
        for (let i = 0; i <= bufferSize; i++) {
            const targetIdx = currentIdx + i;
            
            if (!moduleCache[targetIdx]) {
                setIsPreloading(true);
                setError(null);
                try {
                    const data = await generateReelsModule(
                        userState.currentTrail || 'Lei 14.133', 
                        targetIdx, 
                        userState.goal || 'Iniciante'
                    );
                    setModuleCache(prev => ({ ...prev, [targetIdx]: data }));
                } catch (e) {
                    console.error("Erro ao carregar conteúdo:", e);
                    if (i === 0) setError("Não foi possível carregar o conteúdo. Verifique sua conexão.");
                } finally {
                    setIsPreloading(false);
                }
                // Faz apenas uma requisição por ciclo para evitar rate-limit
                break; 
            }
        }
    }, [userState.currentModuleIndex, moduleCache, isPreloading, userState.currentTrail, userState.goal]);

    useEffect(() => {
        fillCache();
    }, [fillCache]);

    const handleSwipe = (direction: 'up' | 'down') => {
        if (!content || stage !== 'REELS_VIEW') return;

        if (direction === 'up') {
            if (userState.currentSlideIndex < content.slides.length - 1) {
                setUserState(prev => ({ ...prev, currentSlideIndex: prev.currentSlideIndex + 1 }));
            } else {
                setStage('QUIZ_VIEW');
            }
        } else if (direction === 'down' && userState.currentSlideIndex > 0) {
            setUserState(prev => ({ ...prev, currentSlideIndex: prev.currentSlideIndex - 1 }));
        }
    };

    const onTouchStart = (e: React.TouchEvent) => touchStart.current = e.touches[0].clientY;
    const onTouchEnd = (e: React.TouchEvent) => {
        if (!touchStart.current) return;
        const diff = touchStart.current - e.changedTouches[0].clientY;
        if (Math.abs(diff) > 50) handleSwipe(diff > 0 ? 'up' : 'down');
        touchStart.current = null;
    };

    const handleQuizAnswer = (opt: Option) => {
        const isCorrect = opt.value === 'correct';
        setQuizResult(isCorrect ? 'correct' : 'wrong');
        setStage('FEEDBACK_VIEW');
        if (isCorrect) {
            setUserState(prev => ({ ...prev, points: prev.points + 100 }));
        }
    };

    const nextModule = () => {
        setUserState(prev => ({ 
            ...prev, 
            currentModuleIndex: prev.currentModuleIndex + 1, 
            currentSlideIndex: 0 
        }));
        setStage('REELS_VIEW');
        setQuizResult(null);
    };

    const handleLogin = async () => {
        if (!tempEmail.trim()) return;
        setIsLoggingIn(true);
        try {
            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: tempEmail.trim().toLowerCase() })
            });
            const data = await response.json();
            
            if (data.found) {
                // Recupera progresso
                setUserState(prev => ({
                    ...prev,
                    ...data.user
                }));
            } else {
                // Novo usuário: Limpa progresso anterior se houver
                setUserState({
                    points: 0, level: 1, currentModuleIndex: 0, currentSlideIndex: 0, 
                    completedQuizzes: [], badges: [],
                    currentTrail: 'Lei 14.133', goal: 'Iniciante'
                });
                setLoginStep('NAME');
            }
        } catch (e) {
            console.error("Erro no login:", e);
            setLoginStep('NAME'); // Fallback para novo usuário se API falhar
        } finally {
            setIsLoggingIn(false);
        }
    };

    // 1. ESTADO DE ERRO (Evita tela preta se a API falhar no módulo atual)
    if (error && !content) {
        return (
            <div className="h-screen w-full bg-slate-900 flex flex-col items-center justify-center text-white p-8 text-center">
                <ExclamationCircleIcon className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-xl font-bold mb-2">Ops! Algo deu errado.</h2>
                <p className="text-slate-400 mb-8">{error}</p>
                <button 
                    onClick={() => { setError(null); fillCache(); }}
                    className="bg-blue-600 px-8 py-3 rounded-xl font-bold active:scale-95 transition-transform"
                >
                    Tentar Novamente
                </button>
            </div>
        );
    }

    // 2. ESTADO DE CARREGAMENTO (Aparece se o cache do módulo atual estiver vazio)
    if (!content) {
        return (
            <div className="h-screen w-full bg-slate-900 flex flex-col items-center justify-center text-white p-6 text-center">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                <h2 className="text-xl font-bold mb-2">Preparando Experiência...</h2>
                <p className="text-slate-400 animate-pulse">Aguarde enquanto a ALICE organiza seu próximo Reel de capacitação.</p>
            </div>
        );
    }

    // 3. RENDERIZAÇÃO PRINCIPAL
    return (
        <div 
            className="h-screen w-full max-w-md mx-auto relative overflow-hidden bg-black flex flex-col select-none shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            {/* Login / Identificação */}
            {!userState.email && (
                <div className="absolute inset-0 z-[200] bg-slate-900 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
                    <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20">
                        <MedalIcon className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-2">Bem-vindo à ALICE</h2>
                    
                    {loginStep === 'EMAIL' ? (
                        <>
                            <p className="text-slate-400 mb-8">Insira seu e-mail para acessar seu progresso ou começar uma nova jornada.</p>
                            <input 
                                type="email" 
                                value={tempEmail}
                                onChange={(e) => setTempEmail(e.target.value)}
                                placeholder="seu@email.com"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <button 
                                onClick={handleLogin}
                                disabled={!tempEmail.trim() || isLoggingIn}
                                className="w-full bg-blue-600 disabled:opacity-50 text-white font-black py-4 rounded-xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {isLoggingIn ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : 'Continuar'}
                            </button>
                        </>
                    ) : (
                        <>
                            <p className="text-slate-400 mb-8">Não encontramos registros para este e-mail. Como gostaria de ser chamado?</p>
                            <input 
                                type="text" 
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                placeholder="Seu nome completo"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <button 
                                onClick={() => {
                                    if (tempName.trim()) {
                                        setUserState(prev => ({ 
                                            ...prev, 
                                            email: tempEmail.trim().toLowerCase(),
                                            name: tempName.trim() 
                                        }));
                                    }
                                }}
                                disabled={!tempName.trim()}
                                className="w-full bg-blue-600 disabled:opacity-50 text-white font-black py-4 rounded-xl shadow-xl active:scale-95 transition-all"
                            >
                                Começar Jornada
                            </button>
                            <button 
                                onClick={() => setLoginStep('EMAIL')}
                                className="mt-4 text-slate-500 font-bold text-sm hover:text-slate-300"
                            >
                                Usar outro e-mail
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Header Overlay */}
            <div className="absolute top-0 left-0 right-0 z-50 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                <button onClick={onBack} className="p-2 bg-white/10 rounded-full backdrop-blur-md hover:bg-white/20 transition-colors">
                    <ArrowLeftIcon className="w-6 h-6 text-white" />
                </button>
                <div className="flex flex-col items-end">
                    <button 
                        onClick={() => setShowPointsModal(!showPointsModal)}
                        className="flex items-center gap-2 bg-blue-600/30 border border-blue-400/30 px-3 py-1 rounded-full backdrop-blur-md active:scale-95 transition-transform"
                    >
                        <SparklesIcon className="w-4 h-4 text-yellow-400" />
                        <span className="text-white font-black text-sm">{userState.points} PTS</span>
                    </button>
                    {isPreloading && (
                        <span className="text-[8px] text-blue-400 font-bold uppercase mt-1 tracking-widest animate-pulse bg-black/40 px-2 rounded">
                            Sincronizando...
                        </span>
                    )}
                </div>
            </div>

            {/* View: Reels */}
            {stage === 'REELS_VIEW' && (
                <div className="flex-1 relative animate-in fade-in duration-500">
                    <img 
                        src={content.slides[userState.currentSlideIndex].imageUrl} 
                        className="h-full w-full object-cover transition-opacity duration-700"
                        alt="Background"
                    />
                    <div className="absolute inset-0 bg-black/60"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                    
                    <div className="absolute bottom-24 left-0 right-0 p-8">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest shadow-lg">
                                Módulo {userState.currentModuleIndex + 1}
                            </span>
                        </div>
                        
                        <h2 className="text-3xl font-black text-white leading-[1.1] mb-6 drop-shadow-2xl">
                            {content.slides[userState.currentSlideIndex].text}
                        </h2>

                        <div className="flex gap-1.5 mb-8">
                            {content.slides.map((_, i) => (
                                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i === userState.currentSlideIndex ? 'bg-white scale-y-125' : 'bg-white/20'}`}></div>
                            ))}
                        </div>

                        <div className="flex gap-4">
                            {userState.currentSlideIndex > 0 && (
                                <button 
                                    onClick={() => handleSwipe('down')}
                                    className="flex-1 bg-white/10 backdrop-blur-md border border-white/10 py-4 rounded-2xl flex items-center justify-center gap-2 text-white font-bold active:scale-95 transition-all"
                                >
                                    <ChevronUpIcon className="w-5 h-5" />
                                    Voltar
                                </button>
                            )}
                            <button 
                                onClick={() => handleSwipe('up')}
                                className="flex-[2] bg-blue-600 py-4 rounded-2xl flex items-center justify-center gap-2 text-white font-black shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
                            >
                                {userState.currentSlideIndex === content.slides.length - 1 ? 'Fazer Quiz' : 'Próximo'}
                                <ChevronDownIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View: Quiz */}
            {stage === 'QUIZ_VIEW' && (
                <div className="flex-1 bg-slate-950 p-8 flex flex-col justify-center animate-in slide-in-from-bottom-24 duration-500">
                    <div className="mb-10 text-center">
                        <div className="inline-block p-4 bg-blue-600/20 rounded-full mb-6 border border-blue-500/30">
                            <MedalIcon className="w-10 h-10 text-blue-400" />
                        </div>
                        <h2 className="text-2xl font-black text-white leading-tight">
                            {content.question}
                        </h2>
                    </div>
                    <div className="space-y-4">
                        {content.options.map((opt, i) => (
                            <button 
                                key={i}
                                onClick={() => handleQuizAnswer(opt)}
                                className="w-full p-5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-lg hover:bg-blue-600 hover:border-blue-400 transition-all active:scale-95 text-left flex justify-between items-center"
                            >
                                <span>{opt.label}</span>
                                <div className="w-6 h-6 rounded-full border border-white/20"></div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* View: Feedback */}
            {stage === 'FEEDBACK_VIEW' && (
                <div className="flex-1 p-8 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-300 bg-slate-900">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-8 animate-bounce ${quizResult === 'correct' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                        {quizResult === 'correct' ? <CheckCircleIcon className="w-16 h-16" /> : <span className="text-5xl font-black">!</span>}
                    </div>
                    
                    <h2 className="text-4xl font-black text-white mb-4">
                        {quizResult === 'correct' ? 'Excelente!' : 'Ops!'}
                    </h2>
                    
                    <p className="text-slate-300 text-lg mb-12 leading-relaxed">
                        {quizResult === 'correct' ? content.feedbackCorrect : content.feedbackWrong}
                    </p>

                    <button 
                        onClick={quizResult === 'correct' ? nextModule : () => setStage('REELS_VIEW')}
                        className={`w-full py-5 rounded-2xl font-black text-xl shadow-2xl active:scale-95 transition-all ${quizResult === 'correct' ? 'bg-blue-600 text-white' : 'bg-white text-black'}`}
                    >
                        {quizResult === 'correct' ? 'Próximo Módulo' : 'Rever Aula'}
                    </button>
                    
                    {quizResult === 'correct' && (
                         <p className="mt-6 text-green-400 font-black text-sm uppercase tracking-widest tracking-widest">+100 PONTOS MERECIDOS</p>
                    )}
                </div>
            )}

            {/* Points Modal Overlay */}
            {showPointsModal && (
                <div 
                    className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center animate-in fade-in duration-300"
                    onClick={() => setShowPointsModal(false)}
                >
                    <div 
                        className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in slide-in-from-bottom-full duration-500"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex flex-col">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h2 className="text-sm font-black text-blue-500 uppercase tracking-[0.2em] mb-1">Seu Progresso</h2>
                                    <div className="text-4xl font-black text-white">{userState.points} <span className="text-lg text-slate-600 font-medium">PTS</span></div>
                                </div>
                                <div className="text-right">
                                    <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Média Geral</h2>
                                    <div className="text-xl font-black text-slate-300">{averagePoints !== null ? averagePoints : '...'} <span className="text-xs text-slate-600 font-medium">PTS</span></div>
                                </div>
                            </div>

                            <div className="space-y-8">
                                {/* Trail Progress */}
                                <div>
                                    <div className="flex justify-between items-end mb-3">
                                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Trilha Atual</h3>
                                        <span className="text-xs font-bold text-white">{userState.currentTrail || 'Lei 14.133'}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-blue-500 transition-all duration-1000 ease-out" 
                                            style={{ width: `${Math.min(100, (userState.currentModuleIndex / 10) * 100)}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between mt-2">
                                        <span className="text-[10px] text-slate-600 font-bold">Módulo {userState.currentModuleIndex + 1}</span>
                                        <span className="text-[10px] text-slate-600 font-bold">Objetivo: {userState.goal || 'Iniciante'}</span>
                                    </div>
                                </div>

                                {/* Levels */}
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { name: 'Iniciante', goal: 500, color: 'bg-blue-500' },
                                        { name: 'Interm.', goal: 6000, color: 'bg-yellow-500' },
                                        { name: 'Expert', goal: 12000, color: 'bg-purple-500' }
                                    ].map((lvl, i) => {
                                        const isReached = userState.points >= lvl.goal;
                                        return (
                                            <div key={i} className={`p-3 rounded-2xl border transition-all duration-300 ${isReached ? 'bg-white/5 border-white/10' : 'bg-transparent border-white/5 opacity-40'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full mb-2 ${lvl.color} ${isReached ? 'animate-pulse' : ''}`}></div>
                                                <div className="text-[10px] font-black text-white uppercase mb-0.5">{lvl.name}</div>
                                                <div className="text-[9px] text-slate-500 font-bold">{lvl.goal} pts</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => setShowPointsModal(false)}
                                className="mt-10 w-full py-4 bg-white text-black rounded-2xl font-black text-sm active:scale-95 transition-all shadow-xl"
                            >
                                CONTINUAR ESTUDOS
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatInterface;
