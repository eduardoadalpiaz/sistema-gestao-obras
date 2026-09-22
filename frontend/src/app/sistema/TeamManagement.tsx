/**
 * TeamManagement.tsx
 * User and staff management screen — only Administrators can
 * create, edit, activate/deactivate, or remove team members.
 */
import { useState } from 'react';
import {
  useConstructionManagement, TeamMember, StaffRole, AccountStatus,
} from '../context/construction-context';
import { Plus, Pencil, Trash2, UserX, UserCheck, X, ShieldCheck, Info, KeyRound } from 'lucide-react';

const ASSIGNABLE_ROLES: StaffRole[] = ['Administrativo', 'Engenheiro', 'Mestre de Obras', 'Visualizador', 'TI', 'Dono'];

const EMPTY_MEMBER_FORM = {
  name:     '',
  email:    '',
  password: '',
  phone:    '',
  role:     'Engenheiro' as StaffRole,
  status:   'Ativo'      as AccountStatus,
};

const getRoleBadgeClasses = (role: StaffRole): string => {
  if (role === 'Administrativo') return 'bg-purple-100 text-purple-700';
  if (role === 'Engenheiro')     return 'bg-blue-100 text-blue-700';
  if (role === 'TI')             return 'bg-teal-100 text-teal-700';
  if (role === 'Dono')           return 'bg-amber-100 text-amber-700';
  if (role === 'Visualizador')   return 'bg-gray-100 text-gray-600';
  return 'bg-orange-100 text-orange-700';
};

