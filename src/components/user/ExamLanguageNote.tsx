import { useState } from 'react';
import { Languages } from 'lucide-react';
import { toast } from 'sonner';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { EXAM_LANGUAGE_OPTIONS, examLanguageOf } from '@/lib/exam-language';
import { cn } from '@/lib/utils';

/**
 * Which language paper the aspirant sits, on a stage that offers the choice — Group 4's General
 * Tamil or General English.
 *
 * It is a row of two buttons rather than a link to the Profile page, because the answer decides what
 * the rest of this screen shows and changing it should show the result at once. With no answer yet
 * (an account from before the question) it asks, and until it is answered both papers are listed.
 */
export function ExamLanguageNote({ className }: { className?: string }) {
  const { user, updateProfile } = useUserPortal();
  const [saving, setSaving] = useState<string | null>(null);
  const chosen = examLanguageOf(user?.medium);

  const choose = async (value: string) => {
    if (saving || examLanguageOf(value) === chosen) return;
    setSaving(value);
    const res = await updateProfile({ medium: value });
    setSaving(null);
    if (!res.ok) toast.error(res.error || 'Could not save your language paper');
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border px-4 py-3',
        chosen
          ? 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'
          : 'border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30',
        className,
      )}
    >
      <span
        className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
          chosen
            ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
            : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
        )}
      >
        <Languages className="w-4 h-4" aria-hidden />
      </span>

      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
          {chosen ? 'Select Your Language' : 'Which language paper do you sit?'}
        </p>
        <p className="text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
          {chosen
            ? 'Choose either General Tamil or General English.'
            : 'You sit General Tamil or General English, never both. Choose yours and only its papers are listed.'}
        </p>
      </div>

      <div role="radiogroup" aria-label="Language paper" className="inline-flex gap-1 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/40 p-1">
        {EXAM_LANGUAGE_OPTIONS.map(o => {
          const active = o.language === chosen;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!!saving}
              onClick={() => choose(o.value)}
              className={cn(
                'rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all disabled:opacity-60',
                active
                  ? 'bg-gradient-to-r from-brand-600 to-brand-400 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-gray-800',
              )}
            >
              {saving === o.value ? 'Saving…' : o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
