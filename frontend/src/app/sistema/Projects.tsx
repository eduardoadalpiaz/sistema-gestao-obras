/**
 * Projects.tsx
 * Construction project management screen.
 * Handles creating, viewing, editing and deleting projects,
 * with automatic deadline prediction and dual-progress tracking.
 */
import { useState, useMemo } from 'react';
import { useConstructionManagement, Project, ObraType, ObraComplexidade } from '../context/construction-context';
import { useNavigate } from 'react-router';
import {
  Plus, Search, Eye, Pencil, Trash2, X, MapPin,
  Loader2, Calendar, DollarSign, Ruler, Lightbulb,
  Users, Layers, TrendingUp, ChevronRight, Sparkles, ExternalLink,
} from 'lucide-react';

const OBRA_TIPOS: ObraType[]        = ['Residencial', 'Comercial', 'Industrial', 'Misto'];
const OBRA_COMPLEXIDADES: ObraComplexidade[] = ['Baixa', 'Média', 'Alta'];

const COMPLEXIDADE_COLORS: Record<ObraComplexidade, string> = {
  Baixa: 'bg-green-100 text-green-700',
  Média: 'bg-yellow-100 text-yellow-700',
  Alta:  'bg-red-100 text-red-700',
};

// ─── Form Types ───────────────────────────────────────────────────────────────

type ProjectFormData = Omit<Project, 'id' | 'createdAt' | 'progress'>;

const EMPTY_PROJECT_FORM: ProjectFormData = {
  name: '', client: '', cep: '', street: '', neighborhood: '',
  city: '', state: '', responsibleId: '', status: 'Em andamento',
  startDate: '', endDate: '',
  area: undefined, floors: undefined, units: undefined, teamSize: undefined,
  estimatedCost: undefined, clientBudget: undefined,
  tipo: undefined, complexidade: undefined,
};

