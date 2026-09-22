import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, ReactNode,
} from 'react';
import { toast } from 'sonner';

// ─── Domain Types ─────────────────────────────────────────────────────────────

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

// ─── Domain Entities ──────────────────────────────────────────────────────────

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

// ─── Auth Result ──────────────────────────────────────────────────────────────

interface AuthenticationResult {
  success: boolean;
  error?: string;
  needsVerification?: boolean;
}

// ─── Deadline Estimation ──────────────────────────────────────────────────────

interface DeadlinePrediction {
  days: number;
  date: string;
  dateISO: string;
  basedOn: number;
  isFallback: boolean;
}

// ─── Context Contract ─────────────────────────────────────────────────────────

interface ConstructionManagementContextType {
  isInitializing: boolean;
  isSyncConnected: boolean;

  activeUser: TeamMember | null;
  pendingVerificationUser: TeamMember | null;
  login: (email: string, password: string) => Promise<AuthenticationResult>;
  verifyAccountCode: (code: string) => Promise<boolean>;
  logout: () => void;

  teamMembers: TeamMember[];
  registerTeamMember: (member: Omit<TeamMember, 'id' | 'createdAt'>) => Promise<string>;
  updateTeamMember: (id: string, updates: Partial<TeamMember>) => Promise<void>;
  removeTeamMember: (id: string) => Promise<void>;

