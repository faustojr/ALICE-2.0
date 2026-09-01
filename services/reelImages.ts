/**
 * Acervo de imagens de fundo dos reels.
 *
 * Busca a lista uma vez por sessão e distribui as imagens pelos slides de
 * forma determinística: o mesmo módulo mostra sempre o mesmo fundo, o que
 * evita a tela "piscar" imagens diferentes a cada rolagem, mas módulos
 * vizinhos recebem imagens distintas.
 *
 * Quando o acervo não carrega (offline, primeira execução antes da carga),
 * cai num gradiente gerado localmente — nunca num fundo preto.
 */

export interface ReelImageRef {
  id: string;
  url: string;
  tags: string[];
}

let cache: ReelImageRef[] | null = null;
let inFlight: Promise<ReelImageRef[]> | null = null;

const STORAGE_KEY = 'alice_reel_images_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readLocalCache(): ReelImageRef[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return Array.isArray(parsed.images) && parsed.images.length > 0
      ? parsed.images
      : null;
  } catch {
    return null;
  }
}

function writeLocalCache(images: ReelImageRef[]) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ images, cachedAt: Date.now() })
    );
  } catch {
    // Cota de armazenamento cheia não é motivo para falhar.
  }
}

export async function loadReelImages(): Promise<ReelImageRef[]> {
  if (cache) return cache;

  const local = readLocalCache();
  if (local) {
    cache = local;
    return local;
  }

  // Uma requisição por vez, mesmo com vários slides pedindo ao mesmo tempo.
  if (inFlight) return inFlight;

  inFlight = fetch('/api/reelImages')
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error('falha'))))
    .then((data) => {
      const images: ReelImageRef[] = data.images ?? [];
      if (images.length > 0) {
        cache = images;
        writeLocalCache(images);
      }
      return images;
    })
    .catch(() => [])
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/**
 * Gradiente determinístico, usado enquanto o acervo não está disponível.
 * É um data URI: não depende de rede nem de arquivo no servidor.
 */
export function gradientFallback(seed: number): string {
  const palettes = [
    ['#1e3a8a', '#312e81'],
    ['#134e4a', '#164e63'],
    ['#1e293b', '#0f172a'],
    ['#3730a3', '#581c87'],
    ['#155e75', '#1e3a8a'],
    ['#14532d', '#134e4a'],
    ['#7c2d12', '#431407'],
    ['#334155', '#1e1b4b'],
  ];
  const [from, to] = palettes[Math.abs(seed) % palettes.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></linearGradient></defs><rect width="600" height="900" fill="url(#g)"/></svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Imagem de fundo para um slide. `seed` deve combinar módulo e posição do
 * slide para que o mesmo slide mostre sempre o mesmo fundo.
 */
export function pickImage(images: ReelImageRef[], seed: number): string {
  if (images.length === 0) return gradientFallback(seed);
  return images[Math.abs(seed) % images.length].url;
}
