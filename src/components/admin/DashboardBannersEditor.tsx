import { Plus } from 'lucide-react';
import {
  BANNER_AUDIENCES,
  BANNER_EXAMS,
  BANNER_IMAGE,
  BANNER_LIMITS,
  BANNER_TARGETS,
  bannerImageProblem,
  needsOf,
  newBanner,
  type AppBanner,
} from '@/config/dashboard-banners';
import { buildUrl } from '@/lib/api';
import { uploadBannerImage } from '@/lib/appConfigApi';
import { useEvalAssessments } from '@/hooks/use-eval-assessments';
import { isPromotional } from '@/lib/promotional-flag';
import { FIELD, FIELD_ERR, PictureField, RowTools, Text, move } from '@/components/admin/app-config-ui';

/** How the banner will look in the app: the colour, the picture on the right, the words on the left in the chosen tone. */
function BannerPreview({ b }: { b: AppBanner }) {
  const ink = b.text_color === 'dark' ? '#111827' : '#FFFFFF';
  return (
    <div
      className="relative aspect-[5/2] w-full max-w-md overflow-hidden rounded-xl"
      style={{ backgroundColor: b.background_color }}
      aria-label="Banner preview"
    >
      {b.image_url && <img src={buildUrl(b.image_url)} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <div className="relative flex h-full w-[60%] flex-col justify-center gap-1 px-4" style={{ color: ink }}>
        <p className="line-clamp-2 text-sm font-extrabold leading-tight">{b.title || 'Banner title'}</p>
        {b.subtitle && <p className="line-clamp-2 text-[11px] opacity-90">{b.subtitle}</p>}
        {b.button_text && (
          <span className="mt-1 w-fit rounded-full px-3 py-1 text-[11px] font-bold" style={{ backgroundColor: ink, color: b.background_color }}>
            {b.button_text}
          </span>
        )}
      </div>
    </div>
  );
}

/** The test a banner opens: the admin's own tests, promotional ones for "promotional test" and the rest for "test". */
function TestPicker({ value, promo, onChange, error }: { value: string; promo: boolean; onChange: (id: string) => void; error?: string }) {
  const { data, isLoading } = useEvalAssessments();
  const rows = ((data as any[]) ?? []).filter(a => isPromotional(a) === promo);
  const known = rows.some(a => a.id === value);
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300">{promo ? 'Promotional test' : 'Test'}</span>
      <select className={`${FIELD} ${error ? FIELD_ERR : ''}`} value={value} onChange={e => onChange(e.target.value)} disabled={isLoading}>
        <option value="">{isLoading ? 'Loading tests…' : 'Choose a test'}</option>
        {value && !known && !isLoading && <option value={value}>{value}</option>}
        {rows.map(a => (
          <option key={a.id} value={a.id}>{a.title}</option>
        ))}
      </select>
      {!isLoading && rows.length === 0 && <span className="mt-0.5 block text-[11px] text-gray-400">No {promo ? 'promotional ' : ''}tests yet.</span>}
      {error && <span className="mt-0.5 block text-[11px] text-red-600">{error}</span>}
    </label>
  );
}

