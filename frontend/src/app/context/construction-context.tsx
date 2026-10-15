// Contexto global do sistema: guarda no estado todos os dados (obras, etapas, gastos, documentos,
// usuários, notificações e histórico), conversa com a API e oferece as funções que as telas usam
// (criar, editar, remover e os cálculos de progresso, prazo e status).
// As telas só precisam chamar o hook useConstructionManagement().
import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, ReactNode,
} from 'react';
import { toast } from 'sonner';
import { api, API_BASE, ApiError, getToken, setToken, getStoredUser, setStoredUser, clearSession, readApiMessage, SESSION_EXPIRED_EVENT } from '../utils/api';

// Tipos

export type StaffRole            = 'Administrativo' | 'Engenheiro' | 'Mestre de Obras' | 'Visualizador' | 'TI' | 'Dono';
export type AccountStatus        = 'Ativo' | 'Inativo';
export type ProjectStatus        = 'Em andamento' | 'Concluída' | 'Paralisada';
export type ScheduleStageStatus  = 'Não iniciada' | 'Em andamento' | 'Concluída' | 'Atrasada';
export type NotificationSeverity = 'success' | 'warning' | 'error' | 'info';
export type ExpenseCategory      = 'Materiais' | 'Equipamentos' | 'Mão de obra' | 'Transporte' | 'Serviços' | 'Outros';
export type DocumentCategory     = 'Alvará de Construção' | 'Alvará de Funcionamento' | 'Licença Ambiental' | 'ART/RRT' | 'Projeto Aprovado' | 'Matrícula do Imóvel' | 'Habite-se' | 'Contrato' | 'Laudo Técnico' | 'Outros';
export type DocumentValidityStatus = 'Válido' | 'Vencendo' | 'Vencido' | 'Pendente' | 'Cancelado';
export type ObraType             = 'Residencial' | 'Comercial' | 'Industrial' | 'Misto';
export type ObraComplexidade     = 'Baixa' | 'Média' | 'Alta';
export type AuditAction          = 'Criou' | 'Editou' | 'Removeu';
export type AuditModule          = 'Obras' | 'Etapas' | 'Despesas' | 'Documentos' | 'Usuários';

// Entidades

export interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  action: AuditAction;
  module: AuditModule;
  targetName: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  role: StaffRole;
  status: AccountStatus;
  verified: boolean;
  verificationCode?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  cep: string;
  street: string;
  streetNumber?: string;
  neighborhood: string;
  city: string;
  state: string;
  responsibleId: string;
  status: ProjectStatus;
  progress: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  area?: number;
  floors?: number;
  units?: number;
  teamSize?: number;
  teamMembers?: string[]; // nomes dos integrantes (opcional)
  estimatedCost?: number;
  clientBudget?: number;
  tipo?: ObraType;
  complexidade?: ObraComplexidade;
}

export interface ScheduleStage {
  id: string;
  obraId: string;
  name: string;
  responsibleId: string;
  plannedStart: string;
  plannedEnd: string;
  actualEnd?: string;
  progress: number;
  status: ScheduleStageStatus;
  notes?: string;
}

export interface SystemNotification {
  id: string;
  type: NotificationSeverity;
  message: string;
  obraId?: string;
  createdAt: string;
  read: boolean;
}

export interface Expense {
  id: string;
  obraId: string;
  description: string;
  category: ExpenseCategory;
  value: number;
  date: string;
  fornecedor?: string;
  etapaId?: string;
  notes?: string;
  receipt?: string;
  receiptName?: string;
  createdBy: string;
  createdAt: string;
}

export interface ProjectDocument {
  id: string;
  obraId: string;
  title: string;
  type: DocumentCategory;
  status: DocumentValidityStatus;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
  file?: string;
  fileName?: string;
  uploadedBy: string;
  createdAt: string;
}

// Resultado do login

interface AuthenticationResult {
  success: boolean;
  error?: string;
  needsVerification?: boolean;
}

// Estimativa de prazo

interface DeadlinePrediction {
  days: number;
  date: string;
  dateISO: string;
  basedOn: number;
  isFallback: boolean;
}

// O que o contexto oferece

interface ConstructionManagementContextType {
  isInitializing: boolean;
  isSyncConnected: boolean;

  activeUser: TeamMember | null;
  pendingVerificationUser: TeamMember | null;
  login: (email: string, password: string) => Promise<AuthenticationResult>;
  verifyAccountCode: (code: string) => Promise<AuthenticationResult>;
  logout: () => void;

  teamMembers: TeamMember[];
  registerTeamMember: (member: Omit<TeamMember, 'id' | 'createdAt'>) => Promise<string>;
  updateTeamMember: (id: string, updates: Partial<TeamMember>) => Promise<void>;
  removeTeamMember: (id: string) => Promise<void>;

  projects: Project[];
  createProject: (project: Omit<Project, 'id' | 'createdAt'>) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  generateProjectAnalysis: (obraId: string) => Promise<string>;

  scheduleStages: ScheduleStage[];
  addScheduleStage: (stage: Omit<ScheduleStage, 'id'>) => Promise<void>;
  updateScheduleStage: (id: string, updates: Partial<ScheduleStage>) => Promise<void>;
  removeScheduleStage: (id: string) => Promise<void>;

