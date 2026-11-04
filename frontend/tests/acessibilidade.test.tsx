// Acessibilidade (RNF11): confere cada tela com o axe-core e espera zero violações.
import { describe, test, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ConstructionManagementProvider } from '../src/app/context/construction-context';
import { LoginPage } from '../src/app/sistema/LoginPage';
import { AppShell } from '../src/app/sistema/AppShell';
import { ConstructionDashboard } from '../src/app/sistema/ConstructionDashboard';
import { Projects } from '../src/app/sistema/Projects';
import { ProjectSchedule } from '../src/app/sistema/ProjectSchedule';
import { Expenses } from '../src/app/sistema/Expenses';
import { ProjectDocuments } from '../src/app/sistema/ProjectDocuments';
import { Reports } from '../src/app/sistema/Reports';
import { TeamManagement } from '../src/app/sistema/TeamManagement';
import { AuditLog } from '../src/app/sistema/AuditLog';
import { setToken } from '../src/app/utils/api';
import { mockApi, admin, dadosVazios, obra, etapa } from './helpers';

// o navegador simulado (jsdom) não tem ResizeObserver, que os gráficos usam
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const telas: Array<[string, string, React.ComponentType]> = [
  ['login', '/login', LoginPage],
  ['dashboard', '/dashboard', ConstructionDashboard],
  ['obras', '/obras', Projects],
  ['cronograma', '/cronograma', ProjectSchedule],
  ['gastos', '/gastos', Expenses],
  ['documentos', '/documentos', ProjectDocuments],
  ['relatorios', '/relatorios', Reports],
  ['usuarios', '/usuarios', TeamManagement],
  ['historico', '/historico', AuditLog],
];

async function violacoes(caminho: string, Tela: React.ComponentType) {
  // o login só aparece para quem não entrou; as demais telas, para quem entrou
  if (caminho !== '/login') {
    setToken('token-de-teste');
    localStorage.setItem('dp_current_user', JSON.stringify(admin));
  }
  mockApi({ 'GET /data': { body: { ...dadosVazios, obras: [obra()], stages: [etapa()] } } });
  const router = createMemoryRouter([
    { path: '/login', Component: LoginPage },
    { path: '/', Component: AppShell, children: [{ path: caminho.slice(1), Component: Tela }] },
  ], { initialEntries: [caminho] });
  const { container } = render(<ConstructionManagementProvider><RouterProvider router={router} /></ConstructionManagementProvider>);
  await waitFor(() => expect(container.innerHTML.length).toBeGreaterThan(200));
  await new Promise(r => setTimeout(r, 50));
  // contraste de cor precisa de layout real, que o jsdom não tem
  const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return r.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).slice(0, 4).join(' | ')}`);
}

describe('acessibilidade das telas (axe-core)', () => {
  for (const [nome, caminho, Tela] of telas) {
    test(`${nome} não tem violações`, async () => {
      expect(await violacoes(caminho, Tela)).toEqual([]);
    });
  }
});
