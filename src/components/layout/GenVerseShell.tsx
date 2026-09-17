import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { logoutAdmin } from '@/lib/adminAuthApi';
import { toast } from 'sonner';
import {
  ClipboardCheck,
  ArrowLeft,
  LayoutDashboard,
  Database,
  BookOpen,
  Tag,
  Sparkles,
  Users,
  CreditCard,
  Shield,
  Settings as SettingsIcon,
  Menu,
  X,
  Home,
  ChevronDown,
  LogOut,
} from 'lucide-react';

interface GenVerseShellProps {
  children: ReactNode;
  noScroll?: boolean;
}

interface NavItem {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  group: 'main' | 'content' | 'admin';
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/org/dashboard', icon: LayoutDashboard, group: 'main' },
  { label: 'Evaluation Hub', path: '/org/evaluation', icon: Database, group: 'content' },
  { label: 'Courses', path: '/org/courses', icon: BookOpen, group: 'content' },
  { label: 'Users', path: '/org/users', icon: Users, group: 'admin' },
  { label: 'Promo Codes', path: '/org/promos', icon: Tag, group: 'admin' },
  { label: 'Plans', path: '/org/plans', icon: Sparkles, group: 'admin' },
  { label: 'Payments', path: '/org/payments', icon: CreditCard, group: 'admin' },
  { label: 'Audit Log', path: '/org/audit', icon: Shield, group: 'admin' },
  { label: 'Settings', path: '/org/settings', icon: SettingsIcon, group: 'admin' },
];

/**
 * Determine where the back arrow should go from any /org/* path.
 * Dashboard is the admin home — no back arrow.
 * Paper detail goes back to the Evaluation Hub.
 * All other admin pages go back to the dashboard.
 */
function getBackTarget(pathname: string): string | null {
  if (pathname === '/org/dashboard') return null;
  if (pathname.startsWith('/org/evaluation/paper/')) return '/org/evaluation';
  return '/org/dashboard';
}

function getPageLabel(pathname: string): string {
  if (pathname === '/org/dashboard') return 'Dashboard';
  const item = NAV_ITEMS.find(n => pathname === n.path || pathname.startsWith(n.path + '/'));
  return item?.label || 'Admin';
}

export function GenVerseShell({ children, noScroll = false }: GenVerseShellProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutAdmin();
      toast.success('Logged out successfully');
      navigate('/adminlogin', { replace: true });
    } catch {
      toast.error('Logout failed — you have been signed out locally');
      navigate('/adminlogin', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const backTarget = getBackTarget(pathname);
  const currentLabel = getPageLabel(pathname);
  const logoTarget = pathname.startsWith('/org/') ? '/org/dashboard' : '/';

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
    setSwitcherOpen(false);
  }, [pathname]);

  return (
    <div className="h-[100dvh] overflow-hidden bg-background flex flex-col">
      <header className="h-16 border-b border-border bg-card px-3 sm:px-5 lg:px-6 flex items-center justify-between flex-shrink-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Smart back arrow */}
          {backTarget && (
            <button
              onClick={() => navigate(backTarget)}
              className="p-1.5 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
              aria-label="Back"
              title={`Back to ${backTarget === '/org/dashboard' ? 'Dashboard' : 'Evaluation Hub'}`}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          {/* Logo */}
          <Link to={logoTarget} className="flex items-center gap-2 font-semibold min-w-0 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 via-rose-400 to-amber-500 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform flex-shrink-0">
              <ClipboardCheck className="h-4 w-4 text-white" />
            </div>
            <span className="hidden sm:inline truncate">BrightLearn Admin</span>
          </Link>

          {/* Section switcher — desktop */}
          <div className="hidden md:block relative" ref={switcherRef}>
            <button
              onClick={() => setSwitcherOpen(o => !o)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground bg-muted/60 hover:bg-muted px-3 py-1.5 rounded-lg transition-colors"
            >
              <span className="text-muted-foreground">/</span>
              <span>{currentLabel}</span>
              <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', switcherOpen && 'rotate-180')} />
            </button>

            {switcherOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 bg-card rounded-xl shadow-2xl border border-border overflow-hidden animate-scaleIn origin-top-left">
                <SwitcherGroup label="Main" items={NAV_ITEMS.filter(n => n.group === 'main')} currentPath={pathname} />
                <SwitcherGroup label="Content" items={NAV_ITEMS.filter(n => n.group === 'content')} currentPath={pathname} />
                <SwitcherGroup label="Administration" items={NAV_ITEMS.filter(n => n.group === 'admin')} currentPath={pathname} />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mobile section switcher */}
          <button
            onClick={() => setMobileNavOpen(o => !o)}
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Open menu"
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Home — only show when not already on landing */}
          <Link
            to="/"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Home</span>
          </Link>

          {/* Logout */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-red-600 dark:hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{loggingOut ? 'Logging out…' : 'Logout'}</span>
          </button>
        </div>
      </header>

      {/* Mobile slide-in nav */}
      {mobileNavOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fadeIn"
          onClick={() => setMobileNavOpen(false)}
        >
          <div
            className="absolute top-16 left-0 right-0 bg-card border-b border-border shadow-2xl animate-slideUp max-h-[calc(100vh-4rem)] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <SwitcherGroup label="Main" items={NAV_ITEMS.filter(n => n.group === 'main')} currentPath={pathname} />
            <SwitcherGroup label="Content" items={NAV_ITEMS.filter(n => n.group === 'content')} currentPath={pathname} />
            <SwitcherGroup label="Administration" items={NAV_ITEMS.filter(n => n.group === 'admin')} currentPath={pathname} />
            <Link
              to="/"
              className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:bg-muted border-t border-border"
            >
              <Home className="w-4 h-4" />
              Back to Landing
            </Link>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border-t border-border transition-colors disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              {loggingOut ? 'Logging out…' : 'Logout'}
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className={cn(
          'px-4 py-3 lg:px-6 lg:py-4 w-full flex-1 min-h-0',
          noScroll ? 'overflow-hidden flex flex-col' : 'overflow-y-auto scrollbar-thin'
        )}>
          {children}
        </div>
      </main>
    </div>
  );
}

function SwitcherGroup({
  label,
  items,
  currentPath,
}: {
  label: string;
  items: NavItem[];
  currentPath: string;
}) {
  return (
    <div className="py-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-1.5">{label}</p>
      {items.map(item => {
        const Icon = item.icon;
        const active = currentPath === item.path || currentPath.startsWith(item.path + '/');
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              'flex items-center gap-2.5 px-4 py-2 text-sm transition-colors',
              active
                ? 'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/60 dark:to-purple-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border-l-2 border-indigo-500'
                : 'text-foreground hover:bg-muted',
            )}
          >
            <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground')} />
            <span className="flex-1">{item.label}</span>
            {active && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
          </Link>
        );
      })}
    </div>
  );
}