  projects: Project[];
  createProject: (project: Omit<Project, 'id' | 'createdAt'>) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  removeProject: (id: string) => Promise<void>;

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

// ─── API Client ───────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';

async function api<T = unknown>(
  path: string,
  opts?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const COMPLEXITY_FACTOR: Record<string, number> = { Baixa: 0.85, Média: 1.0, Alta: 1.25 };
const INDUSTRY_AVERAGE_DAYS_PER_SQM = 0.52;
const FLOOR_COMPLEXITY_FACTOR        = 0.08;

// ─── Context Default ──────────────────────────────────────────────────────────

const ConstructionManagementContext = createContext<ConstructionManagementContextType>({
  isInitializing: true,
  isSyncConnected: false,
  activeUser: null,
  pendingVerificationUser: null,
  login: async () => ({ success: false }),
  verifyAccountCode: async () => false,
  logout: () => {},
  teamMembers: [],
  registerTeamMember: async () => '',
  updateTeamMember: async () => {},
  removeTeamMember: async () => {},
  projects: [],
  createProject: async () => {},
  updateProject: async () => {},
  removeProject: async () => {},
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

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ConstructionManagementProvider({ children }: { children: ReactNode }) {

  const [isInitializing,    setIsInitializing]    = useState(true);
  const [isSyncConnected,   setIsSyncConnected]   = useState(false);

  const [activeUser, setActiveUser] = useState<TeamMember | null>(() => {
    try {
      const stored = localStorage.getItem('dp_current_user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const [pendingVerificationUser, setPendingVerificationUser] = useState<TeamMember | null>(null);
  const [teamMembers,    setTeamMembers]    = useState<TeamMember[]>([]);
  const [projects,       setProjects]       = useState<Project[]>([]);
  const [scheduleStages, setScheduleStages] = useState<ScheduleStage[]>([]);
  const [expenses,       setExpenses]       = useState<Expense[]>([]);
  const [documents,      setDocuments]      = useState<ProjectDocument[]>([]);
  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>([]);
  const [auditLog,       setAuditLog]       = useState<AuditEntry[]>([]);

  const activeUserRef    = useRef<TeamMember | null>(activeUser);
  const projectsRef      = useRef<Project[]>([]);
  const scheduleStagesRef = useRef<ScheduleStage[]>([]);

  useEffect(() => { activeUserRef.current = activeUser; }, [activeUser]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);
  useEffect(() => { scheduleStagesRef.current = scheduleStages; }, [scheduleStages]);

  useEffect(() => {
    if (activeUser) localStorage.setItem('dp_current_user', JSON.stringify(activeUser));
    else            localStorage.removeItem('dp_current_user');
  }, [activeUser]);

  // ── Bootstrap from API ────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
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

        setTeamMembers(data.users ?? []);
        setProjects(data.obras ?? []);
        setScheduleStages(data.stages ?? []);
        setSystemNotifications(data.notifications ?? []);
        setExpenses(data.gastos ?? []);
        setDocuments(data.documentos ?? []);
        setAuditLog(data.audit ?? []);

        const session = activeUserRef.current;
        if (session) {
          const fresh = (data.users ?? []).find(u => u.id === session.id);
          if (fresh) setActiveUser(fresh);
        }

        setIsSyncConnected(true);
      } catch (err) {
        console.error('Failed to load data from API:', err);
        setIsSyncConnected(false);
      } finally {
        setIsInitializing(false);
      }
    };
    load();
  }, []);

  // ── Internal: push notification via API ───────────────────────────────────────

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
      // If API fails, still show toast
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

  // ── Internal: push audit entry via API ───────────────────────────────────────

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

  // ── Internal: sync project progress ──────────────────────────────────────────

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

  // ── Auth ──────────────────────────────────────────────────────────────────────

  const login = async (email: string, password: string): Promise<AuthenticationResult> => {
    try {
      const res = await api<{ success?: boolean; error?: string; needsVerification?: boolean; user?: TeamMember }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
      );
      if (res.error) return { success: false, error: res.error };
      if (res.needsVerification && res.user) {
        setPendingVerificationUser(res.user);
        return { success: false, needsVerification: true };
      }
      if (res.success && res.user) {
        setActiveUser(res.user);
        return { success: true };
      }
      return { success: false, error: 'Erro desconhecido.' };
    } catch (err) {
      return { success: false, error: `Falha de conexão: ${err}` };
    }
  };

  const verifyAccountCode = async (code: string): Promise<boolean> => {
    if (!pendingVerificationUser) return false;
    try {
      const res = await api<{ success?: boolean; user?: TeamMember; error?: string }>(
        '/auth/verify',
        { method: 'POST', body: JSON.stringify({ userId: pendingVerificationUser.id, code }) },
      );
      if (res.success && res.user) {
        setActiveUser(res.user);
        setTeamMembers(prev => prev.map(u => u.id === res.user!.id ? res.user! : u));
        setPendingVerificationUser(null);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setActiveUser(null);
    setPendingVerificationUser(null);
  };

  // ── Team Members ──────────────────────────────────────────────────────────────

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

  // ── Projects ──────────────────────────────────────────────────────────────────

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
      const changedFields = (Object.keys(updates) as Array<keyof Project>).filter(
        k => !skipFields.has(k) && updates[k] !== existing[k]
      );
      for (const field of changedFields) {
        pushAuditEntry({
          userId:     activeUserRef.current.id,
          userName:   activeUserRef.current.name,
          action:     'Editou',
          module:     'Obras',
          targetName: existing.name,
          field:      String(field),
          oldValue:   String(existing[field] ?? ''),
          newValue:   String(updates[field] ?? ''),
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

  // ── Schedule Stages ───────────────────────────────────────────────────────────

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

  // ── Expenses ──────────────────────────────────────────────────────────────────

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

  // ── Documents ─────────────────────────────────────────────────────────────────

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

  // ── Notifications ─────────────────────────────────────────────────────────────

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

  // ── Computed Helpers ──────────────────────────────────────────────────────────

  const calculateProjectProgress = (projectId: string): number => {
    const projectStages = scheduleStages.filter(s => s.obraId === projectId);
    if (projectStages.length === 0) return projects.find(p => p.id === projectId)?.progress ?? 0;
    return Math.round(projectStages.reduce((sum, s) => sum + s.progress, 0) / projectStages.length);
  };

  const calculateExpectedProgress = (project: Project): number => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(project.startDate + 'T00:00:00');
    const end   = new Date(project.endDate   + 'T00:00:00');
    if (today <= start) return 0;
    if (today >= end)   return 100;
    return Math.round(((today.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100);
  };

  const getScheduleStatus = (project: Project): 'No Prazo' | 'Atrasada' => {
    const expected = calculateExpectedProgress(project);
    const actual   = calculateProjectProgress(project.id);
    return actual >= expected - 12 ? 'No Prazo' : 'Atrasada';
  };

  const calculateTotalExpenses = (projectId: string): number =>
    expenses.filter(e => e.obraId === projectId).reduce((sum, e) => sum + e.value, 0);

  const calculateDocumentStatus = useCallback((doc: ProjectDocument): DocumentValidityStatus => {
    if (!doc.expiryDate) return doc.status;
    const today  = new Date(); today.setHours(0, 0, 0, 0);
    const expiry = new Date(doc.expiryDate + 'T00:00:00');
    const days   = (expiry.getTime() - today.getTime()) / 86400000;
    if (days < 0)   return 'Vencido';
    if (days <= 30) return 'Vencendo';
    return 'Válido';
  }, []);

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

  // ── Provider Value ────────────────────────────────────────────────────────────

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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConstructionManagement() {
  return useContext(ConstructionManagementContext);
}
