/**
 * Firebase Admin SDK — acesso privilegiado ao Firestore a partir do servidor.
 *
 * As regras de segurança do Firestore fecham o banco para o cliente; toda
 * escrita passa por aqui, onde é possível validar tenant, papel e cota.
 *
 * Credencial esperada em FIREBASE_SERVICE_ACCOUNT (JSON da service account,
 * em uma linha). Na Vercel, cadastre como Environment Variable — nunca
 * versione o arquivo.
 */

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let cachedDb: Firestore | null = null;

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT não configurada. Gere uma service account em ' +
        'Firebase Console → Configurações → Contas de serviço e cadastre o JSON ' +
        'como variável de ambiente.'
    );
  }

  try {
    // Aceita tanto JSON puro quanto base64 (útil em CI que não lida bem com aspas).
    const decoded = raw.trim().startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (err) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT não é um JSON válido (nem JSON puro nem base64).'
    );
  }
}

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const serviceAccount = loadServiceAccount();
  return initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

/** Firestore administrativo. Reutiliza a conexão entre invocações warm. */
export function getDb(): Firestore {
  if (cachedDb) return cachedDb;

  const app = getAdminApp();
  const databaseId = process.env.FIRESTORE_DATABASE_ID;

  // O projeto usa um database nomeado; o SDK aceita o id como segundo argumento.
  cachedDb = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  cachedDb.settings({ ignoreUndefinedProperties: true });
  return cachedDb;
}

/** Normaliza e-mail para uso como chave de documento. */
export function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

export const COLLECTIONS = {
  tenants: 'tenants',
  memberships: 'memberships',
  users: 'users',
  surveys: 'pilotSurveys',
  trails: 'trails',
  aiUsage: 'aiUsage',
  leads: 'leads',
} as const;
