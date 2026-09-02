
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ArrowLeftIcon, DownloadIcon, FunnelIcon, XMarkIcon, CheckCircleIcon, BrainIcon, AdminIcon, UserIcon, ImageIcon } from './Icons';
import { toPng } from 'html-to-image';
import LawsManager from './LawsManager';
import SoftSkillsManager from './SoftSkillsManager';
import { auth, googleProvider, signInWithPopup } from '../firebase';
import { PilotResultsPanel } from './PilotResultsPanel';
import {
  fetchManagerOverview,
  ManagerApiError,
  type ManagerMember,
  type ManagerSurvey,
} from '../services/managerApi';

// Carregados sob demanda: quem só olha a visão geral não baixa as duas telas.
const GroupsPanel = React.lazy(() => import('./manager/GroupsPanel'));
const ContentPanel = React.lazy(() => import('./manager/ContentPanel'));

interface DashboardProps {
  onBack: () => void;
}

type DashboardView = 'MAIN' | 'LAWS_MANAGER' | 'SOFT_SKILLS_MANAGER';

// --- MOCK DATA ---

const RANKING_CATEGORIES = ['Geral', 'Lei de Licitações', 'Lei de Resp. Fiscal', 'Soft Skills', 'Plano Diretor'];
const DEPARTMENTS = ['Administrativo', 'Financeiro', 'Jurídico', 'Obras e Urbanismo', 'Saúde', 'Educação'];

interface UserPerformance {
    name: string;
    area: string;
    points: number;
    specialties: Record<string, number>;
    preferredDays: string;
    preferredTime: string;
    bestTopic: string;
    bestTopicScore: number;
    worstTopic: string;
    worstTopicScore: number;
    softSkillsLevel: string;
}

// Dados expandidos para relatórios
const SERVER_DATA: UserPerformance[] = [
    { 
        name: 'Ana Silva', area: 'Jurídico', points: 1250, 
        specialties: { 'Lei de Licitações': 800, 'Lei de Resp. Fiscal': 200, 'Soft Skills': 250, 'Plano Diretor': 0 },
        preferredDays: 'Terça e Quinta', preferredTime: '08:00 - 09:00',
        bestTopic: 'Lei de Licitações', bestTopicScore: 92,
        worstTopic: 'Plano Diretor', worstTopicScore: 0,
        softSkillsLevel: 'Avançado'
    },
    { 
        name: 'Bruno Costa', area: 'Financeiro', points: 1100, 
        specialties: { 'Lei de Licitações': 300, 'Lei de Resp. Fiscal': 600, 'Soft Skills': 200, 'Plano Diretor': 0 },
        preferredDays: 'Segunda e Quarta', preferredTime: '14:00 - 15:00',
        bestTopic: 'Lei de Resp. Fiscal', bestTopicScore: 88,
        worstTopic: 'Lei de Licitações', worstTopicScore: 45,
        softSkillsLevel: 'Intermediário'
    },
    { 
        name: 'Carlos Dias', area: 'Administrativo', points: 980, 
        specialties: { 'Lei de Licitações': 150, 'Lei de Resp. Fiscal': 100, 'Soft Skills': 730, 'Plano Diretor': 0 },
        preferredDays: 'Sexta-feira', preferredTime: '16:00 - 17:00',
        bestTopic: 'Soft Skills', bestTopicScore: 95,
        worstTopic: 'Lei de Resp. Fiscal', worstTopicScore: 30,
        softSkillsLevel: 'Especialista'
    },
    { 
        name: 'Daniela Souza', area: 'Obras e Urbanismo', points: 850, 
        specialties: { 'Lei de Licitações': 400, 'Lei de Resp. Fiscal': 0, 'Soft Skills': 150, 'Plano Diretor': 300 },
        preferredDays: 'Quarta e Sexta', preferredTime: '10:00 - 11:00',
        bestTopic: 'Lei de Licitações', bestTopicScore: 78,
        worstTopic: 'Lei de Resp. Fiscal', worstTopicScore: 10,
        softSkillsLevel: 'Básico'
    },
    { 
        name: 'Eduardo Lima', area: 'Saúde', points: 700, 
        specialties: { 'Lei de Licitações': 200, 'Lei de Resp. Fiscal': 300, 'Soft Skills': 100, 'Plano Diretor': 100 },
        preferredDays: 'Terça-feira', preferredTime: '19:00 - 20:00',
        bestTopic: 'Lei de Resp. Fiscal', bestTopicScore: 65,
        worstTopic: 'Plano Diretor', worstTopicScore: 40,
        softSkillsLevel: 'Básico'
    },
];