// Brazilian postal code mock for offline fallback
const POSTAL_CODE_MOCK: Record<string, Partial<ProjectFormData>> = {
  '95010001': { street: 'Rua Sinimbu', neighborhood: 'Centro', city: 'Caxias do Sul', state: 'RS' },
  '95010100': { street: 'Rua Os Dezoito do Forte', neighborhood: 'São Pelegrino', city: 'Caxias do Sul', state: 'RS' },
  '01310100': { street: 'Av. Paulista', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP' },
};

// ─── Helper Components ────────────────────────────────────────────────────────

const getProjectStatusBadgeClasses = (status: string) =>
  status === 'Em andamento' ? 'bg-green-100 text-green-700' :
  status === 'Concluída'    ? 'bg-blue-100 text-blue-700'   : 'bg-gray-100 text-gray-600';

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Dual progress bar showing actual progress (green) vs expected/planned progress (blue).
 * A red expected bar signals the project is behind schedule.
 */
function ProgressComparisonBar({
  actualProgress,
  expectedProgress,
}: {
  actualProgress: number;
  expectedProgress: number;
}) {
  const isOnSchedule = actualProgress >= expectedProgress - 12;
  return (
    <div className="min-w-[130px] space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-gray-400 w-14 shrink-0">Real</span>
        <div className="flex-1 bg-gray-100 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all bg-green-500"
            style={{ width: `${Math.min(100, actualProgress)}%` }}
          />
        </div>
        <span className="text-xs font-bold text-gray-700 w-7 text-right">{actualProgress}%</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-gray-400 w-14 shrink-0">Planejado</span>
        <div className="flex-1 bg-gray-100 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all bg-blue-300"
            style={{ width: `${Math.min(100, expectedProgress)}%` }}
          />
        </div>
        <span className={`text-xs font-bold w-7 text-right ${isOnSchedule ? 'text-blue-500' : 'text-red-500'}`}>
          {expectedProgress}%
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Projects() {
  const {
    projects, teamMembers, createProject, updateProject, removeProject,
    getScheduleStatus, calculateExpectedProgress, calculateProjectProgress,
    calculateTotalExpenses, estimateProjectCompletion, activeUser,
  } = useConstructionManagement();

  const navigate = useNavigate();

  const [searchQuery,      setSearchQuery]      = useState('');
  const [statusFilter,     setStatusFilter]     = useState('Todos os Status');
  const [activeModal,      setActiveModal]      = useState<'add' | 'edit' | 'view' | 'delete' | null>(null);
  const [selectedProject,  setSelectedProject]  = useState<Project | null>(null);
  const [projectForm,      setProjectForm]      = useState<ProjectFormData>(EMPTY_PROJECT_FORM);
  const [isLookingUpPostalCode, setIsLookingUpPostalCode] = useState(false);
  const [postalCodeError,  setPostalCodeError]  = useState('');

  const canEditProjects = activeUser?.role === 'Administrativo' || activeUser?.role === 'Engenheiro';

  // ── Filtered project list ────────────────────────────────────────────────────

  const filteredProjects = projects.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.client.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'Todos os Status' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // ── Deadline prediction — re-computes when relevant form fields change ───────

  const deadlinePrediction = useMemo(() => {
    if (!projectForm.area || !projectForm.startDate) return null;
    return estimateProjectCompletion({
      area:        projectForm.area,
      startDate:   projectForm.startDate,
      floors:      projectForm.floors,
      teamSize:    projectForm.teamSize,
      tipo:        projectForm.tipo,
      complexidade: projectForm.complexidade,
    });
  }, [projectForm.area, projectForm.startDate, projectForm.floors, projectForm.teamSize, projectForm.tipo, projectForm.complexidade, estimateProjectCompletion]);

  // ── Modal openers ────────────────────────────────────────────────────────────

  const openAddModal = () => {
    setProjectForm(EMPTY_PROJECT_FORM);
    setActiveModal('add');
    setPostalCodeError('');
  };

  const openEditModal = (project: Project) => {
    setSelectedProject(project);
    setProjectForm({
      name: project.name, client: project.client, cep: project.cep,
      street: project.street, neighborhood: project.neighborhood,
      city: project.city, state: project.state,
      responsibleId: project.responsibleId, status: project.status,
      startDate: project.startDate, endDate: project.endDate,
      area: project.area, floors: project.floors, units: project.units,
      teamSize: project.teamSize, estimatedCost: project.estimatedCost,
      clientBudget: project.clientBudget,
      tipo: project.tipo, complexidade: project.complexidade,
    });
    setActiveModal('edit');
    setPostalCodeError('');
  };

  const openViewModal   = (project: Project) => { setSelectedProject(project); setActiveModal('view'); };
  const openDeleteModal = (project: Project) => { setSelectedProject(project); setActiveModal('delete'); };
  const closeModal      = () => { setActiveModal(null); setSelectedProject(null); };

  const navigateToSchedule = (projectId: string) => navigate(`/cronograma?obraId=${projectId}`);

  // ── Brazilian postal code lookup (via ViaCEP API) ────────────────────────────

  const lookupPostalCode = async (rawPostalCode: string) => {
    const digits = rawPostalCode.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setIsLookingUpPostalCode(true);
    setPostalCodeError('');
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) {
        const fallback = POSTAL_CODE_MOCK[digits];
        if (fallback) setProjectForm(prev => ({ ...prev, ...fallback }));
        else setPostalCodeError('CEP não encontrado.');
      } else {
        setProjectForm(prev => ({
          ...prev,
          street:       data.logradouro || prev.street,
          neighborhood: data.bairro     || prev.neighborhood,
          city:         data.localidade || prev.city,
          state:        data.uf         || prev.state,
        }));
      }
    } catch {
      const fallback = POSTAL_CODE_MOCK[digits];
      if (fallback) setProjectForm(prev => ({ ...prev, ...fallback }));
      else setPostalCodeError('Erro ao buscar CEP.');
    }
    setIsLookingUpPostalCode(false);
  };

  // ── Form field handler ───────────────────────────────────────────────────────

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (['area', 'floors', 'units', 'teamSize', 'estimatedCost', 'clientBudget'].includes(name)) {
      setProjectForm(prev => ({ ...prev, [name]: value === '' ? undefined : Number(value) }));
      return;
    }
    if (name === 'tipo') {
      setProjectForm(prev => ({ ...prev, tipo: value === '' ? undefined : value as ObraType }));
      return;
    }
    if (name === 'complexidade') {
      setProjectForm(prev => ({ ...prev, complexidade: value === '' ? undefined : value as ObraComplexidade }));
      return;
    }
    setProjectForm(prev => ({ ...prev, [name]: value }));
    if (name === 'cep') {
      const digits = value.replace(/\D/g, '');
      if (digits.length === 8) lookupPostalCode(digits);
    }
  };

  const applyEstimatedDeadline = () => {
    if (deadlinePrediction) {
      setProjectForm(prev => ({ ...prev, endDate: deadlinePrediction.dateISO }));
    }
  };

  // ── Form submit ──────────────────────────────────────────────────────────────

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeModal === 'add') {
      await createProject({ ...projectForm, progress: 0 });
    } else if (activeModal === 'edit' && selectedProject) {
      await updateProject(selectedProject.id, projectForm);
    }
    closeModal();
  };

  const handleProjectDelete = async () => {
    if (selectedProject) await removeProject(selectedProject.id);
    closeModal();
  };

  const resolveResponsibleName = (id: string) =>
    teamMembers.find(m => m.id === id)?.name ?? '—';

  // ── Input CSS helpers ────────────────────────────────────────────────────────

  const baseInputClass       = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#E8821A] transition';
  const highlightedInputClass = 'w-full border border-[#E8821A] bg-orange-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#d4731a] transition';

  return (
    <div className="space-y-5">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#1a2332]">Gestão de Obras</h1>
          <p className="text-gray-500 text-sm">Gerencie todas as obras em andamento</p>
        </div>
        {canEditProjects && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-[#E8821A] text-white font-bold px-5 py-2.5 rounded-xl hover:bg-[#d4731a] transition text-sm"
          >
            <Plus size={16} /> Nova Obra
          </button>
        )}
      </div>

      {/* ── Search & Filter Bar ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou cliente..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#E8821A] transition"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#E8821A] transition bg-white"
        >
          <option>Todos os Status</option>
          <option>Em andamento</option>
          <option>Concluída</option>
          <option>Paralisada</option>
        </select>
      </div>

      {/* ── Desktop Table ─────────────────────────────────────────────────────── */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-gray-500 font-semibold px-6 py-4">Nome da Obra</th>
              <th className="text-left text-gray-500 font-semibold px-4 py-4">Cliente</th>
              <th className="text-left text-gray-500 font-semibold px-4 py-4">Status</th>
              <th className="text-left text-gray-500 font-semibold px-4 py-4">Progresso</th>
              <th className="text-left text-gray-500 font-semibold px-4 py-4">Previsão</th>
              <th className="text-left text-gray-500 font-semibold px-4 py-4">Situação</th>
              <th className="text-left text-gray-500 font-semibold px-4 py-4">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredProjects.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  Nenhuma obra encontrada
                </td>
              </tr>
            ) : filteredProjects.map(project => {
              const scheduleStatus     = getScheduleStatus(project);
              const actualProgress     = calculateProjectProgress(project.id);
              const expectedProgress   = calculateExpectedProgress(project);
              return (
                <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-[#1a2332]">{project.name}</div>
                    <div className="text-gray-400 text-xs mt-0.5">
                      {resolveResponsibleName(project.responsibleId)}
                    </div>
                    {project.floors && project.teamSize && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-300 flex items-center gap-0.5">
                          <Layers size={10} /> {project.floors}pav
                        </span>
                        <span className="text-[10px] text-gray-300 flex items-center gap-0.5">
                          <Users size={10} /> {project.teamSize} pess.
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-gray-600">{project.client}</td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getProjectStatusBadgeClasses(project.status)}`}>
                      {project.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <ProgressComparisonBar
                      actualProgress={actualProgress}
                      expectedProgress={expectedProgress}
                    />
                  </td>
                  <td className="px-4 py-4 text-gray-600 text-xs">
                    {new Date(project.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-bold ${scheduleStatus === 'No Prazo' ? 'text-green-600' : 'text-red-600'}`}>
                      {scheduleStatus}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openViewModal(project)} className="text-blue-500 hover:text-blue-700 transition" title="Ver">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => navigateToSchedule(project.id)} className="text-purple-500 hover:text-purple-700 transition" title="Cronograma">
                        <Calendar size={16} />
                      </button>
                      {canEditProjects && (
                        <>
                          <button onClick={() => openEditModal(project)} className="text-orange-500 hover:text-orange-700 transition" title="Editar">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => openDeleteModal(project)} className="text-red-500 hover:text-red-700 transition" title="Excluir">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Mobile Cards ──────────────────────────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {filteredProjects.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-400 border border-gray-100 shadow-sm">
            Nenhuma obra encontrada
          </div>
        ) : filteredProjects.map(project => {
          const scheduleStatus   = getScheduleStatus(project);
          const actualProgress   = calculateProjectProgress(project.id);
          const expectedProgress = calculateExpectedProgress(project);
          return (
            <div key={project.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 mr-3">
                  <div className="font-bold text-[#1a2332] truncate">{project.name}</div>
                  <div className="text-gray-400 text-xs mt-0.5">
                    {resolveResponsibleName(project.responsibleId)}
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${getProjectStatusBadgeClasses(project.status)}`}>
                  {project.status}
                </span>
              </div>
              <div className="text-gray-600 text-sm mb-3">{project.client}</div>
              <ProgressComparisonBar actualProgress={actualProgress} expectedProgress={expectedProgress} />
              <div className="flex items-center justify-between text-xs mt-3">
                <div className="text-gray-400">
                  Término: <span className="font-semibold text-gray-600">
                    {new Date(project.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <span className={`font-bold ${scheduleStatus === 'No Prazo' ? 'text-green-600' : 'text-red-600'}`}>
                  {scheduleStatus}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                <button onClick={() => openViewModal(project)} className="flex items-center gap-1.5 text-blue-500 text-xs font-semibold hover:text-blue-700 transition">
                  <Eye size={14} /> Ver
                </button>
                <button onClick={() => navigateToSchedule(project.id)} className="flex items-center gap-1.5 text-purple-500 text-xs font-semibold hover:text-purple-700 transition">
                  <Calendar size={14} /> Cronograma
                </button>
                {canEditProjects && (
                  <>
                    <button onClick={() => openEditModal(project)} className="flex items-center gap-1.5 text-orange-500 text-xs font-semibold hover:text-orange-700 transition">
                      <Pencil size={14} /> Editar
                    </button>
                    <button onClick={() => openDeleteModal(project)} className="flex items-center gap-1.5 text-red-500 text-xs font-semibold hover:text-red-700 transition ml-auto">
                      <Trash2 size={14} /> Excluir
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Add / Edit Modal ──────────────────────────────────────────────────── */}
      {(activeModal === 'add' || activeModal === 'edit') && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl my-8 p-7 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-[#1a2332]">
                {activeModal === 'add' ? 'Nova Obra' : 'Editar Obra'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-5">

              {/* Identification */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Identificação</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nome da Obra *</label>
                    <input name="name" value={projectForm.name} onChange={handleFieldChange} required className={baseInputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Cliente *</label>
                    <input name="client" value={projectForm.client} onChange={handleFieldChange} required className={baseInputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Responsável Técnico *</label>
                    <select name="responsibleId" value={projectForm.responsibleId} onChange={handleFieldChange} required className={baseInputClass + ' bg-white'}>
                      <option value="">Selecione...</option>
                      {teamMembers
                        .filter(m => m.status === 'Ativo' && (m.role === 'Engenheiro' || m.role === 'Mestre de Obras' || m.role === 'Administrativo'))
                        .map(m => (
                          <option key={m.id} value={m.id}>{m.name} — {m.role}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                    <select name="status" value={projectForm.status} onChange={handleFieldChange} className={baseInputClass + ' bg-white'}>
                      <option>Em andamento</option>
                      <option>Concluída</option>
                      <option>Paralisada</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Endereço</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">CEP *</label>
                    <div className="relative">
                      <input name="cep" value={projectForm.cep} onChange={handleFieldChange} required placeholder="00000-000" className={baseInputClass + ' pr-8'} />
                      {isLookingUpPostalCode && (
                        <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#E8821A]" />
                      )}
                    </div>
                    {postalCodeError && <p className="text-red-500 text-xs mt-1">{postalCodeError}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Rua *</label>
                    <input name="street" value={projectForm.street} onChange={handleFieldChange} required className={baseInputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Bairro *</label>
                    <input name="neighborhood" value={projectForm.neighborhood} onChange={handleFieldChange} required className={baseInputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Cidade *</label>
                    <input name="city" value={projectForm.city} onChange={handleFieldChange} required className={baseInputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Estado *</label>
                    <input name="state" value={projectForm.state} onChange={handleFieldChange} required className={baseInputClass} />
                  </div>
                </div>
              </div>

              {/* Tipo e Complexidade */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Classificação da Obra</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo de Obra</label>
                    <select name="tipo" value={projectForm.tipo ?? ''} onChange={handleFieldChange} className={highlightedInputClass + ' bg-white'}>
                      <option value="">Selecione...</option>
                      {OBRA_TIPOS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nível de Complexidade</label>
                    <select name="complexidade" value={projectForm.complexidade ?? ''} onChange={handleFieldChange} className={highlightedInputClass + ' bg-white'}>
                      <option value="">Selecione...</option>
                      {OBRA_COMPLEXIDADES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Technical characteristics — inputs for the prediction engine */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Características Técnicas
                  <span className="ml-2 text-[#E8821A] normal-case font-normal">(usadas para calcular prazo estimado)</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                      <Ruler size={13} className="text-[#E8821A]" /> Área (m²)
                    </label>
                    <input type="number" name="area" value={projectForm.area ?? ''} onChange={handleFieldChange}
                      min={0} placeholder="Ex: 1500" className={highlightedInputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                      <Layers size={13} className="text-[#E8821A]" /> Pavimentos
                    </label>
                    <input type="number" name="floors" value={projectForm.floors ?? ''} onChange={handleFieldChange}
                      min={1} placeholder="Ex: 4" className={highlightedInputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Unidades</label>
                    <input type="number" name="units" value={projectForm.units ?? ''} onChange={handleFieldChange}
                      min={1} placeholder="Ex: 24" className={baseInputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                      <Users size={13} className="text-[#E8821A]" /> Equipe
                    </label>
                    <input type="number" name="teamSize" value={projectForm.teamSize ?? ''} onChange={handleFieldChange}
                      min={1} placeholder="Ex: 12" className={highlightedInputClass} />
                  </div>
                </div>
              </div>

              {/* Timeline with deadline prediction */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Prazo</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Data de Início *</label>
                    <input type="date" name="startDate" value={projectForm.startDate} onChange={handleFieldChange} required className={baseInputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Data Prevista de Término *</label>
                    <input type="date" name="endDate" value={projectForm.endDate} onChange={handleFieldChange} required className={baseInputClass} />
                  </div>
                </div>

                {/* Deadline prediction card */}
                {deadlinePrediction && (
                  <div className="mt-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles size={16} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-blue-800">
                          Sugestão de Prazo
                          {deadlinePrediction.isFallback && (
                            <span className="ml-2 text-[10px] font-semibold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                              Média da indústria
                            </span>
                          )}
                        </p>
                        <p className="text-blue-700 text-sm font-semibold mt-0.5">
                          {deadlinePrediction.date}
                          <span className="font-normal text-blue-500 ml-1">
                            ({deadlinePrediction.days} dias)
                          </span>
                        </p>
                        <p className="text-blue-500 text-xs mt-0.5">
                          {deadlinePrediction.isFallback
                            ? 'Baseado na média da construção civil brasileira (~0,52 dias/m²)'
                            : `Baseado em ${deadlinePrediction.basedOn} obra${deadlinePrediction.basedOn > 1 ? 's' : ''} concluída${deadlinePrediction.basedOn > 1 ? 's' : ''}`}
                          {projectForm.area      ? ` · ${projectForm.area} m²`     : ''}
                          {projectForm.floors    ? ` · ${projectForm.floors} pav.`  : ''}
                          {projectForm.teamSize  ? ` · ${projectForm.teamSize} pess.` : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={applyEstimatedDeadline}
                      className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-blue-700 transition shrink-0"
                    >
                      Usar esta data <ChevronRight size={13} />
                    </button>
                  </div>
                )}

                {!deadlinePrediction && projectForm.area && projectForm.startDate && (
                  <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-2 text-gray-400 text-xs">
                    <Lightbulb size={14} />
                    Preencha Área e Data de Início para ver a sugestão de prazo.
                  </div>
                )}
              </div>

              {/* Budget */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Financeiro</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                      <DollarSign size={13} className="text-[#E8821A]" /> Custo Estimado pela Empresa (R$)
                    </label>
                    <input type="number" name="estimatedCost" value={projectForm.estimatedCost ?? ''} onChange={handleFieldChange}
                      min={0} placeholder="Ex: 500000" className={highlightedInputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                      <DollarSign size={13} className="text-gray-400" /> Valor Disponível do Cliente (R$)
                    </label>
                    <input type="number" name="clientBudget" value={projectForm.clientBudget ?? ''} onChange={handleFieldChange}
                      min={0} placeholder="Ex: 450000" className={baseInputClass} />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal}
                  className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 bg-[#E8821A] text-white font-bold py-2.5 rounded-xl hover:bg-[#d4731a] transition text-sm">
                  {activeModal === 'add' ? 'Adicionar Obra' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── View Modal ────────────────────────────────────────────────────────── */}
      {activeModal === 'view' && selectedProject && (() => {
        const actualProgress   = calculateProjectProgress(selectedProject.id);
        const expectedProgress = calculateExpectedProgress(selectedProject);
        const progressDelta    = actualProgress - expectedProgress;
        const totalExpenses    = calculateTotalExpenses(selectedProject.id);
        const prediction = selectedProject.area && selectedProject.startDate
          ? estimateProjectCompletion({
              area:      selectedProject.area,
              startDate: selectedProject.startDate,
              floors:    selectedProject.floors,
              teamSize:  selectedProject.teamSize,
            })
          : null;

        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-lg my-8 p-7 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-[#1a2332]">Detalhes da Obra</h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>

              {/* Progress overview on dark background */}
              <div className="bg-[#1a2332] rounded-2xl p-4 space-y-3 mb-4">
                <p className="text-white font-bold text-sm">{selectedProject.name}</p>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Progresso Real</span>
                      <span className="text-white font-bold">{actualProgress}%</span>
                    </div>
                    <div className="h-2.5 bg-white/10 rounded-full">
                      <div className="h-2.5 rounded-full bg-green-400 transition-all" style={{ width: `${Math.min(100, actualProgress)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Progresso Planejado (hoje)</span>
                      <span className={`font-bold ${progressDelta >= -12 ? 'text-blue-300' : 'text-red-400'}`}>
                        {expectedProgress}%
                      </span>
                    </div>
                    <div className="h-2.5 bg-white/10 rounded-full">
                      <div
                        className={`h-2.5 rounded-full transition-all ${progressDelta >= -12 ? 'bg-blue-400' : 'bg-red-400'}`}
                        style={{ width: `${Math.min(100, expectedProgress)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className={`text-xs font-bold flex items-center gap-1.5 pt-1 ${progressDelta >= -12 ? 'text-green-400' : 'text-red-400'}`}>
                  <TrendingUp size={13} />
                  {progressDelta >= 0
                    ? `${progressDelta}pp adiantada em relação ao planejado`
                    : `${Math.abs(progressDelta)}pp abaixo do planejado`}
                  {progressDelta < -12 && ' ⚠️ Atenção'}
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                {[
                  { label: 'Status',           value: selectedProject.status },
                  { label: 'Situação',         value: getScheduleStatus(selectedProject) },
                  { label: 'Início',           value: new Date(selectedProject.startDate + 'T12:00:00').toLocaleDateString('pt-BR') },
                  { label: 'Término previsto', value: new Date(selectedProject.endDate   + 'T12:00:00').toLocaleDateString('pt-BR') },
                  { label: 'Cliente',          value: selectedProject.client },
                  { label: 'Responsável',      value: resolveResponsibleName(selectedProject.responsibleId) },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                    <div className="text-gray-400 text-xs">{item.label}</div>
                    <div className="font-semibold text-[#1a2332] text-sm">{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Technical specs */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-gray-400 text-xs mb-1 flex items-center gap-1"><Ruler size={11} /> Área</div>
                  <div className="font-semibold text-[#1a2332] text-sm">
                    {selectedProject.area ? `${selectedProject.area.toLocaleString('pt-BR')} m²` : '—'}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-gray-400 text-xs mb-1 flex items-center gap-1"><Layers size={11} /> Pavimentos</div>
                  <div className="font-semibold text-[#1a2332] text-sm">{selectedProject.floors ?? '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-gray-400 text-xs mb-1 flex items-center gap-1"><Users size={11} /> Equipe</div>
                  <div className="font-semibold text-[#1a2332] text-sm">
                    {selectedProject.teamSize ? `${selectedProject.teamSize} pess.` : '—'}
                  </div>
                </div>
              </div>

              {/* Tipo e Complexidade */}
              {(selectedProject.tipo || selectedProject.complexidade) && (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {selectedProject.tipo && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="text-gray-400 text-xs mb-1">Tipo de Obra</div>
                      <div className="font-semibold text-[#1a2332] text-sm">{selectedProject.tipo}</div>
                    </div>
                  )}
                  {selectedProject.complexidade && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="text-gray-400 text-xs mb-1">Complexidade</div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${COMPLEXIDADE_COLORS[selectedProject.complexidade]}`}>
                        {selectedProject.complexidade}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Address */}
              <div className="bg-gray-50 rounded-xl p-3 mb-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-gray-400 text-xs flex items-center gap-1"><MapPin size={12} /> Endereço</div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedProject.street}, ${selectedProject.neighborhood}, ${selectedProject.city}, ${selectedProject.state}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 font-semibold transition"
                  >
                    <ExternalLink size={11} /> Abrir no Google Maps
                  </a>
                </div>
                <div className="font-semibold text-[#1a2332] text-sm mb-3">
                  {selectedProject.street}, {selectedProject.neighborhood} – {selectedProject.city}/{selectedProject.state} · CEP {selectedProject.cep}
                </div>
                {/* Mapa embutido: mostra a localização sem sair do sistema.
                    Usa o embed público do Google Maps (sem chave de API). */}
                {(selectedProject.street || selectedProject.city) && (
                  <div className="rounded-lg overflow-hidden border border-gray-200">
                    <iframe
                      title={`Mapa de ${selectedProject.name}`}
                      width="100%"
                      height="200"
                      style={{ border: 0, display: 'block' }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://www.google.com/maps?q=${encodeURIComponent(`${selectedProject.street}, ${selectedProject.neighborhood}, ${selectedProject.city}, ${selectedProject.state}`)}&output=embed`}
                    />
                  </div>
                )}
              </div>

              {/* Budget vs Actual */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                  <div className="text-orange-400 text-xs mb-1 flex items-center gap-1"><DollarSign size={12} /> Orçamento Estimado</div>
                  <div className="font-bold text-[#1a2332] text-sm">
                    {selectedProject.estimatedCost ? formatCurrency(selectedProject.estimatedCost) : '—'}
                  </div>
                </div>
                <div className={`rounded-xl p-3 border ${totalExpenses > (selectedProject.estimatedCost ?? Infinity) ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                  <div className="text-gray-400 text-xs mb-1 flex items-center gap-1"><DollarSign size={12} /> Gasto Real</div>
                  <div className={`font-bold text-sm ${totalExpenses > (selectedProject.estimatedCost ?? Infinity) ? 'text-red-600' : 'text-green-700'}`}>
                    {formatCurrency(totalExpenses)}
                  </div>
                </div>
              </div>

              {/* AI deadline prediction */}
              {prediction && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3">
                  <div className="text-blue-400 text-xs mb-1 flex items-center gap-1">
                    <Sparkles size={12} /> Prazo estimado pelo sistema
                  </div>
                  <div className="font-bold text-[#1a2332] text-sm">
                    {prediction.date}
                    <span className="text-gray-400 font-normal text-xs ml-1">
                      ({prediction.days} dias · {prediction.basedOn} obra{prediction.basedOn !== 1 ? 's' : ''} analisada{prediction.basedOn !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>
              )}

              <button onClick={closeModal}
                className="w-full mt-2 bg-[#1a2332] text-white font-bold py-2.5 rounded-xl hover:bg-[#243347] transition text-sm">
                Fechar
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Delete Confirmation Modal ─────────────────────────────────────────── */}
      {activeModal === 'delete' && selectedProject && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-sm p-7 shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h2 className="text-xl font-black text-[#1a2332] mb-2">Excluir Obra</h2>
            <p className="text-gray-500 text-sm mb-6">
              Tem certeza que deseja excluir <strong>"{selectedProject.name}"</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button onClick={closeModal}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">
                Cancelar
              </button>
              <button onClick={handleProjectDelete}
                className="flex-1 bg-red-500 text-white font-bold py-2.5 rounded-xl hover:bg-red-600 transition text-sm">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
