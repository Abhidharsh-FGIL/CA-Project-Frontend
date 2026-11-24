/**
 * The mobile app's dashboard banners, edited under Admin → App config next to the onboarding slides. They travel inside the
 * app-config document (`dashboard_banners`), so `GET` / `PUT /api/v1/admin/app-config` carry them and `PUT` replaces the list.
 *
 * The form holds a banner flat: where a tap goes is a `target` plus the one to three ids that target needs, so nobody types
 * an id by hand. On the wire the ids become `target_params`, with only the keys that target uses.
 */
import { TNPSC_GROUPS } from '@/config/tnpsc';

export type BannerTone = 'light' | 'dark';
export type BannerAudience = 'all' | 'free' | 'paid';

/** What a target needs the admin to pick. */
export type BannerNeeds = 'none' | 'exam' | 'exam_stage' | 'test' | 'promo_test' | 'url';

export const BANNER_TARGETS: Array<{ value: string; label: string; needs: BannerNeeds }> = [
  { value: 'dashboard', label: 'Dashboard', needs: 'none' },
  { value: 'exams', label: 'Exams list', needs: 'none' },
  { value: 'exam', label: 'One exam', needs: 'exam' },
  { value: 'mock_tests', label: 'Mock tests of an exam stage', needs: 'exam_stage' },
  { value: 'practice_tests', label: 'Practice tests of an exam stage', needs: 'exam_stage' },
  { value: 'test', label: 'One test', needs: 'test' },
  { value: 'promotional_test', label: 'One promotional test', needs: 'promo_test' },
  { value: 'performance', label: 'Performance', needs: 'none' },
  { value: 'history', label: 'History', needs: 'none' },
  { value: 'plans', label: 'Plans', needs: 'none' },
  { value: 'topup', label: 'Top-up', needs: 'none' },
  { value: 'referral', label: 'Referral', needs: 'none' },
  { value: 'study_plan', label: 'Study plan', needs: 'none' },
  { value: 'ai_coach', label: 'AI coach', needs: 'none' },
  { value: 'search', label: 'Search', needs: 'none' },
  { value: 'notifications', label: 'Notifications', needs: 'none' },
  { value: 'profile', label: 'Profile', needs: 'none' },
  { value: 'payment_history', label: 'Payment history', needs: 'none' },
  { value: 'feedback', label: 'Feedback', needs: 'none' },
  { value: 'url', label: 'A web address', needs: 'url' },
];

export const needsOf = (target: string): BannerNeeds => BANNER_TARGETS.find(t => t.value === target)?.needs ?? 'none';

export const BANNER_AUDIENCES: Array<{ value: BannerAudience; label: string }> = [
  { value: 'all', label: 'Everyone' },
  { value: 'free', label: 'Free users' },
  { value: 'paid', label: 'Paid users' },
];

export const BANNER_LIMITS = {
  title: 80,
  subtitle: 120,
  button_text: 24,
  max_active: 6,
  max_saved: 20,
} as const;

/** The banner picture: what the server accepts and what we recommend. */
export const BANNER_IMAGE = {
  types: ['image/png', 'image/jpeg', 'image/webp'],
  maxBytes: 1024 * 1024,
  advice: '1200 × 480 px, under 300 KB. Keep the left 60% calm (the words sit there) and put no text in the picture. PNG, JPEG or WebP, up to 1 MB.',
} as const;

