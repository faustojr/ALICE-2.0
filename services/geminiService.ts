
import { GoogleGenAI } from "@google/genai";
import type { ModuleContent, UserState, Slide } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateImageForSlide(promptText: string): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: `A professional, high-quality, cinematic and dark photography background for a public servant training app. Theme: ${promptText}. Style: Moody, low-key lighting, dark tones, minimalist, clean, depth of field. Ensure the image is dark enough to allow white text to be easily readable over it.` }]
            },
            config: {
                imageConfig: { aspectRatio: "9:16" }
            }
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
        return 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=600';
    } catch (e) {
        return 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=600';
    }
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

export async function generateReelsModule(trail: string, index: number, level: string): Promise<ModuleContent> {
    const model = 'gemini-3-flash-preview';
    
    // Determina o tópico baseado no índice para garantir progressão
    let currentTopic = "";
    if (trail.includes("14.133")) {
        const topicIndex = index % LAW_14133_TOPICS.length;
        const cycle = Math.floor(index / LAW_14133_TOPICS.length) + 1;
        currentTopic = `Tópico: ${LAW_14133_TOPICS[topicIndex]} (Ciclo de Revisão: ${cycle})`;
    }

    const prompt = `Você é ALICE, uma assistente de micro-aprendizagem para servidores públicos. 
    Seu objetivo é criar o Módulo #${index + 1} da trilha "${trail}" (Nível ${level}).
    
    FOCO DO MÓDULO: ${currentTopic || "Aprofundamento no tema da trilha"}
    
    INSTRUÇÕES:
    1. Siga rigorosamente a sequência lógica da lei ou tema. 
    2. Como este é o módulo ${index + 1}, certifique-se de que o conteúdo seja incremental e não repita o que seria óbvio em módulos iniciais se o índice for alto.
    3. Use linguagem clara, direta e focada na prática municipal.
    
    Retorne um JSON com:
    - title: Título específico e atraente para este módulo.
    - slideTexts: Array de 3 strings curtas (máx 120 caracteres cada) com conceitos práticos.
    - question: Uma pergunta de quiz desafiadora sobre o tema.
    - options: Array de 3 objetos {label, value: 'correct' ou 'wrong'}.
    - feedbackCorrect: Explicação pedagógica curta.
    - feedbackWrong: Dica para o aluno não errar mais.
    - imagePrompts: 3 prompts em inglês para geração de imagens de fundo (estilo corporativo/limpo).`;

    try {
        const result = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });

        const data = JSON.parse(result.text || '{}');
        
        // Gerar imagens para cada slide em paralelo
        const slides: Slide[] = await Promise.all(
            data.slideTexts.map(async (text: string, i: number) => ({
                text,
                imageUrl: await generateImageForSlide(data.imagePrompts[i] || text)
            }))
        );

        return {
            title: data.title,
            slides,
            question: data.question,
            options: data.options,
            feedbackCorrect: data.feedbackCorrect,
            feedbackWrong: data.feedbackWrong
        };
    } catch (e) {
        // Fallback
        const fallbackSlides = [
            { text: "A Nova Lei de Licitações (14.133) modernizou os processos municipais.", imageUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=600" },
            { text: "O Planejamento agora é fase obrigatória e essencial para o sucesso.", imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=600" },
            { text: "A transparência digital permite que o cidadão acompanhe cada etapa.", imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=600" }
        ];
        return {
            title: "Processos Licitatórios",
            slides: fallbackSlides,
            question: "Qual a fase considerada essencial na nova lei?",
            options: [
                { label: "Planejamento", value: "correct" },
                { label: "Execução Direta", value: "wrong" },
                { label: "Finalização", value: "wrong" }
            ],
            feedbackCorrect: "Exato! O planejamento evita aditivos desnecessários.",
            feedbackWrong: "Incorreto. Sem planejamento, as demais fases ficam comprometidas."
        };
    }
}
