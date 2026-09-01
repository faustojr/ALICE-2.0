/**
 * Cliente das rotas administrativas. Toda chamada leva o ID token do Firebase;
 * sem ele o servidor responde 401.
 */

import { getIdToken } from '../firebase';
import type { Tenant } from '../types';

export interface AdminOverview {
  generatedAt: string;
  revenue: {
    mrrCents: number;
    arrCents: number;
    payingTenants: number;
  };
  adoption: {
    totalTenants: number;
    byStatus: Record<string, number>;
    byUf: Record<string, number>;
    totalSeats: number;
    activeSeats: number;
    activationRate: number;
  };
  engagement: {
    totalQuizzes: number;
    quizzesPerActiveUser: number;
  };
  ai: {
    generationsThisMonth: number;
  };
  pipeline: {
    newLeads: number;
    expiringTrials: {
      id: string;
      name: string;
      uf: string;
      trialEndsAt?: string;
      activeUsers30d: number;
    }[];
    atRisk: {
      id: string;
      name: string;
      uf: string;
      lastActivityAt: string | null;
      totalUsers: number;
    }[];
  };
}

export class AdminApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
  if (!token) {
    throw new AdminApiError(
      'Sessão administrativa exige login com Google. Entre novamente.',
      401
    );
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
    throw new AdminApiError(
      payload.error || `Falha na requisição (${response.status}).`,
      response.status
    );
  }

  return payload as T;
}

export function fetchOverview(): Promise<AdminOverview> {
  return request<AdminOverview>('/api/admin/overview');
}

export function fetchTenants(refresh = false): Promise<{ tenants: Tenant[] }> {
  return request<{ tenants: Tenant[] }>(
    `/api/admin/tenants${refresh ? '?refresh=true' : ''}`
  );
}

export function createTenant(input: Record<string, unknown>): Promise<{ tenant: Tenant }> {
  return request<{ tenant: Tenant }>('/api/admin/tenants', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTenant(
  id: string,
  patch: Record<string, unknown>
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/admin/tenants?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

// ---------------------------------------------------------------------------
// Auditoria de variantes de conteúdo
// ---------------------------------------------------------------------------

export interface AdminVariant {
  id: string;
  moduleKey: string;
  trail: string;
  level: string;
  moduleIndex: number;
  status: 'CANDIDATE' | 'PROMOTED' | 'REJECTED';
  origin: string;
  tenantId: string | null;
  title: string;
  question: string;
  slideTexts: string[];
  options: { label: string; value: string }[];
  feedbackCorrect: string;
  stats: {
    served: number;
    correct: number;
    wrong: number;
    distinctCorrect: number;
    successRate: number | null;
  };
  createdAt: string;
  promotedAt: string | null;
}

export function fetchVariants(status?: string): Promise<{ variants: AdminVariant[] }> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return request<{ variants: AdminVariant[] }>(`/api/admin/variants${query}`);
}

export function setVariantStatus(
  id: string,
  status: 'PROMOTED' | 'REJECTED'
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/admin/variants?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// ---------------------------------------------------------------------------
// Trilhas de conteúdo
// ---------------------------------------------------------------------------

export interface AdminTrailTopic {
  id: string;
  title: string;
  legalReference?: string;
  baseContent?: { question: string };
}

export interface AdminTrail {
  id: string;
  slug: string;
  name: string;
  description: string;
  tenantId: string | null;
  topics: AdminTrailTopic[];
  levels: string[];
  isPublished: boolean;
  order?: number;
  topicCount: number;
  topicsWithContent: number;
  updatedAt: string;
}

export function fetchTrails(): Promise<{ trails: AdminTrail[] }> {
  return request<{ trails: AdminTrail[] }>('/api/admin/trails');
}

export function updateTrail(
  id: string,
  patch: Record<string, unknown>
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/admin/trails?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
