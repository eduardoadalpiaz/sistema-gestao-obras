// Apoio do Dashboard: nome curto da obra no gráfico e dados do gráfico planejado x realizado.
import type { Project } from '../context/construction-context';

// "1. Nome da obra", cortando nomes com mais de 17 letras para caber no gráfico
export function nomeNoGrafico(name: string, index: number): string {
  return `${index + 1}. ${name.length > 17 ? name.substring(0, 15) + '…' : name}`;
}

// uma linha por obra: quanto do prazo já passou (planejado) e quanto foi feito (realizado)
export function dadosPlanejadoRealizado(
  projects: Project[],
  esperado: (project: Project) => number,
  realizado: (projectId: string) => number,
) {
  return projects.map((p, index) => ({
    name: nomeNoGrafico(p.name, index),
    Planejado: esperado(p),
    Realizado: realizado(p.id),
  }));
}
