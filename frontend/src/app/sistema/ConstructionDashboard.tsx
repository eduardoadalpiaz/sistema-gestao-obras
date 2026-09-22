/**
 * ConstructionDashboard.tsx
 * Overview screen: KPI cards, progress charts, delay report, and notification feed.
 */
import { useState } from 'react';
import { useConstructionManagement, SystemNotification } from '../context/construction-context';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Building2, Clock, TrendingUp, AlertTriangle, Bell, CheckCircle2,
  Info, AlertCircle, X, Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function ConstructionDashboard() {
  const {
    projects, scheduleStages, systemNotifications,
    getScheduleStatus, markNotificationRead, markAllNotificationsRead,
  } = useConstructionManagement();

  const [selectedNotification, setSelectedNotification] = useState<SystemNotification | null>(null);

  // ── KPI Computations ────────────────────────────────────────────────────────

  const activeProjectCount   = projects.filter(p => p.status === 'Em andamento').length;
  const delayedProjectCount  = projects.filter(
    p => p.status === 'Em andamento' && getScheduleStatus(p) === 'Atrasada'
  ).length;
  const averageProgressPct   = projects.length > 0
    ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)
    : 0;
  const riskAlertCount       = scheduleStages.filter(s => s.status === 'Atrasada').length;

  // ── Chart Data ──────────────────────────────────────────────────────────────

  const projectProgressChartData = projects.map((p, index) => ({
    name: `${index + 1}. ${p.name.length > 17 ? p.name.substring(0, 15) + '…' : p.name}`,
    progresso: p.progress,
  }));

  // Planned vs Actual trend (last 7 months — representative data)
  const monthLabels    = ['Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar'];
  const plannedTrend   = [8, 18, 30, 42, 55, 65, 75];
  const actualTrend    = [5, 14, 24, 36, 48, 56, averageProgressPct];
  const trendChartData = monthLabels.map((month, i) => ({
    month,
    Planejado: plannedTrend[i],
    Realizado: actualTrend[i],
  }));

  // ── Delayed Stages Report ───────────────────────────────────────────────────

  const delayedStageRows = scheduleStages
    .filter(s => s.status === 'Atrasada')
    .map(stage => {
      const project      = projects.find(p => p.id === stage.obraId);
      const today        = new Date();
      const plannedEndDate = new Date(stage.plannedEnd);
      const daysOverdue  = Math.max(0, Math.round(
        (today.getTime() - plannedEndDate.getTime()) / (1000 * 60 * 60 * 24)
      ));
      const riskLevel    = daysOverdue > 20 ? 'Alto' : daysOverdue > 10 ? 'Médio' : 'Baixo';
      return { ...stage, projectName: project?.name ?? '—', daysOverdue, riskLevel };
    });

  // ── Helper Renderers ────────────────────────────────────────────────────────

  const renderNotificationIcon = (type: string, size = 16) => {
    if (type === 'success') return <CheckCircle2 size={size} className="text-green-500 shrink-0" />;
    if (type === 'warning') return <AlertTriangle size={size} className="text-yellow-500 shrink-0" />;
    if (type === 'error')   return <AlertCircle  size={size} className="text-red-500 shrink-0" />;
    return <Info size={size} className="text-blue-500 shrink-0" />;
  };

  const getNotificationBadge = (type: string) => {
    if (type === 'success') return { text: 'Sucesso',    cls: 'bg-green-100 text-green-700' };
    if (type === 'warning') return { text: 'Atenção',    cls: 'bg-yellow-100 text-yellow-700' };
    if (type === 'error')   return { text: 'Erro',       cls: 'bg-red-100 text-red-700' };
    return                         { text: 'Informação', cls: 'bg-blue-100 text-blue-700' };
  };

  const getRiskLevelStyle = (riskLevel: string) => {
    if (riskLevel === 'Alto')  return 'text-red-600 bg-red-50';
    if (riskLevel === 'Médio') return 'text-yellow-600 bg-yellow-50';
    return                            'text-green-600 bg-green-50';
  };

  const handleNotificationClick = (notification: SystemNotification) => {
    setSelectedNotification(notification);
  };

  const handleMarkSelectedAsRead = async () => {
    if (selectedNotification) {
      await markNotificationRead(selectedNotification.id);
      setSelectedNotification(prev => prev ? { ...prev, read: true } : null);
    }
  };

  const closeNotificationModal = () => setSelectedNotification(null);

  // ── KPI Card Definitions ────────────────────────────────────────────────────

  const kpiCards = [
    {
      label: 'Obras Ativas',
      value: activeProjectCount,
      subtext: '+2 este mês',
      icon: Building2,
      colorClass: 'bg-blue-500',
      lightClass: 'bg-blue-50',
    },
    {
      label: 'Obras Atrasadas',
      value: delayedProjectCount,
      subtext: '-1 vs mês anterior',
      icon: Clock,
      colorClass: 'bg-red-500',
      lightClass: 'bg-red-50',
    },
    {
      label: 'Avanço Médio',
      value: `${averageProgressPct}%`,
      subtext: '+5% este mês',
      icon: TrendingUp,
      colorClass: 'bg-green-500',
      lightClass: 'bg-green-50',
    },
    {
      label: 'Alertas de Risco',
      value: riskAlertCount,
      subtext: `${riskAlertCount} críticos`,
      icon: AlertTriangle,
      colorClass: 'bg-orange-500',
      lightClass: 'bg-orange-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#1a2332]">Dashboard</h1>
          <p className="text-gray-500 text-sm">Visão geral das obras em andamento</p>
        </div>
        {systemNotifications.some(n => !n.read) && (
          <button
            onClick={markAllNotificationsRead}
            className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1"
          >
            <Bell size={14} /> Marcar todas como lidas
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(kpi => (
          <div key={kpi.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className={`w-11 h-11 ${kpi.lightClass} rounded-xl flex items-center justify-center mb-4`}>
              <kpi.icon size={22} className={kpi.colorClass.replace('bg-', 'text-')} />
            </div>
            <p className="text-gray-500 text-xs mb-1">{kpi.label}</p>
            <p className="text-[#1a2332] text-3xl font-black">{kpi.value}</p>
            <p className="text-green-600 text-xs mt-1">{kpi.subtext}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress per Project */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-black text-[#1a2332] text-lg mb-5">Progresso por Obra</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={projectProgressChartData} layout="vertical" margin={{ left: 100, right: 20 }}>
              <CartesianGrid key="bar-grid" strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis key="bar-xaxis" type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
              <YAxis key="bar-yaxis" type="category" dataKey="name" tick={{ fontSize: 11 }} width={95} />
              <Tooltip key="bar-tooltip" formatter={(v) => [`${v}%`, 'Progresso']} />
              <Bar key="bar-progresso" dataKey="progresso" name="Progresso" fill="#3B82F6" radius={[0, 4, 4, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Planned vs Actual Trend */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-black text-[#1a2332] text-lg mb-5">Planejado vs Realizado</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid key="line-grid" strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis key="line-xaxis" dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis key="line-yaxis" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}`} />
              <Tooltip key="line-tooltip" formatter={(v) => [`${v}%`]} />
              <Line key="line-planejado" type="monotone" dataKey="Planejado" stroke="#E8821A" strokeWidth={2} dot={false} strokeDasharray="5 5" isAnimationActive={false} />
              <Line key="line-realizado" type="monotone" dataKey="Realizado" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 4, fill: '#3B82F6' }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-6 mt-3 justify-end">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="w-6 h-0.5 border-dashed border-t-2 border-[#E8821A]" /> Planejado
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="w-6 h-0.5 bg-blue-500" /> Realizado
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Delay Report */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-black text-[#1a2332] text-lg mb-4">Relatório de Atrasos</h2>
          {delayedStageRows.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <CheckCircle2 size={40} className="text-green-400 mx-auto mb-3" />
              <p className="text-sm font-semibold">Nenhum atraso registrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-gray-400 font-semibold pb-2">Obra</th>
                    <th className="text-left text-gray-400 font-semibold pb-2">Etapa</th>
                    <th className="text-left text-gray-400 font-semibold pb-2">Dias</th>
                    <th className="text-left text-gray-400 font-semibold pb-2">Impacto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {delayedStageRows.map(row => (
                    <tr key={row.id}>
                      <td className="py-2.5 text-[#1a2332] font-semibold text-xs">
                        {row.projectName.substring(0, 16)}...
                      </td>
                      <td className="py-2.5 text-gray-600 text-xs">{row.name}</td>
                      <td className="py-2.5 text-red-600 font-bold text-xs">{row.daysOverdue}d</td>
                      <td className="py-2.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getRiskLevelStyle(row.riskLevel)}`}>
                          {row.riskLevel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Notification Feed */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black text-[#1a2332] text-lg">Notificações</h2>
            <button onClick={markAllNotificationsRead} className="text-xs text-blue-600 hover:underline font-semibold">
              Marcar todas como lidas
            </button>
          </div>
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {systemNotifications.slice(0, 8).map(notification => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors group ${
                  notification.read
                    ? 'bg-gray-50 opacity-60 hover:opacity-80'
                    : 'bg-blue-50 border border-blue-100 hover:bg-blue-100'
                }`}
              >
                {renderNotificationIcon(notification.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 leading-relaxed line-clamp-2">{notification.message}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {format(new Date(notification.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!notification.read && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                  <Eye size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors mt-0.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Notification Detail Modal ──────────────────────────────────────────── */}
      {selectedNotification && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                {renderNotificationIcon(selectedNotification.type, 20)}
                <h2 className="font-black text-[#1a2332]">Detalhes da Notificação</h2>
              </div>
              <button onClick={closeNotificationModal} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${getNotificationBadge(selectedNotification.type).cls}`}>
                  {getNotificationBadge(selectedNotification.type).text}
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-700 leading-relaxed">{selectedNotification.message}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>
                  {format(new Date(selectedNotification.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
                <span className={`font-semibold ${selectedNotification.read ? 'text-gray-400' : 'text-blue-500'}`}>
                  {selectedNotification.read ? 'Lida' : 'Não lida'}
                </span>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-5">
              <button
                onClick={closeNotificationModal}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm"
              >
                Fechar
              </button>
              {!selectedNotification.read && (
                <button
                  onClick={handleMarkSelectedAsRead}
                  className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl hover:bg-blue-700 transition text-sm flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={15} /> Marcar como lida
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}