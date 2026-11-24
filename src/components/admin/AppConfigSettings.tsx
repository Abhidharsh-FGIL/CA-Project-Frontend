import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Save } from 'lucide-react';
import {
  APP_LIMITS,
  EMPTY_APP_CONFIG,
  HIGHLIGHT_ICONS,
  SLIDE_IMAGE,
  slideImageProblem,
  validateAppConfig,
  type AppChip,
  type AppConfig,
  type AppHighlight,
  type AppSlide,
} from '@/config/app-config';
import { getAdminAppConfig, saveAdminAppConfig, uploadOnboardingImage } from '@/lib/appConfigApi';
import { DashboardBannersEditor } from '@/components/admin/DashboardBannersEditor';
import { FIELD, FIELD_ERR, PictureField, RowTools, Text, move } from '@/components/admin/app-config-ui';

/**
 * What the mobile app shows before sign-in: tagline, exam chips, highlights, onboarding slides, the dashboard banners and the login text. Saving replaces the whole
 * document, so the form always sends every field back. A row switched off stays in the list and is hidden from the app.
 */
export function AppConfigSettings() {
  const qc = useQueryClient();
  const saved = useQuery({ queryKey: ['admin-app-config'], queryFn: getAdminAppConfig, retry: false });
  const [form, setForm] = useState<AppConfig>(EMPTY_APP_CONFIG);
  const [dirty, setDirty] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  useEffect(() => {
    if (saved.data) setForm(saved.data);
    setDirty(false);
    setServerMessage(null);
  }, [saved.data]);

  const errors = useMemo(() => validateAppConfig(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;

  const edit = (patch: Partial<AppConfig>) => {
    setForm(f => ({ ...f, ...patch }));
    setDirty(true);
    setServerMessage(null);
  };
  const editChip = (i: number, patch: Partial<AppChip>) => edit({ exam_chips: form.exam_chips.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const editHighlight = (i: number, patch: Partial<AppHighlight>) =>
    edit({ highlights: form.highlights.map((h, j) => (j === i ? { ...h, ...patch } : h)) });

  const editSlide = (i: number, patch: Partial<AppSlide>) => edit({ onboarding_slides: form.onboarding_slides.map((sl, j) => (j === i ? { ...sl, ...patch } : sl)) });

  const save = useMutation({
    mutationFn: (config: AppConfig) => saveAdminAppConfig(config),
    onSuccess: () => {
      setServerMessage(null);
      qc.invalidateQueries({ queryKey: ['admin-app-config'] });
      toast.success('App screens saved');
    },
    onError: (err: any) => {
      const message = String(err?.message ?? '');
      if (/404|not found/i.test(message)) {
        setServerMessage('The server has no app pre-login setting yet — see BACKEND_APP_CONFIG.md.');
        toast.error('The server has no app pre-login setting yet.', { duration: 12_000 });
      } else {
        // A 422 carries the server's own reason; show it as it is.
        setServerMessage(message || 'The server refused this setting.');
        toast.error(`Could not save: ${message || 'unknown error'}`, { duration: 12_000 });
      }
    },
  });

  const chipsFull = form.exam_chips.length >= APP_LIMITS.max_chips;
  const highlightsFull = form.highlights.length >= APP_LIMITS.max_highlights;
  const slidesFull = form.onboarding_slides.length >= APP_LIMITS.max_slides;
  const section = 'text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400';
  const rowBox = 'rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2.5';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">App pre-login screen</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          What the mobile app shows before someone signs in. The Tamil boxes are optional. A row switched off stays here and is hidden from the app.
        </p>
      </div>

      {saved.isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <>
          {saved.isError && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              The server has no app pre-login setting yet, so the form is empty. Saving needs the endpoint in BACKEND_APP_CONFIG.md.
            </p>
          )}

          {/* ── Tagline ── */}
          <div className="space-y-2.5">
            <p className={section}>Tagline</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Text label="English" value={form.tagline} onChange={v => edit({ tagline: v })} max={APP_LIMITS.tagline} error={errors.tagline} placeholder="Practice · Prepare · Succeed" />
              <Text label="Tamil (optional)" value={form.tagline_ta} onChange={v => edit({ tagline_ta: v })} max={APP_LIMITS.tagline_ta} error={errors.tagline_ta} />
            </div>
          </div>

          {/* ── Exam chips ── */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className={section}>Exam chips <span className="font-normal normal-case tracking-normal text-gray-400">· {form.exam_chips.length}/{APP_LIMITS.max_chips}</span></p>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 disabled:opacity-40"
                disabled={chipsFull}
                onClick={() => edit({ exam_chips: [...form.exam_chips, { id: '', label: '', label_ta: '', is_active: true }] })}
              >
                <Plus className="h-3.5 w-3.5" /> Add chip
              </button>
            </div>
            {errors.chips && <p className="text-[11px] text-red-600">{errors.chips}</p>}
            {form.exam_chips.length === 0 && <p className="text-xs text-gray-400">No chips yet.</p>}
            {form.exam_chips.map((chip, i) => (
              <div key={i} className={`${rowBox} ${chip.is_active ? '' : 'opacity-60'}`}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Text label="Id" value={chip.id} onChange={v => editChip(i, { id: v })} max={APP_LIMITS.chip_id} error={errors[`chip.${i}.id`]} placeholder="group-4" />
                  <Text label="Label" value={chip.label} onChange={v => editChip(i, { label: v })} max={APP_LIMITS.chip_label} error={errors[`chip.${i}.label`]} placeholder="TNPSC" />
                  <Text label="Tamil label (optional)" value={chip.label_ta} onChange={v => editChip(i, { label_ta: v })} max={APP_LIMITS.chip_label_ta} error={errors[`chip.${i}.label_ta`]} />
                </div>
                <RowTools
                  what={`chip ${i + 1}`}
                  index={i}
                  count={form.exam_chips.length}
                  active={chip.is_active}
                  onActive={v => editChip(i, { is_active: v })}
                  onMove={to => edit({ exam_chips: move(form.exam_chips, i, to) })}
                  onRemove={() => edit({ exam_chips: form.exam_chips.filter((_, j) => j !== i) })}
                />
              </div>
            ))}
          </div>

          {/* ── Highlights ── */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className={section}>Highlights <span className="font-normal normal-case tracking-normal text-gray-400">· {form.highlights.length}/{APP_LIMITS.max_highlights}</span></p>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 disabled:opacity-40"
                disabled={highlightsFull}
                onClick={() => edit({ highlights: [...form.highlights, { icon: HIGHLIGHT_ICONS[0].value, title: '', title_ta: '', is_active: true }] })}
              >
                <Plus className="h-3.5 w-3.5" /> Add highlight
              </button>
            </div>
            {errors.highlights && <p className="text-[11px] text-red-600">{errors.highlights}</p>}
            {form.highlights.length === 0 && <p className="text-xs text-gray-400">No highlights yet.</p>}
            {form.highlights.map((h, i) => {
              // An icon the app has artwork for, plus whatever is saved on this row even if it is not one of them.
              const known = HIGHLIGHT_ICONS.some(o => o.value === h.icon);
              return (
                <div key={i} className={`${rowBox} ${h.is_active ? '' : 'opacity-60'}`}>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300">Icon</span>
                      <select
                        className={`${FIELD} ${errors[`highlight.${i}.icon`] ? FIELD_ERR : ''}`}
                        value={h.icon}
                        onChange={e => editHighlight(i, { icon: e.target.value })}
                      >
                        {!known && h.icon && <option value={h.icon}>{h.icon}</option>}
                        {HIGHLIGHT_ICONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label} ({o.value})</option>
                        ))}
                      </select>
                      {errors[`highlight.${i}.icon`] && <span className="mt-0.5 block text-[11px] text-red-600">{errors[`highlight.${i}.icon`]}</span>}
                    </label>
                    <Text label="Title" value={h.title} onChange={v => editHighlight(i, { title: v })} max={APP_LIMITS.highlight_title} error={errors[`highlight.${i}.title`]} placeholder="Full mock tests" />
                    <Text label="Tamil title (optional)" value={h.title_ta} onChange={v => editHighlight(i, { title_ta: v })} max={APP_LIMITS.highlight_title_ta} error={errors[`highlight.${i}.title_ta`]} />
                  </div>
                  <RowTools
                    what={`highlight ${i + 1}`}
                    index={i}
                    count={form.highlights.length}
                    active={h.is_active}
                    onActive={v => editHighlight(i, { is_active: v })}
                    onMove={to => edit({ highlights: move(form.highlights, i, to) })}
                    onRemove={() => edit({ highlights: form.highlights.filter((_, j) => j !== i) })}
                  />
                </div>
              );
            })}
          </div>

          {/* ── Onboarding slides ── */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className={section}>Onboarding slides <span className="font-normal normal-case tracking-normal text-gray-400">· {form.onboarding_slides.length}/{APP_LIMITS.max_slides}</span></p>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 disabled:opacity-40"
                disabled={slidesFull}
                onClick={() => edit({ onboarding_slides: [...form.onboarding_slides, { title: '', title_ta: '', subtitle: '', subtitle_ta: '', image_url: '', is_active: true }] })}
              >
                <Plus className="h-3.5 w-3.5" /> Add slide
              </button>
            </div>
            <p className="text-[11px] text-gray-400">The swipe-through screens a new user sees on first launch. Order here is the order in the app.</p>
            {errors.slides && <p className="text-[11px] text-red-600">{errors.slides}</p>}
            {form.onboarding_slides.length === 0 && <p className="text-xs text-gray-400">No slides yet.</p>}
            {form.onboarding_slides.map((sl, i) => (
              <div key={i} className={`${rowBox} ${sl.is_active ? '' : 'opacity-60'}`}>
                <PictureField url={sl.image_url} label={`Slide ${i + 1}`} onChange={url => editSlide(i, { image_url: url })} types={SLIDE_IMAGE.types} advice={SLIDE_IMAGE.advice} check={slideImageProblem} upload={uploadOnboardingImage} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Text label="Title" value={sl.title} onChange={v => editSlide(i, { title: v })} max={APP_LIMITS.slide_title} error={errors[`slide.${i}.title`]} placeholder="Practice *smarter*" hint="Wrap words in *stars* for the accent colour." />
                  <Text label="Tamil title (optional)" value={sl.title_ta} onChange={v => editSlide(i, { title_ta: v })} hint="Wrap words in *stars* for the accent colour." />
                  <Text multiline label="Subtitle" value={sl.subtitle} onChange={v => editSlide(i, { subtitle: v })} max={APP_LIMITS.slide_subtitle} error={errors[`slide.${i}.subtitle`]} />
                  <Text multiline label="Tamil subtitle (optional)" value={sl.subtitle_ta} onChange={v => editSlide(i, { subtitle_ta: v })} />
                </div>
                <RowTools
                  what={`slide ${i + 1}`}
                  index={i}
                  count={form.onboarding_slides.length}
                  active={sl.is_active}
                  onActive={v => editSlide(i, { is_active: v })}
                  onMove={to => edit({ onboarding_slides: move(form.onboarding_slides, i, to) })}
                  onRemove={() => edit({ onboarding_slides: form.onboarding_slides.filter((_, j) => j !== i) })}
                />
              </div>
            ))}
          </div>

          {/* ── Dashboard banners ── */}
          <DashboardBannersEditor
            banners={form.dashboard_banners}
            errors={errors}
            onChange={dashboard_banners => edit({ dashboard_banners })}
            section={section}
            rowBox={rowBox}
          />

          {/* ── Login screen ── */}
          <div className="space-y-2.5">
            <p className={section}>Login screen</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Text label="Title" value={form.login_title} onChange={v => edit({ login_title: v })} max={APP_LIMITS.login_title} error={errors.login_title} placeholder="Welcome Back" />
              <Text label="Tamil title (optional)" value={form.login_title_ta} onChange={v => edit({ login_title_ta: v })} max={APP_LIMITS.login_title_ta} error={errors.login_title_ta} />
              <Text multiline label="Subtitle" value={form.login_subtitle} onChange={v => edit({ login_subtitle: v })} max={APP_LIMITS.login_subtitle} error={errors.login_subtitle} placeholder="Enter your registered email ID to get a one-time password" />
              <Text multiline label="Tamil subtitle (optional)" value={form.login_subtitle_ta} onChange={v => edit({ login_subtitle_ta: v })} max={APP_LIMITS.login_subtitle_ta} error={errors.login_subtitle_ta} />
            </div>
          </div>
        </>
      )}

      {serverMessage && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{serverMessage}</p>
      )}

      <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3">
        {hasErrors && dirty && <span className="text-[11px] text-red-600">Fix the highlighted fields to save.</span>}
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-brand-600 to-brand-400 text-white px-4 py-2 rounded-lg shadow-md disabled:opacity-50"
          disabled={!dirty || hasErrors || save.isPending}
          onClick={() => save.mutate(form)}
        >
          {save.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
        </button>
      </div>
    </div>
  );
}
