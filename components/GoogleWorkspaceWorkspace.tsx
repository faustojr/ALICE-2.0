import React, { useState, useEffect } from 'react';
import { useAccessibility } from '../App';
import { auth, googleProvider, signInWithPopup, getAccessToken, setAccessToken } from '../firebase';
import { 
  Calendar, CheckSquare, FileSpreadsheet, HardDrive, 
  ArrowLeft, Plus, Check, Loader, ExternalLink, 
  Clock, AlertTriangle, Download, Trash, RefreshCw, Bookmark
} from 'lucide-react';
import { UserState } from '../types';

interface GoogleWorkspaceWorkspaceProps {
  onBack: () => void;
  userState: UserState;
}

export const GoogleWorkspaceWorkspace: React.FC<GoogleWorkspaceWorkspaceProps> = ({ onBack, userState }) => {
  const { highContrast, fontSize } = useAccessibility();
  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'tasks' | 'sheets' | 'drive'>('calendar');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Calendar States
  const [events, setEvents] = useState<any[]>([]);
  const [eventTitle, setEventTitle] = useState('Estudo de Licitações com a ALICE 📚');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('14:00');
  const [eventDuration, setEventDuration] = useState('45');

  // Tasks States
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Sheets States
  const [exportedSheetId, setExportedSheetId] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);

  // Drive States
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [localUserState, setLocalUserState] = useState<UserState>(userState);

  // Load token and user state on mount
  useEffect(() => {
    const activeToken = getAccessToken();
    if (activeToken) {
      setToken(activeToken);
    }

    try {
      const emailKey = auth.currentUser?.email?.toLowerCase() || '';
      const localKey = emailKey ? `alice_progress_v3_${emailKey}` : 'alice_progress_v3';
      const rawProgress = localStorage.getItem(localKey) || localStorage.getItem('alice_progress_v3');
      if (rawProgress) {
        const parsed = JSON.parse(rawProgress);
        setLocalUserState(prev => ({
          ...prev,
          ...parsed
        }));
      }
    } catch (err) {
      console.error('Erro ao ler progresso do aluno no workspace:', err);
    }
  }, []);

  // Fetch data depending on active tab
  useEffect(() => {
    if (token) {
      if (activeTab === 'calendar') fetchCalendarEvents();
      if (activeTab === 'tasks') fetchTasks();
      if (activeTab === 'drive') fetchDriveFiles();
    }
  }, [token, activeTab]);

  const handleGoogleConnect = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const activeToken = getAccessToken();
      if (activeToken) {
        setToken(activeToken);
        setSuccessMsg('Conectado à sua Conta Google com sucesso!');
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg('Erro ao recuperar token de acesso.');
      }
    } catch (err: any) {
      console.error('OAuth sign in error:', err);
      setErrorMsg('Falha na autenticação com o Google. Certifique-se de conceder as permissões necessárias.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    setToken(null);
    setAccessToken(null);
    setEvents([]);
    setTasks([]);
    setDriveFiles([]);
    setExportedSheetId(null);
    setSheetUrl(null);
  };

  // Google Calendar API calls
  const fetchCalendarEvents = async () => {
    if (!token) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?orderBy=startTime&singleEvents=true&maxResults=10', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        handleTokenExpired();
        return;
      }
      const data = await res.json();
      if (data.items) {
        // Filter study sessions or keep the latest 8 events
        setEvents(data.items);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao buscar eventos do calendário.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !eventDate) {
      setErrorMsg('Por favor, selecione uma data válida para o agendamento.');
      return;
    }

    const confirmed = window.confirm(
      `Deseja agendar o evento "${eventTitle}" em sua agenda do Google para o dia ${eventDate} às ${eventTime}?`
    );
    if (!confirmed) return;

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const startDateTime = `${eventDate}T${eventTime}:00`;
      // Calculate end time
      const [hours, minutes] = eventTime.split(':').map(Number);
      const durationMin = Number(eventDuration);
      const totalMinutes = hours * 60 + minutes + durationMin;
      const endHours = Math.floor(totalMinutes / 60) % 24;
      const endMinutes = totalMinutes % 60;
      const formattedEndHours = String(endHours).padStart(2, '0');
      const formattedEndMinutes = String(endMinutes).padStart(2, '0');
      const endDateTime = `${eventDate}T${formattedEndHours}:${formattedEndMinutes}:00`;

      // Guess timezone or America/Sao_Paulo
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

      const body = {
        summary: eventTitle,
        description: 'Sessão de microlearning agendada automaticamente via aplicativo ALICE (Estudos da Nova Lei de Licitações 14.133/2021).',
        start: {
          dateTime: startDateTime,
          timeZone: timeZone
        },
        end: {
          dateTime: endDateTime,
          timeZone: timeZone
        },
        reminders: {
          useDefault: true
        }
      };

      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (res.status === 401) {
        handleTokenExpired();
        return;
      }

      if (res.ok) {
        setSuccessMsg('Compromisso agendado no seu Google Agenda com sucesso! 🎉');
        fetchCalendarEvents();
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        const errData = await res.json();
        setErrorMsg(`Erro ao criar compromisso: ${errData.error?.message || 'Erro desconhecido'}`);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro de conexão ao criar compromisso.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google Tasks API calls
  const fetchTasks = async () => {
    if (!token) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=true&maxResults=15', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        handleTokenExpired();
        return;
      }
      const data = await res.json();
      if (data.items) {
        setTasks(data.items);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao buscar lista de tarefas.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newTaskTitle.trim()) return;

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          notes: 'Metas de Estudos para o Piloto Geral ALICE - Nova Lei de Licitações (Lei 14.133)'
        })
      });

      if (res.status === 401) {
        handleTokenExpired();
        return;
      }

      if (res.ok) {
        setNewTaskTitle('');
        setSuccessMsg('Tarefa de estudos adicionada com sucesso!');
        fetchTasks();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        const errData = await res.json();
        setErrorMsg(`Erro ao criar tarefa: ${errData.error?.message || 'Erro desconhecido'}`);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro de conexão ao criar tarefa.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    if (!token) return;
    const newStatus = currentStatus === 'completed' ? 'needsAction' : 'completed';
    
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus
        })
      });

      if (res.status === 401) {
        handleTokenExpired();
        return;
      }

      if (res.ok) {
        fetchTasks();
      } else {
        const errData = await res.json();
        setErrorMsg(`Erro ao atualizar tarefa: ${errData.error?.message || 'Erro desconhecido'}`);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao atualizar status da tarefa.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google Sheets API Calls
  const handleExportToSheets = async () => {
    if (!token) return;

    const confirmed = window.confirm(
      'Deseja exportar seu plano de estudos e progresso atualizado da ALICE para uma nova planilha na sua Conta Google?'
    );
    if (!confirmed) return;

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setExportedSheetId(null);
    setSheetUrl(null);

    try {
      // 1. Create a spreadsheet
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            title: `ALICE - Relatório de Estudos - ${localUserState.name || 'Aluno'}`
          }
        })
      });

      if (createRes.status === 401) {
        handleTokenExpired();
        return;
      }

      const sheetData = await createRes.json();
      if (!createRes.ok) {
        setErrorMsg(`Erro ao criar a planilha: ${sheetData.error?.message || 'Erro desconhecido'}`);
        setIsLoading(false);
        return;
      }

      const spreadId = sheetData.spreadsheetId;

      // 2. Prepare headers and rows
      const currentDate = new Date().toLocaleString('pt-BR');
      const rows = [
        ['ALICE - ASSISTENTE DE MICRO-APRENDIZAGEM', ''],
        ['RELATÓRIO INDIVIDUAL DE RENDIMENTO', ''],
        ['', ''],
        ['DADOS DO PARTICIPANTE', ''],
        ['Nome', localUserState.name || 'Não cadastrado'],
        ['E-mail', localUserState.email || auth.currentUser?.email || 'Emulado / Interno'],
        ['Data do Relatório', currentDate],
        ['', ''],
        ['RENDIMENTO NO PILOTO', ''],
        ['Nível Atual', localUserState.currentLevel],
        ['Pontos de Experiência', `${localUserState.points || 0} XP`],
        ['Ranking Acadêmico', `Nível ${localUserState.level || 1}`],
        ['Duração da Ofensiva', `${localUserState.streakDays || 0} dias`],
        ['Quizzes Concluídos', `${localUserState.completedQuizzes?.length || 0} concluídos`],
        ['', ''],
        ['DETALHAMENTO DOS ACERTOS POR NÍVEL', ''],
        ['Nível Básico', `${localUserState.correctQuizzesCount?.Básico || 0} acertos`],
        ['Nível Intermediário', `${localUserState.correctQuizzesCount?.Intermediário || 0} acertos`],
        ['Nível Especialista', `${localUserState.correctQuizzesCount?.Especialista || 0} acertos`],
        ['', ''],
        ['Metas de fixação recomendadas pela Inteligência Artificial ALICE.'],
        ['1. Realizar revisões técnicas diárias das pílulas tipo Instagram.'],
        ['2. Completar discussões de jurisprudência no Nível Especialista.'],
        ['3. Manter a ofensiva de estudos para garantir retenção de memória de longo prazo.']
      ];

      // 3. Write data values
      const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadId}/values/A1:B25?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: rows
        })
      });

      if (writeRes.ok) {
        setExportedSheetId(spreadId);
        setSheetUrl(`https://docs.google.com/spreadsheets/d/${spreadId}`);
        setSuccessMsg('Seu Relatório de Rendimento foi exportado para o Google Planilhas! 📊');
      } else {
        const errData = await writeRes.json();
        setErrorMsg(`Erro ao salvar dados na planilha: ${errData.error?.message || 'Erro desconhecido'}`);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro técnico ao exportar relatório.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google Drive API Calls
  const fetchDriveFiles = async () => {
    if (!token) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch("https://www.googleapis.com/drive/v3/files?q=name contains 'ALICE' or name contains 'Licitação'&orderBy=createdTime desc&pageSize=10", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        handleTokenExpired();
        return;
      }
      const data = await res.json();
      if (data.files) {
        setDriveFiles(data.files);
      } else {
        setDriveFiles([]);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Falha ao listar arquivos do Google Drive.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadStudyMaterial = async () => {
    if (!token) return;

    const confirmed = window.confirm(
      'Deseja criar a Pasta Oficial e salvar as Notas de Aula do piloto de Licitações diretamente no seu Google Drive?'
    );
    if (!confirmed) return;

    setIsUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // 1. Create folder
      const folderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'ALICE - Biblioteca de Licitações 📚',
          mimeType: 'application/vnd.google-apps.folder'
        })
      });

      if (folderRes.status === 401) {
        handleTokenExpired();
        return;
      }

      const folderData = await folderRes.json();
      if (!folderRes.ok) {
        setErrorMsg(`Erro ao fabricar pasta: ${folderData.error?.message || 'Desconhecido'}`);
        setIsUploading(false);
        return;
      }

      const folderId = folderData.id;

      // 2. Create study cheatsheet (Simple plain text helper)
      const materialContent = `===========================================================
ALICE - GUIA INDIVIDUAL DE DISCIPLINAS E PRAZOS (LEI 14.133)
===========================================================

Guia didático de consulta ultra-rápida organizado pela assistente inteligente ALICE.

Módulo 1: Modalidades de Licitação
1. Pregão - Obrigatório para bens e serviços comuns.
2. Concorrência - Para obras e serviços especiais.
3. Diálogo Competitivo - Inovação técnica ou complexidade extrema.
4. Concurso - Seleção de trabalho técnico, científico ou artístico.
5. Leilão - Venda de bens móveis inservíveis ou imóveis adjudicados.

Módulo 2: Prazos Críticos de Publicação
- Aquisição de bens (Julgamento menor preço): Mínimo 8 dias úteis.
- Serviços comuns / Pregão: Mínimo 8 dias úteis.
- Serviços especiais / Obras de engenharia: Mínimo 15 dias úteis.
- Diálogo Competitivo (Manifestação inicial): Mínimo 25 dias úteis.
- Concurso técnico: Mínimo 45 dias úteis.

Módulo 3: Fases do Processo Licitatório
1. Preparatória (Criação do Termo de Referência)
2. Divulgação do Edital
3. Apresentação de Propostas e Lances
4. Julgamento das Propostas
5. Habilitação técnica/fiscal
6. Recursal
7. Homologação/Adjudicação

Gerado com carinho pela ALICE para o(a) estudante: ${localUserState.name || 'Participante'}
Status do Piloto: Conectado. Bons estudos!`;

      // Upload text file using multipart approach or simple metadata metadata
      // Drive v3 needs name, parents metadata, and content in a simple form or post
      // A clean helper is to do a simple text upload metadata.
      // To create text files, let's execute a clean POST for metadata and then update, or format as multipart:
      // Let's create metadata first
      const fileMetadataRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Cartilha_Resumo_Prazos_Licitações_ALICE.txt',
          mimeType: 'text/plain',
          parents: [folderId]
        })
      });

      const fileMetadata = await fileMetadataRes.json();
      if (!fileMetadataRes.ok) {
        setErrorMsg(`Erro ao criar arquivo: ${fileMetadata.error?.message || 'Desconhecido'}`);
        setIsUploading(false);
        return;
      }

      const fileId = fileMetadata.id;

      // Upload content
      const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'text/plain'
        },
        body: materialContent
      });

      if (uploadRes.ok) {
        setSuccessMsg('Sua Cartilha e Pasta de Estudos foram carregadas diretamente no Google Drive! 📦');
        fetchDriveFiles();
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        setErrorMsg('Erro técnico ao enviar conteúdo explicativo.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Falha de conexão ao enviar arquivos para o Drive.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTokenExpired = () => {
    setToken(null);
    setAccessToken(null);
    setErrorMsg('Sua sessão de autorização expirou. Por favor, conecte-se novamente com sua Conta Google.');
  };

  return (
    <div className="w-full flex flex-col h-full gap-4 max-w-3xl mx-auto px-2 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-slate-800/80">
        <button 
          onClick={onBack}
          className={`flex items-center gap-2 font-bold transition-all px-4 py-2 rounded-xl active:scale-95 ${
            highContrast ? 'text-yellow-300 border border-yellow-400 bg-black hover:bg-yellow-400/20' : 'text-slate-300 hover:text-white bg-slate-800/40'
          }`}
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar para Home
        </button>
        <span className={`text-sm font-semibold tracking-wide ${highContrast ? 'text-yellow-400' : 'text-blue-400'}`}>
          CENTRAL DE INTEGRAÇÕES GOOGLE WORKSPACE
        </span>
      </div>

      {/* Main Connection Frame if not authenticated */}
      {!token ? (
        <div className={`border rounded-3xl p-8 text-center shadow-2xl flex flex-col items-center justify-center min-h-[420px] ${
          highContrast ? 'bg-black border-yellow-400' : 'bg-slate-900/60 border-slate-800/80'
        }`}>
          <div className={`p-5 rounded-full mb-6 ${highContrast ? 'bg-yellow-400 text-black' : 'bg-blue-600/10 text-blue-400'}`}>
            <Bookmark className="w-12 h-12" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">Conecte seus Aplicativos Google</h2>
          <p className="max-w-md text-slate-300 text-sm sm:text-base mb-8 leading-relaxed">
            Turbine seu método de estudos! Sincronize sessões na sua agenda, armazene apostilas, crie lembretes automáticos e exporte relatórios excelentes para planilhas.
          </p>

          {errorMsg && (
            <div className={`max-w-md w-full p-4 mb-6 rounded-xl border flex items-center gap-3 text-left ${
              highContrast ? 'bg-yellow-400/10 border-yellow-400 text-yellow-300' : 'bg-red-500/10 border-red-500/20 text-red-300'
            }`}>
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-xs font-bold leading-tight">{errorMsg}</p>
            </div>
          )}

          <button
            onClick={handleGoogleConnect}
            disabled={isLoading}
            className={`flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black text-lg transition-transform active:scale-95 shadow-xl hover:scale-[1.01] ${
              highContrast ? 'bg-yellow-400 text-black' : 'bg-white text-slate-900 border border-slate-200'
            }`}
          >
            {isLoading ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            <span>Vincular Conta Google</span>
          </button>
          
          <p className="text-slate-500 text-xs mt-4">
            Isso disponibilizará acesso ao Google Calendar, Sheets, Drive e Tasks para melhorias exclusivas nos estudos.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Active Banner */}
          <div className={`p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 ${
            highContrast ? 'bg-yellow-400/10 border border-yellow-400' : 'bg-slate-900/40 border border-slate-800/80'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs sm:text-sm font-semibold text-slate-300">
                Sincronizado com: <span className="text-white font-extrabold">{auth.currentUser?.email || 'Google User'}</span>
              </p>
            </div>
            <button
              onClick={handleDisconnect}
              className={`text-xs px-3 py-1.5 font-bold rounded-lg transition-transform active:scale-95 ${
                highContrast ? 'text-black bg-yellow-400 hover:bg-yellow-300' : 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700'
              }`}
            >
              Desconectar Conta Google
            </button>
          </div>

          {/* Feedback message banner */}
          {errorMsg && (
            <div className={`p-4 rounded-2xl border flex items-center gap-3 text-left animate-in fade-in ${
              highContrast ? 'bg-yellow-400/10 border-yellow-400 text-yellow-300' : 'bg-red-500/10 border-red-500/20 text-red-300'
            }`}>
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-xs font-bold leading-tight">{errorMsg}</p>
            </div>
          )}

          {successMsg && (
            <div className={`p-4 rounded-2xl border flex items-center gap-3 text-left animate-in fade-in ${
              highContrast ? 'bg-black border-yellow-400 text-yellow-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            }`}>
              <Check className="w-5 h-5 flex-shrink-0 text-emerald-400" />
              <p className="text-xs font-bold leading-tight">{successMsg}</p>
            </div>
          )}

          {/* Dashboard Tabs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'calendar', label: 'Google Agenda', icon: Calendar, color: 'text-indigo-400 bg-indigo-500/15' },
              { id: 'tasks', label: 'Google Tarefas', icon: CheckSquare, color: 'text-blue-400 bg-blue-500/15' },
              { id: 'sheets', label: 'Google Planilhas', icon: FileSpreadsheet, color: 'text-emerald-400 bg-emerald-500/15' },
              { id: 'drive', label: 'Google Drive', icon: HardDrive, color: 'text-amber-400 bg-amber-500/15' }
            ].map(tab => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setErrorMsg('');
                    setSuccessMsg('');
                    setActiveTab(tab.id as any);
                  }}
                  className={`p-4 rounded-2xl border flex flex-col items-center gap-2 text-center transition-all active:scale-95 ${
                    isSelected 
                      ? (highContrast ? 'bg-yellow-400 text-black border-white' : 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/25') 
                      : (highContrast ? 'bg-black text-yellow-300 border-yellow-400/40 hover:border-yellow-400' : 'bg-slate-900 hover:bg-slate-850 border-slate-800')
                  }`}
                >
                  <Icon className={`w-6 h-6 ${isSelected ? '' : tab.color}`} />
                  <span className="text-xs font-black tracking-wide">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Workspaces */}
          <div className={`border rounded-3xl p-6 sm:p-8 min-h-[360px] shadow-xl ${
            highContrast ? 'bg-black border-yellow-400' : 'bg-slate-900 border-slate-800'
          }`}>
            
            {/* WORKSPACE: GOOGLE CALENDAR */}
            {activeTab === 'calendar' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-400" />
                    Agendar Horários de Estudo
                  </h3>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1">
                    Crie horários reservados na sua conta oficial de e-mail e liste seus próximos compromissos licitatórios.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Event scheduling form */}
                  <form onSubmit={handleCreateEvent} className="space-y-4 p-5 rounded-2xl bg-white/5 border border-white/5">
                    <h4 className="text-sm font-extrabold text-slate-200">Novo Agendamento</h4>
                    
                    <div className="space-y-1.5">
                      <label className="text-slate-400 text-xs font-bold block">Assunto do Estudo</label>
                      <input 
                        type="text" 
                        value={eventTitle}
                        onChange={(e) => setEventTitle(e.target.value)}
                        placeholder="Ex: Prazos de Edital ALICE"
                        className={`w-full p-3 rounded-xl text-sm font-semibold border bg-slate-950 ${
                          highContrast ? 'border-yellow-400 text-yellow-300' : 'border-slate-800 text-white focus:border-blue-500'
                        }`}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-slate-400 text-xs font-bold block">Data</label>
                        <input 
                          type="date" 
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          className={`w-full p-3 rounded-xl text-sm font-semibold border bg-slate-950 ${
                            highContrast ? 'border-yellow-400 text-yellow-300' : 'border-slate-800 text-white focus:border-blue-500'
                          }`}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-slate-400 text-xs font-bold block">Horário</label>
                        <input 
                          type="time" 
                          value={eventTime}
                          onChange={(e) => setEventTime(e.target.value)}
                          className={`w-full p-3 rounded-xl text-sm font-semibold border bg-slate-950 ${
                            highContrast ? 'border-yellow-400 text-yellow-300' : 'border-slate-800 text-white focus:border-blue-500'
                          }`}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-slate-400 text-xs font-bold block">Duração Estimada</label>
                      <select 
                        value={eventDuration}
                        onChange={(e) => setEventDuration(e.target.value)}
                        className={`w-full p-3 rounded-xl text-sm font-semibold border bg-slate-950 ${
                          highContrast ? 'border-yellow-400 text-yellow-300' : 'border-slate-800 text-white focus:border-blue-500'
                        }`}
                      >
                        <option value="15">15 minutos (Sprint de Microlearning)</option>
                        <option value="30">30 minutos (Sessão Regular)</option>
                        <option value="45">45 minutos (Foco Profundo)</option>
                        <option value="60">1 hora (Completo)</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                        highContrast ? 'bg-yellow-400 text-black border-2 border-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                      }`}
                    >
                      {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                      Agendar Oficialmente
                    </button>
                  </form>

                  {/* Calendar Upcoming Events */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <h4 className="text-sm font-extrabold text-slate-200">Agenda Próximos Eventos</h4>
                      <button 
                        onClick={fetchCalendarEvents}
                        className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white"
                        title="Atualizar"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                      {events.length === 0 ? (
                        <p className="text-slate-500 text-xs italic py-8 text-center">Nenhum compromisso encontrado ou agendado recentemente.</p>
                      ) : (
                        events.map((evt) => {
                          const dateObj = new Date(evt.start?.dateTime || evt.start?.date || '');
                          const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                          const formattedTime = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                          
                          return (
                            <div key={evt.id} className="p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-white truncate leading-tight">{evt.summary}</p>
                                <p className="text-slate-400 text-xs mt-0.5">{formattedDate} às {formattedTime}</p>
                              </div>
                              <div className="flex-shrink-0 text-right">
                                <span className="text-[10px] uppercase font-bold text-indigo-400 px-2 py-1 bg-indigo-500/10 rounded-md">Ativo</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* WORKSPACE: GOOGLE TASKS */}
            {activeTab === 'tasks' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-blue-400" />
                    Guia de Tarefas e Metas (Google Tasks)
                  </h3>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1">
                    Crie e marque tarefas em tempo real. Cada ação concluída se reflete automaticamente nos serviços do Google!
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Task Form */}
                  <form onSubmit={handleCreateTask} className="flex gap-2">
                    <input 
                      type="text" 
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Adicione uma meta licitatória (Ex: responder quiz nível básico)..."
                      className={`flex-1 p-3 px-4 rounded-xl text-sm font-semibold border bg-slate-950 ${
                        highContrast ? 'border-yellow-400 text-yellow-300' : 'border-slate-800 text-white focus:border-blue-500'
                      }`}
                      required
                    />
                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`px-5 rounded-xl font-black text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                        highContrast ? 'bg-yellow-400 text-black border-2 border-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                    >
                      {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 text-inherit" />}
                      Adicionar
                    </button>
                  </form>

                  {/* Tasks List */}
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {tasks.length === 0 ? (
                      <p className="text-slate-500 text-xs italic py-12 text-center">Nenhuma meta ativa de estudos encontrada no seu Google Agenda de Tarefas.</p>
                    ) : (
                      tasks.map((task) => {
                        const isDone = task.status === 'completed';
                        return (
                          <div 
                            key={task.id} 
                            onClick={() => handleToggleTask(task.id, task.status)}
                            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                              isDone 
                                ? (highContrast ? 'bg-yellow-400/10 border-yellow-400/40 opacity-70' : 'bg-slate-950 border-slate-900/50 opacity-60')
                                : (highContrast ? 'bg-black border-yellow-400 hover:bg-yellow-400/5' : 'bg-white/5 border-white/5 hover:bg-white/10')
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                                isDone 
                                  ? 'bg-blue-500 border-blue-600 text-white' 
                                  : (highContrast ? 'border-yellow-400' : 'border-slate-700')
                              }`}>
                                {isDone && <Check className="w-3.5 h-3.5" />}
                              </div>
                              <span className={`text-sm font-bold truncate ${
                                isDone ? 'line-through text-slate-500' : 'text-slate-200'
                              }`}>
                                {task.title}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 flex-shrink-0">
                              {isDone ? 'Concluído' : 'A fazer'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* WORKSPACE: GOOGLE SHEETS */}
            {activeTab === 'sheets' && (
              <div className="space-y-6 flex flex-col justify-between h-full">
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                    Exportar Rendimento Completo (Google Sheets)
                  </h3>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1">
                    Exporte suas conquistas do piloto geral da Nova Lei de Licitações diretamente no Google Planilhas.
                  </p>
                </div>

                <div className={`p-6 rounded-2xl border text-center ${
                  highContrast ? 'bg-black border-yellow-400' : 'bg-white/5 border-white/5'
                }`}>
                  <h4 className="text-base font-extrabold text-white mb-2">Seus dados atuais prontos para exportar:</h4>
                  
                  <div className="max-w-md mx-auto grid grid-cols-2 gap-3 my-4 text-left">
                    <div className="p-3 rounded-lg bg-slate-950/80 border border-white/5">
                      <span className="text-[10px] text-slate-400 block font-semibold">PARTICIPANTE</span>
                      <span className="text-sm font-black text-slate-100 truncate block">{localUserState.name || 'Sem nome'}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950/80 border border-white/5">
                      <span className="text-[10px] text-slate-400 block font-semibold">NÍVEL ALCANCE</span>
                      <span className="text-sm font-black text-emerald-400 block">{localUserState.currentLevel}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950/80 border border-white/5">
                      <span className="text-[10px] text-slate-400 block font-semibold font-bold">PONTUAÇÃO</span>
                      <span className="text-sm font-black text-slate-100 block">{localUserState.points || 0} XP</span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950/80 border border-white/5">
                      <span className="text-[10px] text-slate-400 block font-semibold">OFENSIVA DIÁRIA</span>
                      <span className="text-sm font-black text-orange-400 block">⚡ {localUserState.streakDays || 0} Dias</span>
                    </div>
                  </div>

                  {sheetUrl ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 max-w-sm mx-auto text-emerald-300 font-bold text-sm">
                        Planilha criada com sucesso! 📊
                      </div>
                      <a 
                        href={sheetUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className={`inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm transition-transform active:scale-95 ${
                          highContrast ? 'bg-yellow-400 text-black border-2 border-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        Abrir Planilha no Google Planilhas
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  ) : (
                    <button
                      onClick={handleExportToSheets}
                      disabled={isLoading}
                      className={`inline-flex items-center gap-2 px-8 py-4 rounded-xl font-black text-base transition-transform active:scale-95 ${
                        highContrast ? 'bg-yellow-400 text-black border-2 border-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      {isLoading ? (
                        <Loader className="w-5 h-5 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="w-5 h-5 text-inherit" />
                      )}
                      Gerar e Exportar Planilha de Estatísticas
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* WORKSPACE: GOOGLE DRIVE */}
            {activeTab === 'drive' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-amber-400" />
                    Aulas e Biblioteca (Google Drive)
                  </h3>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1">
                    Salve cartilhas de consulta e crie uma biblioteca oficial do Aluno dedicada sobre a Nova Lei de Licitações (Lei 14.133).
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Save official Guides CTA */}
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <h4 className="text-sm font-extrabold text-slate-200">Cartilha ALICE: Resumo de Prazos</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Cria automaticamente um arquivo exclusivo (<code className="bg-slate-950 p-0.5 rounded">.txt</code>) dentro do seu Drive com resumos acadêmicos organizados para impressão ou leitura em dispositivos móveis.
                      </p>
                    </div>

                    <button
                      onClick={handleUploadStudyMaterial}
                      disabled={isUploading}
                      className={`w-full py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                        highContrast ? 'bg-yellow-400 text-black border-2 border-white' : 'bg-amber-600 hover:bg-amber-500 text-white'
                      }`}
                    >
                      {isUploading ? (
                        <Loader className="w-4 h-4 animate-spin animate-pulse" />
                      ) : (
                        <Download className="w-4 h-4 text-inherit" />
                      )}
                      Enviar Cartilha para o Google Drive
                    </button>
                  </div>

                  {/* Drive File list */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <h4 className="text-sm font-extrabold text-slate-200">Biblioteca Licitações</h4>
                      <button 
                        onClick={fetchDriveFiles}
                        className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white"
                        title="Atualizar Biblioteca"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                      {driveFiles.length === 0 ? (
                        <p className="text-slate-500 text-xs italic py-8 text-center">Nenhum documento do piloto de estudos foi localizado no seu Google Drive.</p>
                      ) : (
                        driveFiles.map((file) => (
                          <div key={file.id} className="p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-white truncate leading-tight">{file.name}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">MimeType: {file.mimeType?.split('.').pop() || 'Desconhecido'}</p>
                            </div>
                            <a 
                              href={`https://drive.google.com/file/d/${file.id}/view`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};
