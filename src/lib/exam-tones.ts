/**
 * One colour per examination — the bar across its card, the badge, the eyebrow and the open stage chips all take it, so
 * each exam is recognisable at a glance. Shared by the Exams page and the admin's card editor, so the preview an admin sees
 * is the colour the aspirant gets.
 */
export interface Tone {
  bar: string;
  eyebrow: string;
  badge: string;
  stage: string;
}

export type ExamToneKey = 'blue' | 'teal' | 'violet' | 'amber' | 'rose' | 'indigo';

export const EXAM_TONE_KEYS: readonly ExamToneKey[] = ['blue', 'teal', 'violet', 'indigo', 'amber', 'rose'];

export const TONES: Record<ExamToneKey, Tone> = {
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
const TONE_BY_GROUP: Record<string, ExamToneKey> = {
  'group-1': 'blue',
  'group-2': 'indigo',
  'group-4': 'teal',
  'gat-b': 'violet',
  'rrb-ntpc-cbt-1': 'amber',
  'rrb-ntpc-cbt-1-grad': 'violet',
  'rrb-ntpc-cbt-2': 'rose',
  'ssc-chsl-tier-1': 'teal',
  'ssc-chsl-tier-2': 'blue',
};
const TONE_ORDER = ['blue', 'teal', 'violet', 'amber', 'rose'] as const;

export const isToneKey = (v: unknown): v is ExamToneKey => typeof v === 'string' && v in TONES;

/** The colour an exam gets when the admin has not chosen one. */
export const defaultToneKey = (groupId: string, index = 0): ExamToneKey => TONE_BY_GROUP[groupId] ?? TONE_ORDER[index % TONE_ORDER.length];

/** The admin's choice if there is one, else the exam's own colour. */
export const toneFor = (groupId: string, index: number, chosen?: string | null): Tone =>
  TONES[isToneKey(chosen) ? chosen : defaultToneKey(groupId, index)];

/** What a card that cannot be opened looks like — every colour drained to grey. */
export const MUTED: Tone = {
  bar: 'bg-gray-300 dark:bg-gray-700',
  eyebrow: 'text-gray-400 dark:text-gray-500',
  badge: 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700',
  stage: 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700',
};
