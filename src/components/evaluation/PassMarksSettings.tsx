import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, RotateCcw, Save, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TNPSC_GROUPS } from '@/config/tnpsc';
import {
  PASS_MARKS,
  PASS_MARK_KEYS,
  PASS_MARK_LABEL,
  UNIT_PASS_KEYS,
  type ExamPassMarks,
  type PassMarkKey,
  type PassMarkSettings,
  type PassMarkTable,
} from '@/config/pass-marks';
import { getAdminPassMarks, saveAdminPassMarks } from '@/lib/tnpscAdminApi';

const DEFAULT_SCOPE = 'default';

type Cell = { pass: string; target: string };
type Draft = Record<PassMarkKey, Cell>;

const EXAMS = TNPSC_GROUPS.filter(g => g.stages.some(st => st.status === 'active'));

const blank = (): Draft => Object.fromEntries(PASS_MARK_KEYS.map(k => [k, { pass: '', target: '' }])) as Draft;

/** What a scope holds today, as the form's text boxes. An exam shows only what it overrides; the default shows everything. */
function draftOf(settings: PassMarkSettings | undefined, scope: string): Draft {
  const d = blank();
  const table: ExamPassMarks | undefined =
    scope === DEFAULT_SCOPE ? { ...PASS_MARKS, ...(settings?.global ?? {}) } : settings?.exams[scope];
  for (const k of PASS_MARK_KEYS) {
    const m = table?.[k];
    if (m) d[k] = { pass: String(m.pass), target: String(m.target) };
  }
  return d;
}

