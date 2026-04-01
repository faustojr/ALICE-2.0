
import React, { useState, createContext, useContext } from 'react';
import type { UserRole, AccessibilityState, FontSize } from './types';
import RoleSelector from './components/RoleSelector';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import MicrolearningFeed from './components/MicrolearningFeed';

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
  const [view, setView] = useState<'MAIN' | 'REELS' | 'CHAT' | 'LEVEL_SELECT'>('MAIN');
  const [selectedLevel, setSelectedLevel] = useState<'Básico' | 'Intermediário' | 'Especialista'>('Básico');
  const [resume, setResume] = useState(false);
  
  // Estado de Acessibilidade
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>('normal');
  const [screenReaderMode, setScreenReaderMode] = useState(false);

  const handleRoleSelect = (selectedRole: UserRole, shouldResume: boolean = false) => {
    setRole(selectedRole);
    setResume(shouldResume);
    if (selectedRole === 'ALUNO') {
      setView('LEVEL_SELECT');
    }
  };

  const handleLevelSelect = (level: 'Básico' | 'Intermediário' | 'Especialista') => {
    setSelectedLevel(level);
    setView('MAIN');
  };

  const handleBack = () => {
    if (view === 'LEVEL_SELECT') {
      setRole(null);
      setView('MAIN');
    } else if (view !== 'MAIN') {
      setView('MAIN');
    } else {
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
      return <MicrolearningFeed onBack={handleBack} initialLevel={selectedLevel} />;
    }

    if (view === 'CHAT') {
      return <ChatInterface onBack={handleBack} resume={resume} />;
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
            <svg className="w-24 h-24 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M10 15l5.19-3L10 9v6zM21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c0 1.1.9-2 2-2zM5 19V5h14v14H5z"/></svg>
          </div>
        </button>

        <button 
          onClick={() => setView('CHAT')}
          className="w-full group relative overflow-hidden bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-3xl shadow-xl hover:scale-[1.02] transition-all active:scale-95"
        >
          <div className="relative z-10 flex flex-col items-start text-left">
            <span className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2">Conversacional</span>
            <h2 className="text-2xl font-bold text-white mb-1">Chat com ALICE</h2>
            <p className="text-white/60 text-sm">Tire dúvidas e siga sua trilha personalizada</p>
          </div>
          <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-10 group-hover:opacity-20 transition-opacity">
            <svg className="w-24 h-24 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
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
