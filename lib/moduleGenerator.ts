/**
 * Geração de módulos via Gemini.
 *
 * O prompt é ancorado nas bases teóricas da dissertação que fundamenta a
 * plataforma, e não numa taxonomia genérica de objetivos educacionais:
 *
 * - **Autoeficácia (BANDURA, 1997)** é o pilar. A pesquisa de campo em
 *   Fraiburgo e Florianópolis encontrou servidores que concluíram
 *   capacitações e seguem sem se sentir capazes de aplicar a norma sozinhos.
 *   O problema não é falta de informação, é falta de crença na própria
 *   capacidade. Por isso o feedback nomeia a competência exercida em vez de
 *   elogiar genericamente: é a "experiência de maestria", a mais forte das
 *   quatro fontes de autoeficácia.
 *
 * - **Zona de Desenvolvimento Proximal (VYGOTSKY, 1984)** calibra o
 *   re-estudo. Repetir a mesma dificuldade não ensina; escalar demais
 *   desanima. O conteúdo de remediação fica na faixa produtiva de desafio.
 *
 * - **Taxonomia de Bloom Revisada (ANDERSON; KRATHWOHL, 2001)** entra como
 *   ponderação, não como estrutura dos níveis. O modelo declara a demanda
 *   cognitiva da questão e o servidor pondera os pontos — questão de
 *   reconhecimento vale menos que questão de julgamento sob pressão.
 */

import type { LearningLevel } from '../types.js';

const STYLE_DIRECTIVES = [
  'Foco Prático e de Governança (Foque na responsabilidade prática do servidor e em como gerenciar riscos operacionais ou de fiscalização de forma imediata). EVITE frases repetitivas. Use tom dinâmico de consultoria técnica.',
  'Foco em Caso de Estudo Realista (Desenvolva os slides narrando o caso de um município de pequeno/médio porte lidando com esse tema. Mostre o que deu certo ou o que quase gerou infração).',
  'Foco em Erros Comuns e Alertas (Apresente os erros mais comuns cometidos por comissões de contratação neste tema, seguidos das reações mitigadoras recomendadas pelo Tribunal de Contas).',
  'Foco em Simplificação e Analogia (Descomplique a burocracia do tema usando uma analogia clara da vida cotidiana, conectando diretamente com a regra de ouro do dispositivo correspondente).',
  'Foco em Fluxo de Trabalho e Prazos (Construa uma sequência cronológica clara do procedimento, destacando os pontos críticos de transição de fase e os prazos que nenhum servidor municipal pode perder).',
];

/**
 * Modelo configurável por ambiente. Trocar de modelo passa a ser uma variável
 * na Vercel, não um deploy de código.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

/** Processos cognitivos da Taxonomia de Bloom Revisada, do mais simples ao mais complexo. */
export type CognitiveLevel =
  | 'LEMBRAR'
  | 'ENTENDER'
  | 'APLICAR'
  | 'ANALISAR'
  | 'AVALIAR'
  | 'CRIAR';

/**
 * Peso do acerto por demanda cognitiva.
 *
 * Acertar "qual o prazo do Art. X" não é a mesma conquista que decidir
 * corretamente sob pressão num caso concreto. Pontuar igual apagaria essa
 * diferença justamente no indicador que o gestor usa para avaliar a equipe.
 */
export const COGNITIVE_WEIGHTS: Record<CognitiveLevel, number> = {
  LEMBRAR: 1.0,
  ENTENDER: 1.0,
  APLICAR: 1.5,
  ANALISAR: 1.5,
  AVALIAR: 2.0,
  CRIAR: 2.0,
};

/** Demanda cognitiva esperada de cada nível da trilha. */
const EXPECTED_COGNITIVE: Record<LearningLevel, CognitiveLevel[]> = {
  Básico: ['LEMBRAR', 'ENTENDER'],
  Intermediário: ['APLICAR', 'ANALISAR'],
  Especialista: ['AVALIAR', 'CRIAR'],
};

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
  /**
   * Alternativa que o aluno marcou ao errar.
   *
   * Sem isso a remediação sabe apenas QUE houve erro; com isso ela ataca a
   * confusão específica — o que a dissertação chama de foco exclusivo no
   * ponto que causou o erro.
   */
  wrongAnswerChosen?: string;
  /** Pergunta que o aluno errou, para a remediação não repetir a formulação. */
  previousQuestion?: string;
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
  /** Demanda cognitiva declarada pelo modelo, usada para ponderar os pontos. */
  cognitiveLevel?: CognitiveLevel;
  /** Competência exercida ao acertar, nomeada para o feedback de maestria. */
  competency?: string;
}

