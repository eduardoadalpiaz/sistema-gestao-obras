// Cliente da API: guarda o token de login, manda ele em toda chamada e avisa o sistema
// quando o servidor diz que a sessão venceu.
import { toast } from 'sonner';

// endereço da API: vem da variável VITE_API_BASE (em produção é /api, servido pelo Caddy).
// Sem ela, usa o backend local.
export const API_BASE = import.meta.env?.VITE_API_BASE ?? 'http://localhost:3001';

const TOKEN_KEY = 'dp_token';
const USER_KEY = 'dp_current_user';
export const SESSION_EXPIRED_EVENT = 'dp-session-expired';

// rotas que não exigem login (um 401 nelas é só "senha errada", não sessão vencida)
const PUBLIC_PATHS = ['/auth/login', '/auth/verify'];

export const getToken = (): string | null => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (token: string) => {
  // guarda o token no navegador
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* sem armazenamento: segue sem guardar */ }
};
// usuário logado guardado no navegador (só os campos já limpos pelo contexto)
export const getStoredUser = (): string | null => {
  try { return localStorage.getItem(USER_KEY); } catch { return null; }
};
export const setStoredUser = (user: Record<string, string | boolean> | null) => {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch { /* sem armazenamento: segue sem guardar */ }
};
export const clearSession = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch { /* nada a limpar */ }
};

// erro da API: guarda o status HTTP e o texto que o servidor devolveu
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// o servidor responde { message } ou { error }: pega o texto, ou usa o padrão
export function readApiMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    try {
      const body = JSON.parse(err.message);
      const text = body?.message ?? body?.error;
      if (typeof text === 'string' && text) return text;
    } catch { /* não veio JSON */ }
  }
  return fallback;
}

// única função que fala com o backend: monta a URL, manda JSON com o token e, se a resposta
// não for de sucesso, joga um ApiError com o texto que o servidor devolveu
export async function api<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      // se há token, vai no cabeçalho Authorization
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((opts?.headers as Record<string, string> | undefined) ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    // 401 fora das telas de login: limpa a sessão e volta ao login
    if (res.status === 401 && !PUBLIC_PATHS.includes(path)) {
      // sessão vencida ou usuário desativado: limpa tudo e o sistema volta pro login
      clearSession();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    } else if (res.status === 403) {
      toast.error(readApiMessage(new ApiError(text, 403), 'Você não tem permissão para essa ação.'));
    } else if (res.status === 413) {
      toast.error('Arquivo muito grande para enviar.');
    }
    throw new ApiError(text || `HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}
