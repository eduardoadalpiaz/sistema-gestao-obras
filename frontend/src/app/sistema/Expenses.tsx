/**
 * Expenses.tsx
 * Financial expense tracking screen — records, views and manages
 * all expenditures per construction project, with receipt attachment support.
 */
import { useState, useRef, useCallback } from 'react';
import { useConstructionManagement, Expense, ExpenseCategory } from '../context/construction-context';
import {
  Plus, X, Trash2, Pencil, Receipt, Upload, Eye,
  TrendingUp, TrendingDown, DollarSign, Building2, FileImage, Search,
} from 'lucide-react';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Materiais', 'Equipamentos', 'Mão de obra', 'Transporte', 'Serviços', 'Outros',
];

/** Tailwind classes for each expense category badge. */
const CATEGORY_BADGE_CLASSES: Record<ExpenseCategory, string> = {
  'Materiais':    'bg-blue-100 text-blue-700',
  'Equipamentos': 'bg-purple-100 text-purple-700',
  'Mão de obra':  'bg-orange-100 text-orange-700',
  'Transporte':   'bg-yellow-100 text-yellow-700',
  'Serviços':     'bg-teal-100 text-teal-700',
  'Outros':       'bg-gray-100 text-gray-600',
};

const formatCurrency    = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatShortDate   = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const EMPTY_EXPENSE_FORM = {
  obraId:      '',
  description: '',
  category:    'Materiais' as ExpenseCategory,
  value:       '',
  date:        new Date().toISOString().slice(0, 10),
  fornecedor:  '',
  etapaId:     '',
  notes:       '',
  receipt:     '',
  receiptName: '',
};