export function buildPrompt({
  trail,
  index,
  level,
  failCount = 0,
  topicTitle,
  legalReference,
  cycle,
  wrongAnswerChosen,
  previousQuestion,
}: GenerateModuleInput): { prompt: string; seed: number } {
  const seed = Math.floor(Math.random() * 1_000_000);

  const currentTopic = topicTitle
    ? `Tópico: ${topicTitle}${legalReference ? ` (${legalReference})` : ''}` +
      (cycle && cycle > 1 ? ` — Ciclo ${cycle}` : '')
    : '';

  const isReattempt = failCount > 0;
  const selectedStyle = STYLE_DIRECTIVES[seed % STYLE_DIRECTIVES.length];
  const expected = EXPECTED_COGNITIVE[level].join(' ou ');

  // Bloco de remediação: só existe no re-estudo, e é onde a ZDP opera.
  const remediation = isReattempt
    ? `
ESTE É UM RE-ESTUDO. O aluno errou a questão anterior (tentativa ${failCount}).
${previousQuestion ? `Pergunta que ele errou: "${previousQuestion}"` : ''}
${
  wrongAnswerChosen
    ? `Alternativa que ele escolheu: "${wrongAnswerChosen}"
Esta escolha revela a confusão exata dele. Ataque ESSA confusão: explique por
que aquele caminho parece correto e onde exatamente ele falha. Não se limite a
reafirmar a regra certa.`
    : ''
}

Calibragem do desafio (Zona de Desenvolvimento Proximal):
- NÃO repita a mesma formulação: se ele não entendeu daquele jeito, repetir não ensina.
- NÃO aumente a dificuldade: quem acabou de errar precisa de apoio, não de mais pressão.
- Mude o ÂNGULO, mantendo a mesma demanda cognitiva: outro exemplo, outra
  entrada no mesmo conceito, um contraste que torne a distinção visível.
- O aluno deve terminar este módulo conseguindo acertar. O objetivo da
  remediação é a experiência de êxito, não uma segunda reprovação.
`
    : '';

  const prompt = `Você é ALICE, assistente de microaprendizagem para servidores públicos municipais brasileiros, especialista na trilha "${trail}".

Tarefa: criar o Módulo #${index + 1} no nível "${level}".
Tópico de referência: ${currentTopic || `Visão geral de ${trail}`}
Seed de variabilidade: ${seed}
Diretriz estilística desta geração: ${selectedStyle}

━━━ QUEM É O SEU LEITOR ━━━
Um servidor municipal que opera contratações e responde pessoalmente pelo que
assina. A pesquisa que fundamenta esta plataforma encontrou um padrão: esses
servidores concluem capacitações e continuam sem se sentir capazes de aplicar
a norma sozinhos. O problema não é falta de informação — é falta de confiança
na própria capacidade de decidir.

Portanto, seu objetivo não é apenas informar. É fazer o servidor terminar o
módulo pensando "eu consigo resolver isso". Cada escolha de linguagem serve a
isso.

━━━ COMO ESCREVER O FEEDBACK ━━━
O feedback é o instrumento mais importante deste módulo.

feedbackCorrect — NOMEIE A COMPETÊNCIA EXERCIDA, não elogie a pessoa.
  Ruim:  "Parabéns, você acertou!"
  Ruim:  "Excelente! Você é muito bom nisso."
  Bom:   "Você identificou corretamente que a dispensa por valor exige
          controle de fracionamento (Art. 75, §1º). É exatamente essa leitura
          que evita o apontamento mais comum do Tribunal de Contas."
  O acerto precisa virar evidência concreta de capacidade. Diga O QUE ele
  demonstrou saber fazer e por que aquilo importa no trabalho dele.

feedbackWrong — ACOLHA E REDIRECIONE, sem sinalizar deficiência.
  Ruim:  "Incorreto. A resposta certa era..."
  Ruim:  "Você errou. Preste mais atenção."
  Bom:   "Esse caminho é intuitivo, e muita gente decide assim — mas o Art. X
          separa os dois casos. A diferença está em [distinção]. Com ela em
          mãos, o próximo caso desse tipo fica direto."
  O erro é informação sobre a explicação, não sobre o servidor. Trate a
  confusão como razoável, mostre a distinção que resolve, e projete
  capacidade futura.

━━━ REGRAS DE CONTEÚDO ━━━
1. Varie as aberturas. NÃO comece slides com fórmulas fixas ("Você sabia?",
   "Na prática...", "De acordo com...", "É importante ressaltar").
2. Os 3 slideTexts são autônomos e progressivos: gancho concreto → o miolo
   técnico com o dispositivo legal → a ação que o servidor toma amanhã.
3. Sempre que houver base legal, cite o dispositivo. Nunca invente número de
   artigo, prazo ou valor: se não tiver certeza, descreva o conceito sem o
   número. Um número errado aqui vira um processo instruído errado lá.
4. Quando o tema tiver divergência entre tribunais de contas, diga isso em vez
   de apresentar um lado como pacífico.
5. Cenários de município pequeno e médio, com nomes fictícios. O servidor
   precisa se reconhecer na situação (experiência vicária: ver um par igual
   resolvendo aumenta a crença na própria capacidade).
6. As alternativas erradas são distratores plausíveis — o engano que um
   servidor real cometeria, não absurdos descartáveis.
${remediation}
━━━ DEMANDA COGNITIVA ━━━
Este módulo é nível "${level}", então a questão deve exigir ${expected}
(Taxonomia de Bloom Revisada — Anderson e Krathwohl, 2001):

- LEMBRAR   — reconhecer ou recordar definição, prazo, competência
- ENTENDER  — explicar com as próprias palavras, exemplificar, classificar
- APLICAR   — usar a regra num caso concreto de rotina
- ANALISAR  — distinguir hipóteses próximas, identificar o que está em jogo
- AVALIAR   — julgar a regularidade de uma decisão, sustentar posição
- CRIAR     — propor o encaminhamento de uma situação sem resposta pronta

Declare em "cognitiveLevel" o processo que a SUA questão exige de fato — não o
que seria esperado do nível. A pontuação do aluno é ponderada por esse valor,
então declarar acima do real infla o placar sem aprendizado correspondente.

Em "competency", escreva em uma frase curta a competência que o servidor
demonstra ao acertar ("distinguir dispensa de inexigibilidade"). É o que
transforma o acerto em evidência de capacidade.

━━━ VARIABILIDADE ━━━
Gere um "variationId" único no formato 'var_${seed}_${index}_[hash]'
representando a vertente semântica exata deste conteúdo. Mesmo que o tópico se
repita, aborde um detalhe, uma exceção ou um cenário diferente do usual.

━━━ SAÍDA (JSON obrigatório) ━━━
{
  "variationId": "ID único de variação semântica",
  "title": "Título curto e concreto (ex: 'O limite que ninguém confere')",
  "slideTexts": ["Texto 1 (max 120 char)", "Texto 2 (max 120 char)", "Texto 3 (max 120 char)"],
  "question": "Pergunta do desafio",
  "options": [
    {"label": "Opção A", "value": "correct/wrong"},
    {"label": "Opção B", "value": "correct/wrong"},
    {"label": "Opção C", "value": "correct/wrong"}
  ],
  "cognitiveLevel": "LEMBRAR|ENTENDER|APLICAR|ANALISAR|AVALIAR|CRIAR",
  "competency": "Competência demonstrada ao acertar, em uma frase",
  "feedbackCorrect": "Nomeia a competência exercida e por que ela importa",
  "feedbackWrong": "Acolhe a confusão, mostra a distinção, projeta capacidade",
  "imagePrompts": ["descrição em inglês 1", "descrição em inglês 2", "descrição em inglês 3"]
}`;

  return { prompt, seed };
}

const VALID_COGNITIVE: CognitiveLevel[] = [
  'LEMBRAR',
  'ENTENDER',
  'APLICAR',
  'ANALISAR',
  'AVALIAR',
  'CRIAR',
];

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
    // Nível cognitivo inválido cai no peso neutro: melhor pontuar de menos do
    // que inflar o placar por um rótulo que o modelo inventou.
    cognitiveLevel: VALID_COGNITIVE.includes(m.cognitiveLevel as CognitiveLevel)
      ? m.cognitiveLevel
      : 'ENTENDER',
    competency: typeof m.competency === 'string' ? m.competency.slice(0, 200) : undefined,
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
