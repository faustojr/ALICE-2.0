#!/usr/bin/env node
/**
 * Carga do acervo de fundos dos reels.
 *
 * Busca fotos na API do Pexels, redimensiona para média resolução, envia ao
 * Firebase Storage e registra os metadados no Firestore com a procedência de
 * cada imagem.
 *
 * Rode na sua máquina, não no CI: precisa de rede aberta e das credenciais
 * de administrador do projeto.
 *
 *   PEXELS_API_KEY=...            (grátis em pexels.com/api)
 *   FIREBASE_SERVICE_ACCOUNT=...  (JSON da service account, ou base64)
 *   FIREBASE_STORAGE_BUCKET=...   (ex: seu-projeto.firebasestorage.app)
 *
 *   node scripts/seedReelImages.mjs            # carga completa
 *   node scripts/seedReelImages.mjs --dry-run  # só lista o que faria
 *
 * Por que a API e não uma lista fixa de URLs: a API devolve o autor e o link
 * da foto, que é o que permite creditar corretamente. Uma lista de URLs
 * escrita à mão envelhece e não carrega procedência.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';

const TARGET_COUNT = 40;

/**
 * Termos de busca. Escolhidos para render fundos que combinam com o contexto
 * de trabalho de um servidor municipal, sem competir com o texto do slide:
 * cenas com espaço negativo e pouca gente olhando para a câmera.
 */
const QUERIES = [
  { q: 'government office building', tags: ['prédio público', 'institucional'] },
  { q: 'office desk documents', tags: ['documentos', 'mesa'] },
  { q: 'business meeting table', tags: ['reunião', 'equipe'] },
  { q: 'signing contract paperwork', tags: ['contrato', 'assinatura'] },
  { q: 'archive folders shelves', tags: ['arquivo', 'pastas'] },
  { q: 'city hall architecture', tags: ['prefeitura', 'fachada'] },
  { q: 'construction site planning', tags: ['obra', 'engenharia'] },
  { q: 'laptop workspace minimal', tags: ['computador', 'trabalho'] },
  { q: 'library law books', tags: ['legislação', 'estudo'] },
  { q: 'calculator financial planning', tags: ['orçamento', 'finanças'] },
];

const DRY_RUN = process.argv.includes('--dry-run');

// --- Credenciais ------------------------------------------------------------

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET;

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

if (!PEXELS_API_KEY) {
  fail('PEXELS_API_KEY não definida. Crie uma chave gratuita em https://www.pexels.com/api/');
}
if (!DRY_RUN && !process.env.FIREBASE_SERVICE_ACCOUNT) {
  fail('FIREBASE_SERVICE_ACCOUNT não definida.');
}
if (!DRY_RUN && !STORAGE_BUCKET) {
  fail('FIREBASE_STORAGE_BUCKET não definida (ex: seu-projeto.firebasestorage.app).');
}

// --- Firebase ---------------------------------------------------------------

function initFirebase() {
  if (getApps().length > 0) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const decoded = raw.trim().startsWith('{')
    ? raw
    : Buffer.from(raw, 'base64').toString('utf8');
  const serviceAccount = JSON.parse(decoded);

  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
    storageBucket: STORAGE_BUCKET,
  });
}

// --- Pexels -----------------------------------------------------------------

async function searchPexels(query, perPage) {
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('orientation', 'portrait'); // reels são verticais
  url.searchParams.set('size', 'medium');

  const response = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
  if (!response.ok) {
    throw new Error(`Pexels respondeu ${response.status} para "${query}"`);
  }
  const data = await response.json();
  return data.photos ?? [];
}

async function collectPhotos() {
  const perQuery = Math.ceil(TARGET_COUNT / QUERIES.length);
  const collected = [];
  const seen = new Set();

  for (const { q, tags } of QUERIES) {
    process.stdout.write(`  buscando "${q}"... `);
    try {
      const photos = await searchPexels(q, perQuery + 2);
      let added = 0;
      for (const photo of photos) {
        if (collected.length >= TARGET_COUNT) break;
        if (seen.has(photo.id)) continue;
        seen.add(photo.id);
        collected.push({ photo, tags });
        added += 1;
        if (added >= perQuery) break;
      }
      console.log(`${added} imagens`);
    } catch (err) {
      console.log(`falhou (${err.message})`);
    }
  }

  return collected;
}

// --- Processamento ----------------------------------------------------------

/**
 * 600x900 a 80% de qualidade. É o suficiente para um fundo atrás de texto num
 * celular e mantém cada arquivo em torno de 100 KB — o que importa para quem
 * abre o app na rede da prefeitura.
 */
async function processImage(sourceUrl) {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`download falhou (${response.status})`);
  const input = Buffer.from(await response.arrayBuffer());

  return sharp(input)
    .resize(600, 900, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 80, progressive: true, mozjpeg: true })
    .toBuffer();
}

// --- Execução ---------------------------------------------------------------

async function main() {
  console.log(`\nAcervo de fundos dos reels — meta: ${TARGET_COUNT} imagens`);
  if (DRY_RUN) console.log('MODO DE TESTE: nada será enviado.\n');
  else console.log('');

  const collected = await collectPhotos();

  if (collected.length === 0) {
    fail('Nenhuma imagem encontrada. Verifique a PEXELS_API_KEY e a conexão.');
  }
  console.log(`\n${collected.length} imagens selecionadas.\n`);

  if (DRY_RUN) {
    collected.forEach(({ photo, tags }, i) => {
      console.log(
        `  ${String(i + 1).padStart(2, '0')}. ${photo.photographer} — ${tags.join(', ')}`
      );
      console.log(`      ${photo.url}`);
    });
    console.log('\nRode sem --dry-run para enviar.\n');
    return;
  }

  initFirebase();
  const db = getFirestore(process.env.FIRESTORE_DATABASE_ID || undefined);
  const bucket = getStorage().bucket();

  let uploaded = 0;
  let failed = 0;

  for (const [i, { photo, tags }] of collected.entries()) {
    const id = `reel-${String(i + 1).padStart(3, '0')}`;
    process.stdout.write(`  ${id} ... `);

    try {
      const buffer = await processImage(photo.src.large || photo.src.original);
      const storagePath = `reel-images/${id}.jpg`;
      const file = bucket.file(storagePath);

      await file.save(buffer, {
        contentType: 'image/jpeg',
        metadata: {
          // Imutável: o conteúdo de um id nunca muda, então o navegador pode
          // guardar para sempre.
          cacheControl: 'public, max-age=31536000, immutable',
        },
      });
      await file.makePublic();

      const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

      await db.collection('reelImages').doc(id).set({
        id,
        url,
        storagePath,
        width: 600,
        height: 900,
        sizeBytes: buffer.length,
        tags,
        credit: {
          source: 'Pexels',
          author: photo.photographer,
          sourceUrl: photo.url,
          license: 'Pexels License',
        },
        createdAt: new Date().toISOString(),
      });

      uploaded += 1;
      console.log(`ok (${Math.round(buffer.length / 1024)} KB)`);
    } catch (err) {
      failed += 1;
      console.log(`falhou: ${err.message}`);
    }
  }

  console.log(`\n${uploaded} enviadas, ${failed} falharam.`);
  if (uploaded > 0) {
    console.log('Confira em appalice.cloud — os reels já devem usar o acervo novo.\n');
  }
}

main().catch((err) => {
  console.error('\nErro:', err);
  process.exit(1);
});
