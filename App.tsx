
import React, { useState, createContext, useContext } from 'react';
import type { UserRole, AccessibilityState, FontSize } from './types';
import RoleSelector from './components/RoleSelector';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';

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
  const [resume, setResume] = useState(false);
  
  // Estado de Acessibilidade
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>('normal');
  const [screenReaderMode, setScreenReaderMode] = useState(false);

  const handleRoleSelect = (selectedRole: UserRole, shouldResume: boolean = false) => {
    setRole(selectedRole);
    setResume(shouldResume);
  };

  const handleBack = () => {
    setRole(null);
    setResume(false);
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
    switch (role) {
      case 'GESTOR':
        return <Dashboard onBack={handleBack} />;
      case 'ALUNO':
        return <ChatInterface onBack={handleBack} resume={resume} />;
      default:
        return <RoleSelector onSelectRole={handleRoleSelect} />;
    }
  };

  // Classes dinâmicas baseadas no estado de acessibilidade
  const getAppClasses = () => {
    let classes = "min-h-screen w-full flex items-center justify-center font-sans p-2 sm:p-4 transition-all duration-300 ";
    if (highContrast) {
      classes += "bg-black text-yellow-300";
    } else {
      classes += "bg-slate-900 text-gray-200";
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
