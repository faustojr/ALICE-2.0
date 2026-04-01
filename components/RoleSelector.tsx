
import React, { useEffect, useState } from 'react';
import type { UserRole, UserState } from '../types';
import { AdminIcon, UserIcon, BrainIcon, CheckCircleIcon, SparklesIcon, TrashIcon, XMarkIcon, ExclamationCircleIcon } from './Icons';
import { useAccessibility } from '../App';
import { auth, googleProvider, signInWithPopup, onAuthStateChanged, signOut, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

interface RoleSelectorProps {
  onSelectRole: (role: UserRole, resume?: boolean) => void;
}

const RoleSelector: React.FC<RoleSelectorProps> = ({ onSelectRole }) => {
  const { highContrast } = useAccessibility();
  const [savedUser, setSavedUser] = useState<UserState | null>(null);
  const [showNewLogin, setShowNewLogin] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [showUnderConstruction, setShowUnderConstruction] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        // Tenta buscar do Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', user.email!.toLowerCase()));
          if (userDoc.exists()) {
            setSavedUser(userDoc.data() as UserState);
          } else {
            // Fallback para localStorage se não houver no Firestore
            const savedV2 = localStorage.getItem('alice_progress_v2');
            if (savedV2) {
              setSavedUser(JSON.parse(savedV2));
            }
          }
        } catch (e) {
          console.error("Erro ao buscar usuário do Firestore:", e);
        }
      } else {
        setCurrentUser(null);
        setSavedUser(null);
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
        await signOut(auth);
        setSavedUser(null);
        setShowNewLogin(true);
    }
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

  if (isAuthenticating) {
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
      return (
        <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
            {showUnderConstruction && <UnderConstructionModal />}
            <div className="mb-8 relative">
                <div className={`mx-auto w-28 h-28 rounded-full flex items-center justify-center mb-6 shadow-2xl border-4 ${highContrast ? 'bg-yellow-400 border-white' : 'bg-gradient-to-br from-blue-500 to-indigo-600 border-slate-700'}`}>
                    <span className={`text-5xl font-black ${highContrast ? 'text-black' : 'text-white'}`}>
                        {savedUser.name?.charAt(0).toUpperCase()}
                    </span>
                </div>
                <h1 className="text-4xl font-extrabold text-white mb-2">Olá, {savedUser.name}!</h1>
                <p className="text-slate-400 text-lg">Seu progresso está salvo. Vamos continuar?</p>
            </div>

            <button 
                onClick={() => onSelectRole('ALUNO', true)}
                className={`w-full py-5 rounded-2xl font-black text-2xl shadow-2xl transition-all active:scale-95 hover:scale-[1.02] ${highContrast ? 'bg-yellow-400 text-black' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
            >
                Continuar Jornada
            </button>

            <button onClick={() => setShowNewLogin(true)} className="mt-8 text-slate-500 hover:text-white text-sm font-medium transition-colors">
                Não é você? Clique aqui para trocar de conta
            </button>
        </div>
      );
  }

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center p-4 text-center animate-in slide-in-from-bottom-8 duration-700">
      {showUnderConstruction && <UnderConstructionModal />}
      
      <div className="mb-14">
        <h1 className="text-6xl font-black text-white mb-4 tracking-tighter">ALICE</h1>
        <p className="text-xl text-slate-400 font-medium">Capacitação Inteligente para Servidores</p>
      </div>

      <div className="w-full space-y-5">
        <button onClick={handleGoogleLogin} className="w-full bg-white text-gray-800 font-bold py-4 px-6 rounded-2xl flex items-center justify-center shadow-xl active:scale-95 transition-all">
          <GoogleLogo /> {currentUser ? `Logado como ${currentUser.displayName}` : 'Continuar com Google'}
        </button>

        <button onClick={() => setShowUnderConstruction('Gov.br')} className="w-full bg-[#1351B4] text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center shadow-xl active:scale-95 transition-all">
           <div className="w-6 h-6 mr-2 bg-white rounded-full flex items-center justify-center text-[#1351B4] font-black text-[10px]">br</div>
           Entrar com Gov.br (Inativo)
        </button>

        <div className="flex items-center gap-4 py-4">
            <div className="h-px bg-slate-800 flex-1"></div>
            <span className="text-slate-600 text-xs font-black uppercase tracking-widest">OU</span>
            <div className="h-px bg-slate-800 flex-1"></div>
        </div>

        <button
          onClick={() => onSelectRole('ALUNO', false)}
          className={`w-full font-black py-5 px-6 rounded-2xl text-2xl transition-all hover:scale-[1.03] active:scale-95 shadow-2xl ${highContrast ? 'bg-yellow-400 text-black border-2 border-white' : 'bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white shadow-blue-500/20'}`}
        >
          Começar Agora
        </button>
      </div>

      <div className="mt-16 flex justify-between w-full text-xs font-bold text-slate-600 border-t border-slate-800 pt-8">
        <button onClick={() => onSelectRole('GESTOR')} className="hover:text-blue-400 uppercase tracking-widest">Área do Gestor</button>
        {savedUser && <button onClick={handleClearData} className="hover:text-red-500 uppercase tracking-widest">Limpar Dados</button>}
      </div>
    </div>
  );
};

export default RoleSelector;
