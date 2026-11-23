import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CARD_LIMITS, type CardCycle, type PlanCardForm } from '@/lib/plan-editor';

const INPUT =
  'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 block mb-1">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  );
}

/**
 * The words on a plan's pricing-page card for one billing cycle. Leave it empty to use the built-in wording.
 * Counts are not typed: write {mock} / {practice} (and {mock_s} / {practice_s} for the plural "s") and they are
 * filled from the plan's own limits, so changing a limit changes the card.
 */
export function PlanCardFields({
  cycle,
  onCycle,
  value,
  onChange,
}: {
  cycle: CardCycle;
  onCycle: (c: CardCycle) => void;
  value: PlanCardForm;
  onChange: (v: PlanCardForm) => void;
}) {
  const set = <K extends keyof PlanCardForm>(key: K, v: PlanCardForm[K]) => onChange({ ...value, [key]: v });
  const setPoint = (i: number, patch: Partial<{ title: string; detail: string }>) =>
    set(
      'included',
      value.included.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    );

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-800">
        {(['monthly', 'yearly'] as const).map(c => (
          <button
            key={c}
            type="button"
            onClick={() => onCycle(c)}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-semibold capitalize',
              cycle === c ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400',
            )}
          >
            {c} card
          </button>
        ))}
      </div>

      <Field label="Headline" hint="The big line at the top of the card.">
        <input
          className={INPUT}
          maxLength={CARD_LIMITS.headline}
          value={value.headline}
          onChange={e => set('headline', e.target.value)}
          placeholder="Start Small. Practise Smart. Improve Every Day."
        />
      </Field>
      <Field label="Description">
        <textarea
          className={cn(INPUT, 'min-h-[64px]')}
          maxLength={CARD_LIMITS.description}
          value={value.description}
          onChange={e => set('description', e.target.value)}
        />
      </Field>

      <div>
        <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">What’s included</p>
        <div className="space-y-2">
          {value.included.map((p, i) => (
            <div key={i} className="rounded-lg border border-gray-100 dark:border-gray-800 p-2 space-y-1.5">
              <div className="flex gap-2">
                <input
                  className={cn(INPUT, 'font-semibold')}
                  maxLength={CARD_LIMITS.includedTitle}
                  value={p.title}
                  onChange={e => setPoint(i, { title: e.target.value })}
                  placeholder="{mock} Full-Length Mock Test{mock_s}"
                />
                <button
                  type="button"
                  aria-label="Remove point"
                  onClick={() => set('included', value.included.filter((_, idx) => idx !== i))}
                  className="w-9 shrink-0 inline-flex items-center justify-center bg-gray-50 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-600 rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                className={INPUT}
                maxLength={CARD_LIMITS.includedDetail}
                value={p.detail}
                onChange={e => setPoint(i, { detail: e.target.value })}
                placeholder="The sentence under the title"
              />
            </div>
          ))}
          {value.included.length < CARD_LIMITS.includedItems && (
            <button
              type="button"
              onClick={() => set('included', [...value.included, { title: '', detail: '' }])}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg border-2 border-dashed border-blue-200 dark:border-blue-900"
            >
              <Plus className="w-3 h-3" /> Add point
            </button>
          )}
        </div>
        <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
          Write {'{mock}'} and {'{practice}'} instead of a number (add {'{mock_s}'} / {'{practice_s}'} for the plural “s”) — they are filled from the
          plan’s limits above, so the card never disagrees with what the plan gives.
        </p>
      </div>

      <Field label="Not included (one per line)" hint="Shown greyed out under the list. Optional.">
        <textarea className={cn(INPUT, 'min-h-[48px]')} value={value.excluded} onChange={e => set('excluded', e.target.value)} />
      </Field>
      <Field label="Best for">
        <textarea
          className={cn(INPUT, 'min-h-[52px]')}
          maxLength={CARD_LIMITS.bestFor}
          value={value.best_for}
          onChange={e => set('best_for', e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Button text">
          <input className={INPUT} maxLength={CARD_LIMITS.cta} value={value.cta} onChange={e => set('cta', e.target.value)} placeholder="Choose Essential" />
        </Field>
        <Field label="Badge (replaces “Most popular”)">
          <input className={INPUT} maxLength={CARD_LIMITS.badge} value={value.badge} onChange={e => set('badge', e.target.value)} />
        </Field>
      </div>
    </div>
  );
}
