// Contexto do sistema: login, verificação, sessão e as ações de criar, editar e remover (com histórico e avisos).
import { describe, test, expect, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { renderDeslogado, renderLogado, mockApi, admin, obra, etapa } from './helpers';
import { getToken, SESSION_EXPIRED_EVENT } from '../src/app/utils/api';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const dados = { users: [admin], obras: [], stages: [], notifications: [], gastos: [], documentos: [], audit: [] };

describe('login', () => {
  test('sucesso guarda o token, entra e carrega os dados', async () => {
    mockApi({
      'POST /auth/login': { body: { success: true, user: admin, token: 'tok-123' } },
      'GET /data': { body: { ...dados, obras: [obra()] } },
    });
    const { result } = renderDeslogado();
    let r;
    await act(async () => { r = await result.current.login('admin@obras.com', 'senha'); });
    expect(r).toEqual({ success: true });
    expect(getToken()).toBe('tok-123');
    await waitFor(() => expect(result.current.projects).toHaveLength(1));
    expect(result.current.activeUser?.email).toBe('admin@obras.com');
    expect(result.current.isSyncConnected).toBe(true);
  });

  test('conta não verificada guarda o usuário pendente e não entra', async () => {
    mockApi({ 'POST /auth/login': { body: { needsVerification: true, user: admin, verifyToken: 'vt' } } });
    const { result } = renderDeslogado();
    let r;
    await act(async () => { r = await result.current.login('a@a.com', 'senha'); });
    expect(r).toEqual({ success: false, needsVerification: true });
    expect(result.current.pendingVerificationUser?.id).toBe('u1');
    expect(result.current.activeUser).toBeNull();
    expect(getToken()).toBeNull();
  });

  test('senha errada devolve a mensagem do servidor', async () => {
    mockApi({ 'POST /auth/login': { status: 401, body: { error: 'E-mail ou senha incorretos.' } } });
    const { result } = renderDeslogado();
    let r;
    await act(async () => { r = await result.current.login('a@a.com', 'errada'); });
    expect(r).toEqual({ success: false, error: 'E-mail ou senha incorretos.' });
    expect(result.current.activeUser).toBeNull();
  });

  test('servidor fora do ar devolve mensagem amigável', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    const { result } = renderDeslogado();
    let r: { success: boolean; error?: string } | undefined;
    await act(async () => { r = await result.current.login('a@a.com', 'x'); });
    expect(r?.success).toBe(false);
    expect(r?.error).toMatch(/Não foi possível conectar/);
  });

  test('verificar código sem ter feito login pede para entrar de novo', async () => {
    const { result } = renderDeslogado();
    let r;
    await act(async () => { r = await result.current.verifyAccountCode('123456'); });
    expect(r).toEqual({ success: false, error: 'Faça login de novo.' });
  });

  test('fluxo completo do primeiro acesso: login pendente, código certo, entra', async () => {
    const api = mockApi({
      'POST /auth/login': { body: { needsVerification: true, user: admin, verifyToken: 'vt-1' } },
      'POST /auth/verify': { body: { success: true, user: admin, token: 'sessao-1' } },
      'GET /data': { body: dados },
    });
    const { result } = renderDeslogado();
    await act(async () => { await result.current.login('a@a.com', 'senha'); });
    let r;
    await act(async () => { r = await result.current.verifyAccountCode('654321'); });
    expect(r).toEqual({ success: true });
    expect(api.foi('POST /auth/verify')[0].body).toEqual({ verifyToken: 'vt-1', code: '654321' });
    expect(getToken()).toBe('sessao-1');
    expect(result.current.pendingVerificationUser).toBeNull();
  });

  test('código errado mostra o erro do servidor', async () => {
    mockApi({
      'POST /auth/login': { body: { needsVerification: true, user: admin, verifyToken: 'vt' } },
      'POST /auth/verify': { status: 400, body: { error: 'Código inválido.' } },
    });
    const { result } = renderDeslogado();
    await act(async () => { await result.current.login('a@a.com', 'senha'); });
    let r;
    await act(async () => { r = await result.current.verifyAccountCode('000000'); });
    expect(r).toEqual({ success: false, error: 'Código inválido.' });
  });
});

