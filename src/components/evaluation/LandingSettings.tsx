import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import { DEFAULT_LIVE_EXAMS, MAX_LIVE_EXAMS, MAX_LIVE_EXAM_LENGTH, parseLiveExams } from '@/config/landing-settings';
import { getAdminLiveExams, saveAdminLiveExams } from '@/lib/landingSettingsApi';

/**
 * The exams the landing page shows as "Live" — one exam a line. What is typed here is what visitors read in the hero chip,
 * the "Currently Available" banner and the closing call to action.
 */
export function LandingSettings() {
  const qc = useQueryClient();
  const saved = useQuery({ queryKey: ['admin-landing-live-exams'], queryFn: getAdminLiveExams, retry: false });
  const [text, setText] = useState(DEFAULT_LIVE_EXAMS.join('\n'));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (saved.data) setText(saved.data.join('\n'));
    setDirty(false);
  }, [saved.data]);

  const names = parseLiveExams(text);
  const lineCount = text.split(/\r?\n/).filter(l => l.trim()).length;
  const tooMany = lineCount > MAX_LIVE_EXAMS;
  const tooLong = text.split(/\r?\n/).some(l => l.trim().length > MAX_LIVE_EXAM_LENGTH);

  const save = useMutation({
    mutationFn: (list: string[]) => saveAdminLiveExams(list),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-landing-live-exams'] });
      qc.invalidateQueries({ queryKey: ['landing-live-exams'] });
      toast.success('Landing page updated');
    },
    onError: (err: any) =>
      toast.error(
        /404|not found/i.test(String(err?.message))
          ? 'The server has no landing-page setting yet — see BACKEND_LANDING_SETTINGS.md.'
          : `Could not save: ${err?.message ?? 'unknown error'}`,
        { duration: 12_000 },
      ),
  });

  const field = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Live exams on the landing page</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Shown beside “Live” under the main heading, and in the “Currently Available” banner. One exam a line, up to {MAX_LIVE_EXAMS}.
        </p>
      </div>

      {saved.isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <>
          {saved.isError && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              The server has no saved landing-page text yet, so the built-in one is shown. Saving needs the endpoint in BACKEND_LANDING_SETTINGS.md.
            </p>
          )}
          <textarea
            rows={MAX_LIVE_EXAMS}
            value={text}
            onChange={e => {
              setText(e.target.value);
              setDirty(true);
            }}
            className={field}
            placeholder={DEFAULT_LIVE_EXAMS.join('\n')}
            aria-label="Live exams, one a line"
          />
          {tooMany && <p className="text-[11px] text-red-600">Only the first {MAX_LIVE_EXAMS} lines are shown.</p>}
          {tooLong && <p className="text-[11px] text-red-600">Keep each line under {MAX_LIVE_EXAM_LENGTH} characters — longer ones are cut.</p>}

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Preview</p>
            <div className="inline-flex items-center gap-3 rounded-2xl border-2 border-orange-400 bg-white px-3 py-2 text-sm font-bold text-slate-800">
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-widest text-emerald-700">Live</span>
              <span className="flex flex-col gap-0.5 border-l border-orange-200 pl-3">
                {names.length > 0 ? names.map(n => <span key={n}>{n}</span>) : <span className="font-normal text-gray-400">Nothing — the built-in list is shown</span>}
              </span>
            </div>
          </div>
        </>
      )}

      <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg"
          onClick={() => {
            setText(DEFAULT_LIVE_EXAMS.join('\n'));
            setDirty(true);
          }}
          disabled={save.isPending}
        >
          <RotateCcw className="w-3.5 h-3.5" /> Use the built-in text
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-brand-600 to-brand-400 text-white px-4 py-2 rounded-lg shadow-md disabled:opacity-50"
          disabled={!dirty || names.length === 0 || save.isPending}
          onClick={() => save.mutate(names)}
        >
          {save.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
        </button>
      </div>
    </div>
  );
}
