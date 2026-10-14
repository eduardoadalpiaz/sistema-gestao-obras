// Cliente da API: token de login, mensagens de erro e tratamento de sessão vencida.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import {
  api, ApiError, readApiMessage, getToken, setToken, clearSession, SESSION_EXPIRED_EVENT,
} from '../src/app/utils/api';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const resposta = (status: number, corpo: unknown = {}) =>
  Promise.resolve(new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status }));

beforeEach(() => { vi.mocked(toast.error).mockClear(); });

describe('token e sessão', () => {
  test('guarda, lê e apaga o token', () => {
    expect(getToken()).toBeNull();
    setToken('abc');
    expect(getToken()).toBe('abc');
    clearSession();
    expect(getToken()).toBeNull();
  });

  test('clearSession também apaga o usuário guardado', () => {
    localStorage.setItem('dp_current_user', '{"id":"1"}');
    setToken('abc');
    clearSession();
    expect(localStorage.getItem('dp_current_user')).toBeNull();
  });

  test('sem armazenamento disponível, não quebra', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    expect(getToken()).toBeNull();
    expect(() => setToken('x')).not.toThrow();
  });
});

describe('readApiMessage', () => {
  test('lê o texto de { message } ou { error } devolvido pelo servidor', () => {
    expect(readApiMessage(new ApiError(JSON.stringify({ message: 'Sem permissão' }), 403), 'padrão')).toBe('Sem permissão');
    expect(readApiMessage(new ApiError(JSON.stringify({ error: 'Senha errada' }), 401), 'padrão')).toBe('Senha errada');
  });

  test('usa o texto padrão quando não há mensagem útil', () => {
    expect(readApiMessage(new ApiError('texto solto, não é JSON', 500), 'padrão')).toBe('padrão');
    expect(readApiMessage(new ApiError('{}', 500), 'padrão')).toBe('padrão');
    expect(readApiMessage(new Error('qualquer'), 'padrão')).toBe('padrão');
    expect(readApiMessage('lixo', 'padrão')).toBe('padrão');
  });
});

describe('api()', () => {
  test('manda JSON e o token de login em toda chamada', async () => {
    setToken('meu-token');
    const fetchMock = vi.fn(() => resposta(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await api<{ ok: boolean }>('/data');
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.endsWith('/data')).toBe(true);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer meu-token');
    expect(headers['Content-Type']).toBe('application/json');
  });

  test('sem login, não manda o cabeçalho Authorization', async () => {
    const fetchMock = vi.fn(() => resposta(200, {}));
    vi.stubGlobal('fetch', fetchMock);
    await api('/auth/login', { method: 'POST', body: '{}' });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  test('401 em rota protegida limpa a sessão e avisa o sistema', async () => {
    setToken('vencido');
    const avisos = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, avisos);
    vi.stubGlobal('fetch', vi.fn(() => resposta(401, { message: 'Sessão expirada.' })));
    await expect(api('/data')).rejects.toMatchObject({ status: 401 });
    expect(getToken()).toBeNull();
    expect(avisos).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_EXPIRED_EVENT, avisos);
  });

  test('401 no login é só senha errada: não derruba sessão', async () => {
    setToken('outro');
    const avisos = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, avisos);
    vi.stubGlobal('fetch', vi.fn(() => resposta(401, { error: 'E-mail ou senha incorretos.' })));
    await expect(api('/auth/login', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);
    expect(avisos).not.toHaveBeenCalled();
    expect(getToken()).toBe('outro');
    window.removeEventListener(SESSION_EXPIRED_EVENT, avisos);
  });

  test('403 mostra a mensagem do servidor ao usuário', async () => {
    vi.stubGlobal('fetch', vi.fn(() => resposta(403, { message: 'Você não tem permissão para essa ação.' })));
    await expect(api('/obras', { method: 'POST' })).rejects.toMatchObject({ status: 403 });
    expect(toast.error).toHaveBeenCalledWith('Você não tem permissão para essa ação.');
  });

  test('413 avisa que o arquivo é grande demais', async () => {
    vi.stubGlobal('fetch', vi.fn(() => resposta(413, { message: 'grande' })));
    await expect(api('/gastos', { method: 'POST' })).rejects.toMatchObject({ status: 413 });
    expect(toast.error).toHaveBeenCalledWith('Arquivo muito grande para enviar.');
  });

  test('outros erros viram ApiError com o texto do servidor', async () => {
    vi.stubGlobal('fetch', vi.fn(() => resposta(400, { message: 'Progresso deve ficar entre 0 e 100.' })));
    const erro = await api('/obras/1', { method: 'PUT' }).catch((e) => e);
    expect(erro).toBeInstanceOf(ApiError);
    expect(erro.status).toBe(400);
    expect(readApiMessage(erro, 'padrão')).toBe('Progresso deve ficar entre 0 e 100.');
  });
});
