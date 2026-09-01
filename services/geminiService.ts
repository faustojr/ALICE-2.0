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

const LAW_14133_TOPICS = [
    "Âmbito de Aplicação e Princípios (Arts. 1º a 7º)",
    "Agentes Públicos e Definições (Arts. 7º a 10)",
    "Fase Preparatória: Planejamento e ETP (Arts. 18 a 27)",
    "Modalidades: Pregão e Concorrência (Arts. 28 a 30)",
    "Modalidades: Concurso, Leilão e Diálogo Competitivo (Arts. 31 a 32)",
    "Critérios de Julgamento (Arts. 33 a 39)",
    "Procedimentos Auxiliares: Credenciamento e Pré-qualificação (Arts. 78 a 81)",
    "Procedimentos Auxiliares: Registro de Preços e Registro Cadastral (Arts. 82 a 88)",
    "Contratação Direta: Inexigibilidade (Art. 74)",
    "Contratação Direta: Dispensa de Licitação (Art. 75)",
    "Alienações e Formalização dos Contratos (Arts. 76 a 95)",
    "Execução e Alteração dos Contratos (Arts. 115 a 136)",
    "Extinção dos Contratos e Recebimento do Objeto (Arts. 137 a 140)",
    "Pagamentos e Nulidades (Arts. 141 a 154)",
    "Infrações e Sanções Administrativas (Arts. 155 a 163)",
    "Controle das Contratações e PNCP (Arts. 169 a 176)"
];

const CACHE_KEY = 'alice_module_cache';

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

function cleanTopicName(topic: string): string {
    return topic.split('(')[0].trim();
}

interface FallbackEntry {
    intro: string;
    question: string;
    options: { label: string; value: "correct" | "wrong" }[];
    feedbackCorrect: string;
    feedbackWrong: string;
}

