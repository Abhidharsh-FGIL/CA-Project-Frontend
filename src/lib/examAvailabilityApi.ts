/**
 * Which examinations are open to students. The admin switches an exam on or off; the Exams page shows an
 * exam that is off as "Coming soon".
 *
 *   GET   /api/v1/user/exams/availability   → { open_exam_ids: string[] }
 *   GET   /api/v1/admin/exams               → { items: [{ exam_id, is_open }] }
 *   PATCH /api/v1/admin/exams/:exam_id      { is_open }  → { exam_id, is_open }
 *
 * Until the server answers, the page uses `OPEN_EXAM_IDS` from exam-listing.ts, so it never goes blank.
 */
import { api, userApi } from './api';

export interface ExamAvailabilityRow {
  exam_id: string;
  is_open: boolean;
}

export const examAvailabilityApi = {
  open: () => userApi.get<{ open_exam_ids: string[] }>('/api/v1/user/exams/availability'),
  list: () => api.get<{ items: ExamAvailabilityRow[] }>('/api/v1/admin/exams'),
  set: (examId: string, isOpen: boolean) =>
    api.patch<ExamAvailabilityRow>(`/api/v1/admin/exams/${encodeURIComponent(examId)}`, { is_open: isOpen }),
};

/** The admin's saved choice for an exam, or the built-in default when the server has none for it. */
export function isExamOpen(rows: ExamAvailabilityRow[] | undefined, examId: string, fallback: ReadonlySet<string>): boolean {
  const row = rows?.find(r => r.exam_id === examId);
  return row ? row.is_open : fallback.has(examId);
}
