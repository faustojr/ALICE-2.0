/**
 * POST /api/leads — captura de lead da landing page (aprendacomalice.com).
 *
 * Rota pública por natureza. Protegida por rate limit e validação estrita;
 * a leitura dos leads exige super admin (ver /api/admin/overview).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, clientIp, handleError, methodNotAllowed, rateLimit } from '../lib/http.js';
import { createLead } from '../lib/repositories.js';

const UF_LIST = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const limit = rateLimit(`lead:${clientIp(req)}`, 5, 60 * 60 * 1000);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({ error: 'Muitas solicitações. Tente mais tarde.' });
    }

    const { name, email, municipality, uf, role, phone, population, message } = req.body ?? {};

    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: 'Informe seu nome.' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }
    if (!municipality || String(municipality).trim().length < 2) {
      return res.status(400).json({ error: 'Informe o município.' });
    }
    if (!uf || !UF_LIST.includes(String(uf).toUpperCase())) {
      return res.status(400).json({ error: 'Informe uma UF válida.' });
    }

    // Limites de tamanho evitam que o formulário vire vetor de armazenamento.
    const trim = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

    await createLead({
      name: trim(name, 120),
      email: trim(email, 160),
      municipality: trim(municipality, 120),
      uf: String(uf).toUpperCase(),
      role: trim(role, 120) || undefined,
      phone: trim(phone, 40) || undefined,
      population: trim(population, 40) || undefined,
      message: trim(message, 1000) || undefined,
      source: 'landing:aprendacomalice.com',
    });

    return res.status(201).json({
      ok: true,
      message: 'Recebemos seu contato. Retornamos em até um dia útil.',
    });
  } catch (err) {
    return handleError(res, err, 'leads');
  }
}
