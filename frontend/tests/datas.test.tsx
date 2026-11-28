// Formulários de datas: o campo de término não aceita data antes do início (obra, etapa e documento).
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ConstructionManagementProvider } from '../src/app/context/construction-context';
import { Projects } from '../src/app/sistema/Projects';
import { ProjectSchedule } from '../src/app/sistema/ProjectSchedule';
import { ProjectDocuments } from '../src/app/sistema/ProjectDocuments';
import { setToken } from '../src/app/utils/api';
import { mockApi, admin, dadosVazios, obra } from './helpers';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// abre a tela pedida, já logado como administrador e com uma obra cadastrada
async function abrir(Tela: () => JSX.Element) {
  setToken('token-de-teste');
  localStorage.setItem('dp_current_user', JSON.stringify(admin));
  mockApi({ 'GET /data': { body: { ...dadosVazios, obras: [obra()] } } });
  const router = createMemoryRouter([{ path: '/', Component: Tela }]);
  render(<ConstructionManagementProvider><RouterProvider router={router} /></ConstructionManagementProvider>);
  await screen.findAllByText('Edifício Aurora');
  return userEvent.setup();
}

const preencher = (rotulo: RegExp, valor: string) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
const campo = (rotulo: RegExp) => screen.getByLabelText(rotulo) as HTMLInputElement;

describe('formulário de obra', () => {
  test('o término só aceita data a partir do início', async () => {
    const u = await abrir(Projects);
    await u.click(screen.getByRole('button', { name: /Nova Obra/ }));
    preencher(/Data de Início/, '2026-06-10');
    expect(campo(/Data Prevista de Término/).min).toBe('2026-06-10');
  });
});

describe('formulário de etapa', () => {
  test('o término previsto e a conclusão real só aceitam data a partir do início previsto', async () => {
    const u = await abrir(ProjectSchedule);
    await u.click(screen.getByRole('button', { name: /Adicionar Etapa/ }));
    preencher(/Data Prevista de Início/, '2026-05-10');
    expect(campo(/Data Prevista de Término/).min).toBe('2026-05-10');
    expect(campo(/Data de Conclusão Real/).min).toBe('2026-05-10');
  });
});

describe('formulário de documento', () => {
  test('o vencimento só aceita data a partir da emissão', async () => {
    const u = await abrir(ProjectDocuments);
    await u.click(screen.getByRole('button', { name: /Novo Documento/ }));
    preencher(/Data de Emissão/, '2026-05-10');
    expect(campo(/Data de Vencimento/).min).toBe('2026-05-10');
  });
});
