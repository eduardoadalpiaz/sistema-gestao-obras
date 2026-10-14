// Tela de usuários: só o administrador gerencia; cadastro com código de verificação, ativar/desativar e remover.
import { describe, test, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConstructionManagementProvider } from '../src/app/context/construction-context';
import { TeamManagement } from '../src/app/sistema/TeamManagement';
import { setToken } from '../src/app/utils/api';
import { mockApi, admin, dadosVazios } from './helpers';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const maria = { ...admin, id: 'u2', name: 'Maria Souza', email: 'Maria@Obras.com', role: 'Engenheiro', verified: false, verificationCode: '445566' };

async function abrir(role: string, rotas: Parameters<typeof mockApi>[0] = {}) {
  const eu = { ...admin, role };
  setToken('token-de-teste');
  localStorage.setItem('dp_current_user', JSON.stringify(eu));
  const api = mockApi({ 'GET /data': { body: { ...dadosVazios, users: [eu, maria] } }, ...rotas });
  render(<ConstructionManagementProvider><TeamManagement /></ConstructionManagementProvider>);
  await screen.findAllByText('Maria Souza');
  return api;
}

// campos do formulário, achados pelo rótulo (como uma pessoa, ou um leitor de tela, encontraria)
const ROTULOS: Record<string, RegExp> = { name: /Nome Completo/, email: /Email Corporativo/, password: /Senha/, role: /Cargo/ };
const campo = (nome: string) => screen.getByLabelText(ROTULOS[nome]) as HTMLInputElement;
// linha da Maria na tabela (a versão de computador)
const linhaMaria = () => screen.getAllByText('Maria Souza')[0].closest('tr') as HTMLElement;

describe('quem pode gerenciar', () => {
  test('administrador vê o botão de novo usuário e as ações', async () => {
    await abrir('Administrativo');
    expect(screen.getByRole('button', { name: /Novo Usuário/ })).toBeInTheDocument();
    expect(screen.getAllByTitle('Editar').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Apenas Administradores/)).not.toBeInTheDocument();
  });

  test('os outros perfis só veem a lista e um aviso', async () => {
    for (const role of ['Engenheiro']) {
      await abrir(role);
      expect(screen.queryByRole('button', { name: /Novo Usuário/ })).not.toBeInTheDocument();
      expect(screen.queryByTitle('Editar')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Excluir')).not.toBeInTheDocument();
      expect(screen.getByText(/Apenas Administradores/)).toBeInTheDocument();
    }
  });

  test('e-mail aparece em minúsculo', async () => {
    await abrir('Administrativo');
    expect(screen.getByText('maria@obras.com')).toBeInTheDocument();
  });

  test('o administrador não tem o botão de excluir a si mesmo', async () => {
    await abrir('Administrativo');
    // há 2 usuários na lista, mas só 1 botão de excluir (o da Maria)
    expect(screen.getAllByTitle('Excluir')).toHaveLength(1);
  });
});

describe('cadastro', () => {
  test('cadastrar mostra o código de verificação para repassar à pessoa', async () => {
    const novo = { ...maria, id: 'u3', name: 'João Lima', email: 'joao@dalpiazincorporadora.com.br' };
    const api = await abrir('Administrativo', {
      'POST /users': { body: { user: novo, verificationCode: '778899' } },
      'POST /audit': { body: { entry: { id: 'a' } } },
    });
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: /Novo Usuário/ }));
    await u.type(campo('name'), 'João Lima');
    await u.type(campo('email'), 'joao@dalpiazincorporadora.com.br');
    await u.type(campo('password'), 'senha-forte-123');
    await u.click(screen.getByRole('button', { name: 'Cadastrar Usuário' }));
    expect(await screen.findByText('778899')).toBeInTheDocument();
    expect(api.foi('POST /users')[0].body).toMatchObject({ name: 'João Lima', role: 'Engenheiro', verified: false });
    await u.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByText('778899')).not.toBeInTheDocument();
  });

  test('avisa (sem bloquear) quando o e-mail não é do domínio da empresa', async () => {
    await abrir('Administrativo');
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: /Novo Usuário/ }));
    await u.type(campo('email'), 'alguem@gmail.com');
    await u.tab();
    expect(await screen.findByText(/dalpiazincorporadora/i, { selector: ':not(input)' })).toBeInTheDocument();
  });

  test('o administrador consegue rever o código de uma conta ainda não verificada', async () => {
    await abrir('Administrativo');
    const u = userEvent.setup();
    await u.click(within(linhaMaria()).getByTitle('Ver código de verificação'));
    expect(await screen.findByText('445566')).toBeInTheDocument();
  });
});

