import { describe, expect, it } from 'vitest';
import {
  BANNER_TARGETS,
  bannerImageProblem,
  isoToIstLocal,
  istLocalToIso,
  newBanner,
  paramsOf,
  parseBanners,
  toBannersBody,
  validateBanners,
  type AppBanner,
} from './dashboard-banners';
import { parseAppConfig, toAppConfigBody } from './app-config';

const banner = (patch: Partial<AppBanner> = {}): AppBanner => ({ ...newBanner(), id: 'bn-1', title: 'Start your mock series', ...patch });

describe('dates in Indian time', () => {
  it('turns the +05:30 wire form into the box value and back', () => {
    expect(isoToIstLocal('2026-12-01T09:00:00+05:30')).toBe('2026-12-01T09:00');
    expect(istLocalToIso('2026-12-01T09:00')).toBe('2026-12-01T09:00:00+05:30');
  });
  it('reads a UTC time as Indian time', () => {
    expect(isoToIstLocal('2026-12-01T03:30:00Z')).toBe('2026-12-01T09:00');
  });
  it('empty or odd values are no date', () => {
    expect(isoToIstLocal(null)).toBe('');
    expect(isoToIstLocal('nope')).toBe('');
    expect(istLocalToIso('')).toBeNull();
  });
});

describe('reading the server list', () => {
  it('keeps the saved order, fills defaults, and flattens target_params', () => {
    const rows = parseBanners([
      { id: 'b', title: 'B', order: 2, target: 'mock_tests', target_params: { exam_id: 'group-4', stage_id: 'g4' }, audience: 'paid', text_color: 'dark', background_color: '#112233', is_active: false },
      { id: 'a', title: 'A', order: 1, subtitle: null, starts_at: '2026-12-01T09:00:00+05:30' },
    ]);
    expect(rows.map(r => r.id)).toEqual(['a', 'b']);
    expect(rows[0]).toMatchObject({ subtitle: '', target: 'dashboard', audience: 'all', text_color: 'light', is_active: true, starts_at: '2026-12-01T09:00' });
    expect(rows[1]).toMatchObject({ exam_id: 'group-4', stage_id: 'g4', audience: 'paid', text_color: 'dark', background_color: '#112233', is_active: false });
  });
  it('an app config without banners has none', () => {
    expect(parseAppConfig({}).dashboard_banners).toEqual([]);
  });
});

describe('what is sent', () => {
  it('sends every field, order = position, empty optional boxes as null, the colour upper-case', () => {
    const [w] = toBannersBody([banner({ background_color: '#1e3a8a', starts_at: '2026-12-01T09:00' })]);
    expect(Object.keys(w).sort()).toEqual([
      'audience', 'background_color', 'button_text', 'button_text_ta', 'ends_at', 'id', 'image_url', 'is_active', 'order', 'starts_at',
      'subtitle', 'subtitle_ta', 'target', 'target_params', 'text_color', 'title', 'title_ta',
    ]);
    expect(w).toMatchObject({ order: 1, subtitle: null, button_text: null, image_url: null, ends_at: null, starts_at: '2026-12-01T09:00:00+05:30', background_color: '#1E3A8A', target_params: {} });
  });
  it('target_params carries only what the target uses — a changed target leaves no stale id', () => {
    const stale = { exam_id: 'group-4', stage_id: 'g4', assessment_id: 'x1', url: 'https://old' };
    expect(paramsOf(banner({ ...stale, target: 'dashboard' }))).toEqual({});
    expect(paramsOf(banner({ ...stale, target: 'exam' }))).toEqual({ exam_id: 'group-4' });
    expect(paramsOf(banner({ ...stale, target: 'mock_tests' }))).toEqual({ exam_id: 'group-4', stage_id: 'g4' });
    expect(paramsOf(banner({ ...stale, target: 'practice_tests' }))).toEqual({ exam_id: 'group-4', stage_id: 'g4' });
    expect(paramsOf(banner({ ...stale, target: 'test' }))).toEqual({ assessment_id: 'x1' });
    expect(paramsOf(banner({ ...stale, target: 'promotional_test' }))).toEqual({ assessment_id: 'x1' });
    expect(paramsOf(banner({ ...stale, target: 'url' }))).toEqual({ url: 'https://old' });
  });
  it('an empty list is sent as [] so the admin can remove every banner', () => {
    expect(toAppConfigBody({ ...parseAppConfig({}), dashboard_banners: [] }).dashboard_banners).toEqual([]);
  });
  it('offers the twenty targets', () => {
    expect(BANNER_TARGETS).toHaveLength(20);
  });
});

