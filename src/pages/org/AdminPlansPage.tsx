import { useState } from 'react';
import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { PageHeader } from '@/components/layout/AppShell';
import {
  Crown,
  Sparkles,
  Star,
  Edit2,
  Save,
  X,
  Plus,
  Trash2,
  Check,
  Infinity as InfinityIcon,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAdminPlans, useAdminPlanActions } from '@/hooks/use-admin-plans';
import { type PlanOut, type PlanName } from '@/lib/adminApi';

type PlanFeatureValue = number | 'unlimited' | 'none';

// Local editor form shape — mirrors what the UI edits
interface PlanEditorForm {
  plan_id: string;
  name: PlanName;
  price_monthly: number;
  price_yearly: number;
  duration_days_monthly: number;
  duration_days_yearly: number;
  highlight: boolean;
  active: boolean;
  perks: string[];
  practice_tests_per_month: PlanFeatureValue;
  mock_tests_per_month: PlanFeatureValue;
  ai_report_level: string;
  history_retention_days: PlanFeatureValue;
  download_pdf: boolean;
  support: string;
}

const TIER_META: Record<PlanName, { icon: typeof Sparkles; color: string }> = {
  free: { icon: Star, color: 'from-gray-400 to-gray-500' },
  standard: { icon: Sparkles, color: 'from-blue-500 to-cyan-500' },
  ultimate: { icon: Sparkles, color: 'from-indigo-500 to-purple-500' },
  premium: { icon: Crown, color: 'from-amber-500 to-orange-500' },
};

const REPORT_LEVELS = ['basic', 'standard', 'detailed', 'full'] as const;

function planToForm(plan: PlanOut): PlanEditorForm {
  const f = plan.features ?? {};
  return {
    plan_id: plan.plan_id,
    name: plan.name,
    price_monthly: plan.price_monthly,
    price_yearly: plan.price_yearly,
    duration_days_monthly: plan.duration_days_monthly,
    duration_days_yearly: plan.duration_days_yearly,
    highlight: plan.highlight,
    active: plan.active,
    perks: plan.perks ?? [],
    practice_tests_per_month: (f.practice_tests_per_month as PlanFeatureValue) ?? 'unlimited',
    mock_tests_per_month: (f.mock_tests_per_month as PlanFeatureValue) ?? 'none',
    ai_report_level: (f.ai_report_level as string) ?? 'basic',
    history_retention_days: (f.history_retention_days as PlanFeatureValue) ?? 30,
    download_pdf: (f.download_pdf as boolean) ?? false,
    support: (f.support as string) ?? 'Email',
  };
}

