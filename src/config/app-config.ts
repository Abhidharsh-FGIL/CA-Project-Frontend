/**
 * What the mobile app shows before sign-in: the tagline, the exam chips, the highlights and the login text.
 * Edited under Admin Settings; `GET` / `PUT /api/v1/admin/app-config` carry it, and `PUT` replaces the whole document.
 *
 * The form holds Tamil text as a plain string ('' for none); the wire carries `null`.
 */
export interface AppChip {
  id: string;
  label: string;
  label_ta: string;
  is_active: boolean;
}

export interface AppHighlight {
  icon: string;
  title: string;
  title_ta: string;
  is_active: boolean;
}

/** One onboarding slide. `image_url` is what the image upload returned ('' for none). */
export interface AppSlide {
  title: string;
  title_ta: string;
  subtitle: string;
  subtitle_ta: string;
  image_url: string;
  is_active: boolean;
}

export interface AppConfig {
  tagline: string;
  tagline_ta: string;
  exam_chips: AppChip[];
  highlights: AppHighlight[];
  onboarding_slides: AppSlide[];
  login_title: string;
  login_title_ta: string;
  login_subtitle: string;
  login_subtitle_ta: string;
}

export const EMPTY_APP_CONFIG: AppConfig = {
  tagline: '',
  tagline_ta: '',
  exam_chips: [],
  highlights: [],
  onboarding_slides: [],
  login_title: '',
  login_title_ta: '',
  login_subtitle: '',
  login_subtitle_ta: '',
};

/** The icons the app has artwork for. A saved icon outside this list is kept and still offered. */
export const HIGHLIGHT_ICONS: Array<{ value: string; label: string }> = [
  { value: 'mock_tests', label: 'Mock tests' },
  { value: 'practice', label: 'Practice' },
  { value: 'previous_papers', label: 'Previous papers' },
  { value: 'ai_reports', label: 'AI reports' },
];

/** The server's limits, in characters. It answers 422 beyond them. */
export const APP_LIMITS = {
  tagline: 80,
  tagline_ta: 120,
  login_title: 60,
  login_title_ta: 90,
  login_subtitle: 160,
  login_subtitle_ta: 240,
  chip_id: 64,
  chip_label: 40,
  chip_label_ta: 60,
  icon: 40,
  highlight_title: 60,
  highlight_title_ta: 90,
  max_chips: 12,
  max_highlights: 12,
  slide_title: 120,
  slide_subtitle: 400,
  max_slides: 8,
} as const;

/** The slide picture: what the server accepts and what we recommend. */
export const SLIDE_IMAGE = {
  types: ['image/png', 'image/jpeg', 'image/webp'],
  maxBytes: 1024 * 1024,
  advice: 'Portrait or square, about 1080 × 1200 px, with no text inside the picture. PNG, JPEG or WebP, up to 1 MB.',
} as const;

/** Why this file cannot be a slide picture, or null when it can. */
export function slideImageProblem(file: { type: string; size: number }): string | null {
  if (!(SLIDE_IMAGE.types as readonly string[]).includes(file.type)) return 'Use a PNG, JPEG or WebP picture.';
  if (file.size > SLIDE_IMAGE.maxBytes) return `The picture is over 1 MB (${(file.size / 1024 / 1024).toFixed(1)} MB). Make it smaller.`;
  return null;
}

const SLUG = /^[a-z0-9_-]+$/;
const len = (s: string) => [...s].length;
const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const byOrder = <T extends { order?: unknown }>(rows: T[]): T[] =>
  rows
    .map((r, i) => ({ r, i, o: typeof r.order === 'number' ? r.order : Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.o - b.o || a.i - b.i)
    .map(x => x.r);

const records = (v: unknown): Array<Record<string, unknown>> =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];

/** The server's document as a form value. Missing or odd fields become empty ones; rows come back in their saved order. */
export function parseAppConfig(raw: unknown): AppConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    tagline: text(r.tagline),
    tagline_ta: text(r.tagline_ta),
    login_title: text(r.login_title),
    login_title_ta: text(r.login_title_ta),
    login_subtitle: text(r.login_subtitle),
    login_subtitle_ta: text(r.login_subtitle_ta),
    onboarding_slides: byOrder(records(r.onboarding_slides)).map(sl => ({
      title: text(sl.title),
      title_ta: text(sl.title_ta),
      subtitle: text(sl.subtitle),
      subtitle_ta: text(sl.subtitle_ta),
      image_url: text(sl.image_url),
      is_active: sl.is_active !== false,
    })),
    exam_chips: byOrder(records(r.exam_chips)).map(c => ({
      id: text(c.id),
      label: text(c.label),
      label_ta: text(c.label_ta),
      is_active: c.is_active !== false,
    })),
    highlights: byOrder(records(r.highlights)).map(h => ({
      icon: text(h.icon),
      title: text(h.title),
      title_ta: text(h.title_ta),
      is_active: h.is_active !== false,
    })),
  };
}

