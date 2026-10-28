/**
 * Topic names: brings every Unit / Category / Sub-category name in the bank onto the official list built
 * from the uploaded question sheets.
 *
 * The tree shows every name in use under each unit. A name the sheets never used is "to fix": merge it into the
 * official name it should be, or mark it official when it is right. An official name can be renamed. Every change
 * is previewed first (how many questions, tests and attempts it touches, with samples), applied in one go by the
 * backend, logged with the old values, and can be undone from the Change log tab.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  History,
  Loader2,
  RefreshCw,
  Search,
  Undo2,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { PageHeader } from '@/components/layout/AppShell';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { TNPSC_GROUPS } from '@/config/tnpsc';
import {
  ACTION_LABEL,
  taxonomyApi,
  taxonomyErrorMessage,
  type TaxonomyAction,
  type TaxonomyCategoryNode,
  type TaxonomyChange,
  type TaxonomyLevel,
  type TaxonomyLogEntry,
  type TaxonomyNode,
  type TaxonomyPreview,
  type TaxonomyUnitNode,
} from '@/lib/taxonomyApi';

/** The stages that have a syllabus to check names against. */
const STAGES = TNPSC_GROUPS.flatMap(g =>
  g.stages
    .filter(s => s.status === 'active' && s.paper_type === 'objective')
    .map(s => ({ exam: g.id, stage: s.id, label: `${g.short_name} · ${s.short_name}` })),
);

const fmt = (n: number | undefined) => (n ?? 0).toLocaleString('en-IN');

/** What a name needs: nothing, or fixing. */
const needsFix = (n: TaxonomyNode) => !n.official;