const KPI_DATA = [
    { title: "Absorção Geral", value: "82%", change: "+5.2%", changeType: "increase" as const },
    { title: "Precisão nos Quizzes", value: "89%", change: "+3.1%", changeType: "increase" as const },
    { title: "Ritmo de Estudo", value: "4.5/sem", change: "-0.5", changeType: "decrease" as const }
];

// --- COMPONENTS ---

const KPICard: React.FC<{ title: string; value: string; change?: string; changeType?: 'increase' | 'decrease', dark?: boolean }> = ({ title, value, change, changeType, dark = true }) => (
  <div className={`${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-800'} border p-4 sm:p-6 rounded-xl`}>
    <h3 className={`${dark ? 'text-slate-400' : 'text-gray-500'} text-sm font-medium mb-2`}>{title}</h3>
    <p className="text-3xl font-bold mb-2">{value}</p>
    {change && (
        <div className="flex items-center">
            <span className={`text-sm font-semibold ${changeType === 'increase' ? 'text-green-500' : 'text-red-500'}`}>{change}</span>
            <span className={`${dark ? 'text-slate-500' : 'text-gray-400'} text-sm ml-2`}>vs. mês passado</span>
        </div>
    )}
  </div>
);

const AdminButton: React.FC<{ children: React.ReactNode; onClick?: () => void }> = ({ children, onClick }) => (
    <button 
        onClick={onClick}
        className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-left shadow-md"
    >
        {children}
    </button>
);

