# ALICE 2.0

Plataforma de microaprendizagem para servidores de prefeituras pequenas e médias.
Trilha principal: Lei 14.133/21 (Nova Lei de Licitações).

## O negócio em uma frase

Municípios pequenos não têm como capacitar a equipe de contratações no formato
tradicional — e a Lei 14.133 responsabiliza pessoalmente o agente que assina.
A ALICE entrega o conteúdo em pílulas de três minutos no celular e dá ao gestor
o dado de quem está preparado.

- **Cliente pagante**: a prefeitura (secretaria de administração, controladoria
  interna ou RH).
- **Usuário**: o servidor que opera contratações.
- **Quem decide a compra**: normalmente não é quem usa. O painel do gestor
  existe para essa pessoa.

## Domínios

| Domínio | Papel |
|---|---|
| `aprendacomalice.com` | Landing page comercial |
| `appalice.cloud` | Aplicativo do servidor |
| `appalice.cloud/admin` | Console da equipe ALICE |

## Stack

- **Front**: React 19 + TypeScript + Tailwind 4 + Motion, build Vite
- **API**: Vercel Functions em `/api` (o `server.ts` só monta as mesmas
  funções no Express para desenvolvimento local — não duplique lógica lá)
- **Dados**: Firestore, acessado pelo servidor via Firebase Admin SDK
- **IA**: Google Gemini via `@google/genai`, modelo definido em `GEMINI_MODEL`
- **Hospedagem**: Vercel

## Arquitetura — o que não quebrar

### 1. O cliente não fala com o Firestore

`firestore.rules` nega tudo por padrão e o front **nem importa mais o SDK do
Firestore** — só o Auth. Todo dado entra e sai por `/api`, que usa o Admin SDK
e valida tenant, papel e cota.

**Não reintroduza acesso direto do browser ao Firestore.** O modo de login atual
não produz identidade verificável, então uma regra permissiva abre o banco para
a internet. O padrão perigoso a evitar é o que existia antes: `setDoc` dentro de
um `try/catch` que cai no `localStorage` — com as regras fechadas isso perde
dados em silêncio, porque o app continua funcionando e nada chega ao servidor.

Para gravar do cliente, use `services/studentApi.ts` (aluno) ou
`services/managerApi.ts` / `services/adminApi.ts` (painéis).

### 2. Multi-tenancy

Cada prefeitura é um `Tenant`. Usuários se ligam a ele por `Membership`, que
carrega o papel. Qualquer consulta nova precisa filtrar por `tenantId` — caso
contrário uma prefeitura enxerga os dados de outra.

### 3. Dois níveis de identidade

| Nível | Como entra | Vale para |
|---|---|---|
| **Não verificada** (`OPEN_PILOT`) | Digita o e-mail, sem senha | Atribuir progresso do próprio aluno |
| **Verificada** | Login Google (Firebase ID token) | Console admin, painel do gestor |

Nunca conceda privilégio com base num e-mail não verificado. `requireSuperAdmin`
e `requireTenantAdmin` em `lib/auth.ts` são os únicos caminhos para rota
administrativa.

A régra prática: se a rota devolve dados de **outra pessoa**, exige identidade
verificada. O painel do gestor mostra o desempenho de todos os servidores da
prefeitura, então entra nessa categoria — não basta digitar um e-mail.

### 4. A IA só trabalha quando o aluno erra

Este é o invariante que faz a margem fechar. O primeiro acesso a um módulo
nunca chama o Gemini:

```
abre o módulo  → variante PROMOTED, ou conteúdo padrão     (custo zero)
acerta         → registra acerto                            (custo zero)
ERRA           → gera nova explicação, salva como CANDIDATE  (única chamada)
3 alunos distintos acertam com ela → PROMOTED, vira o padrão do módulo
```

O erro é o sinal de que a explicação não funcionou; o acerto posterior é a
evidência de que a nova funcionou. Por isso a variante é persistida em
`moduleVariants` em vez de descartada — sem isso, cada aluno que errasse a
mesma questão pagaria uma geração nova.

