import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  ClipboardList,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Search,
  Timer,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { useEvalUserHistory } from '@/hooks/use-eval-user-history';
import { cn } from '@/lib/utils';
import type { EvalAttemptRow, EvalHistoryUser, HistoryKind } from '@/lib/eval-user-history';

interface Props {
  /** Opens the report of one attempt — or, with no attempt, of the assessment. */
  onViewReport: (assessmentId: string, attempt?: { attemptId: string; label: string }) => void;
}

const KINDS: Array<{ key: HistoryKind; label: string; icon: LucideIcon }> = [
  { key: 'mock', label: 'Mock tests', icon: Timer },
  { key: 'keytopic', label: 'Key Topics', icon: KeyRound },
  { key: 'practice', label: 'Practice tests', icon: Pencil },
  { key: 'unplaced', label: 'Unplaced', icon: EyeOff },
];

const when = (iso: string | null, fmt = 'dd MMM yyyy') => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : format(d, fmt);
};

const minutes = (s: number | null) => (s == null ? '—' : s < 60 ? '< 1 min' : `${Math.round(s / 60)} min`);
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
const tone = (p: number | null) => (p == null ? 'text-muted-foreground' : p >= 70 ? 'text-emerald-600' : p >= 40 ? 'text-amber-600' : 'text-rose-600');

// ─── The list ─────────────────────────────────────────────────────────────────

const LIST_COLUMNS = 'md:grid-cols-[minmax(0,2.6fr)_96px_80px_80px_100px_minmax(110px,0.9fr)_28px]';

/**
 * The Evaluation Hub's History tab: the users who attended anything, and — opening one — the assessments they
 * attended, with how each went. Each attempt's Report button opens that attempt's report.
 */
export function EvalUserHistory({ onViewReport }: Props) {
  const { users, isLoading, truncated, readCount } = useEvalUserHistory();
  const [search, setSearch] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const shown = useMemo(
    () => (q ? users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : users),
    [users, q],
  );
  const { visible, sentinelRef, hasMore, shown: count, total } = useInfiniteList<EvalHistoryUser>(shown, 25);

  const open = openKey ? users.find(u => u.key === openKey) ?? null : null;
  if (open) return <UserDetail user={open} onBack={() => setOpenKey(null)} onViewReport={onViewReport} />;

  if (isLoading && users.length === 0) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  const attempts = users.reduce((n, u) => n + u.attempts.length, 0);
  const done = users.reduce((n, u) => n + u.completed, 0);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users by name or e-mail…" className="pl-9" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Users} label="Users" value={String(users.length)} tone="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300" />
        <Tile icon={ClipboardList} label="Attempts" value={String(attempts)} tone="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300" />
        <Tile icon={Trophy} label="Finished" value={String(done)} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300" />
        <Tile icon={BarChart3} label="Unfinished" value={String(attempts - done)} tone="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300" />
      </div>

      {isLoading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading assessments…
        </p>
      )}

      {shown.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Users className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm">{q ? `No user matches “${search}”.` : isLoading ? 'Looking for attempts…' : 'No one has attended an assessment yet.'}</p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className={cn('hidden items-center gap-3 bg-muted/40 px-4 py-2 md:grid', 'text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground', LIST_COLUMNS)}>
            <span>User</span>
            <span className="text-right">Assessments</span>
            <span className="text-right">Attempts</span>
            <span className="text-right">Finished</span>
            <span className="text-right">Avg score</span>
            <span>Last attempt</span>
            <span />
          </div>
          <div className="divide-y">
            {visible.map(u => (
              <button
                key={u.key}
                type="button"
                onClick={() => setOpenKey(u.key)}
                className={cn('grid w-full grid-cols-2 items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left transition-colors hover:bg-muted/40', LIST_COLUMNS)}
              >
                <span className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{initials(u.name)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{u.name}</span>
                    {u.email && <span className="block truncate text-xs text-muted-foreground">{u.email}</span>}
                  </span>
                </span>
                <Stat label="Assessments" align="right">{u.assessments}</Stat>
                <Stat label="Attempts" align="right"><b>{u.attempts.length}</b></Stat>
                <Stat label="Finished" align="right">{u.completed}</Stat>
                <Stat label="Avg score" align="right">
                  <span className={cn('font-bold', tone(u.avgPercentage))}>{u.avgPercentage != null ? `${u.avgPercentage}%` : '—'}</span>
                </Stat>
                <Stat label="Last attempt">{when(u.lastAt)}</Stat>
                <ChevronRight className="hidden h-4 w-4 justify-self-end text-muted-foreground md:block" />
              </button>
            ))}
          </div>
        </section>
      )}

      {shown.length > 0 && (
        <>
          <div ref={sentinelRef} className="h-1" />
          <p className="py-1 text-center text-xs text-muted-foreground">
            {hasMore ? `Loading more… (${count} of ${total})` : `All ${total} user${total === 1 ? '' : 's'} shown`}
            {truncated && ` · built from the newest ${readCount} assessments`}
          </p>
        </>
      )}
    </div>
  );
}

// ─── One user ─────────────────────────────────────────────────────────────────

const ROW_COLUMNS = 'md:grid-cols-[minmax(0,2.6fr)_minmax(110px,0.9fr)_minmax(150px,1.2fr)_84px_minmax(110px,0.9fr)_minmax(130px,0.9fr)]';

