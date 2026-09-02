/**
 * GET /api/manager/overview — dados do painel do gestor da prefeitura.
 *
 * Substitui os listeners onSnapshot que o Dashboard e o PilotResultsPanel
 * mantinham direto no Firestore. Sem tempo real por decisão de produto: o
 * gestor abre o painel pontualmente, e cada listener aberto custava leituras
 * continuamente.
 *
 * Exige identidade verificada. O painel expõe o desempenho de todos os
 * servidores da prefeitura, então o e-mail não verificado do piloto não serve
 * aqui — seria entregar dados de terceiros a quem digitasse um endereço.
 *
 * Parâmetro `tenantId` opcional:
 *   - TENANT_ADMIN  → ignorado; sempre o próprio tenant.
 *   - SUPER_ADMIN   → filtra por aquele tenant, ou lista todos se omitido.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handleError, methodNotAllowed } from '../../lib/http.js';
import { requireTenantScope } from '../../lib/auth.js';
import { getDb, COLLECTIONS } from '../../lib/firebaseAdmin.js';
import { billingSummaryFor, listGroups, listTenantMembers, listTenantUsers } from '../../lib/repositories.js';

/** Campos do documento de usuário que o painel usa. Nada além disso sai daqui. */
function toMember(data: Record<string, any>, id: string) {
  return {
    id,
    email: data.email || id,
    name: data.name || String(id).split('@')[0],
    area: data.area ?? 'Geral',
    points: Number(data.points) || 0,
    level: Number(data.level) || 1,
    currentLevel: data.currentLevel ?? 'Básico',
    currentModuleIndex: Number(data.currentModuleIndex) || 0,
    highestModuleIndex: Number(data.highestModuleIndex) || 0,
    quizCount: Number(data.quizCount) || 0,
    correctQuizzesCount: data.correctQuizzesCount ?? null,
    streakDays: Number(data.streakDays) || 0,
    specialties: data.specialties ?? {},
    bestTopic: data.bestTopic ?? null,
    bestTopicScore: data.bestTopicScore ?? null,
    worstTopic: data.worstTopic ?? null,
    worstTopicScore: data.worstTopicScore ?? null,
    softSkillsLevel: data.softSkillsLevel ?? null,
    pilotStatus: data.pilotStatus ?? data.status ?? null,
    cycleCount: data.cycleCount ?? undefined,
    lastAccess: data.lastAccess ?? null,
    tenantId: data.tenantId ?? null,
  };
}

/**
 * Normaliza a pesquisa. O piloto acumulou três gerações de nomes de campo
 * (inglês, português e variantes), e o front resolvia isso com cascatas de
 * `||` duplicadas em cada componente. Resolver uma vez aqui evita que um
 * painel conte um respondente que o outro ignora.
 */
