/**
 * Reports.tsx
 * Performance and delay reporting screen.
 * Renders planned-vs-actual progress charts and exports a PDF report.
 */
import { useConstructionManagement } from '../context/construction-context';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingDown, AlertTriangle, Clock, FileDown, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

export function Reports() {
  const { projects, scheduleStages, expenses, teamMembers, getScheduleStatus, calculateTotalExpenses } = useConstructionManagement();

  // ── Performance KPIs ────────────────────────────────────────────────────────

  const totalDelayedStages  = scheduleStages.filter(s => s.status === 'Atrasada').length;
  const projectsUnderReview = projects.filter(p => getScheduleStatus(p) === 'Atrasada').length;

  const averageDaysOverdue = (() => {
    const delayedStages = scheduleStages.filter(s => s.status === 'Atrasada');
    if (delayedStages.length === 0) return 0;
    const today    = new Date();
    const totalDays = delayedStages.reduce((sum, s) => {
      const plannedEndDate = new Date(s.plannedEnd);
      const daysOverdue    = Math.max(0, Math.round(
        (today.getTime() - plannedEndDate.getTime()) / (1000 * 60 * 60 * 24)
      ));
      return sum + daysOverdue;
    }, 0);
    return Math.round(totalDays / delayedStages.length);
  })();

  const criticalDelayCount = scheduleStages.filter(s => {
    if (s.status !== 'Atrasada') return false;
    const today         = new Date();
    const plannedEnd    = new Date(s.plannedEnd);
    const daysOverdue   = Math.round(
      (today.getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysOverdue > 15;
  }).length;

  // ── Planned vs Actual Progress Chart ────────────────────────────────────────

  /**
   * Calculates expected progress based on elapsed calendar time (time-based planning).
   * Used in the report chart to show the planned curve without manual overrides.
   */
  const calculateExpectedProgressFromDates = (project: typeof projects[0]) => {
    const today    = new Date();
    const start    = new Date(project.startDate);
    const end      = new Date(project.endDate);
    if (today <= start) return 0;
    if (today >= end)   return 100;
    const totalDuration = end.getTime() - start.getTime();
    const elapsed       = today.getTime() - start.getTime();
    return Math.round((elapsed / totalDuration) * 100);
  };

  const progressComparisonChartData = projects.map((p, index) => ({
    name:      `${index + 1}. ${p.name.length > 16 ? p.name.substring(0, 14) + '…' : p.name}`,
    fullName:  `${index + 1}. ${p.name}`,
    Planejado: calculateExpectedProgressFromDates(p),
    Realizado: p.progress,
  }));

  // ── Delayed Stages Table ─────────────────────────────────────────────────────

  const delayedStageReportRows = scheduleStages
    .filter(s => s.status === 'Atrasada')
    .map(stage => {
      const project     = projects.find(p => p.id === stage.obraId);
      const responsible = teamMembers.find(m => m.id === stage.responsibleId);
      const today       = new Date();
      const plannedEnd  = new Date(stage.plannedEnd);
      const daysOverdue = Math.max(0, Math.round(
        (today.getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24)
      ));
      const riskLevel   = daysOverdue > 20 ? 'Alto' : daysOverdue > 10 ? 'Médio' : 'Baixo';
      return {
        projectName:   project?.name      ?? '—',
        stageName:     stage.name,
        daysOverdue,
        riskLevel,
        responsibleName: responsible?.name ?? '—',
      };
    });

  const riskLevelBadgeClasses = (level: string) => {
    if (level === 'Alto')  return 'bg-red-100 text-red-700';
    if (level === 'Médio') return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };

  // ── PDF Export ────────────────────────────────────────────────────────────────

  const exportToPDF = () => {
    const pdfDoc  = new jsPDF();
    const today   = new Date().toLocaleDateString('pt-BR');
    const avgProgress = projects.length > 0
      ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)
      : 0;

    // Header band
    pdfDoc.setFillColor(26, 35, 50);
    pdfDoc.rect(0, 0, 210, 35, 'F');
    pdfDoc.setTextColor(255, 255, 255);
    pdfDoc.setFontSize(18);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('DalPiaz Incorporadora', 14, 16);
    pdfDoc.setFontSize(10);
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.text('Relatório de Desempenho e Alertas', 14, 24);
    pdfDoc.text(`Gerado em: ${today}`, 14, 31);

    let y = 48;

    // KPIs section
    pdfDoc.setTextColor(26, 35, 50);
    pdfDoc.setFontSize(13);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text('Indicadores Gerais', 14, y);
    y += 8;

    const kpiRows = [
      ['Obras Ativas',          projects.filter(p => p.status === 'Em andamento').length.toString()],
      ['Total de Atrasos',      totalDelayedStages.toString()],
      ['Obras em Atenção',      projectsUnderReview.toString()],
      ['Dias Médio de Atraso',  `${averageDaysOverdue} dias`],
      ['Avanço Médio Geral',    `${avgProgress}%`],
    ];

    pdfDoc.setFontSize(10);
    kpiRows.forEach(([label, value]) => {
      pdfDoc.setFont('helvetica', 'normal');
      pdfDoc.setTextColor(100, 100, 100);
      pdfDoc.text(label + ':', 14, y);
      pdfDoc.setFont('helvetica', 'bold');
      pdfDoc.setTextColor(26, 35, 50);
      pdfDoc.text(value, 80, y);
      y += 7;
    });

    y += 6;

    // Project progress table
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setFontSize(13);
    pdfDoc.setTextColor(26, 35, 50);
    pdfDoc.text('Progresso por Obra', 14, y);
    y += 8;

    pdfDoc.setFillColor(240, 240, 240);
    pdfDoc.rect(14, y - 4, 182, 8, 'F');
    pdfDoc.setFontSize(9);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.setTextColor(80, 80, 80);
    pdfDoc.text('Obra', 16, y + 1);
    pdfDoc.text('Cliente', 70, y + 1);
    pdfDoc.text('Status', 120, y + 1);
    pdfDoc.text('Realizado', 150, y + 1);
    pdfDoc.text('Planejado', 172, y + 1);
    y += 10;

    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    projects.forEach(project => {
      if (y > 270) { pdfDoc.addPage(); y = 20; }
      pdfDoc.setTextColor(26, 35, 50);
      pdfDoc.text(project.name.substring(0, 28), 16, y);
      pdfDoc.text(project.client.substring(0, 20), 70, y);
      pdfDoc.text(project.status, 120, y);
      pdfDoc.text(`${project.progress}%`, 155, y);
      pdfDoc.text(`${calculateExpectedProgressFromDates(project)}%`, 177, y);
      y += 7;
      pdfDoc.setDrawColor(220, 220, 220);
      pdfDoc.line(14, y - 2, 196, y - 2);
    });

    y += 6;

    // Delayed stages table
    if (delayedStageReportRows.length > 0) {
      pdfDoc.setFont('helvetica', 'bold');
      pdfDoc.setFontSize(13);
      pdfDoc.setTextColor(26, 35, 50);
      pdfDoc.text('Etapas com Atraso', 14, y);
      y += 8;

      pdfDoc.setFillColor(240, 240, 240);
      pdfDoc.rect(14, y - 4, 182, 8, 'F');
      pdfDoc.setFontSize(9);
      pdfDoc.setFont('helvetica', 'bold');
      pdfDoc.setTextColor(80, 80, 80);
      pdfDoc.text('Obra', 16, y + 1);
      pdfDoc.text('Etapa', 70, y + 1);
      pdfDoc.text('Dias', 120, y + 1);
      pdfDoc.text('Impacto', 140, y + 1);
      pdfDoc.text('Responsável', 170, y + 1);
      y += 10;

      pdfDoc.setFont('helvetica', 'normal');
      pdfDoc.setFontSize(8);
      delayedStageReportRows.forEach(row => {
        if (y > 270) { pdfDoc.addPage(); y = 20; }
        pdfDoc.setTextColor(26, 35, 50);
        pdfDoc.text(row.projectName.substring(0, 25), 16, y);
        pdfDoc.text(row.stageName.substring(0, 20), 70, y);
        pdfDoc.text(`${row.daysOverdue}d`, 120, y);
        pdfDoc.text(row.riskLevel, 140, y);
        pdfDoc.text(row.responsibleName.substring(0, 20), 170, y);
        y += 7;
        pdfDoc.setDrawColor(220, 220, 220);
        pdfDoc.line(14, y - 2, 196, y - 2);
      });
    }

    pdfDoc.save(`relatorio-dalpiaz-${today.replace(/\//g, '-')}.pdf`);
  };

  // ── Excel Export ──────────────────────────────────────────────────────────────

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Obras
    const obrasData = projects.map(p => ({
      'Nome da Obra':       p.name,
      'Cliente':            p.client,
      'Tipo':               p.tipo ?? '—',
      'Complexidade':       p.complexidade ?? '—',
      'Status':             p.status,
      'Progresso Real (%)': p.progress,
      'Data Início':        p.startDate,
      'Data Término':       p.endDate,
      'Área (m²)':          p.area ?? '—',
      'Pavimentos':         p.floors ?? '—',
      'Unidades':           p.units ?? '—',
      'Equipe':             p.teamSize ?? '—',
      'Custo Estimado (R$)': p.estimatedCost ?? '—',
      'Gasto Real (R$)':    calculateTotalExpenses(p.id),
      'Cidade':             `${p.city}/${p.state}`,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(obrasData), 'Obras');

    // Sheet 2: Etapas
    const etapasData = scheduleStages.map(s => {
      const project     = projects.find(p => p.id === s.obraId);
      const responsible = teamMembers.find(m => m.id === s.responsibleId);
      return {
        'Obra':             project?.name ?? '—',
        'Etapa':            s.name,
        'Status':           s.status,
        'Progresso (%)':    s.progress,
        'Início Previsto':  s.plannedStart,
        'Término Previsto': s.plannedEnd,
        'Término Real':     s.actualEnd ?? '—',
        'Responsável':      responsible?.name ?? '—',
        'Observações':      s.notes ?? '',
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(etapasData), 'Etapas');

    // Sheet 3: Despesas
    const despesasData = expenses.map(e => {
      const project = projects.find(p => p.id === e.obraId);
      const stage   = scheduleStages.find(s => s.id === e.etapaId);
      const user    = teamMembers.find(m => m.id === e.createdBy);
      return {
        'Obra':        project?.name ?? '—',
        'Data':        e.date,
        'Descrição':   e.description,
        'Categoria':   e.category,
        'Fornecedor':  e.fornecedor ?? '—',
        'Etapa':       stage?.name ?? '—',
        'Valor (R$)':  e.value,
        'Observações': e.notes ?? '',
        'Lançado por': user?.name ?? '—',
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(despesasData), 'Despesas');

    // Sheet 4: Indicadores
    const avgProgress = projects.length > 0
      ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)
      : 0;
    const indicadoresData = [
      { 'Indicador': 'Total de Obras',          'Valor': projects.length },
      { 'Indicador': 'Obras Ativas',            'Valor': projects.filter(p => p.status === 'Em andamento').length },
      { 'Indicador': 'Obras Concluídas',        'Valor': projects.filter(p => p.status === 'Concluída').length },
      { 'Indicador': 'Etapas Atrasadas',        'Valor': totalDelayedStages },
      { 'Indicador': 'Obras em Atenção',        'Valor': projectsUnderReview },
      { 'Indicador': 'Dias Médio de Atraso',    'Valor': averageDaysOverdue },
      { 'Indicador': 'Atrasos Críticos (>15d)', 'Valor': criticalDelayCount },
      { 'Indicador': 'Progresso Médio (%)',     'Valor': avgProgress },
      { 'Indicador': 'Total de Despesas (R$)',  'Valor': expenses.reduce((s, e) => s + e.value, 0) },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(indicadoresData), 'Indicadores');

    const today = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    XLSX.writeFile(wb, `relatorio-dalpiaz-${today}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#1a2332]">Relatórios</h1>
          <p className="text-gray-500 text-sm">Desempenho geral e alertas de atraso</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-green-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-green-700 transition text-sm"
          >
            <FileSpreadsheet size={16} /> Exportar Excel
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 bg-[#1a2332] text-white font-bold px-5 py-2.5 rounded-xl hover:bg-[#243347] transition text-sm"
          >
            <FileDown size={16} /> Exportar PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Etapas Atrasadas', value: totalDelayedStages,  icon: Clock,         color: 'text-red-500',    light: 'bg-red-50' },
          { label: 'Obras em Atenção', value: projectsUnderReview, icon: AlertTriangle,  color: 'text-yellow-500', light: 'bg-yellow-50' },
          { label: 'Dias Médio Atraso', value: `${averageDaysOverdue}d`, icon: TrendingDown, color: 'text-orange-500', light: 'bg-orange-50' },
          { label: 'Críticos (>15d)',   value: criticalDelayCount,  icon: AlertTriangle,  color: 'text-red-600',    light: 'bg-red-50' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className={`w-11 h-11 ${kpi.light} rounded-xl flex items-center justify-center mb-4`}>
              <kpi.icon size={22} className={kpi.color} />
            </div>
            <p className="text-gray-500 text-xs mb-1">{kpi.label}</p>
            <p className="text-[#1a2332] text-3xl font-black">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Planned vs Actual Progress Chart */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-black text-[#1a2332] text-lg mb-5">Planejado vs Realizado por Obra</h2>
        {/* Rolagem horizontal: cada obra ocupa no mínimo 90px, então com muitas
            obras cadastradas o gráfico continua legível (você desliza pros lados)
            em vez de espremer todas as barras na largura da tela. */}
        <div className="overflow-x-auto">
          <div style={{ minWidth: Math.max(progressComparisonChartData.length * 90, 600) }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={progressComparisonChartData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                <CartesianGrid key="reports-bar-grid" strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  key="reports-bar-xaxis"
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis key="reports-bar-yaxis" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip
                  key="reports-bar-tooltip"
                  formatter={v => [`${v}%`]}
                  labelFormatter={(_label, payload) => payload?.[0]?.payload?.fullName ?? _label}
                  cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }}
                />
                <Legend key="reports-bar-legend" verticalAlign="top" height={36} />
                <Bar key="reports-bar-planejado" dataKey="Planejado" fill="#E8821A" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar key="reports-bar-realizado" dataKey="Realizado" fill="#3B82F6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Delayed stages detail table */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-black text-[#1a2332] text-lg mb-4">Etapas com Atraso</h2>
        {delayedStageReportRows.length === 0 ? (
          <div className="text-center py-12 text-gray-300">
            <Clock size={40} className="mx-auto mb-3" />
            <p className="font-semibold text-sm">Nenhuma etapa atrasada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-gray-400 font-semibold pb-3 px-2">Obra</th>
                  <th className="text-left text-gray-400 font-semibold pb-3 px-2">Etapa</th>
                  <th className="text-left text-gray-400 font-semibold pb-3 px-2">Dias Atrasado</th>
                  <th className="text-left text-gray-400 font-semibold pb-3 px-2">Impacto</th>
                  <th className="text-left text-gray-400 font-semibold pb-3 px-2">Responsável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {delayedStageReportRows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="py-3 px-2 text-[#1a2332] font-semibold text-xs">{row.projectName}</td>
                    <td className="py-3 px-2 text-gray-600 text-xs">{row.stageName}</td>
                    <td className="py-3 px-2 text-red-600 font-bold text-xs">{row.daysOverdue} dias</td>
                    <td className="py-3 px-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${riskLevelBadgeClasses(row.riskLevel)}`}>
                        {row.riskLevel}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-gray-500 text-xs">{row.responsibleName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}