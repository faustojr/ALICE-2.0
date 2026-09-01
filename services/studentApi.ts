/**
 * Cliente das rotas do aluno.
 *
 * Substitui as gravações diretas do navegador no Firestore. O padrão anterior
 * — `setDoc` dentro de um try/catch que caía no localStorage — passava a
 * perder dados em silêncio assim que as regras de segurança fecharam o banco:
 * o app seguia funcionando e nada chegava ao servidor.
 *
 * Aqui a resiliência offline é mantida de propósito (rede de prefeitura é
 * instável), mas de forma explícita: o que falha vai para uma fila e é
 * reenviado, e o chamador sabe se a gravação foi confirmada.
 */

import type { UserState } from '../types';

const QUEUE_KEY = 'alice_pending_writes_v1';

export interface SyncResult {
  /** true quando o servidor confirmou a gravação. */
  synced: boolean;
  /** Preenchido quando a gravação ficou pendente ou foi recusada. */
  error?: string;
  /** true quando o dado foi enfileirado para reenvio. */
  queued?: boolean;
}

interface PendingWrite {
  id: string;
  path: string;
  body: unknown;
  attemptedAt: string;
}

// ---------------------------------------------------------------------------
// Fila de reenvio
// ---------------------------------------------------------------------------

function readQueue(): PendingWrite[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: PendingWrite[]) {
  try {
    // Teto para a fila não crescer sem limite num dispositivo offline por dias.
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-50)));
  } catch (err) {
    console.warn('Não foi possível persistir a fila de sincronização:', err);
  }
}

function enqueue(path: string, body: unknown) {
  const queue = readQueue();
  // Uma pendência por rota: o estado mais recente substitui o anterior.
  const filtered = queue.filter((item) => item.path !== path);
  filtered.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    path,
    body,
    attemptedAt: new Date().toISOString(),
  });
  writeQueue(filtered);
}

async function post(path: string, body: unknown, queueOnFailure = true): Promise<SyncResult> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const message = data.error || `Falha ao sincronizar (${response.status}).`;

      // 4xx é dado recusado: reenviar não resolve e só entope a fila.
      if (response.status >= 400 && response.status < 500) {
        return { synced: false, error: message };
      }

      if (queueOnFailure) enqueue(path, body);
      return { synced: false, error: message, queued: queueOnFailure };
    }

    return { synced: true };
  } catch (err) {
    // Rede indisponível: guarda para reenviar quando voltar.
    if (queueOnFailure) enqueue(path, body);
    return {
      synced: false,
      error: err instanceof Error ? err.message : 'Sem conexão.',
      queued: queueOnFailure,
    };
  }
}

/** Reenvia o que ficou pendente. Chamada quando o navegador volta a ficar online. */
export async function flushPendingWrites(): Promise<number> {
  const queue = readQueue();
  if (queue.length === 0) return 0;

  const remaining: PendingWrite[] = [];
  let sent = 0;

  for (const item of queue) {
    const result = await post(item.path, item.body, false);
    if (result.synced) {
      sent += 1;
    } else if (result.queued !== false && !result.error?.includes('Falha ao sincronizar (4')) {
      remaining.push(item);
    }
  }

  writeQueue(remaining);
  return sent;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushPendingWrites().catch(() => {});
  });
}

// ---------------------------------------------------------------------------
// Progresso
// ---------------------------------------------------------------------------

export async function saveProgress(
  email: string,
  progress: Partial<UserState> & Record<string, unknown>
): Promise<SyncResult> {
  return post('/api/progress', { email, progress });
}

export async function fetchProgress(
  email: string
): Promise<{ user: Record<string, unknown> | null; tenantId: string | null } | null> {
  try {
    const response = await fetch(`/api/progress?email=${encodeURIComponent(email)}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pesquisas do piloto
// ---------------------------------------------------------------------------

export async function submitSurvey(
  email: string,
  phase: 'pre' | 'post',
  answers: Record<string, unknown>,
  name?: string
): Promise<SyncResult> {
  return post('/api/surveys', { email, phase, answers, name });
}

export interface SurveyStatus {
  preCompleted: boolean;
  postCompleted: boolean;
  survey: Record<string, unknown> | null;
}

export async function fetchSurveyStatus(email: string): Promise<SurveyStatus | null> {
  try {
    const response = await fetch(`/api/surveys?email=${encodeURIComponent(email)}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Resultado do quiz — alimenta a promoção de variantes
// ---------------------------------------------------------------------------

export interface QuizResultResponse {
  ok: boolean;
  promoted: boolean;
  correctCount?: number;
  threshold?: number;
}

/**
 * Informa o acerto ou erro numa variante. Quando alunos distintos o bastante
 * acertam, o servidor promove aquela variante a conteúdo padrão do módulo.
 *
 * Sem fila de reenvio: é telemetria de aprendizado, e uma resposta perdida
 * por rede instável apenas adia a promoção — não corrompe nada.
 */
export async function reportQuizResult(
  email: string,
  variantId: string,
  correct: boolean
): Promise<QuizResultResponse | null> {
  try {
    const response = await fetch('/api/quizResult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, variantId, correct }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
