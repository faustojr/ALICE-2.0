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
import {
  AuthError,
  findMembershipByEmail,
  requireVerifiedIdentity,
} from '../../lib/auth.js';
import { getDb, COLLECTIONS } from '../../lib/firebaseAdmin.js';
import { listTenantUsers } from '../../lib/repositories.js';

function superAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

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
    const identity = await requireVerifiedIdentity(req.headers.authorization);
    const isSuperAdmin = superAdminEmails().includes(identity.email);

    let tenantId: string | null = null;

    if (isSuperAdmin) {
      // Sem tenantId, o super admin vê tudo — inclusive os alunos do piloto
      // atual, que ainda não têm vínculo com nenhuma prefeitura.
      tenantId = req.query.tenantId ? String(req.query.tenantId) : null;
    } else {
      const membership = await findMembershipByEmail(identity.email);
      if (!membership || membership.role !== 'TENANT_ADMIN') {
        throw new AuthError(
          'Este painel é restrito ao gestor de capacitação da prefeitura.',
          403
        );
      }
      tenantId = membership.tenantId;
    }

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

    const members = (rawMembers as Record<string, any>[]).map((data) =>
      toMember(data, data.id ?? data.email)
    );
    const surveys = surveySnap.docs.map((d) => toSurvey(d.data(), d.id));

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const activeUsers30d = members.filter(
      (m) => m.lastAccess && Date.parse(m.lastAccess) > thirtyDaysAgo
    ).length;

    const totalPoints = members.reduce((sum, m) => sum + m.points, 0);
    const totalQuizzes = members.reduce((sum, m) => sum + m.quizCount, 0);

    return res.json({
      generatedAt: new Date().toISOString(),
      scope: { tenantId, isSuperAdmin },
      members,
      surveys,
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