const AssessmentContent = ({ dark = true }) => (
    <div className={`space-y-6 ${dark ? 'text-slate-300' : 'text-gray-700'}`}>
        {/* Seção Bloom */}
        <section>
            <h3 className={`text-lg font-bold mb-3 ${dark ? 'text-white' : 'text-gray-900'}`}>1. Avaliação Cognitiva (Taxonomia de Bloom)</h3>
            <p className="mb-4 text-sm leading-relaxed">
                A plataforma ALICE não apenas conta acertos, mas avalia a <strong>profundidade do aprendizado</strong>. A pontuação é ponderada conforme o nível cognitivo exigido na interação:
            </p>
            <div className={`space-y-3 p-4 rounded-xl border ${dark ? 'bg-slate-900/50 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-3">
                    <span className="bg-green-700 text-white px-2 py-1 rounded text-xs font-bold w-24 text-center">Nível 1-2</span>
                    <div>
                        <strong className={`block ${dark ? 'text-white' : 'text-gray-900'}`}>Lembrar & Compreender</strong>
                        <span className="text-xs">Quizzes de fixação, definições e conceitos básicos. Pontuação base.</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="bg-yellow-700 text-white px-2 py-1 rounded text-xs font-bold w-24 text-center">Nível 3-4</span>
                    <div>
                        <strong className={`block ${dark ? 'text-white' : 'text-gray-900'}`}>Aplicar & Analisar</strong>
                        <span className="text-xs">Estudos de caso simples e identificação de erros. Pontuação média.</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="bg-purple-800 text-white px-2 py-1 rounded text-xs font-bold w-24 text-center">Nível 5-6</span>
                    <div>
                        <strong className={`block ${dark ? 'text-white' : 'text-gray-900'}`}>Avaliar & Criar</strong>
                        <span className="text-xs">Resolução de problemas complexos, dilemas éticos. Pontuação máxima.</span>
                    </div>
                </div>
            </div>
        </section>

        {/* Seção Níveis de Proficiência */}
        <section>
            <h3 className={`text-lg font-bold mb-3 ${dark ? 'text-white' : 'text-gray-900'}`}>2. Níveis de Proficiência</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`p-4 rounded-lg border ${dark ? 'bg-slate-700/50 border-slate-600' : 'bg-white border-gray-200 shadow-sm'}`}>
                    <div className="text-blue-500 font-bold mb-1">Iniciante</div>
                    <div className={`text-xs mb-2 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Meta: 500 pts</div>
                    <p className="text-xs">Foco em fundamentos e vocabulário.</p>
                </div>
                <div className={`p-4 rounded-lg border ${dark ? 'bg-slate-700/50 border-slate-600' : 'bg-white border-gray-200 shadow-sm'}`}>
                    <div className="text-yellow-500 font-bold mb-1">Intermediário</div>
                    <div className={`text-xs mb-2 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Meta: 1500 pts</div>
                    <p className="text-xs">Foco em processos e aplicação rotineira.</p>
                </div>
                <div className={`p-4 rounded-lg border ${dark ? 'bg-slate-700/50 border-slate-600' : 'bg-white border-gray-200 shadow-sm'}`}>
                    <div className="text-purple-500 font-bold mb-1">Especialista</div>
                    <div className={`text-xs mb-2 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Meta: 3000 pts</div>
                    <p className="text-xs">Foco em exceções e estratégia.</p>
                </div>
            </div>
        </section>

        {/* Seção Soft Skills */}
        <section>
            <h3 className={`text-lg font-bold mb-3 ${dark ? 'text-white' : 'text-gray-900'}`}>3. Avaliação Comportamental</h3>
            <p className="text-sm leading-relaxed">
                As trilhas de Soft Skills avaliam a tendência do servidor entre respostas <strong>Reativas</strong> vs. <strong>Proativas/Empáticas</strong>, incentivando a mudança cultural.
            </p>
        </section>
    </div>
);

const AssessmentModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" onClick={onClose}>
        <div 
            className="bg-slate-800 border border-slate-600 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative flex flex-col"
            onClick={e => e.stopPropagation()}
        >
            <div className="p-6 border-b border-slate-700 flex justify-between items-center sticky top-0 bg-slate-800 z-10">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <BrainIcon className="w-6 h-6 text-blue-400" />
                    Sobre os Critérios de Avaliação
                </h2>
                <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400">
                    <XMarkIcon className="w-6 h-6" />
                </button>
            </div>
            
            <div className="p-6">
                <AssessmentContent dark={true} />
            </div>

            <div className="p-4 border-t border-slate-700 bg-slate-800 sticky bottom-0 flex justify-end">
                <button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors">
                    Entendi
                </button>
            </div>
        </div>
    </div>
);

// --- REPORT GENERATION COMPONENTS ---

const ReportConfigModal: React.FC<{ onClose: () => void, onGenerate: (config: any) => void, users: UserPerformance[] }> = ({ onClose, onGenerate, users }) => {
    const [selectedUser, setSelectedUser] = useState(users[0]?.name || '');

    useEffect(() => {
        if (users.length > 0 && !selectedUser) {
            setSelectedUser(users[0].name);
        }
    }, [users]);

    const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));

    const handleSubmit = () => {
        if (!selectedUser) return;
        onGenerate({
            type: 'Servidor',
            value: selectedUser
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-slate-800 border border-slate-600 rounded-xl w-full max-w-md p-6 relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white"><XMarkIcon className="w-6 h-6" /></button>
                <h2 className="text-xl font-bold text-white mb-6">Solicitar Relatório</h2>
                
                <div className="space-y-4 mb-8">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Selecione o Servidor</label>
                        <select 
                            value={selectedUser} 
                            onChange={(e) => setSelectedUser(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {sortedUsers.map(user => <option key={user.name} value={user.name}>{user.name} - {user.area}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="text-slate-300 hover:text-white px-4 py-2">Cancelar</button>
                    <button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-lg">
                        Solicitar
                    </button>
                </div>
            </div>
        </div>
    );
};

const ReportPreview: React.FC<{ config: any, onClose: () => void, users: UserPerformance[] }> = ({ config, onClose, users }) => {
    const reportRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);
    
    // Generate Report Data based on Config
    const reportDate = new Date().toLocaleDateString('pt-BR');
    
    // Logic to aggregate or select data
    const data = useMemo(() => {
        return users.find(u => u.name === config.value) || users[0];
    }, [config, users]);

    if (!data) return null;

    const handlePrint = () => {
        window.print();
    };

    const handleExportPng = async () => {
        if (!reportRef.current) return;
        setIsExporting(true);
        try {
            const dataUrl = await toPng(reportRef.current, {
                cacheBust: true,
                backgroundColor: '#ffffff',
                style: {
                    margin: '0',
                    padding: '40px',
                }
            });
            const link = document.createElement('a');
            link.download = `relatorio_alice_${data.name.toLowerCase().replace(/\s+/g, '_')}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Erro ao exportar imagem:', err);
            alert('Erro ao gerar imagem. Tente usar a função de imprimir.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900 z-[60] overflow-y-auto">
            {/* Toolbar - Hidden when printing */}
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center print:hidden shadow-lg">
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                    Desempenho do Servidor
                    <span className="text-xs font-normal bg-slate-700 px-2 py-1 rounded text-slate-300">{data.name}</span>
                </h2>
                <div className="flex gap-3">
                    <button onClick={onClose} className="text-slate-300 hover:text-white px-4 py-2 font-medium">Fechar</button>
                    <button onClick={handlePrint} className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2">
                        <DownloadIcon className="w-5 h-5" /> PDF
                    </button>
                    <button 
                        onClick={handleExportPng} 
                        disabled={isExporting}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
                    >
                        {isExporting ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <ImageIcon className="w-5 h-5" />
                        )}
                        Salvar Imagem (PNG)
                    </button>
                </div>
            </div>

            {/* A4 Page Container */}
            <div ref={reportRef} className="max-w-[210mm] mx-auto bg-white min-h-[297mm] my-8 p-[15mm] shadow-2xl print:shadow-none print:m-0 print:w-full text-slate-900">
                
                {/* BLOCO 1: Identificação */}
                <header className="border-b-2 border-slate-800 pb-6 mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">ALICE</h1>
                        <p className="text-slate-600 text-sm font-medium uppercase tracking-widest">Relatório de Desempenho</p>
                    </div>
                    <div className="text-right">
                        <div className="text-slate-500 text-sm">Data de Emissão</div>
                        <div className="font-bold text-lg">{reportDate}</div>
                        <div className="mt-2 text-slate-500 text-sm">Servidor</div>
                        <div className="font-bold text-blue-700">{data.name}</div>
                        <div className="text-sm text-slate-600">{data.area}</div>
                    </div>
                </header>

                {/* BLOCO 2: Indicadores */}
                <section className="mb-10">
                    <h2 className="text-lg font-bold border-l-4 border-blue-600 pl-3 mb-6 uppercase">Painel de Indicadores</h2>
                    
                    {/* Linha 1: KPIs Gerais */}
                    <div className="grid grid-cols-3 gap-6 mb-6">
                        <KPICard title="Absorção Geral" value="85%" dark={false} />
                        <KPICard title="Precisão Quizzes" value="91%" dark={false} />
                        <KPICard title="Pontuação Total" value={data.points.toString()} dark={false} />
                    </div>

                    {/* Linha 2: Hábitos e Soft Skills */}
                    <div className="grid grid-cols-2 gap-6 mb-6">
                        <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl">
                            <h3 className="text-gray-500 text-sm font-bold uppercase mb-4">Padrões de Estudo</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-gray-600">Dias Preferidos</span>
                                    <span className="font-bold text-slate-900">{data.preferredDays}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-gray-600">Horário de Pico</span>
                                    <span className="font-bold text-slate-900">{data.preferredTime}</span>
                                </div>
                                <div className="flex justify-between pt-1">
                                    <span className="text-gray-600">Nível Soft Skills</span>
                                    <span className="font-bold text-blue-700">{data.softSkillsLevel}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl">
                            <h3 className="text-gray-500 text-sm font-bold uppercase mb-4">Desempenho por Tema</h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-green-700 font-bold flex items-center gap-1"><CheckCircleIcon className="w-4 h-4"/> Maior Acerto</span>
                                        <span className="font-bold">{data.bestTopicScore}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div className="bg-green-600 h-2 rounded-full" style={{width: `${data.bestTopicScore}%`}}></div>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">{data.bestTopic}</div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-red-600 font-bold flex items-center gap-1">⚠️ Menor Acerto</span>
                                        <span className="font-bold">{data.worstTopicScore}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div className="bg-red-500 h-2 rounded-full" style={{width: `${data.worstTopicScore}%`}}></div>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">{data.worstTopic}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* BLOCO 3: Critérios (Texto Padrão) */}
                <section className="mb-10 page-break-inside-avoid">
                    <h2 className="text-lg font-bold border-l-4 border-slate-600 pl-3 mb-6 uppercase">Metodologia de Avaliação</h2>
                    <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 text-sm">
                        <AssessmentContent dark={false} />
                    </div>
                </section>

                {/* BLOCO 4: Objetivo da Plataforma */}
                <footer className="mt-12 pt-8 border-t-2 border-slate-200 text-center page-break-inside-avoid">
                    <h3 className="text-blue-700 font-bold uppercase tracking-widest mb-3">Sobre a Plataforma ALICE</h3>
                    <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed">
                        Uma assistente virtual de microaprendizagem para capacitar servidores públicos municipais com base em leis e soft skills, utilizando uma interface conversacional interativa e gamificada para promover a eficiência e a modernização da gestão pública.
                    </p>
                </footer>

            </div>
            
            {/* Style for printing only content */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .fixed.inset-0.bg-slate-900 {
                        position: absolute;
                        left: 0;
                        top: 0;
                        background: white;
                        overflow: visible;
                    }
                    .max-w-\\[210mm\\] {
                        visibility: visible;
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: 20px;
                        box-shadow: none;
                    }
                    .max-w-\\[210mm\\] * {
                        visibility: visible;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
};


const Dashboard: React.FC<DashboardProps> = ({ onBack }) => {
  const [currentView, setCurrentView] = useState<DashboardView>('MAIN');
  const [rankingFilter, setRankingFilter] = useState('Geral');
  const [serverData, setServerData] = useState<UserPerformance[]>([]);
  const [surveyData, setSurveyData] = useState<ManagerSurvey[]>([]);
  const [groupPerformance, setGroupPerformance] = useState<
    { id: string; name: string; members: number; active30d: number; averagePoints: number; totalQuizzes: number }[]
  >([]);
  const [ungroupedCount, setUngroupedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [accessError, setAccessError] = useState<{ message: string; status: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PILOT' | 'TURMAS' | 'CONTEUDO'>('OVERVIEW');
  
  // Modals state
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [showReportConfig, setShowReportConfig] = useState(false);
  const [currentReportConfig, setCurrentReportConfig] = useState<any>(null);

  // Carrega o painel sob demanda. Sem listener em tempo real: o gestor
  // consulta pontualmente, e um listener aberto consome leituras enquanto a
  // aba fica esquecida.
  const loadDashboard = React.useCallback(async () => {
    setIsLoading(true);
    setAccessError(null);
    try {
      const overview = await fetchManagerOverview();
      setServerData(overview.members as unknown as UserPerformance[]);
      setSurveyData(overview.surveys);
      setGroupPerformance(overview.groups ?? []);
      setUngroupedCount(overview.ungroupedMembers ?? 0);
    } catch (err) {
      if (err instanceof ManagerApiError) {
        setAccessError({ message: err.message, status: err.status });
      } else {
        setAccessError({
          message: err instanceof Error ? err.message : 'Falha ao carregar o painel.',
          status: 500,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleManagerLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      loadDashboard();
    } catch (err) {
      setAccessError({ message: 'Falha no login com Google.', status: 401 });
    }
  };

  // Lógica para ordenar e filtrar o ranking
  const filteredRanking = useMemo(() => {
    return [...serverData].sort((a, b) => {
        if (rankingFilter === 'Geral') {
            return b.points - a.points;
        }
        const scoreA = (a.specialties as any)[rankingFilter] || 0;
        const scoreB = (b.specialties as any)[rankingFilter] || 0;
        return scoreB - scoreA;
    });
  }, [rankingFilter, serverData]);

  const handleExportCSV = () => {
    // Cabeçalho do Relatório
    const reportDate = new Date().toLocaleDateString('pt-BR');
    let csvContent = `RELATORIO DE GESTAO - ALICE\nData de Extracao: ${reportDate}\n\n`;
    csvContent += `Filtro Aplicado: ${rankingFilter}\n\n`;

    // Seção de KPIs
    csvContent += "INDICADORES CHAVE (KPIs)\n";
    csvContent += "Indicador,Valor,Variacao\n";
    KPI_DATA.forEach(kpi => {
        csvContent += `${kpi.title},${kpi.value},${kpi.change}\n`;
    });
    csvContent += "\n";

    // Seção de Ranking
    csvContent += `RANKING DE SERVIDORES - ${rankingFilter.toUpperCase()}\n`;
    csvContent += "Posicao,Nome,Area,Pontos,Melhor Tema,Nivel Soft Skills,Ultimo Acesso\n";
    filteredRanking.forEach((user, index) => {
        const score = rankingFilter === 'Geral' ? user.points : (user.specialties as any)[rankingFilter] || 0;
        csvContent += `${index + 1},${user.name},${user.area},${score},${user.bestTopic},${user.softSkillsLevel},${(user as any).lastAccess || 'N/A'}\n`;
    });

    // Criar Blob e Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_alice_${rankingFilter.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateReport = (config: any) => {
      setShowReportConfig(false);
      setCurrentReportConfig(config);
  };

  if (currentView === 'LAWS_MANAGER') {
    return <LawsManager onBack={() => setCurrentView('MAIN')} />;
  }

  if (currentView === 'SOFT_SKILLS_MANAGER') {
    return <SoftSkillsManager onBack={() => setCurrentView('MAIN')} />;
  }

  const kpiData = useMemo(() => [
    { title: "Usuários Ativos", value: serverData.length.toString(), change: "+1", changeType: "increase" as const },
    { title: "Absorção Geral", value: "82%", change: "+5.2%", changeType: "increase" as const },
    { title: "Precisão nos Quizzes", value: "89%", change: "+3.1%", changeType: "increase" as const },
  ], [serverData.length]);

  // O painel expõe o desempenho de todos os servidores, então exige
  // identidade verificada — o e-mail sem senha do piloto não basta aqui.
  if (accessError) {
    const needsLogin = accessError.status === 401;
    return (
      <div className="bg-slate-900 w-full h-full p-6 rounded-2xl border border-slate-800 flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
            needsLogin ? 'bg-blue-500/15 text-blue-400' : 'bg-red-500/15 text-red-400'
          }`}>
            <AdminIcon className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">
            {needsLogin ? 'Painel do Gestor' : 'Acesso restrito'}
          </h1>
          <p className="text-slate-400 mb-8">{accessError.message}</p>
          {needsLogin ? (
            <button
              onClick={handleManagerLogin}
              className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors"
            >
              Entrar com Google
            </button>
          ) : (
            <button
              onClick={loadDashboard}
              className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold transition-colors"
            >
              Tentar novamente
            </button>
          )}
          <button onClick={onBack} className="mt-4 text-slate-500 hover:text-white text-sm">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 w-full h-full p-4 sm:p-6 rounded-2xl border border-slate-800 overflow-y-auto flex flex-col relative" id="manager-dashboard-container">
      {/* Modals */}
      {showAssessmentModal && <AssessmentModal onClose={() => setShowAssessmentModal(false)} />}
      {showReportConfig && <ReportConfigModal users={serverData} onClose={() => setShowReportConfig(false)} onGenerate={handleGenerateReport} />}
      {currentReportConfig && <ReportPreview users={serverData} config={currentReportConfig} onClose={() => setCurrentReportConfig(null)} />}
      
      <div className="flex items-center mb-6 flex-shrink-0">
        <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-slate-800 transition-colors">
          <ArrowLeftIcon className="w-6 h-6 text-slate-400" />
        </button>
        <h1 className="text-3xl font-bold text-white">Painel do Gestor</h1>
        {isLoading && <div className="ml-4 w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
        <button
          onClick={loadDashboard}
          disabled={isLoading}
          className="ml-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors disabled:opacity-50"
          title="Os dados são carregados ao abrir o painel"
        >
          Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-6 flex-shrink-0">
        <button 
          onClick={() => setActiveTab('OVERVIEW')}
          className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'OVERVIEW' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
          id="btn-tab-overview"
        >
          Visão Geral
        </button>
        <button 
          onClick={() => setActiveTab('PILOT')}
          className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'PILOT' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
          id="btn-tab-pilot"
        >
          Resultados do Piloto
        </button>
        <button 
          onClick={() => setActiveTab('TURMAS')}
          className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'TURMAS' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
          id="btn-tab-turmas"
        >
          Turmas
        </button>
        <button 
          onClick={() => setActiveTab('CONTEUDO')}
          className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'CONTEUDO' 
              ? 'border-blue-500 text-blue-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
          id="btn-tab-conteudo"
        >
          Conteúdo
        </button>
      </div>

      {(activeTab === 'TURMAS' || activeTab === 'CONTEUDO') && (
        <React.Suspense
          fallback={
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          }
        >
          {activeTab === 'TURMAS' ? <GroupsPanel /> : <ContentPanel />}
        </React.Suspense>
      )}
      
      {activeTab === 'OVERVIEW' ? (
        <>
          <div className="flex-grow">
              {groupPerformance.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-baseline justify-between mb-3">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                      Desempenho por secretaria
                    </h2>
                    {ungroupedCount > 0 && (
                      <span className="text-xs text-amber-400">
                        {ungroupedCount} servidor(es) sem turma
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupPerformance.map((g) => (
                      <div
                        key={g.id}
                        className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5"
                      >
                        <h3 className="text-white font-bold mb-3 truncate">{g.name}</h3>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-xl font-bold text-white tabular-nums">
                              {g.members}
                            </p>
                            <p className="text-xs text-slate-500">servidores</p>
                          </div>
                          <div>
                            <p
                              className={`text-xl font-bold tabular-nums ${
                                g.members > 0 && g.active30d === 0
                                  ? 'text-red-400'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {g.active30d}
                            </p>
                            <p className="text-xs text-slate-500">ativos</p>
                          </div>
                          <div>
                            <p className="text-xl font-bold text-white tabular-nums">
                              {g.totalQuizzes}
                            </p>
                            <p className="text-xs text-slate-500">quizzes</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {kpiData.map((kpi, index) => (
                    <KPICard 
                        key={index}
                        title={kpi.title} 
                        value={kpi.value} 
                        change={kpi.change} 
                        changeType={kpi.changeType} 
                    />
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h2 className="text-xl font-semibold text-white mb-4">Recursos de Administração</h2>
                  <div className="space-y-4">
                    <AdminButton onClick={() => window.open('https://docs.google.com/spreadsheets/d/1IBAo7JvhyysOc769WipnFWC4EJr6ns5jAUApriw-owY/edit?usp=sharing', '_blank')}>
                        Cadastrar/Editar Leis e Normas
                    </AdminButton>
                    <AdminButton onClick={() => window.open('https://docs.google.com/spreadsheets/d/1LYiA-Nfky4c-ec6rEI--LADJH51cTmKpZNopEeWjjtQ/edit?usp=sharing', '_blank')}>
                        Gerenciar Trilhas de Soft Skills
                    </AdminButton>
                    <AdminButton onClick={() => setShowAssessmentModal(true)}>
                        Sobre os Critérios de Avaliação
                    </AdminButton>
                    <AdminButton onClick={() => setShowReportConfig(true)}>
                        Solicitar Relatórios de Desempenho
                    </AdminButton>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-semibold text-white">Ranking de Especialistas</h2>
                  </div>
                  
                  <div className="mb-4 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FunnelIcon className="h-5 w-5 text-slate-400" />
                      </div>
                      <select 
                        value={rankingFilter}
                        onChange={(e) => setRankingFilter(e.target.value)}
                        className="block w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                      >
                          {RANKING_CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                          ))}
                      </select>
                  </div>

                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 transition-all duration-300">
                    <ul className="space-y-3">
                      {filteredRanking.map((user, index) => {
                        const score = rankingFilter === 'Geral' ? user.points : (user.specialties as any)[rankingFilter] || 0;
                        return (
                            <li key={user.name} className="flex items-center justify-between text-slate-300 p-2 rounded hover:bg-slate-700/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className={`
                                    flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                                    ${index === 0 ? 'bg-yellow-500 text-slate-900' : 
                                    index === 1 ? 'bg-slate-400 text-slate-900' :
                                    index === 2 ? 'bg-orange-700 text-slate-200' : 'bg-slate-700 text-slate-400'}
                                `}>
                                    {index + 1}
                                </span>
                                <div className="flex flex-col">
                                    <span className={index === 0 ? "font-bold text-white" : ""}>{user.name}</span>
                                    {index === 0 && rankingFilter !== 'Geral' && (
                                        <span className="text-[10px] text-yellow-400 uppercase tracking-wider font-bold">Especialista em {rankingFilter}</span>
                                    )}
                                </div>
                            </div>
                            <span className="font-mono bg-slate-900 border border-slate-700 text-slate-200 text-sm px-2 py-1 rounded">
                                {score} pts
                            </span>
                            </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-700 flex justify-end flex-shrink-0">
             <button 
                onClick={handleExportCSV}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 py-3 px-6 rounded-lg font-semibold transition-all shadow-md group"
             >
                <DownloadIcon className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                Exportar CSV (Ranking)
             </button>
          </div>
        </>
      ) : activeTab === 'PILOT' ? (
        <div className="flex-grow overflow-y-auto">
          <PilotResultsPanel users={serverData as any} surveys={surveyData} loading={isLoading} />
        </div>
      ) : null}
    </div>
  );
};

export default Dashboard;
