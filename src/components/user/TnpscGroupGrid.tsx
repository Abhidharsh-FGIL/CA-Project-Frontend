import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, Layers, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TnpscGroup } from '@/config/tnpsc';

/**
 * The entry points of the portal — one card per examination in the catalog.
 * Shared by the dashboard and the /user/exams landing page.
 */
export function TnpscGroupGrid({ groups }: { groups: TnpscGroup[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((g, i) => (
        <GroupCard key={g.id} group={g} index={i} />
      ))}
    </div>
  );
}

/** Chips that fit a card without pushing the stages and the footer out of line. */
const SUBJECT_CHIP_LIMIT = 6;

function GroupCard({ group, index }: { group: TnpscGroup; index: number }) {
  const activeStages = group.stages.filter(s => s.status === 'active');

  // Every subject the examination covers, deduped across its stages — Group 4's
  // single stage carries all twelve, while a multi-stage exam would repeat some.
  const subjects = [
    ...new Map(group.stages.flatMap(st => st.subjects).map(sub => [sub.id, sub.name])).values(),
  ];
  const shownSubjects = subjects.slice(0, SUBJECT_CHIP_LIMIT);
  const hiddenSubjects = subjects.length - shownSubjects.length;

  return (
    <Link
      to={`/user/exams/${group.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-xl hover:shadow-indigo-100/50 dark:hover:shadow-black/50 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-300 animate-slideUp hover-lift card-shine"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className={cn('h-1.5 w-full bg-gradient-to-r', group.accent)} />

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
              {group.authority}
            </p>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{group.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{group.tagline}</p>
          </div>
          <span
            className={cn(
              'flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow-md group-hover:scale-110 group-hover:rotate-3 transition-transform',
              group.accent,
            )}
          >
            <ShieldCheck className="w-5 h-5" />
          </span>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-400 mt-3 line-clamp-2">{group.description}</p>

        {/* What the paper actually covers — the question behind "is this my exam?" */}
        {subjects.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
              {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-1">
              {shownSubjects.map(name => (
                <span
                  key={name}
                  className="text-[10px] bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded"
                >
                  {name}
                </span>
              ))}
              {hiddenSubjects > 0 && (
                <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 px-1 py-0.5">
                  +{hiddenSubjects} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Stage chips — mt-auto pins these and the footer to the card's base. */}
        <div className="flex flex-wrap gap-2 mt-auto pt-4">
          {group.stages.map(s => (
            <span
              key={s.id}
              className={cn(
                'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border',
                s.status === 'active'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700',
              )}
            >
              {s.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <Clock3 className="w-3 h-3" />}
              {s.short_name}
              {s.status !== 'active' && <span className="opacity-70">· soon</span>}
            </span>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 font-semibold">
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            {group.stages.length} stage{group.stages.length !== 1 ? 's' : ''} · {activeStages.length} open now
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400">
            Open <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>
      </div>
    </Link>
  );
}
