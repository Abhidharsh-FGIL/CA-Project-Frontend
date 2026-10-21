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
  Sparkles,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { paperStructure } from '@/lib/paper-structure';

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

      {/* What preparing here involves — only for an examination that can be sat today. Each tile is a way in. */}
      {featured && (
        <div className="mb-6 rounded-2xl border border-sky-200 dark:border-sky-900/50 bg-gradient-to-br from-sky-50/80 via-white to-orange-50/40 dark:from-sky-950/20 dark:via-gray-900 dark:to-orange-950/10 p-4 sm:p-5 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-gray-100">
                  Prepare smarter for {group.name}
                </h2>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                  Syllabus-aligned practice, full-length mocks and insights that show where to work next.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                to={`/user/exams/${group.id}/${featured.id}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-orange-500 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-orange-600"
              >
                Start practising <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to={`/user/exams/${group.id}/${featured.id}?tab=exam`}
                className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition-colors hover:border-orange-300 hover:text-orange-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              >
                Take a mock
              </Link>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Layers,
                title: 'Unit-wise practice',
                text: 'Every unit split into categories and sub-categories.',
                to: `/user/exams/${group.id}/${featured.id}`,
                tone: 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
              },
              {
                icon: Target,
                title: 'Simple · Medium · Complex',
                text: 'Choose the level that matches where you are.',
                to: `/user/exams/${group.id}/${featured.id}`,
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
              <Link
                key={f.title}
                to={f.to}
                className="group flex items-start gap-3 rounded-xl border border-gray-100 bg-white/90 p-3.5 transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900/70 dark:hover:border-orange-900"
              >
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', f.tone)}>
                  <f.icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-snug text-gray-900 dark:text-gray-100">{f.title}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-gray-500 dark:text-gray-400">{f.text}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
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

      <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
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
