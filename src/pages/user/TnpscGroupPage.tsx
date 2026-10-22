import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { UserShell } from '@/components/user/UserShell';
import { useTnpscCatalog } from '@/hooks/use-tnpsc';
import { findGroup, questionCountLabel, type TnpscStage } from '@/config/tnpsc';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Clock,
  FileText,
  Layers,
  Lock,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { paperStructure } from '@/lib/paper-structure';
import { examEntryPath, skipsStageList } from '@/lib/exam-listing';

/**
 * /user/exams/:groupId — the stages of a group.
 * Group 1 splits into Prelims + Mains; Group 4 has a single Written examination.
 */
export default function TnpscGroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { groups } = useTnpscCatalog({ forMyLanguage: true });
  const group = findGroup(groupId, groups);

  if (!group) return <Navigate to="/user/exams" replace />;
  // One stage to sit: this page would only offer it, so go straight in.
  if (skipsStageList(group)) return <Navigate to={examEntryPath(group)} replace />;

  // The first stage a candidate can actually sit — the one whose paper is published.
  const featured = group.stages.find(st => st.status === 'active' && st.pattern);
  const structure = paperStructure(featured?.pattern);

  return (
    <UserShell>
      <button
        onClick={() => navigate('/user/exams')}
        className="group inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-4 transition-colors animate-fadeIn"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        All examinations
      </button>

      {/* Group header */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 mb-6 animate-scaleIn">
        <div className={cn('h-1.5 w-full bg-gradient-to-r', group.accent)} />
        <div className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
            {group.tagline}
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{group.name}</h1>
          <p className="text-sm sm:text-[15px] text-gray-600 dark:text-gray-400 mt-1.5 max-w-3xl">{group.description}</p>
          {structure.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                Paper structure{group.stages.length > 1 && featured ? ` · ${featured.short_name}` : ''}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {structure.map(row => (
                  <span
                    key={row.label}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-medium bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md"
                  >
                    {row.label}
                    <span className="font-bold text-blue-600 dark:text-blue-400">{row.questions} Q</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* The stage to sit on the left; what preparing for it involves on the right, so both are in view at once. */}
      <div className={cn('grid items-start gap-5', featured && 'lg:grid-cols-5')}>
        <section className={cn('flex min-w-0 flex-col', featured && 'lg:col-span-3')}>
          <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-100">
            {group.stages.length > 1 ? 'Select a stage' : 'Examination'}
          </h2>
          <div className={cn('grid gap-4', group.stages.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1')}>
            {group.stages.map((stage, i) => (
              <StageCard key={stage.id} groupId={group.id} stage={stage} index={i} />
            ))}
          </div>
        </section>

        {/* What preparing here involves — only for an examination that can be sat today. Each row is a way in. */}
        {featured && (
          <aside className="flex min-w-0 flex-col lg:col-span-2">
            <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-gray-100">Prepare smarter</h2>
            <div className="flex flex-col rounded-2xl border border-gray-100 bg-white p-4 animate-fadeIn dark:border-gray-800 dark:bg-gray-900 sm:p-5">
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {[
                  {
                    icon: Layers,
                    title: 'Unit-wise practice',
                    text: 'Every unit split into categories and sub-categories.',
                    to: `/user/exams/${group.id}/${featured.id}?tab=practice`,
                    tone: 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
                  },
                  {
                    icon: Target,
                    title: 'Simple · Medium · Complex',
                    text: 'Choose the level that matches where you are.',
                    to: `/user/exams/${group.id}/${featured.id}?tab=practice`,
                    tone: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
                  },
                  {
                    icon: Clock,
                    title: 'Full-length mocks',
                    text: featured.pattern?.total_questions
                      ? `The real ${featured.pattern.total_questions}-question pattern, in one sitting.`
                      : 'The real exam pattern, in one sitting.',
                    to: `/user/exams/${group.id}/${featured.id}?tab=exam`,
                    tone: 'bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300',
                  },
                  {
                    icon: BarChart3,
                    title: 'Insights & study plan',
                    text: 'See your strengths and weak spots, then follow a plan.',
                    to: '/user/performance',
                    tone: 'bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300',
                  },
                ].map(f => (
                  <li key={f.title}>
                    <Link
                      to={f.to}
                      className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    >
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', f.tone)}>
                        <f.icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold leading-snug text-gray-900 dark:text-gray-100">{f.title}</span>
                        <span className="mt-0.5 block text-xs leading-snug text-gray-500 dark:text-gray-400">{f.text}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-orange-500 dark:text-gray-600" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>    </UserShell>
  );
}

function StageCard({ groupId, stage, index }: { groupId: string; stage: TnpscStage; index: number }) {
  const disabled = stage.status !== 'active';
  // The syllabus units the paper covers. A language paper sat in one of two languages counts once.
  const counted = new Set<string>();
  const unitCount = (stage.pattern?.sections ?? []).reduce((total, sec) => {
    if (sec.alternative_to && counted.has(sec.alternative_to)) return total;
    counted.add(sec.name);
    return total + (sec.units?.length ?? 0);
  }, 0);
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
            {stage.paper_type === 'objective' ? 'Objective · MCQ' : 'Descriptive'}
          </p>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{stage.short_name}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{stage.name}</p>
        </div>
        <span
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
            disabled
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400'
              : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400',
          )}
        >
          {disabled ? <Lock className="w-5 h-5" /> : <Target className="w-5 h-5" />}
        </span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">{stage.description}</p>

      {stage.pattern && (
        <div className="flex flex-wrap gap-2 mt-4">
          <Chip icon={<FileText className="w-3 h-3" />} label={`${questionCountLabel(stage.pattern)} questions`} />
          <Chip icon={<Layers className="w-3 h-3" />} label={`${stage.pattern.total_marks} marks`} />
          <Chip icon={<Clock className="w-3 h-3" />} label={`${stage.pattern.duration_minutes / 60} hours`} />
          {unitCount > 0 ? (
            <Chip icon={<BookOpen className="w-3 h-3" />} label={`${unitCount} unit${unitCount === 1 ? '' : 's'}`} />
          ) : (
            stage.subjects.length > 0 && (
              <Chip icon={<BookOpen className="w-3 h-3" />} label={`${stage.subjects.length} subjects`} />
            )
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        {disabled && (
          <span className="text-xs text-gray-500 dark:text-gray-400">Opening soon on the portal</span>
        )}
        {disabled ? (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 text-xs font-semibold px-3.5 py-2">
            Coming soon
          </span>
        ) : (
          // Same gradient pill as the header's Upgrade action, so the primary
          // control on the page reads as a button rather than a text link.
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-400 text-white text-xs font-semibold px-3.5 py-2 group-hover:from-brand-700 group-hover:to-brand-500 transition-all">
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
      : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-xl hover:shadow-blue-100/50 dark:hover:shadow-black/50 hover:border-blue-200 dark:hover:border-blue-800 hover-lift card-shine',
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
    <span className="inline-flex items-center gap-1 text-xs bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-md">
      {icon}
      {label}
    </span>
  );
}
