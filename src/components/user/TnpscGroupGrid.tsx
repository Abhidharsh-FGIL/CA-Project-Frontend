import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Layers, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TnpscGroup } from '@/config/tnpsc';
import { UPCOMING_EXAMS, examEntryPath, splitExams, type UpcomingExam } from '@/lib/exam-listing';

/** Shown after everything else, whatever the catalog's order. */
const LAST_EXAM_IDS: ReadonlySet<string> = new Set(['group-1']);

/**
 * The entry points of the portal — one card per examination.
 * The /user/exams landing page.
 *
 * The open examination comes first. Everything else follows greyed out and cannot be
 * opened: the catalog exams that are not on sale yet, then a few announced ones that have
 * no catalog entry at all (see `exam-listing.ts`).
 */
export function TnpscGroupGrid({ groups }: { groups: TnpscGroup[] }) {
  const split = splitExams(groups);
  const { open } = split;
  // Exams the product has the least to do with yet go at the very end, after the announced ones too.
  const soon = split.soon.filter(g => !LAST_EXAM_IDS.has(g.id));
  const last = split.soon.filter(g => LAST_EXAM_IDS.has(g.id));
  const lead = open.length + soon.length;

  return (
    <CardScroller>
      {open.map((g, i) => (
        <GroupCard key={g.id} group={g} index={i} />
      ))}
      {soon.map((g, i) => (
        <GroupCard key={g.id} group={g} index={open.length + i} comingSoon />
      ))}
      {UPCOMING_EXAMS.map((e, i) => (
        <UpcomingCard key={e.id} exam={e} index={lead + i} />
      ))}
      {last.map((g, i) => (
        <GroupCard key={g.id} group={g} index={lead + UPCOMING_EXAMS.length + i} comingSoon />
      ))}
    </CardScroller>
  );
}

/**
 * The cards in one row that scrolls sideways, not a grid that wraps onto more rows.
 *
 * Swipe or drag on a touch screen, use the arrows with a mouse (a mouse has no sideways scroll of its own),
 * and the row settles on a card edge. An arrow is shown only while there is more to reach in its direction.
 */
