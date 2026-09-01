/**
 * Geração de módulos via Gemini. Extraído do server.ts para ser reaproveitado
 * pela Vercel Function e pelo servidor de desenvolvimento local.
 */

import type { LearningLevel } from '../types.js';

const STYLE_DIRECTIVES = [
  'Foco Prático e de Governança (Foque na responsabilidade prática do servidor e em como gerenciar riscos operacionais ou de fiscalização de forma imediata). EVITE frases repetitivas. Use tom dinâmico de consultoria técnica.',
  'Foco em Caso de Estudo Realista (Desenvolva os slides narrando o caso fictício de um município de pequeno/médio porte lidando com esse tema de licitação. Mostre o que deu certo ou o que quase gerou infração).',
  'Foco em Erros Comuns e Alertas (Apresente os 3 erros mais comuns cometidos por comissões de contratação neste tema, seguidos de reações mitigadoras imediatas recomendadas pelo Tribunal de Contas).',
  'Foco em Simplificação e Analogia (Descomplique a burocracia do tema usando uma analogia clara da vida cotidiana ou analogias corporativas simples, conectando diretamente com a regra de ouro do artigo correspondente).',
  'Foco em Fluxo de Trabalho e Prazos (Construa uma sequência cronológica clara do procedimento, destacando os pontos críticos de transição de fase e os prazos que nenhum servidor municipal pode perder).',
];

/**
 * Modelo configurável por ambiente. Trocar de modelo passa a ser uma variável
 * na Vercel, não um deploy de código.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export interface GenerateModuleInput {
  /** Nome da trilha, usado no prompt. */
  trail: string;
  index: number;
  level: LearningLevel;
  failCount?: number;
  /**
   * Tópico da trilha a abordar. Vem do banco (coleção `trails`), não de uma
   * lista no código — é o que permite uma trilha nova sem deploy.
   */
  topicTitle?: string;
  legalReference?: string;
  /** Volta ao mesmo tópico numa passagem posterior pede outro recorte. */
  cycle?: number;
}

export interface GeneratedModule {
  variationId: string;
  title: string;
  slideTexts: string[];
  question: string;
  options: { label: string; value: string }[];
  feedbackCorrect: string;
  feedbackWrong: string;
  imagePrompts: string[];
}

