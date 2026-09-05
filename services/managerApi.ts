/**
 * Cliente do painel do gestor.
 *
 * Antes o painel mantinha listeners onSnapshot abertos no Firestore. Agora
 * busca sob demanda: o gestor consulta o painel pontualmente, e um listener
 * aberto consumia leituras enquanto a aba ficasse esquecida.
 */

import { getIdToken } from '../firebase';

export interface ManagerMember {
  id: string;
  email: string;
  name: string;
  area: string;
  points: number;
  level: number;
  currentLevel: string;
  currentModuleIndex: number;
  highestModuleIndex: number;
  quizCount: number;
  correctQuizzesCount: Record<string, number> | null;
  /** Questões respondidas sem recapitular, e quantas dessas foram certas. */
  firstAttempts: number;
  firstAttemptsCorrect: number;
  streakDays: number;
  specialties: Record<string, number>;
  bestTopic: string | null;
  bestTopicScore: number | null;
  worstTopic: string | null;
  worstTopicScore: number | null;
  softSkillsLevel: string | null;
  pilotStatus: string | null;
  cycleCount?: number;
  lastAccess: string | null;
  tenantId: string | null;
  groupId?: string | null;
  groupName?: string | null;
}

export interface ManagerSurvey {
  id: string;
  email: string;
  tenantId: string | null;
  pre_experienceTime?: string;
  pre_formalCapacitation?: boolean | string;
  pre_generalKnowledge?: number;
  pre_prepKnowledge?: number;
  pre_confidenceBasic?: number;
  pre_interestCustomTool?: number;
  pos_daysUsed?: number;
  pos_generalKnowledge?: number;
  pos_prepKnowledge?: number;
  pos_confidenceBasic?: number;
  pos_perceivedAdaptation?: number;
  pos_microLearningHelp?: number;
  pos_easeOfUse?: number;
  pos_motivation?: number;
  pos_useAgain?: number;
}

export interface GroupPerformance {
  id: string;
  name: string;
  members: number;
  active30d: number;
  averagePoints: number;
  totalQuizzes: number;
  /** Acerto na primeira tentativa da turma, em %. null se ninguém respondeu. */
  firstTryRate: number | null;
}

export interface ManagerOverview {
  generatedAt: string;
  scope: { tenantId: string | null; isSuperAdmin: boolean };
  members: ManagerMember[];
  surveys: ManagerSurvey[];
  groups: GroupPerformance[];
  /** Acerto na primeira tentativa da prefeitura toda, em %. null se ninguém respondeu. */
  firstTryRate: number | null;
  ungroupedMembers: number;
  billing: {
    hasContract: boolean;
    planEndsAt: string | null;
    seats: number | null;
    overdueInvoices: number;
    nextDueDate: string | null;
  } | null;
  summary: {
    totalMembers: number;
    activeUsers30d: number;
    averagePoints: number;
    totalQuizzes: number;
    surveysCompleted: number;
  };
}

export class ManagerApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ManagerApiError';
  }
}

export async function fetchManagerOverview(tenantId?: string): Promise<ManagerOverview> {
  const token = await getIdToken();
  if (!token) {
    throw new ManagerApiError(
      'O painel do gestor exige login com Google. Entre para continuar.',
      401
    );
  }

  const url = tenantId
    ? `/api/manager/overview?tenantId=${encodeURIComponent(tenantId)}`
    : '/api/manager/overview';

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ManagerApiError(
      payload.error || `Falha ao carregar o painel (${response.status}).`,
      response.status
    );
  }

  return payload as ManagerOverview;
}

// ---------------------------------------------------------------------------
// Grupos (secretarias)
// ---------------------------------------------------------------------------

export interface ManagerGroup {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  description?: string;
  assignedTrails: string[];
  stats?: { members: number; activeMembers30d: number; averagePoints: number };
}

export interface GroupMember {
  id: string;
  email: string;
  role: string;
  status: string;
  groupId: string | null;
  lastAccessAt: string | null;
}

async function managerRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
  if (!token) {
    throw new ManagerApiError('Esta área exige login com Google.', 401);
  }

  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ManagerApiError(
      payload.error || `Falha na requisição (${response.status}).`,
      response.status
    );
  }
  return payload as T;
}

export function fetchGroups(refresh = false): Promise<{
  groups: ManagerGroup[];
  members: GroupMember[];
  ungrouped: number;
}> {
  return managerRequest(`/api/manager/groups${refresh ? '?refresh=true' : ''}`);
}

export function createGroup(name: string, description?: string) {
  return managerRequest<{ group: ManagerGroup }>('/api/manager/groups', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export function assignMember(membershipId: string, groupId: string | null) {
  return managerRequest<{ ok: boolean }>('/api/manager/groups?action=assign', {
    method: 'PATCH',
    body: JSON.stringify({ membershipId, groupId }),
  });
}

export function deleteGroup(id: string) {
  return managerRequest<{ ok: boolean }>(
    `/api/manager/groups?id=${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
}

// ---------------------------------------------------------------------------
// Conteúdo próprio da prefeitura
// ---------------------------------------------------------------------------

export interface DraftContent {
  title: string;
  slideTexts: string[];
  question: string;
  options: { label: string; value: string }[];
  feedbackCorrect: string;
  feedbackWrong: string;
}

export interface ManagerTopic {
  id: string;
  title: string;
  legalReference: string | null;
  status: 'PUBLICADO' | 'AGUARDANDO_APROVACAO' | 'SEM_CONTEUDO';
  draft: DraftContent | null;
  published: DraftContent | null;
}

export function fetchOwnContent(): Promise<{
  trail: { slug: string; name: string; isPublished: boolean } | null;
  topics: ManagerTopic[];
  pendingApproval: number;
}> {
  return managerRequest('/api/manager/content');
}

export function addTopic(title: string, legalReference?: string) {
  return managerRequest<{ ok: boolean; topicId: string }>(
    '/api/manager/content?action=topic',
    { method: 'POST', body: JSON.stringify({ title, legalReference }) }
  );
}

export function generateTopicContent(topicId: string) {
  return managerRequest<{ ok: boolean; draft: DraftContent }>(
    '/api/manager/content?action=generate',
    { method: 'PATCH', body: JSON.stringify({ topicId }) }
  );
}

export function approveTopic(
  topicId: string,
  approved: boolean,
  content?: DraftContent
) {
  return managerRequest<{ ok: boolean; approved: boolean }>(
    '/api/manager/content?action=approve',
    { method: 'PATCH', body: JSON.stringify({ topicId, approved, content }) }
  );
}
