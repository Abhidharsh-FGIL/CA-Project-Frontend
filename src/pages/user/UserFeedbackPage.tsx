import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Bug, CreditCard, Lightbulb, Loader2, MessageCircle, MessageSquareHeart, Pencil, RotateCcw, Send, type LucideIcon } from 'lucide-react';
import { UserShell } from '@/components/user/UserShell';
import { LogoMark } from '@/components/brand/Brand';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { useMyFeedback, useSendFeedback } from '@/hooks/use-feedback';
import {
  CATEGORY_OPTIONS,
  MESSAGE_MAX,
  RATING_LABEL,
  categoryLabel,
  feedbackProblem,
  statusLabel,
  type FeedbackCategory,
  type MyFeedback,
} from '@/lib/feedbackApi';
import { cn } from '@/lib/utils';

const CATEGORY_ICON: Record<FeedbackCategory, LucideIcon> = {
  general: MessageCircle,
  suggestion: Lightbulb,
  bug: Bug,
  content: MessageSquareHeart,
  payment: CreditCard,
};

const MOODS = ['', '😞', '😕', '🙂', '😊', '🤩'];

const STATUS_DOT: Record<string, string> = {
  new: 'bg-blue-500',
  reviewed: 'bg-amber-500',
  resolved: 'bg-emerald-500',
};

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
};

type Stage = 'rating' | 'topic' | 'message' | 'sent';

/**
 * Feedback as a chat with the team. The team asks one thing at a time; the student answers by tapping, then writes a
 * few words in the box at the bottom. Tapping an earlier answer goes back to change it. The team reads every one in
 * the admin portal.
 */