describe('validation', () => {
  it('a plain banner is fine', () => {
    expect(validateBanners([banner()])).toEqual({});
    expect(validateBanners([])).toEqual({});
  });
  it('title is required (80); subtitle 120; button 24', () => {
    const e = validateBanners([banner({ title: ' ' }), banner({ title: 'x'.repeat(81), subtitle: 'x'.repeat(121), button_text: 'x'.repeat(25) })]);
    expect(e['banner.0.title']).toMatch(/title/);
    expect(e['banner.1.title']).toMatch(/80/);
    expect(e['banner.1.subtitle']).toMatch(/120/);
    expect(e['banner.1.button_text']).toMatch(/24/);
    expect(validateBanners([banner({ title: 'x'.repeat(80), subtitle: 'x'.repeat(120), button_text: 'x'.repeat(24) })])).toEqual({});
  });
  it('the colour must be #RRGGBB', () => {
    expect(validateBanners([banner({ background_color: 'blue' })])['banner.0.background_color']).toBeTruthy();
    expect(validateBanners([banner({ background_color: '#abc' })])['banner.0.background_color']).toBeTruthy();
    expect(validateBanners([banner({ background_color: '#aBc123' })])).toEqual({});
  });
  it('each target needs its picks', () => {
    expect(validateBanners([banner({ target: 'exam' })])['banner.0.target']).toMatch(/exam/);
    expect(validateBanners([banner({ target: 'mock_tests', exam_id: 'group-4' })])['banner.0.target']).toMatch(/stage/);
    expect(validateBanners([banner({ target: 'mock_tests', exam_id: 'group-4', stage_id: 'g4' })])).toEqual({});
    expect(validateBanners([banner({ target: 'test' })])['banner.0.target']).toMatch(/test/);
    expect(validateBanners([banner({ target: 'promotional_test', assessment_id: 'a1' })])).toEqual({});
  });
  it('a web address must start with https://', () => {
    expect(validateBanners([banner({ target: 'url', url: 'http://x.com' })])['banner.0.target']).toMatch(/https/);
    expect(validateBanners([banner({ target: 'url', url: 'x.com' })])['banner.0.target']).toMatch(/https/);
    expect(validateBanners([banner({ target: 'url', url: 'https://mygovexams.com/offer' })])).toEqual({});
  });
  it('the end must be after the start', () => {
    expect(validateBanners([banner({ starts_at: '2026-12-02T09:00', ends_at: '2026-12-01T09:00' })])['banner.0.ends_at']).toBeTruthy();
    expect(validateBanners([banner({ starts_at: '2026-12-01T09:00', ends_at: '2026-12-01T09:00' })])['banner.0.ends_at']).toBeTruthy();
    expect(validateBanners([banner({ starts_at: '2026-12-01T09:00', ends_at: '2026-12-02T09:00' })])).toEqual({});
    expect(validateBanners([banner({ ends_at: '2026-12-02T09:00' })])).toEqual({});
  });
  it('at most 6 on, at most 20 saved — a switched-off banner does not count toward the 6', () => {
    const on = (n: number) => Array.from({ length: n }, (_, i) => banner({ id: `b${i}` }));
    expect(validateBanners(on(6)).banners).toBeUndefined();
    expect(validateBanners(on(7)).banners).toMatch(/6/);
    expect(validateBanners([...on(6), banner({ id: 'off', is_active: false })]).banners).toBeUndefined();
    expect(validateBanners(Array.from({ length: 21 }, (_, i) => banner({ id: `b${i}`, is_active: false }))).banners).toMatch(/20/);
    expect(validateBanners(Array.from({ length: 20 }, (_, i) => banner({ id: `b${i}`, is_active: false }))).banners).toBeUndefined();
  });
});

describe('the picture', () => {
  it('takes PNG, JPEG and WebP up to 1 MB', () => {
    expect(bannerImageProblem({ type: 'image/png', size: 200_000 })).toBeNull();
    expect(bannerImageProblem({ type: 'image/gif', size: 100 })).toMatch(/PNG/);
    expect(bannerImageProblem({ type: 'image/webp', size: 1024 * 1024 + 1 })).toMatch(/1 MB/);
  });
});
