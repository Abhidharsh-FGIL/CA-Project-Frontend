/**
 * "A fresh set every attempt" — the note shown just before a test or exam starts, so nobody is surprised
 * that a retake is not the same paper. It is shown until the user ticks "Don't show this again".
 *
 * Use the hook: `request()` runs `proceed` straight away when the note has been switched off, and opens
 * the note otherwise (proceeding only when they press "Let's Begin!"). Put `dialog` anywhere in the page.
 */
import { useCallback, useState, type ReactNode } from 'react';
import { BadgeCheck, Brain, RefreshCw, Shuffle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

const STORAGE_KEY = 'mge:fresh-questions-notice:hidden';

// Storage can be blocked (private windows, site data off): the note then simply shows every time.
function isHidden(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function hideForGood() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* nothing to do — it will show again next time */
  }
}

const POINTS = [
  {
    icon: RefreshCw,
    title: 'New Set, Every Time',
    text: 'Each attempt brings a fresh mix of questions to strengthen your preparation.',
    tone: 'bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400',
  },
  {
    icon: BadgeCheck,
    title: 'Curated & Validated by Experts',
    text: 'Questions reviewed by experienced subject experts for accuracy and exam relevance.',
    tone: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
  },
  {
    icon: Brain,
    title: 'Learn Concepts, Not Answers',
    text: 'Build real understanding instead of memorizing questions.',
    tone: 'bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400',
  },
];

export function FreshQuestionsNotice({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  /** Pressed "Let's Begin!". `dontShowAgain` is the state of the checkbox. */
  onConfirm: (dontShowAgain: boolean) => void;
  onCancel: () => void;
}) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <Dialog open={open} onOpenChange={next => !next && onCancel()}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-3xl border-0 bg-white p-0 shadow-2xl dark:bg-gray-900 [&>button]:right-3 [&>button]:top-3 [&>button]:z-10 [&>button]:text-white">
        {/* Hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-400 to-pink-500 px-6 pb-7 pt-8 text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-black/10 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <span className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/40 backdrop-blur">
              <Shuffle className="h-7 w-7" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/80">Before you begin</p>
              <DialogTitle className="mt-1 text-xl font-extrabold leading-tight text-white sm:text-2xl">
                Fresh Questions. Every Attempt.
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="relative mt-3 text-sm leading-relaxed text-white/90">
            Practise with a new selection of expert-validated questions every time.
          </DialogDescription>
        </div>

        {/* Points */}
        <ul className="space-y-4 px-6 pb-2 pt-6">
          {POINTS.map(p => (
            <li key={p.title} className="flex items-start gap-3.5">
              <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl ${p.tone}`}>
                <p.icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{p.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{p.text}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="px-6 pb-6 pt-5">
          <label className="flex cursor-pointer select-none items-center gap-2.5 text-xs font-medium text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={e => setDontShowAgain(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400 dark:border-gray-600 dark:bg-gray-800"
            />
            Don&rsquo;t show this again
          </label>
          <button
            type="button"
            onClick={() => onConfirm(dontShowAgain)}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:from-orange-600 hover:to-orange-700 hover:shadow-xl dark:shadow-orange-950/40"
          >
            Let&rsquo;s Begin!
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** `request()` starts the test, after the note when it has not been switched off. */
export function useFreshQuestionsNotice(proceed: () => void): { request: () => void; dialog: ReactNode } {
  const [open, setOpen] = useState(false);

  const request = useCallback(() => {
    if (isHidden()) proceed();
    else setOpen(true);
  }, [proceed]);

  const dialog = (
    <FreshQuestionsNotice
      open={open}
      onCancel={() => setOpen(false)}
      onConfirm={dontShowAgain => {
        if (dontShowAgain) hideForGood();
        setOpen(false);
        proceed();
      }}
    />
  );

  return { request, dialog };
}
