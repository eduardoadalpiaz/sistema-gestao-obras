// Contraste de cor (WCAG 2.1 AA, 4,5:1): barra as cores de texto que ficaram abaixo disso nas medições.
import { describe, test, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PASTA = join(__dirname, '../src/app');

// lista os .tsx de uma pasta, de forma recursiva
function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? arquivos(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : []
  );
}

// cada regra: o que não pode aparecer e por qual cor trocar
const REGRAS: Array<[string, RegExp]> = [
  ['text-gray-400 (use text-gray-500)', /\btext-gray-400\b/],
  ['text-gray-300 (use text-gray-500)', /\btext-gray-300\b/],
  ['text-red-500 (use text-red-700)', /\btext-red-500\b/],
  ['text-blue-500 (use text-blue-700)', /\btext-blue-500\b/],
  ['text-orange-500 (use text-orange-700)', /\btext-orange-500\b/],
  ['text-green-600 (use text-green-700)', /\btext-green-600\b/],
  ['text-yellow-500 (use text-yellow-700)', /\btext-yellow-500\b/],
  ['text-purple-500 (use text-purple-700)', /\btext-purple-500\b/],
  ['text-blue-200 (use text-white)', /\btext-blue-200\b/],
  ['text-blue-100 (use text-white)', /\btext-blue-100\b/],
  ['bg-green-600 com texto branco (use bg-green-700)', /\bbg-green-600\b/],
  ['texto branco sobre o laranja #E8821A (use text-gray-900)', /bg-\[#E8821A\][^'"`]*\btext-white\b|\btext-white\b[^'"`]*bg-\[#E8821A\]/],
];

// o menu lateral tem fundo escuro: ali o cinza claro é o correto
const FUNDO_ESCURO = ['AppShell.tsx'];

describe('contraste das cores de texto', () => {
  test('nenhuma tela usa cor de texto abaixo de 4,5:1 sobre fundo claro', () => {
    const achados: string[] = [];
    for (const arq of arquivos(PASTA)) {
      const escuro = FUNDO_ESCURO.some((n) => arq.endsWith(n));
      readFileSync(arq, 'utf8').split('\n').forEach((linha, i) => {
        for (const [nome, regra] of REGRAS) {
          if (escuro && !nome.startsWith('texto branco')) continue;
          if (regra.test(linha)) achados.push(`${arq.replace(PASTA, 'src/app')}:${i + 1} ${nome}`);
        }
      });
    }
    expect(achados).toEqual([]);
  });
});
