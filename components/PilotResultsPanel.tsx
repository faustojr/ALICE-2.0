import React, { useState, useEffect, useMemo } from 'react';
import type { ManagerSurvey } from '../services/managerApi';
import { 
  Download, 
  Users, 
  FileCheck, 
  Award, 
  TrendingUp, 
  CheckCircle2, 
  HelpCircle,
  AlertCircle
} from 'lucide-react';

interface UserRecord {
  id: string;
  email: string;
  name?: string;
  pilotStatus?: string;
  cycleCount?: number;
  currentLevel?: string;
  currentModuleIndex?: number;
  points?: number;
}

interface MergedParticipant {
  id: string;
  email: string;
  name: string;
  status: string; // onboarding, pré pendente, ativo, pós pendente, concluído
  cycleCount: number;
  
  // PRE
  experienceTime: string;
  formalCapacitation: string; // Yes / No
  pre_cg: number | null;
  pre_cp: number | null;
  pre_cd: number | null;
  interestCustomTool: number | null;
  
  // POST
  daysUsed: number | null;
  pos_cg: number | null;
  pos_cp: number | null;
  pos_cd: number | null;
  perceivedAdaptation: number | null;
  microLearningHelp: number | null;
  easeOfUse: number | null;
  motivation: number | null;
  useAgain: number | null;
  
  // DELTAS
  delta_cg: number | null;
  delta_cp: number | null;
  delta_cd: number | null;
}

interface PilotResultsPanelProps {
  users: UserRecord[];
  surveys: ManagerSurvey[];
  loading?: boolean;
}

/**
 * Recebe os dados já carregados pelo Dashboard. Antes mantinha dois listeners
 * onSnapshot próprios, o que duplicava a leitura das mesmas coleções e abria
 * caminho para os dois painéis divergirem entre si.
 */
