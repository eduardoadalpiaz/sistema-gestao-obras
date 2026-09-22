/**
 * LoginPage.tsx
 * Entry point for system authentication.
 * Supports two flows: password login and first-time account verification.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Mail, Lock, Building2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useConstructionManagement } from '../context/construction-context';

export function LoginPage() {
  const { login, verifyAccountCode, pendingVerificationUser } = useConstructionManagement();
  const navigate = useNavigate();

  // Login form state
  const [emailInput,    setEmailInput]    = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword,  setShowPassword]  = useState(false);
  const [loginError,    setLoginError]    = useState('');
  const [isSubmitting,  setIsSubmitting]  = useState(false);

  // Verification form state
  const [verificationCode,  setVerificationCode]  = useState('');
  const [verificationError, setVerificationError] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmitting(true);
    const result = await login(emailInput.trim(), passwordInput);
    setIsSubmitting(false);
    if (result.success) {
      navigate('/dashboard');
    } else if (!result.needsVerification) {
      setLoginError(result.error || 'Erro ao entrar.');
    }
    // When needsVerification=true, the pending user is set in context
    // and the component automatically shows the verification form.
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError('');
    const verified = await verifyAccountCode(verificationCode.trim());
    if (verified) {
      navigate('/dashboard');
    } else {
      setVerificationError('Código inválido. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen bg-[#1a2332] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-10">

          {/* Brand header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg">
              <Building2 size={32} className="text-white" />
            </div>
            <h1 className="text-[#1a2332] text-2xl font-black text-center">Dal Piaz Incorporadora</h1>
            <p className="text-blue-600 text-sm mt-1 font-medium">Sistema de Gestão de Obras</p>
          </div>

          {!pendingVerificationUser ? (
            /* ── Credentials Form ───────────────────────────────────────── */
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    required
                    placeholder="seu.email@dalpiazincorporadora.com.br"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Senha</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isSubmitting
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Entrando...</>
                  : 'Entrar'}
              </button>

              <p className="text-center text-xs text-blue-500 mt-2">
                Acesso restrito a usuários cadastrados pela empresa.
              </p>
            </form>
          ) : (
            /* ── Account Verification Form ──────────────────────────────── */
            <form onSubmit={handleVerificationSubmit} className="space-y-5">
              <div className="text-center mb-2">
                <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck size={28} className="text-blue-600" />
                </div>
                <h2 className="text-lg font-black text-[#1a2332]">Verificação de Conta</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Olá, <strong>{pendingVerificationUser.name}</strong>! Insira o código de verificação
                  fornecido pelo administrador.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Código de Verificação</label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={e => setVerificationCode(e.target.value)}
                  required
                  maxLength={6}
                  placeholder="000000"
                  className="w-full text-center text-2xl font-black tracking-[0.5em] py-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition"
                />
              </div>

              {verificationError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">
                  {verificationError}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors"
              >
                Verificar e Entrar
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