describe('sessão', () => {
  test('quem já tinha sessão guardada volta logado e os dados carregam', async () => {
    const { result } = await renderLogado({ obras: [obra()] as never });
    expect(result.current.activeUser?.id).toBe('u1');
    expect(result.current.projects).toHaveLength(1);
    expect(result.current.isSyncConnected).toBe(true);
  });

  test('sair apaga a sessão e esvazia os dados da tela', async () => {
    const { result } = await renderLogado({ obras: [obra()] as never });
    act(() => result.current.logout());
    expect(result.current.activeUser).toBeNull();
    expect(getToken()).toBeNull();
    expect(localStorage.getItem('dp_current_user')).toBeNull();
    await waitFor(() => expect(result.current.projects).toHaveLength(0));
  });

  test('sessão vencida (401 do servidor) volta para o login', async () => {
    const { result } = await renderLogado();
    act(() => { window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)); });
    await waitFor(() => expect(result.current.activeUser).toBeNull());
  });

  test('falha ao carregar os dados deixa a sincronização desligada', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await renderLogado({}, { 'GET /data': { status: 500, body: { message: 'erro' } } });
    expect(result.current.isSyncConnected).toBe(false);
  });

  test('o código de verificação não fica guardado no navegador', async () => {
    await renderLogado({ users: [{ ...admin, verificationCode: '123456' }] as never });
    expect(localStorage.getItem('dp_current_user')).not.toContain('123456');
  });
});

describe('obras', () => {
  test('criar obra envia para a API, entra na lista e registra no histórico', async () => {
    const nova = obra({ id: 'o9', name: 'Obra Nova' });
    const { result, api } = await renderLogado({}, {
      'POST /obras': { body: { obra: nova } },
      'POST /notifications': { body: { notification: { id: 'n1', type: 'info', message: 'ok', read: false, createdAt: '' } } },
      'POST /audit': { body: { entry: { id: 'a1', action: 'Criou', module: 'Obras', targetName: 'Obra Nova' } } },
    });
    await act(async () => { await result.current.createProject({ name: 'Obra Nova' } as never); });
    expect(result.current.projects.map(p => p.name)).toContain('Obra Nova');
    await waitFor(() => expect(api.foi('POST /audit')).toHaveLength(1));
    expect(api.foi('POST /audit')[0].body).toMatchObject({ action: 'Criou', module: 'Obras', targetName: 'Obra Nova', userId: 'u1' });
    await waitFor(() => expect(result.current.systemNotifications).toHaveLength(1));
  });

  test('erro da API ao criar não coloca a obra na lista', async () => {
    const { result } = await renderLogado({}, { 'POST /obras': { status: 400, body: { message: 'Falta preencher um campo obrigatório.' } } });
    await act(async () => { await expect(result.current.createProject({} as never)).rejects.toBeTruthy(); });
    expect(result.current.projects).toHaveLength(0);
  });

  test('editar registra no histórico só os campos que mudaram (e ignora progresso)', async () => {
    const { result, api } = await renderLogado({ obras: [obra({ client: 'Antigo', city: 'Criciúma' })] as never }, {
      'PUT /obras/o1': { body: { obra: obra({ client: 'Novo', city: 'Criciúma', progress: 50 }) } },
      'POST /audit': { body: { entry: { id: 'a1' } } },
      'POST /notifications': { body: { notification: { id: 'n', type: 'info', message: '', read: false, createdAt: '' } } },
    });
    await act(async () => { await result.current.updateProject('o1', { client: 'Novo', city: 'Criciúma', progress: 50 }); });
    await waitFor(() => expect(api.foi('POST /audit')).toHaveLength(1));
    expect(api.foi('POST /audit')[0].body).toMatchObject({ action: 'Editou', field: 'client', oldValue: 'Antigo', newValue: 'Novo' });
    expect(result.current.projects[0].client).toBe('Novo');
  });

  test('salvar a equipe com os mesmos nomes não gera registro falso de edição', async () => {
    const { result, api } = await renderLogado({ obras: [obra({ teamMembers: ['João', 'Ana'] })] as never }, {
      'PUT /obras/o1': { body: { obra: obra({ teamMembers: ['João', 'Ana'] }) } },
    });
    await act(async () => { await result.current.updateProject('o1', { teamMembers: ['João', 'Ana'] }); });
    expect(api.foi('POST /audit')).toHaveLength(0);
  });

  test('remover obra tira também etapas, gastos e documentos dela da tela', async () => {
    const { result, api } = await renderLogado({
      obras: [obra()] as never,
      stages: [etapa()] as never,
      gastos: [{ id: 'g1', obraId: 'o1', value: 10 }] as never,
      documentos: [{ id: 'd1', obraId: 'o1' }] as never,
    }, {
      'DELETE /obras/o1': { body: { success: true } },
      'POST /audit': { body: { entry: { id: 'a' } } },
      'POST /notifications': { body: { notification: { id: 'n', type: 'info', message: '', read: false, createdAt: '' } } },
    });
    await act(async () => { await result.current.removeProject('o1'); });
    expect(result.current.projects).toHaveLength(0);
    expect(result.current.scheduleStages).toHaveLength(0);
    expect(result.current.expenses).toHaveLength(0);
    expect(result.current.documents).toHaveLength(0);
    await waitFor(() => expect(api.foi('POST /audit')).toHaveLength(1));
  });
});