export default function AdminPlansPage() {
  const { data: plansData, isLoading: plansLoading } = useAdminPlans();
  const plans: PlanOut[] = plansData ?? [];
  const planActions = useAdminPlanActions();
  const [editing, setEditing] = useState<PlanEditorForm | null>(null);

  const handleSave = (form: PlanEditorForm) => {
    planActions.update.mutate({
      tier: form.name,
      payload: {
        price_monthly: form.price_monthly,
        price_yearly: form.price_yearly,
        duration_days_monthly: form.duration_days_monthly,
        duration_days_yearly: form.duration_days_yearly,
        highlight: form.highlight,
        active: form.active,
        perks: form.perks,
        features: {
          practice_tests_per_month: form.practice_tests_per_month,
          mock_tests_per_month: form.mock_tests_per_month,
          ai_report_level: form.ai_report_level,
          history_retention_days: form.history_retention_days,
          download_pdf: form.download_pdf,
          support: form.support,
        },
      },
    });
    setEditing(null);
  };

  const toggleActive = (plan: PlanOut) => {
    planActions.toggleActive.mutate(plan.name);
  };

  return (
    <GenVerseShell>
      <PageHeader
        title="Subscription Plans"
        description="Configure tier features, pricing, and retention."
        breadcrumbs={[{ label: 'Dashboard', href: '/org/dashboard' }, { label: 'Subscription Plans' }]}
      />

      {plansLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : (
      <div className="space-y-5 pb-6">
        {/* Quick stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {plans.map(plan => {
            const Icon = TIER_META[plan.name].icon;
            return (
              <div
                key={plan.name}
                className={cn(
                  'relative rounded-xl border bg-white dark:bg-gray-900 p-3 hover-lift transition-all',
                  plan.active
                    ? 'border-gray-100 dark:border-gray-800'
                    : 'border-gray-200 dark:border-gray-700 opacity-60',
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg bg-gradient-to-br text-white flex items-center justify-center shadow-sm',
                      TIER_META[plan.name].color,
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{plan.name}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      {plan.price_monthly === 0
                        ? 'Free'
                        : `₹${plan.price_monthly}/mo · ₹${plan.price_yearly}/yr`}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Plan comparison table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-gray-50 to-indigo-50/30 dark:from-gray-800/60 dark:to-indigo-950/30 border-b border-gray-100 dark:border-gray-800">
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
                  <th className="px-4 py-3 sticky left-0 bg-gray-50/95 dark:bg-gray-800/95 z-10">Feature</th>
                  {plans.map(p => {
                    const Icon = TIER_META[p.name].icon;
                    return (
                      <th key={p.name} className="px-4 py-3 text-center min-w-[140px]">
                        <div className="flex items-center justify-center gap-1.5">
                          <div
                            className={cn(
                              'w-5 h-5 rounded bg-gradient-to-br text-white flex items-center justify-center',
                              TIER_META[p.name].color,
                            )}
                          >
                            <Icon className="w-3 h-3" />
                          </div>
                          <span>{p.name}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <FeatureRow
                  label="Status"
                  cells={plans.map(p => (
                    <button
                      key={p.name}
                      onClick={() => toggleActive(p)}
                      className={cn(
                        'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border transition-colors',
                        p.active
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700',
                      )}
                    >
                      {p.active ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                      {p.active ? 'Active' : 'Paused'}
                    </button>
                  ))}
                />
                <FeatureRow
                  label="Monthly Price"
                  cells={plans.map(p => (
                    <span key={p.name} className="font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                      {p.price_monthly === 0 ? '—' : `₹${p.price_monthly.toLocaleString('en-IN')}`}
                    </span>
                  ))}
                />
                <FeatureRow
                  label="Yearly Price"
                  cells={plans.map(p => (
                    <span key={p.name} className="font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                      {p.price_yearly === 0 ? '—' : `₹${p.price_yearly.toLocaleString('en-IN')}`}
                    </span>
                  ))}
                />
                <FeatureRow
                  label="Practice Tests / month"
                  cells={plans.map(p => {
                    const val = (p.features?.practice_tests_per_month as PlanFeatureValue) ?? 'unlimited';
                    return (
                      <span key={p.name} className="text-gray-700 dark:text-gray-300">
                        {val === 'unlimited' ? (
                          <InfinityIcon className="inline w-4 h-4 text-indigo-500" />
                        ) : (
                          String(val)
                        )}
                      </span>
                    );
                  })}
                />
                <FeatureRow
                  label="Mock Tests / month"
                  cells={plans.map(p => {
                    const val = (p.features?.mock_tests_per_month as PlanFeatureValue) ?? 'none';
                    return (
                      <span key={p.name} className="text-gray-700 dark:text-gray-300">
                        {val === 'unlimited' ? (
                          <InfinityIcon className="inline w-4 h-4 text-indigo-500" />
                        ) : val === 'none' ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          String(val)
                        )}
                      </span>
                    );
                  })}
                />
                <FeatureRow
                  label="AI Report Level"
                  cells={plans.map(p => (
                    <span
                      key={p.name}
                      className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded"
                    >
                      {(p.features?.ai_report_level as string) ?? 'basic'}
                    </span>
                  ))}
                />
                <FeatureRow
                  label="History Retention"
                  cells={plans.map(p => {
                    const val = (p.features?.history_retention_days as PlanFeatureValue) ?? 30;
                    return (
                      <span key={p.name} className="text-gray-700 dark:text-gray-300 text-xs">
                        {val === 'unlimited' ? 'Unlimited' : `${val} days`}
                      </span>
                    );
                  })}
                />
                <FeatureRow
                  label="PDF Download"
                  cells={plans.map(p => (
                    <span key={p.name}>
                      {(p.features?.download_pdf as boolean) ? (
                        <Check className="inline w-4 h-4 text-emerald-500" />
                      ) : (
                        <X className="inline w-4 h-4 text-gray-300 dark:text-gray-600" />
                      )}
                    </span>
                  ))}
                />
                <FeatureRow
                  label="Support"
                  cells={plans.map(p => (
                    <span key={p.name} className="text-gray-700 dark:text-gray-300 text-xs">
                      {(p.features?.support as string) ?? '—'}
                    </span>
                  ))}
                />
                <FeatureRow
                  label="Highlight (Popular)"
                  cells={plans.map(p => (
                    <span key={p.name}>
                      {p.highlight ? (
                        <Star className="inline w-4 h-4 text-amber-500 fill-amber-500" />
                      ) : (
                        <X className="inline w-4 h-4 text-gray-300 dark:text-gray-600" />
                      )}
                    </span>
                  ))}
                />
                <tr>
                  <td className="px-4 py-3 sticky left-0 bg-white dark:bg-gray-900 z-10"></td>
                  {plans.map(p => (
                    <td key={p.name} className="px-4 py-3 text-center">
                      <button
                        onClick={() => setEditing(planToForm(p))}
                        className="inline-flex items-center gap-1 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-3 py-1.5 rounded-lg shadow-sm press"
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Perks comparison */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3 inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Plan Perks
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {plans.map(plan => {
              const Icon = TIER_META[plan.name].icon;
              return (
                <div key={plan.name} className="bg-gray-50/60 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className={cn(
                        'w-7 h-7 rounded-lg bg-gradient-to-br text-white flex items-center justify-center',
                        TIER_META[plan.name].color,
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{plan.name}</p>
                  </div>
                  <ul className="space-y-1.5">
                    {(plan.perks ?? []).map((perk, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                        <Check className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                        {perk}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {editing && (
        <PlanEditor plan={editing} onClose={() => setEditing(null)} onSave={handleSave} />
      )}
    </GenVerseShell>
  );
}

function FeatureRow({
  label,
  cells,
}: {
  label: string;
  cells: React.ReactNode[];
}) {
  return (
    <tr className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
      <td className="px-4 py-3 sticky left-0 bg-white dark:bg-gray-900 font-semibold text-gray-700 dark:text-gray-300 text-xs">
        {label}
      </td>
      {cells.map((cell, i) => (
        <td key={i} className="px-4 py-3 text-center">
          {cell}
        </td>
      ))}
    </tr>
  );
}

function PlanEditor({
  plan,
  onClose,
  onSave,
}: {
  plan: PlanEditorForm;
  onClose: () => void;
  onSave: (p: PlanEditorForm) => void;
}) {
  const [form, setForm] = useState<PlanEditorForm>(plan);
  const Icon = TIER_META[plan.name].icon;

  const updateFeature = (key: keyof Pick<PlanEditorForm, 'practice_tests_per_month' | 'mock_tests_per_month' | 'ai_report_level' | 'history_retention_days' | 'download_pdf' | 'support'>, value: unknown) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const updatePerk = (i: number, val: string) => {
    setForm(f => ({ ...f, perks: f.perks.map((p, idx) => (idx === i ? val : p)) }));
  };
  const addPerk = () => setForm(f => ({ ...f, perks: [...f.perks, 'New perk'] }));
  const removePerk = (i: number) => setForm(f => ({ ...f, perks: f.perks.filter((_, idx) => idx !== i) }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-scaleIn max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div
          className={cn(
            'relative p-4 bg-gradient-to-br text-white',
            TIER_META[plan.name].color,
            'bg-[length:200%_auto] animate-gradient-x',
          )}
        >
          <div className="absolute inset-0 bg-soft-dots opacity-15" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.25em] font-bold opacity-90">Edit Plan</p>
            <h2 className="text-lg font-bold mt-0.5 inline-flex items-center gap-2">
              <Icon className="w-5 h-5" />
              {form.name}
            </h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Pricing */}
          <Section title="Pricing">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Monthly Price (₹)">
                <input
                  type="number"
                  min={0}
                  value={form.price_monthly}
                  onChange={e => setForm(f => ({ ...f, price_monthly: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </FormField>
              <FormField label="Yearly Price (₹)">
                <input
                  type="number"
                  min={0}
                  value={form.price_yearly}
                  onChange={e => setForm(f => ({ ...f, price_yearly: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </FormField>
            </div>
          </Section>

          {/* Test limits */}
          <Section title="Test Limits (per month)">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Practice Tests">
                <LimitInput
                  value={form.practice_tests_per_month}
                  unlimitedLabel="Unlimited"
                  onChange={v => updateFeature('practice_tests_per_month', v)}
                />
              </FormField>
              <FormField label="Mock Tests">
                <LimitInput
                  value={form.mock_tests_per_month}
                  unlimitedLabel="Unlimited"
                  noneOption
                  onChange={v => updateFeature('mock_tests_per_month', v)}
                />
              </FormField>
            </div>
          </Section>

          {/* Reports & retention */}
          <Section title="Reports & Retention">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="AI Report Level">
                <select
                  value={form.ai_report_level}
                  onChange={e => updateFeature('ai_report_level', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 capitalize"
                >
                  {REPORT_LEVELS.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="History Retention (days)">
                <LimitInput
                  value={form.history_retention_days}
                  unlimitedLabel="Unlimited"
                  onChange={v => updateFeature('history_retention_days', v)}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <FormField label="PDF Download">
                <ToggleField
                  value={form.download_pdf}
                  onChange={v => updateFeature('download_pdf', v)}
                  label={form.download_pdf ? 'Enabled' : 'Disabled'}
                />
              </FormField>
              <FormField label="Support">
                <input
                  type="text"
                  value={form.support}
                  onChange={e => updateFeature('support', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </FormField>
            </div>
          </Section>

          {/* Duration */}
          <Section title="Billing Cycle Duration">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Monthly (days)">
                <input
                  type="number"
                  min={1}
                  value={form.duration_days_monthly}
                  onChange={e => setForm(f => ({ ...f, duration_days_monthly: parseInt(e.target.value) || 30 }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </FormField>
              <FormField label="Yearly (days)">
                <input
                  type="number"
                  min={1}
                  value={form.duration_days_yearly}
                  onChange={e => setForm(f => ({ ...f, duration_days_yearly: parseInt(e.target.value) || 365 }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </FormField>
            </div>
          </Section>

          {/* Marketing flags */}
          <Section title="Display">
            <ToggleField
              value={form.highlight ?? false}
              onChange={v => setForm(f => ({ ...f, highlight: v }))}
              label="Mark as Most Popular plan"
            />
          </Section>

          {/* Perks */}
          <Section title="Perks (sales bullets)">
            <div className="space-y-2">
              {form.perks.map((perk, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={perk}
                    onChange={e => updatePerk(i, e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <button
                    type="button"
                    onClick={() => removePerk(i)}
                    className="w-9 inline-flex items-center justify-center bg-gray-50 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-600 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addPerk}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 px-3 py-1.5 rounded-lg border-2 border-dashed border-indigo-200 dark:border-indigo-900 hover:border-indigo-300 dark:hover:border-indigo-800"
              >
                <Plus className="w-3 h-3" /> Add Perk
              </button>
            </div>
          </Section>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 px-3 py-2 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg shadow-md press"
            >
              <Save className="w-3.5 h-3.5" /> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LimitInput({
  value,
  unlimitedLabel,
  noneOption = false,
  onChange,
}: {
  value: PlanFeatureValue;
  unlimitedLabel: string;
  noneOption?: boolean;
  onChange: (v: PlanFeatureValue) => void;
}) {
  const mode = typeof value === 'number' ? 'numeric' : value;
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => onChange(2)}
          className={cn(
            'px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border',
            mode === 'numeric'
              ? 'bg-indigo-600 text-white border-transparent'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700',
          )}
        >
          Numeric
        </button>
        <button
          type="button"
          onClick={() => onChange('unlimited')}
          className={cn(
            'px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border',
            mode === 'unlimited'
              ? 'bg-indigo-600 text-white border-transparent'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700',
          )}
        >
          {unlimitedLabel}
        </button>
        {noneOption && (
          <button
            type="button"
            onClick={() => onChange('none')}
            className={cn(
              'px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border',
              mode === 'none'
                ? 'bg-indigo-600 text-white border-transparent'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700',
            )}
          >
            None
          </button>
        )}
      </div>
      {mode === 'numeric' && (
        <input
          type="number"
          min={0}
          value={value as number}
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      )}
    </div>
  );
}

function ToggleField({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all w-full',
        value
          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400',
      )}
    >
      <span
        className={cn(
          'inline-block w-8 h-4 rounded-full relative transition-colors',
          value ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all',
            value ? 'left-4' : 'left-0.5',
          )}
        />
      </span>
      {label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{title}</p>
      {children}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 block mb-1">{label}</label>
      {children}
    </div>
  );
}