Detalhes que não devem ser desfeitos:

- **Alunos distintos, não tentativas.** O mesmo aluno insistindo não é
  evidência de qualidade.
- **A contagem roda em transação** (`recordVariantOutcome`). Sem isso, dois
  alunos respondendo juntos leem o mesmo contador e a promoção acontece com
  menos acertos que o exigido.
- `checkAiQuota` limita gerações por mês conforme o plano do tenant.

A promoção é automática, então a aba **Conteúdo** do console admin existe para
auditar e tirar do ar o que não deveria ter sido promovido — com três
alternativas por quiz, três acertos por acaso acontecem em ~3,7% dos casos.

### 5. Imagens dos reels são nossas

O acervo vive no Firebase Storage, com metadados e créditos em `reelImages`.
Não volte a montar URL de banco de imagens externo em tempo de exibição: isso
coloca um serviço de terceiros no caminho crítico, e rede ruim de prefeitura
vira reel com fundo preto. Sem acervo, o app cai num gradiente gerado
localmente — nunca em fundo vazio.

Carga: `npm run seed:images` (veja `.env.example`).

## Estrutura

```
api/                  Vercel Functions (produção)
  module.ts           conteúdo do módulo — nunca chama IA
  generateModule.ts   única rota que chama o Gemini
  quizResult.ts       registra acerto e promove variantes
  admin/              rotas que exigem SUPER_ADMIN
  manager/            painel do gestor (exige TENANT_ADMIN)
lib/                  código compartilhado servidor
  firebaseAdmin.ts    conexão Admin SDK
  auth.ts             autorização — leia antes de criar rota nova
  repositories.ts     acesso a dados
  moduleGenerator.ts  prompt e chamada Gemini
components/
  StudentApp.tsx      app do servidor municipal
  AdminConsole.tsx    console da equipe ALICE
  LandingPage.tsx     página comercial
  Dashboard.tsx       painel do gestor da prefeitura
services/             clientes de API do front
scripts/              carga do acervo de imagens
types.ts              modelo de domínio — comece por aqui
```

## Comandos

```bash
npm run dev            # servidor local em :3000 com as rotas de /api montadas
npm run lint           # tsc --noEmit
npm run build          # build de produção
npm run deploy:rules   # publica as regras do Firestore
npm run seed:images:dry  # lista as 40 imagens sem enviar
npm run seed:images      # carrega o acervo no Storage
```

CI roda `lint` e `build` em cada push e PR (`.github/workflows/ci.yml`).

## Convenções

- Comentário explica **por que**, não o que o código faz.
- Português em texto de interface, mensagem de erro e commit.
- Cada rota nova em `/api` começa por `applyCors` e termina em `handleError`.
- Rota administrativa sem `requireSuperAdmin` ou `requireTenantAdmin` é um bug
  de segurança, não uma omissão.
- Toda alteração precisa passar `npm run lint` e `npm run build` antes do commit.

## Estado atual e próximos passos

Concluído: multi-tenancy, fechamento do Firestore, API serverless, console
administrativo, landing page, code splitting por rota, migração completa do
front para a API (aluno, gestor e admin).

Em aberto, na ordem que faz diferença:

1. **Publicar as regras** (`npm run deploy:rules` e as de Storage) — enquanto
   isso não roda em produção, o banco segue aberto. O código já não depende de
   acesso direto.
2. **Carregar o acervo de imagens** (`npm run seed:images`). Sem ele os reels
   usam gradientes.
3. **Popular o primeiro tenant real** e validar o fluxo ponta a ponta. Os
   usuários do piloto atual não têm `tenantId`; só o super admin os enxerga.
4. **Trilhas configuráveis**: o conteúdo de fallback ainda está hardcoded em
   `services/geminiService.ts` com 16 tópicos da Lei 14.133.
5. **Cobrança**: hoje o plano é um campo no tenant, sem integração de pagamento.
6. **Certificados de conclusão** — pedido recorrente de quem precisa comprovar
   capacitação ao Tribunal de Contas.
