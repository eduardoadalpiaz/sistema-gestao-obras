/**
 * ProjectSchedule.tsx
 * Construction timeline screen — tracks each phase of a project,
 * including planned vs actual dates and stage-level progress.
 */
import { useState, useEffect } from 'react';
import { useConstructionManagement, ScheduleStage } from '../context/construction-context';
import { useSearchParams } from 'react-router';
import { Plus, X, CheckCircle2, Clock, AlertTriangle, Circle, Pencil, Trash2 } from 'lucide-react';

const STAGE_STATUS_OPTIONS = ['Não iniciada', 'Em andamento', 'Concluída', 'Atrasada'] as const;

const EMPTY_STAGE_FORM = {
  name: '',
  plannedStart: '',
  plannedEnd: '',
  actualEnd: '',
  progress: 0,
  status: 'Não iniciada' as ScheduleStage['status'],
  responsibleId: '',
  notes: '',
};

export function ProjectSchedule() {
  const {
    projects, scheduleStages, teamMembers,
    addScheduleStage, updateScheduleStage, removeScheduleStage, activeUser,
  } = useConstructionManagement();

  const [searchParams]    = useSearchParams();
  // Support ?obraId=xxx for direct navigation from the Projects screen
  const projectIdParam    = searchParams.get('obraId');

  const [selectedProjectId, setSelectedProjectId] = useState(() =>
    projectIdParam || projects[0]?.id || ''
  );

  // Sync when projects load after component mount
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Apply URL param when it changes
  useEffect(() => {
    if (projectIdParam && projects.find(p => p.id === projectIdParam)) {
      setSelectedProjectId(projectIdParam);
    }
  }, [projectIdParam, projects]);

  const [activeModal,    setActiveModal]    = useState<'add' | 'edit' | null>(null);
  const [editingStage,   setEditingStage]   = useState<ScheduleStage | null>(null);
  const [stageForm,      setStageForm]      = useState(EMPTY_STAGE_FORM);
  const [stagePendingDeleteId, setStagePendingDeleteId] = useState<string | null>(null);

  const canEditSchedule =
    activeUser?.role === 'Administrativo' ||
    activeUser?.role === 'Engenheiro' ||
    activeUser?.role === 'Mestre de Obras';

  // ── Derived data ─────────────────────────────────────────────────────────────

  const selectedProject   = projects.find(p => p.id === selectedProjectId);
  const projectStageList  = scheduleStages.filter(s => s.obraId === selectedProjectId);
  const overallProjectProgress = projectStageList.length > 0
    ? Math.round(projectStageList.reduce((sum, s) => sum + s.progress, 0) / projectStageList.length)
    : (selectedProject?.progress ?? 0);
  const projectResponsible = teamMembers.find(m => m.id === selectedProject?.responsibleId);

  const resolveTeamMemberName = (id: string) =>
    teamMembers.find(m => m.id === id)?.name ?? '—';

  // ── Modal handlers ────────────────────────────────────────────────────────────

  const openAddStageModal = () => {
    setStageForm({ ...EMPTY_STAGE_FORM });
    setEditingStage(null);
    setActiveModal('add');
  };

  const openEditStageModal = (stage: ScheduleStage) => {
    setEditingStage(stage);
    setStageForm({
      name:            stage.name,
      plannedStart:    stage.plannedStart,
      plannedEnd:      stage.plannedEnd,
      actualEnd:       stage.actualEnd ?? '',
      progress:        stage.progress,
      status:          stage.status,
      responsibleId:   stage.responsibleId,
      notes:           stage.notes ?? '',
    });
    setActiveModal('edit');
  };

  const closeModal = () => { setActiveModal(null); setEditingStage(null); };

  const handleStageFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setStageForm(prev => ({
      ...prev,
      [name]: name === 'progress' ? Math.min(100, Math.max(0, Number(value))) : value,
    }));
  };

  const handleStageFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeModal === 'add') {
      await addScheduleStage({
        obraId:        selectedProjectId,
        name:          stageForm.name,
        plannedStart:  stageForm.plannedStart,
        plannedEnd:    stageForm.plannedEnd,
        actualEnd:     stageForm.actualEnd || undefined,
        progress:      stageForm.progress,
        status:        stageForm.status,
        responsibleId: stageForm.responsibleId,
        notes:         stageForm.notes,
      });
    } else if (activeModal === 'edit' && editingStage) {
      await updateScheduleStage(editingStage.id, {
        name:          stageForm.name,
        plannedStart:  stageForm.plannedStart,
        plannedEnd:    stageForm.plannedEnd,
        actualEnd:     stageForm.actualEnd || undefined,
        progress:      stageForm.progress,
        status:        stageForm.status,
        responsibleId: stageForm.responsibleId,
        notes:         stageForm.notes,
      });
    }
    closeModal();
  };

  const handleStageDelete = async (id: string) => {
    await removeScheduleStage(id);
    setStagePendingDeleteId(null);
  };

  // ── Visual helpers ────────────────────────────────────────────────────────────

  const getStageStatusIcon = (status: ScheduleStage['status']) => {
    if (status === 'Concluída')    return <CheckCircle2 size={24} className="text-green-500" />;
    if (status === 'Em andamento') return <Clock        size={24} className="text-blue-500" />;
    if (status === 'Atrasada')     return <AlertTriangle size={24} className="text-red-500" />;
    return <Circle size={24} className="text-gray-300" />;
  };

  const getStageStatusBadgeClasses = (status: ScheduleStage['status']) => {
    if (status === 'Concluída')    return 'bg-green-100 text-green-700';
    if (status === 'Em andamento') return 'bg-blue-100 text-blue-700';
    if (status === 'Atrasada')     return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-500';
  };

  /** Returns a human-readable schedule deviation label for completed or delayed stages. */
  const getScheduleDeviationLabel = (stage: ScheduleStage) => {
    if (stage.status === 'Concluída' && stage.actualEnd && stage.plannedEnd) {
      const actualDate  = new Date(stage.actualEnd);
      const plannedDate = new Date(stage.plannedEnd);
      const deviation   = Math.round(
        (actualDate.getTime() - plannedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (deviation < 0) return { text: `Adiantou ${Math.abs(deviation)} dias`, color: 'text-green-600' };
      if (deviation > 0) return { text: `Atrasou ${deviation} dias`,            color: 'text-red-600' };
      return { text: 'No prazo', color: 'text-gray-500' };
    }
    if (stage.status === 'Atrasada') {
      const today      = new Date();
      const plannedEnd = new Date(stage.plannedEnd);
      const daysLate   = Math.max(0, Math.round(
        (today.getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24)
      ));
      return { text: `Atrasada ${daysLate} dias`, color: 'text-red-600' };
    }
    return null;
  };

  const sharedInputClass =
    'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 transition';

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-black text-[#1a2332]">Cronograma</h1>
        <p className="text-gray-500 text-sm">Acompanhe o progresso de cada etapa das obras</p>
      </div>

      {/* Project selector */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Selecione a Obra</label>
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 transition bg-white"
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {canEditSchedule && (
          <button
            onClick={openAddStageModal}
            className="flex items-center gap-2 bg-[#E8821A] text-white font-bold px-5 py-2.5 rounded-xl hover:bg-[#d4731a] transition text-sm whitespace-nowrap"
          >
            <Plus size={16} /> Adicionar Etapa
          </button>
        )}
      </div>

      {/* Project summary banner */}
      {selectedProject && (
        <div className="bg-blue-600 rounded-2xl p-5 text-white">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-blue-200 text-xs mb-1">Cliente</div>
              <div className="font-bold">{selectedProject.client}</div>
            </div>
            <div>
              <div className="text-blue-200 text-xs mb-1">Responsável</div>
              <div className="font-bold">{projectResponsible?.name ?? '—'}</div>
            </div>
            <div>
              <div className="text-blue-200 text-xs mb-1">Progresso Geral</div>
              <div className="font-bold text-xl">{overallProjectProgress}%</div>
            </div>
            <div>
              <div className="text-blue-200 text-xs mb-1">Data Prevista</div>
              <div className="font-bold">
                {new Date(selectedProject.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="bg-blue-500/50 rounded-full h-2">
              <div className="h-2 rounded-full bg-white transition-all" style={{ width: `${overallProjectProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Construction timeline */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-black text-[#1a2332] text-lg mb-6">Linha do Tempo</h2>

        {projectStageList.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Clock size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-semibold">Nenhuma etapa cadastrada</p>
            {canEditSchedule && (
              <button onClick={openAddStageModal} className="mt-3 text-blue-600 text-sm font-semibold hover:underline">
                + Adicionar primeira etapa
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {projectStageList.map((stage, index) => {
              const deviationLabel = getScheduleDeviationLabel(stage);
              return (
                <div key={stage.id} className="flex gap-5">
                  {/* Timeline spine */}
                  <div className="flex flex-col items-center">
                    <div className="shrink-0">{getStageStatusIcon(stage.status)}</div>
                    {index < projectStageList.length - 1 && (
                      <div className="w-0.5 h-full min-h-[32px] bg-gray-200 mt-2" />
                    )}
                  </div>

                  {/* Stage card */}
                  <div className="flex-1 pb-6">
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-bold text-[#1a2332]">{stage.name}</span>
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${getStageStatusBadgeClasses(stage.status)}`}>
                              {stage.status}
                            </span>
                            {deviationLabel && (
                              <span className={`text-xs font-semibold ${deviationLabel.color}`}>
                                {deviationLabel.text}
                              </span>
                            )}
                          </div>
                          <div className="text-gray-400 text-xs mt-0.5">
                            Responsável: {resolveTeamMemberName(stage.responsibleId)}
                          </div>
                        </div>
                        {canEditSchedule && (
                          <div className="flex gap-2">
                            <button onClick={() => openEditStageModal(stage)} className="text-orange-500 hover:text-orange-700 transition">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => setStagePendingDeleteId(stage.id)} className="text-red-500 hover:text-red-700 transition">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <div className="text-gray-400 mb-0.5">Data Prevista</div>
                          <div className="font-semibold text-gray-700">
                            {new Date(stage.plannedEnd + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 mb-0.5">Data Real</div>
                          <div className="font-semibold text-gray-700">
                            {stage.actualEnd
                              ? new Date(stage.actualEnd + 'T12:00:00').toLocaleDateString('pt-BR')
                              : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 mb-0.5">Situação</div>
                          <div className={`font-semibold ${deviationLabel?.color ?? 'text-gray-500'}`}>
                            {deviationLabel?.text ?? (stage.status === 'Não iniciada' ? 'Aguardando' : 'Em andamento')}
                          </div>
                        </div>
                      </div>

                      {/* Stage progress bar */}
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-blue-500 transition-all"
                            style={{ width: `${stage.progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-600 w-8">{stage.progress}%</span>
                      </div>

                      {stage.notes && (
                        <p className="text-gray-400 text-xs mt-2 italic">{stage.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add / Edit Stage Modal ─────────────────────────────────────────────── */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg my-8 p-7 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-[#1a2332]">
                {activeModal === 'add' ? 'Adicionar Etapa' : 'Editar Etapa'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleStageFormSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nome da Etapa *</label>
                <input
                  name="name" value={stageForm.name} onChange={handleStageFormChange} required
                  placeholder="Ex: Fundação"
                  className={sharedInputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Data Prevista de Início *</label>
                  <input type="date" name="plannedStart" value={stageForm.plannedStart} onChange={handleStageFormChange} required className={sharedInputClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Data Prevista de Término *</label>
                  <input type="date" name="plannedEnd" value={stageForm.plannedEnd} onChange={handleStageFormChange} required className={sharedInputClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Data de Conclusão Real</label>
                  <input type="date" name="actualEnd" value={stageForm.actualEnd} onChange={handleStageFormChange} className={sharedInputClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                  <select name="status" value={stageForm.status} onChange={handleStageFormChange} className={sharedInputClass + ' bg-white'}>
                    {STAGE_STATUS_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Progresso (%) — {stageForm.progress}%
                </label>
                <input
                  type="range" name="progress" min={0} max={100}
                  value={stageForm.progress} onChange={handleStageFormChange}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Responsável *</label>
                <select name="responsibleId" value={stageForm.responsibleId} onChange={handleStageFormChange} required className={sharedInputClass + ' bg-white'}>
                  <option value="">Selecione...</option>
                  {teamMembers
                    .filter(m => m.status === 'Ativo')
                    .map(m => (
                      <option key={m.id} value={m.id}>{m.name} — {m.role}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Observações</label>
                <textarea
                  name="notes" value={stageForm.notes} onChange={handleStageFormChange}
                  rows={2} placeholder="Descreva ocorrências ou detalhes relevantes..."
                  className={sharedInputClass + ' resize-none'}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal}
                  className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl hover:bg-blue-700 transition text-sm">
                  {activeModal === 'add' ? 'Adicionar Etapa' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Stage Confirmation ─────────────────────────────────────────── */}
      {stagePendingDeleteId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-sm p-7 shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h2 className="text-xl font-black text-[#1a2332] mb-2">Excluir Etapa</h2>
            <p className="text-gray-500 text-sm mb-6">
              Tem certeza que deseja excluir esta etapa? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setStagePendingDeleteId(null)}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">
                Cancelar
              </button>
              <button onClick={() => handleStageDelete(stagePendingDeleteId)}
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
