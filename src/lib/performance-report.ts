/**
 * One report model across several attempts, so the Performance page can show the same unit table the mock test
 * report does — papers, their units, each unit's categories and sub-categories — over everything the student has
 * answered rather than over one paper.
 *
 * The attempts' questions are pooled into a single synthetic attempt and handed to `buildAttemptReport`, so the
 * counts, statuses and ordering are the report's own, not a second implementation of them.
 */
import { buildAttemptReport, type AttemptReportModel } from '@/lib/attempt-report';
import type { ExamContext } from '@/lib/exam-report-config';
import type { AttemptDetailResponse, QuestionReviewItem } from '@/lib/userPortalApi';

export interface PerformanceReport {
  model: AttemptReportModel | null;
  /** Questions pooled into the report: only those tagged to a published unit can be placed in it. */
  included: number;
  /** Questions across the attempts that name no unit, and so are left out. */
  untagged: number;
}

/** Pools the attempts' questions into one detail. Each question gets an id of its own: a paper repeated across attempts reuses ids. */
export function combineAttemptDetails(details: AttemptDetailResponse[]): { detail: AttemptDetailResponse; untagged: number } | null {
  const pooled: QuestionReviewItem[] = [];
  let untagged = 0;
  details.forEach((d, di) => {
    for (const q of d.questions ?? []) {
      if (!q.unit_id) {
        untagged += 1;
        continue;
      }
      pooled.push({ ...q, question_id: `${di}:${pooled.length}:${q.question_id}`, number: pooled.length + 1 });
    }
  });
  if (pooled.length === 0) return null;
  const first = details[0];
  return {
    untagged,
    detail: {
      attempt: { ...first.attempt, attempt_id: 'combined' },
      stats: null,
      questions: pooled,
      performance_breakdown: undefined,
    } as unknown as AttemptDetailResponse,
  };
}

export function buildPerformanceReport(details: AttemptDetailResponse[], exam: ExamContext | null = null): PerformanceReport {
  const combined = combineAttemptDetails(details);
  if (!combined) {
    const untagged = details.reduce((n, d) => n + (d.questions?.length ?? 0), 0);
    return { model: null, included: 0, untagged };
  }
  // The exam's paper size and duration describe one sitting, not a pool of them.
  const context = exam ? { ...exam, totalQuestions: null, durationSec: null } : null;
  const model = buildAttemptReport(combined.detail, {}, context);
  return { model, included: combined.detail.questions.length, untagged: combined.untagged };
}