describe('edição, status e remoção', () => {
  test('desativar um usuário envia o novo status para a API', async () => {
    const api = await abrir('Administrativo', {
      'PUT /users/u2': { body: { user: { ...maria, status: 'Inativo' } } },
      'POST /audit': { body: { entry: { id: 'a' } } },
    });
    const u = userEvent.setup();
    await u.click(within(linhaMaria()).getByTitle('Desativar'));
    await waitFor(() => expect(api.foi('PUT /users/u2')).toHaveLength(1));
    expect(api.foi('PUT /users/u2')[0].body).toEqual({ status: 'Inativo' });
  });

  test('editar sem digitar senha mantém a senha atual (não envia o campo)', async () => {
    const api = await abrir('Administrativo', {
      'PUT /users/u2': { body: { user: { ...maria, role: 'Visualizador' } } },
      'POST /audit': { body: { entry: { id: 'a' } } },
    });
    const u = userEvent.setup();
    await u.click(within(linhaMaria()).getByTitle('Editar'));
    expect(campo('name')).toHaveValue('Maria Souza');
    expect(campo('password')).toHaveValue('');
    expect(campo('password')).not.toBeRequired();
    await u.selectOptions(campo('role'), 'Visualizador');
    await u.click(screen.getByRole('button', { name: 'Salvar Alterações' }));
    await waitFor(() => expect(api.foi('PUT /users/u2')).toHaveLength(1));
    const enviado = api.foi('PUT /users/u2')[0].body as Record<string, unknown>;
    expect(enviado).toMatchObject({ role: 'Visualizador', name: 'Maria Souza' });
    expect(enviado).not.toHaveProperty('password');
  });

  test('no cadastro a senha continua obrigatória', async () => {
    await abrir('Administrativo');
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: /Novo Usuário/ }));
    expect(campo('password')).toBeRequired();
  });

  test('editar com senha nova envia a senha', async () => {
    const api = await abrir('Administrativo', {
      'PUT /users/u2': { body: { user: { ...maria, role: 'Visualizador' } } },
      'POST /audit': { body: { entry: { id: 'a' } } },
    });
    const u = userEvent.setup();
    await u.click(within(linhaMaria()).getByTitle('Editar'));
    expect(campo('name')).toHaveValue('Maria Souza');
    await u.selectOptions(campo('role'), 'Visualizador');
    await u.type(campo('password'), 'nova-senha-123');
    await u.click(screen.getByRole('button', { name: 'Salvar Alterações' }));
    await waitFor(() => expect(api.foi('PUT /users/u2')).toHaveLength(1));
    expect(api.foi('PUT /users/u2')[0].body).toMatchObject({ role: 'Visualizador', name: 'Maria Souza', password: 'nova-senha-123' });
  });

  test('remover pede confirmação e só apaga depois', async () => {
    const api = await abrir('Administrativo', {
      'DELETE /users/u2': { body: { success: true } },
      'POST /audit': { body: { entry: { id: 'a' } } },
    });
    const u = userEvent.setup();
    await u.click(within(linhaMaria()).getByTitle('Excluir'));
    expect(api.foi('DELETE /users/u2')).toHaveLength(0); // ainda não apagou
    const confirmar = screen.getAllByRole('button', { name: /Excluir|Remover|Confirmar/ }).pop()!;
    await u.click(confirmar);
    await waitFor(() => expect(api.foi('DELETE /users/u2')).toHaveLength(1));
    await waitFor(() => expect(screen.queryAllByText('Maria Souza')).toHaveLength(0));
  });
});
