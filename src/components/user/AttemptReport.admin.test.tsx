import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AttemptReport } from '@/components/user/ReportBody';
import type { AttemptDetailResponse, QuestionReviewItem } from '@/lib/userPortalApi';

/**
 * The admin shows a student's report with the same component the student sees, but with no student portal
 * around it. This renders it that way: with no `UserPortalProvider`, it must draw and not throw.
 */
let n = 0;
const question = (over: Partial<QuestionReviewItem> = {}): QuestionReviewItem =>
  ({
    question_id: `q${++n}`,
    number: n,
    body: 'stem',
    title: null,
    options: ['a', 'b'],
    correct_answer: 'a',
    user_answer: 'a',
    is_correct: true,
    time_spent_seconds: 30,
    subject: 'Tamil',
    difficulty: 'easy',
    explanation: null,
    tip: null,
    ...over,
  }) as QuestionReviewItem;

function detail(mode: 'mock' | 'practice'): AttemptDetailResponse {
  const questions = [question(), question({ is_correct: false, user_answer: 'b' }), question({ user_answer: null, is_correct: false })];
  return {
    attempt: {
      attempt_id: 'a1',
      test_name: 'Admin view',
      test_mode: mode,
      course_id: null,
      subject: null,
      score: 1,
      max_score: 3,
      percentage: 33,
      start_time: '2026-09-08T10:00:00Z',
      end_time: '2026-09-08T11:00:00Z',
      status: 'submitted',
      auto_submitted: false,
      malpractice_events: [],
      attempt_type: 'eval',
    },
    stats: { correct_count: 1, incorrect_count: 1, unattempted_count: 1, avg_time_per_question: 30, slow_question_count: 0, time_taken_seconds: 90 },
    ai_report: null,
    questions,
  } as unknown as AttemptDetailResponse;
}

const render = (mode: 'mock' | 'practice') => {
  const d = detail(mode);
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AttemptReport detail={d} attempt={(d as any).attempt} courseName={null} canDownloadPDF studentName="Some Student" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('the report, as an admin opens it (no student portal)', () => {
  it('draws a mock attempt', () => {
    expect(render('mock').length).toBeGreaterThan(500);
  });

  it('draws a practice attempt', () => {
    expect(render('practice').length).toBeGreaterThan(500);
  });
});
