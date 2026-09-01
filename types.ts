
// ============================================================================
// ALICE 2.0 — Modelo de domínio
//
// A plataforma é multi-tenant: cada prefeitura é um Tenant isolado. Usuários
// pertencem a um tenant através de um Membership, que carrega o papel (role).
// ============================================================================

// ---------------------------------------------------------------------------
// Papéis e permissões
// ---------------------------------------------------------------------------

/**
 * SUPER_ADMIN  — equipe ALICE. Enxerga todos os tenants, gerencia planos.
 * TENANT_ADMIN — gestor de capacitação da prefeitura. Enxerga apenas o seu tenant.
 * ALUNO        — servidor municipal. Enxerga apenas o próprio progresso.
 */
export type Role = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'ALUNO';

/** Papel legado usado pela navegação do app do aluno. Mantido por compatibilidade. */
export type UserRole = 'GESTOR' | 'ALUNO';

export const ROLE_HIERARCHY: Record<Role, number> = {
  ALUNO: 0,
  TENANT_ADMIN: 1,
  SUPER_ADMIN: 2,
};

export function hasAtLeastRole(role: Role | undefined, required: Role): boolean {
  if (!role) return false;
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[required];
}

// ---------------------------------------------------------------------------
// Tenant (prefeitura)
// ---------------------------------------------------------------------------

export type PlanId = 'PILOTO' | 'ESSENCIAL' | 'GESTAO' | 'ENTERPRISE';

export interface Plan {
  id: PlanId;
  name: string;
  /** Assentos inclusos. null = ilimitado. */
  seats: number | null;
  /** Gerações de IA por mês no tenant inteiro. null = ilimitado. */
  aiGenerationsPerMonth: number | null;
  /** Preço mensal em centavos de BRL. 0 = gratuito. */
  priceCents: number;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  PILOTO: {
    id: 'PILOTO',
    name: 'Piloto',
    seats: 30,
    aiGenerationsPerMonth: 500,
    priceCents: 0,
    features: ['Trilha Lei 14.133', 'Até 30 servidores', 'Painel do gestor', '90 dias'],
  },
  ESSENCIAL: {
    id: 'ESSENCIAL',
    name: 'Essencial',
    seats: 100,
    aiGenerationsPerMonth: 3000,
    priceCents: 89000,
    features: [
      'Todas as trilhas',
      'Até 100 servidores',
      'Painel do gestor',
      'Relatórios de conformidade',
      'Suporte por e-mail',
    ],
  },
  GESTAO: {
    id: 'GESTAO',
    name: 'Gestão',
    seats: 400,
    aiGenerationsPerMonth: 12000,
    priceCents: 249000,
    features: [
      'Tudo do Essencial',
      'Até 400 servidores',
      'Trilhas personalizadas do município',
      'Certificados de conclusão',
      'Exportação para o TCE',
      'Suporte prioritário',
    ],
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    seats: null,
    aiGenerationsPerMonth: null,
    priceCents: 0, // sob consulta
    features: [
      'Servidores ilimitados',
      'Consórcios intermunicipais',
      'SSO institucional',
      'SLA contratual',
      'Gerente de conta dedicado',
    ],
  },
};

export type TenantStatus = 'ATIVO' | 'TRIAL' | 'SUSPENSO' | 'CANCELADO';

/**
 * Modo de identificação do tenant.
 *
 * OPEN_PILOT   — servidor digita o e-mail e entra, sem senha. Baixa fricção,
 *                usado durante o piloto. Não confia no e-mail para autorização.
 * DOMAIN_INVITE — login Google; o domínio do e-mail define o tenant.
 * INVITE_ONLY  — apenas e-mails previamente cadastrados pelo gestor.
 */
export type AuthMode = 'OPEN_PILOT' | 'DOMAIN_INVITE' | 'INVITE_ONLY';

export interface Tenant {
  id: string;
  /** Identificador na URL: "prefeitura-de-blumenau". */
  slug: string;
  name: string;
  /** Sigla da UF: "SC". */
  uf: string;
  /** Código IBGE do município — chave para cruzar com dados públicos. */
  ibgeCode?: string;
  /** População, usada para dimensionar o plano e priorizar o funil comercial. */
  population?: number;

  plan: PlanId;
  status: TenantStatus;
  authMode: AuthMode;

  /** Domínios de e-mail aceitos quando authMode = DOMAIN_INVITE. */
  allowedEmailDomains: string[];

  /** Trilhas habilitadas para este tenant. */
  enabledTrails: string[];