  expenses: Expense[];
  recordExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<void>;
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
  calculateTotalExpenses: (projectId: string) => number;

  documents: ProjectDocument[];
  attachDocument: (doc: Omit<ProjectDocument, 'id' | 'createdAt'>) => Promise<void>;
  updateDocument: (id: string, updates: Partial<ProjectDocument>) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  calculateDocumentStatus: (doc: ProjectDocument) => DocumentValidityStatus;

  systemNotifications: SystemNotification[];
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  auditLog: AuditEntry[];

  calculateProjectProgress: (projectId: string) => number;
  calculateExpectedProgress: (project: Project) => number;
  getScheduleStatus: (project: Project) => 'No Prazo' | 'Atrasada';
  countUnreadNotifications: () => number;
  estimateProjectCompletion: (params: {
    area: number;
    startDate: string;
    floors?: number;
    teamSize?: number;
    tipo?: ObraType;
    complexidade?: ObraComplexidade;
  }) => DeadlinePrediction | null;
}

// Funções auxiliares

const SEVERITY_ICONS: Record<NotificationSeverity, string> = {
  success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️',
};

function showNotificationToast(notification: SystemNotification): void {
  const icon = SEVERITY_ICONS[notification.type] ?? 'ℹ️';
  const fn =
    notification.type === 'success' ? toast.success :
    notification.type === 'warning' ? toast.warning :
    notification.type === 'error'   ? toast.error   : toast.info;

  fn(`${icon} ${notification.message}`, {
    duration: 6000,
    position: 'top-right',
    style: {
      background: '#1a2332',
      color: '#fff',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '12px',
      fontSize: '13px',
    },
  });
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Constantes da previsão de prazo (veja estimateProjectCompletion):
// - COMPLEXITY_FACTOR: multiplica os dias conforme a complexidade da obra
// - INDUSTRY_AVERAGE_DAYS_PER_SQM: valor de referência (dias por m²) usado quando ainda
//   não existe nenhuma obra concluída pra servir de base
// - FLOOR_COMPLEXITY_FACTOR: cada pavimento a mais deixa a obra 8% mais demorada
const COMPLEXITY_FACTOR: Record<string, number> = { Baixa: 0.85, Média: 1.0, Alta: 1.25 };
const INDUSTRY_AVERAGE_DAYS_PER_SQM = 0.52;
const FLOOR_COMPLEXITY_FACTOR        = 0.08;

// Valores padrão do contexto

const ConstructionManagementContext = createContext<ConstructionManagementContextType>({
  isInitializing: true,
  isSyncConnected: false,
  activeUser: null,
  pendingVerificationUser: null,
  login: async () => ({ success: false }),
  verifyAccountCode: async () => ({ success: false }),
  logout: () => {},
  teamMembers: [],
  registerTeamMember: async () => '',
  updateTeamMember: async () => {},
  removeTeamMember: async () => {},
  projects: [],
  createProject: async () => {},
  updateProject: async () => {},
  removeProject: async () => {},
  generateProjectAnalysis: async () => '',
  scheduleStages: [],
  addScheduleStage: async () => {},
  updateScheduleStage: async () => {},
  removeScheduleStage: async () => {},
  expenses: [],
  recordExpense: async () => {},
  updateExpense: async () => {},
  removeExpense: async () => {},
  calculateTotalExpenses: () => 0,
  documents: [],
  attachDocument: async () => {},
  updateDocument: async () => {},
  removeDocument: async () => {},
  calculateDocumentStatus: (d) => d.status,
  systemNotifications: [],
  markNotificationRead: async () => {},
  markAllNotificationsRead: async () => {},
  auditLog: [],
  calculateProjectProgress: () => 0,
  calculateExpectedProgress: () => 0,
  getScheduleStatus: () => 'No Prazo',
  countUnreadNotifications: () => 0,
  estimateProjectCompletion: () => null,
});

// Provider

// guarda só os campos conhecidos, como texto (sem senha, código ou campos extras)
function usuarioParaGuardar(u: TeamMember): Record<string, string | boolean> {
  return {
    id: String(u.id), name: String(u.name), email: String(u.email), phone: String(u.phone ?? ''),
    role: String(u.role), status: String(u.status), verified: Boolean(u.verified), createdAt: String(u.createdAt),
  };
}

export function ConstructionManagementProvider({ children }: { children: ReactNode }) {

  const [isInitializing,    setIsInitializing]    = useState(true);
  const [isSyncConnected,   setIsSyncConnected]   = useState(false);
  // sobe a cada login: força uma nova carga dos dados mesmo que o usuário seja o mesmo da sessão salva
  const [loadVersion, setLoadVersion] = useState(0);

  // o usuário logado fica salvo no localStorage, então continua logado depois de recarregar a página
  // (só vale se o token de login também estiver guardado)
  const [activeUser, setActiveUser] = useState<TeamMember | null>(() => {
    try {
      const stored = getStoredUser();
      return stored && getToken() ? { password: '', ...JSON.parse(stored) } : null;
    } catch { return null; }
  });

  const [pendingVerificationUser, setPendingVerificationUser] = useState<TeamMember | null>(null);
  const [pendingVerifyToken, setPendingVerifyToken] = useState<string | null>(null);
  const [teamMembers,    setTeamMembers]    = useState<TeamMember[]>([]);
  const [projects,       setProjects]       = useState<Project[]>([]);
  const [scheduleStages, setScheduleStages] = useState<ScheduleStage[]>([]);
  const [expenses,       setExpenses]       = useState<Expense[]>([]);
  const [documents,      setDocuments]      = useState<ProjectDocument[]>([]);
  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>([]);
  const [auditLog,       setAuditLog]       = useState<AuditEntry[]>([]);

  // os refs guardam sempre o valor mais recente (usuário, obras, etapas). Servem pras funções
  // que rodam depois de um await lerem o valor atual, e não o de quando foram criadas.
  const activeUserRef    = useRef<TeamMember | null>(activeUser);
  const projectsRef      = useRef<Project[]>([]);
  const scheduleStagesRef = useRef<ScheduleStage[]>([]);

  useEffect(() => { activeUserRef.current = activeUser; }, [activeUser]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);
  useEffect(() => { scheduleStagesRef.current = scheduleStages; }, [scheduleStages]);

  useEffect(() => {
    setStoredUser(activeUser ? usuarioParaGuardar(activeUser) : null);
  }, [activeUser]);

  // Carga inicial vinda da API

  // se o servidor disser que a sessão venceu, volta pro login
  useEffect(() => {
    const onExpired = () => {
      setActiveUser(null);
      setPendingVerificationUser(null);
      setPendingVerifyToken(null);
      toast.warning('Sua sessão expirou. Entre novamente.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  // Os dados só são buscados depois do login (o /data exige token). Ao sair, limpa tudo
  // pra não sobrar nada do usuário anterior na tela.
  useEffect(() => {
    if (!activeUser) {
      setTeamMembers([]); setProjects([]); setScheduleStages([]); setExpenses([]);
      setDocuments([]); setSystemNotifications([]); setAuditLog([]);
      setIsSyncConnected(false);
      setIsInitializing(false);
      return;
    }

    let cancelled = false; // se o usuário sair no meio da carga, a resposta é descartada
    setIsInitializing(true);
    const load = async () => {
      try {
        // um único GET /data traz tudo: usuários, obras, etapas, gastos, documentos, notificações e histórico
        const data = await api<{
          users: TeamMember[];
          obras: Project[];
          stages: ScheduleStage[];
          notifications: SystemNotification[];
          gastos: Expense[];
          documentos: ProjectDocument[];
          audit: AuditEntry[];
        }>('/data');
        if (cancelled) return;

        setTeamMembers(data.users ?? []);
        setProjects(data.obras ?? []);
        setScheduleStages(data.stages ?? []);
        setSystemNotifications(data.notifications ?? []);
        setExpenses(data.gastos ?? []);
        setDocuments(data.documentos ?? []);
        setAuditLog(data.audit ?? []);

        // atualiza o usuário logado com o que veio do banco (perfil ou status podem ter mudado)
        const session = activeUserRef.current;
        if (session) {
          const fresh = (data.users ?? []).find(u => u.id === session.id);
          if (fresh) setActiveUser(fresh);
        }

        setIsSyncConnected(true);
      } catch (err) {
        if (cancelled) return;
        // 401 é sessão vencida: o aviso e a volta pro login já são tratados em utils/api.ts
        if (!(err instanceof ApiError && err.status === 401)) console.error('Failed to load data from API:', err);
        setIsSyncConnected(false);
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [activeUser?.id, loadVersion]);

  // tempo real: o servidor avisa quando algo muda (conexão aberta) e a tela busca /data de novo.
  // O intervalo de 60 s e a volta pra aba servem de reserva se a conexão cair.
  useEffect(() => {
    if (!activeUser) return;
    let cancelled = false;
    const controller = new AbortController();

    const refresh = async () => {
      if (document.hidden) return;
      try {
        const data = await api<{
          users: TeamMember[];
          obras: Project[];
          stages: ScheduleStage[];
          notifications: SystemNotification[];
          gastos: Expense[];
          documentos: ProjectDocument[];
          audit: AuditEntry[];
        }>('/data');
        if (cancelled) return;
        setTeamMembers(data.users ?? []);
        setProjects(data.obras ?? []);
        setScheduleStages(data.stages ?? []);
        setSystemNotifications(data.notifications ?? []);
        setExpenses(data.gastos ?? []);
        setDocuments(data.documentos ?? []);
        setAuditLog(data.audit ?? []);
      } catch { /* na próxima tentativa tenta de novo */ }
    };

    // fica lendo a conexão aberta; se cair, espera um pouco e reconecta
    const listen = async () => {
      let wait = 1000;
      while (!cancelled) {
        try {
          const token = getToken();
          if (!token) return;
          const res = await fetch(`${API_BASE}/events`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          if (res.status === 401) return;
          if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
          wait = 1000;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (!cancelled) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n\n');
            buffer = parts.pop() ?? '';
            if (parts.some(p => p.includes('event: changed'))) void refresh();
          }
        } catch { if (cancelled) return; }
        await new Promise(r => setTimeout(r, wait));
        wait = Math.min(wait * 2, 30000);
      }
    };
    void listen();

    const timer = setInterval(() => void refresh(), 60000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [activeUser?.id]);

  // Cria notificação (uso interno)

  const pushNotification = useCallback(async (
    type: NotificationSeverity,
    message: string,
    obraId?: string,
  ) => {
    try {
      const body: Record<string, unknown> = { type, message };
      if (obraId) body.obraId = obraId;
      const res = await api<{ notification: SystemNotification }>('/notifications', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const notif = res.notification;
      setSystemNotifications(prev => [notif, ...prev]);
      showNotificationToast(notif);
    } catch {
      // mesmo se a API falhar, o aviso aparece na tela
      const fallback: SystemNotification = {
        id: String(Date.now()),
        type,
        message,
        obraId,
        createdAt: new Date().toISOString(),
        read: false,
      };
      showNotificationToast(fallback);
    }
  }, []);

  // Registra no histórico (uso interno)

  // grava no histórico quem fez o quê (criou, editou ou removeu), em qual módulo e,
  // nas edições, o valor antigo e o novo
  const pushAuditEntry = useCallback(async (entry: Omit<AuditEntry, 'id' | 'createdAt'>) => {
    try {
      const res = await api<{ entry: AuditEntry }>('/audit', {
        method: 'POST',
        body: JSON.stringify(entry),
      });
      setAuditLog(prev => [res.entry, ...prev]);
    } catch (err) {
      console.warn('Audit entry failed:', err);
    }
  }, []);

  // Recalcula o progresso da obra (uso interno)

  // o progresso da obra é a média do progresso das etapas dela. Sempre que uma etapa
  // muda, recalcula e salva na obra
  const syncProjectProgress = useCallback(async (obraId: string, stages: ScheduleStage[]) => {
    const projectStages = stages.filter(s => s.obraId === obraId);
    if (projectStages.length === 0) return;
    const progress = Math.round(
      projectStages.reduce((sum, s) => sum + s.progress, 0) / projectStages.length
    );
    try {
      await api(`/obras/${obraId}`, {
        method: 'PUT',
        body: JSON.stringify({ progress }),
      });
      setProjects(prev => prev.map(p => p.id === obraId ? { ...p, progress } : p));
    } catch (err) {
      console.warn('Progress sync failed:', err);
    }
  }, []);

  // Login

  // O login só trata o que o backend respondeu: sucesso (guarda o token e o usuário), conta que
  // precisa ser verificada (guarda o usuário pendente pra tela do código) ou erro (mostra a mensagem).
  const login = async (email: string, password: string): Promise<AuthenticationResult> => {
    try {
      const res = await api<{
        success?: boolean; error?: string; needsVerification?: boolean;
        user?: TeamMember; token?: string; verifyToken?: string;
      }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

      if (res.needsVerification && res.user && res.verifyToken) {
        setPendingVerificationUser(res.user);
        setPendingVerifyToken(res.verifyToken);
        return { success: false, needsVerification: true };
      }
      if (res.success && res.user && res.token) {
        setToken(res.token);
        setIsInitializing(true); // evita mostrar telas vazias enquanto os dados carregam
        setActiveUser(res.user);
        setLoadVersion(v => v + 1); // garante a busca dos dados mesmo se já havia sessão salva
        return { success: true };
      }
      return { success: false, error: res.error || 'Erro desconhecido.' };
    } catch (err) {
      return { success: false, error: readApiMessage(err, 'Não foi possível conectar ao servidor. Tente de novo.') };
    }
  };

  // primeiro acesso: manda o código junto com o token curto que o login entregou
  const verifyAccountCode = async (code: string): Promise<AuthenticationResult> => {
    if (!pendingVerificationUser || !pendingVerifyToken) {
      return { success: false, error: 'Faça login de novo.' };
    }
    try {
      const res = await api<{ success?: boolean; user?: TeamMember; token?: string }>(
        '/auth/verify',
        { method: 'POST', body: JSON.stringify({ verifyToken: pendingVerifyToken, code }) },
      );
      if (res.success && res.user && res.token) {
        setToken(res.token);
        setIsInitializing(true);
        setActiveUser(res.user);
        setLoadVersion(v => v + 1);
        setPendingVerificationUser(null);
        setPendingVerifyToken(null);
        return { success: true };
      }
      return { success: false, error: 'Código inválido. Tente novamente.' };
    } catch (err) {
      return { success: false, error: readApiMessage(err, 'Código inválido. Tente novamente.') };
    }
  };

  // sair apaga o token e o usuário guardados no navegador
  const logout = () => {
    clearSession();
    setActiveUser(null);
    setPendingVerificationUser(null);
    setPendingVerifyToken(null);
  };

  // Equipe (usuários)

  const registerTeamMember = async (memberData: Omit<TeamMember, 'id' | 'createdAt'>): Promise<string> => {
    const res = await api<{ user: TeamMember; verificationCode: string }>('/users', {
      method: 'POST',
      body: JSON.stringify(memberData),
    });
    setTeamMembers(prev => [...prev, res.user]);
    pushNotification('info', `Novo usuário "${memberData.name}" cadastrado no sistema`);
    pushAuditEntry({
      userId:     activeUserRef.current?.id ?? '',
      userName:   activeUserRef.current?.name ?? 'Sistema',
      action:     'Criou',
      module:     'Usuários',
      targetName: memberData.name,
    });
    return res.verificationCode;
  };

  const updateTeamMember = async (id: string, updates: Partial<TeamMember>): Promise<void> => {
    const existing = teamMembers.find(u => u.id === id);
    const res = await api<{ user: TeamMember }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    setTeamMembers(prev => prev.map(u => u.id === id ? res.user : u));
    if (activeUser?.id === id) setActiveUser(res.user);

    if (existing) {
      // só entram no histórico os campos que mudaram de verdade (senha e código ficam de fora)
      const changedFields = (Object.keys(updates) as Array<keyof TeamMember>).filter(
        k => updates[k] !== existing[k] && k !== 'password' && k !== 'verificationCode'
      );
      for (const field of changedFields) {
        pushAuditEntry({
          userId:     activeUserRef.current?.id ?? '',
          userName:   activeUserRef.current?.name ?? 'Sistema',
          action:     'Editou',
          module:     'Usuários',
          targetName: existing.name,
          field:      String(field),
          oldValue:   String(existing[field] ?? ''),
          newValue:   String(updates[field] ?? ''),
        });
      }
    }
  };

  const removeTeamMember = async (id: string): Promise<void> => {
    const member = teamMembers.find(u => u.id === id);
    await api(`/users/${id}`, { method: 'DELETE' });
    setTeamMembers(prev => prev.filter(u => u.id !== id));
    if (member) {
      pushAuditEntry({
        userId:     activeUserRef.current?.id ?? '',
        userName:   activeUserRef.current?.name ?? 'Sistema',
        action:     'Removeu',
        module:     'Usuários',
        targetName: member.name,
      });
    }
  };

  // Obras

  // Padrão de criar/editar/remover (vale pra obras, etapas, gastos e documentos):
  // 1) chama a API, 2) atualiza o estado da tela, 3) gera uma notificação e
  // 4) grava no histórico quem fez a alteração.
  const createProject = async (projectData: Omit<Project, 'id' | 'createdAt'>): Promise<void> => {
    const res = await api<{ obra: Project }>('/obras', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
    setProjects(prev => [...prev, res.obra]);
    pushNotification('info', `Nova obra "${projectData.name}" adicionada ao sistema`);
    pushAuditEntry({
      userId:     activeUserRef.current?.id ?? '',
      userName:   activeUserRef.current?.name ?? 'Sistema',
      action:     'Criou',
      module:     'Obras',
      targetName: projectData.name,
    });
  };

  const updateProject = async (id: string, updates: Partial<Project>): Promise<void> => {
    const existing = projectsRef.current.find(p => p.id === id);
    const res = await api<{ obra: Project }>(`/obras/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    setProjects(prev => prev.map(p => p.id === id ? res.obra : p));

    if (existing && activeUserRef.current) {
      const skipFields = new Set(['progress', 'createdAt', 'id']);
      // Arrays (teamMembers) são comparados pelo conteúdo. Sem isso, salvar com os
      // mesmos nomes geraria um registro falso de edição no histórico.
      const sameValue = (a: unknown, b: unknown) =>
        Array.isArray(a) || Array.isArray(b)
          ? JSON.stringify(a ?? []) === JSON.stringify(b ?? [])
          : a === b;
      const display = (v: unknown) => Array.isArray(v) ? v.join(', ') : String(v ?? '');
      const changedFields = (Object.keys(updates) as Array<keyof Project>).filter(
        k => !skipFields.has(k) && !sameValue(updates[k], existing[k])
      );
      for (const field of changedFields) {
        pushAuditEntry({
          userId:     activeUserRef.current.id,
          userName:   activeUserRef.current.name,
          action:     'Editou',
          module:     'Obras',
          targetName: existing.name,
          field:      String(field),
          oldValue:   display(existing[field]),
          newValue:   display(updates[field]),
        });
      }
    }
  };

  const removeProject = async (id: string): Promise<void> => {
    const project = projectsRef.current.find(p => p.id === id);
    await api(`/obras/${id}`, { method: 'DELETE' });
    setProjects(prev => prev.filter(p => p.id !== id));
    setScheduleStages(prev => prev.filter(s => s.obraId !== id));
    setExpenses(prev => prev.filter(e => e.obraId !== id));
    setDocuments(prev => prev.filter(d => d.obraId !== id));
    if (project) {
      pushNotification('info', `Obra "${project.name}" removida do sistema`);
      pushAuditEntry({
        userId:     activeUserRef.current?.id ?? '',
        userName:   activeUserRef.current?.name ?? 'Sistema',
        action:     'Removeu',
        module:     'Obras',
        targetName: project.name,
      });
    }
  };

  // Pede ao backend (que chama o Gemini) um resumo da obra.
  // Se der erro, a rota devolve { message } (503 sem chave, 502 se a IA falhar...).
  const generateProjectAnalysis = async (obraId: string): Promise<string> => {
    try {
      const res = await api<{ analysis: string }>('/ai/analyze-obra', {
        method: 'POST',
        body: JSON.stringify({ obraId }),
      });
      return res.analysis;
    } catch (err) {
      let message = 'Não foi possível gerar a análise agora. Tente novamente em instantes.';
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed && typeof parsed.message === 'string') message = parsed.message;
        } catch { /* não veio JSON (ex: sem internet), fica a mensagem padrão */ }
      }
      throw new Error(message);
    }
  };

  // Etapas do cronograma

  const addScheduleStage = async (stageData: Omit<ScheduleStage, 'id'>): Promise<void> => {
    const res = await api<{ stage: ScheduleStage }>('/stages', {
      method: 'POST',
      body: JSON.stringify(stageData),
    });
    const updatedStages = [...scheduleStagesRef.current, res.stage];
    setScheduleStages(updatedStages);
    syncProjectProgress(stageData.obraId, updatedStages);

    const project = projectsRef.current.find(p => p.id === stageData.obraId);
    pushNotification('info', `Nova etapa "${stageData.name}" adicionada à obra "${project?.name}"`, stageData.obraId);
    pushAuditEntry({
      userId:     activeUserRef.current?.id ?? '',
      userName:   activeUserRef.current?.name ?? 'Sistema',
      action:     'Criou',
      module:     'Etapas',
      targetName: `${stageData.name} (${project?.name ?? ''})`,
    });
  };

  const updateScheduleStage = async (id: string, updates: Partial<ScheduleStage>): Promise<void> => {
    const existing = scheduleStagesRef.current.find(s => s.id === id);
    if (!existing) return;

    const res = await api<{ stage: ScheduleStage }>(`/stages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    const updatedStages = scheduleStagesRef.current.map(s => s.id === id ? res.stage : s);
    setScheduleStages(updatedStages);
    syncProjectProgress(existing.obraId, updatedStages);

    // só avisa quando o status da etapa mudou: concluída (sucesso), atrasada (alerta) ou iniciada (info)
    if (updates.status && updates.status !== existing.status) {
      const project = projectsRef.current.find(p => p.id === existing.obraId);
      const pName   = project?.name ?? 'Obra';
      if (updates.status === 'Concluída') {
        pushNotification('success', `Etapa "${existing.name}" da obra "${pName}" foi concluída!`, existing.obraId);
      } else if (updates.status === 'Atrasada') {
        pushNotification('warning', `Etapa "${existing.name}" da obra "${pName}" está atrasada`, existing.obraId);
      } else if (updates.status === 'Em andamento') {
        pushNotification('info', `Etapa "${existing.name}" da obra "${pName}" iniciada`, existing.obraId);
      }
    }

    const project = projectsRef.current.find(p => p.id === existing.obraId);
    const skipFields = new Set(['id', 'obraId']);
    const changedFields = (Object.keys(updates) as Array<keyof ScheduleStage>).filter(
      k => !skipFields.has(k) && updates[k] !== existing[k]
    );
    for (const field of changedFields) {
      pushAuditEntry({
        userId:     activeUserRef.current?.id ?? '',
        userName:   activeUserRef.current?.name ?? 'Sistema',
        action:     'Editou',
        module:     'Etapas',
        targetName: `${existing.name} (${project?.name ?? ''})`,
        field:      String(field),
        oldValue:   String(existing[field] ?? ''),
        newValue:   String(updates[field] ?? ''),
      });
    }
  };

  const removeScheduleStage = async (id: string): Promise<void> => {
    const stage = scheduleStagesRef.current.find(s => s.id === id);
    await api(`/stages/${id}`, { method: 'DELETE' });
    const remaining = scheduleStagesRef.current.filter(s => s.id !== id);
    setScheduleStages(remaining);

    if (stage) {
      syncProjectProgress(stage.obraId, remaining);
      const project = projectsRef.current.find(p => p.id === stage.obraId);
      pushAuditEntry({
        userId:     activeUserRef.current?.id ?? '',
        userName:   activeUserRef.current?.name ?? 'Sistema',
        action:     'Removeu',
        module:     'Etapas',
        targetName: `${stage.name} (${project?.name ?? ''})`,
      });
    }
  };

  // Gastos

  const recordExpense = async (expenseData: Omit<Expense, 'id' | 'createdAt'>): Promise<void> => {
    const res = await api<{ gasto: Expense }>('/gastos', {
      method: 'POST',
      body: JSON.stringify(expenseData),
    });
    setExpenses(prev => [res.gasto, ...prev]);
    const project = projectsRef.current.find(p => p.id === expenseData.obraId);
    pushNotification(
      'info',
      `Novo gasto de ${formatBRL(expenseData.value)} lançado na obra "${project?.name}"`,
      expenseData.obraId,
    );
    pushAuditEntry({
      userId:     activeUserRef.current?.id ?? '',
      userName:   activeUserRef.current?.name ?? 'Sistema',
      action:     'Criou',
      module:     'Despesas',
      targetName: `${expenseData.description} (${project?.name ?? ''})`,
      field:      'valor',
      newValue:   formatBRL(expenseData.value),
    });
  };

  const updateExpense = async (id: string, updates: Partial<Expense>): Promise<void> => {
    const existing = expenses.find(e => e.id === id);
    const res = await api<{ gasto: Expense }>(`/gastos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    setExpenses(prev => prev.map(e => e.id === id ? res.gasto : e));

    if (existing && updates.value !== undefined && updates.value !== existing.value) {
      const project = projectsRef.current.find(p => p.id === existing.obraId);
      pushAuditEntry({
        userId:     activeUserRef.current?.id ?? '',
        userName:   activeUserRef.current?.name ?? 'Sistema',
        action:     'Editou',
        module:     'Despesas',
        targetName: `${existing.description} (${project?.name ?? ''})`,
        field:      'valor',
        oldValue:   formatBRL(existing.value),
        newValue:   formatBRL(updates.value),
      });
    }
  };

  const removeExpense = async (id: string): Promise<void> => {
    const expense = expenses.find(e => e.id === id);
    await api(`/gastos/${id}`, { method: 'DELETE' });
    setExpenses(prev => prev.filter(e => e.id !== id));
    if (expense) {
      const project = projectsRef.current.find(p => p.id === expense.obraId);
      pushAuditEntry({
        userId:     activeUserRef.current?.id ?? '',
        userName:   activeUserRef.current?.name ?? 'Sistema',
        action:     'Removeu',
        module:     'Despesas',
        targetName: `${expense.description} (${project?.name ?? ''})`,
      });
    }
  };

  // Documentos

  const attachDocument = async (docData: Omit<ProjectDocument, 'id' | 'createdAt'>): Promise<void> => {
    const res = await api<{ documento: ProjectDocument }>('/documentos', {
      method: 'POST',
      body: JSON.stringify(docData),
    });
    setDocuments(prev => [res.documento, ...prev]);
    const project = projectsRef.current.find(p => p.id === docData.obraId);
    pushNotification('info', `Novo documento "${docData.title}" adicionado à obra "${project?.name}"`, docData.obraId);
    pushAuditEntry({
      userId:     activeUserRef.current?.id ?? '',
      userName:   activeUserRef.current?.name ?? 'Sistema',
      action:     'Criou',
      module:     'Documentos',
      targetName: `${docData.title} (${project?.name ?? ''})`,
    });
  };

  const updateDocument = async (id: string, updates: Partial<ProjectDocument>): Promise<void> => {
    const existing = documents.find(d => d.id === id);
    const res = await api<{ documento: ProjectDocument }>(`/documentos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    setDocuments(prev => prev.map(d => d.id === id ? res.documento : d));
    if (existing) {
      const project = projectsRef.current.find(p => p.id === existing.obraId);
      pushAuditEntry({
        userId:     activeUserRef.current?.id ?? '',
        userName:   activeUserRef.current?.name ?? 'Sistema',
        action:     'Editou',
        module:     'Documentos',
        targetName: `${existing.title} (${project?.name ?? ''})`,
      });
    }
  };

  const removeDocument = async (id: string): Promise<void> => {
    const doc = documents.find(d => d.id === id);
    await api(`/documentos/${id}`, { method: 'DELETE' });
    setDocuments(prev => prev.filter(d => d.id !== id));
    if (doc) {
      const project = projectsRef.current.find(p => p.id === doc.obraId);
      pushAuditEntry({
        userId:     activeUserRef.current?.id ?? '',
        userName:   activeUserRef.current?.name ?? 'Sistema',
        action:     'Removeu',
        module:     'Documentos',
        targetName: `${doc.title} (${project?.name ?? ''})`,
      });
    }
  };

  // Notificações

  const markNotificationRead = async (id: string): Promise<void> => {
    try {
      await api(`/notifications/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ read: true }),
      });
      setSystemNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch { /* optimistic only */ }
  };

  const markAllNotificationsRead = async (): Promise<void> => {
    try {
      await api('/notifications/mark-all-read', { method: 'PUT', body: '{}' });
      setSystemNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch { /* optimistic only */ }
  };

  // Cálculos derivados

  // progresso da obra = média do progresso das etapas. Sem etapas, usa o progresso salvo na obra.
  const calculateProjectProgress = (projectId: string): number => {
    const projectStages = scheduleStages.filter(s => s.obraId === projectId);
    if (projectStages.length === 0) return projects.find(p => p.id === projectId)?.progress ?? 0;
    return Math.round(projectStages.reduce((sum, s) => sum + s.progress, 0) / projectStages.length);
  };

  // progresso esperado: quanto do prazo (do início ao término previsto) já passou, de 0 a 100.
  // Antes do início é 0 e depois do término é 100.
  const calculateExpectedProgress = (project: Project): number => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(project.startDate + 'T00:00:00');
    const end   = new Date(project.endDate   + 'T00:00:00');
    if (today <= start) return 0;
    if (today >= end)   return 100;
    return Math.round(((today.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100);
  };

  // a obra está "No Prazo" se o progresso real não ficou mais de 12 pontos abaixo do esperado.
  // Essa tolerância evita marcar como atrasada por uma diferença pequena.
  const getScheduleStatus = (project: Project): 'No Prazo' | 'Atrasada' => {
    const expected = calculateExpectedProgress(project);
    const actual   = calculateProjectProgress(project.id);
    return actual >= expected - 12 ? 'No Prazo' : 'Atrasada';
  };

  // soma dos gastos lançados na obra
  const calculateTotalExpenses = (projectId: string): number =>
    expenses.filter(e => e.obraId === projectId).reduce((sum, e) => sum + e.value, 0);

  // situação do documento pela data de validade: "Vencido" se já passou, "Vencendo" se faltam
  // 30 dias ou menos e "Válido" nos outros casos. Sem data de validade, vale o status digitado.
  const calculateDocumentStatus = useCallback((doc: ProjectDocument): DocumentValidityStatus => {
    if (!doc.expiryDate) return doc.status;
    const today  = new Date(); today.setHours(0, 0, 0, 0);
    const expiry = new Date(doc.expiryDate + 'T00:00:00');
    const days   = (expiry.getTime() - today.getTime()) / 86400000;
    if (days < 0)   return 'Vencido';
    if (days <= 30) return 'Vencendo';
    return 'Válido';
  }, []);

  // Previsão de prazo: média de dias por m² das obras concluídas, ajustada pela equipe,
  // pavimentos e complexidade da obra nova (mínimo de 30 dias). Soma o resultado à data de início.
  const estimateProjectCompletion = useCallback((params: {
    area: number;
    startDate: string;
    floors?: number;
    teamSize?: number;
    tipo?: ObraType;
    complexidade?: ObraComplexidade;
  }): DeadlinePrediction | null => {
    const { area, startDate, floors, teamSize, tipo, complexidade } = params;
    if (!area || area <= 0 || !startDate) return null;

    let completed = projects.filter(
      p => p.status === 'Concluída' && p.area && p.area > 0 && p.startDate && p.endDate
    );

    if (tipo) {
      const byTipo = completed.filter(p => p.tipo === tipo);
      if (byTipo.length > 0) completed = byTipo;
    }

    let baselineDaysPerSqm: number;
    let isFallback = false;
    const basedOn  = completed.length;

    if (completed.length > 0) {
      const rates = completed.map(p => {
        const duration = Math.max(1,
          (new Date(p.endDate + 'T00:00:00').getTime() - new Date(p.startDate + 'T00:00:00').getTime()) / 86400000
        );
        let rate = duration / p.area!;
        if (p.teamSize && p.teamSize > 0) rate = rate * (p.teamSize / 10);
        if (p.floors  && p.floors  > 1)  rate = rate / (1 + (p.floors - 1) * FLOOR_COMPLEXITY_FACTOR);
        return rate;
      });
      baselineDaysPerSqm = rates.reduce((s, r) => s + r, 0) / rates.length;
    } else {
      baselineDaysPerSqm = INDUSTRY_AVERAGE_DAYS_PER_SQM;
      isFallback = true;
    }

    const effectiveTeam = teamSize && teamSize > 0 ? teamSize : 10;
    let estimatedDays   = area * baselineDaysPerSqm * (10 / effectiveTeam);
    if (floors && floors > 1) estimatedDays = estimatedDays * (1 + (floors - 1) * FLOOR_COMPLEXITY_FACTOR);

    const complexityMult = complexidade ? (COMPLEXITY_FACTOR[complexidade] ?? 1.0) : 1.0;
    estimatedDays = estimatedDays * complexityMult;
    estimatedDays = Math.max(30, Math.round(estimatedDays));

    const endDate = new Date(startDate + 'T00:00:00');
    endDate.setDate(endDate.getDate() + estimatedDays);

    return {
      days:      estimatedDays,
      date:      endDate.toLocaleDateString('pt-BR'),
      dateISO:   endDate.toISOString().slice(0, 10),
      basedOn,
      isFallback,
    };
  }, [projects]);

  const countUnreadNotifications = (): number =>
    systemNotifications.filter(n => !n.read).length;

  // Valor do provider

  return (
    <ConstructionManagementContext.Provider value={{
      isInitializing,
      isSyncConnected,
      activeUser,
      pendingVerificationUser,
      login,
      verifyAccountCode,
      logout,
      teamMembers,
      registerTeamMember,
      updateTeamMember,
      removeTeamMember,
      projects,
      createProject,
      updateProject,
      removeProject,
      generateProjectAnalysis,
      scheduleStages,
      addScheduleStage,
      updateScheduleStage,
      removeScheduleStage,
      expenses,
      recordExpense,
      updateExpense,
      removeExpense,
      calculateTotalExpenses,
      documents,
      attachDocument,
      updateDocument,
      removeDocument,
      calculateDocumentStatus,
      systemNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      auditLog,
      calculateProjectProgress,
      calculateExpectedProgress,
      getScheduleStatus,
      countUnreadNotifications,
      estimateProjectCompletion,
    }}>
      {children}
    </ConstructionManagementContext.Provider>
  );
}

// Hook de uso

export function useConstructionManagement() {
  return useContext(ConstructionManagementContext);
}
