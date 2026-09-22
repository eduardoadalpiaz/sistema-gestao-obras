import { useState } from 'react';
import { History, Search, Filter } from 'lucide-react';
import { useConstructionManagement } from '../context/construction-context';
import type { AuditEntry } from '../context/construction-context';

type ModuleFilter = 'Todos' | 'Obras' | 'Etapas' | 'Despesas' | 'Documentos' | 'Usuários';
type ActionFilter = 'Todos' | 'Criou' | 'Editou' | 'Removeu';

const MODULE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Obras:      { bg: 'rgba(249,115,22,.12)',  text: '#f97316', border: 'rgba(249,115,22,.25)'  },
  Etapas:     { bg: 'rgba(59,130,246,.12)',   text: '#60a5fa', border: 'rgba(59,130,246,.25)'  },
  Despesas:   { bg: 'rgba(34,197,94,.12)',    text: '#4ade80', border: 'rgba(34,197,94,.25)'   },
  Documentos: { bg: 'rgba(168,85,247,.12)',   text: '#c084fc', border: 'rgba(168,85,247,.25)'  },
  Usuários:   { bg: 'rgba(234,179,8,.12)',    text: '#fbbf24', border: 'rgba(234,179,8,.25)'   },
};

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  Criou:   { bg: 'rgba(34,197,94,.1)',   text: '#4ade80' },
  Editou:  { bg: 'rgba(59,130,246,.1)',  text: '#60a5fa' },
  Removeu: { bg: 'rgba(239,68,68,.1)',   text: '#f87171' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function EntryRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const mc = MODULE_COLORS[entry.module] ?? MODULE_COLORS['Obras'];
  const ac = ACTION_COLORS[entry.action] ?? ACTION_COLORS['Criou'];
  const hasDetail = !!(entry.field || entry.oldValue || entry.newValue);

  return (
    <div
      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
      style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => hasDetail && setExpanded(e => !e)}
      >
        {/* Timestamp */}
        <div className="text-[10px] text-gray-600 font-mono shrink-0 w-32 hidden sm:block">
          {formatDate(entry.createdAt)}
        </div>

        {/* Module badge */}
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
          style={{ background: mc.bg, color: mc.text, border: `1px solid ${mc.border}` }}
        >
          {entry.module}
        </span>

        {/* Action badge */}
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0"
          style={{ background: ac.bg, color: ac.text }}
        >
          {entry.action}
        </span>

        {/* Target */}
        <div className="flex-1 min-w-0">
          <span className="text-sm text-gray-300 truncate block">{entry.targetName}</span>
          {entry.field && !expanded && (
            <span className="text-[11px] text-gray-600">campo: {entry.field}</span>
          )}
        </div>

        {/* User */}
        <div className="text-[11px] text-gray-600 shrink-0 hidden md:block">{entry.userName}</div>

        {/* Expand indicator */}
        {hasDetail && (
          <span className="text-gray-700 text-[10px] shrink-0" style={{ transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform .15s' }}>▼</span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && hasDetail && (
        <div className="px-4 pb-3 pt-1 ml-32 sm:ml-0">
          <div
            className="rounded-lg p-3 text-xs flex flex-wrap gap-4"
            style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}
          >
            {entry.field && (
              <div>
                <span className="text-gray-600 block mb-0.5">Campo</span>
                <span className="text-gray-300 font-semibold">{entry.field}</span>
              </div>
            )}
            {entry.oldValue !== undefined && (
              <div>
                <span className="text-gray-600 block mb-0.5">Valor anterior</span>
                <span className="text-red-400 font-mono">{entry.oldValue || '(vazio)'}</span>
              </div>
            )}
            {entry.newValue !== undefined && (
              <div>
                <span className="text-gray-600 block mb-0.5">Novo valor</span>
                <span className="text-green-400 font-mono">{entry.newValue || '(vazio)'}</span>
              </div>
            )}
            <div className="sm:hidden">
              <span className="text-gray-600 block mb-0.5">Usuário</span>
              <span className="text-gray-300">{entry.userName}</span>
            </div>
            <div className="sm:hidden">
              <span className="text-gray-600 block mb-0.5">Data</span>
              <span className="text-gray-300">{formatDate(entry.createdAt)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AuditLog() {
  const { auditLog, activeUser } = useConstructionManagement();

  const [search,       setSearch]       = useState('');
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('Todos');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('Todos');

  // Histórico de alterações é uma área sensível (auditoria) — restrita a
  // Administrativo e TI, mesmo que alguém digite a URL direto.
  const allowedRoles = ['TI', 'Dono'];
  if (!activeUser || !allowedRoles.includes(activeUser.role)) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <History size={40} className="mx-auto mb-4 text-gray-300" />
        <h1 className="text-lg font-black text-[#1a2332] mb-2">Acesso restrito</h1>
        <p className="text-gray-500 text-sm">
          O Histórico de Alterações é uma área de auditoria, disponível apenas para os
          perfis TI e Dono. Fale com um administrador se precisar de acesso.
        </p>
      </div>
    );
  }

  const modules: ModuleFilter[] = ['Todos', 'Obras', 'Etapas', 'Despesas', 'Documentos', 'Usuários'];
  const actions: ActionFilter[] = ['Todos', 'Criou', 'Editou', 'Removeu'];

  const filtered = auditLog.filter(e => {
    const matchModule = moduleFilter === 'Todos' || e.module === moduleFilter;
    const matchAction = actionFilter === 'Todos' || e.action === actionFilter;
    const matchSearch = !search || [e.targetName, e.userName, e.field, e.oldValue, e.newValue].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return matchModule && matchAction && matchSearch;
  });

  const counts = {
    Criou:   auditLog.filter(e => e.action === 'Criou').length,
    Editou:  auditLog.filter(e => e.action === 'Editou').length,
    Removeu: auditLog.filter(e => e.action === 'Removeu').length,
  };

  return (
    <div className="max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168,85,247,.15)' }}>
              <History size={18} className="text-purple-400" />
            </div>
            <h1 className="text-xl font-black text-[#1a2332]">Histórico de Alterações</h1>
          </div>
          <p className="text-gray-500 text-sm">Rastreabilidade completa de todas as modificações no sistema</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {Object.entries(counts).map(([action, n]) => {
            const ac = ACTION_COLORS[action];
            return (
              <div key={action} className="text-center px-3 py-2 rounded-xl hidden sm:block" style={{ background: ac.bg, border: `1px solid ${ac.bg}` }}>
                <div className="text-base font-black" style={{ color: ac.text }}>{n}</div>
                <div className="text-[10px] text-gray-500">{action}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: '#1a2332', border: '1px solid rgba(255,255,255,.06)' }}>
        {/* Search */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nome, usuário, campo ou valor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-2 text-sm rounded-xl outline-none text-white placeholder-gray-600"
            style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}
          />
        </div>

        {/* Module filter */}
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="text-[10px] text-gray-600 self-center flex items-center gap-1"><Filter size={10} /> Módulo:</span>
          {modules.map(m => (
            <button
              key={m}
              onClick={() => setModuleFilter(m)}
              className="text-xs font-semibold px-3 py-1 rounded-lg transition-all"
              style={{
                background: moduleFilter === m ? (MODULE_COLORS[m]?.bg ?? 'rgba(249,115,22,.12)') : 'rgba(255,255,255,.03)',
                color: moduleFilter === m ? (MODULE_COLORS[m]?.text ?? '#f97316') : '#475569',
                border: `1px solid ${moduleFilter === m ? (MODULE_COLORS[m]?.border ?? 'rgba(249,115,22,.25)') : 'rgba(255,255,255,.06)'}`,
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Action filter */}
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] text-gray-600 self-center flex items-center gap-1"><Filter size={10} /> Ação:</span>
          {actions.map(a => (
            <button
              key={a}
              onClick={() => setActionFilter(a)}
              className="text-xs font-semibold px-3 py-1 rounded-lg transition-all"
              style={{
                background: actionFilter === a ? (ACTION_COLORS[a]?.bg ?? 'rgba(255,255,255,.06)') : 'rgba(255,255,255,.03)',
                color: actionFilter === a ? (ACTION_COLORS[a]?.text ?? '#fff') : '#475569',
                border: `1px solid rgba(255,255,255,.06)`,
              }}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#1a2332', border: '1px solid rgba(255,255,255,.06)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2 text-[10px] font-bold text-gray-600 uppercase tracking-widest" style={{ background: 'rgba(255,255,255,.02)', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
          <div className="w-32 hidden sm:block">Data / Hora</div>
          <div className="w-20">Módulo</div>
          <div className="w-16">Ação</div>
          <div className="flex-1">Item</div>
          <div className="hidden md:block w-28">Usuário</div>
          <div className="w-4" />
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <History size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">Nenhum registro encontrado</p>
            {auditLog.length === 0 && (
              <p className="text-gray-700 text-xs mt-1">As alterações aparecerão aqui conforme você usar o sistema</p>
            )}
          </div>
        ) : (
          filtered.map(entry => <EntryRow key={entry.id} entry={entry} />)
        )}

        {filtered.length > 0 && (
          <div className="px-4 py-2 text-[10px] text-gray-600" style={{ borderTop: '1px solid rgba(255,255,255,.04)' }}>
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''} exibido{filtered.length !== 1 ? 's' : ''} · {auditLog.length} total
          </div>
        )}
      </div>
    </div>
  );
}
