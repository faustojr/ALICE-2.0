import React, { useState, createContext, useContext, useEffect, lazy, Suspense } from 'react';
import type { AccessibilityState, FontSize } from './types';

/**
 * Raiz da aplicação: roteamento e acessibilidade, nada mais.
 *
 * Cada rota é um chunk separado. Isso importa porque um visitante da landing
 * não deve baixar o SDK do Firebase nem o feed de microaprendizagem — a
 * página comercial é o topo do funil e precisa abrir rápido em rede ruim.
 *
 *   aprendacomalice.com  → landing pública
 *   appalice.cloud       → aplicativo do servidor municipal
 *   /admin               → console da equipe ALICE (qualquer host)
 */
const StudentApp = lazy(() => import('./components/StudentApp'));
const AdminConsole = lazy(() => import('./components/AdminConsole'));
const LandingPage = lazy(() => import('./components/LandingPage'));

const APP_URL = 'https://appalice.cloud';
const LANDING_HOSTS = ['aprendacomalice.com', 'www.aprendacomalice.com'];

type Route = 'LANDING' | 'APP' | 'ADMIN';

function resolveRoute(): Route {
  if (typeof window === 'undefined') return 'APP';

  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === '/admin') return 'ADMIN';
  if (path === '/app') return 'APP';

  return LANDING_HOSTS.includes(window.location.hostname) ? 'LANDING' : 'APP';
}

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

const RouteFallback: React.FC = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

const App: React.FC = () => {
  const [route, setRoute] = useState<Route>(resolveRoute);

  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>('normal');
  const [screenReaderMode, setScreenReaderMode] = useState(false);

  // Botão voltar do navegador entre landing, app e console.
  useEffect(() => {
    const onPopState = () => setRoute(resolveRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setRoute(resolveRoute());
  };

  const accessibilityValues: AccessibilityState = {
    highContrast,
    fontSize,
    screenReaderMode,
    toggleHighContrast: () => setHighContrast((prev) => !prev),
    setFontSize: (size) => setFontSize(size),
    toggleScreenReaderMode: () => setScreenReaderMode((prev) => !prev),
  };

  const content =
    route === 'ADMIN' ? (
      <AdminConsole onBack={() => navigate('/')} />
    ) : route === 'LANDING' ? (
      <LandingPage appUrl={APP_URL} />
    ) : (
      <StudentApp />
    );

  return (
    <AccessibilityContext.Provider value={accessibilityValues}>
      <Suspense fallback={<RouteFallback />}>{content}</Suspense>
    </AccessibilityContext.Provider>
  );
};

export default App;