function matches(n: TaxonomyNode, q: string) {
  return !q || n.name.toLowerCase().includes(q);
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Tab = 'names' | 'log';

interface Target {
  node: TaxonomyNode;
  level: Exclude<TaxonomyLevel, 'unit'>;
  unit: TaxonomyUnitNode;
  /** The category a sub-category sits under. */
  category?: TaxonomyCategoryNode;
}

export default function AdminTaxonomyPage() {
  const [stageKey, setStageKey] = useState(STAGES.find(s => s.stage === 'group-4-written')?.stage ?? STAGES[0]?.stage ?? '');
  const stage = STAGES.find(s => s.stage === stageKey) ?? STAGES[0];
  const [tab, setTab] = useState<Tab>('names');
  const [search, setSearch] = useState('');
  const [onlyFix, setOnlyFix] = useState(true);
  const [includeRetired, setIncludeRetired] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);

  const tree = useQuery({
    queryKey: ['taxonomy', 'tree', stage?.exam, stage?.stage, includeRetired],
    queryFn: () => taxonomyApi.tree(stage!.exam, stage!.stage, includeRetired),
    enabled: !!stage,
  });

  const units = tree.data?.units ?? [];
  const totals = useMemo(() => {
    let official = 0;
    let fix = 0;
    for (const u of units)
      for (const c of u.categories) {
        if (c.official) official += 1;
        else fix += 1;
        for (const s of c.subcategories ?? []) if (!s.official) fix += 1;
      }
    return { official, fix };
  }, [units]);

  return (
    <GenVerseShell>
      <PageHeader
        title="Topic Names"
        description="Make every unit, category and sub-category match the uploaded question sheets."
        breadcrumbs={[{ label: 'Dashboard', href: '/org/dashboard' }, { label: 'Topic Names' }]}
      />

      <div className="space-y-4 pb-6">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <Select value={stage?.stage} onValueChange={setStageKey}>
            <SelectTrigger className="h-9 w-[210px]">
              <SelectValue placeholder="Exam" />
            </SelectTrigger>
            <SelectContent>
              {STAGES.map(s => (
                <SelectItem key={s.stage} value={s.stage}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
            {(['names', 'log'] as Tab[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold',
                  tab === t ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100' : 'text-gray-500',
                )}
              >
                {t === 'names' ? <BadgeCheck className="h-3.5 w-3.5" /> : <History className="h-3.5 w-3.5" />}
                {t === 'names' ? 'Names' : 'Change log'}
              </button>
            ))}
          </div>

          {tab === 'names' && (
            <>
              <div className="relative min-w-[180px] flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search names" className="h-9 pl-8" />
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                <Switch checked={onlyFix} onCheckedChange={setOnlyFix} />
                Only names to fix
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                <Switch checked={includeRetired} onCheckedChange={setIncludeRetired} />
                Include retired
              </label>
              <button
                type="button"
                onClick={() => tree.refetch()}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', tree.isFetching && 'animate-spin')} />
                Refresh
              </button>
            </>
          )}
        </div>

        {tab === 'names' ? (
          tree.isLoading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : tree.isError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              Could not load the names: {taxonomyErrorMessage(tree.error)}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {fmt(totals.official)} official categories
                </span>
                <span
                  className={cn(
                    'rounded-full px-3 py-1 font-semibold',
                    totals.fix > 0
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
                  )}
                >
                  {fmt(totals.fix)} names to fix
                </span>
                {stage?.exam === 'group-2' && (
                  <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                    Group 2 uses the Group 4 bank — make category changes under Group 4.
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {units.map(u => (
                  <UnitCard
                    key={u.id ?? u.name}
                    unit={u}
                    search={search.trim().toLowerCase()}
                    onlyFix={onlyFix}
                    onAct={setTarget}
                  />
                ))}
                {units.length === 0 && <p className="py-12 text-center text-sm text-gray-500">No units for this exam.</p>}
              </div>
            </>
          )
        ) : (
          stage && <ChangeLog stage={stage.stage} />
        )}
      </div>

      {target && stage && (
        <ChangeDialog
          key={`${target.level}:${target.unit.id}:${target.category?.name ?? ''}:${target.node.name}`}
          target={target}
          exam={stage.exam}
          stage={stage.stage}
          onClose={() => setTarget(null)}
        />
      )}
    </GenVerseShell>
  );
}

// ─── Tree ────────────────────────────────────────────────────────────────────

function UnitCard({
  unit,
  search,
  onlyFix,
  onAct,
}: {
  unit: TaxonomyUnitNode;
  search: string;
  onlyFix: boolean;
  onAct: (t: Target) => void;
}) {
  const fixCount = unit.categories.reduce(
    (n, c) => n + (needsFix(c) ? 1 : 0) + (c.subcategories ?? []).filter(needsFix).length,
    0,
  );
  const [open, setOpen] = useState(fixCount > 0);

  // A category is shown when it (or one of its sub-categories) passes the filters.
  const visible = unit.categories.filter(c => {
    const subs = c.subcategories ?? [];
    const self = matches(c, search) && (!onlyFix || needsFix(c));
    const child = subs.some(s => matches(s, search) && (!onlyFix || needsFix(s)));
    return self || child;
  });
  if ((onlyFix || search) && visible.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
      >
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{unit.unit_name ?? unit.name}</p>
          <p className="text-[11px] text-gray-500">
            {unit.id} · {unit.categories.length} categories · {fmt(unit.question_count)} questions
          </p>
        </div>
        {fixCount > 0 ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            {fixCount} to fix
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            All official
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          <div className="hidden grid-cols-[1fr_70px_60px_70px_auto] gap-3 bg-gray-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:bg-gray-800/50 sm:grid">
            <span>Category</span>
            <span className="text-right">Questions</span>
            <span className="text-right">Tests</span>
            <span className="text-right">Attempts</span>
            <span className="w-[210px] text-right">Action</span>
          </div>
          {visible.map(c => (
            <CategoryRow key={c.id ?? c.name} unit={unit} category={c} search={search} onlyFix={onlyFix} onAct={onAct} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  unit,
  category,
  search,
  onlyFix,
  onAct,
}: {
  unit: TaxonomyUnitNode;
  category: TaxonomyCategoryNode;
  search: string;
  onlyFix: boolean;
  onAct: (t: Target) => void;
}) {
  const subs = (category.subcategories ?? []).filter(s => matches(s, search) && (!onlyFix || needsFix(s)));
  const [open, setOpen] = useState(false);
  const allSubs = category.subcategories ?? [];

  return (
    <div className="border-b border-gray-50 last:border-0 dark:border-gray-800/60">
      <NodeRow
        node={category}
        indent={0}
        toggle={allSubs.length > 0 ? { open: open || (onlyFix && subs.length > 0), onClick: () => setOpen(o => !o), count: allSubs.length } : undefined}
        onAct={() => onAct({ node: category, level: 'category', unit })}
      />
      {(open || (onlyFix && subs.length > 0)) &&
        (open ? allSubs.filter(s => matches(s, search)) : subs).map(s => (
          <NodeRow
            key={s.id ?? s.name}
            node={s}
            indent={1}
            onAct={() => onAct({ node: s, level: 'subcategory', unit, category })}
          />
        ))}
    </div>
  );
}

function NodeRow({
  node,
  indent,
  toggle,
  onAct,
}: {
  node: TaxonomyNode;
  indent: number;
  toggle?: { open: boolean; onClick: () => void; count: number };
  onAct: () => void;
}) {
  const fix = needsFix(node);
  return (
    <div
      className={cn(
        'grid grid-cols-1 items-center gap-2 px-4 py-2.5 sm:grid-cols-[1fr_70px_60px_70px_auto] sm:gap-3',
        fix && 'bg-amber-50/60 dark:bg-amber-950/20',
      )}
    >
      <div className={cn('flex min-w-0 items-center gap-2', indent && 'pl-6')}>
        {toggle ? (
          <button type="button" onClick={toggle.onClick} className="text-gray-400 hover:text-gray-600" aria-label="Sub-categories">
            {toggle.open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-3.5" />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn('text-sm', indent ? 'text-gray-700 dark:text-gray-300' : 'font-semibold text-gray-900 dark:text-gray-100')}>
              {node.name}
            </span>
            {fix ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                Not official
              </span>
            ) : (
              <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" aria-label="Official" />
            )}
            {node.status === 'retired only' && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-800">Retired</span>
            )}
            {toggle && <span className="text-[10px] text-gray-400">{toggle.count} sub</span>}
          </div>
          <p className="text-[10px] text-gray-400">
            {node.source ?? ''}
            {fix && node.suggestion ? (
              <span className="ml-1 text-amber-700 dark:text-amber-400">
                · Closest official: <strong>{node.suggestion.name}</strong> ({Math.round(node.suggestion.score * 100)}%)
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <span className="text-xs text-gray-600 sm:text-right dark:text-gray-300">
        <span className="sm:hidden">Questions </span>
        {fmt(node.question_count)}
      </span>
      <span className="text-xs text-gray-600 sm:text-right dark:text-gray-300">
        <span className="sm:hidden">Tests </span>
        {fmt(node.test_count)}
      </span>
      <span className="text-xs text-gray-600 sm:text-right dark:text-gray-300">
        <span className="sm:hidden">Attempts </span>
        {fmt(node.attempt_count)}
      </span>
      <div className="flex justify-end sm:w-[210px]">
        <button
          type="button"
          onClick={onAct}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-semibold',
            fix
              ? 'bg-orange-500 text-white hover:bg-orange-600'
              : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800',
          )}
        >
          {fix ? 'Fix…' : 'Rename / merge…'}
        </button>
      </div>
    </div>
  );
}

// ─── Change dialog ───────────────────────────────────────────────────────────

/** Keys that every change touches and that say nothing to a person. */
const QUIET_KEYS = new Set(['updated_at']);
const show = (v: unknown) => (v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function ChangeDialog({
  target,
  exam,
  stage,
  onClose,
}: {
  target: Target;
  exam: string;
  stage: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { node, level, unit, category } = target;
  const fix = needsFix(node);

  // The official names this one can be merged into: the unit's categories, or the category's sub-categories.
  const officialSiblings = useMemo(() => {
    const pool: TaxonomyNode[] = level === 'category' ? unit.categories : category?.subcategories ?? [];
    return pool.filter(n => n.official && n.name !== node.name).map(n => n.name);
  }, [level, unit, category, node.name]);

  const actions: TaxonomyAction[] = fix ? ['merge', 'mark_official'] : ['rename', 'merge'];
  const [action, setAction] = useState<TaxonomyAction>(actions[0]);
  const [mergeTo, setMergeTo] = useState<string>(
    fix && node.suggestion && officialSiblings.includes(node.suggestion.name) ? node.suggestion.name : '',
  );
  const [renameTo, setRenameTo] = useState(node.name);
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<TaxonomyPreview | null>(null);

  const to = action === 'merge' ? mergeTo : action === 'rename' ? renameTo.trim() : null;
  const ready = action === 'mark_official' || (!!to && to !== node.name);

  const change: TaxonomyChange = {
    action,
    level,
    from: node.name,
    to: action === 'mark_official' ? null : to,
    scope: { exam, stage, unit: unit.id ?? undefined, category: level === 'subcategory' ? category?.name ?? null : undefined },
    note: note.trim() || undefined,
  };

  const previewM = useMutation({
    mutationFn: () => taxonomyApi.preview(change),
    onSuccess: setPreview,
    onError: e => toast.error(taxonomyErrorMessage(e)),
  });

  const applyM = useMutation({
    mutationFn: () => taxonomyApi.apply(change),
    onSuccess: res => {
      void qc.invalidateQueries({ queryKey: ['taxonomy'] });
      // The dropdowns and user screens read the official list; let them see the change.
      void qc.invalidateQueries({ queryKey: ['syllabus'] });
      toast.success(`${ACTION_LABEL[action]} done — ${fmt(res.counts.questions)} questions, ${fmt(res.counts.tests)} tests updated.`, {
        action: {
          label: 'Undo',
          onClick: () =>
            taxonomyApi
              .undo(res.log_id)
              .then(() => {
                toast.success('Change undone.');
                void qc.invalidateQueries({ queryKey: ['taxonomy'] });
                void qc.invalidateQueries({ queryKey: ['syllabus'] });
              })
              .catch(e => toast.error(taxonomyErrorMessage(e))),
        },
      });
      onClose();
    },
    onError: e => toast.error(taxonomyErrorMessage(e)),
  });

  const reset = () => setPreview(null);
  const busy = previewM.isPending || applyM.isPending;

  return (
    <Dialog open onOpenChange={o => !o && !busy && onClose()}>
      <DialogContent className="max-w-lg" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-orange-500" />
            {level === 'category' ? 'Category' : 'Sub-category'}: {node.name}
          </DialogTitle>
          <DialogDescription>
            {unit.unit_name ?? unit.name}
            {category ? ` › ${category.name}` : ''} · {fmt(node.question_count)} questions · {fmt(node.test_count)} tests
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            {actions.map(a => (
              <button
                key={a}
                type="button"
                onClick={() => {
                  setAction(a);
                  reset();
                }}
                className={cn(
                  'flex-1 rounded-xl border px-3 py-2 text-left text-xs',
                  action === a
                    ? 'border-orange-400 bg-orange-50 text-orange-800 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-200'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800',
                )}
              >
                <span className="block text-sm font-bold">{ACTION_LABEL[a]}</span>
                {a === 'merge' && 'Move everything using this name onto an official name.'}
                {a === 'mark_official' && 'This name is right — add it to the official list.'}
                {a === 'rename' && 'Change this official name everywhere it is used.'}
              </button>
            ))}
          </div>

          {action === 'merge' && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Merge into</p>
              {officialSiblings.length > 0 ? (
                <Select
                  value={mergeTo || undefined}
                  onValueChange={v => {
                    setMergeTo(v);
                    reset();
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Pick the official name…" />
                  </SelectTrigger>
                  <SelectContent>
                    {officialSiblings.map(n => (
                      <SelectItem key={n} value={n}>
                        {n}
                        {node.suggestion?.name === n ? '  · suggested' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500 dark:bg-gray-800">
                  There is no official {level === 'category' ? 'category in this unit' : 'sub-category in this category'} to merge into.
                </p>
              )}
            </div>
          )}

          {action === 'rename' && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">New name</p>
              <Input
                value={renameTo}
                onChange={e => {
                  setRenameTo(e.target.value);
                  reset();
                }}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Note (optional)</p>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Why — kept in the change log" />
          </div>

          {preview && (
            <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/30">
              <p className="text-xs font-bold text-blue-900 dark:text-blue-200">This will change</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Count label="questions" n={preview.counts.questions} />
                <Count label="tests" n={preview.counts.tests} />
                <Count label="attempts (shown with the new name)" n={preview.counts.attempts} />
                {!!preview.counts.study_plan_rows && <Count label="study-plan rows" n={preview.counts.study_plan_rows} />}
              </div>
              {preview.notes.map(n => (
                <p key={n} className="flex gap-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  {n}
                </p>
              ))}
              {preview.new_official_names.length > 0 && (
                <p className="text-[11px] text-blue-800 dark:text-blue-300">
                  Becomes official: {preview.new_official_names.join(', ')}
                </p>
              )}
              {preview.samples.length > 0 && (
                <div className="max-h-40 space-y-1.5 overflow-y-auto">
                  {preview.samples.map(s => (
                    <div key={`${s.table}:${s.id}`} className="rounded-lg bg-white p-2 text-[11px] dark:bg-gray-900">
                      <p className="truncate text-gray-700 dark:text-gray-300">{s.label || s.id}</p>
                      {Object.keys(s.new)
                        .filter(k => !QUIET_KEYS.has(k) && !k.endsWith('_node_id') && show(s.old[k]) !== show(s.new[k]))
                        .map(k => (
                          <p key={k} className="flex flex-wrap items-center gap-1 text-gray-500">
                            <span className="font-mono">{k}</span>: <span className="line-through">{show(s.old[k])}</span>
                            <ArrowRight className="h-3 w-3" />
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{show(s.new[k])}</span>
                          </p>
                        ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          {!preview ? (
            <button
              type="button"
              onClick={() => previewM.mutate()}
              disabled={!ready || busy}
              className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900"
            >
              {previewM.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Preview
            </button>
          ) : (
            <button
              type="button"
              onClick={() => applyM.mutate()}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-40"
            >
              {applyM.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Apply {ACTION_LABEL[action].toLowerCase()}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Count({ label, n }: { label: string; n: number | undefined }) {
  return (
    <span className="rounded-lg bg-white px-2.5 py-1 font-semibold text-gray-800 dark:bg-gray-900 dark:text-gray-200">
      {fmt(n)} <span className="font-normal text-gray-500">{label}</span>
    </span>
  );
}

// ─── Change log ──────────────────────────────────────────────────────────────

function ChangeLog({ stage }: { stage: string }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<TaxonomyLogEntry | null>(null);

  const log = useQuery({
    queryKey: ['taxonomy', 'log', stage, page],
    queryFn: () => taxonomyApi.log({ stage, include_undone: true, page, limit: 50 }),
  });

  const undo = useMutation({
    mutationFn: (logId: string) => taxonomyApi.undo(logId),
    onSuccess: () => {
      toast.success('Change undone.');
      setConfirm(null);
      void qc.invalidateQueries({ queryKey: ['taxonomy'] });
      void qc.invalidateQueries({ queryKey: ['syllabus'] });
    },
    onError: e => toast.error(taxonomyErrorMessage(e)),
  });

  if (log.isLoading)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  if (log.isError)
    return <p className="py-12 text-center text-sm text-rose-600">Could not load the log: {taxonomyErrorMessage(log.error)}</p>;

  const items = log.data?.items ?? [];
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {items.length === 0 && <p className="py-12 text-center text-sm text-gray-500">No changes yet.</p>}
      {items.map(e => (
        <div
          key={e.log_id}
          className={cn('flex flex-wrap items-center gap-3 border-b border-gray-50 px-4 py-3 last:border-0 dark:border-gray-800/60', e.undone_at && 'opacity-50')}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-900 dark:text-gray-100">
              <span className="font-bold">{ACTION_LABEL[e.action]}</span> {e.level}{' '}
              <span className="font-semibold">“{e.from}”</span>
              {e.to && (
                <>
                  {' '}
                  → <span className="font-semibold">“{e.to}”</span>
                </>
              )}
            </p>
            <p className="text-[11px] text-gray-500">
              {new Date(e.time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              {e.scope.unit ? ` · ${e.scope.unit}` : ''} · {fmt(e.counts.questions)} questions · {fmt(e.counts.tests)} tests
              {e.note ? ` · “${e.note}”` : ''}
              {e.undone_at ? ` · undone ${new Date(e.undone_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
            </p>
          </div>
          {!e.undone_at && (
            <button
              type="button"
              onClick={() => setConfirm(e)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </button>
          )}
        </div>
      ))}
      {(log.data?.pages ?? 1) > 1 && (
        <div className="flex items-center justify-between px-4 py-3 text-xs">
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="font-semibold disabled:opacity-40">
            ‹ Newer
          </button>
          <span className="text-gray-500">
            Page {page} of {log.data?.pages}
          </span>
          <button
            type="button"
            disabled={page >= (log.data?.pages ?? 1)}
            onClick={() => setPage(p => p + 1)}
            className="font-semibold disabled:opacity-40"
          >
            Older ›
          </button>
        </div>
      )}

      <Dialog open={!!confirm} onOpenChange={o => !o && !undo.isPending && setConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Undo this change?</DialogTitle>
            <DialogDescription>
              {confirm && (
                <>
                  {ACTION_LABEL[confirm.action]} “{confirm.from}”{confirm.to ? ` → “${confirm.to}”` : ''}. Every question and test it touched
                  gets its old name back.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setConfirm(null)}
              disabled={undo.isPending}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => confirm && undo.mutate(confirm.log_id)}
              disabled={undo.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-40"
            >
              {undo.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Undo
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
