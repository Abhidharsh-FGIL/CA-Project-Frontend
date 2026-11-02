/**
 * Admin → Attempts Report: one row per test attempt (mock and practice), newest first, with the student's details.
 *
 *   GET /api/v1/admin/reports/attempts?date_from=&date_to=&test_type=&exam_group=&search=&page=&limit=
 *   GET /api/v1/admin/reports/attempts/export?<the same filters>        → attempts_report_<date>.xlsx
 *
 * Both need the admin token. The filters are all optional and combine. `date_from` / `date_to` are the IST day the
 * attempt started, inclusive. `total_mock` / `total_practice` are the student's counts within that exam group over
 * all their attempts, so the date filter does not change them. In-progress attempts are included, with no score and
 * no submit time. The export is every matching row in one sheet and is refused above 50,000 rows.
 */
import { api, apiDownload } from './api';
import type { PaginatedResponse } from './adminApi';

export type ReportTestType = 'mock' | 'practice';
export type ReportExamGroup = 'group-4' | 'group-2' | 'group-1' | 'gat-b' | 'other';
export type ReportStatus = 'submitted' | 'timed_out' | 'in_progress';

export interface AttemptReportRow {
  name: string;
  mobile: string | null;
  email: string | null;
  exam_group: string;
  total_mock: number;
  total_practice: number;
  test_type: ReportTestType | string;
  test_name: string | null;
  /** Null while the attempt is in progress. */
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  /** Written by the server as "DD/MM/YY HH:MI:SS am", in IST. */
  started_ist: string | null;
  submitted_ist: string | null;
  time_taken_minutes: number | null;
  status: ReportStatus | string;
  user_id: string;
  attempt_id: string;
  test_id: string;
  /** UTC ISO. */
  started_at: string;
  submitted_at: string | null;
}

export interface AttemptReportFilters {
  /** YYYY-MM-DD, the IST day the attempt started. */
  date_from?: string;
  date_to?: string;
  test_type?: ReportTestType | '';
  exam_group?: ReportExamGroup | '';
  /** Name, email or mobile contains. */
  search?: string;
}

/** The most rows the Excel export accepts; above this the server answers `EXPORT_TOO_LARGE`. */
export const EXPORT_LIMIT = 50_000;
/** The most rows a page may ask for. */
export const MAX_PAGE_SIZE = 500;

export const EXAM_GROUP_LABEL: Record<ReportExamGroup, string> = {
  'group-4': 'Group 4',
  'group-2': 'Group 2',
  'group-1': 'Group 1',
  'gat-b': 'GAT-B',
  other: 'Other',
};

export const EXAM_GROUP_OPTIONS = (Object.keys(EXAM_GROUP_LABEL) as ReportExamGroup[]).map(value => ({
  value,
  label: EXAM_GROUP_LABEL[value],
}));

/** A group as the sheet names it, whatever the server sent. */
export const examGroupLabel = (g: string | null | undefined): string =>
  (g && EXAM_GROUP_LABEL[g as ReportExamGroup]) || g || '—';

/** The query string for a set of filters: only what is filled in, search trimmed, nothing for "all". */
export function reportQuery(filters: AttemptReportFilters, extra: Record<string, string | number> = {}): string {
  const q = new URLSearchParams();
  if (filters.date_from) q.set('date_from', filters.date_from);
  if (filters.date_to) q.set('date_to', filters.date_to);
  if (filters.test_type) q.set('test_type', filters.test_type);
  if (filters.exam_group) q.set('exam_group', filters.exam_group);
  const search = filters.search?.trim();
  if (search) q.set('search', search);
  for (const [k, v] of Object.entries(extra)) q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** True when "from" is after "to": no attempt can match, so the report does not ask. */
export const dateRangeBackwards = (f: Pick<AttemptReportFilters, 'date_from' | 'date_to'>): boolean =>
  !!f.date_from && !!f.date_to && f.date_from > f.date_to;

/** Whether any filter is set. */
export const hasFilters = (f: AttemptReportFilters): boolean =>
  !!(f.date_from || f.date_to || f.test_type || f.exam_group || f.search?.trim());

/** `attempts_report_2026-11-02.xlsx` — the day in IST, as the server names its own download. */
export function reportFileName(now: Date = new Date()): string {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
  return `attempts_report_${day}.xlsx`;
}

export const attemptsReportApi = {
  list: (filters: AttemptReportFilters, page = 1, limit = 50) =>
    api.get<PaginatedResponse<AttemptReportRow>>(
      `/api/v1/admin/reports/attempts${reportQuery(filters, { page, limit: Math.min(limit, MAX_PAGE_SIZE) })}`,
    ),
  exportPath: (filters: AttemptReportFilters) => `/api/v1/admin/reports/attempts/export${reportQuery(filters)}`,
};

/** Save a downloaded file under a name. */
function saveBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Let the browser start the download before the address is let go.
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Download every row matching the filters as an Excel sheet. Throws the server's message when it refuses. */
export async function downloadAttemptsReport(filters: AttemptReportFilters): Promise<void> {
  const blob = await apiDownload(attemptsReportApi.exportPath(filters));
  saveBlob(blob, reportFileName());
}
