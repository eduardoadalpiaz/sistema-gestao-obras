// Usuário guardado no navegador: só os campos conhecidos, e nunca senha nem código.
import { describe, test, expect, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderDeslogado, mockApi, admin } from './helpers';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const dados = { users: [admin], obras: [], stages: [], notifications: [], gastos: [], documentos: [], audit: [] };

describe('usuário guardado no navegador', () => {
  test('guarda só os campos conhecidos e descarta senha, código e campos extras', async () => {
    const usuarioSujo = { ...admin, password: 'segredo', verificationCode: '123456', extra: '<img src=x onerror=alert(1)>' };
    mockApi({
      'POST /auth/login': { body: { success: true, user: usuarioSujo, token: 'tok-1' } },
      'GET /data': { body: dados },
    });
    const { result } = renderDeslogado();
    await act(async () => { await result.current.login('admin@obras.com', 'senha'); });

    const guardado = JSON.parse(localStorage.getItem('dp_current_user') ?? '{}');
    expect(Object.keys(guardado).sort()).toEqual(
      ['createdAt', 'email', 'id', 'name', 'phone', 'role', 'status', 'verified'],
    );
    expect(JSON.stringify(guardado)).not.toContain('segredo');
    expect(JSON.stringify(guardado)).not.toContain('onerror');
  });
});
