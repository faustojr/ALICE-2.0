import { GoogleGenAI } from "@google/genai";
import type { ModuleContent, UserState, Slide } from '../types';

// Initialize Gemini AI (Frontend)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

async function generateImageForSlide(promptText: string): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ 
                    text: `Professional cinematic dark photography background for public servant training. Theme: ${promptText}. Style: Moody, minimalist, dark tones, clean. Ensure high contrast for white text readability.` 
                }]
            },
            config: {
                imageConfig: { aspectRatio: "9:16" }
            }
        });

        let imageData = null;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                imageData = part.inlineData.data;
                break;
            }
        }

        if (imageData) {
            return `data:image/png;base64,${imageData}`;
        }
        throw new Error("No image generated");
    } catch (e) {
        console.error("Image generation error:", e);
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

export async function generateReelsModule(trail: string, index: number, level: 'Básico' | 'Intermediário' | 'Especialista'): Promise<ModuleContent> {
    const model = 'gemini-3-flash-preview';
    
    // Determina o tópico baseado no índice para garantir progressão
    let currentTopic = "";
    if (trail.includes("14.133")) {
        const topicIndex = index % LAW_14133_TOPICS.length;
        const cycle = Math.floor(index / LAW_14133_TOPICS.length) + 1;
        currentTopic = `Tópico: ${LAW_14133_TOPICS[topicIndex]} (Ciclo: ${cycle})`;
    }

    const prompt = `Você é ALICE, uma assistente de microaprendizagem gamificada especializada na Lei 14.133/2021 (Nova Lei de Licitações).
    Tarefa: Criar o Módulo #${index + 1} para a trilha "${trail}" no nível "${level}".
    
    O conteúdo deve ser adaptado ao nível:
    - Básico: Conceitos fundamentais, definições claras, linguagem simples.
    - Intermediário: Aplicação prática, prazos, exceções comuns, fluxogramas mentais.
    - Especialista: FORMATO ESPECIAL. O quiz deve ser uma SITUAÇÃO-PROBLEMA real de prefeitura. Exponha o usuário a um cenário complexo de licitação ou contrato e peça para ele escolher a melhor alternativa (de 3) para sanar a situação garantindo a aplicação estrita da Lei 14.133.

    Tópico de referência: ${currentTopic || "Visão geral da Lei 14.133"}
    
    Estrutura do JSON de saída:
    - title: Título curto e impactante.
    - slideTexts: Um array de EXATAMENTE 3 strings (máximo 120 caracteres cada) que formam uma narrativa de micro-aprendizado. No nível Especialista, os slides devem preparar o terreno para a situação-problema do quiz.
    - question: Uma pergunta de múltipla escolha (ou descrição da situação-problema no nível Especialista).
    - options: Um array de EXATAMENTE 3 objetos {label: string, value: 'correct' | 'wrong'}. Apenas uma correta. No nível Especialista, as opções devem ser soluções administrativas para o problema exposto.
    - feedbackCorrect: Explicação pedagógica curta do porquê essa solução é a correta conforme a Lei 14.133.
    - feedbackWrong: Dica técnica para ajudar o aluno a entender o erro na interpretação da lei.
    - imagePrompts: 3 prompts curtos em inglês para geração de imagens de fundo (estilo corporativo, limpo, moderno).`;

    try {
        const response = await ai.models.generateContent({
            model: model || 'gemini-3-flash-preview',
            contents: prompt,
            config: { 
                responseMimeType: 'application/json' 
            }
        });

        if (!response.text) throw new Error("AI Generation failed: No text returned");
        
        const data = JSON.parse(response.text.trim());
        
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
        // Fallback dinâmico baseado no tópico para evitar loops visuais
        const topicIndex = index % LAW_14133_TOPICS.length;
        const topic = LAW_14133_TOPICS[topicIndex];
        
        const fallbackSlides = [
            { text: `Iniciando estudos sobre: ${topic}. Este é um módulo fundamental para sua carreira.`, imageUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=600" },
            { text: "A Nova Lei de Licitações (14.133) modernizou os processos municipais e exige atualização constante.", imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=600" },
            { text: "Lembre-se: a eficiência na gestão pública começa com o domínio das normas vigentes.", imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=600" }
        ];
        return {
            title: `Estudo: ${topic.split(':')[0]}`,
            slides: fallbackSlides,
            question: `Sobre o tema "${topic}", qual a postura correta do servidor?`,
            options: [
                { label: "Seguir rigorosamente a Lei 14.133/21", value: "correct" },
                { label: "Ignorar as novas atualizações", value: "wrong" },
                { label: "Manter processos antigos sem revisão", value: "wrong" }
            ],
            feedbackCorrect: "Exato! A conformidade legal é a base da segurança jurídica na gestão.",
            feedbackWrong: "Incorreto. A atualização é obrigatória para evitar sanções e nulidades."
        };
    }
}