export default function UserFeedbackPage() {
  const { user } = useUserPortal();
  const [stage, setStage] = useState<Stage>('rating');
  const [typing, setTyping] = useState(false);
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [message, setMessage] = useState('');
  const send = useSendFeedback();
  const mine = useMyFeedback();
  const end = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [stage, typing]);

  const first = (user?.name ?? '').trim().split(/\s+/)[0] || 'there';

  /** The team "types" for a moment, then asks the next thing. */
  const next = (to: Stage) => {
    clearTimeout(timer.current);
    setTyping(true);
    timer.current = setTimeout(() => {
      setTyping(false);
      setStage(to);
    }, 650);
  };

  const goBack = (to: Stage) => {
    clearTimeout(timer.current);
    setTyping(false);
    setStage(to);
  };

  const submit = async () => {
    const problem = feedbackProblem({ rating, message });
    if (problem) {
      toast.error(problem);
      return;
    }
    try {
      await send.mutateAsync({ rating, category, message, page: '/user/feedback' });
      next('sent');
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Could not send your feedback. Please try again.');
    }
  };

  const again = () => {
    setStage('rating');
    setRating(0);
    setCategory('general');
    setMessage('');
  };

  const past = (s: Stage) => ['rating', 'topic', 'message', 'sent'].indexOf(stage) > ['rating', 'topic', 'message', 'sent'].indexOf(s);

  return (
    <UserShell>
      <div className="mx-auto max-w-2xl space-y-8 py-1 sm:py-4">
        <section className="overflow-clip rounded-3xl border border-orange-100 bg-white shadow-xl shadow-orange-100/70 dark:border-gray-800 dark:bg-gray-900 dark:shadow-none">
          {/* Header */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-brand-500 via-orange-500 to-pink-500 px-5 py-4 text-white">
            <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-white shadow-md">
              <LogoMark className="h-7 w-auto" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold leading-tight">MyGovExams Team</p>
              <p className="flex items-center gap-1.5 text-xs text-white/90">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                </span>
                We read every message
              </p>
            </div>
          </div>

          {/* Conversation */}
          <div className="max-h-[62vh] min-h-[340px] space-y-3 overflow-y-auto bg-orange-50/40 px-4 py-5 sm:px-6 dark:bg-gray-950/40" aria-live="polite">
            <Team>
              Hi {first}! Thanks for using MyGovExams. How has your experience been so far?
            </Team>

            {stage === 'rating' && !typing && (
              <div className="flex animate-scaleIn flex-wrap justify-end gap-2 pl-10" role="radiogroup" aria-label="Your rating">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} of 5: ${RATING_LABEL[n]}`}
                    onClick={() => {
                      setRating(n);
                      next('topic');
                    }}
                    className="group flex w-[3.9rem] flex-col items-center gap-0.5 rounded-2xl border border-orange-200 bg-white px-1 py-2 shadow-sm transition-all hover:-translate-y-1 hover:border-orange-400 hover:shadow-md active:scale-95 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <span className="text-2xl transition-transform group-hover:scale-125" aria-hidden>
                      {MOODS[n]}
                    </span>
                    <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">{RATING_LABEL[n]}</span>
                  </button>
                ))}
              </div>
            )}

            {(past('rating') || (stage === 'rating' && typing && rating > 0)) && (
              <Me onEdit={() => goBack('rating')}>
                <span aria-hidden>{MOODS[rating]}</span> {RATING_LABEL[rating]} · {rating} / 5
              </Me>
            )}

            {past('rating') && (
              <Team>{rating >= 4 ? 'Wonderful, thank you!' : rating === 3 ? 'Thanks, we want it to be better.' : 'Sorry about that, we will look into it.'} What is it about?</Team>
            )}

            {stage === 'topic' && !typing && (
              <div className="flex animate-scaleIn flex-wrap justify-end gap-2 pl-10">
                {CATEGORY_OPTIONS.map(o => {
                  const Icon = CATEGORY_ICON[o.value];
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => {
                        setCategory(o.value);
                        next('message');
                      }}
                      title={o.hint}
                      className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-orange-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-orange-500 hover:text-white active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-orange-300"
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      {o.label}
                    </button>
                  );
                })}
              </div>
            )}

            {(past('topic') || (stage === 'topic' && typing)) && <Me onEdit={() => goBack('topic')}>{categoryLabel(category)}</Me>}

            {past('topic') && <Team>Got it. Write a few words for us in the box below.</Team>}

            {(past('message') || (stage === 'message' && typing)) && (
              <Me>
                <span className="whitespace-pre-wrap break-words">{message}</span>
              </Me>
            )}

            {stage === 'sent' && !typing && (
              <Team>
                Thank you, {first}! We have your feedback, and our team will read it. It helps us make MyGovExams better for you.
                <button type="button" onClick={again} className="mt-2 flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:underline dark:text-orange-400">
                  <RotateCcw className="h-3 w-3" /> Send another
                </button>
              </Team>
            )}

            {typing && <Typing />}
            <div ref={end} />
          </div>

          {/* Composer */}
          <div className="border-t border-orange-100 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-900 sm:px-4">
            {stage === 'message' && !typing ? (
              <div className="animate-scaleIn">
                <div className="flex items-end gap-2">
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
                    }}
                    maxLength={MESSAGE_MAX}
                    rows={3}
                    autoFocus
                    aria-label="Your message"
                    placeholder="Type your message…"
                    className="min-h-[5rem] flex-1 resize-none rounded-2xl border border-orange-200 bg-orange-50/40 px-4 py-2.5 text-sm text-gray-900 focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-brand-700"
                  />
                  <button
                    type="button"
                    onClick={submit}
                    disabled={send.isPending}
                    aria-label="Send feedback"
                    className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-pink-500 text-white shadow-md shadow-orange-200 transition hover:scale-105 active:scale-95 disabled:opacity-60 dark:shadow-none"
                  >
                    {send.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </button>
                </div>
                <p className="mt-1.5 px-1 text-right text-[11px] tabular-nums text-gray-400">
                  {message.length} / {MESSAGE_MAX}
                </p>
              </div>
            ) : (
              <p className="px-2 py-2.5 text-center text-xs text-gray-400">
                {stage === 'sent' ? 'Your feedback has been sent.' : stage === 'rating' ? 'Tap an answer above to begin.' : 'Choose an answer above.'}
              </p>
            )}
          </div>
        </section>

        {(mine.data?.items.length ?? 0) > 0 && (
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Your messages</p>
            <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
              {mine.data!.items.map(f => (
                <MyItem key={f.feedback_id} f={f} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </UserShell>
  );
}

/** A message from the team, on the left. */
function Team({ children }: { children: ReactNode }) {
  return (
    <div className="flex animate-scaleIn items-end gap-2">
      <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-white shadow ring-1 ring-orange-100 dark:bg-gray-800 dark:ring-gray-700">
        <LogoMark className="h-5 w-auto" />
      </span>
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm leading-relaxed text-gray-800 shadow-sm ring-1 ring-orange-100 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700">
        {children}
      </div>
    </div>
  );
}

/** The student's answer, on the right. Tap the pencil to answer again. */
function Me({ children, onEdit }: { children: ReactNode; onEdit?: () => void }) {
  return (
    <div className="flex animate-scaleIn items-end justify-end gap-2">
      {onEdit && (
        <button type="button" onClick={onEdit} aria-label="Change this answer" title="Change this answer" className="mb-1.5 rounded-full p-1.5 text-gray-400 hover:bg-orange-100 hover:text-orange-600 dark:hover:bg-gray-800">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-500 to-pink-500 px-4 py-2.5 text-sm font-medium leading-relaxed text-white shadow-md shadow-orange-200/70 dark:shadow-none">
        {children}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex items-end gap-2" aria-label="The team is typing">
      <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-white shadow ring-1 ring-orange-100 dark:bg-gray-800 dark:ring-gray-700">
        <LogoMark className="h-5 w-auto" />
      </span>
      <div className="mge-think flex gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3.5 shadow-sm ring-1 ring-orange-100 dark:bg-gray-800 dark:ring-gray-700">
        <span className="h-2 w-2 rounded-full bg-orange-400" />
        <span className="h-2 w-2 rounded-full bg-orange-400" />
        <span className="h-2 w-2 rounded-full bg-orange-400" />
      </div>
    </div>
  );
}

function MyItem({ f }: { f: MyFeedback }) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 py-5 sm:grid-cols-[5.5rem_1fr_auto]">
      <p className="text-2xl font-light tabular-nums text-gray-900 dark:text-gray-50" aria-label={`${f.rating} out of 5`}>
        {f.rating}
        <span className="text-sm text-gray-400"> / 5</span>
      </p>
      <p className="min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700 dark:text-gray-200 sm:col-start-2">{f.message}</p>
      <p className="col-start-2 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 sm:col-start-3 sm:row-start-1 sm:flex-col sm:items-end sm:gap-1">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[f.status] ?? STATUS_DOT.new)} />
          {statusLabel(f.status)}
        </span>
        <span>
          {categoryLabel(f.category)} · {when(f.created_at)}
        </span>
      </p>
    </li>
  );
}
