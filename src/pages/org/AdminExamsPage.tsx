import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { PageHeader } from '@/components/layout/AppShell';
import { Switch } from '@/components/ui/switch';
import { TNPSC_GROUPS } from '@/config/tnpsc';
import { useAdminExams, useSetExamOpen } from '@/hooks/use-exam-availability';
import { OPEN_EXAM_IDS } from '@/lib/exam-listing';
import { isExamOpen } from '@/lib/examAvailabilityApi';
import { cn } from '@/lib/utils';

/** Admin → Exams: switch an examination on or off for students. Off shows "Coming soon" on their Exams page. */
export default function AdminExamsPage() {
  const { data, isLoading, isError } = useAdminExams();
  const set = useSetExamOpen();

  const toggle = (id: string, name: string, isOpen: boolean) =>
    set.mutate(
      { id, isOpen },
      {
        onSuccess: () => toast.success(isOpen ? `${name} is now open to students.` : `${name} now shows as Coming soon.`),
        onError: e => toast.error(e instanceof Error ? e.message : 'Could not change this exam. Please try again.'),
      },
    );

  return (
    <GenVerseShell>
      <PageHeader
        title="Exams"
        description="Switch an examination on to open it to students, or off to show it as Coming soon."
        breadcrumbs={[{ label: 'Dashboard', href: '/org/dashboard' }, { label: 'Exams' }]}
      />
      {isError && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          The server has no exam settings yet, so these show the built-in defaults and switching is not saved.
        </p>
      )}
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
          {TNPSC_GROUPS.map(g => {
            const open = isExamOpen(data?.items, g.id, OPEN_EXAM_IDS);
            const busy = set.isPending && set.variables?.id === g.id;
            return (
              <li key={g.id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{g.name}</p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">{g.authority}</p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    open
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
                  )}
                >
                  {open ? 'Active' : 'Inactive · Coming soon'}
                </span>
                <Switch
                  checked={open}
                  disabled={busy}
                  aria-label={`${g.name} ${open ? 'active' : 'inactive'}`}
                  onCheckedChange={v => toggle(g.id, g.name, v)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </GenVerseShell>
  );
}
