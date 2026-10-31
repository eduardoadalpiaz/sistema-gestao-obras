// Dashboard: os indicadores do topo vêm dos dados reais, sem números de enfeite.
import { describe, test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ConstructionManagementProvider } from '../src/app/context/construction-context';
import { ConstructionDashboard } from '../src/app/sistema/ConstructionDashboard';
import { setToken } from '../src/app/utils/api';
import { mockApi, admin, dadosVazios, obra, etapa } from './helpers';

// o navegador simulado (jsdom) não tem ResizeObserver, que os gráficos usam
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// congela só a data (os temporizadores seguem reais pra o waitFor funcionar)
const hoje = (iso: string) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso + 'T12:00:00'));
};

function renderDashboard(data: Record<string, unknown>) {
  setToken('token-de-teste');
  localStorage.setItem('dp_current_user', JSON.stringify(admin));
  mockApi({ 'GET /data': { body: { ...dadosVazios, ...data } } });
  render(<ConstructionManagementProvider><ConstructionDashboard /></ConstructionManagementProvider>);
}

// acha o cartão pelo título e devolve o conteúdo dele
const cartao = (titulo: string) => within(screen.getByText(titulo).parentElement as HTMLElement);

// duas obras em andamento (uma atrasada, uma no prazo) e uma concluída
const obras = () => [
  obra({ id: 'o1', name: 'Obra Atrasada', status: 'Em andamento', startDate: '2026-01-01', endDate: '2026-12-31' }),
  obra({ id: 'o2', name: 'Obra No Prazo', status: 'Em andamento', startDate: '2026-06-01', endDate: '2027-06-01' }),
  obra({ id: 'o3', name: 'Obra Pronta', status: 'Concluída', progress: 100 }),
];

describe('cartões do topo', () => {
  test('não mostram textos fixos de enfeite', async () => {
    hoje('2026-06-30');
    renderDashboard({ obras: obras() });

    expect(await screen.findByText('Obras Ativas')).toBeInTheDocument();
    expect(screen.queryByText('+2 este mês')).not.toBeInTheDocument();
    expect(screen.queryByText('-1 vs mês anterior')).not.toBeInTheDocument();
    expect(screen.queryByText('+5% este mês')).not.toBeInTheDocument();
  });

  test('mostram o total de obras e quantas estão no prazo', async () => {
    hoje('2026-06-30');
    renderDashboard({ obras: obras() });

    expect(await cartao('Obras Ativas').findByText('de 3 obras')).toBeInTheDocument();
    expect(cartao('Obras Atrasadas').getByText('1 no prazo')).toBeInTheDocument();
    expect(cartao('Avanço Médio').getByText('média de 3 obras')).toBeInTheDocument();
  });

  test('só chamam de crítico o atraso de mais de 20 dias', async () => {
    hoje('2026-06-30');
    renderDashboard({
      obras: obras(),
      stages: [
        etapa({ id: 'e1', plannedEnd: '2026-05-25', status: 'Atrasada' }),
        etapa({ id: 'e2', plannedEnd: '2026-06-25', status: 'Atrasada' }),
      ],
    });

    const alertas = cartao('Alertas de Risco');
    expect(await alertas.findByText('1 críticos')).toBeInTheDocument();
    expect(alertas.getByText('2')).toBeInTheDocument();
  });
});
