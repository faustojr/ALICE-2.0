import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup as baseSignInWithPopup, onAuthStateChanged as baseOnAuthStateChanged, signOut as baseSignOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, query, where, getDocs, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the specific database ID from config
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

// Initialize Auth
const baseAuth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive');
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://www.googleapis.com/auth/tasks');
googleProvider.addScope('https://www.googleapis.com/auth/calendar');

let cachedAccessToken: string | null = null;

export const getAccessToken = () => cachedAccessToken;
export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

let emulatedUser: any = null;

// Load emulated user from localStorage on init
try {
  const savedEmail = localStorage.getItem('alice_emulated_email');
  if (savedEmail) {
    emulatedUser = {
      uid: `emulated_${savedEmail.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`,
      email: savedEmail.toLowerCase(),
      displayName: savedEmail.split('@')[0],
      emailVerified: true
    };
  }
} catch (e) {
  console.error("Error loading emulated email:", e);
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
      emailVerified: true
    };
  } else {
    localStorage.removeItem('alice_emulated_email');
    emulatedUser = null;
  }
  // Notify observers
  authObservers.forEach(callback => callback(emulatedUser || baseAuth.currentUser));
};

export const getEmulatedUser = () => emulatedUser;

// Wrap auth in a Proxy to dynamically intercept 'currentUser'
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
  }
});

// Custom onAuthStateChanged to respect both emulated and base auth
export const onAuthStateChanged = (authInstance: any, callback: (user: any) => void) => {
  authObservers.add(callback);
  // Trigger callback immediately with the active state
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

export const signOut = async (authInstance: any) => {
  setEmulatedUser(null);
  setAccessToken(null);
  return baseSignOut(baseAuth);
};

export const signInWithPopup = async (authInstance: any, provider: any) => {
  const result = await baseSignInWithPopup(baseAuth, provider);
  if (result.user && result.user.email) {
    setEmulatedUser(result.user.email);
  }
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    setAccessToken(credential.accessToken);
  }
  return result;
};

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection successful");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.log("Firebase connection test: Offline mode or sandboxed iframe preview environment. Local simulation fallback enabled.");
    }
  }
}
testConnection();

