// Telas: login, menu lateral por perfil e histórico de alterações (acesso restrito e filtros).
import { describe, test, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ConstructionManagementProvider } from '../src/app/context/construction-context';
import { LoginPage } from '../src/app/sistema/LoginPage';
import { AppShell } from '../src/app/sistema/AppShell';
import { AuditLog } from '../src/app/sistema/AuditLog';
import { setToken, getToken } from '../src/app/utils/api';
import { mockApi, admin, dadosVazios } from './helpers';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const Painel = () => <div>Tela do painel</div>;

// monta as telas dentro do roteador e do contexto, como no sistema de verdade
function renderTela(inicial: string) {
  const router = createMemoryRouter([
    { path: '/login', Component: LoginPage },
    { path: '/', Component: AppShell, children: [
      { path: 'dashboard', Component: Painel },
      { path: 'historico', Component: AuditLog },
    ] },
  ], { initialEntries: [inicial] });
  render(<ConstructionManagementProvider><RouterProvider router={router} /></ConstructionManagementProvider>);
  return router;
}

function logarComo(role: string, data: Record<string, unknown> = {}, rotas: Parameters<typeof mockApi>[0] = {}) {
  const usuario = { ...admin, role };
  setToken('token-de-teste');
  localStorage.setItem('dp_current_user', JSON.stringify(usuario));
  return mockApi({ 'GET /data': { body: { ...dadosVazios, users: [usuario], ...data } }, ...rotas });
}

