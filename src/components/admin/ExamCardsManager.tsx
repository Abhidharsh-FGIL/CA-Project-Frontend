import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { ExamCardEditor } from '@/components/admin/ExamCardEditor';
import { TNPSC_GROUPS } from '@/config/tnpsc';
import { adminCardList, builtInCard, legacyEntries, moveWithin, type ExamCard } from '@/config/exam-cards';
import { useAdminExamCards, useSaveExamCards } from '@/hooks/use-exam-cards';
import { useAdminExams, useSetExamOpen } from '@/hooks/use-exam-availability';
import { OPEN_EXAM_IDS } from '@/lib/exam-listing';
import { isExamOpen, portalExamIds } from '@/lib/examAvailabilityApi';
import { examLogo } from '@/lib/exam-logo';
import { logoSrc } from '@/lib/examCardsApi';
import { TONES, defaultToneKey } from '@/lib/exam-tones';
import { cn } from '@/lib/utils';

const ICON_BTN =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800';

const move = <T,>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

const noEndpoint = (e: unknown) => /404|not found/i.test(String((e as Error)?.message));

/**
 * Admin → Exams: every card on the Exams page, in the order aspirants see them. Switch an exam Active to open it (or off to
 * show Coming soon), edit its wording, emblem and colour, reorder, and add exams that are announced but not built yet.
 *
 * Everything here saves as it is done — there is no draft. The list is the whole page: an exam with no card here still shows,
 * after these, but one that is here shows exactly as set.
 */
