import { describe, expect, it } from 'vitest';
import { EMPTY_APP_CONFIG, parseAppConfig, slideImageProblem, toAppConfigBody, validateAppConfig, type AppConfig } from './app-config';

const good = (): AppConfig => ({
  tagline: 'Practice · Prepare · Succeed',
  tagline_ta: '',
  exam_chips: [
    { id: 'group-4', label: 'TNPSC', label_ta: '', is_active: true },
    { id: 'rrb_ntpc', label: 'RRB NTPC', label_ta: 'ஆர்ஆர்பி', is_active: false },
  ],
  highlights: [{ icon: 'mock_tests', title: 'Full mock tests', title_ta: '', is_active: true }],
  onboarding_slides: [{ title: 'Practice *smarter*', title_ta: '', subtitle: 'Mock tests', subtitle_ta: '', image_url: '/uploads/a.png', is_active: true }],
  dashboard_banners: [],
  login_title: 'Welcome Back',
  login_title_ta: '',
  login_subtitle: 'Enter your registered email ID to get a one-time password',
  login_subtitle_ta: '',
});

describe('app pre-login config', () => {
  it('an empty server document is an empty form, not an error', () => {
    expect(parseAppConfig({ tagline: '', exam_chips: [], highlights: [] })).toEqual(EMPTY_APP_CONFIG);
    expect(parseAppConfig(null)).toEqual(EMPTY_APP_CONFIG);
    expect(parseAppConfig('nope')).toEqual(EMPTY_APP_CONFIG);
  });

  it('reads rows in their saved order, null Tamil as empty, and keeps an inactive row', () => {
    const c = parseAppConfig({
      tagline_ta: null,
      exam_chips: [
        { id: 'b', label: 'B', label_ta: null, order: 2, is_active: false },
        { id: 'a', label: 'A', label_ta: 'அ', order: 1, is_active: true },
      ],
    });
    expect(c.exam_chips.map(x => x.id)).toEqual(['a', 'b']);
    expect(c.exam_chips[1].is_active).toBe(false);
    expect(c.exam_chips[0].label_ta).toBe('அ');
    expect(c.tagline_ta).toBe('');
  });

  it('sends every field and no others; order is the row position and an empty Tamil box is null', () => {
    const body = toAppConfigBody(good());
    expect(Object.keys(body).sort()).toEqual(
      ['dashboard_banners', 'exam_chips', 'highlights', 'login_subtitle', 'login_subtitle_ta', 'login_title', 'login_title_ta', 'onboarding_slides', 'tagline', 'tagline_ta'],
    );
    expect(body.tagline_ta).toBeNull();
    expect(body.exam_chips).toEqual([
      { id: 'group-4', label: 'TNPSC', label_ta: null, order: 1, is_active: true },
      { id: 'rrb_ntpc', label: 'RRB NTPC', label_ta: 'ஆர்ஆர்பி', order: 2, is_active: false },
    ]);
    expect(Object.keys(body.highlights[0]).sort()).toEqual(['icon', 'is_active', 'order', 'title', 'title_ta']);
    expect(body.highlights[0].order).toBe(1);
  });

  it('a good form has nothing wrong with it; an empty one is allowed too', () => {
    expect(validateAppConfig(good())).toEqual({});
    expect(validateAppConfig(EMPTY_APP_CONFIG)).toEqual({});
  });

  it('holds the text to the server’s limits, English and Tamil', () => {
    const c = { ...good(), tagline: 'x'.repeat(81), login_title: 'x'.repeat(61), login_subtitle: 'x'.repeat(161), tagline_ta: 'அ'.repeat(121), login_title_ta: 'அ'.repeat(91), login_subtitle_ta: 'அ'.repeat(241) };
    expect(Object.keys(validateAppConfig(c)).sort()).toEqual(['login_subtitle', 'login_subtitle_ta', 'login_title', 'login_title_ta', 'tagline', 'tagline_ta']);
    expect(validateAppConfig({ ...good(), tagline: 'x'.repeat(80), tagline_ta: 'அ'.repeat(120) })).toEqual({});
  });

  it('chip ids are lowercase slugs, unique; labels and lengths are checked', () => {
    const c = good();
    c.exam_chips = [
      { id: 'Group 4', label: 'A', label_ta: '', is_active: true },
      { id: 'dup', label: 'B', label_ta: '', is_active: true },
      { id: 'dup', label: '', label_ta: '', is_active: true },
      { id: 'y'.repeat(65), label: 'L'.repeat(41), label_ta: 'அ'.repeat(61), is_active: true },
    ];
    const e = validateAppConfig(c);
    expect(e['chip.0.id']).toMatch(/Lowercase/);
    expect(e['chip.1.id']).toBeUndefined();
    expect(e['chip.2.id']).toMatch(/already/);
    expect(e['chip.2.label']).toBeDefined();
    expect(e['chip.3.id']).toBeDefined();
    expect(e['chip.3.label']).toBeDefined();
    expect(e['chip.3.label_ta']).toBeDefined();
  });

  it('holds highlights to their icon slug and title limits, and both lists to 12', () => {
    const c = good();
    c.highlights = [{ icon: 'Bad Icon', title: 'T'.repeat(61), title_ta: 'அ'.repeat(91), is_active: true }];
    const e = validateAppConfig(c);
    expect(e['highlight.0.icon']).toBeDefined();
    expect(e['highlight.0.title']).toBeDefined();
    expect(e['highlight.0.title_ta']).toBeDefined();

    const many = good();
    many.exam_chips = Array.from({ length: 13 }, (_, i) => ({ id: `c${i}`, label: `C${i}`, label_ta: '', is_active: true }));
    many.highlights = Array.from({ length: 13 }, () => ({ icon: 'practice', title: 'T', title_ta: '', is_active: true }));
    const m = validateAppConfig(many);
    expect(m.chips).toBeDefined();
    expect(m.highlights).toBeDefined();
  });

  it('reads slides in order, and sends them with their position, null Tamil and null picture', () => {
    const c = parseAppConfig({
      onboarding_slides: [
        { title: 'B', subtitle: 's', image_url: null, order: 2, is_active: false, title_ta: null, subtitle_ta: null },
        { title: 'A', subtitle: '', image_url: '/u/a.webp', order: 1, is_active: true, title_ta: 'அ', subtitle_ta: null },
      ],
    });
    expect(c.onboarding_slides.map(x => x.title)).toEqual(['A', 'B']);
    expect(c.onboarding_slides[1]).toMatchObject({ image_url: '', is_active: false, title_ta: '' });
    const body = toAppConfigBody(c);
    expect(body.onboarding_slides).toEqual([
      { title: 'A', title_ta: 'அ', subtitle: '', subtitle_ta: null, image_url: '/u/a.webp', order: 1, is_active: true },
      { title: 'B', title_ta: null, subtitle: 's', subtitle_ta: null, image_url: null, order: 2, is_active: false },
    ]);
    expect(toAppConfigBody({ ...c, onboarding_slides: [] }).onboarding_slides).toEqual([]);
  });

  it('a slide needs a title (120) and its subtitle is held to 400; at most 8 slides', () => {
    const slide = { title: 'T', title_ta: '', subtitle: '', subtitle_ta: '', image_url: '', is_active: true };
    const c = { ...good(), onboarding_slides: [{ ...slide, title: '' }, { ...slide, title: 'x'.repeat(121) }, { ...slide, subtitle: 'y'.repeat(401) }, { ...slide, title: 'x'.repeat(120), subtitle: 'y'.repeat(400) }] };
    const e = validateAppConfig(c);
    expect(e['slide.0.title']).toBeDefined();
    expect(e['slide.1.title']).toBeDefined();
    expect(e['slide.2.subtitle']).toBeDefined();
    expect(e['slide.3.title']).toBeUndefined();
    expect(e['slide.3.subtitle']).toBeUndefined();
    expect(validateAppConfig({ ...good(), onboarding_slides: Array.from({ length: 9 }, () => slide) }).slides).toBeDefined();
    expect(validateAppConfig({ ...good(), onboarding_slides: Array.from({ length: 8 }, () => slide) }).slides).toBeUndefined();
  });

  it('accepts PNG, JPEG and WebP up to 1 MB and says why anything else will not do', () => {
    expect(slideImageProblem({ type: 'image/png', size: 1024 * 1024 })).toBeNull();
    expect(slideImageProblem({ type: 'image/webp', size: 10 })).toBeNull();
    expect(slideImageProblem({ type: 'image/gif', size: 10 })).toMatch(/PNG, JPEG or WebP/);
    expect(slideImageProblem({ type: 'image/jpeg', size: 1024 * 1024 + 1 })).toMatch(/1 MB/);
  });
});