  contact: {
    name: string;
    email: string;
    phone?: string;
    role?: string;
  };

  branding?: {
    primaryColor?: string;
    logoUrl?: string;
  };

  createdAt: string;
  updatedAt: string;
  trialEndsAt?: string;

  /** Contadores desnormalizados para o console admin não varrer subcoleções. */
  stats?: TenantStats;
}

export interface TenantStats {
  totalUsers: number;
  activeUsers30d: number;
  totalQuizzes: number;
  averagePoints: number;
  aiGenerationsThisMonth: number;
  lastActivityAt?: string;
}

// ---------------------------------------------------------------------------
// Membership — liga um usuário a um tenant com um papel
// ---------------------------------------------------------------------------

export interface Membership {
  /** `${tenantId}__${emailKey}` */
  id: string;
  tenantId: string;
  /** E-mail em minúsculas. Chave natural do usuário. */
  email: string;
  role: Role;
  status: 'ATIVO' | 'CONVIDADO' | 'INATIVO';
  invitedAt?: string;
  joinedAt?: string;
  lastAccessAt?: string;
  /** Secretaria/departamento — permite recortar relatórios por área. */
  department?: string;
}

// ---------------------------------------------------------------------------
// Trilhas de conteúdo (antes hardcoded na Lei 14.133)
// ---------------------------------------------------------------------------

export interface TrailTopic {
  id: string;
  title: string;
  /** Referência legal: "Arts. 1º a 7º". */
  legalReference?: string;

  /**
   * Conteúdo escrito à mão para este tópico, servido no primeiro acesso.
   *
   * Quando ausente, o primeiro aluno a abrir o módulo dispara UMA geração de
   * IA, que é salva como variante padrão do módulo. Isso mantém o invariante
   * de custo: paga-se por módulo, nunca por aluno.
   */
  baseContent?: VariantContent;
}

export interface Trail {
  id: string;
  /** Identificador estável usado nas chaves de módulo: "lei-14133". */
  slug: string;
  name: string;
  description: string;
  /** null = disponível para todos os tenants. */
  tenantId: string | null;
  topics: TrailTopic[];
  levels: LearningLevel[];
  isPublished: boolean;
  /** Ordem de exibição na escolha da trilha. */
  order?: number;
  createdAt: string;
  updatedAt: string;
}

/** Resumo enviado ao aluno na tela de escolha — sem o conteúdo dos módulos. */
export interface TrailSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  topicCount: number;
  levels: LearningLevel[];
}

export type LearningLevel = 'Básico' | 'Intermediário' | 'Especialista';

// ---------------------------------------------------------------------------
// Acessibilidade
// ---------------------------------------------------------------------------

export type FontSize = 'normal' | 'large' | 'extra';

export interface AccessibilityState {
  highContrast: boolean;
  fontSize: FontSize;
  screenReaderMode: boolean;
  toggleHighContrast: () => void;
  setFontSize: (size: FontSize) => void;
  toggleScreenReaderMode: () => void;
}

// ---------------------------------------------------------------------------
// Conteúdo de aprendizagem
// ---------------------------------------------------------------------------

export interface Option {
  label: string;
  value: string;
}

export interface Slide {
  text: string;
  imageUrl: string;
}

export interface ModuleContent {
  title: string;
  slides: Slide[];
  question: string;
  options: Option[];
  feedbackCorrect: string;
  feedbackWrong: string;
  variationId?: string;
  /**
   * Id da variante servida, quando o conteúdo veio do banco de variantes.
   * Ausente no conteúdo padrão do app — que, por não ter id, não é promovido
   * nem penalizado pelo resultado do quiz.
   */
  variantId?: string;
}

export interface Message {
  id: string;
  sender: 'ALICE' | 'USER';
  text: string;
  imageUrl?: string;
  options?: Option[];
  reward?: {
    title: string;
    points: number;
  };
}

export type ConversationStage =
  | 'GREETING'
  | 'REELS_VIEW'
  | 'QUIZ_VIEW'
  | 'FEEDBACK_VIEW'
  | 'DIAGNOSTIC_START'
  | 'TRAIL_SELECTION'
  | 'LEVEL_SELECTION';

// ---------------------------------------------------------------------------
// Estado do aluno
// ---------------------------------------------------------------------------

