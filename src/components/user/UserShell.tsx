import { ReactNode, useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
  CalendarCheck,
  ClipboardList,
  Home,
  LineChart,
  LogOut,
  Menu,
  Moon,
  Receipt,
  Settings,
  Sparkles,
  Sun,
  User,
  X,
} from 'lucide-react';
import { LogoMark, LogoTile, Wordmark } from '@/components/brand/Brand';
import { SHOW_STUDY_PLAN } from '@/config/features';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface UserShellProps {
  children: ReactNode;
}

interface NavItem {
  to: string;
  label: string;
  /** Used by the phone bar, where a fifth of the width cannot hold two words. */
  short?: string;
  icon: typeof Home;
}

const NAV: NavItem[] = [
  { to: '/user/dashboard', label: 'Dashboard', icon: Home },
  { to: '/user/exams', label: 'Exams', icon: ClipboardList },
  { to: '/user/performance', label: 'Performance', icon: LineChart },
  ...(SHOW_STUDY_PLAN
    ? [{ to: '/user/study-plan', label: 'Study Plan', short: 'Plan', icon: CalendarCheck }]
    : []),
  { to: '/user/history', label: 'History', icon: Receipt },
  // Plans and billing. It is also in the profile menu; this puts it on the bar itself, one click away.
  { to: '/user/subscription', label: 'Subscription', short: 'Plans', icon: Sparkles },
  // Progress is hidden. /user/progress still resolves and the page is untouched;
  // it is only off the bar.
  //
  // Mock Tests and Practice are hidden: both are now reached through Exams → group →
  // stage, where the mock/practice tabs sit under the exam they belong to. A flat
  // top-level entry showed every group's papers at once, which the dashboard and
  // performance screens no longer do.
  //
  // Bookmarks, Notes and Notifications are hidden too. Bookmarks and Notes have no
  // backend to save against (§4 of TNPSC_DASHBOARD_API.md), and the notification
  // surface goes with them. Every route still resolves, so restoring one is a line here.
];

/**
 * The ones that fit a phone; the rest live behind the drawer.
 *
 * A fifth of the width each, so five at most — the order of `NAV` decides which make it, and
 * Subscription, last, is the one that gives way if Study Plan is switched back on.
 */
const MOBILE_NAV = NAV.filter(n =>
  [
    '/user/dashboard',
    '/user/exams',
    '/user/study-plan',
    '/user/performance',
    '/user/history',
    '/user/subscription',
  ].includes(n.to),
).slice(0, 5);

/** The chrome navy from the approved design. One definition, used everywhere. */
export const REPORT_NAVY = '#122447';

const PLAN_LABEL: Record<string, string> = {
  free: 'Free Plan',
  standard: 'Standard',
  ultimate: 'Ultimate',
  premium: 'Premium',
};

/**
 * Whether the subscription plan is shown in the chrome — the tier under the
 * user's name, the upsell card in the drawer, and the Upgrade button.
 *
 * Turned off deliberately rather than deleted: the pages behind it still work
 * and are still reachable from the profile menu, so restoring the promotion is
 * a one-line change rather than a rebuild.
 */
const SHOW_PLAN_UI = false;

