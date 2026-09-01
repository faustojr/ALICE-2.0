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

export interface ManagerOverview {
  generatedAt: string;
  scope: { tenantId: string | null; isSuperAdmin: boolean };
  members: ManagerMember[];
  surveys: ManagerSurvey[];
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