describe('tela de login', () => {
  test('mostra o formulário de e-mail e senha', () => {
    mockApi({});
    renderTela('/login');
    expect(screen.getByPlaceholderText(/seu.email@/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  test('senha errada mostra a mensagem e continua na tela de login', async () => {
    mockApi({ 'POST /auth/login': { status: 401, body: { error: 'E-mail ou senha incorretos.' } } });
    const router = renderTela('/login');
    const u = userEvent.setup();
    await u.type(screen.getByPlaceholderText(/seu.email@/i), 'admin@obras.com');
    await u.type(screen.getByPlaceholderText('••••••••'), 'errada123');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(getToken()).toBeNull();
  });

  test('o botão do olho mostra e esconde a senha', async () => {
    mockApi({});
    renderTela('/login');
    const u = userEvent.setup();
    const campo = screen.getByPlaceholderText('••••••••');
    expect(campo).toHaveAttribute('type', 'password');
    await u.click(campo.parentElement!.querySelector('button')!);
    expect(campo).toHaveAttribute('type', 'text');
  });

  test('login certo leva ao painel', async () => {
    mockApi({
      'POST /auth/login': { body: { success: true, user: admin, token: 'tok' } },
      'GET /data': { body: dadosVazios },
    });
    const router = renderTela('/login');
    const u = userEvent.setup();
    await u.type(screen.getByPlaceholderText(/seu.email@/i), 'admin@obras.com');
    await u.type(screen.getByPlaceholderText('••••••••'), 'senha-correta');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(await screen.findByText('Tela do painel')).toBeInTheDocument();
  });

  test('conta nova troca para a tela do código de verificação', async () => {
    mockApi({
      'POST /auth/login': { body: { needsVerification: true, user: { ...admin, name: 'Maria' }, verifyToken: 'vt' } },
      'POST /auth/verify': { status: 400, body: { error: 'Código inválido.' } },
    });
    renderTela('/login');
    const u = userEvent.setup();
    await u.type(screen.getByPlaceholderText(/seu.email@/i), 'maria@obras.com');
    await u.type(screen.getByPlaceholderText('••••••••'), 'senha-correta');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Verificação de Conta')).toBeInTheDocument();
    expect(screen.getByText('Maria')).toBeInTheDocument();
    await u.type(screen.getByPlaceholderText('000000'), '111111');
    await u.click(screen.getByRole('button', { name: 'Verificar e Entrar' }));
    expect(await screen.findByText('Código inválido.')).toBeInTheDocument();
  });

  test('quem já tem sessão vai direto ao painel', async () => {
    logarComo('Administrativo');
    const router = renderTela('/login');
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });
});

describe('menu lateral (AppShell)', () => {
  test('sem sessão, volta para o login', async () => {
    mockApi({});
    const router = renderTela('/dashboard');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  test('mostra o usuário, o perfil e que está sincronizado', async () => {
    logarComo('Engenheiro');
    renderTela('/dashboard');
    expect(await screen.findByText('Sincronizado')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Engenheiro')).toBeInTheDocument();
    expect(screen.getByText('Tela do painel')).toBeInTheDocument();
  });

  test('o link do Histórico só aparece para TI e Dono', async () => {
    logarComo('Visualizador');
    renderTela('/dashboard');
    await screen.findByText('Sincronizado');
    expect(screen.queryByText('Histórico')).not.toBeInTheDocument();
  });

  test('TI vê o link do Histórico', async () => {
    logarComo('TI');
    renderTela('/dashboard');
    await screen.findByText('Sincronizado');
    expect(screen.getByText('Histórico')).toBeInTheDocument();
  });

  test('mostra a quantidade de notificações não lidas no Dashboard (9+ quando passa de 9)', async () => {
    const notifs = Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, type: 'info', message: 'x', read: false, createdAt: '' }));
    logarComo('Administrativo', { notifications: notifs });
    renderTela('/dashboard');
    expect(await screen.findByText('9+')).toBeInTheDocument();
  });

  test('sair apaga a sessão e volta para o login', async () => {
    logarComo('Administrativo');
    const router = renderTela('/dashboard');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: /Sair/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(getToken()).toBeNull();
  });
});

describe('histórico de alterações', () => {
  const registros = [
    { id: 'a1', userId: 'u1', userName: 'Admin', action: 'Criou', module: 'Obras', targetName: 'Edifício Aurora', createdAt: '2026-10-01T10:00:00Z' },
    { id: 'a2', userId: 'u1', userName: 'Admin', action: 'Editou', module: 'Obras', targetName: 'Edifício Aurora', field: 'client', oldValue: 'Antigo', newValue: 'Novo', createdAt: '2026-10-02T10:00:00Z' },
    { id: 'a3', userId: 'u2', userName: 'Maria', action: 'Removeu', module: 'Despesas', targetName: 'Cimento (Edifício Aurora)', createdAt: '2026-10-03T10:00:00Z' },
  ];

  test('quem não é TI nem Dono vê "Acesso restrito", mesmo digitando a URL', async () => {
    logarComo('Administrativo', { audit: registros });
    renderTela('/historico');
    expect(await screen.findByText('Acesso restrito')).toBeInTheDocument();
    expect(screen.queryByText('Edifício Aurora')).not.toBeInTheDocument();
  });

  test('Dono vê os registros e os totais por ação', async () => {
    logarComo('Dono', { audit: registros });
    renderTela('/historico');
    expect(await screen.findByText('Histórico de Alterações')).toBeInTheDocument();
    expect(screen.getAllByText('Edifício Aurora')).toHaveLength(2);
    expect(screen.getByText(/3 registros exibidos · 3 total/)).toBeInTheDocument();
  });

  test('filtra por ação, por módulo e pela busca de texto', async () => {
    logarComo('TI', { audit: registros });
    renderTela('/historico');
    const u = userEvent.setup();
    await screen.findByText('Histórico de Alterações');

    await u.click(screen.getByRole('button', { name: 'Removeu' }));
    expect(screen.getByText(/1 registro exibido · 3 total/)).toBeInTheDocument();
    expect(screen.queryByText('campo: client')).not.toBeInTheDocument();

    await u.click(screen.getAllByRole('button', { name: 'Todos' })[1]); // volta a ação para "Todos"
    await u.click(screen.getByRole('button', { name: 'Obras' }));
    expect(screen.getByText(/2 registros exibidos · 3 total/)).toBeInTheDocument();
  });

  test('busca por texto e mensagem de lista vazia', async () => {
    logarComo('TI', { audit: registros });
    renderTela('/historico');
    const u = userEvent.setup();
    await screen.findByText('Histórico de Alterações');
    await u.type(screen.getByPlaceholderText(/Buscar por nome/), 'maria');
    expect(screen.getByText(/1 registro exibido/)).toBeInTheDocument();
    await u.clear(screen.getByPlaceholderText(/Buscar por nome/));
    await u.type(screen.getByPlaceholderText(/Buscar por nome/), 'xyz-nao-existe');
    expect(screen.getByText('Nenhum registro encontrado')).toBeInTheDocument();
  });

  test('clicar em uma edição mostra o valor anterior e o novo', async () => {
    logarComo('TI', { audit: registros });
    renderTela('/historico');
    const u = userEvent.setup();
    await screen.findByText('Histórico de Alterações');
    await u.click(screen.getByText('campo: client'));
    expect(screen.getByText('Antigo')).toBeInTheDocument();
    expect(screen.getByText('Novo')).toBeInTheDocument();
  });

  test('sem registros, explica que eles aparecem conforme o uso', async () => {
    logarComo('Dono', { audit: [] });
    renderTela('/historico');
    expect(await screen.findByText(/aparecerão aqui/)).toBeInTheDocument();
  });
});
