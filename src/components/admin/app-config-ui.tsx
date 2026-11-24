import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { buildUrl } from '@/lib/api';

export const FIELD =
  'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300';
export const FIELD_ERR = 'border-red-300 focus:ring-red-200';
export const ICON_BTN =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800';

export const move = <T,>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/** A text box with its character count and, when there is one, its error. */
export function Text({
  label,
  value,
  onChange,
  max,
  error,
  placeholder,
  multiline,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  error?: string;
  placeholder?: string;
  multiline?: boolean;
  hint?: string;
}) {
  const n = [...value.trim()].length;
  const cls = `${FIELD} ${error ? FIELD_ERR : ''}`;
  return (
    <label className="block min-w-0">
      <span className="mb-1 flex items-baseline justify-between gap-2 text-[11px] font-semibold text-gray-600 dark:text-gray-300">
        <span>{label}</span>
        {max !== undefined && <span className={n > max ? 'text-red-600' : 'font-normal text-gray-400'}>{n}/{max}</span>}
      </span>
      {multiline ? (
        <textarea rows={2} className={cls} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
      ) : (
        <input className={cls} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
      )}
      {hint && !error && <span className="mt-0.5 block text-[11px] text-gray-400">{hint}</span>}
      {error && <span className="mt-0.5 block text-[11px] text-red-600">{error}</span>}
    </label>
  );
}

/** A picture field: preview, upload / replace, remove. The caller says how to check and upload the file. */
export function PictureField({
  url,
  onChange,
  label,
  types,
  advice,
  check,
  upload,
  thumbClass = 'h-24 w-24',
}: {
  url: string;
  onChange: (url: string) => void;
  label: string;
  types: readonly string[];
  advice: string;
  check: (file: File) => string | null;
  upload: (file: File) => Promise<string>;
  thumbClass?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!file) return;
    const bad = check(file);
    if (bad) return setProblem(bad);
    setProblem(null);
    setBusy(true);
    try {
      onChange(await upload(file));
    } catch (err: any) {
      // A 413 or 422 carries the server's own reason.
      setProblem(String(err?.message || 'The picture could not be uploaded.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-w-0">
      <span className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300">Picture</span>
      <div className="flex items-start gap-3">
        <div className={`flex ${thumbClass} shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800`}>
          {url ? <img src={buildUrl(url)} alt={`${label} picture`} className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6 text-gray-400" />}
        </div>
        <div className="min-w-0 space-y-1.5">
          <input ref={input} type="file" accept={types.join(',')} className="hidden" onChange={e => pick(e.target.files?.[0])} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} {url ? 'Replace picture' : 'Upload picture'}
            </button>
            {url && !busy && (
              <button type="button" onClick={() => onChange('')} className="text-xs font-semibold text-gray-500 hover:text-red-600">Remove</button>
            )}
          </div>
          <p className="text-[11px] text-gray-400">{advice}</p>
          {problem && <p className="text-[11px] text-red-600">{problem}</p>}
        </div>
      </div>
    </div>
  );
}

/** Up, down, remove — and the Active switch — for one row of a list. */
export function RowTools({
  index,
  count,
  active,
  onActive,
  onMove,
  onRemove,
  what,
}: {
  index: number;
  count: number;
  active: boolean;
  onActive: (v: boolean) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  what: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="mr-1 flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300">
        <Switch checked={active} onCheckedChange={onActive} aria-label={`${what} active`} />
        Active
      </label>
      <button type="button" className={ICON_BTN} disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={`Move ${what} up`}>
        <ChevronUp className="h-4 w-4" />
      </button>
      <button type="button" className={ICON_BTN} disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label={`Move ${what} down`}>
        <ChevronDown className="h-4 w-4" />
      </button>
      <button type="button" className={`${ICON_BTN} hover:text-red-600`} onClick={onRemove} aria-label={`Remove ${what}`}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