const FALLBACK_CONTENT: Record<number, FallbackEntry> = {
    0: {
        intro: "O âmbito de aplicação e os princípios fundamentais da Lei 14.133 estabelecem as regras do jogo, obrigando a aplicação a toda a Administração Pública direta, autárquica e fundacional.",
        question: "A Nova Lei de Licitações aplica-se obrigatoriamente a qual dessas estruturas municipais?",
        options: [
            { label: "Administração direta, autárquica e fundacional do Município", value: "correct" },
            { label: "Apenas a autarquias, excluindo secretarias municipais", value: "wrong" },
            { label: "Empresas públicas e sociedades de economia mista estatais reguladas pela Lei 13.303", value: "wrong" }
        ],
        feedbackCorrect: "Excelente! O Art. 1º se aplica à Administração direta, autárquica e fundacional de todos os entes federados.",
        feedbackWrong: "Incorreto. A Nova Lei aplica-se a toda a administração direta, autárquica e fundacional. Empresas públicas seguem a Lei 13.303."
    },
    1: {
        intro: "As regras para agentes públicos proíbem o nepotismo e estabelecem que quem planeja a contratação não deve ser quem a julga, sob o princípio da segregação de funções.",
        question: "Qual princípio veda que o mesmo agente elabore o ETP e atue como membro exclusivo da comissão de contratação?",
        options: [
            { label: "Princípio da Segregação de Funções", value: "correct" },
            { label: "Princípio da Economicidade Ativa", value: "wrong" },
            { label: "Princípio da Celeridade Processual", value: "wrong" }
        ],
        feedbackCorrect: "Correto! A segregação de funções visa reduzir erros e evitar conflitos de interesse dividindo etapas críticas.",
        feedbackWrong: "Incorreto. É o Princípio da Segregação de Funções (Art. 7º, § 1º) que manda separar o planejamento da decisão."
    },
    2: {
        intro: "Na Fase Preparatória, o Estudo Técnico Preliminar (ETP) é o documento crucial que justifica a necessidade da contratação e avalia a viabilidade técnica.",
        question: "Qual é o principal objetivo da elaboração do Estudo Técnico Preliminar (ETP) na fase preparatória?",
        options: [
            { label: "Evidenciar o problema a ser resolvido e buscar a melhor solução", value: "correct" },
            { label: "Apenas registrar as assinaturas e aprovar a dotação orçamentária", value: "wrong" },
            { label: "Definir diretamente a marca específica do item a ser comprado", value: "wrong" }
        ],
        feedbackCorrect: "Exato! O ETP serve para descrever o problema, avaliar alternativas e escolher a solução ideal para o município.",
        feedbackWrong: "Incorreto. O ETP (Art. 18, I) foca em apontar e caracterizar o problema e definir a solução mais vantajosa."
    },
    3: {
        intro: "Pregão e Concorrência são as principais modalidades. O pregão é mandatório para bens e serviços comuns, cujo critério de julgamento principal é menor preço ou maior desconto.",
        question: "Em qual cenário a modalidade Pregão é amplamente obrigatória para a prefeitura municipal?",
        options: [
            { label: "Na aquisição de bens e serviços comuns de qualquer valor", value: "correct" },
            { label: "Apenas para obras complexas de grande vulto de engenharia", value: "wrong" },
            { label: "Para alienação de bens móveis inservíveis do patrimônio", value: "wrong" }
        ],
        feedbackCorrect: "Correto! O Pregão é obrigatório para aquisição de bens e serviços comuns, sob critério de julgamento de menor preço/maior desconto.",
        feedbackWrong: "Incorreto. O Pregão aplica-se a bens e serviços comuns (Art. 29). Obras de engenharia complexas usam Concorrência ou Diálogo."
    },
    4: {
        intro: "O Diálogo Competitivo é uma grande novidade para contratações complexas e inovadoras, onde o município dialoga com parceiros antes de definir a licitação.",
        question: "Para qual finalidade o inovador Diálogo Competitivo foi desenhado na Lei 14.133?",
        options: [
            { label: "Contratações que envolvem inovação tecnológica ou soluções complexas", value: "correct" },
            { label: "Dispensa de licitação para compras simples em datas festivas", value: "wrong" },
            { label: "Leiloar veículos antigos e inservíveis da frota da prefeitura", value: "wrong" }
        ],
        feedbackCorrect: "Excelente! O Diálogo Competitivo (Art. 32) permite negociar melhores soluções tecnológicas ou de infraestrutura.",
        feedbackWrong: "Incorreto. O Diálogo Competitivo destina-se a inovações e soluções onde a administração não consegue definir requisitos sozinha."
    },
    5: {
        intro: "Os critérios de julgamento determinam como o vencedor será escolhido: menor preço, maior desconto, melhor técnica ou conteúdo artístico, técnica e preço, ou maior retorno econômico.",
        question: "Qual critério é especificamente associado ao contrato de eficiência, buscando economia para o erário?",
        options: [
            { label: "Maior retorno econômico", value: "correct" },
            { label: "Melhor técnica ou conteúdo artístico", value: "wrong" },
            { label: "Menor preço puro sem verificação de desempenho", value: "wrong" }
        ],
        feedbackCorrect: "Excelente! O critério de maior retorno econômico é usado em contratos de eficiência, remunerando baseado na economia gerada.",
        feedbackWrong: "Incorreto. O critério para contratos de eficiência é o maior retorno econômico (Art. 39)."
    },
    6: {
        intro: "O credenciamento e a pré-qualificação simplificam o processo. No credenciamento, a prefeitura convoca todos os interessados que preencham requisitos pré-estabelecidos.",
        question: "Quando o credenciamento (procedimento auxiliar) é legalmente viável para prefeituras municipais?",
        options: [
            { label: "Quando houver inviabilidade de competição pela pluralidade de prestadores e preços fixados", value: "correct" },
            { label: "Quando apenas uma única empresa exclusiva puder fornecer o serviço", value: "wrong" },
            { label: "Para obras de alta engenharia que exijam concorrência célere", value: "wrong" }
        ],
        feedbackCorrect: "Incrível! O Credenciamento serve para quando a administração puder contratar todos os interessados que atendam ao edital.",
        feedbackWrong: "Incorreto. O Credenciamento (Art. 79) pressupõe pluralidade de interessados simultâneos com preços pré-definidos."
    },
    7: {
        intro: "O Sistema de Registro de Preços (SRP) facilita compras repetitivas por meio de atas de registro de preços, válidas por até 1 ano, prorrogáveis por igual período.",
        question: "Qual é o prazo máximo inicial de vigência de uma Ata de Registro de Preços sob a Lei 14.133?",
        options: [
            { label: "1 ano, prorrogável por até mais 1 ano se comprovadas condições vantajosas", value: "correct" },
            { label: "Até 5 anos improrrogáveis para garantir entrega contínua", value: "wrong" },
            { label: "Apenas 6 meses, sem qualquer hipótese de prorrogação ou reajuste", value: "wrong" }
        ],
        feedbackCorrect: "Excelente! A ata de registro de preços vigora por 1 ano, podendo ser prorrogada por mais 1 ano (Art. 84).",
        feedbackWrong: "Incorreto. A vigência inicial máxima é de 1 ano, prorrogável por até mais 1 ano desde que vantajoso."
    },
    8: {
        intro: "A inexigibilidade ocorre pela inviabilidade de competição, como na contratação de artista consagrado ou fornecedor com exclusividade comprovada legalmente.",
        question: "Qual hipótese abaixo caracteriza um caso típico de Inexigibilidade de licitação?",
        options: [
            { label: "Contratação de profissional de qualquer setor artístico consagrado pela opinião pública", value: "correct" },
            { label: "Aquisição de materiais comuns de escritório em situação de pouca urgência", value: "wrong" },
            { label: "Contratação de engenharia comum que conte com dezenas de licitantes aptos", value: "wrong" }
        ],
        feedbackCorrect: "Exato! Se há inviabilidade de competição, como com artista consagrado, a licitação é inexigível (Art. 74).",
        feedbackWrong: "Incorreto. Contratação de artista consagrado é caso de Inexigibilidade (Art. 74, II), pois é inviável comparar competidores."
    },
    9: {
        intro: "A Dispensa por Valor foi atualizada, permitindo compras diretas em limites maiores, e requer agilidade e controle de fracionamento de despesa.",
        question: "A dispensa de licitação em razão do valor exige qual das seguintes precauções do gestor público municipal?",
        options: [
            { label: "Evitar o fracionamento ilegal de despesas para um mesmo item ao longo do ano", value: "correct" },
            { label: "Garantir que a compra seja feita exclusivamente em dinheiro vivo sem nota fiscal", value: "wrong" },
            { label: "Omitir a publicação no Portal Nacional de Contratações Públicas (PNCP)", value: "wrong" }
        ],
        feedbackCorrect: "Parabéns! É vedado o fracionamento de despesas para burlar o limite anual de dispensa por valor (Art. 75).",
        feedbackWrong: "Incorreto. A prefeitura deve controlar o fracionamento de despesas para manter as dispensas dentro dos limites limites legais do Art. 75."
    },
    10: {
        intro: "A formalização do contrato é feita por termo escrito ou instrumento substitutivo. Ela exige a verificação prévia de regularidade fiscal e trabalhista.",
        question: "Antes de formalizar e assinar um contrato administrativo, o que o setor de contratos da prefeitura deve fazer?",
        options: [
            { label: "Exigir a comprovação de regularidade fiscal, trabalhista e previdenciária do contratante", value: "correct" },
            { label: "Proceder à dispensa verbal e oral de todas as certidões negativas como cortesia", value: "wrong" },
            { label: "Redigir o contrato em cartório particular sem nenhuma publicação oficial posterior", value: "wrong" }
        ],
        feedbackCorrect: "Perfeito! A certidão de regularidade fiscal e trabalhista é requisito impostergável para assinar o termo de contrato.",
        feedbackWrong: "Incorreto. A regularidade fiscal e certidões negativas são requisitos obrigatórios de habilitação e contratação."
    },
    11: {
        intro: "As alterações contratuais podem ser unilaterais (feitas pela Administração) ou bilaterais (por acordo). Há limites percentuais rigorosos para acréscimos ou supressões.",
        question: "Qual o limite percentual clássico de acréscimo unilateral do objeto em contratos de obras e serviços comuns?",
        options: [
            { label: "Até 25% do valor inicial atualizado do contrato", value: "correct" },
            { label: "Até 50% de acréscimo para qualquer modalidade ou fornecimento", value: "wrong" },
            { label: "Não há limites percentuais, bastando que as partes concordem livremente", value: "wrong" }
        ],
        feedbackCorrect: "Incrível! O limite geral para acréscimo unilateral é de 25% para compras e serviços, e reformas chegam a 50% (Art. 125).",
        feedbackWrong: "Incorreto. A Lei define limite de até 25% de acréscimo unilateral para fornecimentos, obras e serviços comuns."
    },
    12: {
        intro: "A extinção contratual pode se dar judicialmente, amigavelmente ou ato unilateral da prefeitura, por atraso ou inexecuções graves.",
        question: "Em qual cenário a prefeitura pode extinguir o contrato unilateralmente sem indenizar a contratada?",
        options: [
            { label: "Inexecução total ou parcial das cláusulas contratuais por culpa exclusiva da contratada", value: "correct" },
            { label: "Por mera vontade política sem justificativa ou dolo da contratada", value: "wrong" },
            { label: "Por divergências estéticas do gestor a respeito do logotipo da empresa contratada", value: "wrong" }
        ],
        feedbackCorrect: "Muito bem! A inexecução culposa autoriza a rescisão unilateral e aplicação de sanções à empresa transgressora.",
        feedbackWrong: "Incorreto. A rescisão unilateral sem dever de indenizar se dá por inexecução das obrigações da contratada (Art. 137)."
    },
    13: {
        intro: "O pagamento deve respeitar a ordem cronológica de exigibilidade para cada categoria de contrato, impedindo favorecimentos indevidos.",
        question: "Como o setor financeiro da prefeitura deve guiar o pagamento de faturas e liquidações de empenho?",
        options: [
            { label: "Seguindo estritamente a ordem cronológica de suas exigibilidades por fonte de recurso", value: "correct" },
            { label: "Priorizando fornecedores de preferência pessoal do prefeito ou secretários", value: "wrong" },
            { label: "Pagar sempre o menor valor pendente sem observar qualquer data de vencimento", value: "wrong" }
        ],
        feedbackCorrect: "Exato! A ordem cronológica de pagamentos (Art. 141) é um preceito de moralidade e impessoalidade na administração.",
        feedbackWrong: "Incorreto. A ordem cronológica de exigibilidade para cada fonte deve ser rigidamente respeitada pela tesouraria municipal."
    },
    14: {
        intro: "Nas infrações e sanções, a prefeitura deve aplicar advertência, multa, impedimento de licitar ou declaração de inidoneidade, proporcionalmente.",
        question: "Qual sanção impede uma empresa de licitar com TODA a Administração Pública de todos os entes federativos?",
        options: [
            { label: "Declaração de inidoneidade para licitar ou contratar", value: "correct" },
            { label: "Advertência formal escrita aplicada de maneira interna", value: "wrong" },
            { label: "Impedimento de licitar e contratar limitado ao município aplicador", value: "wrong" }
        ],
        feedbackCorrect: "Correto! A declaração de inidoneidade impede licitar com federação, estados e municípios por até 6 anos (Art. 156).",
        feedbackWrong: "Incorreto. A inidoneidade tem efeitos ampliados a todos os entes federativos, enquanto o impedimento limita-se ao próprio ente."
    },
    15: {
        intro: "O controle das contratações estabelece três linhas de defesa do erário, e o PNCP centraliza a transparência nacional das licitações.",
        question: "Quem compõe a primeira linha de defesa contra irregularidades nas licitações e contratos?",
        options: [
            { label: "Os agentes públicos que atuam nos processos de contratação e fiscalização", value: "correct" },
            { label: "Os auditores do Tribunal de Contas de maneira externa e corretiva", value: "wrong" },
            { label: "Os vereadores que compõem a comissão de finanças da câmara municipal", value: "wrong" }
        ],
        feedbackCorrect: "Exato! A primeira linha de defesa (Art. 169) é composta pelos próprios agentes que planejam, executam e fiscalizam.",
        feedbackWrong: "Incorreto. A primeira linha de defesa é dos agentes internos que atuam nas licitações. Tribunais de Contas são a terceira linha."
    }
};

