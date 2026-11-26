import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Languages, Layers, Sparkles } from 'lucide-react';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { NtpcLevelChip, NtpcLevelDialog } from '@/components/user/NtpcLevelDialog';
import { NTPC_LANGUAGE_NATIVE, isLanguageExam, useNtpcPrefs, type NtpcPrefs } from '@/lib/ntpc-level';
import { examLanguageOf } from '@/lib/exam-language';
import { examLogo } from '@/lib/exam-logo';
import { logoSrc } from '@/lib/examCardsApi';
import { MUTED, toneFor } from '@/lib/exam-tones';
import { cn } from '@/lib/utils';
import { useT } from '@/content/useText';
import type { TnpscGroup } from '@/config/tnpsc';
import { useOpenExamIds } from '@/hooks/use-exam-availability';
import { useExamCards } from '@/hooks/use-exam-cards';
import { builtInLanguages, entryId, examEntries, type ExamCard } from '@/config/exam-cards';
import { examEntryPath, type UpcomingExam } from '@/lib/exam-listing';

/**
 * The entry points of the portal — one card per examination.
 * The /user/exams landing page.
 *
 * The list and what each card says come from the admin's exam cards (Admin → Exams); until the server has any, the
 * built-in listing is used: the open examinations first, then the catalog exams not on sale yet, then a few announced ones
 * that have no catalog entry at all (see `exam-listing.ts`). A card that is not open is greyed and cannot be opened.
 */
export function TnpscGroupGrid({ groups }: { groups: TnpscGroup[] }) {
  const openIds = useOpenExamIds();
  const cards = useExamCards();
  const entries = examEntries(groups, openIds, cards);

  return (
    <CardScroller>
      {entries.map((e, i) =>
        e.kind === 'exam' ? (
          <GroupCard key={entryId(e)} group={e.group} index={i} comingSoon={e.comingSoon} card={e.card} />
        ) : (
          <UpcomingCard key={entryId(e)} exam={e.exam} index={i} card={e.card} />
        ),
      )}
    </CardScroller>
  );
}

/** The emblem a card shows: the admin's upload for it, else the body's own. */
const cardLogo = (groupId: string, card?: ExamCard) =>
  card?.logo_url ? { src: logoSrc(card.logo_url), alt: card.name } : examLogo(groupId);

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

