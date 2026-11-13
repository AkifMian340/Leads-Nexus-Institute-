import { LogOut, Menu, X } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { UserRole } from '../../types/institute';

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: string | number;
}

interface AppShellProps {
  role: UserRole;
  userName: string;
  userEmail: string;
  navItems: NavItem[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  onSignOut: () => void;
  headerAction?: ReactNode;
  children: ReactNode;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  teacher: 'Faculty Portal',
  student: 'Student Portal',
  parent: 'Parent Portal',
};

export function AppShell({
  role,
  userName,
  userEmail,
  navItems,
  activeTab,
  onSelectTab,
  onSignOut,
  headerAction,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeItem = navItems.find((item) => item.id === activeTab);

  const sidebarContent = (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800/80 px-5 py-5">
        <div className="text-base font-bold tracking-tight text-white whitespace-nowrap">
          Leads Nexus Institute
        </div>
        <div className="mt-1 text-xs font-medium text-slate-400">
          {ROLE_LABELS[role]}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const isActive = item.id === activeTab;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                setMobileOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-blue-700 text-white'
                  : 'text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <span className="shrink-0 opacity-90">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </span>
              {item.badge !== undefined && (
                <span
                  className={`ml-2 font-mono text-xs tabular-nums ${
                    isActive ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-800/80 p-4">
        <div className="mb-3 min-w-0">
          <div className="truncate text-sm font-medium text-white">{userName}</div>
          <div className="truncate font-mono text-xs text-slate-400">{userEmail}</div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-900 hover:text-white whitespace-nowrap"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 w-64 max-w-[80vw] h-full">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-4 rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-500 whitespace-nowrap">
                Leads Nexus Institute
              </span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <span className="font-semibold text-slate-900 truncate">
                {activeItem?.label ?? 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {headerAction}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-[1360px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
