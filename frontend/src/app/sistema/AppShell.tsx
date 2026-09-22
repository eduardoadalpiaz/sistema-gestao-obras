/**
 * AppShell.tsx
 * Persistent application shell: sidebar navigation, mobile top bar,
 * sync status indicator, and the main content outlet.
 */
import { Outlet, NavLink, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Building2, Calendar, FileBarChart,
  Users, LogOut, Menu, X, Bell, Loader2, Wifi, WifiOff, Receipt, FolderOpen, History,
} from 'lucide-react';
import { Toaster } from 'sonner';
import { useConstructionManagement } from '../context/construction-context';

// Navigation items — label and path for each section of the system.
// `restrictedTo`, when present, limits visibility to those staff roles.
const NAV_ITEMS = [
  { to: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/obras',      label: 'Obras',        icon: Building2 },
  { to: '/cronograma', label: 'Cronograma',   icon: Calendar },
  { to: '/gastos',     label: 'Gastos',       icon: Receipt },
  { to: '/documentos', label: 'Documentos',   icon: FolderOpen },
  { to: '/relatorios', label: 'Relatórios',   icon: FileBarChart },
  { to: '/usuarios',   label: 'Usuários',     icon: Users },
  { to: '/historico',  label: 'Histórico',    icon: History, restrictedTo: ['TI', 'Dono'] as const },
];

/** Sidebar rendered both on desktop (persistent) and mobile (overlay). */
function NavigationSidebar({ onClose }: { onClose?: () => void }) {
  const {
    activeUser, logout, countUnreadNotifications,
    isSyncConnected,
  } = useConstructionManagement();
  const navigate = useNavigate();
  const unreadCount = countUnreadNotifications();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex flex-col h-full bg-[#1a2332]">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-10 h-10 bg-[#E8821A] rounded-xl flex items-center justify-center shrink-0">
          <Building2 size={20} className="text-white" />
        </div>
        <div>
          <div className="text-white font-black text-base leading-tight">Dal Piaz</div>
          <div className="text-gray-400 text-xs">Incorporadora</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation links */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS
          .filter(item => !item.restrictedTo || (item.restrictedTo as readonly string[]).includes(activeUser?.role ?? ''))
          .map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-[#E8821A] text-white shadow-lg'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
            {/* Unread notification badge on Dashboard link */}
            {label === 'Dashboard' && unreadCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Server sync status indicator */}
      <div className="px-5 py-3 border-t border-white/5">
        <div className="flex items-center gap-2">
          {isSyncConnected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <Wifi size={11} className="text-green-400" />
              <span className="text-green-400 text-[10px] font-semibold">Sincronizado</span>
            </>
          ) : (
            <>
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
              </span>
              <WifiOff size={11} className="text-yellow-400" />
              <span className="text-yellow-400 text-[10px] font-semibold">Reconectando...</span>
            </>
          )}
        </div>
      </div>

      {/* Active user info + logout */}
      <div className="border-t border-white/10">
        <div className="px-5 py-4">
          <div className="text-white font-bold text-sm">{activeUser?.name}</div>
          <div className="text-gray-400 text-xs">{activeUser?.role}</div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-5 py-3.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors text-sm font-semibold border-t border-white/5"
        >
          <LogOut size={16} /> Sair
        </button>
      </div>
    </div>
  );
}

export function AppShell() {
  const { activeUser, isInitializing, isSyncConnected, countUnreadNotifications } =
    useConstructionManagement();
  const navigate = useNavigate();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const unreadCount = countUnreadNotifications();

  // Redirect to login if no active session
  useEffect(() => {
    if (!activeUser) navigate('/login');
  }, [activeUser, navigate]);

  if (!activeUser) return null;

  // Show loading screen while initial data is being fetched
  if (isInitializing) {
    return (
      <div className="flex h-screen bg-[#1a2332] items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-[#E8821A] rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg">
            <Building2 size={28} className="text-white" />
          </div>
          <Loader2 size={28} className="text-[#E8821A] animate-spin mx-auto mb-3" />
          <p className="text-white font-semibold text-sm">Carregando dados...</p>
          <p className="text-gray-400 text-xs mt-1">Sincronizando com o servidor</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Toast notifications */}
      <Toaster
        position="top-right"
        expand
        richColors={false}
        closeButton
        toastOptions={{
          style: {
            background: '#1a2332',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '12px',
            fontSize: '13px',
          },
        }}
      />

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[200px] shrink-0">
        <NavigationSidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-64 h-full">
            <NavigationSidebar onClose={() => setIsMobileSidebarOpen(false)} />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setIsMobileSidebarOpen(false)} />
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between bg-[#1a2332] px-4 py-3">
          <button onClick={() => setIsMobileSidebarOpen(true)} className="text-white">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-white font-black text-sm">Dal Piaz Sistema</span>
            <span className={`w-2 h-2 rounded-full ${isSyncConnected ? 'bg-green-400' : 'bg-yellow-400'}`} />
          </div>
          <div className="relative">
            <Bell size={20} className="text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