/** The tag on a card that is not open yet. */
function ComingSoonTag() {
  const t = useT();
  return (
    <span className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-[11px] font-bold text-gray-500 dark:text-gray-400">
      <Clock3 className="w-3 h-3" />
      {t('exams.card.comingSoon')}
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
  onOpen,
}: {
  to?: string;
  disabled: boolean;
  index: number;
  children: React.ReactNode;
  /** Called before the card is followed; calling `preventDefault` keeps the aspirant on this page. */
  onOpen?: (e: React.MouseEvent) => void;
}) {
  const t = useT();
  // A fixed width, so the row has cards to scroll through: most of a phone's width, a set width from there up.
  const base =
    'relative flex flex-col overflow-hidden rounded-xl border bg-white dark:bg-gray-900 animate-slideUp shrink-0 snap-start w-[86%] sm:w-[22.5rem] lg:w-[24rem]';
  const style = { animationDelay: `${index * 0.08}s` };

  if (disabled || !to) {
    return (
      <div
        aria-disabled="true"
        title={t('exams.card.comingSoon')}
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
      onClick={onOpen}
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

/**
 * The languages an exam's papers come in, each written in its own script. The admin's list for the exam if it has one;
 * else TNPSC's in Tamil and English, RRB NTPC's in Tamil, English and Hindi. An exam with neither (GAT-B) shows none
 * rather than a guess.
 */
function examLanguages(groupId: string, card?: ExamCard): string[] {
  return (card?.languages ?? builtInLanguages(groupId)).map(l => NTPC_LANGUAGE_NATIVE[l]);
}

/** What a wrong answer costs in the exam's open stage ("0.33"), or null where it costs nothing. */
function negativeMark(group: TnpscGroup): number | null {
  const stage = group.stages.find(s => s.status === 'active') ?? group.stages[0];
  const p = stage?.pattern;
  return p?.negative_marking && p.negative_mark_value ? p.negative_mark_value : null;
}

function GroupCard({ group, index, comingSoon = false, card }: { group: TnpscGroup; index: number; comingSoon?: boolean; card?: ExamCard }) {
  const t = useT();
  const activeStages = group.stages.filter(s => s.status === 'active');
  // RRB NTPC is sat at two levels: the first time it is opened the aspirant is asked which, and can change it after.
  const ntpc = isLanguageExam(group.id) && !comingSoon;
  const { user } = useUserPortal();
  const { level, language, ready, fixedLevel, levelless, save } = useNtpcPrefs(user?.user_id, group.id);
  const navigate = useNavigate();
  const logo = cardLogo(group.id, card);
  const languages = examLanguages(group.id, card);
  const [asking, setAsking] = useState<'enter' | 'change' | null>(null);
  const choose = (prefs: NtpcPrefs) => {
    save(prefs);
    const entering = asking === 'enter';
    setAsking(null);
    if (entering) navigate(examEntryPath(group));
  };
  const tone = comingSoon ? MUTED : toneFor(group.id, index, card?.tone);

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
    <>
    <CardFrame
      to={examEntryPath(group)}
      disabled={comingSoon}
      index={index}
      onOpen={ntpc && !ready ? e => { e.preventDefault(); setAsking('enter'); } : undefined}
    >
      <div className={cn(comingSoon ? 'h-[3px]' : 'h-1.5', 'w-full', tone.bar)} />

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {comingSoon && (
              <div className="mb-2">
                <ComingSoonTag />
              </div>
            )}
            {!comingSoon && (
              <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  {t('exams.card.openNow')}
                </span>
                {/* The one line on the page that is meant to be noticed: it glides in, then a light keeps sweeping across it. */}
                <span className="mge-journey inline-flex items-center gap-1 text-[12px] font-extrabold tracking-wide">
                  <Sparkles className="mge-journey-spark h-3.5 w-3.5 text-amber-500" aria-hidden />
                  <span className="mge-journey-text">{t('exams.card.journey')}</span>
                </span>
              </div>
            )}
            <p className={cn('text-[10px] font-bold uppercase tracking-[0.18em]', tone.eyebrow)}>{group.authority}</p>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1.5">{group.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{group.tagline}</p>
          </div>
          {/* The emblem shows on a card that is not open yet too, drained to grey with the rest of it. */}
          <span
            className={cn(
              'flex-shrink-0 w-14 h-14 rounded-xl border flex items-center justify-center transition-transform',
              !comingSoon && 'group-hover:scale-110',
              tone.badge,
            )}
          >
            <img src={logo.src} alt={logo.alt} className="w-10 h-10 object-contain" draggable={false} />
          </span>
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
                  {showAll ? t('exams.card.showLess') : t('exams.card.more', { count: hiddenSubjects })}
                </button>
              )}
            </div>
          </div>
        )}

        {/* The languages its papers are in — a strip in the card's own colour, so it reads as a feature of the exam. */}
        {languages.length > 0 && (
          <div
            className={cn(
              'mt-4 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2',
              comingSoon ? 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-500' : tone.stage,
            )}
          >
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold">
              <Languages className="h-4 w-4" aria-hidden /> {t('exams.card.languages')}
            </span>
            {languages.map(name => (
              <span
                key={name}
                className={cn(
                  'rounded-md px-2 py-0.5 text-xs font-bold',
                  comingSoon
                    ? 'bg-white/70 text-gray-400 dark:bg-gray-900/60 dark:text-gray-500'
                    : 'bg-white text-gray-800 shadow-sm ring-1 ring-black/5 dark:bg-gray-900 dark:text-gray-100 dark:ring-white/10',
                )}
              >
                {name}
              </span>
            ))}
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
                {!live && <span className="font-medium opacity-70">{t('exams.card.stageSoon')}</span>}
              </span>
            );
          })}
          {/* What a wrong answer costs, beside the stage it applies to. */}
          {negativeMark(group) != null && (
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                comingSoon
                  ? 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-500'
                  : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300',
              )}
            >
              {t('exams.card.negative', { mark: negativeMark(group) })}
            </span>
          )}
        </div>

        {ntpc && ready && (
          <div className="mt-3">
            <NtpcLevelChip
              prefs={{ level, language }}
              fixedLevel={fixedLevel}
              levelless={levelless}
              onChange={() => setAsking('change')}
            />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 font-medium">
            <Layers className="w-3.5 h-3.5 text-gray-400" />
            {comingSoon
              ? t('exams.card.stages.soon', { stages: `${group.stages.length} stage${group.stages.length !== 1 ? 's' : ''}` })
              : t('exams.card.stages.open', { stages: `${group.stages.length} stage${group.stages.length !== 1 ? 's' : ''}`, open: activeStages.length })}
          </span>
          {!comingSoon && (
            <span className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg bg-brand-500 group-hover:bg-brand-600 text-white text-sm font-bold shadow-md shadow-orange-200/60 dark:shadow-none transition-colors">
              {t('exams.card.explore')} <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
          )}
        </div>
      </div>
    </CardFrame>
    {ntpc && <NtpcLevelDialog open={asking !== null} onOpenChange={o => !o && setAsking(null)} value={{ level, language }} fallbackLanguage={examLanguageOf(user?.medium)} onSave={choose} examName={group.name} fixedLevel={fixedLevel} levelless={levelless} />}
    </>
  );
}

/** An announced examination: a name and a line about it, and nothing behind it yet. */
function UpcomingCard({ exam, index, card }: { exam: UpcomingExam; index: number; card?: ExamCard }) {
  const t = useT();
  const logo = card?.logo_url ? { src: logoSrc(card.logo_url), alt: card.name } : null;
  return (
    <CardFrame disabled index={index}>
      <div className={cn('h-[3px] w-full', MUTED.bar)} />
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2">
              <ComingSoonTag />
            </div>
            <p className={cn('text-[10px] font-bold uppercase tracking-[0.18em]', MUTED.eyebrow)}>{exam.authority}</p>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1.5">{exam.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{exam.tagline}</p>
          </div>
          {logo && (
            <span className={cn('flex-shrink-0 w-14 h-14 rounded-xl border flex items-center justify-center', MUTED.badge)}>
              <img src={logo.src} alt={logo.alt} className="w-10 h-10 object-contain" draggable={false} />
            </span>
          )}
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
          {t('exams.card.upcoming')}
        </div>
      </div>
    </CardFrame>
  );
}
