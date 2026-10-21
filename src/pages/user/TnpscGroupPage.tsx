import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { UserShell } from '@/components/user/UserShell';
import { useTnpscCatalog } from '@/hooks/use-tnpsc';
import { findGroup, questionCountLabel, type TnpscStage } from '@/config/tnpsc';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  Clock,
  FileText,
  Layers,
  Lock,
  RefreshCw,
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
          <p className="text-[13px] text-gray-600 dark:text-gray-400 mt-1.5 max-w-3xl">{group.description}</p>
          {structure.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
                Paper structure{group.stages.length > 1 && featured ? ` · ${featured.short_name}` : ''}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {structure.map(row => (
                  <span
                    key={row.label}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md"
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

      {/* What practising here is like — only for an examination that can be sat today. */}
      {featured && (
        <div className="mb-6 rounded-2xl border border-sky-200 dark:border-sky-900/50 bg-gradient-to-b from-sky-50/80 to-white dark:from-sky-950/20 dark:to-gray-900 p-4 sm:p-5 animate-fadeIn">
          <div className="flex items-start gap-3">
            <Sparkles className="w-7 h-7 shrink-0 text-orange-500" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-gray-100">Prepare Smarter for {group.name}</h2>
              <p className="mt-0.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                Practice with fresh questions, multiple difficulty levels and AI-powered insights.
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { icon: RefreshCw, title: 'Fresh Questions', text: 'Every attempt gets a new set of questions.' },
              { icon: Layers, title: '3 Difficulty Levels', text: 'Practice from Simple to Complex.' },
              { icon: BarChart3, title: 'AI Insights', text: 'Know your strengths and areas to improve.' },
            ].map(f => (
              <div key={f.title} className="rounded-xl bg-white/80 dark:bg-gray-900/60 border border-sky-100 dark:border-sky-900/40 px-2 py-3 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                  <f.icon className="w-5 h-5" />
                </span>
                <p className="mt-2 text-[11px] sm:text-sm font-bold leading-tight text-gray-900 dark:text-gray-100">{f.title}</p>
                <p className="mt-1 text-[10px] sm:text-xs leading-snug text-gray-500 dark:text-gray-400">{f.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs sm:text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="w-3.5 h-3.5" />
            </span>
            No repeated questions. Learn better. Score higher.
          </p>
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
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
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
              : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400',
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
        {disabled && (
          <span className="text-[11px] text-gray-500 dark:text-gray-400">Opening soon on the portal</span>
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
    <span className="inline-flex items-center gap-1 text-[11px] bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-md">
      {icon}
      {label}
    </span>
  );
}
