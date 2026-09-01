/**
 * /api/surveys — pesquisas pré e pós-uso do piloto.
 *
 * Estes dados alimentam a avaliação do piloto e a pesquisa acadêmica, então
 * perdê-los é pior do que uma falha visível: antes as gravações iam direto do
 * navegador para o Firestore e, com as regras fechadas, cairiam silenciosamente
 * no localStorage sem ninguém perceber.
 *
 * GET  ?email=...  → status de preenchimento (pré e pós)
 * POST             → grava uma das pesquisas
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, clientIp, handleError, methodNotAllowed, rateLimit } from '../lib/http.js';
import { findTenantByEmailDomain, resolveUnverifiedStudent } from '../lib/auth.js';
import { getDb, COLLECTIONS, emailKey } from '../lib/firebaseAdmin.js';
import { upsertMembership, upsertUser } from '../lib/repositories.js';

/** Campos aceitos por fase. Qualquer outro é descartado. */
const PRE_FIELDS = [
  'pre_experienceTime',
  'pre_formalCapacitation',
  'pre_generalKnowledge',
  'pre_prepKnowledge',
  'pre_confidenceBasic',
  'pre_interestCustomTool',
  'pre_tempoAtuacao',
] as const;

const POST_FIELDS = [
  'pos_daysUsed',
  'pos_generalKnowledge',
  'pos_prepKnowledge',
  'pos_confidenceBasic',
  'pos_usability',
  'pos_recommendation',
  'pos_contentQuality',
  'pos_comments',
] as const;

function pick(source: Record<string, unknown>, allowed: readonly string[]) {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    const value = source[key];
    if (value === undefined || value === null) continue;
    // Texto livre é truncado; o resto entra como número ou string curta.
    out[key] = typeof value === 'string' ? value.slice(0, 2000) : value;
  }
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  try {
    const db = getDb();

    if (req.method === 'GET') {
      const email = String(req.query.email || '');
      if (!email) return res.status(400).json({ error: 'E-mail não informado.' });

      const key = emailKey(email);
      const snap = await db.collection(COLLECTIONS.surveys).doc(key).get();

      if (!snap.exists) {
        return res.json({ preCompleted: false, postCompleted: false, survey: null });
      }

      const data = snap.data() ?? {};
      // Mesma checagem que o front fazia, agora num lugar só.
      const preCompleted =
        data.pre_generalKnowledge !== undefined ||
        data.pre_tempoAtuacao !== undefined ||
        data.pre_experienceTime !== undefined ||
        data.timestampPre !== undefined;

      const postCompleted =
        data.pos_daysUsed !== undefined ||
        data.pos_generalKnowledge !== undefined ||
        data.timestamp !== undefined;

      return res.json({ preCompleted, postCompleted, survey: data });
    }

    if (req.method === 'POST') {
      const limit = rateLimit(`survey:${clientIp(req)}`, 30, 60 * 60 * 1000);
      if (!limit.allowed) {
        res.setHeader('Retry-After', String(limit.retryAfterSeconds));
        return res.status(429).json({ error: 'Muitos envios. Aguarde um momento.' });
      }

      const { email, phase, answers, name } = req.body ?? {};

      if (!email) return res.status(400).json({ error: 'E-mail não informado.' });
      if (phase !== 'pre' && phase !== 'post') {
        return res.status(400).json({ error: 'Fase inválida (use "pre" ou "post").' });
      }
      if (!answers || typeof answers !== 'object') {
        return res.status(400).json({ error: 'Respostas não informadas.' });
      }

      const session = await resolveUnverifiedStudent(String(email));
      const key = session.email;
      const now = new Date().toISOString();

      const payload =
        phase === 'pre'
          ? { ...pick(answers, PRE_FIELDS), timestampPre: now }
          : { ...pick(answers, POST_FIELDS), timestamp: now };

      if (Object.keys(payload).length <= 1) {
        return res.status(400).json({ error: 'Nenhuma resposta reconhecida.' });
      }

      await db
        .collection(COLLECTIONS.surveys)
        .doc(key)
        .set({ email: key, tenantId: session.tenantId ?? null, ...payload }, { merge: true });

      // Vincula ao tenant pelo domínio, se ainda não houver vínculo.
      let tenantId = session.tenantId;
      if (!tenantId) {
        tenantId = await findTenantByEmailDomain(key);
        if (tenantId) await upsertMembership(tenantId, key, 'ALUNO');
      }

      await upsertUser(key, {
        name: name || key.split('@')[0],
        tenantId: tenantId ?? null,
        status: phase === 'pre' ? 'ativo' : 'completed',
        pilotStatus: phase === 'pre' ? 'ativo' : 'completed',
      });

      return res.status(201).json({ ok: true, phase, tenantId });
    }

    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (err) {
    return handleError(res, err, 'surveys');
  }
}
