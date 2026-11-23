import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, ImagePlus, Languages, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  EXAM_CARD_LIMITS,
  LOGO_TYPES,
  builtInLanguages,
  logoFileProblem,
  slugify,
  validateExamCard,
  type ExamCard,
} from '@/config/exam-cards';
import { NTPC_LANGUAGES, NTPC_LANGUAGE_LABEL, NTPC_LANGUAGE_NATIVE, type NtpcLanguage } from '@/lib/ntpc-level';
import { EXAM_TONE_KEYS, MUTED, TONES, defaultToneKey, toneFor } from '@/lib/exam-tones';
import { examLogo } from '@/lib/exam-logo';
import { logoSrc, uploadExamLogo } from '@/lib/examCardsApi';
import { cn } from '@/lib/utils';

const FIELD =
  'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300';
const FIELD_ERR = 'border-red-300 focus:ring-red-200';

/** A text box with its character count and, when there is one, its error. */
function Text({
  label,
  value,
  onChange,
  max,
  error,
  placeholder,
  multiline,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  error?: string;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const n = [...value.trim()].length;
  const cls = `${FIELD} ${error ? FIELD_ERR : ''} ${disabled ? 'opacity-60' : ''}`;
  return (
    <label className="block min-w-0">
      <span className="mb-1 flex items-baseline justify-between gap-2 text-[11px] font-semibold text-gray-600 dark:text-gray-300">
        <span>{label}</span>
        {max != null && <span className={n > max ? 'text-red-600' : 'font-normal text-gray-400'}>{n}/{max}</span>}
      </span>
      {multiline ? (
        <textarea rows={3} className={cls} value={value} placeholder={placeholder} disabled={disabled} onChange={e => onChange(e.target.value)} />
      ) : (
        <input className={cls} value={value} placeholder={placeholder} disabled={disabled} onChange={e => onChange(e.target.value)} />
      )}
      {hint && !error && <span className="mt-0.5 block text-[11px] text-gray-500 dark:text-gray-400">{hint}</span>}
      {error && <span className="mt-0.5 block text-[11px] text-red-600">{error}</span>}
    </label>
  );
}

/**
 * How the card will look on the Exams page — its colour, emblem and wording, open or coming soon. A stand-in for the real
 * card (which also draws stages and the catalog's subjects), so what is edited here is visible as it is typed.
 */
export function ExamCardPreview({ card, comingSoon, index = 0 }: { card: ExamCard; comingSoon: boolean; index?: number }) {
  const tone = comingSoon ? MUTED : toneFor(card.id, index, card.tone);
  const logo = card.logo_url ? { src: logoSrc(card.logo_url), alt: card.name } : examLogo(card.id);
  const languages = card.languages ?? builtInLanguages(card.id);
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-white dark:bg-gray-900',
        comingSoon ? 'border-gray-100 bg-gray-50/80 opacity-80 grayscale dark:border-gray-800' : 'border-2 border-teal-400/70 shadow-md dark:border-teal-500/60',
      )}
    >
      <div className={cn(comingSoon ? 'h-[3px]' : 'h-1.5', tone.bar)} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span
              className={cn(
                'mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                comingSoon ? 'border border-gray-300 bg-gray-100 text-gray-500' : 'bg-emerald-500 text-white',
              )}
            >
              {comingSoon ? 'Coming soon' : 'Open now'}
            </span>
            <p className={cn('text-[10px] font-bold uppercase tracking-[0.18em]', tone.eyebrow)}>{card.authority || 'Conducting body'}</p>
            <h3 className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{card.name || 'Exam name'}</h3>
            {card.tagline && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{card.tagline}</p>}
          </div>
          <span className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border', tone.badge)}>
            <img src={logo.src} alt={logo.alt} className="h-10 w-10 object-contain" draggable={false} />
          </span>
        </div>
        {card.description && <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{card.description}</p>}
        {card.subjects.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {card.subjects.slice(0, 6).map(s => (
              <span key={s} className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-[11px] text-gray-500 dark:border-gray-700 dark:bg-gray-800">
                {s}
              </span>
            ))}
          </div>
        )}
        {languages.length > 0 && (
          <div className={cn('mt-3 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-1.5', comingSoon ? 'border-gray-200 bg-gray-50 text-gray-400' : tone.stage)}>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold">
              <Languages className="h-3.5 w-3.5" aria-hidden /> Available in
            </span>
            {languages.map(l => (
              <span key={l} className="rounded-md bg-white px-2 py-0.5 text-xs font-bold text-gray-800 shadow-sm ring-1 ring-black/5 dark:bg-gray-900 dark:text-gray-100">
                {NTPC_LANGUAGE_NATIVE[l]}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Add or edit one exam card. Saving writes it straight to the server (the page does that); nothing here is a draft.
 *
 * An exam the catalog has keeps its stages, subjects and papers wherever they come from — the card is only its wording,
 * emblem, colour and languages. An exam it does not have is an announced one: it also lists its own subjects, and it
 * stays "Coming soon" until the server has a syllabus for it.
 */
export function ExamCardEditor({
  open,
  onOpenChange,
  initial,
  builtIn,
  realIds,
  takenIds,
  comingSoon,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null adds a new exam. */
  initial: ExamCard | null;
  /** The card as the page shows it with nothing saved, so "Use built-in" can go back to it. */
  builtIn?: ExamCard;
  /** The ids the catalog has an exam for. */
  realIds: ReadonlySet<string>;
  /** The other cards' ids. */
  takenIds: ReadonlySet<string>;
  /** The Active switch's state, for the preview. */
  comingSoon: boolean;
  saving: boolean;
  onSave: (card: ExamCard) => void;
}) {
  const adding = initial === null;
  const blank: ExamCard = { id: '', name: '', authority: '', tagline: '', description: '', logo_url: '', tone: '', languages: [], subjects: [] };
  const [card, setCard] = useState<ExamCard>(initial ?? blank);
  const [subjectsText, setSubjectsText] = useState('');
  const [idTouched, setIdTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const start = initial ?? blank;
    setCard(start);
    setSubjectsText(start.subjects.join('\n'));
    setIdTouched(false);
    setSubmitted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const set = (patch: Partial<ExamCard>) => setCard(c => ({ ...c, ...patch }));
  const subjects = subjectsText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const draft: ExamCard = { ...card, subjects };
  const inCatalog = realIds.has(card.id.trim());
  const errors = validateExamCard(draft, takenIds, inCatalog);
  const shown = submitted ? errors : {};
  const effectiveTone = card.tone || defaultToneKey(card.id);

  const toggleLanguage = (l: NtpcLanguage) => {
    const now = new Set(card.languages ?? []);
    if (now.has(l)) now.delete(l);
    else now.add(l);
    set({ languages: NTPC_LANGUAGES.filter(x => now.has(x)) });
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const problem = logoFileProblem(file);
    if (problem) return void toast.error(problem);
    setUploading(true);
    try {
      set({ logo_url: await uploadExamLogo(file) });
    } catch (e) {
      toast.error(/404|not found/i.test(String((e as Error)?.message)) ? 'The server cannot take images yet — see BACKEND_EXAM_CARDS.md.' : `Could not upload: ${(e as Error)?.message ?? 'unknown error'}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    onSave({ ...draft, id: draft.id.trim(), name: draft.name.trim() });
  };

  const useBuiltIn = () => {
    if (!builtIn) return;
    setCard({ ...builtIn, logo_url: '' });
    setSubjectsText(builtIn.subjects.join('\n'));
  };

  return (
    <Dialog open={open} onOpenChange={o => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{adding ? 'Add an exam' : `Edit ${initial?.name || initial?.id}`}</DialogTitle>
          <DialogDescription>
            {adding
              ? 'Add the card first; it shows as Coming soon until the server has a syllabus for the exam and you switch it Active.'
              : inCatalog
                ? 'The wording, emblem, colour and languages on this exam’s card. Its stages and subjects come from the syllabus.'
                : 'An announced exam: a card only, shown as Coming soon.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Text
                label="Exam name"
                value={card.name}
                max={EXAM_CARD_LIMITS.name}
                error={shown.name}
                placeholder="e.g. RRB Group D"
                onChange={v => set({ name: v, ...(adding && !idTouched ? { id: slugify(v) } : {}) })}
              />
              <Text
                label="Exam id"
                value={card.id}
                max={EXAM_CARD_LIMITS.id}
                error={shown.id}
                disabled={!adding}
                placeholder="rrb-group-d"
                hint={adding ? (inCatalog ? 'The catalog has this exam — it can be opened.' : 'Use the catalog’s id if the server already has this exam.') : 'The id cannot change.'}
                onChange={v => {
                  setIdTouched(true);
                  set({ id: v.toLowerCase() });
                }}
              />
            </div>
            <Text
              label="Conducting body"
              value={card.authority}
              max={EXAM_CARD_LIMITS.authority}
              error={shown.authority}
              placeholder="e.g. Railway Recruitment Boards (RRB)"
              onChange={v => set({ authority: v })}
            />
            <Text
              label="Subtitle"
              value={card.tagline}
              max={EXAM_CARD_LIMITS.tagline}
              error={shown.tagline}
              placeholder="e.g. Non-Technical Popular Categories — First-stage CBT"
              onChange={v => set({ tagline: v })}
            />
            <Text
              label="Description"
              multiline
              value={card.description}
              max={EXAM_CARD_LIMITS.description}
              error={shown.description}
              onChange={v => set({ description: v })}
            />

            {/* Emblem */}
            <div>
              <p className="mb-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300">Emblem</p>
              <div className="flex items-center gap-3">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                  <img
                    src={card.logo_url ? logoSrc(card.logo_url) : examLogo(card.id).src}
                    alt=""
                    className="h-12 w-12 object-contain"
                    draggable={false}
                  />
                </span>
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                      {card.logo_url ? 'Replace image' : 'Upload image'}
                    </button>
                    {card.logo_url && (
                      <button
                        type="button"
                        onClick={() => set({ logo_url: '' })}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-red-600 dark:border-gray-700 dark:text-gray-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Use the built-in emblem
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">PNG, JPG, WebP or SVG, under 1 MB. Square works best.</p>
                  {shown.logo_url && <p className="text-[11px] text-red-600">{shown.logo_url}</p>}
                </div>
                <input ref={fileRef} type="file" accept={LOGO_TYPES.join(',')} className="hidden" onChange={e => void upload(e.target.files?.[0])} />
              </div>
            </div>

            {/* Colour */}
            <div>
              <p className="mb-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300">Colour</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Card colour">
                {EXAM_TONE_KEYS.map(k => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={effectiveTone === k}
                    aria-label={k}
                    onClick={() => set({ tone: k })}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-white ring-offset-2 transition dark:ring-offset-gray-900',
                      TONES[k].bar,
                      effectiveTone === k ? 'ring-2 ring-gray-900 dark:ring-white' : 'opacity-70 hover:opacity-100',
                    )}
                  >
                    {effectiveTone === k && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Languages */}
            <div>
              <p className="mb-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300">Papers available in</p>
              <div className="flex flex-wrap gap-2">
                {NTPC_LANGUAGES.map(l => {
                  const on = (card.languages ?? []).includes(l);
                  return (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleLanguage(l)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-semibold transition',
                        on
                          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800',
                      )}
                    >
                      {NTPC_LANGUAGE_LABEL[l]} · {NTPC_LANGUAGE_NATIVE[l]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subjects — only an announced exam lists its own */}
            {!inCatalog && (
              <label className="block">
                <span className="mb-1 flex items-baseline justify-between text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                  <span>Subjects (one a line)</span>
                  <span className={subjects.length > EXAM_CARD_LIMITS.subjects ? 'text-red-600' : 'font-normal text-gray-400'}>
                    {subjects.length}/{EXAM_CARD_LIMITS.subjects}
                  </span>
                </span>
                <textarea
                  rows={5}
                  className={`${FIELD} ${shown.subjects ? FIELD_ERR : ''}`}
                  value={subjectsText}
                  placeholder={'Reasoning\nGeneral Awareness\nMathematics'}
                  onChange={e => setSubjectsText(e.target.value)}
                />
                {shown.subjects && <span className="mt-0.5 block text-[11px] text-red-600">{shown.subjects}</span>}
              </label>
            )}
          </div>

          {/* Preview */}
          <div className="min-w-0 lg:sticky lg:top-0 lg:self-start">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Preview · {comingSoon ? 'Coming soon' : 'Open'}
            </p>
            <ExamCardPreview card={draft} comingSoon={comingSoon} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!adding && builtIn && (
            <button
              type="button"
              onClick={useBuiltIn}
              disabled={saving}
              className="mr-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Use the built-in text
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || uploading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-brand-400 px-4 py-2 text-xs font-semibold text-white shadow-md disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {adding ? 'Add exam' : 'Save'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