export function UserShell({ children }: UserShellProps) {
  const { user, isAuthenticated, logout } = useUserPortal();
  const { theme, toggleMode } = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDark = theme.mode === 'dark';

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Close the drawer whenever navigation happens.
  useEffect(() => setDrawerOpen(false), [pathname]);

  if (!isAuthenticated) return <Navigate to="/user/login" replace />;
  if (!user) return null;

  const planLabel = PLAN_LABEL[user.subscription_tier] ?? 'Free Plan';
  const isFree = SHOW_PLAN_UI && user.subscription_tier === 'free';
  const isActive = (to: string) => pathname === to || pathname.startsWith(to + '/');

  const brand = (
    <Link to="/user/dashboard" className="flex items-center gap-2.5 group">
      {/* On a light surface the mark stands alone; the tile is for dark mode, where its navy cap would vanish. */}
      <span className="flex-shrink-0 rounded-xl p-0.5 transition-transform group-hover:scale-105 dark:bg-white dark:p-1">
        <LogoMark className="h-9 w-auto dark:h-7" />
      </span>
      <div className="min-w-0">
        <p className="text-sm leading-tight whitespace-nowrap truncate">
          <Wordmark />
        </p>
        <p className="hidden xs:block text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-[0.14em] whitespace-nowrap truncate">
          Practice · Prepare · Succeed
        </p>
      </div>
    </Link>
  );

  /** The same lockup as `brand`, inverted for the navy bar. */
  const brandOnNavy = (
    <Link to="/user/dashboard" className="flex items-center gap-2.5 group">
      <LogoTile className="h-9 w-9 transition-transform group-hover:scale-105" />
      <div className="min-w-0 hidden sm:block">
        <p className="text-sm leading-tight whitespace-nowrap">
          <Wordmark onDark />
        </p>
        <p className="text-[9px] font-semibold text-white/60 uppercase tracking-[0.14em] whitespace-nowrap">
          Practice · Prepare · Succeed
        </p>
      </div>
    </Link>
  );

  const navList = (
    <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto scrollbar-thin">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = isActive(to);
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
              active
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-brand-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-100',
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-brand-600 dark:bg-blue-400" />
            )}
            <Icon className="w-[18px] h-[18px] flex-shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const planCard = isFree && (
    <div className="m-3 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/60 dark:to-purple-950/50 border border-blue-100 dark:border-blue-900 p-4">
      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Free Plan</p>
      <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5 leading-snug">
        Mock tests not included in this plan.
      </p>
      <Link
        to="/user/subscription"
        className="mt-3 flex items-center justify-center gap-1.5 w-full rounded-xl bg-gradient-to-r from-brand-600 to-brand-400 text-white text-xs font-semibold py-2 hover:from-brand-700 hover:to-brand-500 transition-all"
      >
        <Sparkles className="w-3.5 h-3.5" /> Upgrade Now
      </Link>
    </div>
  );

  /**
   * Horizontal navigation for the navy bar.
   *
   * The approved design puts navigation in the header rather than a left rail, so
   * the report gets the full page width — which the wide subject and question
   * tables need. The drawer below still carries the same list on small screens.
   */
  const topNav = (
    <nav className="hidden lg:flex items-center gap-0.5">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = isActive(to);
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap',
              active ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white hover:bg-white/10',
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-gray-50/70 dark:bg-gray-950">
      {/* ── Drawer (mobile) ───────────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-[264px] bg-white dark:bg-gray-900 flex flex-col animate-slideInLeft">
            <div className="h-16 flex items-center justify-between px-4">
              {brand}
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            {navList}
            {planCard}
          </div>
        </div>
      )}

      {/* ── Main column ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col h-full">
        {/* Navy chrome from the approved design. One token, REPORT_NAVY, so the
            bar, the drawer head and any print header stay the same colour. */}
        <header
          className="z-30 h-16 flex-shrink-0 border-b border-white/10"
          style={{ background: REPORT_NAVY }}
        >
          <div className="h-full px-3 sm:px-5 flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg text-white/80 hover:bg-white/10"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex-shrink-0 min-w-0">{brandOnNavy}</div>

            <div className="ml-4 hidden lg:block">{topNav}</div>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              {isFree && (
                <Link
                  to="/user/subscription"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-white text-blue-700 text-xs font-semibold px-3.5 py-2 hover:bg-white/90 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Upgrade
                </Link>
              )}

              <button
                onClick={toggleMode}
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Toggle theme"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
              </button>

              {/* Profile */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  className="flex items-center gap-2 pl-1 pr-1 sm:pr-2 py-1 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold">
                    {user.name[0].toUpperCase()}
                  </div>
                  <div className="hidden sm:block text-left leading-tight">
                    <p className="text-xs font-semibold text-white max-w-[110px] truncate">{user.name}</p>
                    {SHOW_PLAN_UI && <p className="text-[10px] text-white/60">{planLabel}</p>}
                  </div>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-scaleIn origin-top-right">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                      <p className="text-sm font-semibold">{user.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    {[
                      { to: '/user/profile', label: 'Profile', icon: User },
                      { to: '/user/profile?tab=settings', label: 'Settings', icon: Settings },
                      { to: '/user/subscription', label: 'Subscription', icon: Sparkles },
                      { to: '/user/billing', label: 'Payment History', icon: Receipt },
                    ].map(({ to, label, icon: Icon }) => (
                      <Link
                        key={label}
                        to={to}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                      >
                        <Icon className="w-4 h-4 text-gray-400" /> {label}
                      </Link>
                    ))}
                    <button
                      onClick={() => {
                        logout();
                        setMenuOpen(false);
                        // Leave the portal before `logout` clears the user, or the guards would send us to /user/login.
                        navigate('/', { replace: true });
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
        </header>

        {/* The only scrolling element — html/body are locked in index.css. */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          <main className="min-w-0 px-3 sm:px-5 py-5 pb-24 lg:pb-6">{children}</main>

          <footer className="hidden lg:flex items-center justify-between px-5 py-4 text-[11px] text-gray-400 dark:text-gray-600 border-t border-gray-100 dark:border-gray-800">
          <span>© 2026 MyGovExams. All rights reserved.</span>
          <span className="flex items-center divide-x divide-gray-200 dark:divide-gray-800">
            <Link to="/terms" target="_blank" rel="noopener noreferrer" className="px-3 hover:text-gray-600 dark:hover:text-gray-400">Terms &amp; Conditions</Link>
            <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="px-3 hover:text-gray-600 dark:hover:text-gray-400">Privacy Policy</Link>
            <a href="mailto:admin@futuregeninnovation.com" className="pl-3 hover:text-gray-600 dark:hover:text-gray-400">Support</a>
            </span>
          </footer>
        </div>
      </div>

      {/* ── Bottom bar (mobile) ───────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-100 dark:border-gray-800 flex items-stretch px-1 py-1.5">
        {MOBILE_NAV.map(({ to, label, short, icon: Icon }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-1 rounded-lg transition-colors',
                active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500',
              )}
            >
              <Icon className={cn('w-[18px] h-[18px] transition-transform', active && 'scale-110')} />
              <span className={cn('text-[10px] leading-tight', active ? 'font-bold' : 'font-medium')}>
                {short ?? label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
