import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup as baseSignInWithPopup,
  onAuthStateChanged as baseOnAuthStateChanged,
  signOut as baseSignOut,
} from 'firebase/auth';


/**
 * Configuração via variáveis de ambiente (VITE_FIREBASE_*).
 *
 * Antes o config vinha de firebase-applet-config.json, arquivo que só existe
 * dentro do AI Studio e é bloqueado pelo .gitignore — o build quebrava em
 * qualquer outro ambiente. Variáveis de ambiente funcionam nos dois lugares
 * e são o que a Vercel espera.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    'Configuração do Firebase ausente. Defina VITE_FIREBASE_API_KEY, ' +
      'VITE_FIREBASE_PROJECT_ID e demais VITE_FIREBASE_* no .env.local ' +
      '(ou nas Environment Variables da Vercel).'
  );
}

const app = initializeApp(firebaseConfig);

// O cliente não fala mais com o Firestore: as regras negam acesso do browser
// e todo dado passa pelas rotas em /api. Só o Auth continua aqui — o que
// também tira o SDK do Firestore do bundle.
const baseAuth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Escopos mínimos. Drive/Sheets/Tasks/Calendar eram pedidos no login e
// assustam um servidor público sem entregar nada ao produto hoje — pedir
// só o necessário aumenta a taxa de conclusão do login.
googleProvider.setCustomParameters({ prompt: 'select_account' });

let cachedAccessToken: string | null = null;
export const getAccessToken = () => cachedAccessToken;
export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

/**
 * Identidade "emulada" do piloto: o servidor digita o e-mail e entra sem
 * senha (authMode OPEN_PILOT).
 *
 * ATENÇÃO: esta identidade NÃO é verificada. Ela serve para atribuir
 * progresso, jamais para autorizar acesso a dados de terceiros. As regras do
 * Firestore não confiam nela e as rotas administrativas exigem login Google.
 */
let emulatedUser: any = null;

try {
  const savedEmail = localStorage.getItem('alice_emulated_email');
  if (savedEmail) {
    emulatedUser = {
      uid: `emulated_${savedEmail.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`,
      email: savedEmail.toLowerCase(),
      displayName: savedEmail.split('@')[0],
      emailVerified: false,
      isEmulated: true,
    };
  }
} catch (e) {
  console.error('Erro ao carregar e-mail emulado:', e);
}

const authObservers = new Set<(user: any) => void>();

export const setEmulatedUser = (email: string | null) => {
  if (email) {
    const emailLower = email.trim().toLowerCase();
    localStorage.setItem('alice_emulated_email', emailLower);
    emulatedUser = {
      uid: `emulated_${emailLower.replace(/[^a-zA-Z0-9]/g, '_')}`,
      email: emailLower,
      displayName: emailLower.split('@')[0],
      emailVerified: false,
      isEmulated: true,
    };
  } else {
    localStorage.removeItem('alice_emulated_email');
    emulatedUser = null;
  }
  authObservers.forEach((callback) => callback(emulatedUser || baseAuth.currentUser));
};

export const getEmulatedUser = () => emulatedUser;

/** true quando a sessão veio de um provedor verificado (Google), não do piloto. */
export const isVerifiedSession = () =>
  Boolean(baseAuth.currentUser && !emulatedUser?.isEmulated);

/**
 * ID token do Firebase para chamar rotas administrativas.
 * Retorna null numa sessão emulada — que por definição não tem token.
 */
export async function getIdToken(): Promise<string | null> {
  const user = baseAuth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch (err) {
    console.error('Erro ao obter ID token:', err);
    return null;
  }
}

export const auth = new Proxy(baseAuth, {
  get(target, prop) {
    if (prop === 'currentUser') {
      return emulatedUser || target.currentUser;
    }
    const value = (target as any)[prop];
    if (typeof value === 'function') {
      return value.bind(target);
    }
    return value;
  },
});

export const onAuthStateChanged = (authInstance: any, callback: (user: any) => void) => {
  authObservers.add(callback);
  callback(emulatedUser || baseAuth.currentUser);

  const unsub = baseOnAuthStateChanged(baseAuth, (user) => {
    if (!emulatedUser) {
      callback(user);
    }
  });

  return () => {
    authObservers.delete(callback);
    unsub();
  };
};

export const signOut = async (_authInstance?: any) => {
  setEmulatedUser(null);
  setAccessToken(null);
  return baseSignOut(baseAuth);
};

export const signInWithPopup = async (_authInstance: any, provider: any) => {
  const result = await baseSignInWithPopup(baseAuth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    setAccessToken(credential.accessToken);
  }
  // Sessão Google é verificada; não sobrescreve com identidade emulada.
  setEmulatedUser(null);
  return result;
};