/** Where a tap on the banner goes: a screen, and — for the ones that need it — the exam, stage, test or address, picked not typed. */
function TargetFields({ b, onChange, error }: { b: AppBanner; onChange: (patch: Partial<AppBanner>) => void; error?: string }) {
  const needs = needsOf(b.target);
  const exam = BANNER_EXAMS.find(e => e.id === b.exam_id);
  const knownTarget = BANNER_TARGETS.some(t => t.value === b.target);

  const examSelect = (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300">Exam</span>
      <select
        className={`${FIELD} ${error && !b.exam_id ? FIELD_ERR : ''}`}
        value={b.exam_id}
        // A stage belongs to its exam, so a different exam starts the stage afresh.
        onChange={e => onChange({ exam_id: e.target.value, stage_id: '' })}
      >
        <option value="">Choose an exam</option>
        {b.exam_id && !exam && <option value={b.exam_id}>{b.exam_id}</option>}
        {BANNER_EXAMS.map(e => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block min-w-0">
        <span className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300">When tapped, open</span>
        <select className={FIELD} value={b.target} onChange={e => onChange({ target: e.target.value, exam_id: '', stage_id: '', assessment_id: '', url: '' })}>
          {!knownTarget && <option value={b.target}>{b.target}</option>}
          {BANNER_TARGETS.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </label>

      {needs === 'exam' && examSelect}
      {needs === 'exam_stage' && (
        <>
          {examSelect}
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300">Stage</span>
            <select
              className={`${FIELD} ${error && b.exam_id && !b.stage_id ? FIELD_ERR : ''}`}
              value={b.stage_id}
              onChange={e => onChange({ stage_id: e.target.value })}
              disabled={!b.exam_id}
            >
              <option value="">{b.exam_id ? 'Choose a stage' : 'Choose the exam first'}</option>
              {b.stage_id && !exam?.stages.some(s => s.id === b.stage_id) && b.exam_id && <option value={b.stage_id}>{b.stage_id}</option>}
              {(exam?.stages ?? []).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        </>
      )}
      {(needs === 'test' || needs === 'promo_test') && (
        <TestPicker value={b.assessment_id} promo={needs === 'promo_test'} onChange={id => onChange({ assessment_id: id })} error={error} />
      )}
      {needs === 'url' && (
        <Text label="Web address" value={b.url} onChange={v => onChange({ url: v })} placeholder="https://" error={error} />
      )}
      {error && (needs === 'exam' || needs === 'exam_stage') && <p className="text-[11px] text-red-600 sm:col-span-2">{error}</p>}
    </div>
  );
}

/**
 * The mobile app's dashboard banners: a picture, a few words, a colour, a button and where a tap goes — for everyone, free users or
 * paid users, optionally between two dates. They go into the app-config document with the rest, so Save sends the whole list.
 */
export function DashboardBannersEditor({
  banners,
  errors,
  onChange,
  section,
  rowBox,
}: {
  banners: AppBanner[];
  errors: Record<string, string>;
  onChange: (next: AppBanner[]) => void;
  section: string;
  rowBox: string;
}) {
  const edit = (i: number, patch: Partial<AppBanner>) => onChange(banners.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const active = banners.filter(b => b.is_active).length;
  const full = banners.length >= BANNER_LIMITS.max_saved;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className={section}>
          Dashboard banners{' '}
          <span className="font-normal normal-case tracking-normal text-gray-400">
            · {banners.length}/{BANNER_LIMITS.max_saved} saved · {active}/{BANNER_LIMITS.max_active} on
          </span>
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 disabled:opacity-40"
          disabled={full}
          onClick={() => onChange([...banners, newBanner()])}
        >
          <Plus className="h-3.5 w-3.5" /> Add banner
        </button>
      </div>
      <p className="text-[11px] text-gray-400">
        The cards at the top of the app's dashboard, in this order. Up to {BANNER_LIMITS.max_active} can be on at once; a banner that is off, or outside its dates, is hidden.
      </p>
      {errors.banners && <p className="text-[11px] text-red-600">{errors.banners}</p>}
      {banners.length === 0 && <p className="text-xs text-gray-400">No banners yet.</p>}

      {banners.map((b, i) => {
        const err = (f: string) => errors[`banner.${i}.${f}`];
        return (
          <div key={b.id} className={`${rowBox} ${b.is_active ? '' : 'opacity-60'}`}>
            <BannerPreview b={b} />
            <PictureField
              url={b.image_url}
              label={`Banner ${i + 1}`}
              onChange={url => edit(i, { image_url: url })}
              types={BANNER_IMAGE.types}
              advice={BANNER_IMAGE.advice}
              check={bannerImageProblem}
              upload={uploadBannerImage}
              thumbClass="h-16 w-40"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Text label="Title" value={b.title} onChange={v => edit(i, { title: v })} max={BANNER_LIMITS.title} error={err('title')} placeholder="Start your mock test series" />
              <Text label="Tamil title (optional)" value={b.title_ta} onChange={v => edit(i, { title_ta: v })} />
              <Text label="Subtitle (optional)" value={b.subtitle} onChange={v => edit(i, { subtitle: v })} max={BANNER_LIMITS.subtitle} error={err('subtitle')} />
              <Text label="Tamil subtitle (optional)" value={b.subtitle_ta} onChange={v => edit(i, { subtitle_ta: v })} />
              <Text label="Button text (optional)" value={b.button_text} onChange={v => edit(i, { button_text: v })} max={BANNER_LIMITS.button_text} error={err('button_text')} placeholder="Start now" />
              <Text label="Tamil button text (optional)" value={b.button_text_ta} onChange={v => edit(i, { button_text_ta: v })} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block min-w-0">
                <span className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300">Background colour</span>
                <span className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Pick the background colour"
                    className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-700"
                    value={/^#[0-9a-fA-F]{6}$/.test(b.background_color) ? b.background_color : '#1E3A8A'}
                    onChange={e => edit(i, { background_color: e.target.value.toUpperCase() })}
                  />
                  <input
                    className={`${FIELD} ${err('background_color') ? FIELD_ERR : ''}`}
                    value={b.background_color}
                    onChange={e => edit(i, { background_color: e.target.value })}
                    placeholder="#1E3A8A"
                    maxLength={7}
                  />
                </span>
                {err('background_color') && <span className="mt-0.5 block text-[11px] text-red-600">{err('background_color')}</span>}
              </label>

              <div className="min-w-0">
                <span className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300">Text colour</span>
                <div className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700" role="radiogroup" aria-label="Text colour">
                  {(['light', 'dark'] as const).map(tone => (
                    <button
                      key={tone}
                      type="button"
                      role="radio"
                      aria-checked={b.text_color === tone}
                      onClick={() => edit(i, { text_color: tone })}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                        b.text_color === tone ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'text-gray-500'
                      }`}
                    >
                      {tone === 'light' ? 'Light text' : 'Dark text'}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block min-w-0">
                <span className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300">Shown to</span>
                <select className={FIELD} value={b.audience} onChange={e => edit(i, { audience: e.target.value as AppBanner['audience'] })}>
                  {BANNER_AUDIENCES.map(a => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block min-w-0">
                <span className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300">Starts (Indian time, optional)</span>
                <input type="datetime-local" className={FIELD} value={b.starts_at} onChange={e => edit(i, { starts_at: e.target.value })} />
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300">Ends (Indian time, optional)</span>
                <input type="datetime-local" className={`${FIELD} ${err('ends_at') ? FIELD_ERR : ''}`} value={b.ends_at} onChange={e => edit(i, { ends_at: e.target.value })} />
                {err('ends_at') && <span className="mt-0.5 block text-[11px] text-red-600">{err('ends_at')}</span>}
              </label>
            </div>

            <TargetFields b={b} onChange={patch => edit(i, patch)} error={err('target')} />

            <RowTools
              what={`banner ${i + 1}`}
              index={i}
              count={banners.length}
              active={b.is_active}
              onActive={v => edit(i, { is_active: v })}
              onMove={to => onChange(move(banners, i, to))}
              onRemove={() => onChange(banners.filter((_, j) => j !== i))}
            />
          </div>
        );
      })}
    </div>
  );
}