function CardScroller({ children }: { children: React.ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  const measure = () => {
    const el = row.current;
    if (!el) return;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [children]);

  const go = (dir: 1 | -1) => {
    const el = row.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const step = (card?.offsetWidth ?? el.clientWidth * 0.8) + 16;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div
        ref={row}
        onScroll={measure}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pt-1 pb-4 -mx-1 px-1 scrollbar-thin"
      >
        {children}
      </div>
      {edge.left && <ScrollArrow dir="left" onClick={() => go(-1)} />}
      {edge.right && <ScrollArrow dir="right" onClick={() => go(1)} />}
    </div>
  );
}

function ScrollArrow({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  const Icon = dir === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 'left' ? 'Earlier exams' : 'More exams'}
      className={cn(
        'hidden sm:flex absolute top-1/2 -translate-y-1/2 z-10 h-10 w-10 items-center justify-center rounded-full',
        'border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 text-gray-700 dark:text-gray-200 shadow-lg backdrop-blur',
        'hover:bg-orange-50 dark:hover:bg-gray-800 transition-colors',
        dir === 'left' ? '-left-3' : '-right-3',
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}

/** Chips that fit a card without pushing the stages and the footer out of line. */
const SUBJECT_CHIP_LIMIT = 6;

/**
 * One colour per examination — the bar across the card, the badge, the eyebrow and the open
 * stage chips all take it, so each exam is recognisable at a glance.
 */
interface Tone {
  bar: string;
  eyebrow: string;
  badge: string;
  stage: string;
}

const TONES: Record<'blue' | 'teal' | 'violet' | 'amber' | 'rose' | 'indigo', Tone> = {
  blue: {
    bar: 'bg-blue-500',
    eyebrow: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-900/50',
    stage: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-800',
  },
  teal: {
    bar: 'bg-teal-500',
    eyebrow: 'text-teal-600 dark:text-teal-400',
    badge: 'bg-teal-50 text-teal-600 border-teal-100 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-900/50',
    stage: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-800',
  },
  violet: {
    bar: 'bg-violet-500',
    eyebrow: 'text-violet-600 dark:text-violet-400',
    badge: 'bg-violet-50 text-violet-600 border-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-900/50',
    stage: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-800',
  },
  indigo: {
    bar: 'bg-indigo-500',
    eyebrow: 'text-indigo-600 dark:text-indigo-400',
    badge: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-900/50',
    stage: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-800',
  },
  amber: {
    bar: 'bg-amber-500',
    eyebrow: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-900/50',
    stage: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-800',
  },
  rose: {
    bar: 'bg-rose-500',
    eyebrow: 'text-rose-600 dark:text-rose-400',
    badge: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-900/50',
    stage: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-800',
  },
};

/** The known exams keep their colour wherever they sit in the list; a new one takes the next free hue. */
const TONE_BY_GROUP: Record<string, keyof typeof TONES> = { 'group-1': 'blue', 'group-2': 'indigo', 'group-4': 'teal', 'gat-b': 'violet' };
const TONE_ORDER = ['blue', 'teal', 'violet', 'amber', 'rose'] as const;

const toneFor = (groupId: string, index: number): Tone =>
  TONES[TONE_BY_GROUP[groupId] ?? TONE_ORDER[index % TONE_ORDER.length]];

/** What a card that cannot be opened looks like — every colour drained to grey. */
const MUTED: Tone = {
  bar: 'bg-gray-300 dark:bg-gray-700',
  eyebrow: 'text-gray-400 dark:text-gray-500',
  badge: 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700',
  stage: 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700',
};

/** The tag on a card that is not open yet. */
function ComingSoonTag() {
  return (
    <span className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-[11px] font-bold text-gray-500 dark:text-gray-400">
      <Clock3 className="w-3 h-3" />
      Coming soon
    </span>
  );
}

/**
 * The frame every card shares.
 *
 * A card that cannot be opened is a `div`, not a link: it is not in the tab order, it has no
 * hover lift, and `aria-disabled` says so to a screen reader. Greying it with CSS alone would
 * have left it clickable.
 */
function CardFrame({
  to,
  disabled,
  index,
  children,
}: {
  to?: string;
  disabled: boolean;
  index: number;
  children: React.ReactNode;
}) {
  // A fixed width, so the row has cards to scroll through: most of a phone's width, a set width from there up.
  const base =
    'relative flex flex-col overflow-hidden rounded-xl border bg-white dark:bg-gray-900 animate-slideUp shrink-0 snap-start w-[86%] sm:w-[22.5rem] lg:w-[24rem]';
  const style = { animationDelay: `${index * 0.08}s` };

  if (disabled || !to) {
    return (
      <div
        aria-disabled="true"
        title="Coming soon"
        className={cn(
          base,
          'border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/60 opacity-70 grayscale cursor-not-allowed select-none',
        )}
        style={style}
      >
        {children}
      </div>
    );
  }

  return (
    <Link
      to={to}
      className={cn(
        base,
        'group border-2 border-teal-400/70 dark:border-teal-500/60 bg-white dark:bg-gray-900 shadow-md dark:shadow-black/40 hover:shadow-lg dark:hover:shadow-black/50 transition-all duration-300 hover-lift',
      )}
      style={style}
    >
      {children}
    </Link>
  );
}

function GroupCard({ group, index, comingSoon = false }: { group: TnpscGroup; index: number; comingSoon?: boolean }) {
  const activeStages = group.stages.filter(s => s.status === 'active');
  const tone = comingSoon ? MUTED : toneFor(group.id, index);

  // Every subject the examination covers, deduped across its stages — Group 4's
  // single stage carries all twelve, while a multi-stage exam would repeat some.
  const allNames = [
    ...new Map(group.stages.flatMap(st => st.subjects).map(sub => [sub.id, sub.name])).values(),
  ];
  // A paper sat in one of two languages can arrive both combined ("General Tamil / General English") and as its
  // two parts; the combined name already says both, so the parts are not listed again. Same name twice, once.
  const combinedParts = new Set(
    allNames.filter(n => n.includes('/')).flatMap(n => n.split('/').map(part => part.trim().toLowerCase())),
  );
  const subjects = allNames.filter(
    (n, i) => n.includes('/') || !combinedParts.has(n.trim().toLowerCase())
  ).filter((n, i, all) => all.findIndex(m => m.trim().toLowerCase() === n.trim().toLowerCase()) === i);
  // "+N more" opens the rest in place. The card is a link, so the toggle must not follow it.
  const [showAll, setShowAll] = useState(false);
  const shownSubjects = showAll ? subjects : subjects.slice(0, SUBJECT_CHIP_LIMIT);
  const hiddenSubjects = subjects.length - SUBJECT_CHIP_LIMIT;
  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowAll(v => !v);
  };

  return (
    <CardFrame to={examEntryPath(group)} disabled={comingSoon} index={index}>
      <div className={cn(comingSoon ? 'h-[3px]' : 'h-1.5', 'w-full', tone.bar)} />

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {!comingSoon && (
              <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  Open now
                </span>
                {/* The one line on the page that is meant to be noticed: it glides in, then a light keeps sweeping across it. */}
                <span className="mge-journey inline-flex items-center gap-1 text-[12px] font-extrabold tracking-wide">
                  <Sparkles className="mge-journey-spark h-3.5 w-3.5 text-amber-500" aria-hidden />
                  <span className="mge-journey-text">Your Success Journey Begins!</span>
                </span>
              </div>
            )}
            <p className={cn('text-[10px] font-bold uppercase tracking-[0.18em]', tone.eyebrow)}>{group.authority}</p>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1.5">{group.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{group.tagline}</p>
          </div>
          {comingSoon ? (
            <ComingSoonTag />
          ) : (
            <span
              className={cn(
                'flex-shrink-0 w-14 h-14 rounded-xl border flex items-center justify-center group-hover:scale-110 transition-transform',
                tone.badge,
              )}
            >
              <img
                src={`${import.meta.env.BASE_URL}tnpsc-logo.png`}
                alt="TNPSC"
                className="w-10 h-10 object-contain"
                draggable={false}
              />
            </span>
          )}
        </div>

        <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400 mt-3 line-clamp-3">{group.description}</p>

        {/* What the paper actually covers — the question behind "is this my exam?" */}
        {subjects.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {shownSubjects.map(name => (
                <span
                  key={name}
                  className={cn(
                    'text-[11px] border px-2.5 py-1 rounded-full',
                    comingSoon
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700'
                      : 'bg-white dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700',
                  )}
                >
                  {name}
                </span>
              ))}
              {hiddenSubjects > 0 && (
                <button
                  type="button"
                  onClick={toggle}
                  aria-expanded={showAll}
                  className={cn(
                    'text-[11px] font-semibold border px-2.5 py-1 rounded-full',
                    comingSoon
                      ? 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      : 'text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-950/30',
                  )}
                >
                  {showAll ? 'Show less' : `+${hiddenSubjects} more`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stage chips — mt-auto pins these and the footer to the card's base. */}
        <div className="flex flex-wrap gap-2 mt-auto pt-5">
          {group.stages.map(s => {
            const live = !comingSoon && s.status === 'active';
            return (
              <span
                key={s.id}
                className={cn(
                  'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border',
                  live
                    ? tone.stage
                    : 'bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700',
                )}
              >
                {live ? <CheckCircle2 className="w-3 h-3" /> : <Clock3 className="w-3 h-3" />}
                {s.short_name}
                {!live && <span className="font-medium opacity-70">Soon</span>}
              </span>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 font-medium">
            <Layers className="w-3.5 h-3.5 text-gray-400" />
            {comingSoon
              ? `${group.stages.length} stage${group.stages.length !== 1 ? 's' : ''} · opening soon`
              : `${group.stages.length} stage${group.stages.length !== 1 ? 's' : ''} · ${activeStages.length} open now`}
          </span>
          {!comingSoon && (
            <span className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg bg-brand-500 group-hover:bg-brand-600 text-white text-sm font-bold shadow-md shadow-orange-200/60 dark:shadow-none transition-colors">
              Explore <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
          )}
        </div>
      </div>
    </CardFrame>
  );
}

/** An announced examination: a name and a line about it, and nothing behind it yet. */
function UpcomingCard({ exam, index }: { exam: UpcomingExam; index: number }) {
  return (
    <CardFrame disabled index={index}>
      <div className={cn('h-[3px] w-full', MUTED.bar)} />
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={cn('text-[10px] font-bold uppercase tracking-[0.18em]', MUTED.eyebrow)}>{exam.authority}</p>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1.5">{exam.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{exam.tagline}</p>
          </div>
          <ComingSoonTag />
        </div>
        <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400 mt-3">{exam.description}</p>

        {exam.subjects.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              {exam.subjects.length} subject{exam.subjects.length !== 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {exam.subjects.map(name => (
                <span
                  key={name}
                  className="text-[11px] border px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto pt-5 flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
          <Layers className="w-3.5 h-3.5 text-gray-400" />
          Opening soon on the portal
        </div>
      </div>
    </CardFrame>
  );
}
