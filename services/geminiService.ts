import { ModuleContent, Slide } from '../types';
import { auth } from '../firebase';
import { loadReelImages, pickImage } from './reelImages';

/**
 * Fundo de um slide, vindo do acervo próprio no Firebase Storage.
 *
 * O seed combina módulo e posição para que o mesmo slide mostre sempre a
 * mesma imagem: fundo trocando a cada rolagem distrai de um conteúdo que já
 * dura três minutos.
 */
async function imageForSlide(moduleIndex: number, slideIndex: number): Promise<string> {
  const images = await loadReelImages();
  return pickImage(images, moduleIndex * 3 + slideIndex);
}

const CACHE_KEY = 'alice_module_cache';

/** Tópico devolvido pela última consulta a /api/module, usado no fallback. */
let lastTopic: { title: string; legalReference: string | null } | null = null;

interface CacheEntry {
    content: ModuleContent;
    cachedAt: number;
}

function getCache(): Record<string, any> {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        return cached ? JSON.parse(cached) : {};
    } catch (e) {
        return {};
    }
}

function setCache(key: string, content: ModuleContent) {
    try {
        const cache = getCache();
        cache[key] = {
            content,
            cachedAt: Date.now()
        };
        // Limit cache size to avoid localStorage limits (e.g., keep last 50 modules)
        const keys = Object.keys(cache);
        if (keys.length > 50) {
            delete cache[keys[0]];
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
        console.error("Cache saving error:", e);
    }
}

function getValidCacheContent(key: string, failCount: number): ModuleContent | null {
    const cache = getCache();
    const entry = cache[key];
    if (!entry) return null;
    
    // Check if it's a new structure
    if (entry && typeof entry === 'object' && 'content' in entry && 'cachedAt' in entry) {
        // Only use cache if it was created less than 24 hours ago
        if (failCount === 0 && (Date.now() - entry.cachedAt < 24 * 60 * 60 * 1000)) {
            return entry.content;
        }
    } else if (failCount === 0) {
        // Legacy cache format support (robustness)
        return entry as ModuleContent;
    }
    return null;
}

/**
 * Conteúdo do módulo vindo do servidor: a variante promovida por acertos ou,
 * na falta dela, o texto escrito na trilha. Retorna null só quando a trilha
 * não tem conteúdo para aquele tópico.
 */
async function fetchServerContent(
    trail: string,
    index: number,
    level: 'Básico' | 'Intermediário' | 'Especialista'
): Promise<ModuleContent | null> {
    try {
        const email = auth.currentUser?.email;
        const params = new URLSearchParams({ trail, level, index: String(index) });
        if (email) params.set('email', email);

        const response = await fetch(`/api/module?${params}`);
        if (!response.ok) return null;

        const data = await response.json();
        lastTopic = data.topic ?? null;
        if (!data.variant) return null;

        const content = data.variant.content;
        const slides: Slide[] = await Promise.all(
            content.slideTexts.map(async (text: string, i: number) => ({
                text,
                imageUrl: await imageForSlide(index, i),
            }))
        );

        return {
            title: content.title,
            slides,
            question: content.question,
            options: content.options,
            feedbackCorrect: content.feedbackCorrect,
            feedbackWrong: content.feedbackWrong,
            variationId: data.variant.variationId,
            variantId: data.variant.id,
        };
    } catch {
        // Sem rede, o conteúdo padrão local resolve.
        return null;
    }
}

export async function generateReelsModule(
    trail: string, 
    index: number, 
    level: 'Básico' | 'Intermediário' | 'Especialista',
    isPrefetch: boolean = false,
    failCount: number = 0
): Promise<ModuleContent> {
    const cacheKey = `${trail}_${level}_${index}`;

    // Primeiro acesso: nenhuma chamada de IA. Servimos a variante que já provou
    // ensinar melhor (promovida por acertos de alunos anteriores) ou, na falta
    // dela, o conteúdo padrão do app. Em ambos os casos, custo zero.
    if (failCount === 0) {
        const served = await fetchServerContent(trail, index, level);
        if (served) return served;
        return await genericModuleContent(index, level, failCount);
    }

    // Check if we have it in cache first (apenas para tentativas de reestudo já geradas)
    const cachedContent = getValidCacheContent(cacheKey, failCount);
    if (cachedContent) {
        console.log("Serving from cache:", cacheKey);
        return cachedContent;
    }

    try {
        const response = await fetch('/api/generateModule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                trail, 
                index, 
                level, 
                failCount, 
                email: auth.currentUser?.email || undefined 
            })
        });
        
        if (!response.ok) {
            // If fetch fails but we have cache and it's not a re-attempt, use it
            const cachedContentCatch = getValidCacheContent(cacheKey, failCount);
            if (cachedContentCatch) return cachedContentCatch;
            throw new Error(`Failed to fetch from API: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Gerar imagens para cada slide em paralelo
        const slides: Slide[] = await Promise.all(
            data.slideTexts.map(async (text: string, i: number) => ({
                text,
                imageUrl: await imageForSlide(index, i)
            }))
        );

        const content: ModuleContent = {
            title: data.title,
            slides,
            question: data.question,
            options: data.options,
            feedbackCorrect: data.feedbackCorrect,
            feedbackWrong: data.feedbackWrong,
            variationId: data.variationId,
            variantId: data.variantId ?? undefined
        };

        // Store in cache for future offline use
        setCache(cacheKey, content);

        // Pre-fetch only the next 1 module in background to optimize costs (reduces unused API calls by 50%)
        if (!isPrefetch && failCount === 0 && navigator.onLine) {
            const prefetch = () => {
                const nextIndex = index + 1;
                const key1 = `${trail}_${level}_${nextIndex}`;
                
                // Only prefetch the next single module if it is not already in cache
                if (!getValidCacheContent(key1, 0)) {
                    generateReelsModule(trail, nextIndex, level, true).catch(() => {});
                }
            };

            // Use requestIdleCallback if available, with a safer 8-second delay
            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(() => {
                    setTimeout(prefetch, 8000);
                }, { timeout: 15000 });
            } else {
                setTimeout(prefetch, 8000);
            }
        }

        return content;
    } catch (e) {
        console.error("Error generating module:", e);
        
        // If error and we have cache (and not a re-attempt), use it
        const cachedContentErr = getValidCacheContent(cacheKey, failCount);
        if (cachedContentErr) return cachedContentErr;

        return await genericModuleContent(index, level, failCount);
    }
}

/**
 * Último recurso: sem variante, sem conteúdo na trilha e sem rede.
 *
 * O quiz aqui é sobre o próprio método de estudo, não sobre a lei: inventar
 * uma pergunta jurídica sem base seria pior do que não ter pergunta — o aluno
 * pode levar a resposta errada para um processo real.
 */
async function genericModuleContent(
    index: number,
    level: 'Básico' | 'Intermediário' | 'Especialista',
    failCount: number
): Promise<ModuleContent> {
    const topicName = lastTopic?.title ?? 'este tema';
    const images = await Promise.all(
        [0, 1, 2].map((slideIndex) => imageForSlide(index, slideIndex))
    );

    return {
        title: lastTopic?.title ?? `Módulo ${index + 1}`,
        slides: [
            {
                text: `Módulo #${index + 1} [${level}] — ${topicName}.`,
                imageUrl: images[0],
            },
            {
                text: lastTopic?.legalReference
                    ? `Base legal do tópico: ${lastTopic.legalReference}. Consulte o texto antes de aplicar.`
                    : 'O conteúdo detalhado deste módulo está sendo preparado.',
                imageUrl: images[1],
            },
            {
                text: failCount > 0
                    ? 'Sem conexão para carregar uma nova explicação. Tente novamente quando a rede voltar.'
                    : 'Conecte-se à internet para carregar o conteúdo completo deste módulo.',
                imageUrl: images[2],
            },
        ],
        question: 'Como você prefere continuar agora?',
        options: [
            { label: 'Seguir para o próximo módulo e voltar a este depois', value: 'correct' },
            { label: 'Encerrar o estudo por hoje', value: 'wrong' },
        ],
        feedbackCorrect: 'Combinado. Este módulo fica disponível assim que a conexão voltar.',
        feedbackWrong: 'Sem problema. Seu progresso está salvo e você retoma quando quiser.',
        variationId: `generic_${level}_${index}`,
    };
}
