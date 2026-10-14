// Regras de cálculo do sistema: progresso, prazo, status do cronograma, validade de documentos e previsão de prazo.
import { describe, test, expect, vi } from 'vitest';
import { renderLogado, obra, etapa } from './helpers';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }));

// congela só a data (os temporizadores seguem reais pra o waitFor funcionar)
const hoje = (iso: string) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso + 'T12:00:00'));
};

describe('progresso da obra', () => {
  test('é a média do progresso das etapas', async () => {
    const { result } = await renderLogado({
      obras: [obra()] as never,
      stages: [etapa({ id: 'a', progress: 100 }), etapa({ id: 'b', progress: 50 }), etapa({ id: 'c', progress: 0 })] as never,
    });
    expect(result.current.calculateProjectProgress('o1')).toBe(50);
  });

  test('arredonda para inteiro', async () => {
    const { result } = await renderLogado({
      obras: [obra()] as never,
      stages: [etapa({ id: 'a', progress: 100 }), etapa({ id: 'b', progress: 0 }), etapa({ id: 'c', progress: 0 })] as never,
    });
    expect(result.current.calculateProjectProgress('o1')).toBe(33);
  });

  test('sem etapas, usa o progresso salvo na obra', async () => {
    const { result } = await renderLogado({ obras: [obra({ progress: 40 })] as never });
    expect(result.current.calculateProjectProgress('o1')).toBe(40);
  });

  test('obra que não existe tem 0%', async () => {
    const { result } = await renderLogado();
    expect(result.current.calculateProjectProgress('nao-existe')).toBe(0);
  });

  test('etapas de outra obra não entram na conta', async () => {
    const { result } = await renderLogado({
      obras: [obra(), obra({ id: 'o2' })] as never,
      stages: [etapa({ progress: 80 }), etapa({ id: 'x', obraId: 'o2', progress: 0 })] as never,
    });
    expect(result.current.calculateProjectProgress('o1')).toBe(80);
  });
});

describe('progresso esperado e situação no cronograma', () => {
  const projeto = obra({ startDate: '2026-01-01', endDate: '2026-01-11' }) as never;

  test('antes do início é 0 e depois do término é 100', async () => {
    const { result } = await renderLogado();
    hoje('2025-12-31');
    expect(result.current.calculateExpectedProgress(projeto)).toBe(0);
    hoje('2026-01-11');
    expect(result.current.calculateExpectedProgress(projeto)).toBe(100);
    hoje('2026-02-01');
    expect(result.current.calculateExpectedProgress(projeto)).toBe(100);
  });

  test('no meio do prazo é proporcional ao tempo que passou', async () => {
    const { result } = await renderLogado();
    hoje('2026-01-06'); // 5 de 10 dias
    expect(result.current.calculateExpectedProgress(projeto)).toBe(50);
  });

  test('tolerância de 12 pontos: 38% real com 50% esperado ainda está no prazo', async () => {
    const { result } = await renderLogado({
      obras: [obra({ startDate: '2026-01-01', endDate: '2026-01-11' })] as never,
      stages: [etapa({ progress: 38 })] as never,
    });
    hoje('2026-01-06');
    expect(result.current.getScheduleStatus(result.current.projects[0])).toBe('No Prazo');
  });

  test('37% real com 50% esperado já é atraso', async () => {
    const { result } = await renderLogado({
      obras: [obra({ startDate: '2026-01-01', endDate: '2026-01-11' })] as never,
      stages: [etapa({ progress: 37 })] as never,
    });
    hoje('2026-01-06');
    expect(result.current.getScheduleStatus(result.current.projects[0])).toBe('Atrasada');
  });

  test('adiantado em relação ao esperado está no prazo', async () => {
    const { result } = await renderLogado({
      obras: [obra({ startDate: '2026-01-01', endDate: '2026-01-11' })] as never,
      stages: [etapa({ progress: 90 })] as never,
    });
    hoje('2026-01-06');
    expect(result.current.getScheduleStatus(result.current.projects[0])).toBe('No Prazo');
  });
});

describe('gastos e notificações', () => {
  test('total de gastos soma só os lançamentos da obra', async () => {
    const { result } = await renderLogado({
      obras: [obra(), obra({ id: 'o2' })] as never,
      gastos: [
        { id: 'g1', obraId: 'o1', value: 100.5 }, { id: 'g2', obraId: 'o1', value: 200 }, { id: 'g3', obraId: 'o2', value: 999 },
      ] as never,
    });
    expect(result.current.calculateTotalExpenses('o1')).toBe(300.5);
    expect(result.current.calculateTotalExpenses('o2')).toBe(999);
    expect(result.current.calculateTotalExpenses('vazia')).toBe(0);
  });

  test('conta só as notificações não lidas', async () => {
    const { result } = await renderLogado({
      notifications: [{ id: '1', read: false }, { id: '2', read: true }, { id: '3', read: false }] as never,
    });
    expect(result.current.countUnreadNotifications()).toBe(2);
  });
});

