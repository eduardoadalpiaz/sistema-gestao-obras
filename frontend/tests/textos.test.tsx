// Textos do sistema: "E-mail" com hífen e o título do login só com "Gestão de Obras".
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ConstructionManagementProvider } from '../src/app/context/construction-context';
import { LoginPage } from '../src/app/sistema/LoginPage';
import { mockApi } from './helpers';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const PASTA = join(__dirname, '../src/app');

// lista os .tsx de uma pasta, de forma recursiva
function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? arquivos(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : []
  );
}

// cada regra: o que não pode aparecer nas telas
const REGRAS: Array<[string, RegExp]> = [
  ['"Email" sem hífen (use E-mail)', /\bEmail\b/],
  ['"o email" no texto (use e-mail)', /\b(o|seu|um|este|esse|do|de|no) email\b/i],
];

describe('grafia de "e-mail"', () => {
  test('nenhuma tela escreve "email" sem hífen no texto', () => {
    const achados: string[] = [];
    for (const arq of arquivos(PASTA)) {
      readFileSync(arq, 'utf8').split('\n').forEach((linha, i) => {
        for (const [nome, regra] of REGRAS) {
          if (regra.test(linha)) achados.push(`${arq.split('/src/')[1]}:${i + 1} · ${nome}`);
        }
      });
    }
    expect(achados).toEqual([]);
  });
});

describe('tela de login', () => {
  function renderLogin() {
    mockApi({});
    const router = createMemoryRouter([{ path: '/login', Component: LoginPage }], { initialEntries: ['/login'] });
    render(<ConstructionManagementProvider><RouterProvider router={router} /></ConstructionManagementProvider>);
  }

  test('o título mostra só "Gestão de Obras"', () => {
    renderLogin();
    expect(screen.getByText('Gestão de Obras')).toBeInTheDocument();
    expect(screen.queryByText(/Sistema de Gestão de Obras/)).toBeNull();
  });

  test('o campo se chama "E-mail"', () => {
    renderLogin();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
  });
});
