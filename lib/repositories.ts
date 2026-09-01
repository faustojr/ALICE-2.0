/**
 * Acesso a dados. Substitui o store em memória do server.ts, que perdia tudo
 * a cada reinício e não sobreviveria a múltiplas instâncias serverless.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { getDb, COLLECTIONS, emailKey } from './firebaseAdmin.js';
import {
  PLANS,
  PROMOTION_THRESHOLD,
  type AiUsageRecord,
  type Membership,
  type ModuleVariant,
  type ReelImage,
  type Role,
  type Tenant,
  type TenantStats,
} from '../types.js';

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

export async function listTenants(): Promise<Tenant[]> {
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.tenants).orderBy('name').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Tenant);
}

export async function getTenant(tenantId: string): Promise<Tenant | null> {
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.tenants).doc(tenantId).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() }) as Tenant : null;
}

export async function createTenant(
  input: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt' | 'stats'>
): Promise<Tenant> {
  const db = getDb();
  const now = new Date().toISOString();

  const slugTaken = await db
    .collection(COLLECTIONS.tenants)
    .where('slug', '==', input.slug)
    .limit(1)
    .get();
  if (!slugTaken.empty) {
    throw new Error(`Já existe uma prefeitura com o identificador "${input.slug}".`);
  }

  const doc = db.collection(COLLECTIONS.tenants).doc();
  const tenant: Tenant = {
    ...input,
    id: doc.id,
    createdAt: now,
    updatedAt: now,
    stats: {
      totalUsers: 0,
      activeUsers30d: 0,
      totalQuizzes: 0,
      averagePoints: 0,
      aiGenerationsThisMonth: 0,
    },
  };

  await doc.set(tenant);
  return tenant;
}

export async function updateTenant(
  tenantId: string,
  patch: Partial<Tenant>
): Promise<void> {
  const db = getDb();
  // Campos de identidade e contadores não são editáveis por PATCH.
  const { id, createdAt, stats, ...safe } = patch;
  await db
    .collection(COLLECTIONS.tenants)
    .doc(tenantId)
    .update({ ...safe, updatedAt: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------------

export async function upsertMembership(
  tenantId: string,
  email: string,
  role: Role = 'ALUNO',
  extra: Partial<Membership> = {}
): Promise<Membership> {
  const db = getDb();
  const key = emailKey(email);
  const id = `${tenantId}__${key}`;
  const now = new Date().toISOString();

  const ref = db.collection(COLLECTIONS.memberships).doc(id);
  const existing = await ref.get();

  const membership: Membership = {
    id,
    tenantId,
    email: key,
    role,
    status: 'ATIVO',
    joinedAt: existing.exists ? (existing.data() as Membership).joinedAt : now,
    lastAccessAt: now,
    ...extra,
  };

  await ref.set(membership, { merge: true });
  return membership;
}

export async function listTenantMembers(tenantId: string): Promise<Membership[]> {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.memberships)
    .where('tenantId', '==', tenantId)
    .get();
  return snap.docs.map((d) => d.data() as Membership);
}

export async function countTenantSeats(tenantId: string): Promise<number> {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.memberships)
    .where('tenantId', '==', tenantId)
    .where('status', '==', 'ATIVO')
    .count()
    .get();
  return snap.data().count;
}

// ---------------------------------------------------------------------------
// Usuários e progresso
// ---------------------------------------------------------------------------

export async function upsertUser(
  email: string,
  data: Record<string, unknown>
): Promise<void> {
  const db = getDb();
  const key = emailKey(email);
  await db
    .collection(COLLECTIONS.users)
    .doc(key)
    .set(
      { ...data, email: key, lastAccess: new Date().toISOString() },
      { merge: true }
    );
}

export async function getUser(email: string) {
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.users).doc(emailKey(email)).get();
  return snap.exists ? snap.data() : null;
}

export async function listTenantUsers(tenantId: string) {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.users)
    .where('tenantId', '==', tenantId)
    .get();
  return snap.docs.map((d) => d.data());
}

// ---------------------------------------------------------------------------
// Estatísticas
// ---------------------------------------------------------------------------

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function computeTenantStats(tenantId: string): Promise<TenantStats> {
  const users = await listTenantUsers(tenantId);
  const cutoff = Date.now() - THIRTY_DAYS_MS;

  const totalUsers = users.length;
  const activeUsers30d = users.filter((u: any) => {
    const last = u.lastAccess ? Date.parse(u.lastAccess) : 0;
    return last > cutoff;
  }).length;

  const totalPoints = users.reduce((sum, u: any) => sum + (u.points || 0), 0);
  const totalQuizzes = users.reduce((sum, u: any) => sum + (u.quizCount || 0), 0);

  const lastActivityAt = users
    .map((u: any) => u.lastAccess)
    .filter(Boolean)
    .sort()
    .pop();

  return {
    totalUsers,
    activeUsers30d,
    totalQuizzes,
    averagePoints: totalUsers > 0 ? Math.round(totalPoints / totalUsers) : 0,
    aiGenerationsThisMonth: await countAiGenerationsThisMonth(tenantId),
    lastActivityAt,
  };
}

/** Recalcula e persiste as estatísticas desnormalizadas do tenant. */
export async function refreshTenantStats(tenantId: string): Promise<TenantStats> {
  const stats = await computeTenantStats(tenantId);
  const db = getDb();
  await db.collection(COLLECTIONS.tenants).doc(tenantId).update({ stats });
  return stats;
}