export function Expenses() {
  const {
    projects, expenses, scheduleStages, teamMembers,
    recordExpense, updateExpense, removeExpense,
    calculateTotalExpenses, activeUser,
  } = useConstructionManagement();

  const [selectedProjectId,  setSelectedProjectId]  = useState('');
  const [searchQuery,        setSearchQuery]        = useState('');
  const [activeModal,        setActiveModal]        = useState<'add' | 'edit' | 'delete' | 'receipt' | null>(null);
  const [selectedExpense,    setSelectedExpense]    = useState<Expense | null>(null);
  const [expenseForm,        setExpenseForm]        = useState(EMPTY_EXPENSE_FORM);
  const [isSaving,           setIsSaving]           = useState(false);
  const [receiptPreviewData, setReceiptPreviewData] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Filtered expense list ────────────────────────────────────────────────────

  const filteredExpenses = expenses.filter(e => {
    const matchesProject = !selectedProjectId || e.obraId === selectedProjectId;
    const matchesSearch  = !searchQuery ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProject && matchesSearch;
  });

  const filteredTotal   = filteredExpenses.reduce((sum, e) => sum + e.value, 0);
  const grandTotal      = expenses.reduce((sum, e) => sum + e.value, 0);
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const projectTotal    = selectedProjectId ? calculateTotalExpenses(selectedProjectId) : 0;
  const projectBudget   = selectedProject?.estimatedCost ?? 0;
  const budgetVariance  = projectBudget > 0 ? projectTotal - projectBudget : null;

  // ── Modal handlers ────────────────────────────────────────────────────────────

  const openAddModal = () => {
    setExpenseForm({ ...EMPTY_EXPENSE_FORM, obraId: selectedProjectId || (projects[0]?.id ?? '') });
    setActiveModal('add');
  };

  const openEditModal = (expense: Expense) => {
    setSelectedExpense(expense);
    setExpenseForm({
      obraId:      expense.obraId,
      description: expense.description,
      category:    expense.category,
      value:       String(expense.value),
      date:        expense.date,
      fornecedor:  expense.fornecedor ?? '',
      etapaId:     expense.etapaId ?? '',
      notes:       expense.notes ?? '',
      receipt:     expense.receipt ?? '',
      receiptName: expense.receiptName ?? '',
    });
    setActiveModal('edit');
  };

  const openDeleteModal  = (expense: Expense) => { setSelectedExpense(expense); setActiveModal('delete'); };
  const openReceiptModal = (expense: Expense) => {
    setSelectedExpense(expense);
    setReceiptPreviewData(expense.receipt ?? '');
    setActiveModal('receipt');
  };
  const closeModal = () => { setActiveModal(null); setSelectedExpense(null); setExpenseForm(EMPTY_EXPENSE_FORM); };

  // ── Receipt file handler ──────────────────────────────────────────────────────

  const handleReceiptFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Comprovante muito grande. Máximo: 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const base64 = ev.target?.result as string;
      setExpenseForm(prev => ({ ...prev, receipt: base64, receiptName: file.name }));
    };
    reader.readAsDataURL(file);
  }, []);

  // ── Form submit ──────────────────────────────────────────────────────────────

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.obraId || !expenseForm.description || !expenseForm.value) return;
    setIsSaving(true);
    const payload = {
      obraId:      expenseForm.obraId,
      description: expenseForm.description.trim(),
      category:    expenseForm.category,
      value:       parseFloat(expenseForm.value.replace(',', '.')),
      date:        expenseForm.date,
      fornecedor:  expenseForm.fornecedor.trim() || undefined,
      etapaId:     expenseForm.etapaId || undefined,
      notes:       expenseForm.notes.trim(),
      receipt:     expenseForm.receipt,
      receiptName: expenseForm.receiptName,
      createdBy:   activeUser?.id ?? '',
    };
    if (activeModal === 'add') {
      await recordExpense(payload);
    } else if (activeModal === 'edit' && selectedExpense) {
      await updateExpense(selectedExpense.id, payload);
    }
    setIsSaving(false);
    closeModal();
  };

  const handleExpenseDelete = async () => {
    if (selectedExpense) await removeExpense(selectedExpense.id);
    closeModal();
  };

  const resolveTeamMemberName = (id: string) => teamMembers.find(m => m.id === id)?.name ?? '—';
  const resolveProjectName    = (id: string) => projects.find(p => p.id === id)?.name    ?? '—';

  // ── Category totals for summary ────────────────────────────────────────────

  const categoryTotals = EXPENSE_CATEGORIES
    .map(cat => ({
      category: cat,
      total: filteredExpenses.filter(e => e.category === cat).reduce((s, e) => s + e.value, 0),
    }))
    .filter(x => x.total > 0)
    .sort((a, b) => b.total - a.total);

  const baseInputClass = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#E8821A] transition';

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#1a2332]">Gastos de Obras</h1>
          <p className="text-gray-500 text-sm">Lançamento e acompanhamento de despesas por obra</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-[#E8821A] text-white font-bold px-5 py-2.5 rounded-xl hover:bg-[#d4731a] transition text-sm"
        >
          <Plus size={16} /> Lançar Gasto
        </button>
      </div>

      {/* Search & filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por descrição ou categoria..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#E8821A] transition"
          />
        </div>
        <select
          value={selectedProjectId}
          onChange={e => setSelectedProjectId(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#E8821A] transition bg-white min-w-[220px]"
        >
          <option value="">Todas as Obras</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-[#E8821A]/10 rounded-lg flex items-center justify-center">
              <DollarSign size={16} className="text-[#E8821A]" />
            </div>
            <span className="text-xs font-semibold text-gray-500">Total Geral</span>
          </div>
          <div className="font-black text-[#1a2332]">{formatCurrency(grandTotal)}</div>
          <div className="text-xs text-gray-400 mt-0.5">{expenses.length} lançamento(s)</div>
        </div>

        {selectedProjectId ? (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Building2 size={16} className="text-blue-500" />
                </div>
                <span className="text-xs font-semibold text-gray-500">Gasto Real</span>
              </div>
              <div className="font-black text-[#1a2332]">{formatCurrency(projectTotal)}</div>
              <div className="text-xs text-gray-400 mt-0.5">{filteredExpenses.length} lançamento(s)</div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                  <Receipt size={16} className="text-purple-500" />
                </div>
                <span className="text-xs font-semibold text-gray-500">Orçamento Estimado</span>
              </div>
              <div className="font-black text-[#1a2332]">
                {projectBudget > 0 ? formatCurrency(projectBudget) : <span className="text-gray-300 text-sm">Não definido</span>}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">Definido na obra</div>
            </div>

            <div className={`rounded-2xl p-4 shadow-sm border ${budgetVariance === null ? 'bg-white border-gray-100' : budgetVariance > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${budgetVariance === null ? 'bg-gray-100' : budgetVariance > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                  {budgetVariance !== null && budgetVariance > 0
                    ? <TrendingUp   size={16} className="text-red-500" />
                    : <TrendingDown size={16} className={budgetVariance !== null ? 'text-green-500' : 'text-gray-400'} />}
                </div>
                <span className="text-xs font-semibold text-gray-500">Diferença</span>
              </div>
              <div className={`font-black ${budgetVariance === null ? 'text-gray-300' : budgetVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {budgetVariance === null ? '—' : `${budgetVariance > 0 ? '+' : ''}${formatCurrency(budgetVariance)}`}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {budgetVariance === null ? 'Sem orçamento' : budgetVariance > 0 ? 'Acima do orçamento' : 'Dentro do orçamento'}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Building2 size={16} className="text-blue-500" />
                </div>
                <span className="text-xs font-semibold text-gray-500">Resultado Filtrado</span>
              </div>
              <div className="font-black text-[#1a2332]">{formatCurrency(filteredTotal)}</div>
              <div className="text-xs text-gray-400 mt-0.5">{filteredExpenses.length} lançamento(s)</div>
            </div>
            <div className="col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-3">Por categoria</p>
              <div className="flex flex-wrap gap-2">
                {categoryTotals.length === 0
                  ? <span className="text-gray-300 text-sm">Nenhum gasto lançado</span>
                  : categoryTotals.map(({ category, total }) => (
                    <div key={category} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${CATEGORY_BADGE_CLASSES[category]}`}>
                      {category}: {formatCurrency(total)}
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Desktop table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto hidden md:block">
        {filteredExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-300">
            <Receipt size={40} className="mb-3" />
            <p className="font-semibold text-sm">Nenhum gasto encontrado</p>
            <p className="text-xs mt-1">Clique em "Lançar Gasto" para registrar uma despesa</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-gray-400 font-semibold px-6 py-4">Data</th>
                <th className="text-left text-gray-400 font-semibold px-4 py-4">Obra</th>
                <th className="text-left text-gray-400 font-semibold px-4 py-4">Descrição</th>
                <th className="text-left text-gray-400 font-semibold px-4 py-4">Categoria</th>
                <th className="text-right text-gray-400 font-semibold px-4 py-4">Valor</th>
                <th className="text-left text-gray-400 font-semibold px-4 py-4">Fornecedor</th>
                <th className="text-left text-gray-400 font-semibold px-4 py-4">Comprovante</th>
                <th className="text-left text-gray-400 font-semibold px-4 py-4">Lançado por</th>
                <th className="text-left text-gray-400 font-semibold px-4 py-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredExpenses.map(expense => (
                <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-500 text-xs whitespace-nowrap">{formatShortDate(expense.date)}</td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs font-semibold text-[#1a2332]">{resolveProjectName(expense.obraId)}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-[#1a2332] text-sm">{expense.description}</div>
                    {expense.notes && <div className="text-gray-400 text-xs mt-0.5 truncate max-w-[200px]">{expense.notes}</div>}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_BADGE_CLASSES[expense.category]}`}>
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-black text-[#1a2332]">{formatCurrency(expense.value)}</td>
                  <td className="px-4 py-3.5 text-gray-500 text-xs">{expense.fornecedor || '—'}</td>
                  <td className="px-4 py-3.5">
                    {expense.receipt ? (
                      <button onClick={() => openReceiptModal(expense)} className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold hover:text-blue-800 transition">
                        <FileImage size={13} /> Ver
                      </button>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-gray-500 text-xs">{resolveTeamMemberName(expense.createdBy)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEditModal(expense)} className="text-orange-500 hover:text-orange-700 transition" title="Editar">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => openDeleteModal(expense)} className="text-red-500 hover:text-red-700 transition" title="Excluir">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filteredExpenses.map(expense => (
          <div key={expense.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-bold text-[#1a2332]">{expense.description}</div>
                <div className="text-gray-400 text-xs mt-0.5">{resolveProjectName(expense.obraId)}</div>
              </div>
              <div className="font-black text-[#1a2332] text-sm">{formatCurrency(expense.value)}</div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_BADGE_CLASSES[expense.category]}`}>
                {expense.category}
              </span>
              <span className="text-gray-400 text-xs">{formatShortDate(expense.date)}</span>
            </div>
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              {expense.receipt && (
                <button onClick={() => openReceiptModal(expense)} className="flex items-center gap-1 text-xs text-blue-600 font-semibold">
                  <FileImage size={12} /> Comprovante
                </button>
              )}
              <button onClick={() => openEditModal(expense)} className="flex items-center gap-1.5 text-orange-500 text-xs font-semibold ml-auto">
                <Pencil size={13} /> Editar
              </button>
              <button onClick={() => openDeleteModal(expense)} className="flex items-center gap-1.5 text-red-500 text-xs font-semibold">
                <Trash2 size={13} /> Excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Add / Edit Modal ───────────────────────────────────────────────────── */}
      {(activeModal === 'add' || activeModal === 'edit') && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg my-8 p-7 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-[#1a2332]">
                {activeModal === 'add' ? 'Lançar Gasto' : 'Editar Gasto'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Obra *</label>
                <select value={expenseForm.obraId} onChange={e => setExpenseForm(p => ({ ...p, obraId: e.target.value }))} required className={baseInputClass + ' bg-white'}>
                  <option value="">Selecione a obra</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Descrição *</label>
                <input value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} required placeholder="Ex: Compra de cimento" className={baseInputClass} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Categoria *</label>
                  <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value as ExpenseCategory }))} className={baseInputClass + ' bg-white'}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Valor (R$) *</label>
                  <input value={expenseForm.value} onChange={e => setExpenseForm(p => ({ ...p, value: e.target.value }))} required placeholder="0,00" className={baseInputClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Data *</label>
                  <input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))} required className={baseInputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Fornecedor</label>
                  <input value={expenseForm.fornecedor} onChange={e => setExpenseForm(p => ({ ...p, fornecedor: e.target.value }))} placeholder="Ex: Madeirex Ltda" className={baseInputClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Etapa Associada</label>
                  <select value={expenseForm.etapaId} onChange={e => setExpenseForm(p => ({ ...p, etapaId: e.target.value }))} className={baseInputClass + ' bg-white'}>
                    <option value="">Nenhuma</option>
                    {scheduleStages
                      .filter(s => s.obraId === expenseForm.obraId)
                      .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Observações</label>
                <textarea value={expenseForm.notes} onChange={e => setExpenseForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Detalhes adicionais..." className={baseInputClass + ' resize-none'} />
              </div>

              {/* Receipt upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Comprovante</label>
                <div onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-[#E8821A] hover:bg-orange-50 transition text-center">
                  {expenseForm.receipt ? (
                    <div className="flex items-center justify-center gap-2 text-green-600">
                      <Eye size={16} />
                      <span className="text-sm font-semibold">{expenseForm.receiptName || 'Arquivo anexado'}</span>
                      <button type="button" onClick={e => { e.stopPropagation(); setExpenseForm(p => ({ ...p, receipt: '', receiptName: '' })); }}
                        className="text-red-400 hover:text-red-600 ml-1"><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="text-gray-400">
                      <Upload size={20} className="mx-auto mb-1" />
                      <p className="text-xs font-semibold">Clique para anexar</p>
                      <p className="text-xs mt-0.5">JPG, PNG, PDF · Máx. 2 MB</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleReceiptFileChange} />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal}
                  className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving}
                  className="flex-1 bg-[#E8821A] text-white font-bold py-2.5 rounded-xl hover:bg-[#d4731a] transition text-sm disabled:opacity-70 flex items-center justify-center gap-2">
                  {isSaving
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Salvando...</>
                    : activeModal === 'add' ? 'Lançar Gasto' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Receipt Preview Modal ──────────────────────────────────────────────── */}
      {activeModal === 'receipt' && selectedExpense && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center p-4 overflow-y-auto" onClick={closeModal}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-black text-[#1a2332]">{selectedExpense.description}</h2>
                <p className="text-gray-400 text-xs">{selectedExpense.receiptName}</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {receiptPreviewData?.startsWith('data:image') ? (
                <img src={receiptPreviewData} alt="Comprovante" className="w-full rounded-xl object-contain max-h-[60vh]" />
              ) : (
                <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400">
                  <FileImage size={32} className="mx-auto mb-2" />
                  <p className="text-sm">Prévia não disponível para este tipo de arquivo.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ──────────────────────────────────────────── */}
      {activeModal === 'delete' && selectedExpense && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-sm p-7 shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h2 className="text-xl font-black text-[#1a2332] mb-2">Excluir Gasto</h2>
            <p className="text-gray-500 text-sm mb-6">
              Tem certeza que deseja excluir <strong>"{selectedExpense.description}"</strong>?
            </p>
            <div className="flex gap-3">
              <button onClick={closeModal}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">
                Cancelar
              </button>
              <button onClick={handleExpenseDelete}
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
