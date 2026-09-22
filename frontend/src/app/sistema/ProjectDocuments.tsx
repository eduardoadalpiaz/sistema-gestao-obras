/**
 * ProjectDocuments.tsx
 * Legal and technical document management screen.
 * The legal team uses this module to upload and track permits,
 * licences, contracts, and other required construction documents.
 */
import { useState, useRef, useCallback } from 'react';
import { useConstructionManagement, ProjectDocument, DocumentCategory, DocumentValidityStatus } from '../context/construction-context';
import {
  Plus, X, Trash2, Pencil, FileText, Upload, Eye,
  Search, AlertTriangle, CheckCircle, Clock, XCircle,
  Download, FileImage, Building2, Calendar, ShieldCheck,
} from 'lucide-react';

const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'Alvará de Construção', 'Alvará de Funcionamento', 'Licença Ambiental',
  'ART/RRT', 'Projeto Aprovado', 'Matrícula do Imóvel',
  'Habite-se', 'Contrato', 'Laudo Técnico', 'Outros',
];

/** Visual metadata for each document validity status. */
const VALIDITY_STATUS_STYLES: Record<DocumentValidityStatus, { label: string; badgeClasses: string; icon: React.ReactNode }> = {
  'Válido':    { label: 'Válido',    badgeClasses: 'bg-green-100 text-green-700',  icon: <CheckCircle  size={12} /> },
  'Vencendo':  { label: 'Vencendo',  badgeClasses: 'bg-yellow-100 text-yellow-700', icon: <AlertTriangle size={12} /> },
  'Vencido':   { label: 'Vencido',   badgeClasses: 'bg-red-100 text-red-700',      icon: <XCircle      size={12} /> },
  'Pendente':  { label: 'Pendente',  badgeClasses: 'bg-gray-100 text-gray-600',    icon: <Clock        size={12} /> },
  'Cancelado': { label: 'Cancelado', badgeClasses: 'bg-orange-100 text-orange-700', icon: <XCircle     size={12} /> },
};

