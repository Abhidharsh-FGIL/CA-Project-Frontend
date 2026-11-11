import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, Loader2, Megaphone, Pencil, Plus, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EvalAssessmentConfigPanel } from '@/components/evaluation/EvalAssessmentConfigPanel';
import { AttemptDetailView } from '@/components/evaluation/EvalAssessmentReport';
import { LeaderboardTable } from '@/components/promotional/LeaderboardTable';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import {
  fromLocalInput,
  getAdminLeaderboard,
  isEditable,
  listPromotional,
  promotionalPhase,
  scheduleProblem,
  shareLink,
  switchedOff,
  toLocalInput,
  updatePromotional,
  whenLabel,
  type PromotionalAssessment,
} from '@/lib/promotionalApi';

/**
 * Admin → Promotional Tests. Free, scheduled tests shared by link (BACKEND_PROMOTIONAL.md): make one, copy its link,
 * change its title or schedule while it is still upcoming, and read the ranked results once people have taken it.
 * The view lives in the address: `?new=1` to create, `?test=<id>` for one test's results, `&attempt=<id>` for a report.
 */
export default function AdminPromotionalPage() {
  const [params, setParams] = useSearchParams();
  const creating = params.get('new') === '1';
  const testId = params.get('test');
  const attemptId = params.get('attempt');
  const { orgId } = useWorkspaceContext();
  const qc = useQueryClient();

  const list = useQuery({ queryKey: ['promotional', 'admin', orgId], queryFn: () => listPromotional(orgId), retry: false });
  const open = testId ? (list.data ?? []).find(p => p.id === testId) : undefined;

  const back = () => setParams({});

  let body: React.ReactNode;
  if (creating) {
    body = (
      <EvalAssessmentConfigPanel
        promotional
        onBack={back}
        onCreated={id => {
          qc.invalidateQueries({ queryKey: ['promotional'] });
          toast.success('Promotional test created. Copy its link from the list to share it.');
          setParams(id ? { test: id } : {});
        }}
      />
    );
  } else if (testId && attemptId) {
    body = <AttemptDetailView assessmentId={testId} attemptId={attemptId} studentLabel="" onBack={() => setParams({ test: testId })} />;
  } else if (testId) {
    body = <Results id={testId} promo={open} onBack={back} onOpenAttempt={a => setParams({ test: testId, attempt: a })} />;
  } else {
    body = <Listing rows={list.data ?? []} loading={list.isLoading} error={list.isError} onNew={() => setParams({ new: '1' })} onOpen={id => setParams({ test: id })} />;
  }

  return (
    <GenVerseShell>
      {!creating && !(testId && attemptId) && (
        <PageHeader
          title="Promotional Tests"
          description="Free, scheduled tests shared by link. Open only in their window, not listed among the exams, and ranked."
          breadcrumbs={[{ label: 'Dashboard', href: '/org/dashboard' }, { label: 'Promotional Tests' }]}
          actions={
            !testId && (
              <Button onClick={() => setParams({ new: '1' })} className="gap-1.5">
                <Plus className="h-4 w-4" /> New promotional test
              </Button>
            )
          }
        />
      )}
      {body}
    </GenVerseShell>
  );
}

const OFF_STYLE = 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';

const PHASE_STYLE = {
  upcoming: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  live: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  ended: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
} as const;

