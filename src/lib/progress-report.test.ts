/**
 * Section 20 validation tests for the Progress Report.
 *
 * The spec's definition of done is blunt: "If two students with materially
 * different performance profiles receive substantially the same analysis or study
 * plan, the implementation has failed." Several of these assert exactly that.
 */
import { describe, expect, it } from 'vitest';
import { buildProgressReport, DEFAULT_PROGRESS_CONFIG } from './progress-report';
import type { AttemptDetailResponse, ApiAttempt, QuestionReviewItem } from './userPortalApi';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

let seq = 0;

function q(subject: string, correct: boolean, answered = true): QuestionReviewItem {
  seq += 1;
  return {
    question_id: `q${seq}`,
    number: seq,
    body: 'stem',
    title: null,
    options: ['a', 'b'],
    correct_answer: 'a',
    user_answer: answered ? (correct ? 'a' : 'b') : null,
    is_correct: answered && correct,
    time_spent_seconds: 30,
    subject,
    difficulty: 'medium',
    explanation: null,
    tip: null,
  };
}

function block(subject: string, correct: number, wrong: number, skipped = 0) {
  return [
    ...Array.from({ length: correct }, () => q(subject, true)),
    ...Array.from({ length: wrong }, () => q(subject, false)),
    ...Array.from({ length: skipped }, () => q(subject, false, false)),
  ];
}

/** One attempt in the series: `day` orders it, `questions` supply the evidence. */
function attempt(id: string, day: number, questions: QuestionReviewItem[]) {
  const correct = questions.filter(x => x.user_answer && x.is_correct).length;
  const incorrect = questions.filter(x => x.user_answer && !x.is_correct).length;
  const api: ApiAttempt = {
    attempt_id: id,
    test_id: `t-${id}`,
    user_id: 'u1',
    start_time: `2026-0${day}-01T10:00:00Z`,
    end_time: `2026-0${day}-01T11:00:00Z`,
    score: correct,
    percentage: questions.length ? (correct / questions.length) * 100 : 0,
    status: 'submitted',
    auto_submitted: false,
    malpractice_events: [],
    test_name: `Mock ${day}`,
    test_mode: 'mock',
    course_id: null,
  };
  const detail = {
    attempt: {
      attempt_id: id,
      test_name: `Mock ${day}`,
      test_mode: 'mock',
      course_id: null,
      subject: null,
      score: correct,
      max_score: questions.length,
      percentage: questions.length ? (correct / questions.length) * 100 : 0,
      start_time: api.start_time,
      end_time: api.end_time,
      status: 'submitted',
      auto_submitted: false,
      malpractice_events: [],
      attempt_type: 'test',
    },
    stats: {
      correct_count: correct,
      incorrect_count: incorrect,
      unattempted_count: questions.length - correct - incorrect,
      avg_time_per_question: 30,
      slow_question_count: 0,
      time_taken_seconds: 1800,
    },
    ai_report: null,
    questions,
  } as AttemptDetailResponse;
  return { api, detail };
}

