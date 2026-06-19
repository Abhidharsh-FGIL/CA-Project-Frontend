import { ReactNode, useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { GraduationCap, Bell, User, Settings, LogOut, Crown, Home, Layers, History, Sparkles, Sun, Moon, Receipt } from 'lucide-react';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface UserShellProps {
  children: ReactNode;
}

const TIER_BADGE: Record<string, { label: string; cls: string }> = {
  free: { label: 'Free', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700' },
  standard: { label: 'Standard', cls: 'bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' },
  ultimate: { label: 'Ultimate', cls: 'bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' },
  premium: {
    label: 'Premium',
    cls: 'bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-200 dark:from-amber-900/50 dark:via-yellow-900/50 dark:to-amber-900/50 bg-[length:200%_auto] text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 animate-gradient-x shadow-sm shadow-amber-200 dark:shadow-amber-900/40',
  },
};

export function UserShell({ children }: UserShellProps) {
  const { user, isAuthenticated, notifications, unreadCount, logout, markNotificationRead } = useUserPortal();
  const { theme, toggleMode } = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDark = theme.mode === 'dark';

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!isAuthenticated) return <Navigate to="/user/login" replace />;
  if (!user) return null;

  const tierBadge = TIER_BADGE[user.subscription_tier];
  const navItem = (to: string, icon: ReactNode, label: string) => {
    const active = pathname === to || pathname.startsWith(to + '/');
    return (
      <Link
        to={to}
        className={cn(
          'relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
          active
            ? 'bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/60 dark:to-purple-950/60 text-indigo-700 dark:text-indigo-300 shadow-sm shadow-indigo-100 dark:shadow-indigo-950/50'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-100',
        )}
      >
        {icon}
        {label}
        {active && (
          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500 animate-bounce-soft" />
        )}
      </Link>
    );
  };
  const mobileNavItem = (to: string, icon: ReactNode, label: string) => {
    const active = pathname === to || pathname.startsWith(to + '/');
    return (
      <Link
        to={to}
        className={cn(
          'relative flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg flex-1 transition-all duration-200',
          active ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100',
        )}
      >
        <span className={cn('transition-transform', active && 'scale-110')}>{icon}</span>
        <span className={cn('text-[10px] leading-tight', active ? 'font-bold' : 'font-semibold')}>{label}</span>
        {active && (
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" />
        )}
      </Link>
    );
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-gradient-to-br from-slate-50 to-indigo-50/40 dark:from-slate-950 dark:to-indigo-950/40">
      <header className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-800 z-30">
        <div className="px-3 sm:px-4 lg:px-5 h-16 flex items-center justify-between">
          <Link to="/user/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200 dark:shadow-indigo-900/40 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="font-bold gradient-text text-sm leading-tight">FGIL CA Academy</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">CA & Accounts</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItem('/user/dashboard', <Home className="w-4 h-4" />, 'Dashboard')}
            {navItem('/user/courses', <Layers className="w-4 h-4" />, 'Courses')}
            {navItem('/user/history', <History className="w-4 h-4" />, 'History')}
            {navItem('/user/subscription', <Sparkles className="w-4 h-4" />, 'Upgrade')}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              to="/user/subscription"
              className={cn(
                'hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
                tierBadge.cls,
              )}
            >
              {user.subscription_tier === 'premium' && <Crown className="w-3 h-3" />}
              {tierBadge.label}
            </Link>

            {/* Theme toggle */}
            <button
              onClick={toggleMode}
              className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-all hover:rotate-12"
              aria-label="Toggle theme"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className="relative block w-5 h-5">
                <Sun
                  className={cn(
                    'w-5 h-5 absolute inset-0 transition-all duration-300',
                    isDark ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0',
                  )}
                />
                <Moon
                  className={cn(
                    'w-5 h-5 absolute inset-0 transition-all duration-300',
                    isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90',
                  )}
                />
              </span>
            </button>

            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(o => !o)}
                className={cn(
                  'relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-all',
                  unreadCount > 0 && 'hover:rotate-12',
                )}
                aria-label="Notifications"
              >
                <Bell className={cn('w-5 h-5', unreadCount > 0 && 'animate-wiggle')} />
                {unreadCount > 0 && (
                  <>
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900" />
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping-soft" />
                  </>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-[20rem] sm:w-96 sm:max-w-none bg-white dark:bg-gray-900 rounded-xl shadow-2xl shadow-indigo-100/40 dark:shadow-black/40 border border-gray-100 dark:border-gray-800 overflow-hidden animate-scaleIn origin-top-right">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</p>
                    {unreadCount > 0 && (
                      <span className="text-[10px] bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 px-2 py-0.5 rounded-full font-semibold">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">No notifications</p>
                    ) : (
                      notifications.slice(0, 6).map(n => (
                        <button
                          key={n.notification_id}
                          onClick={() => {
                            markNotificationRead(n.notification_id);
                            setNotifOpen(false);
                            if (n.test_id && n.course_id) navigate(`/user/courses/${n.course_id}`);
                            else navigate('/user/notifications');
                          }}
                          className={cn(
                            'w-full text-left px-4 py-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors',
                            !n.is_read && 'bg-indigo-50/40 dark:bg-indigo-950/30',
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {!n.is_read && (
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={cn('text-sm', n.is_read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100 font-medium')}>
                                {n.message}
                              </p>
                              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{formatTime(n.created_at)}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <Link
                    to="/user/notifications"
                    onClick={() => setNotifOpen(false)}
                    className="block px-4 py-2.5 text-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border-t border-gray-100 dark:border-gray-800"
                  >
                    View all
                  </Link>
                </div>
              )}
            </div>

            {/* Profile menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center gap-2 p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-all ring-2 ring-transparent hover:ring-indigo-200 dark:hover:ring-indigo-800"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-indigo-200 dark:shadow-indigo-900/40">
                  {user.name[0].toUpperCase()}
                </div>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 sm:w-60 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 rounded-xl shadow-2xl shadow-indigo-100/40 dark:shadow-black/40 border border-gray-100 dark:border-gray-800 overflow-hidden animate-scaleIn origin-top-right">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                  </div>
                  <Link
                    to="/user/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  >
                    <User className="w-4 h-4 text-gray-400 dark:text-gray-500" /> Profile
                  </Link>
                  <Link
                    to="/user/profile?tab=settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  >
                    <Settings className="w-4 h-4 text-gray-400 dark:text-gray-500" /> Settings
                  </Link>
                  <Link
                    to="/user/subscription"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  >
                    <Sparkles className="w-4 h-4 text-gray-400 dark:text-gray-500" /> Subscription
                  </Link>
                  <Link
                    to="/user/billing"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  >
                    <Receipt className="w-4 h-4 text-gray-400 dark:text-gray-500" /> Payment History
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                      navigate('/user/login');
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border-t border-gray-100 dark:border-gray-800"
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile nav — icon over label */}
        <nav className="md:hidden flex items-stretch border-t border-gray-100 dark:border-gray-800 py-1 px-1 gap-0.5">
          {mobileNavItem('/user/dashboard', <Home className="w-4 h-4" />, 'Home')}
          {mobileNavItem('/user/courses', <Layers className="w-4 h-4" />, 'Courses')}
          {mobileNavItem('/user/history', <History className="w-4 h-4" />, 'History')}
          {mobileNavItem('/user/subscription', <Sparkles className="w-4 h-4" />, 'Upgrade')}
        </nav>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <div className="px-3 sm:px-4 lg:px-5 py-6 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
