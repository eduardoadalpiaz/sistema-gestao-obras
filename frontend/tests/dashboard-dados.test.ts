// Dados do gráfico "Planejado vs Realizado": por obra, quanto do prazo já passou e quanto foi feito.
import { describe, test, expect } from 'vitest';
import { nomeNoGrafico, dadosPlanejadoRealizado } from '../src/app/utils/dashboard';

const obra = (id: string, name: string) => ({ id, name }) as never;

describe('nome da obra no gráfico', () => {
  test('numera a obra e mantém nomes curtos como estão', () => {
    expect(nomeNoGrafico('Edifício Aurora', 0)).toBe('1. Edifício Aurora');
  });

  test('corta nomes com mais de 17 letras e põe reticências', () => {
    expect(nomeNoGrafico('Residencial Vista Alegre Sul', 1)).toBe('2. Residencial Vis…');
  });
});

describe('dados do gráfico planejado x realizado', () => {
  test('cada obra vira uma linha com o planejado e o realizado vindos do sistema', () => {
    const planejado = (p: { id: string }) => (p.id === 'a' ? 60 : 10);
    const realizado = (id: string) => (id === 'a' ? 45 : 10);

    const dados = dadosPlanejadoRealizado([obra('a', 'Obra A'), obra('b', 'Obra B')], planejado as never, realizado);

    expect(dados).toEqual([
      { name: '1. Obra A', Planejado: 60, Realizado: 45 },
      { name: '2. Obra B', Planejado: 10, Realizado: 10 },
    ]);
  });

  test('sem obras, não há linhas', () => {
    expect(dadosPlanejadoRealizado([], () => 0, () => 0)).toEqual([]);
  });
});
