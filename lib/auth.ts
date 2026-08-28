/**
 * Autorização das rotas /api.
 *
 * Dois níveis, deliberadamente diferentes:
 *
 * 1. Rotas do aluno — no modo OPEN_PILOT o e-mail não é verificado. Elas
 *    aceitam o e-mail informado, mas tratam como *não confiável*: servem
 *    apenas para atribuir progresso, nunca para conceder privilégio.
 *
 * 2. Rotas administrativas — exigem identidade verificada. Um ID token do
 *    Firebase (login Google) validado pelo Admin SDK, com o e-mail presente
 *    na allowlist SUPER_ADMIN_EMAILS. Sem token, sem acesso.
 */

import { getAuth } from 'firebase-admin/auth';
import { getApps } from 'firebase-admin/app';
import { getDb, COLLECTIONS, emailKey } from './firebaseAdmin.js';
import type { Role, Session } from '../types.js';

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

function superAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function bearerToken(authorization?: string): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

/**
 * Identidade verificada a partir do ID token do Firebase.
 * Lança AuthError se o token estiver ausente, expirado ou inválido.
 */
export async function requireVerifiedIdentity(
  authorization?: string
): Promise<{ email: string; uid: string; name: string }> {
  const token = bearerToken(authorization);
  if (!token) {
    throw new AuthError('Token de autenticação ausente.');
  }

  // Garante que o app admin foi inicializado antes de usar getAuth().
  if (getApps().length === 0) getDb();

  try {
    const decoded = await getAuth().verifyIdToken(token);
    if (!decoded.email) {
      throw new AuthError('Token sem e-mail associado.');
    }
    return {
      email: decoded.email.toLowerCase(),
      uid: decoded.uid,
      name: decoded.name || decoded.email.split('@')[0],
    };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError('Token de autenticação inválido ou expirado.');
  }
}

/**
 * Exige que o chamador seja SUPER_ADMIN — identidade verificada por Google
 * E presente na allowlist. Usada pelo console de administração da startup.
 */
export async function requireSuperAdmin(authorization?: string): Promise<Session> {
  const identity = await requireVerifiedIdentity(authorization);
  const allowlist = superAdminEmails();

  if (allowlist.length === 0) {
    throw new AuthError(
      'SUPER_ADMIN_EMAILS não configurada — console administrativo indisponível.',
      503
    );
  }

  if (!allowlist.includes(identity.email)) {
    throw new AuthError('Acesso restrito à equipe ALICE.', 403);
  }

  return {
    email: identity.email,
    displayName: identity.name,
    tenantId: null,
    role: 'SUPER_ADMIN',
    verified: true,
  };
}

/**
 * Exige papel de gestor sobre um tenant específico. Super admins passam por
 * cima da checagem de tenant.
 */
export async function requireTenantAdmin(
  authorization: string | undefined,
  tenantId: string
): Promise<Session> {
  const identity = await requireVerifiedIdentity(authorization);

  if (superAdminEmails().includes(identity.email)) {
    return {
      email: identity.email,
      displayName: identity.name,
      tenantId,
      role: 'SUPER_ADMIN',
      verified: true,
    };
  }

  const membership = await getMembership(tenantId, identity.email);
  if (!membership || membership.role !== 'TENANT_ADMIN' || membership.status !== 'ATIVO') {
    throw new AuthError('Você não administra esta prefeitura.', 403);
  }

  return {
    email: identity.email,
    displayName: identity.name,
    tenantId,
    role: 'TENANT_ADMIN',
    verified: true,
  };
}

/**
 * Resolve o vínculo do aluno no modo OPEN_PILOT.
 *
 * ATENÇÃO: o e-mail aqui NÃO é verificado. Serve para atribuir progresso,
 * nunca para autorizar leitura de dados de terceiros. Qualquer rota que use
 * esta função deve tratar o retorno como uma afirmação do cliente.
 */
export async function resolveUnverifiedStudent(
  email: string | undefined
): Promise<Session> {
  if (!email || !email.includes('@')) {
    throw new AuthError('E-mail não informado.', 400);
  }

  const key = emailKey(email);
  const membership = await findMembershipByEmail(key);

  return {
    email: key,
    displayName: key.split('@')[0],
    tenantId: membership?.tenantId ?? null,
    role: 'ALUNO',
    verified: false,
  };
}

// ---------------------------------------------------------------------------
// Consultas de membership
// ---------------------------------------------------------------------------

export async function getMembership(tenantId: string, email: string) {
  const db = getDb();
  const id = `${tenantId}__${emailKey(email)}`;
  const snap = await db.collection(COLLECTIONS.memberships).doc(id).get();
  return snap.exists ? (snap.data() as { tenantId: string; role: Role; status: string }) : null;
}

export async function findMembershipByEmail(email: string) {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.memberships)
    .where('email', '==', emailKey(email))
    .where('status', '==', 'ATIVO')
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].data() as { tenantId: string; role: Role; status: string };
}

/**
 * Descobre o tenant a partir do domínio do e-mail. Usado no auto-vínculo
 * quando o tenant opera em DOMAIN_INVITE.
 */
export async function findTenantByEmailDomain(email: string): Promise<string | null> {
  const domain = emailKey(email).split('@')[1];
  if (!domain) return null;

  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.tenants)
    .where('allowedEmailDomains', 'array-contains', domain)
    .limit(1)
    .get();

  return snap.empty ? null : snap.docs[0].id;
}