const formatShortDate = (d?: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const EMPTY_DOCUMENT_FORM = {
  obraId:     '',
  title:      '',
  type:       'Alvará de Construção' as DocumentCategory,
  status:     'Pendente' as DocumentValidityStatus,
  issueDate:  '',
  expiryDate: '',
  notes:      '',
  file:       '',
  fileName:   '',
};

export function ProjectDocuments() {
  const {
    projects, documents, teamMembers,
    attachDocument, updateDocument, removeDocument,
    calculateDocumentStatus, activeUser,
  } = useConstructionManagement();

  const [selectedProjectId,   setSelectedProjectId]   = useState('');
  const [validityStatusFilter, setValidityStatusFilter] = useState<DocumentValidityStatus | ''>('');
  const [searchQuery,          setSearchQuery]          = useState('');
  const [activeModal,          setActiveModal]          = useState<'add' | 'edit' | 'delete' | 'preview' | null>(null);
  const [selectedDocument,     setSelectedDocument]     = useState<ProjectDocument | null>(null);
  const [documentForm,         setDocumentForm]         = useState(EMPTY_DOCUMENT_FORM);
  const [isSaving,             setIsSaving]             = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Filtered document list ───────────────────────────────────────────────────

  const filteredDocuments = documents.filter(doc => {
    const effectiveStatus  = calculateDocumentStatus(doc);
    const matchesProject   = !selectedProjectId    || doc.obraId === selectedProjectId;
    const matchesStatus    = !validityStatusFilter || effectiveStatus === validityStatusFilter;
    const matchesSearch    = !searchQuery ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProject && matchesStatus && matchesSearch;
  });

  // Counts per validity status for the summary cards
  const statusCounts = (Object.keys(VALIDITY_STATUS_STYLES) as DocumentValidityStatus[]).reduce(
    (acc, s) => { acc[s] = documents.filter(d => calculateDocumentStatus(d) === s).length; return acc; },
    {} as Record<DocumentValidityStatus, number>
  );

  // Number of documents needing urgent attention
  const urgentDocumentCount = documents.filter(d => {
    const s = calculateDocumentStatus(d);
    return s === 'Vencendo' || s === 'Vencido';
  }).length;

  // ── Modal handlers ────────────────────────────────────────────────────────────

  const openAddModal = () => {
    setDocumentForm({ ...EMPTY_DOCUMENT_FORM, obraId: selectedProjectId || (projects[0]?.id ?? '') });
    setActiveModal('add');
  };

  const openEditModal = (doc: ProjectDocument) => {
    setSelectedDocument(doc);
    setDocumentForm({
      obraId:     doc.obraId,
      title:      doc.title,
      type:       doc.type,
      status:     doc.status,
      issueDate:  doc.issueDate  ?? '',
      expiryDate: doc.expiryDate ?? '',
      notes:      doc.notes      ?? '',
      file:       doc.file       ?? '',
      fileName:   doc.fileName   ?? '',
    });
    setActiveModal('edit');
  };

  const openPreviewModal = (doc: ProjectDocument) => { setSelectedDocument(doc); setActiveModal('preview'); };
  const openDeleteModal  = (doc: ProjectDocument) => { setSelectedDocument(doc); setActiveModal('delete'); };
  const closeModal       = () => { setActiveModal(null); setSelectedDocument(null); };

  // ── File upload handler ───────────────────────────────────────────────────────

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Arquivo muito grande. Máximo: 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const base64 = ev.target?.result as string;
      setDocumentForm(prev => ({ ...prev, file: base64, fileName: file.name }));
    };
    reader.readAsDataURL(file);
  }, []);

  // ── Form submit ──────────────────────────────────────────────────────────────

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentForm.obraId || !documentForm.title) return;
    setIsSaving(true);
    const payload = {
      obraId:     documentForm.obraId,
      title:      documentForm.title.trim(),
      type:       documentForm.type,
      status:     documentForm.status,
      issueDate:  documentForm.issueDate  || undefined,
      expiryDate: documentForm.expiryDate || undefined,
      notes:      documentForm.notes.trim(),
      file:       documentForm.file,
      fileName:   documentForm.fileName,
      uploadedBy: activeUser?.id ?? '',
    };
    if (activeModal === 'add') {
      await attachDocument(payload);
    } else if (activeModal === 'edit' && selectedDocument) {
      await updateDocument(selectedDocument.id, payload);
    }
    setIsSaving(false);
    closeModal();
  };

  const handleDocumentDelete = async () => {
    if (selectedDocument) await removeDocument(selectedDocument.id);
    closeModal();
  };

  const resolveProjectName    = (id: string) => projects.find(p => p.id === id)?.name         ?? '—';
  const resolveTeamMemberName = (id: string) => teamMembers.find(m => m.id === id)?.name      ?? '—';

  const baseInputClass = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#1a2332] transition';

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#1a2332]">Documentos</h1>
          <p className="text-gray-500 text-sm">Gestão jurídica e técnica de documentos por obra</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-[#1a2332] text-white font-bold px-5 py-2.5 rounded-xl hover:bg-[#243347] transition text-sm"
        >
          <Plus size={16} /> Novo Documento
        </button>
      </div>

      {/* Urgency alert */}
      {urgentDocumentCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div>
            <p className="font-bold text-red-700 text-sm">
              {urgentDocumentCount} documento{urgentDocumentCount > 1 ? 's' : ''} requer{urgentDocumentCount === 1 ? '' : 'em'} atenção
            </p>
            <p className="text-red-500 text-xs">Verifique os documentos vencidos ou próximos do vencimento</p>
          </div>
        </div>
      )}

      {/* Validity status summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(Object.entries(VALIDITY_STATUS_STYLES) as [DocumentValidityStatus, typeof VALIDITY_STATUS_STYLES[DocumentValidityStatus]][]).map(
          ([status, meta]) => (
            <button
              key={status}
              onClick={() => setValidityStatusFilter(prev => prev === status ? '' : status)}
              className={`rounded-2xl p-4 border text-left transition-all shadow-sm ${
                validityStatusFilter === status
                  ? 'ring-2 ring-[#1a2332] border-[#1a2332] bg-[#1a2332] text-white'
                  : 'bg-white border-gray-100 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={validityStatusFilter === status ? 'text-white' : 'text-gray-500'}>{meta.icon}</span>
                <span className={`text-xs font-semibold ${validityStatusFilter === status ? 'text-white' : 'text-gray-500'}`}>
                  {meta.label}
                </span>
              </div>
              <div className={`text-2xl font-black ${validityStatusFilter === status ? 'text-white' : 'text-[#1a2332]'}`}>
                {statusCounts[status]}
              </div>
            </button>
          )
        )}
      </div>

      {/* Search & project filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por título ou tipo..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1a2332] transition"
          />
        </div>
        <select
          value={selectedProjectId}
          onChange={e => setSelectedProjectId(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#1a2332] transition bg-white min-w-[220px]"
        >
          <option value="">Todas as Obras</option>
          {projects
            .filter(p => !['ref1', 'ref2', 'ref3'].includes(p.id))
            .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Desktop table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto hidden md:block">
        {filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-300">
            <ShieldCheck size={40} className="mb-3" />
            <p className="font-semibold text-sm">Nenhum documento encontrado</p>
            <p className="text-xs mt-1">Clique em "Novo Documento" para adicionar</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-gray-400 font-semibold px-6 py-4">Documento</th>
                <th className="text-left text-gray-400 font-semibold px-4 py-4">Obra</th>
                <th className="text-left text-gray-400 font-semibold px-4 py-4">Tipo</th>
                <th className="text-left text-gray-400 font-semibold px-4 py-4">Status</th>
                <th className="text-left text-gray-400 font-semibold px-4 py-4">Emissão</th>
                <th className="text-left text-gray-400 font-semibold px-4 py-4">Vencimento</th>
                <th className="text-left text-gray-400 font-semibold px-4 py-4">Arquivo</th>
                <th className="text-left text-gray-400 font-semibold px-4 py-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredDocuments.map(doc => {
                const effectiveStatus = calculateDocumentStatus(doc);
                const statusStyle     = VALIDITY_STATUS_STYLES[effectiveStatus];
                return (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="font-bold text-[#1a2332]">{doc.title}</div>
                      {doc.notes && <div className="text-gray-400 text-xs mt-0.5 truncate max-w-[180px]">{doc.notes}</div>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                        <Building2 size={12} className="text-gray-400" />
                        {resolveProjectName(doc.obraId)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs text-gray-600 font-medium">{doc.type}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyle.badgeClasses}`}>
                        {statusStyle.icon} {statusStyle.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 text-xs">{formatShortDate(doc.issueDate)}</td>
                    <td className="px-4 py-3.5">
                      {doc.expiryDate ? (
                        <span className={`text-xs font-semibold ${
                          effectiveStatus === 'Vencido'  ? 'text-red-600' :
                          effectiveStatus === 'Vencendo' ? 'text-yellow-600' : 'text-gray-500'
                        }`}>
                          {formatShortDate(doc.expiryDate)}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {doc.file ? (
                        <button onClick={() => openPreviewModal(doc)}
                          className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold hover:text-blue-800 transition">
                          <FileImage size={13} /> Ver arquivo
                        </button>
                      ) : (
                        <span className="text-gray-300 text-xs">Sem arquivo</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditModal(doc)} className="text-orange-500 hover:text-orange-700 transition" title="Editar">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => openDeleteModal(doc)} className="text-red-500 hover:text-red-700 transition" title="Excluir">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filteredDocuments.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-300 border border-gray-100">
            <ShieldCheck size={32} className="mx-auto mb-2" />
            <p className="text-sm font-semibold">Nenhum documento</p>
          </div>
        ) : filteredDocuments.map(doc => {
          const effectiveStatus = calculateDocumentStatus(doc);
          const statusStyle     = VALIDITY_STATUS_STYLES[effectiveStatus];
          return (
            <div key={doc.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0 mr-2">
                  <div className="font-bold text-[#1a2332]">{doc.title}</div>
                  <div className="text-gray-400 text-xs mt-0.5">{resolveProjectName(doc.obraId)}</div>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${statusStyle.badgeClasses}`}>
                  {statusStyle.icon} {statusStyle.label}
                </span>
              </div>
              <div className="text-gray-500 text-xs mb-2">{doc.type}</div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                {doc.issueDate  && <span>Emissão: {formatShortDate(doc.issueDate)}</span>}
                {doc.expiryDate && (
                  <span>Venc.: <span className={
                    effectiveStatus === 'Vencido'  ? 'text-red-600 font-bold' :
                    effectiveStatus === 'Vencendo' ? 'text-yellow-600 font-bold' : 'text-gray-500'
                  }>{formatShortDate(doc.expiryDate)}</span></span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                {doc.file && (
                  <button onClick={() => openPreviewModal(doc)} className="flex items-center gap-1 text-xs text-blue-600 font-semibold">
                    <FileImage size={12} /> Arquivo
                  </button>
                )}
                <button onClick={() => openEditModal(doc)} className="flex items-center gap-1.5 text-orange-500 text-xs font-semibold ml-auto">
                  <Pencil size={13} /> Editar
                </button>
                <button onClick={() => openDeleteModal(doc)} className="flex items-center gap-1.5 text-red-500 text-xs font-semibold">
                  <Trash2 size={13} /> Excluir
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Add / Edit Modal ───────────────────────────────────────────────────── */}
      {(activeModal === 'add' || activeModal === 'edit') && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-xl my-8 p-7 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-[#1a2332]">
                {activeModal === 'add' ? 'Novo Documento' : 'Editar Documento'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Obra *</label>
                <select value={documentForm.obraId} onChange={e => setDocumentForm(p => ({ ...p, obraId: e.target.value }))}
                  required className={baseInputClass + ' bg-white'}>
                  <option value="">Selecione a obra</option>
                  {projects
                    .filter(p => !['ref1', 'ref2', 'ref3'].includes(p.id))
                    .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Título *</label>
                <input value={documentForm.title}
                  onChange={e => setDocumentForm(p => ({ ...p, title: e.target.value }))}
                  required placeholder="Ex: Alvará de Construção nº 4521/2025"
                  className={baseInputClass} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo *</label>
                  <select value={documentForm.type} onChange={e => setDocumentForm(p => ({ ...p, type: e.target.value as DocumentCategory }))}
                    className={baseInputClass + ' bg-white'}>
                    {DOCUMENT_CATEGORIES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Status
                    {documentForm.expiryDate && (
                      <span className="ml-1 text-[10px] text-gray-400">(auto por vencimento)</span>
                    )}
                  </label>
                  <select value={documentForm.status} onChange={e => setDocumentForm(p => ({ ...p, status: e.target.value as DocumentValidityStatus }))}
                    className={baseInputClass + ' bg-white'}>
                    {(Object.keys(VALIDITY_STATUS_STYLES) as DocumentValidityStatus[]).map(s => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                    <Calendar size={13} className="text-gray-400" /> Data de Emissão
                  </label>
                  <input type="date" value={documentForm.issueDate}
                    onChange={e => setDocumentForm(p => ({ ...p, issueDate: e.target.value }))}
                    className={baseInputClass} />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                    <AlertTriangle size={13} className="text-yellow-500" /> Data de Vencimento
                  </label>
                  <input type="date" value={documentForm.expiryDate}
                    onChange={e => setDocumentForm(p => ({ ...p, expiryDate: e.target.value }))}
                    className={baseInputClass} />
                  {documentForm.expiryDate && (
                    <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                      <AlertTriangle size={10} /> Status calculado automaticamente pela data de vencimento
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Observações</label>
                <textarea value={documentForm.notes}
                  onChange={e => setDocumentForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2} placeholder="Número do documento, órgão emissor, condições..."
                  className={baseInputClass + ' resize-none'} />
              </div>

              {/* File attachment */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Arquivo do Documento</label>
                <div onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-[#1a2332] hover:bg-gray-50 transition text-center">
                  {documentForm.file ? (
                    <div className="flex items-center justify-center gap-2 text-green-600">
                      <FileText size={18} />
                      <span className="text-sm font-semibold">{documentForm.fileName || 'Arquivo anexado'}</span>
                      <button type="button" onClick={e => { e.stopPropagation(); setDocumentForm(p => ({ ...p, file: '', fileName: '' })); }}
                        className="text-red-400 hover:text-red-600 ml-1"><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="text-gray-400">
                      <Upload size={20} className="mx-auto mb-1" />
                      <p className="text-xs font-semibold">Clique para anexar o documento</p>
                      <p className="text-xs mt-0.5">PDF, JPG, PNG · Máx. 5 MB</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal}
                  className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving}
                  className="flex-1 bg-[#1a2332] text-white font-bold py-2.5 rounded-xl hover:bg-[#243347] transition text-sm disabled:opacity-70 flex items-center justify-center gap-2">
                  {isSaving
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Salvando...</>
                    : activeModal === 'add' ? 'Adicionar Documento' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── File Preview Modal ─────────────────────────────────────────────────── */}
      {activeModal === 'preview' && selectedDocument && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center p-4 overflow-y-auto" onClick={closeModal}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                <h2 className="text-lg font-black text-[#1a2332]">{selectedDocument.title}</h2>
                <p className="text-gray-400 text-xs">{selectedDocument.type} · {resolveProjectName(selectedDocument.obraId)}</p>
                <div className="flex items-center gap-3 mt-1">
                  {selectedDocument.issueDate  && <span className="text-xs text-gray-400">Emissão: {formatShortDate(selectedDocument.issueDate)}</span>}
                  {selectedDocument.expiryDate && <span className="text-xs text-gray-400">Venc.: {formatShortDate(selectedDocument.expiryDate)}</span>}
                  <span className="text-xs text-gray-400">Enviado por: {resolveTeamMemberName(selectedDocument.uploadedBy)}</span>
                </div>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 shrink-0 ml-4"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {selectedDocument.file?.startsWith('data:image') ? (
                <img src={selectedDocument.file} alt={selectedDocument.title}
                  className="w-full rounded-xl border border-gray-100 object-contain max-h-[60vh]" />
              ) : selectedDocument.file?.startsWith('data:application/pdf') ? (
                <div className="bg-gray-50 rounded-xl p-8 text-center">
                  <FileText size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-sm font-bold text-gray-700 mb-1">{selectedDocument.fileName ?? 'documento.pdf'}</p>
                  <a href={selectedDocument.file} download={selectedDocument.fileName ?? 'documento.pdf'}
                    className="inline-flex items-center gap-2 bg-[#1a2332] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#243347] transition">
                    <Download size={15} /> Baixar PDF
                  </a>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400">
                  <Eye size={32} className="mx-auto mb-2" />
                  <p className="text-sm">Prévia não disponível</p>
                  {selectedDocument.file && (
                    <a href={selectedDocument.file} download={selectedDocument.fileName ?? 'documento'}
                      className="mt-3 inline-flex items-center gap-2 bg-[#1a2332] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#243347] transition">
                      <Download size={13} /> Baixar arquivo
                    </a>
                  )}
                </div>
              )}
            </div>

            {selectedDocument.notes && (
              <div className="mt-4 bg-gray-50 rounded-xl p-3 shrink-0">
                <p className="text-xs font-semibold text-gray-400 mb-1">Observações</p>
                <p className="text-sm text-gray-700">{selectedDocument.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ──────────────────────────────────────────── */}
      {activeModal === 'delete' && selectedDocument && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-sm p-7 shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h2 className="text-xl font-black text-[#1a2332] mb-2">Excluir Documento</h2>
            <p className="text-gray-500 text-sm mb-6">
              Tem certeza que deseja excluir <strong>"{selectedDocument.title}"</strong>?
            </p>
            <div className="flex gap-3">
              <button onClick={closeModal}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">
                Cancelar
              </button>
              <button onClick={handleDocumentDelete}
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
