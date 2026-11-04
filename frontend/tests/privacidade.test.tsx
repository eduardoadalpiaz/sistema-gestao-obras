// Política de privacidade (LGPD): página pública, link no login e rota registrada.
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ConstructionManagementProvider } from '../src/app/context/construction-context';
import { LoginPage } from '../src/app/sistema/LoginPage';
import { PrivacyPolicy } from '../src/app/sistema/PrivacyPolicy';
import { CONTROLADOR, CONTATO_PRIVACIDADE } from '../src/app/utils/privacidade';
import { router } from '../src/app/routes';
import { mockApi } from './helpers';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }));

function renderPagina(caminho: string) {
  mockApi({});
  const r = createMemoryRouter([
    { path: '/login', Component: LoginPage },
    { path: '/privacidade', Component: PrivacyPolicy },
  ], { initialEntries: [caminho] });
  return render(<ConstructionManagementProvider><RouterProvider router={r} /></ConstructionManagementProvider>);
}

describe('política de privacidade', () => {
  test('identifica a empresa responsável e o contato do titular', () => {
    renderPagina('/privacidade');
    expect(CONTROLADOR).toBe('Dal Piaz Incorporadora');
    expect(screen.getByRole('heading', { name: /política de privacidade/i })).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(CONTROLADOR)).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: CONTATO_PRIVACIDADE })).toHaveAttribute('href', `mailto:${CONTATO_PRIVACIDADE}`);
  });

  test('diz quais dados são guardados e para quê', () => {
    renderPagina('/privacidade');
    const texto = document.body.textContent ?? '';
    for (const termo of ['nome', 'e-mail', 'telefone', 'perfil de acesso', 'histórico de alterações', 'Lei 13.709']) {
      expect(texto).toContain(termo);
    }
  });

  test('informa com quem os dados são compartilhados', () => {
    renderPagina('/privacidade');
    const texto = document.body.textContent ?? '';
    expect(texto).toContain('Microsoft Azure');
    expect(texto).toContain('Google Gemini');
    expect(texto).toMatch(/dados pessoais dos usuários não são enviados/i);
  });

  test('lista os direitos do titular e como pedi-los', () => {
    renderPagina('/privacidade');
    const texto = document.body.textContent ?? '';
    for (const direito of ['acesso', 'correção', 'anonimização', 'eliminação', 'portabilidade']) {
      expect(texto).toContain(direito);
    }
  });

  test('a tela de login tem o link para a política', () => {
    renderPagina('/login');
    expect(screen.getByRole('link', { name: /política de privacidade/i })).toHaveAttribute('href', '/privacidade');
  });

  test('a rota /privacidade é pública, fora do menu com login', () => {
    const rota = router.routes.find(r => r.path === '/privacidade');
    expect(rota).toBeDefined();
  });
});
