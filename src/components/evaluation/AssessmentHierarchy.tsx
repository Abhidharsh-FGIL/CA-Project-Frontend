import { useMemo, useState, type ReactNode } from 'react';
import { EyeOff, Layers, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  KIND_LABEL,
  buildAssessmentTree,
  seedFor,
  type AssessmentKind,
  type NewAssessmentSeed,
  type TreeSectionA,
  type TreeUnitA,
} from '@/lib/assessment-hierarchy';
import { Count, Fold } from './CollectionHierarchy';

type Row = Record<string, any>;
const GRID = 'grid gap-4 sm:grid-cols-2';

const KIND_HINT: Record<AssessmentKind, string> = {
  mock: 'Full-length papers',
  keytopic: 'One topic of a unit, by subject',
  practice: 'Whole units and subjects, by subject',
};

function NewHere({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onClick} title={label}>
      <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">New</span>
    </Button>
  );
}

function UnitBlock({
  unit,
  onNew,
  renderCard,
}: {
  unit: TreeUnitA;
  onNew: () => void;
  renderCard: (a: Row) => ReactNode;
}) {
  const [open, setOpen] = useState(unit.items.length > 0);
  const empty = unit.items.length === 0;
  return (
    <Fold
      tone="unit"
      open={open}
      onToggle={() => setOpen(o => !o)}
      title={
        <span className={cn(empty && 'font-medium text-muted-foreground')}>
          {unit.label && <span className="mr-2 inline-block w-6 text-[10px] font-bold text-muted-foreground">{unit.label}</span>}
          {unit.name}
        </span>
      }
      meta={<Count n={unit.items.length} />}
      actions={<NewHere label={`New assessment in ${unit.name}`} onClick={onNew} />}
    >
      <div className="pb-3 pl-6 pr-1 pt-1">
        {empty ? (
          <p className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
            Nothing here yet. <b>New</b> starts an assessment already placed in this unit.
          </p>
        ) : (
          <div className={GRID}>{unit.items.map(a => renderCard(a))}</div>
        )}
      </div>
    </Fold>
  );
}

function SectionBlock({
  section,
  kind,
  onNew,
  renderCard,
}: {
  section: TreeSectionA;
  kind: AssessmentKind;
  onNew: (at: { unitId?: string; section?: string }) => void;
  renderCard: (a: Row) => ReactNode;
}) {
  const [open, setOpen] = useState(section.total > 0);
  const filled = section.units.filter(u => u.items.length > 0).length;
  return (
    <Fold
      tone="unit"
      open={open}
      onToggle={() => setOpen(o => !o)}
      title={<span className="text-sm font-bold">{section.name}</span>}
      meta={
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="hidden sm:inline">
            {filled} of {section.units.length} units
          </span>
          <Count n={section.total} />
        </span>
      }
    >
      <div className="space-y-0.5 border-l pb-2 pl-3 ml-3">
        {section.units.map(u => (
          <UnitBlock key={u.unitId} unit={u} onNew={() => onNew({ unitId: u.unitId })} renderCard={renderCard} />
        ))}
        {/* A key topic always sits in a unit; only a practice set can cover a whole subject. */}
        {kind === 'practice' && (
          <div className="pt-2">
            <div className="flex items-center justify-between px-2 pb-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Whole {section.name} sets · {section.whole.length}
              </p>
              <NewHere label={`New whole-subject set for ${section.name}`} onClick={() => onNew({ section: section.name })} />
            </div>
            {section.whole.length > 0 && <div className={cn(GRID, 'pl-6 pr-1')}>{section.whole.map(a => renderCard(a))}</div>}
          </div>
        )}
      </div>
    </Fold>
  );
}

/**
 * Assessments laid out as the exam: Group 4 → Mock / Key Topics / Practice, and under the last two Subject → Unit.
 * "New" beside any spot starts a new assessment already placed there, so the placement is the tree's, not retyped.
 */
export function AssessmentHierarchy({
  assessments,
  renderCard,
  onCreate,
}: {
  assessments: Row[];
  renderCard: (a: Row) => ReactNode;
  onCreate: (seed: NewAssessmentSeed) => void;
}) {
  const tree = useMemo(() => buildAssessmentTree(assessments), [assessments]);
  const [tab, setTab] = useState('group-4');
  const tabs = [
    ...tree.groups.map(g => ({ id: g.id, label: g.name.replace(/^TNPSC\s+/, ''), n: g.total })),
    { id: '__unplaced', label: 'Unplaced', n: tree.unplaced.length },
  ];
  const active = tabs.some(t => t.id === tab) ? tab : tabs[0].id;
  const group = tree.groups.find(g => g.id === active);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              active === t.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
              t.id === '__unplaced' && t.n > 0 && active !== t.id && 'border-amber-300 text-amber-800 dark:text-amber-300',
            )}
          >
            {t.id === '__unplaced' ? <EyeOff className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
            {t.label}
            <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', active === t.id ? 'bg-white/20' : 'bg-muted')}>{t.n}</span>
          </button>
        ))}
      </div>

      {group && (
        <div className="space-y-3">
          <KindBlock
            kind="mock"
            count={group.mock.length}
            onNew={() => onCreate(seedFor(group.id, 'mock'))}
            defaultOpen={group.mock.length > 0}
          >
            {group.mock.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
                No mock assessments yet. <b>New</b> starts one placed under {group.name} → Mock.
              </p>
            ) : (
              <div className={GRID}>{group.mock.map(a => renderCard(a))}</div>
            )}
          </KindBlock>

          {(['keytopic', 'practice'] as const).map(kind => {
            const sections = kind === 'keytopic' ? group.keyTopics : group.practice;
            const total = sections.reduce((n, s) => n + s.total, 0);
            return (
              <KindBlock key={kind} kind={kind} count={total} defaultOpen={total > 0}>
                <div className="space-y-2">
                  {sections.map(s => (
                    <SectionBlock
                      key={s.name}
                      section={s}
                      kind={kind}
                      onNew={at => onCreate(seedFor(group.id, kind, at))}
                      renderCard={renderCard}
                    />
                  ))}
                </div>
              </KindBlock>
            );
          })}
        </div>
      )}

      {active === '__unplaced' &&
        (tree.unplaced.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            Every assessment is placed.
          </p>
        ) : (
          <>
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              These assessments have no TNPSC placement, or name a unit their exam does not have, so aspirants cannot see
              them. Open <b>Placement</b> on each to file it under Mock, Key Topics or Practice.
            </p>
            <div className={GRID}>{tree.unplaced.map(a => renderCard(a))}</div>
          </>
        ))}
    </div>
  );
}

function KindBlock({
  kind,
  count,
  onNew,
  defaultOpen,
  children,
}: {
  kind: AssessmentKind;
  count: number;
  onNew?: () => void;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Fold
      open={open}
      onToggle={() => setOpen(o => !o)}
      title={
        <span>
          {KIND_LABEL[kind]} <span className="ml-1 text-[11px] font-normal text-muted-foreground">{KIND_HINT[kind]}</span>
        </span>
      }
      meta={<Count n={count} />}
      actions={onNew ? <NewHere label="New mock assessment" onClick={onNew} /> : undefined}
    >
      <div className="border-t p-3">{children}</div>
    </Fold>
  );
}
