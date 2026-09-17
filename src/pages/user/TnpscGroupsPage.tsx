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
        <div className="relative overflow-hidden rounded-2xl border border-indigo-100 dark:border-indigo-900 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/50 dark:via-purple-950/50 dark:to-pink-950/50 bg-[length:200%_auto] animate-gradient-x p-5 sm:p-6">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-purple-300/30 dark:bg-purple-700/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.25em] text-indigo-700 dark:text-indigo-300 font-bold mb-2">
              Choose your examination
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Competitive <span className="gradient-text-animated">Examinations</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1.5 max-w-2xl">
              Pick the examination you are preparing for. Each one opens into its stages, level-wise
              mock tests and syllabus-based practice tests.
            </p>
          </div>
        </div>
      </div>

      {isLoading && groups.length === 0 ? (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          <span className="text-sm">Loading examinations…</span>
        </div>
      ) : (
        <TnpscGroupGrid groups={groups} />
      )}
    </UserShell>
  );
}
