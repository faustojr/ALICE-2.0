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
  type BillingSummary,
  type Contract,
  type Group,
  type Invoice,
  type LawArticle,
  type Membership,
  type ModuleVariant,
  type ReelImage,
  type Role,
  type Tenant,
  type TenantStats,
  type Trail,
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

/**
 * Verifica se ainda há assento disponível no plano da prefeitura.
 *
 * O produto é vendido por número de servidores; sem esta checagem uma
 * prefeitura no plano de 30 assentos cadastra 500 e a conta da IA cresce sem
 * a receita correspondente.
 *
 * Não bloqueia quem já entrou: tirar o acesso de um servidor no meio do
 * estudo por causa de um limite comercial é hostil e não recupera receita.
 * O excesso vira sinal para o painel e conversa de upgrade.
 */
export async function checkSeatAvailability(
  tenantId: string | null,
  email: string
): Promise<{ allowed: boolean; used: number; limit: number | null; overLimit: boolean }> {
  if (!tenantId) return { allowed: true, used: 0, limit: null, overLimit: false };

  const tenant = await getTenant(tenantId);
  if (!tenant) return { allowed: true, used: 0, limit: null, overLimit: false };

  const limit = PLANS[tenant.plan]?.seats ?? null;
  if (limit === null) return { allowed: true, used: 0, limit: null, overLimit: false };

  // Quem já tem vínculo não consome assento novo.
  const existing = await getMembershipRecord(tenantId, email);
  if (existing) {
    const used = await countTenantSeats(tenantId);
    return { allowed: true, used, limit, overLimit: used > limit };
  }

  const used = await countTenantSeats(tenantId);
  return { allowed: used < limit, used, limit, overLimit: used >= limit };
}

async function getMembershipRecord(tenantId: string, email: string) {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.memberships)
    .doc(`${tenantId}__${emailKey(email)}`)
    .get();
  return snap.exists ? (snap.data() as Membership) : null;
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
// Grupos (secretarias)
// ---------------------------------------------------------------------------

function slugifyName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export async function listGroups(tenantId: string): Promise<Group[]> {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.groups)
    .where('tenantId', '==', tenantId)
    .get();
  return snap.docs.map((d) => d.data() as Group).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createGroup(
  tenantId: string,
  name: string,
  extra: Partial<Group> = {}
): Promise<Group> {
  const db = getDb();
  const slug = slugifyName(name);
  if (!slug) throw new Error('Nome de grupo inválido.');

  const id = `${tenantId}__${slug}`;
  const ref = db.collection(COLLECTIONS.groups).doc(id);

  if ((await ref.get()).exists) {
    throw new Error(`Já existe um grupo "${name}" nesta prefeitura.`);
  }

  const now = new Date().toISOString();
  const group: Group = {
    id,
    tenantId,
    slug,
    name: name.trim().slice(0, 120),
    description: extra.description,
    assignedTrails: extra.assignedTrails ?? [],
    stats: { members: 0, activeMembers30d: 0, averagePoints: 0 },
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(group);
  return group;
}

export async function updateGroup(id: string, patch: Partial<Group>): Promise<void> {
  const db = getDb();
  const { id: _id, tenantId: _t, createdAt: _c, ...safe } = patch;
  await db
    .collection(COLLECTIONS.groups)
    .doc(id)
    .update({ ...safe, updatedAt: new Date().toISOString() });
}

export async function deleteGroup(id: string): Promise<void> {
  const db = getDb();
  // Os membros perdem o vínculo mas continuam no tenant: apagar um grupo não
  // pode remover servidores da prefeitura.
  const members = await db
    .collection(COLLECTIONS.memberships)
    .where('groupId', '==', id)
    .get();

  const batch = db.batch();
  members.docs.forEach((doc) => batch.update(doc.ref, { groupId: FieldValue.delete() }));
  batch.delete(db.collection(COLLECTIONS.groups).doc(id));
  await batch.commit();
}

export async function assignMemberToGroup(
  membershipId: string,
  groupId: string | null
): Promise<void> {
  const db = getDb();
  await db
    .collection(COLLECTIONS.memberships)
    .doc(membershipId)
    .update({ groupId: groupId ?? FieldValue.delete() });
}

/** Recalcula os contadores de cada grupo a partir dos membros e do progresso. */
export async function refreshGroupStats(tenantId: string): Promise<void> {
  const db = getDb();
  const [groups, members, users] = await Promise.all([
    listGroups(tenantId),
    listTenantMembers(tenantId),
    listTenantUsers(tenantId),
  ]);

  const byEmail = new Map(users.map((u: any) => [u.email, u]));
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  const batch = db.batch();

  for (const group of groups) {
    const groupMembers = members.filter((m) => m.groupId === group.id);
    const withProgress = groupMembers
      .map((m) => byEmail.get(m.email))
      .filter(Boolean) as any[];

    const active = withProgress.filter(
      (u) => u.lastAccess && Date.parse(u.lastAccess) > cutoff
    ).length;
    const points = withProgress.reduce((sum, u) => sum + (u.points || 0), 0);

    batch.update(db.collection(COLLECTIONS.groups).doc(group.id), {
      stats: {
        members: groupMembers.length,
        activeMembers30d: active,
        averagePoints: withProgress.length ? Math.round(points / withProgress.length) : 0,
      },
    });
  }

  await batch.commit();
}

// ---------------------------------------------------------------------------
// Contratos e faturas
// ---------------------------------------------------------------------------

export async function getContract(tenantId: string): Promise<Contract | null> {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.contracts)
    .where('tenantId', '==', tenantId)
    .where('status', 'in', ['ATIVO', 'EM_NEGOCIACAO'])
    .limit(1)
    .get();
  return snap.empty ? null : (snap.docs[0].data() as Contract);
}

