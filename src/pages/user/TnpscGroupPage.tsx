import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { UserShell } from '@/components/user/UserShell';
import { useTnpscCatalog } from '@/hooks/use-tnpsc';
import { findGroup, questionCountLabel, type TnpscStage } from '@/config/tnpsc';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  FileText,
  Layers,
  Lock,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * /user/exams/:groupId — the stages of a group.
 * Group 1 splits into Prelims + Mains; Group 4 has a single Written examination.
 */
export default function TnpscGroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { groups } = useTnpscCatalog();
  const group = findGroup(groupId, groups);

  if (!group) return <Navigate to="/user/exams" replace />;

  return (
    <UserShell>
      <button
        onClick={() => navigate('/user/exams')}
        className="group inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-4 transition-colors animate-fadeIn"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        All examinations
      </button>

      {/* Group header */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 mb-6 animate-scaleIn">
        <div className={cn('h-1.5 w-full bg-gradient-to-r', group.accent)} />
        <div className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
            {group.tagline}
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{group.name}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5 max-w-3xl">{group.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {group.posts.map(p => (
              <span
                key={p}
                className="text-[11px] font-medium bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">
        {group.stages.length > 1 ? 'Select a stage' : 'Examination'}
      </h2>

      <div className={cn('grid gap-4', group.stages.length > 1 ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-2xl')}>
        {group.stages.map((stage, i) => (
          <StageCard key={stage.id} groupId={group.id} stage={stage} index={i} />
        ))}
      </div>
    </UserShell>
  );
}

function StageCard({ groupId, stage, index }: { groupId: string; stage: TnpscStage; index: number }) {
  const disabled = stage.status !== 'active';
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
            {stage.paper_type === 'objective' ? 'Objective · MCQ' : 'Descriptive'}
          </p>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{stage.short_name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{stage.name}</p>
        </div>
        <span
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
            disabled
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400'
              : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400',
          )}
        >
          {disabled ? <Lock className="w-5 h-5" /> : <Target className="w-5 h-5" />}
        </span>
      </div>

      <p className="text-xs text-gray-600 dark:text-gray-400 mt-3">{stage.description}</p>

      {stage.pattern && (
        <div className="flex flex-wrap gap-2 mt-4">
          <Chip icon={<FileText className="w-3 h-3" />} label={`${questionCountLabel(stage.pattern)} questions`} />
          <Chip icon={<Layers className="w-3 h-3" />} label={`${stage.pattern.total_marks} marks`} />
          <Chip icon={<Clock className="w-3 h-3" />} label={`${stage.pattern.duration_minutes / 60} hours`} />
          {stage.subjects.length > 0 && (
            <Chip icon={<BookOpen className="w-3 h-3" />} label={`${stage.subjects.length} subjects`} />
          )}
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          {disabled ? 'Opening soon on the portal' : 'Mock tests · Practice tests'}
        </span>
        {disabled ? (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 text-xs font-semibold px-3.5 py-2">
            Coming soon
          </span>
        ) : (
          // Same gradient pill as the header's Upgrade action, so the primary
          // control on the page reads as a button rather than a text link.
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-semibold px-3.5 py-2 group-hover:from-indigo-700 group-hover:to-purple-700 transition-all">
            Enter <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        )}
      </div>
    </>
  );

  const className = cn(
    'group flex flex-col rounded-2xl border p-5 transition-all duration-300 animate-slideUp',
    disabled
      ? 'border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/60 opacity-80 cursor-not-allowed'
      : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-xl hover:shadow-indigo-100/50 dark:hover:shadow-black/50 hover:border-indigo-200 dark:hover:border-indigo-800 hover-lift card-shine',
  );

  if (disabled) {
    return (
      <div className={className} style={{ animationDelay: `${index * 0.06}s` }} aria-disabled>
        {body}
      </div>
    );
  }

  return (
    <Link to={`/user/exams/${groupId}/${stage.id}`} className={className} style={{ animationDelay: `${index * 0.06}s` }}>
      {body}
    </Link>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-md">
      {icon}
      {label}
    </span>
  );
}