describe('etapas do cronograma', () => {
  test('mudar o progresso de uma etapa recalcula e salva o progresso da obra', async () => {
    const { result, api } = await renderLogado({
      obras: [obra()] as never,
      stages: [etapa({ id: 's1', progress: 0 }), etapa({ id: 's2', progress: 100 })] as never,
    }, {
      'PUT /stages/s1': { body: { stage: etapa({ id: 's1', progress: 60 }) } },
      'PUT /obras/o1': { body: { obra: obra({ progress: 80 }) } },
      'POST /audit': { body: { entry: { id: 'a' } } },
    });
    await act(async () => { await result.current.updateScheduleStage('s1', { progress: 60 }); });
    await waitFor(() => expect(api.foi('PUT /obras/o1')).toHaveLength(1));
    expect(api.foi('PUT /obras/o1')[0].body).toEqual({ progress: 80 }); // média de 60 e 100
    expect(result.current.calculateProjectProgress('o1')).toBe(80);
  });

  test('concluir uma etapa gera aviso de sucesso', async () => {
    const { result, api } = await renderLogado({
      obras: [obra()] as never,
      stages: [etapa()] as never,
    }, {
      'PUT /stages/s1': { body: { stage: etapa({ status: 'Concluída', progress: 100 }) } },
      'PUT /obras/o1': { body: { obra: obra({ progress: 100 }) } },
      'POST /notifications': { body: { notification: { id: 'n1', type: 'success', message: 'ok', read: false, createdAt: '' } } },
      'POST /audit': { body: { entry: { id: 'a' } } },
    });
    await act(async () => { await result.current.updateScheduleStage('s1', { status: 'Concluída', progress: 100 }); });
    await waitFor(() => expect(api.foi('POST /notifications')).toHaveLength(1));
    expect(api.foi('POST /notifications')[0].body).toMatchObject({ type: 'success', obraId: 'o1' });
  });

  test('etapa atrasada gera aviso de alerta', async () => {
    const { result, api } = await renderLogado({ obras: [obra()] as never, stages: [etapa()] as never }, {
      'PUT /stages/s1': { body: { stage: etapa({ status: 'Atrasada' }) } },
      'POST /notifications': { body: { notification: { id: 'n1', type: 'warning', message: 'x', read: false, createdAt: '' } } },
      'POST /audit': { body: { entry: { id: 'a' } } },
    });
    await act(async () => { await result.current.updateScheduleStage('s1', { status: 'Atrasada' }); });
    await waitFor(() => expect(api.foi('POST /notifications')[0]?.body).toMatchObject({ type: 'warning' }));
  });

  test('atualizar etapa que não existe não chama a API', async () => {
    const { result, api } = await renderLogado();
    await act(async () => { await result.current.updateScheduleStage('fantasma', { progress: 10 }); });
    expect(api.foi('PUT /stages/fantasma')).toHaveLength(0);
  });

  test('remover a etapa recalcula o progresso da obra com as que sobraram', async () => {
    const { result, api } = await renderLogado({
      obras: [obra()] as never,
      stages: [etapa({ id: 's1', progress: 20 }), etapa({ id: 's2', progress: 100 })] as never,
    }, {
      'DELETE /stages/s1': { body: { success: true } },
      'PUT /obras/o1': { body: { obra: obra({ progress: 100 }) } },
      'POST /audit': { body: { entry: { id: 'a' } } },
    });
    await act(async () => { await result.current.removeScheduleStage('s1'); });
    expect(result.current.scheduleStages).toHaveLength(1);
    await waitFor(() => expect(api.foi('PUT /obras/o1')[0]?.body).toEqual({ progress: 100 }));
  });

  test('adicionar etapa a uma obra com etapa nova entra na lista', async () => {
    const { result } = await renderLogado({ obras: [obra()] as never }, {
      'POST /stages': { body: { stage: etapa({ id: 'novo', progress: 0 }) } },
      'PUT /obras/o1': { body: { obra: obra() } },
      'POST /audit': { body: { entry: { id: 'a' } } },
    });
    await act(async () => { await result.current.addScheduleStage({ obraId: 'o1', name: 'Fundação' } as never); });
    expect(result.current.scheduleStages.map(s => s.id)).toContain('novo');
  });
});