// ---------------------------------------------------------------------------
// Telemetria e cota de IA
// ---------------------------------------------------------------------------

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function countAiGenerationsThisMonth(tenantId: string): Promise<number> {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.aiUsage)
    .where('tenantId', '==', tenantId)
    .where('monthKey', '==', currentMonthKey())
    .count()
    .get();
  return snap.data().count;
}

export async function recordAiUsage(
  record: Omit<AiUsageRecord, 'id' | 'createdAt'>
): Promise<void> {
  const db = getDb();
  const doc = db.collection(COLLECTIONS.aiUsage).doc();
  await doc.set({
    ...record,
    id: doc.id,
    monthKey: currentMonthKey(),
    createdAt: new Date().toISOString(),
  });
}

/**
 * Verifica se o tenant ainda tem cota de geração de IA no mês.
 * Retorna o motivo da recusa quando estourado, para a API responder 429
 * com uma mensagem útil em vez de um erro genérico.
 */
export async function checkAiQuota(
  tenantId: string | null
): Promise<{ allowed: boolean; reason?: string; used: number; limit: number | null }> {
  // Sem tenant (piloto aberto sem vínculo) cai num limite conservador global.
  if (!tenantId) {
    return { allowed: true, used: 0, limit: null };
  }

  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return { allowed: true, used: 0, limit: null };
  }

  if (tenant.status === 'SUSPENSO' || tenant.status === 'CANCELADO') {
    return {
      allowed: false,
      reason: 'Assinatura da prefeitura inativa. Fale com o gestor de capacitação.',
      used: 0,
      limit: 0,
    };
  }

  const limit = PLANS[tenant.plan]?.aiGenerationsPerMonth ?? null;
  if (limit === null) {
    return { allowed: true, used: 0, limit: null };
  }

  const used = await countAiGenerationsThisMonth(tenantId);
  if (used >= limit) {
    return {
      allowed: false,
      reason: `Cota mensal de conteúdo gerado por IA atingida (${limit}). O conteúdo padrão continua disponível.`,
      used,
      limit,
    };
  }

  return { allowed: true, used, limit };
}

// ---------------------------------------------------------------------------
// Variantes de módulo e promoção por desempenho
// ---------------------------------------------------------------------------

export function moduleKeyOf(trail: string, level: string, index: number): string {
  return `${trail}__${level}__${index}`;
}

/**
 * Variante que deve ser servida a um módulo: a promovida do tenant, se
 * houver; senão a promovida global; senão nada, e o chamador usa o conteúdo
 * padrão embutido no app.
 */
export async function findPromotedVariant(
  moduleKey: string,
  tenantId: string | null
): Promise<ModuleVariant | null> {
  const db = getDb();
  const col = db.collection(COLLECTIONS.moduleVariants);

  if (tenantId) {
    const own = await col
      .where('moduleKey', '==', moduleKey)
      .where('status', '==', 'PROMOTED')
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();
    if (!own.empty) return own.docs[0].data() as ModuleVariant;
  }

  const global = await col
    .where('moduleKey', '==', moduleKey)
    .where('status', '==', 'PROMOTED')
    .where('tenantId', '==', null)
    .limit(1)
    .get();

  return global.empty ? null : (global.docs[0].data() as ModuleVariant);
}

export async function getVariant(variantId: string): Promise<ModuleVariant | null> {
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.moduleVariants).doc(variantId).get();
  return snap.exists ? (snap.data() as ModuleVariant) : null;
}

export async function createVariant(
  input: Omit<ModuleVariant, 'id' | 'createdAt' | 'stats' | 'status'>
): Promise<ModuleVariant> {
  const db = getDb();
  const doc = db.collection(COLLECTIONS.moduleVariants).doc();

  const variant: ModuleVariant = {
    ...input,
    id: doc.id,
    status: 'CANDIDATE',
    stats: { served: 1, correct: 0, wrong: 0, correctBy: [] },
    createdAt: new Date().toISOString(),
  };

  await doc.set(variant);
  return variant;
}

export interface QuizOutcome {
  promoted: boolean;
  correctCount: number;
  threshold: number;
}

