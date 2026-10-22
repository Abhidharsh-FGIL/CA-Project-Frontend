import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UnitPracticeReport } from '@/components/user/UnitPracticeReport';
import type { AttemptReportModel } from '@/lib/attempt-report';

/** A practice set the way the report reads it: 40 questions, 4 right — a set that did not pass. */
function model(overrides: Partial<AttemptReportModel['summary']> = {}): AttemptReportModel {
  return {
    meta: { testName: 'இலக்கணம் · Simple', examName: null, mode: 'practice', date: null, status: 'submitted', autoSubmitted: false },
    summary: {
      score: 4,
      maxMarks: 40,
      percentage: 10,
      totalQuestions: 40,
      attempted: 40,
      correct: 4,
      incorrect: 36,
      unattempted: 0,
      attemptRate: 100,
      accuracy: 10,
      correctPct: 10,
      timeUsedSec: 847,
      timeAllowedSec: null,
      avgTimePerAttemptedSec: 21,
      ...overrides,
    },
    subjects: [],
    questions: [],
  } as unknown as AttemptReportModel;
}

const render = (m: AttemptReportModel) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <UnitPracticeReport model={m} examName="TNPSC Group 4" />
    </QueryClientProvider>,
  );

describe('the practice-set report header', () => {
  it('shows how far the set was from the pass mark on the right', () => {
    const html = render(model());
    expect(html).toContain('You 10%');
    expect(html).toContain('Pass mark 70%');
    // 40 marks, pass at 70% = 28; 4 scored, so 24 to go
    expect(html).toContain('24 more marks to pass');
    expect(html).toContain('Needs Improvement');
  });

  it('says Passed, with no gap, when the set is over the pass mark', () => {
    const html = render(model({ score: 34, percentage: 85, correct: 34, correctPct: 85 }));
    expect(html).toContain('Passed');
    expect(html).not.toContain('to pass');
  });

  it('shows the time, the pace and what was attempted', () => {
    const html = render(model());
    expect(html).toContain('14m 7s');
    expect(html).toContain('21s');
    expect(html).toContain('40/40');
  });

  it('still shows the set\'s name and its verdict on the left', () => {
    const html = render(model());
    expect(html).toContain('TNPSC Group 4 · Practice set');
    expect(html).toContain('இலக்கணம் · Simple');
  });

  it('does not invent a score for an attempt that has none', () => {
    const html = render(model({ percentage: null, correctPct: null, score: null }));
    expect(html).toContain('Not scored');
    expect(html).not.toContain('NaN');
  });
});