export async function upsertContract(
  input: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<Contract> {
  const db = getDb();
  const now = new Date().toISOString();
  const ref = input.id
    ? db.collection(COLLECTIONS.contracts).doc(input.id)
    : db.collection(COLLECTIONS.contracts).doc();

  const existing = input.id ? await ref.get() : null;
  const contract: Contract = {
    ...input,
    id: ref.id,
    createdAt: existing?.exists ? (existing.data() as Contract).createdAt : now,
    updatedAt: now,
  };

  await ref.set(contract, { merge: true });
  return contract;
}

export async function listInvoices(tenantId?: string): Promise<Invoice[]> {
  const db = getDb();
  const query = tenantId
    ? db.collection(COLLECTIONS.invoices).where('tenantId', '==', tenantId)
    : db.collection(COLLECTIONS.invoices);

  const snap = await query.get();
  return snap.docs
    .map((d) => d.data() as Invoice)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
}

export async function upsertInvoice(
  input: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<Invoice> {
  const db = getDb();
  const now = new Date().toISOString();
  const ref = input.id
    ? db.collection(COLLECTIONS.invoices).doc(input.id)
    : db.collection(COLLECTIONS.invoices).doc();

  const existing = input.id ? await ref.get() : null;
  const invoice: Invoice = {
    ...input,
    id: ref.id,
    createdAt: existing?.exists ? (existing.data() as Invoice).createdAt : now,
    updatedAt: now,
  };

  await ref.set(invoice, { merge: true });
  return invoice;
}

/**
 * Gera as faturas previstas de um contrato.
 *
 * Emitir tudo de uma vez, na assinatura, evita depender de alguém lembrar de
 * faturar todo mês — o erro mais comum numa operação de fundador solo.
 */
export async function generateInvoicesForContract(contract: Contract): Promise<number> {
  const db = getDb();
  const existing = await listInvoices(contract.tenantId);
  const already = new Set(
    existing.filter((i) => i.contractId === contract.id).map((i) => i.reference)
  );

  const monthsPerCycle = contract.cycle === 'MENSAL' ? 1 : contract.cycle === 'SEMESTRAL' ? 6 : 12;
  const start = new Date(contract.startDate);
  const end = new Date(contract.endDate);

  const batch = db.batch();
  let created = 0;

  for (
    let d = new Date(start);
    d < end && created < 60;
    d.setUTCMonth(d.getUTCMonth() + monthsPerCycle)
  ) {
    const reference = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (already.has(reference)) continue;

    // Vencimento no dia 10 do mês seguinte à competência: prazo realista para
    // a prefeitura processar empenho e liquidação.
    const due = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 10));
    const ref = db.collection(COLLECTIONS.invoices).doc();
    const now = new Date().toISOString();

    batch.set(ref, {
      id: ref.id,
      tenantId: contract.tenantId,
      contractId: contract.id,
      reference,
      amountCents: contract.amountCents,
      status: 'PREVISTA',
      dueDate: due.toISOString().slice(0, 10),
      createdAt: now,
      updatedAt: now,
    } satisfies Invoice);

    created += 1;
  }

  if (created > 0) await batch.commit();
  return created;
}

/**
 * Marca como VENCIDA toda fatura emitida cujo vencimento passou.
 * Chamada quando o painel é aberto: sem um agendador, é o momento em que a
 * informação é de fato consultada.
 */
export async function refreshOverdueInvoices(): Promise<number> {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const snap = await db
    .collection(COLLECTIONS.invoices)
    .where('status', '==', 'EMITIDA')
    .get();

  const vencidas = snap.docs.filter((d) => (d.data() as Invoice).dueDate < today);
  if (vencidas.length === 0) return 0;

  const batch = db.batch();
  vencidas.forEach((d) =>
    batch.update(d.ref, { status: 'VENCIDA', updatedAt: new Date().toISOString() })
  );
  await batch.commit();
  return vencidas.length;
}