function series(...entries: ReturnType<typeof attempt>[]) {
  return {
    attempts: entries.map(e => e.api),
    details: new Map(entries.map(e => [e.api.attempt_id, e.detail])),
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('§20.2–20.4 arithmetic and denominators', () => {
  it('keeps correct, incorrect and unattempted separate and summing to the total', () => {
    const s = series(attempt('a1', 1, block('Tamil', 10, 20, 70)));
    const m = buildProgressReport(s.attempts, s.details);
    const p = m.attempts[0];
    expect(p.correct + p.incorrect + p.unattempted).toBe(p.totalQuestions);
    expect(p.totalQuestions).toBe(100);
  });

  it('divides accuracy by attempted, not by total questions', () => {
    const s = series(attempt('a1', 1, block('Tamil', 10, 20, 70)));
    const m = buildProgressReport(s.attempts, s.details);
    // 10/30 attempted = 33.3%, not 10/100 = 10%.
    expect(m.attempts[0].accuracyPct).toBe(33.3);
    expect(m.attempts[0].attemptRatePct).toBe(30);
  });

  it('never converts an unattempted question into an incorrect one', () => {
    const s = series(attempt('a1', 1, block('Tamil', 5, 5, 90)));
    const m = buildProgressReport(s.attempts, s.details);
    expect(m.attempts[0].incorrect).toBe(5);
    expect(m.attempts[0].unattempted).toBe(90);
  });
});

describe('§19 cautious language for short windows', () => {
  it('one attempt is a baseline, not a trend', () => {
    const s = series(attempt('a1', 1, block('Tamil', 10, 10)));
    const m = buildProgressReport(s.attempts, s.details);
    expect(m.comparability).toBe('BASELINE_ONLY');
    expect(m.journeyTakeaway).toMatch(/second attempt/i);
    expect(m.narrative.trajectory.join(' ')).toMatch(/baseline/i);
  });

  it('two attempts give direction only', () => {
    const s = series(attempt('a1', 1, block('Tamil', 5, 15)), attempt('a2', 2, block('Tamil', 10, 10)));
    const m = buildProgressReport(s.attempts, s.details);
    expect(m.comparability).toBe('DIRECTION_ONLY');
    expect(m.journeyTakeaway).toMatch(/Direction only/i);
  });

  it('three or more attempts support a trend statement', () => {
    const s = series(
      attempt('a1', 1, block('Tamil', 4, 16)),
      attempt('a2', 2, block('Tamil', 8, 12)),
      attempt('a3', 3, block('Tamil', 12, 8)),
    );
    const m = buildProgressReport(s.attempts, s.details);
    expect(m.comparability).toBe('TREND');
    expect(m.journeyTakeaway).toMatch(/improved in \d+ of the last \d+/);
  });
});

describe('§20.5 unequal maxima', () => {
  it('compares on normalized percentage, not raw marks', () => {
    // 10/20 = 50% then 30/100 = 30% — marks rose, performance fell.
    const s = series(attempt('a1', 1, block('Tamil', 10, 10)), attempt('a2', 2, block('Tamil', 30, 70)));
    const m = buildProgressReport(s.attempts, s.details);
    expect(m.headline.scoreDeltaMarks).toBe(20);
    expect(m.headline.scoreDeltaPoints).toBe(-20);
  });
});

describe('§10/§11 trend and gap classification', () => {
  it('calls a repeatedly weak subject a persistent gap', () => {
    const s = series(
      attempt('a1', 1, block('Tamil', 4, 16)),
      attempt('a2', 2, block('Tamil', 5, 15)),
      attempt('a3', 3, block('Tamil', 6, 14)),
    );
    const m = buildProgressReport(s.attempts, s.details);
    const tamil = m.subjects.find(x => x.name === 'Tamil')!;
    expect(tamil.status).toBe('PERSISTENT_GAP');
    expect(m.gaps.persistent.some(g => g.name === 'Tamil')).toBe(true);
  });

  it('calls a newly weak subject a new gap, not a persistent one', () => {
    const s = series(
      attempt('a1', 1, block('Polity', 16, 4)),
      attempt('a2', 2, block('Polity', 15, 5)),
      attempt('a3', 3, block('Polity', 6, 14)),
    );
    const m = buildProgressReport(s.attempts, s.details);
    const polity = m.subjects.find(x => x.name === 'Polity')!;
    expect(polity.status).toBe('DECLINING');
    expect(m.gaps.new.some(g => g.name === 'Polity')).toBe(true);
    expect(m.gaps.persistent.some(g => g.name === 'Polity')).toBe(false);
  });

  it('marks a recovered gap as resolved', () => {
    const s = series(attempt('a1', 1, block('Economy', 4, 16)), attempt('a2', 2, block('Economy', 17, 3)));
    const m = buildProgressReport(s.attempts, s.details);
    expect(m.gaps.resolved.some(g => g.name === 'Economy')).toBe(true);
  });

  it('§20.8 never calls an untested or thin subject a weakness', () => {
    const s = series(attempt('a1', 1, [...block('Tamil', 10, 10), ...block('Geography', 0, 1)]));
    const m = buildProgressReport(s.attempts, s.details);
    const geo = m.subjects.find(x => x.name === 'Geography')!;
    expect(geo.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(m.gaps.persistent.some(g => g.name === 'Geography')).toBe(false);
    expect(m.gaps.new.some(g => g.name === 'Geography')).toBe(false);
  });
});

describe('§13 readiness is explainable', () => {
  it('exposes its components and re-normalizes weights to 100', () => {
    const s = series(attempt('a1', 1, block('Tamil', 10, 10)), attempt('a2', 2, block('Tamil', 14, 6)));
    const m = buildProgressReport(s.attempts, s.details);
    expect(m.readiness).not.toBeNull();
    const total = m.readiness!.components.reduce((n, c) => n + c.weight, 0);
    expect(Math.round(total)).toBe(100);
    expect(m.readiness!.components.every(c => c.evidence.length > 0)).toBe(true);
  });

  it('§20.12 drops the coverage component when no syllabus blueprint exists', () => {
    const s = series(attempt('a1', 1, block('Tamil', 10, 10)));
    const m = buildProgressReport(s.attempts, s.details);
    expect(m.readiness!.components.some(c => c.key === 'coverage')).toBe(false);
    expect(m.dataQuality.syllabusBlueprintAvailable).toBe(false);
  });

  it('names blockers and what would reach the next band', () => {
    const s = series(attempt('a1', 1, block('Tamil', 5, 15)), attempt('a2', 2, block('Tamil', 6, 14)));
    const m = buildProgressReport(s.attempts, s.details);
    expect(m.readiness!.blockers.length).toBe(2);
    expect(m.readiness!.nextBand ?? '').toMatch(/readiness would reach/);
  });
});

describe('§20.13–20.15 the plan responds to the profile', () => {
  it('gives different priorities to opposite profiles on the same subjects', () => {
    const weakTamil = series(
      attempt('a1', 1, [...block('Tamil', 2, 18), ...block('Aptitude', 18, 2)]),
      attempt('a2', 2, [...block('Tamil', 3, 17), ...block('Aptitude', 17, 3)]),
    );
    const weakAptitude = series(
      attempt('b1', 1, [...block('Tamil', 18, 2), ...block('Aptitude', 2, 18)]),
      attempt('b2', 2, [...block('Tamil', 17, 3), ...block('Aptitude', 3, 17)]),
    );
    const a = buildProgressReport(weakTamil.attempts, weakTamil.details);
    const b = buildProgressReport(weakAptitude.attempts, weakAptitude.details);
    expect(a.priorities[0].name).not.toBe(b.priorities[0].name);
  });

  it('§20.14 varies duration by priority rather than assigning one figure to all', () => {
    const s = series(
      attempt('a1', 1, [...block('Tamil', 1, 29), ...block('Polity', 9, 11), ...block('Science', 16, 4)]),
      attempt('a2', 2, [...block('Tamil', 2, 28), ...block('Polity', 10, 10), ...block('Science', 17, 3)]),
    );
    const m = buildProgressReport(s.attempts, s.details);
    const all = [...m.priorities, ...m.queuedPriorities];
    const minutes = new Set(all.map(p => p.minutesPerSession));
    expect(all.length).toBeGreaterThan(1);
    expect(minutes.size).toBeGreaterThan(1);
  });

  it('§20.15 puts strengths on maintenance, not the same remediation as weak subjects', () => {
    const s = series(
      attempt('a1', 1, [...block('Tamil', 2, 18), ...block('Aptitude', 19, 1)]),
      attempt('a2', 2, [...block('Tamil', 3, 17), ...block('Aptitude', 19, 1)]),
    );
    const m = buildProgressReport(s.attempts, s.details);
    const all = [...m.priorities, ...m.queuedPriorities];
    const apt = all.find(p => p.name === 'Aptitude');
    const tamil = all.find(p => p.name === 'Tamil');
    if (apt) expect(apt.bucket).toBe('MAINTAIN');
    expect(tamil?.bucket).toBe('REPAIR');
    if (apt && tamil) expect(apt.minutesPerSession).toBeLessThan(tamil.minutesPerSession);
  });

  it('holds the active list to the configured cap and queues the rest', () => {
    const subjects = ['Tamil', 'Polity', 'Economy', 'History', 'Science', 'Geography'];
    const s = series(
      attempt('a1', 1, subjects.flatMap(x => block(x, 2, 18))),
      attempt('a2', 2, subjects.flatMap(x => block(x, 3, 17))),
    );
    const m = buildProgressReport(s.attempts, s.details);
    expect(m.priorities.length).toBeLessThanOrEqual(DEFAULT_PROGRESS_CONFIG.maxActivePriorities);
    expect(m.queuedPriorities.length).toBeGreaterThan(0);
  });

  it('every priority carries evidence and a success criterion', () => {
    const s = series(attempt('a1', 1, block('Tamil', 4, 16)), attempt('a2', 2, block('Tamil', 5, 15)));
    const m = buildProgressReport(s.attempts, s.details);
    for (const p of [...m.priorities, ...m.queuedPriorities]) {
      expect(p.evidence).toBeTruthy();
      expect(p.successCriterion).toBeTruthy();
      expect(p.escalation).toBeTruthy();
    }
  });
});

describe('§20.11 narrative names measurable drivers, not generic praise', () => {
  it('quotes first and latest figures in the trajectory', () => {
    const s = series(attempt('a1', 1, block('Tamil', 5, 15)), attempt('a2', 2, block('Tamil', 12, 8)));
    const m = buildProgressReport(s.attempts, s.details);
    const text = m.narrative.trajectory.join(' ');
    expect(text).toMatch(/\d+%/);
    expect(text).toMatch(/pp/);
    expect(text).not.toMatch(/keep practising/i);
  });

  it('separates percentage-point movement from raw marks', () => {
    const s = series(attempt('a1', 1, block('Tamil', 5, 15)), attempt('a2', 2, block('Tamil', 12, 8)));
    const m = buildProgressReport(s.attempts, s.details);
    expect(m.headline.scoreDeltaPoints).not.toBeNull();
    expect(m.headline.scoreDeltaMarks).not.toBeNull();
    expect(m.narrative.trajectory.join(' ')).toMatch(/marks and percentage points are different/i);
  });
});

describe('§3/§19 unsupported dimensions are dropped, not guessed', () => {
  it('hides percentile because no cohort data exists', () => {
    const s = series(attempt('a1', 1, block('Tamil', 10, 10)));
    const m = buildProgressReport(s.attempts, s.details);
    expect(m.dataQuality.cohortAvailable).toBe(false);
  });

  it('reports taxonomy depth as subject when questions carry no topic tag', () => {
    const s = series(attempt('a1', 1, block('Tamil', 10, 10)));
    const m = buildProgressReport(s.attempts, s.details);
    expect(m.dataQuality.taxonomyDepth).toBe('SUBJECT');
  });

  it('does not claim a difficulty dimension when every question shares one tag', () => {
    const s = series(attempt('a1', 1, block('Tamil', 10, 10)));
    const m = buildProgressReport(s.attempts, s.details);
    expect(m.dataQuality.difficultyAvailable).toBe(false);
  });

  it('warns rather than silently shrinking the window when detail is missing', () => {
    const s = series(attempt('a1', 1, block('Tamil', 10, 10)), attempt('a2', 2, block('Tamil', 12, 8)));
    s.details.delete('a2');
    const m = buildProgressReport(s.attempts, s.details);
    expect(m.window.attempts).toBe(2);
    expect(m.dataQuality.undetailedAttempts).toBe(1);
    expect(m.dataQuality.warnings.join(' ')).toMatch(/question-level detail/i);
  });
});
