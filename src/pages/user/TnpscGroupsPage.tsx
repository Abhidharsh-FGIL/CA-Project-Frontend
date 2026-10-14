import { UserShell } from '@/components/user/UserShell';
import { TnpscGroupGrid } from '@/components/user/TnpscGroupGrid';
import { useTnpscCatalog } from '@/hooks/use-tnpsc';
import { Loader2 } from 'lucide-react';

/** /user/exams — pick an examination from the catalog. */
export default function TnpscGroupsPage() {
  const { groups, isLoading } = useTnpscCatalog();

  return (
    <UserShell>
      <div className="mb-6 animate-fadeIn">
        <div className="relative overflow-hidden rounded-2xl border border-orange-100 dark:border-orange-900/40 bg-gradient-to-r from-[#fff0e4] via-[#fff6ee] to-[#f4f2f8] dark:from-orange-950/30 dark:via-gray-900 dark:to-blue-950/30 p-5 sm:p-7">
          <ExamArt className="hidden lg:block absolute right-6 xl:right-12 top-1/2 -translate-y-1/2 h-[88%] w-auto opacity-90 dark:opacity-40 pointer-events-none" />
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
    </UserShell>
  );
}

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
