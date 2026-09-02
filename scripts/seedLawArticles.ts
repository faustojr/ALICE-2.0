#!/usr/bin/env tsx
/**
 * Importa o texto integral da Lei 14.133/21 para a coleção `lawArticles`.
 *
 * Os tópicos da trilha ensinam por tema; o texto existe para o aluno conferir
 * a redação exata e para a IA citar o dispositivo em vez de parafrasear de
 * memória — numa plataforma que capacita quem assina processo, a diferença
 * entre citar e lembrar é relevante.
 *
 *   npm run seed:lei:dry    # baixa e mostra o que encontrou, sem gravar
 *   npm run seed:lei        # grava
 *   npm run seed:lei -- --file=lei.htm   # usa um arquivo local já baixado
 *
 * A fonte padrão é o Planalto. Se a rede da sua máquina bloquear o acesso,
 * salve a página manualmente e use --file.
 */

import { readFileSync } from 'node:fs';
import { getDb } from '../lib/firebaseAdmin.js';
import type { LawArticle } from '../types.js';

const LAW_SLUG = 'lei-14133';
const SOURCE_URL =
  'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm';

const DRY_RUN = process.argv.includes('--dry-run');
const fileArg = process.argv.find((a) => a.startsWith('--file='));

/**
 * Entidades nomeadas que aparecem no texto do Planalto.
 *
 * Uma tabela parcial deixaria "licita&ccedil;&atilde;o" cru no banco, e o
 * aluno leria lixo em vez do texto da lei — daí a cobertura das acentuadas
 * do português inteira, não só as de pontuação.
 */
const HTML_ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  ordm: 'º', ordf: 'ª', sect: '§', deg: '°', middot: '·',
  laquo: '«', raquo: '»', ldquo: '"', rdquo: '"', lsquo: "'", rsquo: "'",
  ndash: '–', mdash: '—', hellip: '…', bull: '•',
  aacute: 'á', Aacute: 'Á', agrave: 'à', Agrave: 'À',
  acirc: 'â', Acirc: 'Â', atilde: 'ã', Atilde: 'Ã', auml: 'ä', Auml: 'Ä',
  eacute: 'é', Eacute: 'É', egrave: 'è', Egrave: 'È',
  ecirc: 'ê', Ecirc: 'Ê', euml: 'ë', Euml: 'Ë',
  iacute: 'í', Iacute: 'Í', icirc: 'î', Icirc: 'Î', iuml: 'ï', Iuml: 'Ï',
  oacute: 'ó', Oacute: 'Ó', ocirc: 'ô', Ocirc: 'Ô',
  otilde: 'õ', Otilde: 'Õ', ouml: 'ö', Ouml: 'Ö',
  uacute: 'ú', Uacute: 'Ú', ucirc: 'û', Ucirc: 'Û', uuml: 'ü', Uuml: 'Ü',
  ccedil: 'ç', Ccedil: 'Ç', ntilde: 'ñ', Ntilde: 'Ñ',
};