function UserDetail({ user, onBack, onViewReport }: { user: EvalHistoryUser; onBack: () => void; onViewReport: Props['onViewReport'] }) {
  const [tab, setTab] = useState<HistoryKind | null>(null);
  const tabs = KINDS.map(k => ({ ...k, rows: user.attempts.filter(a => a.kind === k.key) })).filter(k => k.rows.length > 0);
  const active = tabs.find(t => t.key === tab) ?? tabs[0] ?? null;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All users
      </button>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">{initials(user.name)}</span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-bold">{user.name}</h2>
          {user.email && (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5" /> {user.email}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={ClipboardList} label="Assessments attended" value={String(user.assessments)} tone="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300" />
        <Tile icon={Users} label="Attempts" value={String(user.attempts.length)} tone="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300" />
        <Tile icon={BarChart3} label="Average score" value={user.avgPercentage != null ? `${user.avgPercentage}%` : '—'} tone="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300" />
        <Tile icon={Trophy} label="Best score" value={user.bestPercentage != null ? `${user.bestPercentage}%` : '—'} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300" />
      </div>

      {!active ? (
        <p className="py-10 text-center text-sm text-muted-foreground">This user has not attended an assessment.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-bold">
              Assessments attended <span className="font-semibold text-muted-foreground">({user.attempts.length})</span>
            </h3>
            {tabs.length > 1 && (
              <div role="tablist" aria-label="Kind of assessment" className="inline-flex rounded-xl bg-muted p-1">
                {tabs.map(t => {
                  const on = t.key === active.key;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setTab(t.key)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all',
                        on ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {t.label}
                      <span className={cn('rounded-full px-1.5 text-[11px] font-bold tabular-nums', on ? 'bg-muted' : 'bg-background/60')}>{t.rows.length}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <section role="tabpanel" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className={cn('hidden items-center gap-3 bg-muted/40 px-4 py-2 md:grid', 'text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground', ROW_COLUMNS)}>
              <span>Assessment</span>
              <span>Date</span>
              <span>Score</span>
              <span>Time</span>
              <span>Status</span>
              <span className="text-right">Report</span>
            </div>
            <div className="divide-y">
              {active.rows.map((a, i) => (
                <AttemptLine key={a.attemptId ?? `${a.assessmentId}-${i}`} a={a} user={user} onViewReport={onViewReport} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

const STATE: Record<EvalAttemptRow['state'], { label: string; cls: string }> = {
  submitted: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900' },
  auto_submitted: { label: 'Auto-submitted', cls: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900' },
  in_progress: { label: 'Not submitted', cls: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900' },
};

function AttemptLine({ a, user, onViewReport }: { a: EvalAttemptRow; user: EvalHistoryUser; onViewReport: Props['onViewReport'] }) {
  const finished = a.state !== 'in_progress';
  const pct = a.percentage;
  // An attempt that was never submitted has no report of its own: the button opens the assessment's report instead.
  const open = () =>
    onViewReport(a.assessmentId, finished && a.attemptId ? { attemptId: a.attemptId, label: user.name || user.email } : undefined);
  return (
    <div className={cn('grid grid-cols-2 items-center gap-x-4 gap-y-3 px-4 py-3.5 transition-colors hover:bg-muted/40', ROW_COLUMNS)}>
      <div className="col-span-2 min-w-0 md:col-span-1">
        <p className="line-clamp-2 text-sm font-bold leading-snug">{a.assessmentTitle}</p>
      </div>
      <Stat label="Date">
        {when(a.submittedAt ?? a.startedAt)}
        <span className="block text-[11px] text-muted-foreground">
          {a.state === 'in_progress' ? 'Started ' : 'Submitted '}
          {when(a.submittedAt ?? a.startedAt, 'hh:mm a')}
        </span>
      </Stat>
      <Stat label="Score">
        {finished && a.score != null ? (
          <span className="flex items-center gap-2">
            <span className="text-sm font-bold tabular-nums">
              {a.score}
              {a.maxScore != null && <span className="font-normal text-muted-foreground">/{a.maxScore}</span>}
            </span>
            {pct != null && (
              <>
                <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                  <span className={cn('block h-full rounded-full', pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500')} style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} />
                </span>
                <span className={cn('text-xs font-bold tabular-nums', tone(pct))}>{Math.round(pct)}%</span>
              </>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </Stat>
      <Stat label="Time">{finished ? minutes(a.timeSeconds) : '—'}</Stat>
      <Stat label="Status">
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', STATE[a.state].cls)}>{STATE[a.state].label}</span>
      </Stat>
      <div className="col-span-2 flex justify-end md:col-span-1">
        <Button size="sm" variant={finished ? 'default' : 'outline'} className="h-8 gap-1.5 text-xs" onClick={open}>
          <Eye className="h-3.5 w-3.5" /> {finished ? 'View Report' : 'Assessment'}
        </Button>
      </div>
    </div>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

function Tile({ icon: Icon, label, value, tone: toneCls }: { icon: LucideIcon; label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-4">
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', toneCls)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold leading-tight tabular-nums">{value}</p>
      </div>
    </div>
  );
}

/** A table cell that, on a phone, names itself above its value. */
function Stat({ label, align, children }: { label: string; align?: 'right'; children: React.ReactNode }) {
  return (
    <div className={cn('min-w-0 text-sm', align === 'right' && 'md:text-right')}>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:hidden">{label}</p>
      {children}
    </div>
  );
}
