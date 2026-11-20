import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ChevronDown, Copy, Download, Loader2, RotateCcw, Save, Search, Upload } from 'lucide-react';
import { SAMPLE_CATALOGUE, getAppContent, getAppContentCatalogue, missingPlaceholders, parseCatalogueFile, saveAppContent, saveAppContentCatalogue } from '@/lib/appContentApi';
import { cn } from '@/lib/utils';

const input =
  'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300';

/** What the server said, when it said something ("message" on a 422). */
function serverMessage(err: any): string {
  const m = err?.message ?? err?.detail ?? err?.body?.message;
  return typeof m === 'string' && m.trim() ? m : 'unknown error';
}

/**
 * The mobile app's text, from the app's own catalogue. Each text shows what an admin has changed in its box and the built-in
 * wording as the placeholder; a box left empty follows the built-in text. Saving sends the whole map of changed texts.
 */
export function AppContentSettings() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const catalogue = useQuery({ queryKey: ['admin-app-content', 'catalogue'], queryFn: getAppContentCatalogue, retry: false });
  const saved = useQuery({ queryKey: ['admin-app-content', 'saved'], queryFn: getAppContent, retry: false });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (saved.data) setDraft(saved.data);
  }, [saved.data]);

  const entries = catalogue.data ?? [];
  const builtIn = useMemo(() => Object.fromEntries(entries.map(e => [e.key, e.text])), [entries]);

  /** The map that would be saved: every non-empty text that differs from the built-in one. Keys the catalogue no longer lists are kept. */
  const toSave = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(draft)) {
      if (v.trim() === '') continue;
      if (builtIn[k] !== undefined && v === builtIn[k]) continue;
      out[k] = v;
    }
    return out;
  }, [draft, builtIn]);

  const dirty = useMemo(() => {
    const a = saved.data ?? {};
    const keys = new Set([...Object.keys(a), ...Object.keys(toSave)]);
    for (const k of keys) if ((a[k] ?? '') !== (toSave[k] ?? '')) return true;
    return false;
  }, [saved.data, toSave]);

  const lost = useMemo(
    () => Object.entries(toSave).filter(([k, v]) => builtIn[k] !== undefined && missingPlaceholders(builtIn[k], v).length > 0).length,
    [toSave, builtIn],
  );

  const save = useMutation({
    mutationFn: () => saveAppContent(toSave),
    onSuccess: () => {
      void saved.refetch();
      toast.success('App content saved');
    },
    // A 422 is a bad key, a value over 4,000 characters or more than 5,000 keys — the server says which.
    onError: (err: any) => toast.error(`Could not save: ${serverMessage(err)}`, { duration: 12_000 }),
  });

  const upload = useMutation({
    mutationFn: (entries: { key: string; text: string; group: string }[]) => saveAppContentCatalogue(entries),
    onSuccess: async (_r, entries) => {
      await qc.invalidateQueries({ queryKey: ['admin-app-content', 'catalogue'] });
      toast.success(`Text list uploaded — ${entries.length} texts`);
    },
    onError: (err: any) => toast.error(`Could not upload: ${serverMessage(err)}`, { duration: 12_000 }),
  });

  /** Read the chosen file, check it, and — after the admin confirms — replace the app's text list with it. */
  const onFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    const { entries: parsed, problems: found } = parseCatalogueFile(await file.text());
    setProblems(found);
    if (found.length > 0 || parsed.length === 0) return;
    const groupCount = new Set(parsed.map(e => e.group)).size;
    const ok = window.confirm(
      `Upload ${parsed.length} texts in ${groupCount} group${groupCount === 1 ? '' : 's'}?\n\nThis replaces the app's whole text list. Changes already saved for a text that is not in this file are kept, but the app will ignore them.`,
    );
    if (ok) upload.mutate(parsed);
  };

  const downloadSample = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(SAMPLE_CATALOGUE, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'app-content-catalogue.sample.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const by = new Map<string, typeof entries>();
    for (const e of entries) {
      if (q && !(e.key.toLowerCase().includes(q) || e.text.toLowerCase().includes(q) || e.group.toLowerCase().includes(q) || (draft[e.key] ?? '').toLowerCase().includes(q))) continue;
      by.set(e.group, [...(by.get(e.group) ?? []), e]);
    }
    return Array.from(by.entries());
  }, [entries, q, draft]);

  const changedIn = (list: typeof entries) => list.filter(e => toSave[e.key] !== undefined).length;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">App content</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          The wording in the mobile app, screen by screen. A box left empty keeps the built-in text (shown greyed).
          {entries.length > 0 && ` ${entries.length} texts · ${Object.keys(toSave).length} changed.`}
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-gray-300 px-4 py-3 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">App text list</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              A JSON file from the app team: <code>{'{ "entries": [ { "key", "text", "group" } ] }'}</code>. Upload it after each app release that adds or changes a text —
              every upload replaces the whole list.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={downloadSample} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
              <Download className="h-3.5 w-3.5" /> Sample file
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={e => void onFile(e.target.files?.[0])} aria-label="Choose the app text list file" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={upload.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-brand-400 px-3 py-2 text-xs font-semibold text-white shadow-md disabled:opacity-50"
            >
              {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload text list
            </button>
          </div>
        </div>
        {problems.length > 0 && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            <p className="font-semibold">This file was not uploaded:</p>
            <ul className="mt-1 list-disc pl-4">
              {problems.slice(0, 8).map(p => <li key={p}>{p}</li>)}
              {problems.length > 8 && <li>…and {problems.length - 8} more.</li>}
            </ul>
          </div>
        )}
      </div>

      {catalogue.isLoading || saved.isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : catalogue.isError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Could not load the app’s text list: {serverMessage(catalogue.error)}.
        </p>
      ) : entries.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
          The app’s text list has not been uploaded yet.
        </p>
      ) : (
        <>
          {saved.isError && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              Could not load the saved changes ({serverMessage(saved.error)}). Saving now would replace them — reload first.
            </p>
          )}
          {lost > 0 && (
            <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              {lost} edited text{lost === 1 ? ' is' : 's are'} missing a {'{placeholder}'} the built-in text has — the app fills those in, so the text may read wrongly without it.
            </p>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search app texts…" className={cn(input, 'pl-9')} aria-label="Search app texts" />
          </div>

          <div className="space-y-2">
            {groups.map(([group, list]) => {
              const isOpen = q ? true : !!open[group];
              const n = changedIn(list);
              return (
                <div key={group} className="rounded-xl border border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => setOpen(o => ({ ...o, [group]: !o[group] }))}
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {group} <span className="ml-1 text-xs font-normal text-gray-500">· {list.length} texts{n > 0 ? ` · ${n} changed` : ''}</span>
                    </span>
                    <ChevronDown className={cn('h-4 w-4 text-gray-500 transition-transform', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && (
                    <div className="space-y-4 border-t border-gray-100 px-4 py-4 dark:border-gray-800">
                      {list.map(e => {
                        const value = draft[e.key] ?? '';
                        const isChanged = toSave[e.key] !== undefined;
                        const missing = isChanged ? missingPlaceholders(e.text, value) : [];
                        const long = e.text.length > 70 || e.text.includes('\n') || value.length > 70;
                        const set = (v: string) => setDraft(d => ({ ...d, [e.key]: v }));
                        return (
                          <div key={e.key} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <label htmlFor={`app-${e.key}`} className="break-all text-[11px] font-bold tracking-wide text-gray-500 dark:text-gray-400">
                                {e.key}
                                {isChanged && <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-normal text-orange-700">changed</span>}
                              </label>
                              <span className="flex shrink-0 items-center gap-3">
                                {value.trim() === '' && (
                                  <button type="button" className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" onClick={() => set(e.text)}>
                                    <Copy className="h-3 w-3" /> Edit built-in text
                                  </button>
                                )}
                                {value !== '' && (
                                  <button type="button" className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" onClick={() => setDraft(d => { const { [e.key]: _drop, ...rest } = d; return rest; })}>
                                    <RotateCcw className="h-3 w-3" /> Use built-in
                                  </button>
                                )}
                              </span>
                            </div>
                            {long ? (
                              <textarea id={`app-${e.key}`} rows={3} className={input} value={value} placeholder={e.text} onChange={ev => set(ev.target.value)} />
                            ) : (
                              <input id={`app-${e.key}`} className={input} value={value} placeholder={e.text} onChange={ev => set(ev.target.value)} />
                            )}
                            {missing.length > 0 && (
                              <p className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                                <AlertTriangle className="h-3 w-3" /> Missing {missing.map(m => `{${m}}`).join(', ')} — the built-in text has {missing.length === 1 ? 'it' : 'them'}, and the app fills {missing.length === 1 ? 'it' : 'them'} in.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {groups.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No text matches “{query}”.</p>}
          </div>
        </>
      )}

      <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-brand-600 to-brand-400 text-white px-4 py-2 rounded-lg shadow-md disabled:opacity-50"
          disabled={!dirty || save.isPending || saved.isError || entries.length === 0}
          onClick={() => save.mutate()}
        >
          {save.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save app content
        </button>
      </div>
    </div>
  );
}