export async function billingSummaryFor(tenantId: string): Promise<BillingSummary> {
  const [contract, invoices] = await Promise.all([
    getContract(tenantId),
    listInvoices(tenantId),
  ]);

  const year = new Date().getUTCFullYear();
  const overdue = invoices.filter((i) => i.status === 'VENCIDA');
  const open = invoices.filter((i) => i.status === 'EMITIDA' || i.status === 'VENCIDA');

  const nextDue = invoices
    .filter((i) => i.status === 'PREVISTA' || i.status === 'EMITIDA')
    .map((i) => i.dueDate)
    .sort()[0];

  return {
    contract,
    openInvoices: open.length,
    overdueInvoices: overdue.length,
    overdueAmountCents: overdue.reduce((sum, i) => sum + i.amountCents, 0),
    nextDueDate: nextDue ?? null,
    paidThisYearCents: invoices
      .filter((i) => i.status === 'PAGA' && i.paidAt?.startsWith(String(year)))
      .reduce((sum, i) => sum + i.amountCents, 0),
  };
}

// ---------------------------------------------------------------------------
// Texto da lei
// ---------------------------------------------------------------------------

export async function getLawArticle(
  lawSlug: string,
  number: string
): Promise<LawArticle | null> {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.lawArticles)
    .doc(`${lawSlug}__art${number}`)
    .get();
  return snap.exists ? (snap.data() as LawArticle) : null;
}

export async function getLawArticles(
  lawSlug: string,
  numbers: string[]
): Promise<LawArticle[]> {
  if (numbers.length === 0) return [];
  const db = getDb();

  // getAll evita uma ida ao banco por artigo quando o tópico cita vários.
  const refs = numbers
    .slice(0, 30)
    .map((n) => db.collection(COLLECTIONS.lawArticles).doc(`${lawSlug}__art${n}`));

  const docs = await db.getAll(...refs);
  return docs.filter((d) => d.exists).map((d) => d.data() as LawArticle);
}

export async function countLawArticles(lawSlug: string): Promise<number> {
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.lawArticles)
    .where('lawSlug', '==', lawSlug)
    .count()
    .get();
  return snap.data().count;
}

// ---------------------------------------------------------------------------
// Trilhas de conteúdo
// ---------------------------------------------------------------------------

/**
 * Trilhas que um tenant pode usar: as globais publicadas mais as próprias.
 *
 * Quando `enabledTrails` do tenant está preenchido, ele restringe a lista —
 * é assim que um plano inferior fica limitado à trilha da 14.133 enquanto um
 * plano superior enxerga todas.
 */
export async function listTrailsFor(tenantId: string | null): Promise<Trail[]> {
  const db = getDb();
  const col = db.collection(COLLECTIONS.trails);

  const [globals, owned] = await Promise.all([
    col.where('tenantId', '==', null).where('isPublished', '==', true).get(),
    tenantId
      ? col.where('tenantId', '==', tenantId).get()
      : Promise.resolve({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }),
  ]);

  const trails = [...globals.docs, ...owned.docs].map((d) => d.data() as Trail);

  if (tenantId) {
    const tenant = await getTenant(tenantId);
    const allowed = tenant?.enabledTrails ?? [];
    if (allowed.length > 0) {
      return trails
        .filter((t) => allowed.includes(t.slug) || t.tenantId === tenantId)
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    }
  }

  return trails.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

export async function getTrail(slugOrId: string): Promise<Trail | null> {
  const db = getDb();

  const byId = await db.collection(COLLECTIONS.trails).doc(slugOrId).get();
  if (byId.exists) return byId.data() as Trail;

  const bySlug = await db
    .collection(COLLECTIONS.trails)
    .where('slug', '==', slugOrId)
    .limit(1)
    .get();

  return bySlug.empty ? null : (bySlug.docs[0].data() as Trail);
}

export async function upsertTrail(trail: Trail): Promise<void> {
  const db = getDb();
  await db
    .collection(COLLECTIONS.trails)
    .doc(trail.id)
    .set({ ...trail, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function listAllTrails(): Promise<Trail[]> {
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.trails).get();
  return snap.docs
    .map((d) => d.data() as Trail)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

/**
 * Tópico correspondente a um índice de módulo. A trilha cicla: passado o
 * último tópico, o aluno recomeça, e o gerador usa o número do ciclo para
 * pedir um recorte diferente do mesmo tema.
 */
export function topicForIndex(trail: Trail, index: number) {
  if (trail.topics.length === 0) return null;
  const position = index % trail.topics.length;
  return {
    topic: trail.topics[position],
    position,
    cycle: Math.floor(index / trail.topics.length) + 1,
  };
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
