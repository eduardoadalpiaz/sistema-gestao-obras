// Apoio dos testes do front: API de mentira (fetch), dados de exemplo e login já feito.
import { vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ConstructionManagementProvider, useConstructionManagement } from '../src/app/context/construction-context';
import { setToken } from '../src/app/utils/api';

export const admin = {
  id: 'u1', name: 'Admin', email: 'admin@obras.com', password: '', phone: '',
  role: 'Administrativo', status: 'Ativo', verified: true, createdAt: '2026-01-01',
};

export const obra = (extra: Record<string, unknown> = {}) => ({
  id: 'o1', name: 'Edifício Aurora', client: 'Cliente', cep: '', street: '', neighborhood: '', city: '', state: '',
  responsibleId: 'u1', status: 'Em andamento', progress: 0, startDate: '2026-01-01', endDate: '2026-12-31',
  createdAt: '2026-01-01', ...extra,
});

export const etapa = (extra: Record<string, unknown> = {}) => ({
  id: 's1', obraId: 'o1', name: 'Fundação', responsibleId: 'u1', plannedStart: '2026-01-01', plannedEnd: '2026-02-01',
  progress: 0, status: 'Não iniciada', ...extra,
});

export const dadosVazios = {
  users: [admin], obras: [], stages: [], notifications: [], gastos: [], documentos: [], audit: [],
};

type Rota = (init: RequestInit | undefined, url: string) => { status?: number; body?: unknown };

// Troca o fetch por uma API de mentira. As rotas são "MÉTODO /caminho". /events devolve 401
// pra o sistema desistir da conexão de tempo real (não é o foco desses testes).
export function mockApi(rotas: Record<string, Rota | { status?: number; body?: unknown }>) {
  const chamadas: Array<{ chave: string; body: unknown }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const caminho = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '');
    const chave = `${init?.method ?? 'GET'} ${caminho}`;
    if (caminho === '/events') return new Response('', { status: 401 });
    chamadas.push({ chave, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const rota = rotas[chave];
    if (!rota) return new Response(JSON.stringify({ message: `sem rota ${chave}` }), { status: 404 });
    const r = typeof rota === 'function' ? rota(init, url) : rota;
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, chamadas, foi: (chave: string) => chamadas.filter(c => c.chave === chave) };
}

// Monta o contexto com um usuário já logado (token e usuário guardados no navegador) e espera os dados carregarem.
export async function renderLogado(data: Partial<typeof dadosVazios> = {}, extras: Parameters<typeof mockApi>[0] = {}) {
  setToken('token-de-teste');
  localStorage.setItem('dp_current_user', JSON.stringify(admin));
  const api = mockApi({ 'GET /data': { body: { ...dadosVazios, ...data } }, ...extras });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ConstructionManagementProvider>{children}</ConstructionManagementProvider>
  );
  const hook = renderHook(() => useConstructionManagement(), { wrapper });
  await waitFor(() => expect(hook.result.current.isInitializing).toBe(false));
  return { ...hook, api };
}

export function renderDeslogado() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ConstructionManagementProvider>{children}</ConstructionManagementProvider>
  );
  return renderHook(() => useConstructionManagement(), { wrapper });
}
