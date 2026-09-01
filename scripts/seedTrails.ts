#!/usr/bin/env tsx
/**
 * Carga inicial das trilhas no Firestore.
 *
 * O conteúdo da Lei 14.133 vivia dentro de services/geminiService.ts, o que
 * amarrava a plataforma a uma trilha só. Este script move esse material para
 * a coleção `trails`, de onde a aplicação passa a lê-lo.
 *
 *   npm run seed:trails:dry   # mostra o que faria, sem gravar
 *   npm run seed:trails       # grava
 *
 * É idempotente: rodar de novo atualiza sem duplicar. Uma trilha já editada
 * pelo console é preservada, salvo com --force.
 */

import { getDb } from '../lib/firebaseAdmin.js';
import { SEED_TRAILS } from '../lib/seedTrails.js';

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

async function main() {
  console.log(`\nTrilhas a carregar: ${SEED_TRAILS.length}`);

  for (const trail of SEED_TRAILS) {
    const comConteudo = trail.topics.filter((t) => t.baseContent).length;
    console.log(`\n  ${trail.slug} — ${trail.name}`);
    console.log(`    ${trail.topics.length} tópicos, ${comConteudo} com conteúdo escrito`);
    if (DRY_RUN) {
      trail.topics.forEach((t, i) => {
        const marca = t.baseContent ? '✓' : '·';
        console.log(`      ${marca} ${String(i + 1).padStart(2, '0')}. ${t.title}`);
      });
    }
  }

  if (DRY_RUN) {
    console.log('\nMODO DE TESTE: nada foi gravado.\n');
    return;
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('\n  FIREBASE_SERVICE_ACCOUNT não definida.\n');
    process.exit(1);
  }

  const db = getDb();
  console.log('');

  for (const trail of SEED_TRAILS) {
    const ref = db.collection('trails').doc(trail.id);
    const existing = await ref.get();

    if (existing.exists && !FORCE) {
      const current = existing.data() as { createdAt?: string; updatedAt?: string };
      // Não sobrescreve o que foi editado pelo console sem que se peça.
      if (current.updatedAt && current.updatedAt !== current.createdAt) {
        console.log(`  ${trail.slug}: já existe e foi editada — preservada (use --force).`);
        continue;
      }
    }

    await ref.set({ ...trail, updatedAt: new Date().toISOString() }, { merge: !FORCE });
    console.log(`  ${trail.slug}: ${existing.exists ? 'atualizada' : 'criada'}.`);
  }

  console.log('\nPronto. As trilhas agora vêm do banco.\n');
}

main().catch((err) => {
  console.error('\nErro:', err);
  process.exit(1);
});