function toSurvey(data: Record<string, any>, id: string) {
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      if (data[key] !== undefined && data[key] !== null) return data[key];
    }
    return undefined;
  };

  return {
    id,
    email: data.email || id,
    tenantId: data.tenantId ?? null,

    pre_experienceTime: pick('pre_experienceTime', 'pre_tempoAtuacao', 'experienceTime'),
    pre_formalCapacitation: pick(
      'pre_formalCapacitation',
      'pre_capacitacaoPrevia',
      'capacitacaoFormal'
    ),
    pre_generalKnowledge: pick(
      'pre_generalKnowledge',
      'pre_conhecimentoGeral',
      'pre_conhecimento_geral'
    ),
    pre_prepKnowledge: pick(
      'pre_prepKnowledge',
      'pre_conhecimentoFasePrep',
      'pre_conhecimento_fase_preparatoria'
    ),
    pre_confidenceBasic: pick(
      'pre_confidenceBasic',
      'pre_confiancaDuvidasBasicas',
      'pre_confidenceDoubt'
    ),
    pre_interestCustomTool: pick(
      'pre_interestCustomTool',
      'pre_interesseFerramenta',
      'pre_interestCustom'
    ),

    pos_daysUsed: pick('pos_daysUsed', 'pos_diasUsados', 'pos_activeDays'),
    pos_generalKnowledge: pick(
      'pos_generalKnowledge',
      'pos_conhecimentoGeral',
      'pos_conhecimento_geral'
    ),
    pos_prepKnowledge: pick(
      'pos_prepKnowledge',
      'pos_conhecimentoFasePrep',
      'pos_conhecimento_fase_preparatoria'
    ),
    pos_confidenceBasic: pick(
      'pos_confidenceBasic',
      'pos_confiancaDuvidasBasicas',
      'pos_confidenceDoubt'
    ),
    pos_perceivedAdaptation: pick(
      'pos_perceivedAdaptation',
      'pos_percepcaoAdaptacao',
      'pos_adaptationPerceived'
    ),
    pos_microLearningHelp: pick(
      'pos_microLearningHelp',
      'pos_ajudaMicroaprendizagem',
      'pos_microlearningHelp'
    ),
    pos_easeOfUse: pick('pos_easeOfUse', 'pos_facilidadeUso', 'pos_usability'),
    pos_motivation: pick('pos_motivation', 'pos_motivacaoContinuar', 'pos_motivationContinue'),
    pos_useAgain: pick('pos_useAgain', 'pos_usariaNovamente', 'pos_wouldUseAgain'),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  try {
    const scope = await requireTenantScope(
      req.headers.authorization,
      req.query.tenantId ? String(req.query.tenantId) : undefined
    );
    const tenantId = scope.tenantId;
    const isSuperAdmin = scope.isSuperAdmin;

    const db = getDb();

    const [rawMembers, surveySnap] = await Promise.all([
      tenantId
        ? listTenantUsers(tenantId)
        : db
            .collection(COLLECTIONS.users)
            .get()
            .then((snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      tenantId
        ? db.collection(COLLECTIONS.surveys).where('tenantId', '==', tenantId).get()
        : db.collection(COLLECTIONS.surveys).get(),
    ]);

    // O grupo de cada servidor vive no membership, não no documento de
    // progresso. Sem cruzar os dois, as turmas criadas pelo gestor não
    // apareceriam em relatório nenhum.
    const [groups, memberships, billing] = tenantId
      ? await Promise.all([
          listGroups(tenantId),
          listTenantMembers(tenantId),
          // O gestor precisa saber se o contrato dele está em dia: descobrir
          // um vencimento pela suspensão do acesso é a pior forma de saber.
          billingSummaryFor(tenantId).catch(() => null),
        ])
      : [[], [], null];

    const groupByEmail = new Map(
      memberships.filter((m) => m.groupId).map((m) => [m.email, m.groupId as string])
    );
    const groupNames = new Map(groups.map((g) => [g.id, g.name]));

    const members = (rawMembers as Record<string, any>[]).map((data) => {
      const base = toMember(data, data.id ?? data.email);
      const groupId = groupByEmail.get(base.email) ?? null;
      return { ...base, groupId, groupName: groupId ? groupNames.get(groupId) ?? null : null };
    });

    const surveys = surveySnap.docs.map((d) => toSurvey(d.data(), d.id));

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const isActive = (m: { lastAccess: string | null }) =>
      Boolean(m.lastAccess && Date.parse(m.lastAccess) > thirtyDaysAgo);

    const activeUsers30d = members.filter(isActive).length;
    const totalPoints = members.reduce((sum, m) => sum + m.points, 0);
    const totalQuizzes = members.reduce((sum, m) => sum + m.quizCount, 0);

    // Desempenho por secretaria: é a leitura que o gestor leva à reunião.
    const byGroup = groups.map((g) => {
      const groupMembers = members.filter((m) => m.groupId === g.id);
      const points = groupMembers.reduce((sum, m) => sum + m.points, 0);
      const quizzes = groupMembers.reduce((sum, m) => sum + m.quizCount, 0);

      return {
        id: g.id,
        name: g.name,
        members: groupMembers.length,
        active30d: groupMembers.filter(isActive).length,
        averagePoints: groupMembers.length ? Math.round(points / groupMembers.length) : 0,
        totalQuizzes: quizzes,
      };
    });

    return res.json({
      generatedAt: new Date().toISOString(),
      scope: { tenantId, isSuperAdmin },
      members,
      surveys,
      groups: byGroup,
      ungroupedMembers: members.filter((m) => !m.groupId).length,
      billing: billing
        ? {
            hasContract: Boolean(billing.contract),
            planEndsAt: billing.contract?.endDate ?? null,
            seats: billing.contract?.seats ?? null,
            overdueInvoices: billing.overdueInvoices,
            nextDueDate: billing.nextDueDate,
          }
        : null,
      summary: {
        totalMembers: members.length,
        activeUsers30d,
        averagePoints: members.length ? Math.round(totalPoints / members.length) : 0,
        totalQuizzes,
        surveysCompleted: surveys.length,
      },
    });
  } catch (err) {
    return handleError(res, err, 'manager/overview');
  }
}