describe('gastos, documentos e notificações', () => {
  test('lançar gasto entra na lista e atualiza o total da obra', async () => {
    const { result } = await renderLogado({ obras: [obra()] as never }, {
      'POST /gastos': { body: { gasto: { id: 'g1', obraId: 'o1', value: 250, description: 'Cimento' } } },
      'POST /notifications': { body: { notification: { id: 'n', type: 'info', message: '', read: false, createdAt: '' } } },
      'POST /audit': { body: { entry: { id: 'a' } } },
    });
    await act(async () => { await result.current.recordExpense({ obraId: 'o1', value: 250, description: 'Cimento' } as never); });
    expect(result.current.calculateTotalExpenses('o1')).toBe(250);
  });

  test('editar e remover gasto atualizam a lista', async () => {
    const { result } = await renderLogado({
      obras: [obra()] as never,
      gastos: [{ id: 'g1', obraId: 'o1', value: 100, description: 'Areia' }] as never,
    }, {
      'PUT /gastos/g1': { body: { gasto: { id: 'g1', obraId: 'o1', value: 150, description: 'Areia' } } },
      'DELETE /gastos/g1': { body: { success: true } },
      'POST /audit': { body: { entry: { id: 'a' } } },
    });
    await act(async () => { await result.current.updateExpense('g1', { value: 150 }); });
    expect(result.current.calculateTotalExpenses('o1')).toBe(150);
    await act(async () => { await result.current.removeExpense('g1'); });
    expect(result.current.expenses).toHaveLength(0);
  });

  test('anexar, editar e remover documento', async () => {
    const { result } = await renderLogado({ obras: [obra()] as never }, {
      'POST /documentos': { body: { documento: { id: 'd1', obraId: 'o1', title: 'Alvará', status: 'Pendente' } } },
      'PUT /documentos/d1': { body: { documento: { id: 'd1', obraId: 'o1', title: 'Alvará', status: 'Válido' } } },
      'DELETE /documentos/d1': { body: { success: true } },
      'POST /audit': { body: { entry: { id: 'a' } } },
      'POST /notifications': { body: { notification: { id: 'n', type: 'info', message: '', read: false, createdAt: '' } } },
    });
    await act(async () => { await result.current.attachDocument({ obraId: 'o1', title: 'Alvará' } as never); });
    expect(result.current.documents).toHaveLength(1);
    await act(async () => { await result.current.updateDocument('d1', { status: 'Válido' }); });
    expect(result.current.documents[0].status).toBe('Válido');
    await act(async () => { await result.current.removeDocument('d1'); });
    expect(result.current.documents).toHaveLength(0);
  });

  test('marcar notificações como lidas', async () => {
    const { result } = await renderLogado({
      notifications: [{ id: 'n1', read: false }, { id: 'n2', read: false }] as never,
    }, {
      'PUT /notifications/n1': { body: {} },
      'PUT /notifications/mark-all-read': { body: { success: true } },
    });
    await act(async () => { await result.current.markNotificationRead('n1'); });
    expect(result.current.countUnreadNotifications()).toBe(1);
    await act(async () => { await result.current.markAllNotificationsRead(); });
    expect(result.current.countUnreadNotifications()).toBe(0);
  });

  test('análise por IA devolve o texto, ou a mensagem de erro do servidor', async () => {
    const { result } = await renderLogado({}, {
      'POST /ai/analyze-obra': (init) => JSON.parse(String(init?.body)).obraId === 'ok'
        ? { body: { analysis: 'Obra no prazo.' } }
        : { status: 503, body: { message: 'Análise por IA não configurada.' } },
    });
    await expect(result.current.generateProjectAnalysis('ok')).resolves.toBe('Obra no prazo.');
    await expect(result.current.generateProjectAnalysis('x')).rejects.toThrow('Análise por IA não configurada.');
  });

  test('usuários: cadastrar devolve o código de verificação; editar e remover atualizam a lista', async () => {
    const novo = { ...admin, id: 'u2', name: 'Maria', email: 'maria@obras.com', role: 'Engenheiro' };
    const { result } = await renderLogado({}, {
      'POST /users': { body: { user: novo, verificationCode: '445566' } },
      'PUT /users/u2': { body: { user: { ...novo, role: 'Visualizador' } } },
      'DELETE /users/u2': { body: { success: true } },
      'POST /audit': { body: { entry: { id: 'a' } } },
    });
    let codigo = '';
    await act(async () => { codigo = await result.current.registerTeamMember({ name: 'Maria', email: 'maria@obras.com', role: 'Engenheiro' } as never); });
    expect(codigo).toBe('445566');
    expect(result.current.teamMembers.map(u => u.id)).toContain('u2');
    await act(async () => { await result.current.updateTeamMember('u2', { role: 'Visualizador' }); });
    expect(result.current.teamMembers.find(u => u.id === 'u2')?.role).toBe('Visualizador');
    await act(async () => { await result.current.removeTeamMember('u2'); });
    expect(result.current.teamMembers.map(u => u.id)).not.toContain('u2');
  });
});
