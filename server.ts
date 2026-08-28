/**
 * Servidor de desenvolvimento local.
 *
 * Em produção o app roda na Vercel, onde cada arquivo em /api é uma função
 * serverless. Aqui montamos exatamente os mesmos handlers sobre o Express,
 * para que dev e produção executem o mesmo código — nada de lógica duplicada
 * que diverge com o tempo.
 */

import express, { type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

const PORT = Number(process.env.PORT) || 3000;

/** Rotas expostas, no mesmo caminho em que a Vercel as publica. */
const ROUTES: { path: string; module: string }[] = [
  { path: '/api/generateModule', module: './api/generateModule.ts' },
  { path: '/api/progress', module: './api/progress.ts' },
  { path: '/api/leads', module: './api/leads.ts' },
  { path: '/api/admin/tenants', module: './api/admin/tenants.ts' },
  { path: '/api/admin/overview', module: './api/admin/overview.ts' },
];

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  for (const route of ROUTES) {
    app.all(route.path, async (req: Request, res: Response) => {
      try {
        // Import dinâmico a cada request: edições em /api valem sem reiniciar.
        const mod = await import(`${route.module}?t=${Date.now()}`);
        await mod.default(req as any, res as any);
      } catch (err) {
        console.error(`[dev] erro em ${route.path}:`, err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Erro interno no servidor de desenvolvimento.' });
        }
      }
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ALICE rodando em http://localhost:${PORT}`);
    console.log(`Rotas de API: ${ROUTES.map((r) => r.path).join(', ')}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar o servidor:', err);
  process.exit(1);
});
