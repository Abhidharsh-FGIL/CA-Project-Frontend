/**
 * "Which level, and in which language?" — asked when an aspirant opens RRB NTPC, and again whenever they choose to
 * change it. The papers they are shown follow the answers (see `lib/ntpc-level.ts`).
 */
import { useEffect, useState } from 'react';
import { BookOpen, Check, GraduationCap, Languages } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NTPC_LANGUAGES, NTPC_LANGUAGE_LABEL, NTPC_LANGUAGE_NATIVE, NTPC_LEVEL_LABEL, isNtpcLanguage, type NtpcLanguage, type NtpcLevel, type NtpcPrefs } from '@/lib/ntpc-level';
import { cn } from '@/lib/utils';

const LEVELS: Array<{ level: NtpcLevel; icon: typeof GraduationCap; line: string; note: string }> = [
  { level: 'graduate', icon: GraduationCap, line: 'I have a degree', note: 'Graduate posts · CEN 06/2026' },
  { level: 'undergraduate', icon: BookOpen, line: 'I have passed 12th, no degree yet', note: 'Under-Graduate posts · CEN 07/2026' },
];

function Option({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md',
        selected
          ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
          : 'border-gray-200 bg-white hover:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-500/60',
      )}
    >
      {children}
      {selected && <Check className="ml-auto h-5 w-5 flex-shrink-0 text-brand-600" aria-label="Chosen" />}
    </button>
  );
}

export function NtpcLevelDialog({
  open,
  onOpenChange,
  value,
  fallbackLanguage,
  onSave,
  examName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is chosen already, marked in the lists. */
  value: NtpcPrefs;
  /** The language to suggest when none is chosen yet — the one on the aspirant's profile. */
  fallbackLanguage?: string | null;
  onSave: (prefs: NtpcPrefs) => void;
  examName?: string;
}) {
  const [level, setLevel] = useState<NtpcLevel | null>(value.level);
  const suggested = isNtpcLanguage(fallbackLanguage) ? fallbackLanguage : null;
  const [language, setLanguage] = useState<NtpcLanguage | null>(value.language ?? suggested);
  // Each time it opens it shows what is chosen now, not what was clicked and abandoned last time.
  useEffect(() => {
    if (open) {
      setLevel(value.level);
      setLanguage(value.language ?? suggested);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-2xl p-6 sm:p-7" onOpenAutoFocus={e => e.preventDefault()}>
        <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">Set up your preparation</DialogTitle>
        <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
          {examName ?? 'RRB NTPC'} has separate Graduate and Under-Graduate recruitments, and papers in more than one language. You will be shown the papers for your choices.
        </DialogDescription>

        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Your level</p>
            <div className="grid gap-2">
              {LEVELS.map(({ level: l, icon: Icon, line, note }) => (
                <Option key={l} selected={level === l} onClick={() => setLevel(l)}>
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-gray-900 dark:text-gray-100">{NTPC_LEVEL_LABEL[l]}</span>
                    <span className="block text-xs text-gray-600 dark:text-gray-300">{line}</span>
                    <span className="block text-[11px] text-gray-500 dark:text-gray-400">{note}</span>
                  </span>
                </Option>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Language of the papers</p>
            <div className="grid grid-cols-2 gap-2">
              {NTPC_LANGUAGES.map(lang => (
                <Option key={lang} selected={language === lang} onClick={() => setLanguage(lang)}>
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                    <Languages className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-gray-900 dark:text-gray-100">{NTPC_LANGUAGE_NATIVE[lang]}</span>
                    {NTPC_LANGUAGE_NATIVE[lang] !== NTPC_LANGUAGE_LABEL[lang] && (
                      <span className="block text-[11px] text-gray-500 dark:text-gray-400">{NTPC_LANGUAGE_LABEL[lang]}</span>
                    )}
                  </span>
                </Option>
              ))}
            </div>
          </div>
        </div>

        <Button
          type="button"
          disabled={!level || !language}
          onClick={() => level && language && onSave({ level, language })}
          className="mt-5 h-11 w-full rounded-lg bg-brand-500 text-sm font-bold text-white hover:bg-brand-600"
        >
          Continue
        </Button>
        <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">You can change these any time from the exam page.</p>
      </DialogContent>
    </Dialog>
  );
}

/** What is chosen, as a small button that opens the dialog to change it. */
export function NtpcLevelChip({ prefs, onChange, className }: { prefs: NtpcPrefs; onChange: () => void; className?: string }) {
  const text = [prefs.level && NTPC_LEVEL_LABEL[prefs.level], prefs.language && NTPC_LANGUAGE_LABEL[prefs.language]].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      // The chip can sit inside a card that is a link: changing the choice must not also open the exam.
      onClick={e => {
        e.preventDefault();
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300',
        className,
      )}
    >
      <GraduationCap className="h-3.5 w-3.5" />
      {text || 'Choose your level and language'}
      {text && <span className="font-medium underline underline-offset-2">Change</span>}
    </button>
  );
}
