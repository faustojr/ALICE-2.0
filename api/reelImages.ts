/**
 * GET /api/reelImages — banco de imagens de fundo dos reels.
 *
 * As imagens vivem no Firebase Storage e os metadados no Firestore. Antes o
 * app montava URLs do Unsplash a cada exibição, o que colocava um serviço de
 * terceiros no caminho crítico: internet ruim de prefeitura significava reel
 * com fundo preto.
 *
 * A resposta é cacheável por bastante tempo — o acervo muda raramente.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handleError, methodNotAllowed } from '../lib/http.js';
import { listReelImages } from '../lib/repositories.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    const images = await listReelImages();

    // O CDN da Vercel guarda por 1h e serve a versão antiga por 24h enquanto
    // revalida, então uma carga nova aparece sem deixar ninguém esperando.
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=86400'
    );

    return res.json({
      count: images.length,
      images: images.map((img) => ({
        id: img.id,
        url: img.url,
        tags: img.tags,
        credit: img.credit,
      })),
    });
  } catch (err) {
    return handleError(res, err, 'reelImages');
  }
}