const orNull = (s: string): string | null => (s.trim() === '' ? null : s.trim());

/**
 * The form as the server's body: every field, no others. `order` is each row's position (1, 2, 3…) and an empty Tamil box
 * goes as null.
 */
export function toAppConfigBody(c: AppConfig) {
  return {
    tagline: c.tagline.trim(),
    tagline_ta: orNull(c.tagline_ta),
    exam_chips: c.exam_chips.map((chip, i) => ({
      id: chip.id.trim(),
      label: chip.label.trim(),
      label_ta: orNull(chip.label_ta),
      order: i + 1,
      is_active: chip.is_active,
    })),
    highlights: c.highlights.map((h, i) => ({
      icon: h.icon.trim(),
      title: h.title.trim(),
      title_ta: orNull(h.title_ta),
      order: i + 1,
      is_active: h.is_active,
    })),
    onboarding_slides: c.onboarding_slides.map((sl, i) => ({
      title: sl.title.trim(),
      title_ta: orNull(sl.title_ta),
      subtitle: sl.subtitle.trim(),
      subtitle_ta: orNull(sl.subtitle_ta),
      image_url: orNull(sl.image_url),
      order: i + 1,
      is_active: sl.is_active,
    })),
    login_title: c.login_title.trim(),
    login_title_ta: orNull(c.login_title_ta),
    login_subtitle: c.login_subtitle.trim(),
    login_subtitle_ta: orNull(c.login_subtitle_ta),
  };
}

/** What is wrong with the form, by field: `tagline`, `login_title_ta`, `chip.2.id`, `highlight.0.title`, `slide.1.title`, … (and `chips` / `highlights` / `slides` for the lists). */
export function validateAppConfig(c: AppConfig): Record<string, string> {
  const errors: Record<string, string> = {};
  const over = (key: string, value: string, max: number) => {
    if (len(value.trim()) > max) errors[key] = `At most ${max} characters (${len(value.trim())} now).`;
  };

  over('tagline', c.tagline, APP_LIMITS.tagline);
  over('tagline_ta', c.tagline_ta, APP_LIMITS.tagline_ta);
  over('login_title', c.login_title, APP_LIMITS.login_title);
  over('login_title_ta', c.login_title_ta, APP_LIMITS.login_title_ta);
  over('login_subtitle', c.login_subtitle, APP_LIMITS.login_subtitle);
  over('login_subtitle_ta', c.login_subtitle_ta, APP_LIMITS.login_subtitle_ta);

  if (c.exam_chips.length > APP_LIMITS.max_chips) errors.chips = `At most ${APP_LIMITS.max_chips} exam chips.`;
  if (c.highlights.length > APP_LIMITS.max_highlights) errors.highlights = `At most ${APP_LIMITS.max_highlights} highlights.`;

  const seen = new Set<string>();
  c.exam_chips.forEach((chip, i) => {
    const id = chip.id.trim();
    if (!id) errors[`chip.${i}.id`] = 'Give the chip an id.';
    else if (!SLUG.test(id)) errors[`chip.${i}.id`] = 'Lowercase letters, digits, - or _ only.';
    else if (len(id) > APP_LIMITS.chip_id) errors[`chip.${i}.id`] = `At most ${APP_LIMITS.chip_id} characters.`;
    else if (seen.has(id)) errors[`chip.${i}.id`] = 'Another chip already has this id.';
    seen.add(id);
    if (!chip.label.trim()) errors[`chip.${i}.label`] = 'Give the chip a label.';
    else over(`chip.${i}.label`, chip.label, APP_LIMITS.chip_label);
    over(`chip.${i}.label_ta`, chip.label_ta, APP_LIMITS.chip_label_ta);
  });

  c.highlights.forEach((h, i) => {
    const icon = h.icon.trim();
    if (!icon) errors[`highlight.${i}.icon`] = 'Choose an icon.';
    else if (!SLUG.test(icon) || len(icon) > APP_LIMITS.icon) errors[`highlight.${i}.icon`] = 'Lowercase letters, digits, - or _ only.';
    if (!h.title.trim()) errors[`highlight.${i}.title`] = 'Give the highlight a title.';
    else over(`highlight.${i}.title`, h.title, APP_LIMITS.highlight_title);
    over(`highlight.${i}.title_ta`, h.title_ta, APP_LIMITS.highlight_title_ta);
  });

  if (c.onboarding_slides.length > APP_LIMITS.max_slides) errors.slides = `At most ${APP_LIMITS.max_slides} slides.`;
  c.onboarding_slides.forEach((sl, i) => {
    if (!sl.title.trim()) errors[`slide.${i}.title`] = 'Give the slide a title.';
    else over(`slide.${i}.title`, sl.title, APP_LIMITS.slide_title);
    over(`slide.${i}.subtitle`, sl.subtitle, APP_LIMITS.slide_subtitle);
  });

  return errors;
}