export function buildPrompt({
  trail,
  index,
  level,
  failCount = 0,
  topicTitle,
  legalReference,
  cycle,
}: GenerateModuleInput): { prompt: string; seed: number } {
  const seed = Math.floor(Math.random() * 1_000_000);

  const currentTopic = topicTitle
    ? `Tópico: ${topicTitle}${legalReference ? ` (${legalReference})` : ''}` +
      (cycle && cycle > 1 ? ` — Ciclo ${cycle}` : '')
    : '';

  const isReattempt = failCount > 0;
  const selectedStyle = STYLE_DIRECTIVES[seed % STYLE_DIRECTIVES.length];

  const prompt = `Você é ALICE, uma assistente de microaprendizagem de elite para servidores municipais brasileiros, especialista na trilha "${trail}".
Tarefa: Criar o Módulo #${index + 1} para a trilha "${trail}" no nível "${level}".
Seed de Variabilidade: ${seed}
Diretriz Estilística e Pedagógica Atual: ${selectedStyle}

Tópico de referência: ${currentTopic || `Visão geral de ${trail}`}

REQUISITOS RIGOROSOS DE AUTENTICIDADE E SELEÇÃO DE LINGUAGEM:
1. NÃO utilize fórmulas fixas ou chavões repetitivos (ex: não comece todos os slides com "Você sabia?", "Na prática...", "De acordo com..."). Varie as frases de abertura de todos os slides.
2. Cada uma das 3 partes de slideTexts deve ser autônoma, envolvente e trazer informações práticas de extremo valor legal e operacional para prefeituras brasileiras. Escreva de forma fluida, natural, com forte teor instrutivo.
3. O Quiz deve testar o entendimento profundo do cenário técnico descrito nos slides. Evite perguntas óbvias ou genéricas. Faça perguntas baseadas em aplicação real do dispositivo legal do tópico.
4. As opções (options) devem ser realistas e conter distratores técnicos plausíveis. A resposta correta deve ter o valor exato "correct" e as demais "wrong".
5. GERE OBRIGATORIAMENTE um 'variationId' único de formato 'var_${seed}_${index}_[hash]' que represente a vertente semântica exata abordada neste conteúdo.
6. Use este 'variationId' e o Seed para criar conteúdo semanticamente inédito: mesmo se o tópico repetir, aborde um detalhe, uma exceção, uma regra secundária ou um cenário do tribunal de contas diferente do usual.
7. ${
    isReattempt
      ? `Este é um RE-ESTUDO (tentativa anterior resultou em falha; failCount: ${failCount}). Altere COMPLETAMENTE a abordagem explicativa e a pergunta do quiz, focando em uma exceção ou artigo correlacionado.`
      : 'Forneça uma jornada de aprendizado limpa, focada e inovadora.'
  }

Regras de nível:
- Básico: Explique princípios e conceitos como se estivesse ensinando um colega novo. Foco em clareza técnica e impacto no dia a dia.
- Intermediário: Aborde prazos, exceções e fluxos de trabalho. Use exemplos práticos de prefeituras.
- Especialista: Crie uma SITUAÇÃO-PROBLEMA complexa. O quiz deve testar julgamento sob pressão, citando artigos quando necessário.

Estrutura do JSON (MANDATÓRIO):
{
  "variationId": "ID único de variação semântica",
  "title": "Título criativo e direto (ex: 'O segredo do Art. 75')",
  "slideTexts": ["Texto 1 (max 120 char) - Gancho direto", "Texto 2 (max 120 char) - Miolo técnico", "Texto 3 (max 120 char) - Ação prática"],
  "question": "Pergunta do desafio",
  "options": [
    {"label": "Opção A", "value": "correct/wrong"},
    {"label": "Opção B", "value": "correct/wrong"},
    {"label": "Opção C", "value": "correct/wrong"}
  ],
  "feedbackCorrect": "Explicação técnica curta (base legal)",
  "feedbackWrong": "Feedback orientador: explique o erro e aponte a regra correta",
  "imagePrompts": ["descrição de imagem em inglês 1", "descrição de imagem em inglês 2", "descrição de imagem em inglês 3"]
}`;

  return { prompt, seed };
}

/** Rejeita respostas malformadas antes de chegarem ao cliente. */
export function validateGeneratedModule(data: unknown): GeneratedModule {
  const m = data as GeneratedModule;

  if (!m || typeof m !== 'object') {
    throw new Error('Resposta da IA não é um objeto.');
  }
  if (!m.title || typeof m.title !== 'string') {
    throw new Error('Resposta da IA sem título.');
  }
  if (!Array.isArray(m.slideTexts) || m.slideTexts.length === 0) {
    throw new Error('Resposta da IA sem slides.');
  }
  if (!m.question || !Array.isArray(m.options) || m.options.length < 2) {
    throw new Error('Resposta da IA sem quiz válido.');
  }
  if (!m.options.some((o) => o.value === 'correct')) {
    throw new Error('Resposta da IA sem alternativa correta.');
  }

  return {
    ...m,
    imagePrompts: Array.isArray(m.imagePrompts) ? m.imagePrompts : [],
  };
}

export async function generateModuleWithGemini(
  input: GenerateModuleInput,
  apiKey: string
): Promise<{ module: GeneratedModule; model: string; seed: number }> {
  const { prompt, seed } = buildPrompt(input);

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 1.0,
      topK: 64,
      topP: 0.95,
      seed,
    },
  });

  if (!response.text) {
    throw new Error('Geração de IA falhou: resposta vazia.');
  }

  const parsed = JSON.parse(response.text.trim());
  return { module: validateGeneratedModule(parsed), model: GEMINI_MODEL, seed };
}