const num = (v: string): number | null => {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const valid = (n: number | null) => n == null || (Number.isFinite(n) && n >= 0 && n <= 100);

/** What is wrong with a row, if anything. */
function rowError(c: Cell): string | null {
  const pass = num(c.pass);
  const target = num(c.target);
  if (!valid(pass) || !valid(target)) return 'Enter a percentage from 0 to 100.';
  if (pass == null && target != null) return 'Set the pass mark too.';
  if (pass != null && target != null && target < pass) return 'The aim cannot be below the pass mark.';
  return null;
}

/**
 * Pass marks, set by the admin — for the whole product, for one exam ("RRB NTPC CBT-1 Graduate: unit papers 60 %, key
 * topics 75 %, mock 70 %"), and (in the assessment form) for a single assessment. The narrowest wins: an assessment's
 * own, then its exam's, then the default. An exam row left empty follows the default.
 */
export function PassMarksSettings() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['admin-pass-marks'], queryFn: getAdminPassMarks, retry: false });

  const [scope, setScope] = useState<string>(DEFAULT_SCOPE);
  const [draft, setDraft] = useState<Draft>(blank);
  const [unitAll, setUnitAll] = useState<Cell>({ pass: '', target: '' });
  const [dirty, setDirty] = useState(false);

  // Start the form from what is saved whenever the scope changes or the saved settings arrive.
  useEffect(() => {
    setDraft(draftOf(settings.data, scope));
    setUnitAll({ pass: '', target: '' });
    setDirty(false);
  }, [settings.data, scope]);

  const isDefault = scope === DEFAULT_SCOPE;
  /** What an empty row falls back to in this scope. */
  const fallback = (k: PassMarkKey) => (isDefault ? PASS_MARKS[k] : (settings.data?.global ?? PASS_MARKS)[k]);

  const errors = useMemo(() => Object.fromEntries(PASS_MARK_KEYS.map(k => [k, rowError(draft[k])])) as Record<PassMarkKey, string | null>, [draft]);
  const unitAllError = rowError(unitAll);
  const hasError = PASS_MARK_KEYS.some(k => errors[k]) || !!unitAllError;

  const setCell = (k: PassMarkKey, part: keyof Cell, v: string) => {
    setDraft(d => ({ ...d, [k]: { ...d[k], [part]: v } }));
    setDirty(true);
  };

  const applyUnitAll = () => {
    if (unitAllError || unitAll.pass.trim() === '') return;
    setDraft(d => {
      const next = { ...d };
      for (const k of UNIT_PASS_KEYS) next[k] = { pass: unitAll.pass, target: unitAll.target };
      return next;
    });
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: async (next: { global: PassMarkTable; exams: Record<string, ExamPassMarks> }) => saveAdminPassMarks(next),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pass-marks'] });
      // The aspirant portal reads the same settings; let it pick the change up.
      qc.invalidateQueries({ queryKey: ['tnpsc-pass-marks'] });
      toast.success(isDefault ? 'Default pass marks saved' : 'Pass marks saved for this exam');
    },
    onError: (err: any) =>
      toast.error(
        /404|not found/i.test(String(err?.message))
          ? 'The server has no pass-marks setting yet — see BACKEND_PASS_MARKS.md.'
          : `Could not save: ${err?.message ?? 'unknown error'}`,
        { duration: 12_000 },
      ),
  });

  const onSave = () => {
    if (hasError) return;
    const global: PassMarkTable = { ...PASS_MARKS, ...(settings.data?.global ?? {}) };
    const exams = { ...(settings.data?.exams ?? {}) };

    const table: ExamPassMarks = {};
    for (const k of PASS_MARK_KEYS) {
      const pass = num(draft[k].pass);
      if (pass == null) continue;
      const target = num(draft[k].target) ?? Math.min(100, Math.max(fallback(k).target, pass));
      table[k] = { pass, target };
    }

    if (isDefault) {
      save.mutate({ global: { ...global, ...table }, exams });
    } else {
      if (Object.keys(table).length > 0) exams[scope] = table;
      else delete exams[scope];
      save.mutate({ global, exams });
    }
  };

  const resetExam = () => {
    if (isDefault || !window.confirm('Remove this exam’s own pass marks? It will follow the default again.')) return;
    const exams = { ...(settings.data?.exams ?? {}) };
    delete exams[scope];
    save.mutate({ global: { ...PASS_MARKS, ...(settings.data?.global ?? {}) }, exams });
  };

  const examName = isDefault ? 'All exams (default)' : EXAMS.find(g => g.id === scope)?.name ?? scope;
  const overridden = (id: string) => Object.keys(settings.data?.exams[id] ?? {}).length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-2">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Settings</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Pass marks</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          What counts as a pass, and the score to aim for, by kind of paper. Set them for every exam, or for one exam on its own
          (for example RRB NTPC CBT-1 Graduate: unit papers 60 %, key topics 75 %, mock 70 %). A single assessment can set its own
          in the Rules step when it is created, and that wins over both.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Applies to</Label>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_SCOPE}>All exams (default)</SelectItem>
            {EXAMS.map(g => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}{overridden(g.id) ? ' · custom' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isDefault && (
          <p className="text-[11px] text-muted-foreground">
            Leave a row empty to follow the default. Only what you fill in is set for {examName}.
          </p>
        )}
      </div>

      {settings.isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800">
          {settings.isError && (
            <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              The server has no saved pass marks yet, so the built-in ones are shown. Saving needs the endpoint in BACKEND_PASS_MARKS.md.
            </p>
          )}

          <div className="grid grid-cols-[1fr_6.5rem_6.5rem] items-center gap-x-3 border-b border-slate-200 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800">
            <span>Kind of paper</span><span>Pass mark %</span><span>Aim %</span>
          </div>

          {/* One value for every unit paper, whichever difficulty — the usual way of setting "unit-wise". */}
          <div className="grid grid-cols-[1fr_6.5rem_6.5rem] items-center gap-x-3 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="min-w-0">
              <p className="text-sm font-medium">All unit papers</p>
              <p className="text-[11px] text-muted-foreground">Fills Simple, Medium, Complex and Mixed together.</p>
            </div>
            <Input inputMode="decimal" className="h-9" placeholder="—" value={unitAll.pass} onChange={e => setUnitAll(c => ({ ...c, pass: e.target.value }))} />
            <div className="flex items-center gap-1.5">
              <Input inputMode="decimal" className="h-9" placeholder="—" value={unitAll.target} onChange={e => setUnitAll(c => ({ ...c, target: e.target.value }))} />
              <Button type="button" size="sm" variant="outline" className="h-9 px-2.5" disabled={!!unitAllError || unitAll.pass.trim() === ''} onClick={applyUnitAll}>Apply</Button>
            </div>
            {unitAllError && <p className="col-span-3 mt-1 text-[11px] text-red-600">{unitAllError}</p>}
          </div>

          {PASS_MARK_KEYS.map(k => {
            const fb = fallback(k);
            const err = errors[k];
            return (
              <div key={k} className="grid grid-cols-[1fr_6.5rem_6.5rem] items-center gap-x-3 border-b border-slate-100 px-4 py-2.5 last:border-b-0 dark:border-slate-800">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{PASS_MARK_LABEL[k]}</p>
                  {!isDefault && draft[k].pass.trim() === '' && (
                    <p className="text-[11px] text-muted-foreground">Following the default · {fb.pass}% / {fb.target}%</p>
                  )}
                </div>
                <Input inputMode="decimal" className="h-9" placeholder={isDefault ? undefined : String(fb.pass)} value={draft[k].pass} onChange={e => setCell(k, 'pass', e.target.value)} aria-label={`${PASS_MARK_LABEL[k]} pass mark`} />
                <Input inputMode="decimal" className="h-9" placeholder={String(fb.target)} value={draft[k].target} onChange={e => setCell(k, 'target', e.target.value)} aria-label={`${PASS_MARK_LABEL[k]} aim`} />
                {err && <p className="col-span-3 mt-1 text-[11px] text-red-600">{err}</p>}
              </div>
            );
          })}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Target className="mt-px h-3.5 w-3.5 shrink-0" />
        These are learning benchmarks shown on reports and used to mark a set “cleared” — not an official cut-off. Changes reach
        aspirants within a few minutes.
      </p>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {!isDefault && overridden(scope) && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={resetExam} disabled={save.isPending}>
            <RotateCcw className="h-3.5 w-3.5" /> Use the default for this exam
          </Button>
        )}
        <Button type="button" size="sm" className="gap-1.5" onClick={onSave} disabled={!dirty || hasError || save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save pass marks
        </Button>
      </div>
    </div>
  );
}
