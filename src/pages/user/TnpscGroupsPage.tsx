import { UserShell } from '@/components/user/UserShell';
import { TnpscGroupGrid } from '@/components/user/TnpscGroupGrid';
import { useTnpscCatalog } from '@/hooks/use-tnpsc';
import { BarChart3, BookOpen, ClipboardList, Database, FileText, Loader2, Users, type LucideIcon } from 'lucide-react';
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
      {/* Figures */}
      <div className="mb-4 grid gap-3 rounded-2xl border border-blue-100 dark:border-blue-900/50 bg-gradient-to-r from-blue-50/70 via-white to-orange-50/60 dark:from-blue-950/20 dark:via-gray-900 dark:to-orange-950/10 p-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-blue-100 dark:sm:divide-blue-900/40 animate-fadeIn">
        <Stat icon={<Database className="w-6 h-6" />} tone="blue" value={EXAMS_STATS.questions} label="Group 4 Questions" sub="with various complexity levels">
          <span className="mt-1.5 flex gap-1.5">
            <Level cls="bg-emerald-500">Simple</Level>
            <Level cls="bg-amber-500">Medium</Level>
            <Level cls="bg-rose-500">Complex</Level>
          </span>
        </Stat>
        <Stat icon={<Users className="w-6 h-6" />} tone="violet" value={EXAMS_STATS.aspirants} label="Aspirants" sub="currently practising here" />
        <Stat icon={<FileText className="w-6 h-6" />} tone="sky" value={EXAMS_STATS.newQuestions} label="New Questions" sub="added every week">
          <span className="mt-1 hidden text-[11px] font-semibold italic text-orange-500 sm:block" style={{ fontFamily: 'Kalam, cursive' }}>
            Fresh Questions. Better Practice.
          </span>
        </Stat>
      </div>

      <div className="mb-6 animate-fadeIn">
        <div className="relative overflow-hidden rounded-2xl border border-orange-100 dark:border-orange-900/40 bg-gradient-to-r from-[#fff0e4] via-[#fff6ee] to-[#f4f2f8] dark:from-orange-950/30 dark:via-gray-900 dark:to-blue-950/30 p-5 sm:p-7">
          <ExamArt className="hidden lg:block absolute right-6 xl:right-12 top-1/2 -translate-y-1/2 h-[88%] w-auto opacity-90 dark:opacity-40 pointer-events-none" />
          <p
            className="hidden lg:block absolute right-8 xl:right-16 top-4 max-w-[13rem] text-right text-lg leading-tight text-blue-700/80 dark:text-blue-300/70 pointer-events-none"
            style={{ fontFamily: 'Kalam, cursive' }}
          >
            Your Gateway <br />to a Government Job
          </p>
          <div className="relative max-w-2xl lg:max-w-[58%] xl:max-w-2xl">
            <p className="text-[10px] uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400 font-bold mb-2">
              Choose your examination
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Competitive <span className="text-brand-500">Examinations</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
              Pick the examination you are preparing for. Each one opens into its stages, level-wise
              mock tests and syllabus-based practice tests.
            </p>
          </div>
        </div>
      </div>

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
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300',
};

/** One figure in the strip above the banner. */
function Stat({
  icon,
  tone,
  value,
  label,
  sub,
  children,
}: {
  icon: React.ReactNode;
  tone: string;
  value: string;
  label: string;
  sub: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 sm:px-5 sm:first:pl-0">
      <span className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl', STAT_TONE[tone])}>{icon}</span>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold leading-none text-gray-900 dark:text-gray-100">{value}</p>
        <p className="mt-1 text-sm font-bold text-gray-800 dark:text-gray-200">{label}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{sub}</p>
        {children}
      </div>
    </div>
  );
}

const Level = ({ cls, children }: { cls: string; children: React.ReactNode }) => (
  <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white', cls)}>{children}</span>
);

/**
 * The banner's picture: a checklist, a stopwatch and a stack of books, kept pale so it sits
 * behind the heading rather than competing with it. Decorative, so hidden from assistive tech.
 */
function ExamArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 330 150" fill="none" aria-hidden="true">
      {/* a rising bar chart behind everything */}
      <rect x="10" y="96" width="20" height="44" rx="4" fill="#e6ebf5" />
      <rect x="38" y="72" width="20" height="68" rx="4" fill="#dde4f1" />
      <rect x="66" y="46" width="20" height="94" rx="4" fill="#e6ebf5" />

      {/* the checklist */}
      <rect x="104" y="20" width="104" height="124" rx="12" fill="#f7f9fd" stroke="#d3dcee" strokeWidth="2" />
      <rect x="136" y="10" width="40" height="16" rx="6" fill="#d3dcee" />
      {[0, 1, 2, 3].map(i => (
        <g key={i}>
          <circle cx="127" cy={56 + i * 26} r="8" fill="#fff" stroke="#a8bbdc" strokeWidth="2" />
          <path d={`M123 ${56 + i * 26}l3 3 5-6`} stroke="#7e9bd0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="145" y={53 + i * 26} width={i % 2 ? 44 : 54} height="6" rx="3" fill="#d3dcee" />
        </g>
      ))}

      {/* the stopwatch */}
      <circle cx="252" cy="70" r="36" fill="#fff" stroke="#ffa56b" strokeWidth="6" />
      <circle cx="252" cy="70" r="26" stroke="#ffe0cb" strokeWidth="2" />
      <rect x="243" y="26" width="18" height="9" rx="3" fill="#ffa56b" />
      <rect x="283" y="38" width="9" height="14" rx="3" fill="#ffa56b" transform="rotate(40 283 38)" />
      <path d="M252 70V50M252 70l13 8" stroke="#ff8a3d" strokeWidth="4" strokeLinecap="round" />
      <circle cx="252" cy="70" r="4" fill="#ff8a3d" />

      {/* a stack of books */}
      <rect x="226" y="118" width="96" height="14" rx="4" fill="#c9d5ec" />
      <rect x="234" y="104" width="80" height="14" rx="4" fill="#dbe3f3" />
      <rect x="230" y="132" width="90" height="12" rx="4" fill="#d3dcee" />
    </svg>
  );
}