export function ExamCardsManager() {
  const cards = useAdminExamCards();
  const availability = useAdminExams();
  const setOpen = useSetExamOpen();
  const save = useSaveExamCards();
  const [editing, setEditing] = useState<{ index: number | null } | null>(null);

  const items = availability.data?.items;
  const openIds = useMemo(
    () => (items ? new Set(items.filter(r => r.is_open).flatMap(r => portalExamIds(r.exam_id))) : OPEN_EXAM_IDS),
    [items],
  );
  /** The ids the catalog has an exam for: the ones built in, and any the server lists. */
  const realIds = useMemo(() => new Set<string>([...TNPSC_GROUPS.map(g => g.id), ...(items ?? []).flatMap(r => portalExamIds(r.exam_id))]), [items]);
  const list = useMemo(() => adminCardList(cards.isError ? undefined : cards.data, TNPSC_GROUPS, openIds), [cards.data, cards.isError, openIds]);
  const builtIns = useMemo(() => new Map(legacyEntries(TNPSC_GROUPS, openIds).map((e, i) => builtInCard(e, i)).map(c => [c.id, c])), [openIds]);

  const persist = (next: ExamCard[], done: string) =>
    save.mutate(next, {
      onSuccess: () => {
        toast.success(done);
        setEditing(null);
      },
      onError: e => toast.error(noEndpoint(e) ? 'The server has no exam-card setting yet — see BACKEND_EXAM_CARDS.md.' : `Could not save: ${(e as Error)?.message ?? 'unknown error'}`, { duration: 12_000 }),
    });

  const toggle = (card: ExamCard, isOpen: boolean) =>
    setOpen.mutate(
      { id: card.id, isOpen },
      {
        onSuccess: () => toast.success(isOpen ? `${card.name} is now open to students.` : `${card.name} now shows as Coming soon.`),
        onError: e => toast.error(e instanceof Error ? e.message : 'Could not change this exam. Please try again.'),
      },
    );

  const remove = (i: number) => {
    const card = list[i];
    if (!window.confirm(`Remove “${card.name}” from the Exams page?`)) return;
    persist(list.filter((_, k) => k !== i), `${card.name} removed.`);
  };

  /** Where the open exams sit in the list: these are the cards aspirants see first, in this order. */
  const openSlots = useMemo(
    () => list.map((c, i) => (realIds.has(c.id) && isExamOpen(items, c.id, OPEN_EXAM_IDS) ? i : -1)).filter(i => i >= 0),
    [list, realIds, items],
  );

  const editingCard = editing && editing.index !== null ? list[editing.index] : null;
  const busy = save.isPending;

  return (
    <>
      {availability.isError && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          The server has no exam settings yet, so these show the built-in defaults and switching is not saved.
        </p>
      )}
      {cards.isError && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          The server has no exam-card setting yet, so the built-in cards are shown. Editing, images and ordering are saved once the endpoints in
          BACKEND_EXAM_CARDS.md exist.
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {list.length} cards · shown to aspirants in this order. Changes save as you make them.
        </p>
        <button
          type="button"
          onClick={() => setEditing({ index: null })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-brand-400 px-3.5 py-2 text-xs font-semibold text-white shadow-md"
        >
          <Plus className="h-3.5 w-3.5" /> Add exam
        </button>
      </div>

      {!cards.isLoading && openSlots.length > 0 && (
        <section className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Order of active exams</h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Active exams are shown first on the Exams page, in this order. Move one up or down; Coming soon cards keep their places.
          </p>
          <ol className="mt-3 space-y-1.5">
            {openSlots.map((slot, k) => {
              const c = list[slot];
              return (
                <li key={c.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
                  <span className="w-5 text-right text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{k + 1}</span>
                  <img src={c.logo_url ? logoSrc(c.logo_url) : examLogo(c.id).src} alt="" className="h-7 w-7 shrink-0 object-contain" draggable={false} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}</span>
                  <button
                    type="button"
                    className={ICON_BTN}
                    disabled={busy || k === 0}
                    onClick={() => persist(moveWithin(list, openSlots, k, -1), 'Order saved.')}
                    aria-label={`Move ${c.name} up among active exams`}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={ICON_BTN}
                    disabled={busy || k === openSlots.length - 1}
                    onClick={() => persist(moveWithin(list, openSlots, k, 1), 'Order saved.')}
                    aria-label={`Move ${c.name} down among active exams`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {cards.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
          {list.map((c, i) => {
            const real = realIds.has(c.id);
            const open = real && isExamOpen(items, c.id, OPEN_EXAM_IDS);
            const switching = setOpen.isPending && setOpen.variables?.id === c.id;
            const logo = c.logo_url ? logoSrc(c.logo_url) : examLogo(c.id).src;
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span className={cn('h-10 w-1.5 shrink-0 rounded-full', TONES[c.tone || defaultToneKey(c.id, i)].bar, !open && 'opacity-40')} aria-hidden />
                <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800', !open && 'grayscale')}>
                  <img src={logo} alt="" className="h-8 w-8 object-contain" draggable={false} />
                </span>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{c.name}</p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {c.authority || '—'} · <span className="font-mono">{c.id}</span>
                    {!real && <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-800">Announced</span>}
                  </p>
                </div>

                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    open ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
                  )}
                >
                  {open ? 'Active' : 'Coming soon'}
                </span>
                <Switch
                  checked={open}
                  disabled={!real || switching}
                  title={real ? undefined : 'The server needs a syllabus for this exam before it can be opened.'}
                  aria-label={`${c.name} ${open ? 'active' : 'inactive'}`}
                  onCheckedChange={v => toggle(c, v)}
                />

                <div className="flex items-center gap-1.5">
                  <button type="button" className={ICON_BTN} disabled={busy || i === 0} onClick={() => persist(move(list, i, i - 1), 'Order saved.')} aria-label={`Move ${c.name} up`}>
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button type="button" className={ICON_BTN} disabled={busy || i === list.length - 1} onClick={() => persist(move(list, i, i + 1), 'Order saved.')} aria-label={`Move ${c.name} down`}>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button type="button" className={ICON_BTN} disabled={busy} onClick={() => setEditing({ index: i })} aria-label={`Edit ${c.name}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  {!real && (
                    <button type="button" className={`${ICON_BTN} hover:text-red-600`} disabled={busy} onClick={() => remove(i)} aria-label={`Remove ${c.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ExamCardEditor
        open={editing !== null}
        onOpenChange={o => !o && setEditing(null)}
        initial={editingCard}
        builtIn={editingCard ? builtIns.get(editingCard.id) : undefined}
        realIds={realIds}
        takenIds={new Set(list.filter((_, k) => k !== editing?.index).map(c => c.id))}
        comingSoon={!(editingCard && realIds.has(editingCard.id) && isExamOpen(items, editingCard.id, OPEN_EXAM_IDS))}
        saving={busy}
        onSave={card => {
          const index = editing?.index;
          persist(index == null ? [...list, card] : list.map((c, k) => (k === index ? card : c)), index == null ? `${card.name} added.` : `${card.name} saved.`);
        }}
      />
    </>
  );
}
