import { createBrowserRouter, redirect } from 'react-router';
import { LoginPage }              from './sistema/LoginPage';
import { AppShell }               from './sistema/AppShell';
import { ConstructionDashboard }  from './sistema/ConstructionDashboard';
import { Projects }               from './sistema/Projects';
import { ProjectSchedule }        from './sistema/ProjectSchedule';
import { Reports }                from './sistema/Reports';
import { TeamManagement }         from './sistema/TeamManagement';
import { Expenses }               from './sistema/Expenses';
import { ProjectDocuments }       from './sistema/ProjectDocuments';
import { AuditLog }               from './sistema/AuditLog';

export const router = createBrowserRouter([
  { path: '/',              loader: () => redirect('/login') },
  { path: '/login',         Component: LoginPage },
  { path: '/sistema',       loader: () => redirect('/login') },
  { path: '/sistema/login', loader: () => redirect('/login') },
  {
    path: '/',
    Component: AppShell,
    children: [
      { path: 'dashboard',  Component: ConstructionDashboard },
      { path: 'obras',      Component: Projects },
      { path: 'cronograma', Component: ProjectSchedule },
      { path: 'gastos',     Component: Expenses },
      { path: 'documentos', Component: ProjectDocuments },
      { path: 'relatorios', Component: Reports },
      { path: 'usuarios',   Component: TeamManagement },
      { path: 'historico',  Component: AuditLog },
    ],
  },
]);
