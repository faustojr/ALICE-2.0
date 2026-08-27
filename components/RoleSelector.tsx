
import React, { useEffect, useState } from 'react';
import type { UserRole, UserState } from '../types';
import { AdminIcon, UserIcon, BrainIcon, CheckCircleIcon, SparklesIcon, TrashIcon, XMarkIcon, ExclamationCircleIcon } from './Icons';
import { useAccessibility } from '../App';
import { auth, googleProvider, signInWithPopup, onAuthStateChanged, signOut, db, setEmulatedUser } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface RoleSelectorProps {
  onSelectRole: (role: UserRole, resume?: boolean, savedLevel?: 'Básico' | 'Intermediário' | 'Especialista') => void;
}

const RoleSelector: React.FC<RoleSelectorProps> = ({ onSelectRole }) => {
  const { highContrast } = useAccessibility();
  const [savedUser, setSavedUser] = useState<UserState | null>(null);
  const [showNewLogin, setShowNewLogin] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [isFetchingUser, setIsFetchingUser] = useState(false);
  const [showUnderConstruction, setShowUnderConstruction] = useState<string | null>(null);
  const [showLoginRequired, setShowLoginRequired] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [typedEmail, setTypedEmail] = useState('');
  const [loginStep, setLoginStep] = useState<'input' | 'confirm' | 'db_check'>('input');
  const [isCheckingDb, setIsCheckingDb] = useState(false);
  const [dbEmailFound, setDbEmailFound] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsFetchingUser(true);
        setCurrentUser(user);
        // Tenta buscar do Firestore
        try {
          const emailKey = user.email!.toLowerCase();
          const userDoc = await getDoc(doc(db, 'users', emailKey));
          if (userDoc.exists()) {
            setSavedUser(userDoc.data() as UserState);
          } else {
            // Fallback para localStorage apenas se pertencer ao próprio e-mail
            const savedV3 = localStorage.getItem(`alice_progress_v3_${emailKey}`);
            if (savedV3) {
              setSavedUser(JSON.parse(savedV3));
            } else {
              setSavedUser(null);
            }
          }
        } catch (e) {
          const isOffline = e instanceof Error && e.message.toLowerCase().includes('offline');
          if (isOffline) {
            console.log("Firestore está offline ao buscar usuário. Usando cache local do localStorage.");
            // Fallback para localStorage para manter offline funcional
            const emailKey = user.email!.toLowerCase();
            const savedV3 = localStorage.getItem(`alice_progress_v3_${emailKey}`);
            if (savedV3) {
              setSavedUser(JSON.parse(savedV3));
            } else {
              setSavedUser(null);
            }
          } else {
            console.error("Erro ao buscar usuário do Firestore:", e);
          }
        } finally {
          setIsFetchingUser(false);
        }
      } else {
        setCurrentUser(null);
        setSavedUser(null);
        setIsFetchingUser(false);
      }
      setIsAuthenticating(false);
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Erro no login Google:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  const handleClearData = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Isso apagará seu progresso salvo. Deseja continuar?")) {
        localStorage.removeItem('alice_progress_v2');
        localStorage.removeItem('alice_progress_v3');
        const email = currentUser?.email;
        if (email) {
          localStorage.removeItem(`alice_progress_v3_${email.toLowerCase()}`);
        }
        await signOut(auth);
        setSavedUser(null);
        setTypedEmail('');
        setLoginStep('input');
        setShowNewLogin(true);
    }
  };

  const validateEmail = (emailStr: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(emailStr.trim());
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const trimmed = typedEmail.trim();
    if (!trimmed) {
      setErrorMsg('Por favor, informe seu e-mail.');
      return;
    }
    if (!validateEmail(trimmed)) {
      setErrorMsg('Por favor, insira um e-mail válido.');
      return;
    }
    setLoginStep('confirm');
  };

  const handleConfirmEmail = async () => {
    setIsCheckingDb(true);
    setErrorMsg('');
    const emailLower = typedEmail.trim().toLowerCase();
    try {
      // Set the emulated user directly to initiate authentication and fetch progress
      setEmulatedUser(emailLower);
      
      // Save/upsert user record in Firestore so Manager Dashboard tracks the user immediately
      await setDoc(doc(db, 'users', emailLower), {
        email: emailLower,
        name: emailLower.split('@')[0],
        status: 'ativo',
        pilotStatus: 'ativo',
        lastAccess: new Date().toISOString()
      }, { merge: true });

      setShowNewLogin(false);
    } catch (err: any) {
      console.error("Erro ao verificar/salvar e-mail no Firestore:", err);
      // Fallback: log in anyway
      setEmulatedUser(emailLower);
      setShowNewLogin(false);
    } finally {
      setIsCheckingDb(false);
    }
  };

  const handleUseConfirmedEmail = async () => {
    const emailLower = typedEmail.trim().toLowerCase();
    setEmulatedUser(emailLower);
    try {
      await setDoc(doc(db, 'users', emailLower), {
        email: emailLower,
        name: emailLower.split('@')[0],
        status: 'ativo',
        pilotStatus: 'ativo',
        lastAccess: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Erro ao salvar dados do e-mail no Firestore:", err);
    }
  };

  const handleCancelDbCheck = () => {
    setLoginStep('input');
    setDbEmailFound(false);
  };

  const GoogleLogo = () => (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );

  const UnderConstructionModal = () => (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
        <div className={`max-w-sm w-full p-8 rounded-3xl border-2 text-center shadow-2xl transform animate-in zoom-in duration-300 ${highContrast ? 'bg-black border-yellow-400 text-yellow-300' : 'bg-slate-800 border-slate-700 text-white'}`}>
            <div className="mb-6 flex justify-center">
                <div className={`p-5 rounded-full ${highContrast ? 'bg-yellow-400 text-black' : 'bg-blue-500/20 text-blue-400'}`}>
                    <ExclamationCircleIcon className="w-14 h-14" />
                </div>
            </div>
            <h2 className="text-2xl font-bold mb-4">Acesso em Construção 🚧</h2>
            <p className={`mb-8 leading-relaxed ${highContrast ? 'text-white' : 'text-slate-300'}`}>
                O login via <strong>{showUnderConstruction}</strong> ainda não está ativo para este município.
            </p>
            <div className={`p-4 rounded-xl mb-8 border-l-4 ${highContrast ? 'bg-yellow-400/10 border-yellow-400' : 'bg-blue-600/10 border-blue-500'}`}>
                <p className="font-bold text-sm">Use o botão principal abaixo para acessar agora!</p>
            </div>
            <button 
                onClick={() => setShowUnderConstruction(null)}
                className={`w-full py-4 rounded-2xl font-extrabold text-xl transition-all active:scale-95 ${highContrast ? 'bg-yellow-400 text-black border-2 border-white' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30'}`}
            >
                Vou usar Começar Agora
            </button>
        </div>
    </div>
  );

  const LoginRequiredModal = () => (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
        <div className={`max-w-sm w-full p-8 rounded-3xl border-2 text-center shadow-2xl transform animate-in zoom-in duration-300 ${highContrast ? 'bg-black border-yellow-400 text-yellow-300' : 'bg-slate-800 border-slate-700 text-white'}`}>
            <div className="mb-6 flex justify-center">
                <div className={`p-5 rounded-full ${highContrast ? 'bg-yellow-400 text-black' : 'bg-blue-500/20 text-blue-400'}`}>
                    <AdminIcon className="w-14 h-14" />
                </div>
            </div>
            <h2 className="text-2xl font-bold mb-4">Acesso Restrito</h2>
            <p className={`mb-8 leading-relaxed ${highContrast ? 'text-white' : 'text-slate-300'}`}>
                Para acessar o <strong>Painel do Gestor</strong>, você precisa primeiro se identificar com seu e-mail na tela inicial.
            </p>
            <div className="space-y-4">
                <button 
                    onClick={() => setShowLoginRequired(false)}
                    className={`w-full py-4 rounded-2xl font-extrabold text-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${highContrast ? 'bg-yellow-400 text-black border-2 border-white' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30'}`}
                >
                    Se identificar agora
                </button>
            </div>
        </div>
    </div>
  );

  if (isAuthenticating || isFetchingUser) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="relative w-24 h-24 mb-6">
                <div className={`absolute inset-0 border-4 rounded-full border-t-transparent animate-spin ${highContrast ? 'border-yellow-400' : 'border-blue-500'}`}></div>
            </div>
            <h1 className="text-4xl font-black text-white tracking-widest animate-pulse">ALICE</h1>
        </div>
      );
  }

  if (savedUser && !showNewLogin) {
      const displayName = savedUser.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Servidor';
      return (
        <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
            {showUnderConstruction && <UnderConstructionModal />}
            <div className="mb-8 relative">
                <div className={`mx-auto w-28 h-28 rounded-full flex items-center justify-center mb-6 shadow-2xl border-4 ${highContrast ? 'bg-yellow-400 border-white' : 'bg-gradient-to-br from-blue-500 to-indigo-600 border-slate-700'}`}>
                    <span className={`text-5xl font-black ${highContrast ? 'text-black' : 'text-white'}`}>
                        {displayName.charAt(0).toUpperCase()}
                    </span>
                </div>
                <h1 className="text-4xl font-extrabold text-white mb-2">Olá, {displayName}!</h1>
                <p className="text-slate-400 text-lg">Seu progresso está salvo. Vamos continuar?</p>
            </div>

            <button 
                onClick={() => onSelectRole('ALUNO', true, savedUser.currentLevel)}
                className={`w-full py-5 rounded-2xl font-black text-2xl shadow-2xl transition-all active:scale-95 hover:scale-[1.02] ${highContrast ? 'bg-yellow-400 text-black' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
                id="btn-resume-journey"
            >
                Continuar Jornada
            </button>

            <button onClick={() => setShowNewLogin(true)} className="mt-8 text-slate-500 hover:text-white text-sm font-medium transition-colors">
                Não é você? Clique aqui para trocar de conta
            </button>
        </div>
      );
  }

  if (currentUser && !savedUser && !showNewLogin) {
      return (
        <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
            <div className="mb-8">
               <h2 className="text-3xl font-black text-white mb-4">Confirmação de Identidade</h2>
               <div className="p-6 bg-white/5 border border-white/10 rounded-3xl text-left mb-6">
                   <p className="text-slate-400 text-sm mb-1">Nome identificado:</p>
                   <p className="text-white text-xl font-bold mb-4">{currentUser.displayName}</p>
                   <p className="text-slate-400 text-sm mb-1">E-mail institucional/pessoal:</p>
                   <p className="text-white text-lg font-medium">{currentUser.email}</p>
               </div>
               <p className="text-slate-300 text-lg">Podemos confirmar que é você mesmo?</p>
            </div>
            <div className="w-full space-y-4">
                <button 
                    onClick={() => onSelectRole('ALUNO', false)}
                    className={`w-full font-black py-4 px-6 rounded-2xl text-xl transition-all active:scale-95 shadow-2xl ${highContrast ? 'bg-yellow-400 text-black border-2 border-white' : 'bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white shadow-blue-500/20'}`}
                >
                    ✓ Sim, sou eu! Começar
                </button>
                <button 
                    onClick={handleLogout}
                    className="w-full py-4 text-slate-400 hover:text-white font-bold transition-colors"
                >
                    Não, quero entrar com outra conta
                </button>
            </div>
        </div>
      );
  }

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center p-4 text-center animate-in slide-in-from-bottom-8 duration-700">
      {showUnderConstruction && <UnderConstructionModal />}
      {showLoginRequired && <LoginRequiredModal />}
      
      <div className="mb-14">
        <h1 className="text-6xl font-black text-white mb-4 tracking-tighter">Olá!</h1>
        <p className="text-xl text-slate-400 font-medium">Capacitação Inteligente para Servidores</p>
      </div>

      <div className="w-full space-y-5">
        <div className={`p-4 rounded-2xl mb-6 text-left border ${
          highContrast ? 'border-yellow-400 bg-black' : 'bg-blue-900/20 border-blue-500/30'
        }`}>
            <p className={`text-sm leading-relaxed ${highContrast ? 'text-yellow-300' : 'text-blue-200'}`}>
                <strong className="text-white">Identificação:</strong> Por favor, informe seu e-mail institucional ou pessoal para iniciar e registrar seu progresso e resultados de aprendizagem no piloto.
            </p>
        </div>

        {loginStep === 'input' && (
          <form onSubmit={handleSendEmail} className="space-y-4">
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Insira seu e-mail para entrar"
                value={typedEmail}
                onChange={(e) => setTypedEmail(e.target.value)}
                className={`flex-1 px-4 py-4 rounded-2xl bg-white/5 border text-base text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium ${
                  highContrast ? 'border-yellow-400 bg-black text-yellow-300 placeholder:text-yellow-300/50' : 'border-white/10 placeholder:text-slate-500'
                }`}
              />
              <button
                type="submit"
                className={`px-6 py-4 rounded-2xl font-bold flex items-center justify-center transition-all duration-200 active:scale-95 shadow-lg whitespace-nowrap ${
                  highContrast
                    ? 'bg-yellow-400 text-black border border-white hover:bg-yellow-300'
                    : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/30'
                }`}
              >
                Enviar
              </button>
            </div>
            {errorMsg && (
              <p className={`text-sm font-semibold text-left ${highContrast ? 'text-yellow-400' : 'text-red-400'}`}>
                {errorMsg}
              </p>
            )}
          </form>
        )}

        {loginStep === 'confirm' && (
          <div className={`p-6 border rounded-3xl text-center space-y-4 ${
            highContrast ? 'border-yellow-400 bg-black' : 'bg-white/5 border-white/10'
          }`}>
            <h3 className="text-lg font-bold text-white">Confirme o seu e-mail</h3>
            <p className="text-slate-400 text-sm">Este e-mail está correto?</p>
            <div className={`py-3 px-4 rounded-xl font-bold text-lg inline-block break-all ${
              highContrast ? 'border border-yellow-400 text-yellow-300' : 'bg-white/5 text-blue-400 border border-blue-500/20'
            }`}>
              {typedEmail}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleConfirmEmail}
                disabled={isCheckingDb}
                className={`flex-1 py-3.5 rounded-xl font-bold transition-all active:scale-95 ${
                  highContrast
                    ? 'bg-yellow-400 text-black'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {isCheckingDb ? 'Verificando...' : 'Confirmar e-mail'}
              </button>
              <button
                onClick={() => setLoginStep('input')}
                disabled={isCheckingDb}
                className={`flex-1 py-3.5 rounded-xl font-semibold transition-all active:scale-95 ${
                  highContrast
                    ? 'border-2 border-yellow-400 bg-black text-yellow-300'
                    : 'bg-white/10 text-white hover:bg-white/15'
                }`}
              >
                Editar
              </button>
            </div>
          </div>
        )}

        {loginStep === 'db_check' && (
          <div className={`p-6 border rounded-3xl text-center space-y-4 ${
            highContrast ? 'border-yellow-400 bg-black' : 'bg-white/5 border-white/10'
          }`}>
            <div className="w-12 h-12 bg-green-500/15 rounded-full flex items-center justify-center mx-auto">
              <CheckCircleIcon className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Cadastro Encontrado!</h3>
            <p className="text-slate-400 text-sm leading-relaxed text-balance">
              Identificamos um progresso salvo para o e-mail <strong className="text-white">{typedEmail}</strong> no banco de dados da prefeitura.
            </p>
            <p className="text-slate-300 font-medium text-sm">Confirmar e usar este e-mail?</p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleUseConfirmedEmail}
                className={`w-full py-3.5 rounded-xl font-bold transition-all active:scale-95 ${
                  highContrast
                    ? 'bg-yellow-400 text-black'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                Sim, usar este e-mail
              </button>
              <button
                onClick={handleCancelDbCheck}
                className={`w-full py-3.5 rounded-xl font-semibold transition-all active:scale-95 ${
                  highContrast
                    ? 'border-2 border-yellow-400 bg-black text-yellow-300'
                    : 'bg-white/10 text-white hover:bg-white/15'
                }`}
              >
                Não, usar outro e-mail
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-16 flex justify-between w-full text-xs font-bold text-slate-600 border-t border-slate-800 pt-8">
        <button 
            onClick={() => onSelectRole('GESTOR')} 
            className="hover:text-blue-400 uppercase tracking-widest"
        >
            Área do Gestor
        </button>
        {savedUser && <button onClick={handleClearData} className="hover:text-red-500 uppercase tracking-widest">Limpar Dados</button>}
      </div>
    </div>
  );
};

export default RoleSelector;