export interface AppBanner {
  /** The server's id for a saved banner; a new one gets a local id until it is saved. */
  id: string;
  title: string;
  title_ta: string;
  subtitle: string;
  subtitle_ta: string;
  button_text: string;
  button_text_ta: string;
  /** What the banner upload returned ('' for none). */
  image_url: string;
  /** #RRGGBB. */
  background_color: string;
  text_color: BannerTone;
  target: string;
  exam_id: string;
  stage_id: string;
  assessment_id: string;
  url: string;
  audience: BannerAudience;
  /** Indian time, `YYYY-MM-DDTHH:mm` as a date-time box holds it ('' for none). */
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

export const DEFAULT_BANNER_COLOR = '#1E3A8A';

const localId = () => `bn-${Math.random().toString(36).slice(2, 10)}`;

export const newBanner = (): AppBanner => ({
  id: localId(),
  title: '',
  title_ta: '',
  subtitle: '',
  subtitle_ta: '',
  button_text: '',
  button_text_ta: '',
  image_url: '',
  background_color: DEFAULT_BANNER_COLOR,
  text_color: 'light',
  target: 'dashboard',
  exam_id: '',
  stage_id: '',
  assessment_id: '',
  url: '',
  audience: 'all',
  starts_at: '',
  ends_at: '',
  is_active: true,
});

// ── Dates: the box shows Indian time, the wire carries ISO 8601 with +05:30 ──────────────────────────────────────────

const IST_MINUTES = 330;

/** `2026-12-01T09:00:00+05:30` (or any offset, or Z) → `2026-12-01T09:00` in Indian time. '' when it is not a date. */
export function isoToIstLocal(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  return new Date(t + IST_MINUTES * 60_000).toISOString().slice(0, 16);
}

/** `2026-12-01T09:00` in Indian time → `2026-12-01T09:00:00+05:30`. null when empty or not a date. */
export function istLocalToIso(local: string): string | null {
  if (!local.trim()) return null;
  const iso = `${local.trim()}:00+05:30`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

// ── Wire ⇄ form ─────────────────────────────────────────────────────────────────────────────────────────────────────

const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const orNull = (s: string): string | null => (s.trim() === '' ? null : s.trim());
const records = (v: unknown): Array<Record<string, unknown>> =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];

/** The server's banners as form rows, in their saved order. Missing or odd fields become the form's defaults. */
export function parseBanners(raw: unknown): AppBanner[] {
  const rows = records(raw)
    .map((r, i) => ({ r, i, o: typeof r.order === 'number' ? r.order : Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.o - b.o || a.i - b.i)
    .map(x => x.r);
  return rows.map(r => {
    const params = (r.target_params && typeof r.target_params === 'object' ? r.target_params : {}) as Record<string, unknown>;
    const audience = r.audience === 'free' || r.audience === 'paid' ? r.audience : 'all';
    return {
      id: text(r.id) || localId(),
      title: text(r.title),
      title_ta: text(r.title_ta),
      subtitle: text(r.subtitle),
      subtitle_ta: text(r.subtitle_ta),
      button_text: text(r.button_text),
      button_text_ta: text(r.button_text_ta),
      image_url: text(r.image_url),
      background_color: /^#[0-9a-fA-F]{6}$/.test(text(r.background_color)) ? text(r.background_color) : DEFAULT_BANNER_COLOR,
      text_color: r.text_color === 'dark' ? 'dark' : 'light',
      target: text(r.target) || 'dashboard',
      exam_id: text(params.exam_id),
      stage_id: text(params.stage_id),
      assessment_id: text(params.assessment_id),
      url: text(params.url),
      audience,
      starts_at: isoToIstLocal(r.starts_at),
      ends_at: isoToIstLocal(r.ends_at),
      is_active: r.is_active !== false,
    };
  });
}

/** `target_params` for a banner: only the keys its target uses, so a changed target leaves no stale id behind. */
export function paramsOf(b: AppBanner): Record<string, string> {
  switch (needsOf(b.target)) {
    case 'exam':
      return { exam_id: b.exam_id };
    case 'exam_stage':
      return { exam_id: b.exam_id, stage_id: b.stage_id };
    case 'test':
    case 'promo_test':
      return { assessment_id: b.assessment_id };
    case 'url':
      return { url: b.url.trim() };
    default:
      return {};
  }
}

/** The banners as the server's list: every field, `order` the row's position, an empty optional box as null. */
export function toBannersBody(banners: AppBanner[]) {
  return banners.map((b, i) => ({
    id: b.id,
    title: b.title.trim(),
    title_ta: orNull(b.title_ta),
    subtitle: orNull(b.subtitle),
    subtitle_ta: orNull(b.subtitle_ta),
    button_text: orNull(b.button_text),
    button_text_ta: orNull(b.button_text_ta),
    image_url: orNull(b.image_url),
    background_color: b.background_color.toUpperCase(),
    text_color: b.text_color,
    target: b.target,
    target_params: paramsOf(b),
    audience: b.audience,
    starts_at: istLocalToIso(b.starts_at),
    ends_at: istLocalToIso(b.ends_at),
    order: i + 1,
    is_active: b.is_active,
  }));
}

// ── Validation ──────────────────────────────────────────────────────────────────────────────────────────────────────

const len = (s: string) => [...s.trim()].length;

/** What is wrong with the banners, by field: `banner.0.title`, `banner.2.ends_at`, … and `banners` for the list. */
export function validateBanners(banners: AppBanner[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const over = (key: string, value: string, max: number) => {
    if (len(value) > max) errors[key] = `At most ${max} characters (${len(value)} now).`;
  };

  if (banners.length > BANNER_LIMITS.max_saved) errors.banners = `At most ${BANNER_LIMITS.max_saved} banners can be saved.`;
  else if (banners.filter(b => b.is_active).length > BANNER_LIMITS.max_active) {
    errors.banners = `At most ${BANNER_LIMITS.max_active} banners can be switched on at once.`;
  }

  banners.forEach((b, i) => {
    const k = (f: string) => `banner.${i}.${f}`;
    if (!b.title.trim()) errors[k('title')] = 'Give the banner a title.';
    else over(k('title'), b.title, BANNER_LIMITS.title);
    over(k('subtitle'), b.subtitle, BANNER_LIMITS.subtitle);
    over(k('button_text'), b.button_text, BANNER_LIMITS.button_text);
    if (!/^#[0-9a-fA-F]{6}$/.test(b.background_color)) errors[k('background_color')] = 'Use a colour like #1E3A8A.';

    switch (needsOf(b.target)) {
      case 'exam':
        if (!b.exam_id) errors[k('target')] = 'Pick the exam.';
        break;
      case 'exam_stage':
        if (!b.exam_id) errors[k('target')] = 'Pick the exam.';
        else if (!b.stage_id) errors[k('target')] = 'Pick the stage.';
        break;
      case 'test':
      case 'promo_test':
        if (!b.assessment_id) errors[k('target')] = 'Pick the test.';
        break;
      case 'url':
        if (!/^https:\/\/\S+$/i.test(b.url.trim())) errors[k('target')] = 'The address must start with https://';
        break;
    }

    const start = b.starts_at ? new Date(`${b.starts_at}:00+05:30`).getTime() : null;
    const end = b.ends_at ? new Date(`${b.ends_at}:00+05:30`).getTime() : null;
    if (start !== null && end !== null && !(end > start)) errors[k('ends_at')] = 'The end must be after the start.';
  });

  return errors;
}

/** Why this file cannot be a banner picture, or null when it can. */
export function bannerImageProblem(file: { type: string; size: number }): string | null {
  if (!(BANNER_IMAGE.types as readonly string[]).includes(file.type)) return 'Use a PNG, JPEG or WebP picture.';
  if (file.size > BANNER_IMAGE.maxBytes) return `The picture is over 1 MB (${(file.size / 1024 / 1024).toFixed(1)} MB). Make it smaller.`;
  return null;
}

/** The exams the target pickers offer, with their active stages. Bundled — the same list the other admin pickers use. */
export const BANNER_EXAMS = TNPSC_GROUPS.map(g => ({
  id: g.id as string,
  name: g.name,
  stages: g.stages.filter(s => s.status === 'active').map(s => ({ id: s.id as string, name: s.name })),
}));