export function TeamManagement() {
  const {
    teamMembers, registerTeamMember, updateTeamMember, removeTeamMember, activeUser,
  } = useConstructionManagement();

  const isAdministrator = activeUser?.role === 'Administrativo';

  const [activeModal,        setActiveModal]        = useState<'add' | 'edit' | 'delete' | 'code' | 'viewCode' | null>(null);
  const [selectedMember,     setSelectedMember]     = useState<TeamMember | null>(null);
  const [memberForm,         setMemberForm]         = useState(EMPTY_MEMBER_FORM);
  const [newMemberCode,      setNewMemberCode]      = useState('');
  const [isEmailTouched,     setIsEmailTouched]     = useState(false);

  // ── Modal handlers ────────────────────────────────────────────────────────────

  const openAddModal = () => {
    setMemberForm(EMPTY_MEMBER_FORM);
    setIsEmailTouched(false);
    setActiveModal('add');
  };

  const openEditModal = (member: TeamMember) => {
    setSelectedMember(member);
    setMemberForm({
      name:     member.name,
      email:    member.email.toLowerCase(),
      password: member.password,
      phone:    member.phone,
      role:     member.role,
      status:   member.status,
    });
    setIsEmailTouched(false);
    setActiveModal('edit');
  };

  const openDeleteModal = (member: TeamMember) => {
    setSelectedMember(member);
    setActiveModal('delete');
  };

  const openVerificationCodeModal = (member: TeamMember) => {
    setSelectedMember(member);
    setNewMemberCode(member.verificationCode ?? '');
    setActiveModal('viewCode');
  };

  const closeModal = () => { setActiveModal(null); setSelectedMember(null); };

  // ── Form handlers ─────────────────────────────────────────────────────────────

  const handleMemberFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Normalise email to lowercase in real time
    setMemberForm(prev => ({ ...prev, [name]: name === 'email' ? value.toLowerCase() : value }));
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const verificationCode = await registerTeamMember({
      name:     memberForm.name,
      email:    memberForm.email,
      password: memberForm.password,
      phone:    memberForm.phone,
      role:     memberForm.role,
      status:   memberForm.status,
      verified: false,
    });
    setNewMemberCode(verificationCode);
    setActiveModal('code');
  };

  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    await updateTeamMember(selectedMember.id, {
      name:     memberForm.name,
      email:    memberForm.email,
      password: memberForm.password,
      phone:    memberForm.phone,
      role:     memberForm.role,
      status:   memberForm.status,
    });
    closeModal();
  };

  const handleDeleteMember = async () => {
    if (selectedMember) await removeTeamMember(selectedMember.id);
    closeModal();
  };

  const toggleMemberStatus = async (member: TeamMember) => {
    await updateTeamMember(member.id, {
      status: member.status === 'Ativo' ? 'Inativo' : 'Ativo',
    });
  };

  const showCorporateEmailWarning =
    isEmailTouched &&
    memberForm.email.length > 0 &&
    !memberForm.email.endsWith('@dalpiazincorporadora.com.br');

  const baseInputClass = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 transition';

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#1a2332]">Gestão de Usuários</h1>
          <p className="text-gray-500 text-sm">Gerencie os usuários do sistema</p>
        </div>
        {isAdministrator && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-[#E8821A] text-white font-bold px-5 py-2.5 rounded-xl hover:bg-[#d4731a] transition text-sm"
          >
            <Plus size={16} /> Novo Usuário
          </button>
        )}
      </div>

      {/* Non-admin notice */}
      {!isAdministrator && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 text-sm text-yellow-700 flex items-center gap-2">
          <Info size={16} className="shrink-0" />
          Apenas Administradores podem criar, editar ou excluir usuários.
        </div>
      )}

      {/* Desktop table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-gray-400 font-semibold px-6 py-4">Nome</th>
              <th className="text-left text-gray-400 font-semibold px-4 py-4">Email Corporativo</th>
              <th className="text-left text-gray-400 font-semibold px-4 py-4">Cargo</th>
              <th className="text-left text-gray-400 font-semibold px-4 py-4">Status</th>
              <th className="text-left text-gray-400 font-semibold px-4 py-4">Verificado</th>
              {isAdministrator && (
                <th className="text-left text-gray-400 font-semibold px-4 py-4">Ações</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {teamMembers.map(member => (
              <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-[#1a2332]">{member.name}</div>
                  <div className="text-gray-400 text-xs">{member.phone || '—'}</div>
                </td>
                <td className="px-4 py-4 text-gray-500 text-xs">{member.email.toLowerCase()}</td>
                <td className="px-4 py-4">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getRoleBadgeClasses(member.role)}`}>
                    {member.role}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    member.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {member.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  {member.verified ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                      <ShieldCheck size={14} /> Verificado
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-orange-500 font-semibold">Pendente</span>
                      {isAdministrator && member.verificationCode && (
                        <button
                          onClick={() => openVerificationCodeModal(member)}
                          title="Ver código de verificação"
                          className="text-orange-400 hover:text-orange-600 transition"
                        >
                          <KeyRound size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </td>
                {isAdministrator && (
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEditModal(member)} className="text-orange-500 hover:text-orange-700 transition" title="Editar">
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => toggleMemberStatus(member)}
                        className={`transition ${member.status === 'Ativo' ? 'text-yellow-500 hover:text-yellow-700' : 'text-green-500 hover:text-green-700'}`}
                        title={member.status === 'Ativo' ? 'Desativar' : 'Ativar'}
                      >
                        {member.status === 'Ativo' ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                      {member.id !== activeUser?.id && (
                        <button onClick={() => openDeleteModal(member)} className="text-red-500 hover:text-red-700 transition" title="Excluir">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {teamMembers.map(member => (
          <div key={member.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-bold text-[#1a2332]">{member.name}</div>
                <div className="text-gray-400 text-xs mt-0.5">{member.email}</div>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getRoleBadgeClasses(member.role)}`}>
                {member.role}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${member.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {member.status}
              </span>
              {member.verified
                ? <span className="text-xs text-green-600 font-semibold flex items-center gap-0.5"><ShieldCheck size={12} /> Verificado</span>
                : <span className="text-xs text-orange-500 font-semibold">Pendente</span>}
            </div>
            {isAdministrator && (
              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <button onClick={() => openEditModal(member)} className="flex items-center gap-1 text-xs text-orange-500 font-semibold">
                  <Pencil size={13} /> Editar
                </button>
                <button onClick={() => toggleMemberStatus(member)} className={`flex items-center gap-1 text-xs font-semibold ${member.status === 'Ativo' ? 'text-yellow-500' : 'text-green-500'}`}>
                  {member.status === 'Ativo' ? <><UserX size={13} /> Desativar</> : <><UserCheck size={13} /> Ativar</>}
                </button>
                {member.id !== activeUser?.id && (
                  <button onClick={() => openDeleteModal(member)} className="flex items-center gap-1 text-xs text-red-500 font-semibold ml-auto">
                    <Trash2 size={13} /> Excluir
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Add / Edit Modal ───────────────────────────────────────────────────── */}
      {(activeModal === 'add' || activeModal === 'edit') && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg my-8 p-7 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-[#1a2332]">
                {activeModal === 'add' ? 'Novo Usuário' : 'Editar Usuário'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <form onSubmit={activeModal === 'add' ? handleAddMember : handleEditMember} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Completo *</label>
                <input name="name" value={memberForm.name} onChange={handleMemberFormChange} required className={baseInputClass} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email Corporativo *</label>
                <input
                  name="email" type="email" value={memberForm.email}
                  onChange={e => { setIsEmailTouched(true); handleMemberFormChange(e); }}
                  required className={baseInputClass}
                  placeholder="nome@dalpiazincorporadora.com.br"
                />
                {showCorporateEmailWarning && (
                  <p className="text-yellow-600 text-xs mt-1 flex items-center gap-1">
                    <Info size={11} /> Recomendamos usar o email corporativo @dalpiazincorporadora.com.br
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Senha *</label>
                <input name="password" type="text" value={memberForm.password} onChange={handleMemberFormChange} required className={baseInputClass} placeholder="Senha de acesso" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Telefone</label>
                  <input name="phone" value={memberForm.phone} onChange={handleMemberFormChange} placeholder="(54) 9 9999-0000" className={baseInputClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Cargo *</label>
                  <select name="role" value={memberForm.role} onChange={handleMemberFormChange} required className={baseInputClass + ' bg-white'}>
                    {ASSIGNABLE_ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Status *</label>
                  <select name="status" value={memberForm.status} onChange={handleMemberFormChange} className={baseInputClass + ' bg-white'}>
                    <option>Ativo</option>
                    <option>Inativo</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal}
                  className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 bg-[#E8821A] text-white font-bold py-2.5 rounded-xl hover:bg-[#d4731a] transition text-sm">
                  {activeModal === 'add' ? 'Cadastrar Usuário' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Verification Code Display Modal ──────────────────────────────────── */}
      {(activeModal === 'code' || activeModal === 'viewCode') && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-sm p-7 shadow-2xl text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck size={28} className="text-blue-600" />
            </div>
            <h2 className="text-xl font-black text-[#1a2332] mb-2">Código de Verificação</h2>
            {activeModal === 'code' && (
              <p className="text-gray-500 text-sm mb-4">
                O usuário <strong>{memberForm.name}</strong> precisa deste código para ativar a conta.
              </p>
            )}
            {activeModal === 'viewCode' && selectedMember && (
              <p className="text-gray-500 text-sm mb-4">
                Código de verificação de <strong>{selectedMember.name}</strong>:
              </p>
            )}
            <div className="bg-gray-50 rounded-2xl p-6 mb-5">
              <div className="text-4xl font-black tracking-widest text-[#1a2332]">
                {newMemberCode || '—'}
              </div>
              <p className="text-gray-400 text-xs mt-2">Compartilhe com o usuário via canal seguro</p>
            </div>
            <button
              onClick={closeModal}
              className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl hover:bg-blue-700 transition text-sm"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ──────────────────────────────────────────── */}
      {activeModal === 'delete' && selectedMember && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-sm p-7 shadow-2xl text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h2 className="text-xl font-black text-[#1a2332] mb-2">Excluir Usuário</h2>
            <p className="text-gray-500 text-sm mb-6">
              Tem certeza que deseja excluir <strong>"{selectedMember.name}"</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button onClick={closeModal}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">
                Cancelar
              </button>
              <button onClick={handleDeleteMember}
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
