import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, Loader2, RotateCcw, Save, Search } from 'lucide-react';
import { CONTENT_GROUPS } from '@/content/registry';
import { loadSiteContent, setOverrides, type ContentOverrides } from '@/content/store';
import { getAdminSiteContent, saveAdminSiteContent } from '@/lib/siteContentApi';
import { cn } from '@/lib/utils';

const input =
  'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300';

/**
 * Every piece of editable text on the aspirant-facing screens, grouped by screen. An empty box (or one equal to the
 * built-in text) follows the built-in text; only what differs is sent to the server.
 */
export function SiteContentSettings() {
  const saved = useQuery({ queryKey: ['admin-site-content'], queryFn: getAdminSiteContent, retry: false });
  const [draft, setDraft] = useState<ContentOverrides>({});
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (saved.data) setDraft(saved.data);
  }, [saved.data]);

  const valueOf = (key: string, fallback: string) => draft[key] ?? fallback;
  /** Differs from the built-in text. */
  const changed = (key: string, fallback: string) => (draft[key] ?? '').trim() !== '' && draft[key] !== fallback;

  const dirty = useMemo(() => {
    const a = saved.data ?? {};
    const keys = new Set([...Object.keys(a), ...Object.keys(draft)]);
    for (const k of keys) if ((a[k] ?? '') !== (draft[k] ?? '')) return true;
    return false;
  }, [saved.data, draft]);

  const save = useMutation({
    mutationFn: async () => {
      // Only what differs from the built-in text goes to the server.
      const out: ContentOverrides = {};
      for (const g of CONTENT_GROUPS)
        for (const [key, f] of Object.entries(g.fields)) {
          const v = draft[key];
          if (v != null && v.trim() !== '' && v !== f.default) out[key] = v;
        }
      await saveAdminSiteContent(out);
      return out;
    },
    onSuccess: out => {
      setOverrides(out);
      void loadSiteContent(true);
      void saved.refetch();
      toast.success('Site text saved');
    },
    onError: (err: any) =>
      toast.error(
        /404|not found/i.test(String(err?.message))
          ? 'The server has no site-content setting yet — see BACKEND_SITE_CONTENT.md.'
          : `Could not save: ${err?.message ?? 'unknown error'}`,
        { duration: 12_000 },
      ),
  });

  const q = query.trim().toLowerCase();
  const groups = CONTENT_GROUPS.map(g => ({
    ...g,
    entries: Object.entries(g.fields).filter(
      ([key, f]) => !q || key.toLowerCase().includes(q) || f.label.toLowerCase().includes(q) || f.default.toLowerCase().includes(q) || g.group.toLowerCase().includes(q),
    ),
  })).filter(g => g.entries.length > 0);
  const total = CONTENT_GROUPS.reduce((n, g) => n + Object.keys(g.fields).length, 0);
  const changedCount = CONTENT_GROUPS.reduce((n, g) => n + Object.entries(g.fields).filter(([k, f]) => changed(k, f.default)).length, 0);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Site text</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          The wording students and visitors read, screen by screen. Leave a box as it is to keep the built-in text. {total} texts · {changedCount} changed.
        </p>
      </div>

      {saved.isError && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          The server has no saved site text yet, so the built-in text is shown. Saving needs the endpoints in BACKEND_SITE_CONTENT.md.
        </p>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search texts…" className={cn(input, 'pl-9')} aria-label="Search texts" />
      </div>

      {saved.isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-2">
          {groups.map(g => {
            const isOpen = q ? true : !!open[g.group];
            const n = g.entries.filter(([k, f]) => changed(k, f.default)).length;
            return (
              <div key={g.group} className="rounded-xl border border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setOpen(o => ({ ...o, [g.group]: !o[g.group] }))}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {g.group} <span className="ml-1 text-xs font-normal text-gray-500">· {g.entries.length} texts{n > 0 ? ` · ${n} changed` : ''}</span>
                  </span>
                  <ChevronDown className={cn('h-4 w-4 text-gray-500 transition-transform', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                  <div className="space-y-4 border-t border-gray-100 px-4 py-4 dark:border-gray-800">
                    {g.entries.map(([key, f]) => {
                      const isChanged = changed(key, f.default);
                      return (
                        <div key={key} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <label htmlFor={key} className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                              {f.label}
                              {isChanged && <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-orange-700">changed</span>}
                            </label>
                            {isChanged && (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                                onClick={() => setDraft(d => { const { [key]: _drop, ...rest } = d; return rest; })}
                              >
                                <RotateCcw className="h-3 w-3" /> Use built-in
                              </button>
                            )}
                          </div>
                          {f.multiline ? (
                            <textarea id={key} rows={3} className={input} value={valueOf(key, f.default)} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} />
                          ) : (
                            <input id={key} className={input} value={valueOf(key, f.default)} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} />
                          )}
                          {(f.hint || f.vars?.length) && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                              {f.hint}
                              {f.vars?.length ? ` Keeps ${f.vars.map(v => `{${v}}`).join(', ')} — filled in by the page.` : ''}
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
      )}

      <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-brand-600 to-brand-400 text-white px-4 py-2 rounded-lg shadow-md disabled:opacity-50"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save site text
        </button>
      </div>
    </div>
  );
}
