import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import rateLimit from "express-rate-limit";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Rate limiting to prevent abuse on sensitive API routes only (not on static assets/scripts/html)
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 500 requests per windowMs on API
    message: { error: "Too many requests, please try again later." }
  });

  app.use(cors());
  app.use(express.json());
  app.use("/api/", apiLimiter);

  // In-memory store for user data
  // In a real app, this would be a database
  let users: Record<string, any> = {
    'ana@municipio.gov.br': { 
        email: 'ana@municipio.gov.br',
        name: 'Ana Silva', area: 'Jurídico', points: 1250, 
        specialties: { 'Lei de Licitações': 800, 'Lei de Resp. Fiscal': 200, 'Soft Skills': 250, 'Plano Diretor': 0 },
        preferredDays: 'Terça e Quinta', preferredTime: '08:00 - 09:00',
        bestTopic: 'Lei de Licitações', bestTopicScore: 92,
        worstTopic: 'Plano Diretor', worstTopicScore: 0,
        softSkillsLevel: 'Avançado',
        lastAccess: new Date().toISOString()
    }
  };

  // In-memory store for Gemini API limits per user with periodic memory cleanup
  const geminiLimits: Record<string, { count: number; windowStart: number }> = {};
  const LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const MAX_GENERATIONS_PER_WINDOW = 20; // max 20 generations per 15 minutes

  // Periodic cleanup every 10 minutes to prevent memory leak
  setInterval(() => {
    const now = Date.now();
    for (const key of Object.keys(geminiLimits)) {
      if (now - geminiLimits[key].windowStart > LIMIT_WINDOW_MS) {
        delete geminiLimits[key];
      }
    }
  }, 10 * 60 * 1000);

  // API Routes
  app.post("/api/generateModule", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY não configurada');
      }

      const { trail, index, level, failCount, email } = req.body;

      // Validação básica dos parâmetros recebidos
      if (!trail) {
        return res.status(400).json({ error: "Trilha não informada." });
      }
      if (index === undefined) {
        return res.status(400).json({ error: "Index não informado." });
      }
      if (!level) {
        return res.status(400).json({ error: "Nível não informado." });
      }

      // Identificar o usuário por email ou por IP
      const userIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userKey = (email ? email.trim().toLowerCase() : userIp?.toString()) || 'anonymous';

      const now = Date.now();
      if (!geminiLimits[userKey]) {
        geminiLimits[userKey] = { count: 0, windowStart: now };
      }

      const userLimit = geminiLimits[userKey];
      if (now - userLimit.windowStart > LIMIT_WINDOW_MS) {
        // Reiniciar a janela se o tempo passou
        userLimit.count = 1;
        userLimit.windowStart = now;
      } else {
        userLimit.count += 1;
        if (userLimit.count > MAX_GENERATIONS_PER_WINDOW) {
          const timeLeft = Math.ceil((LIMIT_WINDOW_MS - (now - userLimit.windowStart)) / 1000 / 60);
          return res.status(429).json({ 
            error: `Limite de geração de módulos atingido. Aguarde ${timeLeft} minutos para novas gerações.` 
          });
        }
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ 
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      
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

      let currentTopic = "";
      if (trail && trail.includes("14.133")) {
          const topicIndex = (index || 0) % LAW_14133_TOPICS.length;
          const cycle = Math.floor((index || 0) / LAW_14133_TOPICS.length) + 1;
          currentTopic = `Tópico: ${LAW_14133_TOPICS[topicIndex]} (Ciclo: ${cycle})`;
      }

      const isReattempt = (failCount || 0) > 0;
      const seed = Math.floor(Math.random() * 1000000);

      const styleDirectives = [
          "Foco Prático e de Governança (Foque na responsabilidade prática do servidor e em como gerenciar riscos operacionais ou de fiscalização de forma imediata). EVITE frases repetitivas. Use tom dinâmico de consultoria técnica.",
          "Foco em Caso de Estudo Realista (Desenvolva os slides narrando o caso fictício de um município de pequeno/médio porte lidando com esse tema de licitação. Mostre o que deu certo ou o que quase gerou infração).",
          "Foco em Erros Comuns e Alertas (Apresente os 3 erros mais comuns cometidos por comissões de contratação neste tema, seguidos de reações mitigadoras imediatas recomendadas pelo Tribunal de Contas).",
          "Foco em Simplificação e Analogia (Descomplique a burocracia do tema usando uma analogia clara da vida cotidiana ou analogias corporativas simples, conectando diretamente com a regra de ouro do artigo correspondente).",
          "Foco em Fluxo de Trabalho e Prazos (Construa uma sequência cronológica clara do procedimento, destacando os pontos críticos de transição de fase e os prazos que nenhum servidor municipal pode perder)."
      ];
      const selectedStyle = styleDirectives[seed % styleDirectives.length];

      const prompt = `Você é ALICE, uma assistente de microaprendizagem de elite, especialista em Lei 14.133/21 para servidores municipais brasileiros.
      Tarefa: Criar o Módulo #${(index || 0) + 1} para a trilha "${trail || ''}" no nível "${level || 'Básico'}".
      Seed de Variabilidade: ${seed}
      Diretriz Estilística e Pedagógica Atual: ${selectedStyle}
      
      Tópico de referência: ${currentTopic || "Visão geral da Lei 14.133"}
      
      REQUISITOS RIGOROSOS DE AUTENTICIDADE E SELEÇÃO DE LINGUAGEM:
      1. NÃO utilize fórmulas fixas ou chavões repetitivos (ex: não comece todos os slides com "Você sabia?", "Na prática...", "De acordo com..."). Varie as frases de abertura de todos os slides.
      2. Cada uma das 3 partes de slideTexts deve ser autônoma, envolvente e trazer informações práticas de extremo valor legal e operacional para prefeituras brasileiras. Escreva de forma fluida, natural, com forte teor instrutivo.
      3. O Quiz deve testar o entendimento profundo do cenário técnico descrito nos slides. Evite perguntas óbvias ou genéricas sobre transparência. Faça perguntas baseadas em aplicação real do artigo da Lei 14.133.
      4. As opções (options) devem ser realistas e conter distratores técnicos plausíveis. A resposta correta deve ter o valor exato "correct" e as demais "wrong".
      5. GERE OBRIGATORIAMENTE um 'variationId' (ID de Variação único) de formato 'var_${seed}_${index}_[hash]' que represente a vertente semântica exata abordada neste conteúdo (ex: 'var_512839_0_dispensa_emergencial', 'var_194821_2_etp_facultativo', etc.).
      6. Use este 'variationId' e o 'Seed de Variabilidade' para se forçar a criar conteúdo semanticamente inédito e isolado! Mesmo se o tópico for o mesmo de outros módulos, este ID exige que você aborde um detalhe, uma exceção, uma regra secundária ou um cenário do tribunal de contas totalmente diferente do usual, garantindo diversidade absoluta de conteúdo e evitando similaridade estrutural ou de escrita.
      7. ${isReattempt ? `Este é um RE-ESTUDO (A tentativa anterior do aluno resultou em falha. FailCount anterior do aluno: ${failCount}). Altere COMPLETAMENTE a abordagem explicativa do tema e a própria pergunta do quiz (ou formule uma variação de alto nível focando em uma exceção ou outro artigo correlacionado ao assunto).` : 'Forneça uma jornada de aprendizado limpa, focada e inovadora.'}
      
      Regras de nível:
      - Básico: Explique princípios e conceitos como se estivesse ensinando um colega novo. Foco em clareza técnica e impacto no dia a dia.
      - Intermediário: Aborde prazos, exceções e fluxos de trabalho. Use exemplos práticos de prefeituras.
      - Especialista: Crie uma SITUAÇÃO-PROBLEMA complexa. O quiz deve testar a capacidade de julgamento sob pressão, citando artigos quando necessário.

      Estrutura do JSON (MANDATÓRIO):
      {
        "variationId": "ID de variação único gerado dinamicamente para manter o conteúdo semântico distinto e evitar repetições",
        "title": "Título criativo e direto (ex: 'O segredo do Art. 75', 'Cuidado com o ETP')",
        "slideTexts": ["Texto 1 (max 120 char) - Gancho direto no tema", "Texto 2 (max 120 char) - O miolo técnico/Dica de ouro", "Texto 3 (max 120 char) - Ação prática que o servidor deve tomar"],
        "question": "Pergunta do desafio que valide o conhecimento do slide",
        "options": [
          {"label": "Opção A", "value": "correct/wrong"},
          {"label": "Opção B", "value": "correct/wrong"},
          {"label": "Opção C", "value": "correct/wrong"}
        ],
        "feedbackCorrect": "Explicação técnica curta (Base legal)",
        "feedbackWrong": "Feedback orientador: explique o erro e aponte para a regra correta",
        "imagePrompts": ["descrição de imagem em inglês 1", "descrição de imagem em inglês 2", "descrição de imagem em inglês 3"]
      }`;

      const response = await ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: prompt,
          config: { 
              responseMimeType: 'application/json',
              temperature: 1.0,
              topK: 64,
              topP: 0.95,
              seed: seed
          }
      });

      if (!response.text) throw new Error("AI Generation failed: No text returned");
      
      const data = JSON.parse(response.text.trim());
      res.json(data);
    } catch (error) {
      console.error("AI Generation error:", error);
      res.status(500).json({ error: "Failed to generate module" });
    }
  });

  app.get("/api/users", (req, res) => {
    res.json(Object.values(users));
  });

  app.post("/api/users/login", (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    
    const user = users[email.toLowerCase()];
    if (user) {
      res.json({ found: true, user });
    } else {
      res.json({ found: false });
    }
  });

  app.post("/api/users/update", (req, res) => {
    const userData = req.body;
    if (!userData.email) {
      return res.status(400).json({ error: "Email is required" });
    }
    
    const emailKey = userData.email.toLowerCase();
    users[emailKey] = {
      ...users[emailKey],
      ...userData,
      email: emailKey,
      lastAccess: new Date().toISOString()
    };
    
    res.json({ success: true, user: users[emailKey] });
  });

  app.get("/api/users/stats", (req, res) => {
    const userList = Object.values(users);
    if (userList.length === 0) return res.json({ averagePoints: 0 });
    
    const totalPoints = userList.reduce((sum, user) => sum + (user.points || 0), 0);
    const averagePoints = Math.round(totalPoints / userList.length);
    
    res.json({ averagePoints });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