function decodeEntities(text: string): string {
  return text
    .replace(/&([a-zA-Z]+);/g, (match, name) => HTML_ENTITIES[name] ?? match)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

/** Remove marcação e normaliza espaços, preservando a pontuação do texto. */
function stripHtml(html: string): string {
  const withoutTags = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return decodeEntities(withoutTags)
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Divide o texto em artigos.
 *
 * A numeração muda de forma ao longo da lei — "Art. 1º", "Art. 10", "Art.
 * 191." — então a expressão aceita as três e o corte vai de um marcador ao
 * seguinte, o que evita perder parágrafos no meio.
 */
function parseArticles(text: string): LawArticle[] {
  const marker = /\bArt\.\s*(\d+)\s*(?:º|o|°)?\s*[.\-–]?\s*/g;
  const hits: { number: string; start: number; end: number }[] = [];

  let m: RegExpExecArray | null;
  while ((m = marker.exec(text)) !== null) {
    hits.push({ number: m[1], start: m.index, end: m.index + m[0].length });
  }

  const now = new Date().toISOString();
  const seen = new Set<string>();
  const articles: LawArticle[] = [];

  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i];
    // Referências cruzadas ("na forma do art. 75") repetem o número; a
    // primeira ocorrência é a que abre o artigo de fato.
    if (seen.has(hit.number)) continue;

    const body = text.slice(hit.end, hits[i + 1]?.start ?? text.length).trim();
    if (body.length < 20) continue;

    seen.add(hit.number);

    const lines = body
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const caput: string[] = [];
    const items: { label: string; text: string }[] = [];

    for (const line of lines) {
      // Incisos (romanos), parágrafos e alíneas viram itens próprios; o resto
      // antes deles é o caput.
      const item = line.match(
        /^((?:[IVXLC]+\s*[-–—])|(?:§\s*\d+\s*[ºo°]?)|(?:Par[áa]grafo\s+único)|(?:[a-z]\)))\s*(.*)$/i
      );
      if (item) {
        items.push({ label: item[1].trim(), text: item[2].trim().slice(0, 4000) });
      } else if (items.length === 0) {
        caput.push(line);
      } else {
        // Continuação do último item, quebrada por linha no HTML de origem.
        items[items.length - 1].text = `${items[items.length - 1].text} ${line}`.slice(0, 4000);
      }
    }

    articles.push({
      id: `${LAW_SLUG}__art${hit.number}`,
      lawSlug: LAW_SLUG,
      number: hit.number,
      caput: caput.join(' ').slice(0, 6000),
      items: items.slice(0, 60),
      createdAt: now,
    });
  }

  return articles.sort((a, b) => Number(a.number) - Number(b.number));
}

async function loadSource(): Promise<string> {
  if (fileArg) {
    const path = fileArg.split('=')[1];
    console.log(`  lendo ${path}`);
    return readFileSync(path, 'latin1');
  }

  console.log(`  baixando ${SOURCE_URL}`);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(
      `Planalto respondeu ${response.status}. ` +
        'Salve a página no navegador e rode com --file=caminho.htm'
    );
  }
  // O Planalto serve a página em ISO-8859-1.
  const buffer = Buffer.from(await response.arrayBuffer());
  return new TextDecoder('iso-8859-1').decode(buffer);
}

async function main() {
  console.log('\nLei 14.133/21 — importação do texto integral\n');

  const html = await loadSource();
  const articles = parseArticles(stripHtml(html));

  console.log(`\n  ${articles.length} artigos identificados`);

  if (articles.length < 150) {
    console.warn(
      `\n  ATENÇÃO: a lei tem 194 artigos e foram encontrados ${articles.length}.\n` +
        '  Confira a fonte antes de gravar — o layout da página pode ter mudado.\n'
    );
  }

  if (DRY_RUN) {
    for (const a of articles.slice(0, 5)) {
      console.log(`\n  Art. ${a.number}`);
      console.log(`    ${a.caput.slice(0, 160)}${a.caput.length > 160 ? '…' : ''}`);
      if (a.items.length) console.log(`    (${a.items.length} incisos/parágrafos)`);
    }
    console.log(`\n  ...e mais ${Math.max(0, articles.length - 5)} artigos.`);
    console.log('\nMODO DE TESTE: nada foi gravado.\n');
    return;
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('\n  FIREBASE_SERVICE_ACCOUNT não definida.\n');
    process.exit(1);
  }

  const db = getDb();
  let written = 0;

  // O Firestore aceita 500 operações por lote.
  for (let i = 0; i < articles.length; i += 400) {
    const batch = db.batch();
    for (const article of articles.slice(i, i + 400)) {
      batch.set(db.collection('lawArticles').doc(article.id), article);
      written += 1;
    }
    await batch.commit();
    process.stdout.write(`\r  gravados ${written}/${articles.length}`);
  }

  console.log('\n\nPronto. O texto da lei está disponível para consulta.\n');
}

main().catch((err) => {
  console.error('\nErro:', err.message ?? err);
  process.exit(1);
});