describe('situação dos documentos pela validade', () => {
  const doc = (expiryDate?: string, status = 'Pendente') => ({ id: 'd', obraId: 'o1', title: 'Alvará', type: 'Contrato', status, expiryDate, uploadedBy: 'u1', createdAt: '' }) as never;

  test('sem data de validade vale o status digitado', async () => {
    const { result } = await renderLogado();
    expect(result.current.calculateDocumentStatus(doc(undefined, 'Cancelado'))).toBe('Cancelado');
  });

  test('vencido, vencendo (até 30 dias) e válido', async () => {
    const { result } = await renderLogado();
    hoje('2026-06-15');
    expect(result.current.calculateDocumentStatus(doc('2026-06-14'))).toBe('Vencido');
    expect(result.current.calculateDocumentStatus(doc('2026-06-15'))).toBe('Vencendo'); // vence hoje
    expect(result.current.calculateDocumentStatus(doc('2026-07-15'))).toBe('Vencendo'); // 30 dias
    expect(result.current.calculateDocumentStatus(doc('2026-07-16'))).toBe('Válido');   // 31 dias
  });
});

describe('previsão de prazo da obra', () => {
  test('sem área ou sem data de início, não há previsão', async () => {
    const { result } = await renderLogado();
    expect(result.current.estimateProjectCompletion({ area: 0, startDate: '2026-01-01' })).toBeNull();
    expect(result.current.estimateProjectCompletion({ area: 100, startDate: '' })).toBeNull();
  });

  test('sem obras concluídas usa a média de referência do setor', async () => {
    const { result } = await renderLogado();
    const p = result.current.estimateProjectCompletion({ area: 1000, startDate: '2026-01-01' })!;
    expect(p.isFallback).toBe(true);
    expect(p.basedOn).toBe(0);
    expect(p.days).toBe(520); // 1000 m² x 0,52 dia/m²
    expect(p.dateISO).toBe('2027-06-05');
  });

  test('prazo mínimo é de 30 dias', async () => {
    const { result } = await renderLogado();
    expect(result.current.estimateProjectCompletion({ area: 10, startDate: '2026-01-01' })!.days).toBe(30);
  });

  test('complexidade alta demora mais que baixa; equipe maior demora menos', async () => {
    const { result } = await renderLogado();
    const base = { area: 1000, startDate: '2026-01-01' };
    const baixa = result.current.estimateProjectCompletion({ ...base, complexidade: 'Baixa' })!.days;
    const media = result.current.estimateProjectCompletion({ ...base, complexidade: 'Média' })!.days;
    const alta = result.current.estimateProjectCompletion({ ...base, complexidade: 'Alta' })!.days;
    expect(baixa).toBeLessThan(media);
    expect(media).toBeLessThan(alta);
    expect(baixa).toBe(442); // 520 x 0,85
    expect(alta).toBe(650);  // 520 x 1,25
    const equipeGrande = result.current.estimateProjectCompletion({ ...base, teamSize: 20 })!.days;
    expect(equipeGrande).toBe(260); // dobro da equipe, metade do prazo
  });

  test('cada pavimento a mais soma 8% ao prazo', async () => {
    const { result } = await renderLogado();
    const p = result.current.estimateProjectCompletion({ area: 1000, startDate: '2026-01-01', floors: 3 })!;
    expect(p.days).toBe(603); // 520 x (1 + 2 x 0,08)
  });

  test('com obras concluídas usa a média delas e do mesmo tipo quando houver', async () => {
    const { result } = await renderLogado({
      obras: [
        obra({ id: 'c1', status: 'Concluída', area: 1000, tipo: 'Residencial', startDate: '2025-01-01', endDate: '2025-04-11', teamSize: 10 }), // 100 dias
        obra({ id: 'c2', status: 'Concluída', area: 1000, tipo: 'Comercial', startDate: '2025-01-01', endDate: '2025-12-27', teamSize: 10 }), // 360 dias
      ] as never,
    });
    const todas = result.current.estimateProjectCompletion({ area: 1000, startDate: '2026-01-01' })!;
    expect(todas.isFallback).toBe(false);
    expect(todas.basedOn).toBe(2);
    expect(todas.days).toBe(230); // média de 0,10 e 0,36 dia/m²
    const residencial = result.current.estimateProjectCompletion({ area: 1000, startDate: '2026-01-01', tipo: 'Residencial' })!;
    expect(residencial.basedOn).toBe(1);
    expect(residencial.days).toBe(100);
  });
});
