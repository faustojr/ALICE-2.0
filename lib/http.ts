/**
 * Utilitários compartilhados pelas Vercel Functions.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AuthError } from './auth.js';

export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const origin = req.headers.origin;

  if (allowed.length === 0) {
    // Sem allowlist configurada, responde apenas para same-origin.
    res.setHeader('Access-Control-Allow-Origin', 'null');
  } else if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

export function methodNotAllowed(res: VercelResponse, allowed: string[]) {
  res.setHeader('Allow', allowed.join(', '));
  res.status(405).json({ error: 'Método não permitido.' });
}

/**
 * Converte exceções em respostas HTTP. Erros inesperados não vazam a
 * mensagem interna para o cliente, mas ficam no log da função.
 */
export function handleError(res: VercelResponse, err: unknown, context: string) {
  if (err instanceof AuthError) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(`[${context}]`, err);

  const message =
    err instanceof Error && err.message.startsWith('Já existe')
      ? err.message
      : 'Erro interno ao processar a solicitação.';

  return res.status(500).json({ error: message });
}

/** Rate limit em memória. Vale por instância — é uma barreira, não a única. */
const buckets = new Map<string, { count: number; windowStart: number }>();

export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((windowMs - (now - bucket.windowStart)) / 1000),
    };
  }

  // Poda oportunista para o Map não crescer sem limite numa instância longeva.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (now - v.windowStart > windowMs) buckets.delete(k);
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function clientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0];
  return req.socket?.remoteAddress || 'unknown';
}
