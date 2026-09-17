import { Link } from 'react-router-dom';
import { UserShell } from '@/components/user/UserShell';
import { useTnpscCatalog } from '@/hooks/use-tnpsc';
import { questionCountLabel } from '@/config/tnpsc';
import { BookOpen, Timer, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * "Mock Tests" and "Practice" in the sidebar are the same hierarchy as Exams,
 * entered on a chosen track — the stage page reads `?tab=` and opens there.
 */
export default function UserTrackPage({ track }: { track: 'mock' | 'practice' }) {
  const { groups } = useTnpscCatalog();
  const isMock = track === 'mock';

  const stages = groups.flatMap(g =>
    g.stages.filter(s => s.status === 'active').map(s => ({ group: g, stage: s })),
  );

  return (
    <UserShell>
      <div className="mb-5">
        <span className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
          isMock
            ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300'
            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
        )}>
          {isMock ? <Timer className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
          {isMock ? 'Mock Tests' : 'Practice Tests'}
        </span>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
          {isMock ? 'Full-length mock tests' : 'Syllabus-wise practice'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {isMock
            ? 'Real exam pattern, in one sitting. Pick the stage you are preparing for.'
            : 'Short sets by subject and topic. Revise anything, any time.'}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {stages.map(({ group, stage }) => (
          <Link
            key={stage.id}
            to={`/user/exams/${group.id}/${stage.id}?tab=${track}`}
            className="group rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800 transition-all relative overflow-hidden"
          >
            <div className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', group.accent)} />
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-indigo-500">{group.name}</p>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-1">{stage.name}</h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{stage.description}</p>
            {stage.pattern && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                <Chip label={`${questionCountLabel(stage.pattern)} questions`} />
                <Chip label={`${stage.pattern.total_marks} marks`} />
                <Chip label={`${stage.pattern.duration_minutes / 60}h`} />
              </div>
            )}
            <div className="flex items-center justify-end mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                Open <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </UserShell>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="text-[10px] bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md">
      {label}
    </span>
  );
}