async function getStandardModuleContent(
    index: number, 
    level: 'Básico' | 'Intermediário' | 'Especialista'
): Promise<ModuleContent> {
    const topicIndex = index % LAW_14133_TOPICS.length;
    const topic = LAW_14133_TOPICS[topicIndex];
    const cleanTopic = cleanTopicName(topic);
    
    const entry = FALLBACK_CONTENT[topicIndex] || FALLBACK_CONTENT[0];
    
    const fallbackImages = await Promise.all(
        [0, 1, 2].map((slideIndex) => imageForSlide(index, slideIndex))
    );

    const levelText = level === 'Especialista' ? 'Especialista' : level === 'Intermediário' ? 'Intermediário' : 'Básico';

    const slides: Slide[] = [
        { 
            text: `Módulo #${index + 1} [${levelText}]: ${entry.intro}`, 
            imageUrl: fallbackImages[0] 
        },
        { 
            text: `Na Lei 14.133, o tema "${cleanTopic}" é essencial para evitar riscos e otimizar as compras do município.`, 
            imageUrl: fallbackImages[1] 
        },
        { 
            text: `Dica ALICE: Revise os principais pontos do Artigo correspondente antes de responder ao quiz de fixação.`, 
            imageUrl: fallbackImages[2] 
        }
    ];

    return {
        title: `${cleanTopic}`,
        slides,
        question: entry.question,
        options: entry.options,
        feedbackCorrect: entry.feedbackCorrect,
        feedbackWrong: entry.feedbackWrong,
        variationId: `standard_${level}_${index}`
    };
}

