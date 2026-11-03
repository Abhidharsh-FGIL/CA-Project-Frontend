import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setTokens } from '@/lib/api';
import {
  adminFeedbackApi,
  categoryLabel,
  downloadFeedback,
  feedbackApi,
  feedbackDateRangeBackwards,
  feedbackFileName,
  feedbackHasFilters,
  feedbackProblem,
  feedbackQuery,
  statusLabel,
} from '@/lib/feedbackApi';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal('window', { location: { href: '' } });
  fetchMock = vi.fn(async () => json({ items: [], total: 0, page: 1, limit: 50, pages: 1 }));
  vi.stubGlobal('fetch', fetchMock);
  setTokens('admin-token', 'admin-refresh');
});

afterEach(() => vi.unstubAllGlobals());

const lastUrl = () => String(fetchMock.mock.calls.at(-1)?.[0]);
const lastInit = () => fetchMock.mock.calls.at(-1)?.[1] as { method?: string; body?: string };

describe('feedbackProblem', () => {
  it('needs a rating from 1 to 5', () => {
    expect(feedbackProblem({ rating: 0, message: 'Good app overall' })).toMatch(/rating/i);
    expect(feedbackProblem({ rating: 6, message: 'Good app overall' })).toMatch(/rating/i);
    expect(feedbackProblem({ rating: 3.5, message: 'Good app overall' })).toMatch(/rating/i);
    expect(feedbackProblem({ rating: 5, message: 'Good app overall' })).toBeNull();
  });

  it('needs a few words, and not too many', () => {
    expect(feedbackProblem({ rating: 4, message: '   hi ' })).toMatch(/more/i);
    expect(feedbackProblem({ rating: 4, message: 'a'.repeat(1001) })).toMatch(/1000/);
    expect(feedbackProblem({ rating: 4, message: 'a'.repeat(1000) })).toBeNull();
  });
});

describe('feedbackQuery', () => {
  it('has only the filters that are filled in', () => {
    expect(feedbackQuery({})).toBe('');
    expect(feedbackQuery({ rating: '', category: '', status: '', search: '  ' })).toBe('');
    expect(feedbackQuery({ rating: 2, category: 'bug', status: 'new', date_from: '2026-11-01', date_to: '2026-11-02' })).toBe(
      '?date_from=2026-11-01&date_to=2026-11-02&rating=2&category=bug&status=new',
    );
  });

  it('trims and encodes the search, and appends page and limit', () => {
    expect(feedbackQuery({ search: ' a+b@x.com ' }, { page: 2, limit: 50 })).toBe('?search=a%2Bb%40x.com&page=2&limit=50');
  });
});

describe('filters and names', () => {
  it('notices a range running backwards', () => {
    expect(feedbackDateRangeBackwards({ date_from: '2026-11-02', date_to: '2026-11-01' })).toBe(true);
    expect(feedbackDateRangeBackwards({ date_from: '2026-11-02', date_to: '2026-11-02' })).toBe(false);
    expect(feedbackDateRangeBackwards({ date_from: '2026-11-02' })).toBe(false);
  });

  it('knows when a filter is set', () => {
    expect(feedbackHasFilters({})).toBe(false);
    expect(feedbackHasFilters({ search: ' ' })).toBe(false);
    expect(feedbackHasFilters({ rating: 1 })).toBe(true);
  });

  it('names the download for the day in IST', () => {
    expect(feedbackFileName(new Date('2026-11-01T18:45:00Z'))).toBe('feedback_2026-11-02.xlsx');
  });

  it('spells categories and statuses, and passes an unknown one through', () => {
    expect(categoryLabel('bug')).toBe('Something is wrong');
    expect(categoryLabel('weird')).toBe('weird');
    expect(categoryLabel(null)).toBe('—');
    expect(statusLabel('resolved')).toBe('Resolved');
  });
});

describe('asking the server', () => {
  it('sends the feedback trimmed, as the student', async () => {
    fetchMock.mockImplementation(async () => json({ feedback_id: 'f1', rating: 4, category: 'bug', message: 'Broken', status: 'new', created_at: '' }));
    await feedbackApi.send({ rating: 4, category: 'bug', message: '  Broken  ', page: '/user/history' });
    expect(lastUrl()).toMatch(/\/api\/v1\/user\/feedback$/);
    expect(lastInit().method).toBe('POST');
    expect(JSON.parse(lastInit().body!)).toEqual({ rating: 4, category: 'bug', message: 'Broken', page: '/user/history' });
  });

  it('lists the admin view with filters, page and size, and never asks for over 500 rows', async () => {
    await adminFeedbackApi.list({ rating: 1, status: 'new' }, 3, 5000);
    expect(lastUrl()).toMatch(/\/api\/v1\/admin\/feedback\?rating=1&status=new&page=3&limit=500$/);
  });

  it('asks for the summary and the export with the same filters', () => {
    expect(adminFeedbackApi.exportPath({ category: 'bug' })).toBe('/api/v1/admin/feedback/export?category=bug');
    expect(adminFeedbackApi.exportPath({})).toBe('/api/v1/admin/feedback/export');
  });

  it('changes a status with a PATCH', async () => {
    fetchMock.mockImplementation(async () => json({ feedback_id: 'f 1' }));
    await adminFeedbackApi.setStatus('f 1', 'resolved');
    expect(lastUrl()).toMatch(/\/api\/v1\/admin\/feedback\/f%201$/);
    expect(lastInit().method).toBe('PATCH');
    expect(JSON.parse(lastInit().body!)).toEqual({ status: 'resolved' });
  });

  it('says what the server said when it refuses a download', async () => {
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ detail: { code: 'EXPORT_TOO_LARGE', message: 'Too many rows to export. Narrow the filters.' } }), { status: 422 }),
    );
    await expect(downloadFeedback({})).rejects.toThrow('Too many rows to export. Narrow the filters.');
  });
});
