/**
 * GET /api/law — consulta ao texto da lei.
 *
 * O aluno lê o tema em três minutos, mas quando precisa instruir um processo
 * a redação exata importa. Esta rota entrega o artigo tal como publicado, em
 * vez de deixá-lo confiar na paráfrase do reel.
 *
 *   /api/law?slug=lei-14133&article=75
 *   /api/law?slug=lei-14133&articles=74,75,76
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handleError, methodNotAllowed } from '../lib/http.js';
import { countLawArticles, getLawArticle, getLawArticles } from '../lib/repositories.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    const slug = String(req.query.slug || 'lei-14133');

    // Texto de lei não muda: cache longo, revalidação em segundo plano.
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');

    if (req.query.articles) {
      const numbers = String(req.query.articles)
        .split(',')
        .map((n) => n.trim())
        .filter((n) => /^\d+$/.test(n))
        .slice(0, 30);

      const articles = await getLawArticles(slug, numbers);
      return res.json({ articles });
    }

    if (req.query.article) {
      const number = String(req.query.article).trim();
      if (!/^\d+$/.test(number)) {
        return res.status(400).json({ error: 'Número de artigo inválido.' });
      }

      const article = await getLawArticle(slug, number);
      if (!article) {
        return res.status(404).json({ error: `Art. ${number} não encontrado.` });
      }
      return res.json({ article });
    }

    // Sem artigo pedido, informa se a lei está carregada — o app usa isso
    // para decidir se mostra o link "ver o texto".
    const count = await countLawArticles(slug);
    return res.json({ slug, articleCount: count, available: count > 0 });
  } catch (err) {
    return handleError(res, err, 'law');
  }
}
