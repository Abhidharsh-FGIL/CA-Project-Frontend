import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, FolderOpen, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildCollectionTree, type TreeSection, type TreeUnit } from '@/lib/collection-hierarchy';

type Paper = Record<string, any>;

const GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3';

export function Fold({
  open,
  onToggle,
  title,
  meta,
  actions,
  tone = 'section',
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: ReactNode;
  meta?: ReactNode;
  /** Buttons beside the header — outside the toggle, since a button cannot sit inside one. */
  actions?: ReactNode;
  tone?: 'section' | 'unit';
  children?: ReactNode;
}) {
  return (
    <div className={cn(tone === 'section' ? 'rounded-xl border bg-card' : '')}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 text-left transition-colors',
            tone === 'section' ? 'px-4 py-3 hover:bg-muted/40 rounded-xl' : 'px-2 py-2 hover:bg-muted/40 rounded-lg',
          )}
        >
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className={cn('min-w-0 flex-1 truncate', tone === 'section' ? 'text-sm font-bold' : 'text-[13px] font-semibold')}>{title}</span>
          {meta}
        </button>
        {actions && <div className={cn('shrink-0', tone === 'section' ? 'pr-3' : 'pr-1')}>{actions}</div>}
      </div>
      {open && children}
    </div>
  );
}

export const Count = ({ n, of }: { n: number; of?: number }) => (
  <span
    className={cn(
      'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
      n > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
    )}
  >
    {n}
    {of != null ? ` / ${of}` : ''}
  </span>
);

function UnitBlock({ unit, renderCard }: { unit: TreeUnit; renderCard: (p: Paper) => ReactNode }) {
  const [open, setOpen] = useState(unit.papers.length > 0);
  const empty = unit.papers.length === 0;
  return (
    <Fold
      tone="unit"
      open={open}
      onToggle={() => setOpen(o => !o)}
      title={
        <span className={cn(empty && 'text-muted-foreground font-medium')}>
          {unit.label && <span className="mr-2 inline-block w-6 text-[10px] font-bold text-muted-foreground">{unit.label}</span>}
          {unit.name}
        </span>
      }
      meta={<Count n={unit.papers.length} />}
    >
      <div className="pb-3 pl-6 pr-1 pt-1">
        {empty ? (
          <p className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
            No collections in this unit yet. Import a paper for it, or use <b>Move to a unit</b> on an existing one.
          </p>
        ) : (
          <div className={GRID}>{unit.papers.map(p => renderCard(p))}</div>
        )}
      </div>
    </Fold>
  );
}

function SectionBlock({ section, renderCard }: { section: TreeSection; renderCard: (p: Paper) => ReactNode }) {
  const [open, setOpen] = useState(section.total > 0);
  const filled = section.units.filter(u => u.papers.length > 0).length;
  return (
    <Fold
      open={open}
      onToggle={() => setOpen(o => !o)}
      title={section.name}
      meta={
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="hidden sm:inline">
            {filled} of {section.units.length} units have collections
          </span>
          <Count n={section.total} />
        </span>
      }
    >
      <div className="space-y-0.5 border-t px-3 py-2">
        {section.units.map(u => (
          <UnitBlock key={u.unitId} unit={u} renderCard={renderCard} />
        ))}
        {section.loose.length > 0 && (
          <div className="pt-2">
            <p className="px-2 pb-2 text-xs font-semibold text-muted-foreground">
              In {section.name}, no particular unit · {section.loose.length}
            </p>
            <div className={cn(GRID, 'pl-6 pr-1')}>{section.loose.map(p => renderCard(p))}</div>
          </div>
        )}
      </div>
    </Fold>
  );
}

/**
 * Collections laid out as the syllabus: exam → subject → unit → the collections filed there. Every subject and
 * unit is listed whether or not it has collections, so what is missing is as visible as what is there. What
 * could not be placed is in its own tab, for an admin to move by hand.
 */
export function CollectionHierarchy({
  papers,
  isCustom,
  renderCard,
}: {
  papers: Paper[];
  isCustom: (p: Paper) => boolean;
  renderCard: (p: Paper) => ReactNode;
}) {
  const tree = useMemo(() => buildCollectionTree(papers, isCustom), [papers, isCustom]);
  const [tab, setTab] = useState<string>('group-4');
  // A tab that no longer exists (a search emptied it) falls back to the first one.
  const tabs = [
    ...tree.groups.map(g => ({ id: g.id, label: g.name.replace(/^TNPSC\s+/, ''), n: g.total })),
    { id: '__unassigned', label: 'Unassigned', n: tree.unassigned.length },
    ...(tree.custom.length > 0 ? [{ id: '__custom', label: 'Custom', n: tree.custom.length }] : []),
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
              t.id === '__unassigned' && t.n > 0 && active !== t.id && 'border-amber-300 text-amber-800 dark:text-amber-300',
            )}
          >
            {t.id === '__unassigned' ? <FolderOpen className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
            {t.label}
            <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', active === t.id ? 'bg-white/20' : 'bg-muted')}>{t.n}</span>
          </button>
        ))}
      </div>

      {group && (
        <div className="space-y-3">
          {group.sections.map(s => (
            <SectionBlock key={s.name} section={s} renderCard={renderCard} />
          ))}
          {group.loose.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <p className="pb-2 text-sm font-bold">
                In {group.name}, no subject yet <Count n={group.loose.length} />
              </p>
              <div className={GRID}>{group.loose.map(p => renderCard(p))}</div>
            </div>
          )}
        </div>
      )}

      {active === '__unassigned' &&
        (tree.unassigned.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            Every collection is placed in a unit.
          </p>
        ) : (
          <>
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              These collections do not say which unit they belong to, and their names do not settle it. Use <b>Move to a
              unit</b> on each — students only find a collection once it is in a unit.
            </p>
            <div className={GRID}>{tree.unassigned.map(p => renderCard(p))}</div>
          </>
        ))}

      {active === '__custom' && <div className={GRID}>{tree.custom.map(p => renderCard(p))}</div>}
    </div>
  );
}