function Listing({ rows, loading, error, onNew, onOpen }: {
  rows: PromotionalAssessment[];
  loading: boolean;
  error: boolean;
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  const [editing, setEditing] = useState<PromotionalAssessment | null>(null);
  const qc = useQueryClient();
  const now = Date.now();

  // The switch turns a test on or off at any time; off, students cannot open it whatever the times say.
  const toggle = useMutation({
    mutationFn: (v: { id: string; on: boolean }) => updatePromotional(v.id, { is_active: v.on }),
    onSuccess: async (saved, v) => {
      // The reply may be a bare acknowledgement with no `is_active` in it. Then read what the server kept from the list
      // it holds now — only a list that still disagrees means the switch was ignored.
      let kept = saved?.is_active;
      await qc.refetchQueries({ queryKey: ['promotional'] });
      if (kept === undefined) {
        for (const [, rows] of qc.getQueriesData<PromotionalAssessment[]>({ queryKey: ['promotional'] })) {
          const row = Array.isArray(rows) ? rows.find(r => r?.id === v.id) : undefined;
          if (row) kept = row.is_active ?? true;
        }
      }
      if (kept !== v.on) {
        toast.error('The server did not save the switch. It needs the is_active field (see BACKEND_PROMOTIONAL.md §4).');
        return;
      }
      toast.success(v.on ? 'Test is active again' : 'Test switched off. Students cannot open it.');
    },
    onError: (e: unknown) => toast.error(e instanceof Error && e.message ? e.message : 'Could not change the switch.'),
  });

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>;
  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        The promotional tests could not be loaded. The server may not have this feature yet (see BACKEND_PROMOTIONAL.md).
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center">
        <Megaphone className="mx-auto h-8 w-8 text-orange-500" />
        <p className="mt-3 font-semibold">No promotional tests yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Make a free, scheduled test and share its link.</p>
        <Button className="mt-4" onClick={onNew}>New promotional test</Button>
      </div>
    );
  }

  const sorted = [...rows].sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Test</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-center">Active</th>
              <th className="px-3 py-2 text-left">Opens</th>
              <th className="px-3 py-2 text-left">Closes</th>
              <th className="px-3 py-2 text-right">Taken</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => {
              const phase = promotionalPhase(p, now);
              return (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2.5 font-medium">{p.title}</td>
                  <td className="px-3 py-2.5">
                    {switchedOff(p) ? (
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', OFF_STYLE)}>Inactive</span>
                    ) : (
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', PHASE_STYLE[phase])}>
                        {phase === 'ended' ? 'Closed' : phase === 'live' ? 'Live' : 'Upcoming'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Switch
                      checked={!switchedOff(p)}
                      disabled={toggle.isPending && toggle.variables?.id === p.id}
                      onCheckedChange={on => toggle.mutate({ id: p.id, on })}
                      aria-label={`${p.title}: ${switchedOff(p) ? 'inactive' : 'active'}`}
                    />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{whenLabel(p.starts_at)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{whenLabel(p.ends_at)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{p.participants ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => copyLink(p.id)}>
                        <Copy className="h-3.5 w-3.5" /> Link
                      </Button>
                      {isEditable(p, now) && (
                        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setEditing(p)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      )}
                      <Button size="sm" className="h-8 gap-1" onClick={() => onOpen(p.id)}>
                        <Trophy className="h-3.5 w-3.5" /> Results
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editing && <EditDialog promo={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function copyLink(id: string) {
  navigator.clipboard
    ?.writeText(shareLink(id))
    .then(() => toast.success('Link copied'))
    .catch(() => toast.error(shareLink(id)));
}

/** Change a test's name or window — only while it has not opened. */
function EditDialog({ promo, onClose }: { promo: PromotionalAssessment; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(promo.title);
  const [start, setStart] = useState(toLocalInput(promo.starts_at));
  const [end, setEnd] = useState(toLocalInput(promo.ends_at));
  const problem = scheduleProblem(fromLocalInput(start), fromLocalInput(end), Date.now());

  const save = useMutation({
    mutationFn: () => updatePromotional(promo.id, { title: title.trim(), starts_at: fromLocalInput(start), ends_at: fromLocalInput(end) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promotional'] });
      toast.success('Promotional test updated');
      onClose();
    },
    // A test that has opened is locked (409 PROMO_LOCKED); say so instead of leaving Save doing nothing.
    onError: (e: unknown) => {
      qc.invalidateQueries({ queryKey: ['promotional'] });
      toast.error(e instanceof Error && e.message ? e.message : 'Could not save. A test cannot be changed once it has opened.');
    },
  });

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit promotional test</DialogTitle>
          <DialogDescription>It can be changed only until it opens.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            Title
            <input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" />
          </label>
          <label className="block text-sm font-medium">
            Opens at
            <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" />
          </label>
          <label className="block text-sm font-medium">
            Closes at
            <input type="datetime-local" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" />
          </label>
          {problem && <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{problem}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!!problem || !title.trim() || save.isPending}>
            {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One test's results: everyone who took it, ranked, with a link to each report. */
function Results({ id, promo, onBack, onOpenAttempt }: {
  id: string;
  promo?: PromotionalAssessment;
  onBack: () => void;
  onOpenAttempt: (attemptId: string) => void;
}) {
  const { data, isLoading, isError } = useQuery({ queryKey: ['promotional', 'admin-board', id], queryFn: () => getAdminLeaderboard(id), retry: false });
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All promotional tests
      </button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">{promo?.title ?? data?.title ?? 'Promotional test'}</h2>
          {promo && <p className="text-sm text-muted-foreground">{whenLabel(promo.starts_at)} – {whenLabel(promo.ends_at)}</p>}
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copyLink(id)}>
          <Copy className="h-3.5 w-3.5" /> Copy link
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
      ) : isError || !data ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">The results could not be loaded.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{data.total_participants} took this test, best first.</p>
          <LeaderboardTable admin rows={data.top} onOpen={r => r.attempt_id && onOpenAttempt(r.attempt_id)} />
        </>
      )}
    </div>
  );
}