/**
 * Busca a variante promovida do módulo. Retorna null quando ainda não há uma
 * — situação normal enquanto o conteúdo padrão está dando conta.
 */
async function fetchPromotedVariant(
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
        if (data.source !== 'PROMOTED' || !data.variant) return null;

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
        const promoted = await fetchPromotedVariant(trail, index, level);
        if (promoted) return promoted;
        return await getStandardModuleContent(index, level);
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

        // Fallback dinâmico baseado no tópico para evitar loops visuais
        const topicIndex = index % LAW_14133_TOPICS.length;
        const topic = LAW_14133_TOPICS[topicIndex];
        const cleanTopic = cleanTopicName(topic);
        
        const introTexts = [
            `Dominar ${cleanTopic} é vital para evitar nulidades.`,
            `Você conhece os riscos de ignorar ${cleanTopic}?`,
            `A eficiência em ${cleanTopic} começa aqui.`,
            `O Artigo correspondente a ${cleanTopic} mudou tudo.`
        ];
        // Use failCount in the index to guarantee variation if they retry
        const selectedIntro = introTexts[(index + failCount) % introTexts.length];

        const fallbackImages = await Promise.all(
            [0, 1, 2].map((slideIndex) => imageForSlide(index, slideIndex))
        );

        const fallbackSlides = [
            { text: `Módulo #${index + 1}: ${selectedIntro} Fique atento aos detalhes técnicos abaixo.`, imageUrl: fallbackImages[0] },
            { text: `Na 14.133, o tema ${cleanTopic} exige que o servidor municipal valide cada etapa rigorosamente.`, imageUrl: fallbackImages[1] },
            { text: `Dica ALICE ${failCount > 0 ? '(Re-estudo)' : ''}: Simplificamos o tema ${cleanTopic} para você aplicar agora mesmo na sua prefeitura.`, imageUrl: fallbackImages[2] }
        ];

        const entry = FALLBACK_CONTENT[topicIndex];
        const fallbackContent: ModuleContent = {
            title: `Explorando: ${cleanTopic}`,
            slides: fallbackSlides,
            question: entry.question,
            options: entry.options,
            feedbackCorrect: entry.feedbackCorrect,
            feedbackWrong: entry.feedbackWrong
        };

        return fallbackContent;
    }
}
