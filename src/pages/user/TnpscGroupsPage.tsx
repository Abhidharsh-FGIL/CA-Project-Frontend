import { UserShell } from '@/components/user/UserShell';
import { TnpscGroupGrid } from '@/components/user/TnpscGroupGrid';
import { FreeTestStrip } from '@/components/user/FreeTestStrip';
import { useTnpscCatalog } from '@/hooks/use-tnpsc';
import { BarChart3, BookOpen, ClipboardList, Database, FileText, Loader2, RefreshCw, Users, type LucideIcon } from 'lucide-react';
import { EXAMS_FEATURES, EXAMS_STATS } from '@/config/exams-page';
import { SHOW_STUDY_PLAN } from '@/config/features';
import { cn } from '@/lib/utils';

const FEATURE_ICON: Record<string, LucideIcon> = {
  pyq: FileText,
  tests: ClipboardList,
  ai: BarChart3,
  plan: BookOpen,
  topic: BookOpen,
};

const TONE: Record<string, string> = {
  rose: 'bg-rose-500',
  blue: 'bg-blue-500',
  emerald: 'bg-emerald-500',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
};

/** /user/exams — pick an examination from the catalog. */
export default function TnpscGroupsPage() {
  const { groups, isLoading } = useTnpscCatalog({ forMyLanguage: true });

  return (
    <UserShell>
      {/* One compact dark hero: heading and tagline, with the figures as glass chips. */}
      <section
        className="relative mb-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg shadow-indigo-950/20 animate-fadeIn"
      >
        <span aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-52 w-72 rounded-full bg-orange-500/30 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-64 rounded-full bg-indigo-500/25 blur-3xl" />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '18px 18px' }}
        />

        <div className="relative grid items-center gap-x-8 gap-y-3 px-4 py-3.5 sm:px-6 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-orange-300">
              <span className="h-1 w-5 rounded-full bg-orange-400" aria-hidden />
              Choose your examination
            </p>
            <h1 className="mt-0.5 text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">
              Competitive <span className="bg-gradient-to-r from-orange-300 to-rose-400 bg-clip-text text-transparent">Examinations</span>
            </h1>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
              Pick the examination you are preparing for — stages, level-wise mock tests and syllabus-based practice.
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
              <RefreshCw className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
              New questions every attempt
              <Level cls="bg-emerald-500">Simple</Level>
              <Level cls="bg-amber-500">Medium</Level>
              <Level cls="bg-rose-500">Complex</Level>
            </p>
          </div>

          <div className="flex flex-col gap-2.5 lg:items-end">
            <p
              className="tagline-block tagline-on-dark pointer-events-none hidden pb-2 text-right text-xl font-bold leading-tight lg:inline-block xl:text-2xl"
              style={{ fontFamily: 'Kalam, cursive' }}
            >
              {['Your', 'Gateway', 'to', 'a', 'Government', 'Job'].map((w, i) => (
                <span key={i} className="tagline-word mr-1.5 last:mr-0" style={{ animationDelay: `${0.18 * i}s, 0s` }}>
                  {w}
                </span>
              ))}
              <svg className="tagline-underline" viewBox="0 0 200 10" preserveAspectRatio="none" aria-hidden="true">
                <path d="M2 6 Q 50 0 100 5 T 198 4" />
              </svg>
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Stat icon={<Database className="h-4 w-4" />} tone="blue" value={EXAMS_STATS.questions} label="Questions" />
              <Stat icon={<Users className="h-4 w-4" />} tone="violet" value={EXAMS_STATS.aspirants} label="Aspirants" />
              <Stat icon={<FileText className="h-4 w-4" />} tone="sky" value={EXAMS_STATS.newQuestions} label="New / week" />
            </div>
          </div>
        </div>
      </section>

      {/* Free scheduled tests, as one slim line: upcoming, live, or closed with a result to see. Nothing when there are none. */}
      <FreeTestStrip className="mb-4" />

      {isLoading && groups.length === 0 ? (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          <span className="text-sm">Loading examinations…</span>
        </div>
      ) : (
        <TnpscGroupGrid groups={groups} />
      )}

      {/* What the portal offers */}
      <div className="mt-6 grid gap-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:grid-cols-2 lg:grid-cols-none lg:grid-flow-col lg:auto-cols-fr">
        {EXAMS_FEATURES.filter(f => f.key !== 'plan' || SHOW_STUDY_PLAN).map(f => {
          const Icon = FEATURE_ICON[f.key] ?? BookOpen;
          return (
            <div key={f.key} className="flex items-start gap-3">
              <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white', TONE[f.tone] ?? 'bg-blue-500')}>
                <Icon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-snug text-gray-900 dark:text-gray-100">{f.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">{f.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </UserShell>
  );
}

const STAT_TONE: Record<string, string> = {
  blue: 'bg-blue-400/20 text-blue-300',
  violet: 'bg-violet-400/20 text-violet-300',
  sky: 'bg-sky-400/20 text-sky-300',
};

/** One figure as a glass chip on the dark hero: icon, the number, and what it counts. */
function Stat({ icon, tone, value, label }: { icon: React.ReactNode; tone: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/[0.07] px-2.5 py-1.5 ring-1 ring-white/10 backdrop-blur-sm sm:px-3">
      <span className={cn('hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:flex', STAT_TONE[tone])}>{icon}</span>
      <p className="min-w-0 leading-tight">
        <span className="block text-base font-extrabold tabular-nums">{value}</span>
        <span className="block truncate text-[10px] font-medium text-slate-300">{label}</span>
      </p>
    </div>
  );
}

const Level = ({ cls, children }: { cls: string; children: React.ReactNode }) => (
  <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white', cls)}>{children}</span>
);