export const PilotResultsPanel: React.FC<PilotResultsPanelProps> = ({
  users,
  surveys,
  loading = false,
}) => {
  const errorHeader: string | null = null;

  // helper to normalise format of formal training
  const formatFormalTraining = (val: any) => {
    if (val === undefined || val === null) return '—';
    if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
    const cleanStr = String(val).trim().toLowerCase();
    if (cleanStr === 'yes' || cleanStr === 'sim' || cleanStr === 'true' || cleanStr === 's') return 'Sim';
    if (cleanStr === 'no' || cleanStr === 'não' || cleanStr === 'nao' || cleanStr === 'false' || cleanStr === 'n') return 'Não';
    return String(val);
  };

  // Merge datasets
  const mergedParticipants = useMemo((): MergedParticipant[] => {
    const participantsMap = new Map<string, MergedParticipant>();

    // Step 1: Add all user records first
    users.forEach((u) => {
      const emailLower = u.email.trim().toLowerCase();
      
      // Calculate cycle count: if explicitly provided use it, else calculate from currentModuleIndex
      let cycles = 0;
      if (u.cycleCount !== undefined) {
        cycles = u.cycleCount;
      } else if (u.currentModuleIndex !== undefined) {
        cycles = Math.floor(u.currentModuleIndex / 3);
      } else if (u.points !== undefined) {
        // Approximate from points if needed, but fallback to 0
        cycles = Math.floor(Math.max(0, u.points - 1250) / 150);
      }

      participantsMap.set(emailLower, {
        id: u.id,
        email: u.email,
        name: u.name || u.email.split('@')[0],
        status: u.pilotStatus || 'onboarding',
        cycleCount: cycles,
        experienceTime: '—',
        formalCapacitation: '—',
        pre_cg: null,
        pre_cp: null,
        pre_cd: null,
        interestCustomTool: null,
        daysUsed: null,
        pos_cg: null,
        pos_cp: null,
        pos_cd: null,
        perceivedAdaptation: null,
        microLearningHelp: null,
        easeOfUse: null,
        motivation: null,
        useAgain: null,
        delta_cg: null,
        delta_cp: null,
        delta_cd: null,
      });
    });

    // Step 2: Merge survey data (can match by doc ID or survey email field)
    surveys.forEach((s) => {
      const emailField = s.email?.trim().toLowerCase();
      const docIdLower = s.id.trim().toLowerCase();
      
      // Look for a key match in our dataset
      let matchedKey = '';
      if (emailField && participantsMap.has(emailField)) {
        matchedKey = emailField;
      } else if (participantsMap.has(docIdLower)) {
        matchedKey = docIdLower;
      } else {
        // Look for partial match
        for (const key of participantsMap.keys()) {
          if (emailField && (key.includes(emailField) || emailField.includes(key))) {
            matchedKey = key;
            break;
          }
          if (key.includes(docIdLower) || docIdLower.includes(key)) {
            matchedKey = key;
            break;
          }
        }
      }

      const isCompleted = s.pos_perceivedAdaptation !== undefined || s.pos_generalKnowledge !== undefined;

      if (matchedKey) {
        const existing = participantsMap.get(matchedKey)!;
        
        // Update values
        if (s.pre_experienceTime) existing.experienceTime = s.pre_experienceTime;
        if (s.pre_formalCapacitation !== undefined) {
          existing.formalCapacitation = formatFormalTraining(s.pre_formalCapacitation);
        }
        
        if (s.pre_generalKnowledge !== undefined) existing.pre_cg = Number(s.pre_generalKnowledge);
        if (s.pre_prepKnowledge !== undefined) existing.pre_cp = Number(s.pre_prepKnowledge);
        if (s.pre_confidenceBasic !== undefined) existing.pre_cd = Number(s.pre_confidenceBasic);
        if (s.pre_interestCustomTool !== undefined) existing.interestCustomTool = Number(s.pre_interestCustomTool);

        // Map status cleanly if we know it or infer it
        if (!existing.status || existing.status === 'onboarding') {
          if (isCompleted) {
            existing.status = 'completed';
          } else if (existing.pre_cg !== null) {
            existing.status = 'ativo';
          }
        }

        // Only fill POST fields if the survey is completed
        const normStatus = String(existing.status).trim().toLowerCase();
        const isActuallyCompleted = normStatus === 'concluido' || normStatus === 'concluído' || normStatus === 'completed';

        if (isActuallyCompleted || isCompleted) {
          if (s.pos_daysUsed !== undefined) existing.daysUsed = Number(s.pos_daysUsed);
          if (s.pos_generalKnowledge !== undefined) existing.pos_cg = Number(s.pos_generalKnowledge);
          if (s.pos_prepKnowledge !== undefined) existing.pos_cp = Number(s.pos_prepKnowledge);
          if (s.pos_confidenceBasic !== undefined) existing.pos_cd = Number(s.pos_confidenceBasic);
          if (s.pos_perceivedAdaptation !== undefined) existing.perceivedAdaptation = Number(s.pos_perceivedAdaptation);
          if (s.pos_microLearningHelp !== undefined) existing.microLearningHelp = Number(s.pos_microLearningHelp);
          if (s.pos_easeOfUse !== undefined) existing.easeOfUse = Number(s.pos_easeOfUse);
          if (s.pos_motivation !== undefined) existing.motivation = Number(s.pos_motivation);
          if (s.pos_useAgain !== undefined) existing.useAgain = Number(s.pos_useAgain);

          // Calculate Deltas: post_value - pre_value
          if (existing.pos_cg !== null && existing.pre_cg !== null) {
            existing.delta_cg = existing.pos_cg - existing.pre_cg;
          }
          if (existing.pos_cp !== null && existing.pre_cp !== null) {
            existing.delta_cp = existing.pos_cp - existing.pre_cp;
          }
          if (existing.pos_cd !== null && existing.pre_cd !== null) {
            existing.delta_cd = existing.pos_cd - existing.pre_cd;
          }
        }
      } else {
        // Create an untracked survey participant
        const fallbackEmail = emailField || s.id;
        participantsMap.set(fallbackEmail.toLowerCase(), {
          id: s.id,
          email: fallbackEmail,
          name: fallbackEmail.split('@')[0],
          status: isCompleted ? 'completed' : 'ativo',
          cycleCount: 0,
          experienceTime: s.pre_experienceTime || '—',
          formalCapacitation: formatFormalTraining(s.pre_formalCapacitation),
          pre_cg: s.pre_generalKnowledge !== undefined ? Number(s.pre_generalKnowledge) : null,
          pre_cp: s.pre_prepKnowledge !== undefined ? Number(s.pre_prepKnowledge) : null,
          pre_cd: s.pre_confidenceBasic !== undefined ? Number(s.pre_confidenceBasic) : null,
          interestCustomTool: s.pre_interestCustomTool !== undefined ? Number(s.pre_interestCustomTool) : null,
          daysUsed: s.pos_daysUsed !== undefined ? Number(s.pos_daysUsed) : null,
          pos_cg: s.pos_generalKnowledge !== undefined ? Number(s.pos_generalKnowledge) : null,
          pos_cp: s.pos_prepKnowledge !== undefined ? Number(s.pos_prepKnowledge) : null,
          pos_cd: s.pos_confidenceBasic !== undefined ? Number(s.pos_confidenceBasic) : null,
          perceivedAdaptation: s.pos_perceivedAdaptation !== undefined ? Number(s.pos_perceivedAdaptation) : null,
          microLearningHelp: s.pos_microLearningHelp !== undefined ? Number(s.pos_microLearningHelp) : null,
          easeOfUse: s.pos_easeOfUse !== undefined ? Number(s.pos_easeOfUse) : null,
          motivation: s.pos_motivation !== undefined ? Number(s.pos_motivation) : null,
          useAgain: s.pos_useAgain !== undefined ? Number(s.pos_useAgain) : null,
          delta_cg: (s.pos_generalKnowledge !== undefined && s.pre_generalKnowledge !== undefined) ? Number(s.pos_generalKnowledge) - Number(s.pre_generalKnowledge) : null,
          delta_cp: (s.pos_prepKnowledge !== undefined && s.pre_prepKnowledge !== undefined) ? Number(s.pos_prepKnowledge) - Number(s.pre_prepKnowledge) : null,
          delta_cd: (s.pos_confidenceBasic !== undefined && s.pre_confidenceBasic !== undefined) ? Number(s.pos_confidenceBasic) - Number(s.pre_confidenceBasic) : null,
        });
      }
    });

    return Array.from(participantsMap.values());
  }, [users, surveys]);

  // Aggregate statistics for summary row
  const summaryStats = useMemo(() => {
    let totalUsers = mergedParticipants.length;
    let preAnswered = 0;
    let postAnswered = 0;

    // Sum arrays for averages
    const sums = {
      pre_cg: { sum: 0, count: 0 },
      pre_cp: { sum: 0, count: 0 },
      pre_cd: { sum: 0, count: 0 },
      pre_interest: { sum: 0, count: 0 },
      
      pos_days: { sum: 0, count: 0 },
      pos_cg: { sum: 0, count: 0 },
      pos_cp: { sum: 0, count: 0 },
      pos_cd: { sum: 0, count: 0 },
      pos_adaptation: { sum: 0, count: 0 },
      pos_help: { sum: 0, count: 0 },
      pos_ease: { sum: 0, count: 0 },
      pos_motivation: { sum: 0, count: 0 },
      pos_again: { sum: 0, count: 0 },
    };

    mergedParticipants.forEach(p => {
      const isPre = p.pre_cg !== null || p.pre_cp !== null || p.pre_cd !== null;
      const isPost = p.perceivedAdaptation !== null || p.pos_cg !== null;
      
      if (isPre) preAnswered++;
      if (isPost) postAnswered++;

      // Likert accumulators
      if (p.pre_cg !== null) { sums.pre_cg.sum += p.pre_cg; sums.pre_cg.count++; }
      if (p.pre_cp !== null) { sums.pre_cp.sum += p.pre_cp; sums.pre_cp.count++; }
      if (p.pre_cd !== null) { sums.pre_cd.sum += p.pre_cd; sums.pre_cd.count++; }
      if (p.interestCustomTool !== null) { sums.pre_interest.sum += p.interestCustomTool; sums.pre_interest.count++; }

      if (p.daysUsed !== null) { sums.pos_days.sum += p.daysUsed; sums.pos_days.count++; }
      if (p.pos_cg !== null) { sums.pos_cg.sum += p.pos_cg; sums.pos_cg.count++; }
      if (p.pos_cp !== null) { sums.pos_cp.sum += p.pos_cp; sums.pos_cp.count++; }
      if (p.pos_cd !== null) { sums.pos_cd.sum += p.pos_cd; sums.pos_cd.count++; }
      if (p.perceivedAdaptation !== null) { sums.pos_adaptation.sum += p.perceivedAdaptation; sums.pos_adaptation.count++; }
      if (p.microLearningHelp !== null) { sums.pos_help.sum += p.microLearningHelp; sums.pos_help.count++; }
      if (p.easeOfUse !== null) { sums.pos_ease.sum += p.easeOfUse; sums.pos_ease.count++; }
      if (p.motivation !== null) { sums.pos_motivation.sum += p.motivation; sums.pos_motivation.count++; }
      if (p.useAgain !== null) { sums.pos_again.sum += p.useAgain; sums.pos_again.count++; }
    });

    const getAvg = (item: { sum: number; count: number }) => {
      return item.count > 0 ? (item.sum / item.count).toFixed(1) : '—';
    };

    return {
      totalUsers,
      preAnswered,
      postAnswered,
      averages: {
        pre_cg: getAvg(sums.pre_cg),
        pre_cp: getAvg(sums.pre_cp),
        pre_cd: getAvg(sums.pre_cd),
        pre_interest: getAvg(sums.pre_interest),
        pos_days: getAvg(sums.pos_days),
        pos_cg: getAvg(sums.pos_cg),
        pos_cp: getAvg(sums.pos_cp),
        pos_cd: getAvg(sums.pos_cd),
        pos_adaptation: getAvg(sums.pos_adaptation),
        pos_help: getAvg(sums.pos_help),
        pos_ease: getAvg(sums.pos_ease),
        pos_motivation: getAvg(sums.pos_motivation),
        pos_again: getAvg(sums.pos_again),
      }
    };
  }, [mergedParticipants]);

  // Export CSV
  const handleExportCSV = () => {
    if (mergedParticipants.length === 0) return;

    // Excel friendly UTF-8 with BOM setup
    const BOM = '\uFEFF';
    
    // Header definition
    const headers = [
      "E-mail",
      "Nome",
      "Status",
      "Ciclos Completados",
      "Tempo de Atuacao (Pre)",
      "Capacitacao Previa (Pre)",
      "Conhecimento Geral (Pre)",
      "Conhecimento Fase Prep (Pre)",
      "Confianca Duvidas (Pre)",
      "Interesse Customizacao (Pre)",
      "Dias Usados (Pos)",
      "Conhecimento Geral (Pos)",
      "Conhecimento Fase Prep (Pos)",
      "Confianca Duvidas (Pos)",
      "Percepcao Adaptacao (Pos)",
      "Microlearning Ajudou (Pos)",
      "Facilidade de Uso (Pos)",
      "Motivacao (Pos)",
      "Usaria de Novo (Pos)",
      "Delta Conhecimento Geral",
      "Delta Conhecimento Fase Prep",
      "Delta Confianca Duvidas"
    ];

    let csvContent = headers.join(',') + '\n';

    // Populate lines safely
    mergedParticipants.forEach(p => {
      const isCompleted = p.status.trim().toLowerCase() === 'completed' || p.status.trim().toLowerCase() === 'concluido' || p.status.trim().toLowerCase() === 'concluído';
      
      const line = [
        `"${p.email.replace(/"/g, '""')}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.status}"`,
        p.cycleCount,
        `"${p.experienceTime}"`,
        `"${p.formalCapacitation}"`,
        p.pre_cg !== null ? p.pre_cg : '—',
        p.pre_cp !== null ? p.pre_cp : '—',
        p.pre_cd !== null ? p.pre_cd : '—',
        p.interestCustomTool !== null ? p.interestCustomTool : '—',
        isCompleted && p.daysUsed !== null ? p.daysUsed : '—',
        isCompleted && p.pos_cg !== null ? p.pos_cg : '—',
        isCompleted && p.pos_cp !== null ? p.pos_cp : '—',
        isCompleted && p.pos_cd !== null ? p.pos_cd : '—',
        isCompleted && p.perceivedAdaptation !== null ? p.perceivedAdaptation : '—',
        isCompleted && p.microLearningHelp !== null ? p.microLearningHelp : '—',
        isCompleted && p.easeOfUse !== null ? p.easeOfUse : '—',
        isCompleted && p.motivation !== null ? p.motivation : '—',
        isCompleted && p.useAgain !== null ? p.useAgain : '—',
        isCompleted && p.delta_cg !== null ? (p.delta_cg > 0 ? `+${p.delta_cg}` : p.delta_cg) : '—',
        isCompleted && p.delta_cp !== null ? (p.delta_cp > 0 ? `+${p.delta_cp}` : p.delta_cp) : '—',
        isCompleted && p.delta_cd !== null ? (p.delta_cd > 0 ? `+${p.delta_cd}` : p.delta_cd) : '—',
      ];
      csvContent += line.join(',') + '\n';
    });

    // Create file and download
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Filename generation
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const filename = `alice_piloto_resultados_${yyyy}${mm}${dd}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusBadgeClass = (status: string) => {
    const s = String(status).trim().toLowerCase();
    switch (s) {
      case 'completed':
      case 'concluido':
      case 'concluído':
        return 'bg-green-500/15 text-green-400 border border-green-500/20';
      case 'pos_pending':
      case 'pós pendente':
      case 'pos pendente':
        return 'bg-purple-500/15 text-purple-400 border border-purple-500/20';
      case 'active':
      case 'ativo':
        return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20';
      case 'pre_pending':
      case 'pré pendente':
      case 'pre pendente':
        return 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/20';
      default: // onboarding
        return 'bg-blue-500/15 text-blue-400 border border-blue-500/20';
    }
  };

  const translateStatus = (status: string) => {
    const s = String(status).trim().toLowerCase();
    switch (s) {
      case 'completed':
      case 'concluido':
      case 'concluído':
        return 'Concluído';
      case 'pos_pending':
      case 'pós pendente':
      case 'pos pendente':
        return 'Pós Pendente';
      case 'active':
      case 'ativo':
        return 'Ativo';
      case 'pre_pending':
      case 'pré pendente':
      case 'pre pendente':
        return 'Pré Pendente';
      default:
        return 'Onboarding';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-left">
      {errorHeader && (
        <div className="p-4 bg-red-900/20 border border-red-500/30 text-red-300 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{errorHeader}</p>
        </div>
      )}

      {/* Highlights Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 border border-slate-700/60 p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Piloto</h4>
            <div className="text-2xl font-black text-white mt-0.5">{summaryStats.totalUsers}</div>
            <p className="text-[10px] text-slate-500 mt-0.5">usuários registrados</p>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700/60 p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-400">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">PRÉ Respondido</h4>
            <div className="text-2xl font-black text-white mt-0.5">{summaryStats.preAnswered}</div>
            <p className="text-[10px] text-slate-500 mt-0.5">{((summaryStats.preAnswered / (summaryStats.totalUsers || 1)) * 100).toFixed(0)}% de adesão prévia</p>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700/60 p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">PÓS Respondido</h4>
            <div className="text-2xl font-black text-white mt-0.5">{summaryStats.postAnswered}</div>
            <p className="text-[10px] text-slate-500 mt-0.5">concluíram todos os ciclos</p>
          </div>
        </div>

        {/* Featured Adaptation Card */}
        <div className="bg-gradient-to-br from-indigo-900/60 to-purple-900/65 border border-purple-500/30 p-5 rounded-2xl flex items-center gap-4 shadow-lg relative overflow-hidden">
          <div className="absolute -right-2 -bottom-2 opacity-5">
            <TrendingUp className="w-24 h-24 text-white" />
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 relative z-10 animate-bounce">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="relative z-10">
            <h4 className="text-purple-300 text-xs font-bold uppercase tracking-wider">Percepção Adaptação</h4>
            <div className="text-2xl font-extrabold text-white mt-0.5">
              {summaryStats.averages.pos_adaptation !== '—' ? `${summaryStats.averages.pos_adaptation} / 5.0` : '—'}
            </div>
            <p className="text-[10px] text-purple-200 mt-0.5">Adaptabilidade média no piloto</p>
          </div>
        </div>
      </div>

      {/* Main Results Table Card */}
      <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl flex flex-col">
        <div className="p-5 border-b border-slate-700/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Relatório Consolidado do Piloto</h3>
            <p className="text-slate-400 text-xs mt-0.5">Resultados em tempo real de questionários de onboarding e avaliações de impacto.</p>
          </div>
          
          <button 
            onClick={handleExportCSV}
            disabled={mergedParticipants.length === 0}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            <Download className="w-4 h-4" />
            Exportar CSV Resultados
          </button>
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 text-sm">Carregando painel de resultados do piloto...</p>
          </div>
        ) : mergedParticipants.length === 0 ? (
          <div className="p-20 text-center text-slate-500 py-16 space-y-3">
            <HelpCircle className="w-12 h-12 text-slate-600 mx-auto" />
            <p className="text-slate-400 text-sm font-semibold">Nenhum dado encontrado</p>
            <p className="text-xs text-slate-600 max-w-sm mx-auto">Assim que os servidores se identificarem com e-mail e responderem à pesquisa inicial, os resultados aparecerão neste painel.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-max">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/60 border-b border-slate-700/80">
                    <th className="p-3.5 font-semibold text-slate-300 sticky left-0 bg-slate-900 border-r border-slate-800">E-mail</th>
                    <th className="p-3.5 font-semibold text-slate-300">Status</th>
                    <th className="p-3.5 font-semibold text-slate-300 text-center">Ciclos</th>
                    <th className="p-3.5 font-semibold text-slate-400 bg-slate-900/30 text-center border-l border-slate-800">Trabalho (Pré)</th>
                    <th className="p-3.5 font-semibold text-slate-400 bg-slate-900/30 text-center">Treinado? (Pré)</th>
                    <th className="p-3.5 font-semibold text-slate-400 bg-slate-900/30 text-center">CG (Pré)</th>
                    <th className="p-3.5 font-semibold text-slate-400 bg-slate-900/30 text-center">CP (Pré)</th>
                    <th className="p-3.5 font-semibold text-slate-400 bg-slate-900/30 text-center">CD (Pré)</th>
                    <th className="p-3.5 font-semibold text-slate-400 bg-slate-900/30 text-center border-r border-slate-800">Interesse (Pré)</th>
                    
                    <th className="p-3.5 font-semibold text-blue-300 bg-blue-950/10 text-center">Dias (Pós)</th>
                    <th className="p-3.5 font-semibold text-blue-300 bg-blue-950/10 text-center">CG (Pós)</th>
                    <th className="p-3.5 font-semibold text-blue-300 bg-blue-950/10 text-center">CP (Pós)</th>
                    <th className="p-3.5 font-semibold text-blue-300 bg-blue-950/10 text-center">CD (Pós)</th>
                    <th className="p-3.5 font-semibold text-blue-300 bg-blue-950/10 text-center">Adaptação (Pós)</th>
                    <th className="p-3.5 font-semibold text-blue-300 bg-blue-950/10 text-center">Ajudou (Pós)</th>
                    <th className="p-3.5 font-semibold text-blue-300 bg-blue-950/10 text-center">Fácil (Pós)</th>
                    <th className="p-3.5 font-semibold text-blue-300 bg-blue-950/10 text-center">Motivou (Pós)</th>
                    <th className="p-3.5 font-semibold text-blue-300 bg-blue-950/10 text-center border-r border-slate-800">Reusaria (Pós)</th>
                    
                    <th className="p-3.5 font-semibold text-indigo-300 bg-indigo-950/10 text-center">Δ-CG</th>
                    <th className="p-3.5 font-semibold text-indigo-300 bg-indigo-950/10 text-center">Δ-CP</th>
                    <th className="p-3.5 font-semibold text-indigo-300 bg-indigo-950/10 text-center">Δ-CD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {/* Summary Mean Row - FIRST */}
                  <tr className="bg-slate-900/90 font-bold border-b border-slate-700">
                    <td className="p-3.5 text-slate-200 sticky left-0 bg-slate-900 border-r border-slate-800">MÉDIA DOS RESPONDENTES</td>
                    <td className="p-3.5 text-slate-400">—</td>
                    <td className="p-3.5 text-slate-400 text-center">—</td>
                    <td className="p-3.5 text-slate-400 bg-slate-900/30 text-center border-l border-slate-800">—</td>
                    <td className="p-3.5 text-slate-400 bg-slate-900/30 text-center">—</td>
                    <td className="p-3.5 text-white bg-slate-900/30 text-center font-mono">{summaryStats.averages.pre_cg}</td>
                    <td className="p-3.5 text-white bg-slate-900/30 text-center font-mono">{summaryStats.averages.pre_cp}</td>
                    <td className="p-3.5 text-white bg-slate-900/30 text-center font-mono">{summaryStats.averages.pre_cd}</td>
                    <td className="p-3.5 text-white bg-slate-900/30 text-center font-mono border-r border-slate-800">{summaryStats.averages.pre_interest}</td>
                    
                    <td className="p-3.5 text-blue-300 bg-blue-950/15 text-center font-mono">{summaryStats.averages.pos_days}</td>
                    <td className="p-3.5 text-blue-300 bg-blue-950/15 text-center font-mono">{summaryStats.averages.pos_cg}</td>
                    <td className="p-3.5 text-blue-300 bg-blue-950/15 text-center font-mono">{summaryStats.averages.pos_cp}</td>
                    <td className="p-3.5 text-blue-300 bg-blue-950/15 text-center font-mono">{summaryStats.averages.pos_cd}</td>
                    <td className="p-3.5 text-purple-300 bg-purple-950/20 text-center font-black">{summaryStats.averages.pos_adaptation}</td>
                    <td className="p-3.5 text-blue-300 bg-blue-950/15 text-center font-mono">{summaryStats.averages.pos_help}</td>
                    <td className="p-3.5 text-blue-300 bg-blue-950/15 text-center font-mono">{summaryStats.averages.pos_ease}</td>
                    <td className="p-3.5 text-blue-300 bg-blue-950/15 text-center font-mono">{summaryStats.averages.pos_motivation}</td>
                    <td className="p-3.5 text-blue-300 bg-blue-950/15 text-center font-mono border-r border-slate-800">{summaryStats.averages.pos_again}</td>
                    
                    <td className="p-3.5 text-slate-400 bg-indigo-950/10 text-center font-mono">—</td>
                    <td className="p-3.5 text-slate-400 bg-indigo-950/10 text-center font-mono">—</td>
                    <td className="p-3.5 text-slate-400 bg-indigo-950/10 text-center font-mono">—</td>
                  </tr>

                  {/* Individual participant rows */}
                  {mergedParticipants.map((p) => {
                    const statusStr = String(p.status).trim().toLowerCase();
                    const isCompleted = statusStr === 'completed' || statusStr === 'concluido' || statusStr === 'concluído';

                    const renderDelta = (delta: number | null) => {
                      if (!isCompleted || delta === null) return <span className="text-slate-500">—</span>;
                      if (delta > 0) {
                        return <span className="text-green-400 font-bold">+{delta}</span>;
                      } else if (delta < 0) {
                        return <span className="text-red-400 font-bold">{delta}</span>;
                      }
                      return <span className="text-slate-400">0</span>;
                    };

                    return (
                      <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="p-3 text-white font-medium sticky left-0 bg-slate-850 border-r border-slate-800/80 max-w-xs truncate" title={p.email}>
                          {p.email}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadgeClass(p.status)}`}>
                            {translateStatus(p.status)}
                          </span>
                        </td>
                        <td className="p-3 text-center font-semibold text-slate-200">
                          {p.cycleCount}
                        </td>
                        
                        {/* PRE cols */}
                        <td className="p-3 text-center text-slate-300 bg-slate-900/10 border-l border-slate-800/60">{p.experienceTime}</td>
                        <td className="p-3 text-center text-slate-300 bg-slate-900/10">{p.formalCapacitation}</td>
                        <td className="p-3 text-center font-semibold text-slate-200 bg-slate-900/10">{p.pre_cg !== null ? p.pre_cg : '—'}</td>
                        <td className="p-3 text-center font-semibold text-slate-200 bg-slate-900/10">{p.pre_cp !== null ? p.pre_cp : '—'}</td>
                        <td className="p-3 text-center font-semibold text-slate-200 bg-slate-900/10">{p.pre_cd !== null ? p.pre_cd : '—'}</td>
                        <td className="p-3 text-center font-semibold text-slate-200 bg-slate-900/10 border-r border-slate-800/60">{p.interestCustomTool !== null ? p.interestCustomTool : '—'}</td>
                        
                        {/* POS cols */}
                        <td className="p-3 text-center text-slate-300 bg-blue-950/5">{isCompleted && p.daysUsed !== null ? p.daysUsed : '—'}</td>
                        <td className="p-3 text-center font-semibold text-slate-200 bg-blue-950/5">{isCompleted && p.pos_cg !== null ? p.pos_cg : '—'}</td>
                        <td className="p-3 text-center font-semibold text-slate-200 bg-blue-950/5">{isCompleted && p.pos_cp !== null ? p.pos_cp : '—'}</td>
                        <td className="p-3 text-center font-semibold text-slate-200 bg-blue-950/5">{isCompleted && p.pos_cd !== null ? p.pos_cd : '—'}</td>
                        <td className="p-3 text-center font-bold text-indigo-300 bg-purple-950/5">{isCompleted && p.perceivedAdaptation !== null ? p.perceivedAdaptation : '—'}</td>
                        <td className="p-3 text-center font-semibold text-slate-200 bg-blue-950/5">{isCompleted && p.microLearningHelp !== null ? p.microLearningHelp : '—'}</td>
                        <td className="p-3 text-center font-semibold text-slate-200 bg-blue-950/5">{isCompleted && p.easeOfUse !== null ? p.easeOfUse : '—'}</td>
                        <td className="p-3 text-center font-semibold text-slate-200 bg-blue-950/5">{isCompleted && p.motivation !== null ? p.motivation : '—'}</td>
                        <td className="p-3 text-center font-semibold text-slate-200 bg-blue-950/5 border-r border-slate-800/60">{isCompleted && p.useAgain !== null ? p.useAgain : '—'}</td>
                        
                        {/* DELTA cols */}
                        <td className="p-3 text-center bg-indigo-950/5 font-mono">{renderDelta(p.delta_cg)}</td>
                        <td className="p-3 text-center bg-indigo-950/5 font-mono">{renderDelta(p.delta_cp)}</td>
                        <td className="p-3 text-center bg-indigo-950/5 font-mono">{renderDelta(p.delta_cd)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Methodology note */}
      <div className="bg-slate-800/40 border border-slate-700/40 p-4 rounded-xl flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <h4 className="text-indigo-300 text-xs font-bold uppercase tracking-wide">Notas de Legenda & Escala</h4>
          <p className="text-slate-400 text-xs leading-relaxed">
            As notas de impacto (CG: Conhecimento Geral, CP: Conhecimento Fase Prep, CD: Confiança Dúvidas) e os indicadores pós usam escala Likert de <strong>1 a 5</strong>. O Delta (&Delta;) representa a diferença em pontos absoluto pós-trilha menos pré-trilha para os utilizadores que completaram o desafio de microaprendizagem.
          </p>
        </div>
      </div>
    </div>
  );
};
