
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
}

export interface Trail {
  id: string;
  name: string;
  description: string;
  /** null = disponível para todos os tenants. */
  tenantId: string | null;
  topics: TrailTopic[];
  levels: LearningLevel[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
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