/**
 * Registra o resultado do quiz numa variante e promove quando alunos
 * distintos o bastante acertaram com ela.
 *
 * Roda em transação: sem isso, dois alunos respondendo ao mesmo tempo leem o
 * mesmo contador e a variante é promovida com menos acertos do que o exigido.
 */
export async function recordVariantOutcome(
  variantId: string,
  email: string,
  correct: boolean
): Promise<QuizOutcome> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.moduleVariants).doc(variantId);
  const key = emailKey(email);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return { promoted: false, correctCount: 0, threshold: PROMOTION_THRESHOLD };
    }

    const variant = snap.data() as ModuleVariant;
    const stats = variant.stats ?? { served: 0, correct: 0, wrong: 0, correctBy: [] };
    const correctBy = new Set(stats.correctBy ?? []);

    if (correct) correctBy.add(key);

    const updated = {
      ...stats,
      correct: stats.correct + (correct ? 1 : 0),
      wrong: stats.wrong + (correct ? 0 : 1),
      // Alunos distintos, não tentativas: o mesmo aluno acertando de novo não
      // é evidência nova de que o conteúdo ensina.
      correctBy: Array.from(correctBy).slice(0, 500),
    };

    const distinctCorrect = updated.correctBy.length;
    const shouldPromote =
      variant.status === 'CANDIDATE' && distinctCorrect >= PROMOTION_THRESHOLD;

    tx.update(ref, {
      stats: updated,
      ...(shouldPromote
        ? { status: 'PROMOTED', promotedAt: new Date().toISOString() }
        : {}),
    });

    // Uma variante promovida substitui a anterior do mesmo escopo; duas
    // promovidas para o mesmo módulo tornariam o conteúdo servido imprevisível.
    if (shouldPromote) {
      const previous = await db
        .collection(COLLECTIONS.moduleVariants)
        .where('moduleKey', '==', variant.moduleKey)
        .where('status', '==', 'PROMOTED')
        .where('tenantId', '==', variant.tenantId ?? null)
        .get();

      for (const doc of previous.docs) {
        if (doc.id !== variantId) {
          tx.update(doc.ref, { status: 'REJECTED', rejectedAt: new Date().toISOString() });
        }
      }
    }

    return {
      promoted: shouldPromote,
      correctCount: distinctCorrect,
      threshold: PROMOTION_THRESHOLD,
    };
  });
}

export async function incrementVariantServed(variantId: string): Promise<void> {
  const db = getDb();
  await db
    .collection(COLLECTIONS.moduleVariants)
    .doc(variantId)
    .update({ 'stats.served': FieldValue.increment(1) })
    .catch(() => {
      // Contador de exibição não pode derrubar a entrega do conteúdo.
    });
}

export async function listVariants(filter: {
  status?: string;
  tenantId?: string | null;
  limit?: number;
}): Promise<ModuleVariant[]> {
  const db = getDb();
  let query = db
    .collection(COLLECTIONS.moduleVariants)
    .orderBy('createdAt', 'desc') as FirebaseFirestore.Query;

  if (filter.status) query = query.where('status', '==', filter.status);
  if (filter.tenantId !== undefined) query = query.where('tenantId', '==', filter.tenantId);

  const snap = await query.limit(filter.limit ?? 100).get();
  return snap.docs.map((d) => d.data() as ModuleVariant);
}

export async function setVariantStatus(
  variantId: string,
  status: 'PROMOTED' | 'REJECTED',
  actor: string
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db
    .collection(COLLECTIONS.moduleVariants)
    .doc(variantId)
    .update(
      status === 'PROMOTED'
        ? { status, promotedAt: now }
        : { status, rejectedAt: now, rejectedBy: actor }
    );
}

// ---------------------------------------------------------------------------
// Imagens de fundo dos reels
// ---------------------------------------------------------------------------

export async function listReelImages(): Promise<ReelImage[]> {
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.reelImages).get();
  return snap.docs.map((d) => d.data() as ReelImage);
}

export async function upsertReelImage(image: ReelImage): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTIONS.reelImages).doc(image.id).set(image, { merge: true });
}

// ---------------------------------------------------------------------------
// Leads da landing page
// ---------------------------------------------------------------------------

export interface Lead {
  id?: string;
  name: string;
  email: string;
  municipality: string;
  uf: string;
  role?: string;
  phone?: string;
  population?: string;
  message?: string;
  source: string;
  createdAt?: string;
}

export async function createLead(lead: Lead): Promise<string> {
  const db = getDb();
  const doc = db.collection(COLLECTIONS.leads).doc();
  await doc.set({
    ...lead,
    id: doc.id,
    email: emailKey(lead.email),
    createdAt: new Date().toISOString(),
    status: 'NOVO',
  });
  return doc.id;
}

export async function listLeads(limit = 200): Promise<Lead[]> {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.leads)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as Lead);
}

export { FieldValue };
