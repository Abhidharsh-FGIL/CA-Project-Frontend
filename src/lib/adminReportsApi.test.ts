import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setTokens } from '@/lib/api';
import {
  EXPORT_LIMIT,
  attemptsReportApi,
  dateRangeBackwards,
  downloadAttemptsReport,
  examGroupLabel,
  hasFilters,
  reportFileName,
  reportQuery,
} from '@/lib/adminReportsApi';

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

describe('reportQuery', () => {
  it('has only the filters that are filled in', () => {
    expect(reportQuery({})).toBe('');
    expect(reportQuery({ test_type: '', exam_group: '', search: '   ' })).toBe('');
    expect(reportQuery({ exam_group: 'group-4', test_type: 'mock', date_from: '2026-10-01', date_to: '2026-10-31' })).toBe(
      '?date_from=2026-10-01&date_to=2026-10-31&test_type=mock&exam_group=group-4',
    );
  });

  it('trims the search and appends page and limit', () => {
    expect(reportQuery({ search: '  Aravindh ' }, { page: 2, limit: 50 })).toBe('?search=Aravindh&page=2&limit=50');
  });

  it('encodes a search that has symbols in it', () => {
    expect(reportQuery({ search: 'a+b@x.com' })).toBe('?search=a%2Bb%40x.com');
  });
});

describe('the date range and filters', () => {
  it('notices a range running backwards, and accepts the same day or an open end', () => {
    expect(dateRangeBackwards({ date_from: '2026-10-31', date_to: '2026-10-01' })).toBe(true);
    expect(dateRangeBackwards({ date_from: '2026-10-05', date_to: '2026-10-05' })).toBe(false);
    expect(dateRangeBackwards({ date_from: '2026-10-05' })).toBe(false);
    expect(dateRangeBackwards({})).toBe(false);
  });

  it('knows when a filter is set', () => {
    expect(hasFilters({})).toBe(false);
    expect(hasFilters({ search: '  ' })).toBe(false);
    expect(hasFilters({ exam_group: 'gat-b' })).toBe(true);
  });
});

describe('names', () => {
  it('names the download for the day in IST', () => {
    // 18:45 UTC on 1 Nov is already 2 Nov in India.
    expect(reportFileName(new Date('2026-11-01T18:45:00Z'))).toBe('attempts_report_2026-11-02.xlsx');
    expect(reportFileName(new Date('2026-11-02T05:00:00Z'))).toBe('attempts_report_2026-11-02.xlsx');
  });

  it('spells the exam groups as the sheet does, and passes an unknown one through', () => {
    expect(examGroupLabel('group-4')).toBe('Group 4');
    expect(examGroupLabel('gat-b')).toBe('GAT-B');
    expect(examGroupLabel('other')).toBe('Other');
    expect(examGroupLabel('group-9')).toBe('group-9');
    expect(examGroupLabel(null)).toBe('—');
  });

  it('knows how many rows one Excel sheet may hold', () => {
    expect(EXPORT_LIMIT).toBe(50_000);
  });
});

describe('asking the server', () => {
  it('lists with the filters, the page and the size, as the admin', async () => {
    await attemptsReportApi.list({ exam_group: 'group-4', test_type: 'mock', date_from: '2026-10-01' }, 3, 100);
    expect(lastUrl()).toMatch(/\/api\/v1\/admin\/reports\/attempts\?date_from=2026-10-01&test_type=mock&exam_group=group-4&page=3&limit=100$/);
    const headers = fetchMock.mock.calls.at(-1)?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer admin-token');
  });

  it('never asks for more than 500 rows a page', async () => {
    await attemptsReportApi.list({}, 1, 5000);
    expect(lastUrl()).toMatch(/page=1&limit=500$/);
  });

  it('exports with the same filters and no page', () => {
    expect(attemptsReportApi.exportPath({ exam_group: 'gat-b' })).toBe('/api/v1/admin/reports/attempts/export?exam_group=gat-b');
    expect(attemptsReportApi.exportPath({})).toBe('/api/v1/admin/reports/attempts/export');
  });

  it('says what the server said when it refuses a download', async () => {
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ detail: { code: 'EXPORT_TOO_LARGE', message: 'Too many rows to export. Narrow the filters.' } }), { status: 422 }),
    );
    await expect(downloadAttemptsReport({})).rejects.toThrow('Too many rows to export. Narrow the filters.');
  });
});