export interface UserState {
  name?: string;
  email?: string;
  /** Tenant ao qual o progresso pertence. Ausente em progresso legado. */
  tenantId?: string;
  goal?: string;
  currentTrail?: string;
  currentLevel: LearningLevel;
  currentModuleIndex: number;
  highestModuleIndex?: number;
  currentSlideIndex: number;
  currentModuleContent?: ModuleContent;
  currentFailCount?: number;
  completedQuizzes: number[];
  quizCount: number;
  correctQuizzesCount: {
    Básico: number;
    Intermediário: number;
    Especialista: number;
  };
  points: number;
  level: number;
  badges?: string[];
  feedbackNeeded: boolean;
  lastFeedbackScore?: 'positivo' | 'neutro' | 'negativo';
  lastStudyDate?: string | null;
  streakDays?: number;
  hasTestedReels?: boolean;
}

// ---------------------------------------------------------------------------
// Sessão — quem está logado e no que pode mexer
// ---------------------------------------------------------------------------

export interface Session {
  email: string;
  displayName: string;
  tenantId: string | null;
  role: Role;
  /** true quando a identidade veio de um provedor verificado (Google). */
  verified: boolean;
}

// ---------------------------------------------------------------------------
// Variantes de módulo — o ciclo de aprendizado da plataforma
//
// A IA só é acionada quando o aluno erra: o erro indica que a explicação
// padrão não funcionou para ele. O conteúdo gerado nasce como CANDIDATE e,
// quando leva alunos distintos ao acerto, é promovido a PROMOTED e passa a
// ser servido como padrão. Assim cada geração é paga uma vez e o conteúdo
// melhora com o uso, em vez de ser descartado.
// ---------------------------------------------------------------------------

export type VariantOrigin = 'STANDARD' | 'AI' | 'CURATED';

export type VariantStatus =
  /** Gerada pela IA, ainda sem evidência de que ensina melhor. */
  | 'CANDIDATE'
  /** Levou alunos distintos ao acerto; é o conteúdo padrão do módulo. */
  | 'PROMOTED'
  /** Descartada por revisão humana ou desempenho ruim. */
  | 'REJECTED';

/** Acertos de alunos distintos necessários para promover uma variante. */
export const PROMOTION_THRESHOLD = 3;

export interface VariantContent {
  title: string;
  slideTexts: string[];
  question: string;
  options: Option[];
  feedbackCorrect: string;
  feedbackWrong: string;
}

export interface ModuleVariant {
  id: string;
  /** Chave do módulo: `${trail}__${level}__${index}`. */
  moduleKey: string;
  trail: string;
  level: LearningLevel;
  moduleIndex: number;

  variationId: string;
  content: VariantContent;
  origin: VariantOrigin;
  status: VariantStatus;

  /** Tenant que originou a variante. null = disponível para todos. */
  tenantId: string | null;

  stats: {
    served: number;
    correct: number;
    wrong: number;
    /** E-mails que acertaram, para contar alunos distintos, não tentativas. */
    correctBy: string[];
  };

  createdAt: string;
  createdBy: string;
  promotedAt?: string;
  /** Preenchido quando um humano rejeita a variante pelo console. */
  rejectedAt?: string;
  rejectedBy?: string;
}

// ---------------------------------------------------------------------------
// Imagens de fundo dos reels
//
// Ficam no Firebase Storage com os metadados no Firestore. Antes as imagens
// eram buscadas do Unsplash a cada exibição, o que deixava o app dependente
// de um serviço externo — fundo preto em rede ruim de prefeitura.
// ---------------------------------------------------------------------------

export interface ReelImage {
  id: string;
  /** URL pública no Firebase Storage. */
  url: string;
  /** Caminho no bucket, para gerenciar o arquivo depois. */
  storagePath: string;
  width: number;
  height: number;
  sizeBytes: number;
  /** Palavras que descrevem a cena, para escolher fundo coerente com o tema. */
  tags: string[];
  /** Procedência: exigida pela licença de alguns bancos e boa prática sempre. */
  credit: {
    source: string;
    author?: string;
    sourceUrl?: string;
    license: string;
  };
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Telemetria de uso de IA — base para controlar custo por tenant
// ---------------------------------------------------------------------------

export interface AiUsageRecord {
  id: string;
  tenantId: string;
  email: string;
  trail: string;
  level: LearningLevel;
  moduleIndex: number;
  model: string;
  /** Tokens reportados pelo provedor, quando disponíveis. */
  promptTokens?: number;
  responseTokens?: number;
  /** Custo estimado em centavos de BRL. */
  estimatedCostCents?: number;
  cacheHit: boolean;
  createdAt: string;
}
