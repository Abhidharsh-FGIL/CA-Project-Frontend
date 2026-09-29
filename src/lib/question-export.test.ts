/**
 * The answer-sheet export's release blockers.
 *
 * It is the one artefact of this report that leaves the product, so the things
 * that must hold are: every question is in it including the skipped ones, the
 * columns line up with the header, Tamil survives, and nothing in a question
 * stem can execute inside someone's spreadsheet.
 */
import { describe, expect, it } from 'vitest';
import { buildAttemptReport } from './attempt-report';
import { buildQuestionCsv, questionCsvFilename } from './question-export';
import type { AttemptDetailResponse, QuestionReviewItem } from './userPortalApi';

let seq = 0;

function q(over: Partial<QuestionReviewItem> = {}): QuestionReviewItem {
  seq += 1;
  return {
    question_id: `q${seq}`,
    number: seq,
    body: 'What is 2 + 2?',
    title: null,
    options: ['three', 'four', 'five', 'six'],
    correct_answer: 'b',
    user_answer: 'b',
    is_correct: true,
    time_spent_seconds: 30,
    subject: 'Aptitude',
    difficulty: 'medium',
    explanation: 'Two and two make four.',
    tip: null,
    ...over,
  };
}

function detail(questions: QuestionReviewItem[]): AttemptDetailResponse {
  const correct = questions.filter(x => x.user_answer && x.is_correct).length;
  return {
    attempt: {
      attempt_id: 'a1',
      test_name: 'G4-Simple',
      test_mode: 'mock',
      course_id: null,
      subject: null,
      score: correct,
      max_score: questions.length,
      percentage: questions.length ? (correct / questions.length) * 100 : 0,
      start_time: '2026-09-17T10:00:00Z',
      end_time: '2026-09-17T11:00:00Z',
      status: 'submitted',
      auto_submitted: false,
      malpractice_events: [],
      attempt_type: 'eval',
    },
    questions,
    stats: {
      correct_count: correct,
      incorrect_count: questions.filter(x => x.user_answer && !x.is_correct).length,
      unattempted_count: questions.filter(x => !x.user_answer).length,
      avg_time_per_question: null,
      slow_question_count: null,
      time_taken_seconds: 900,
    },
  } as AttemptDetailResponse;
}

/** Splits a CSV row that may contain quoted commas and newlines. */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < csv.length; i += 1) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r' && csv[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

describe('buildQuestionCsv', () => {
  it('writes one row per question, skipped ones included', () => {
    const csv = buildQuestionCsv(
      buildAttemptReport(
        detail([
          q({ user_answer: 'b', is_correct: true }),
          q({ user_answer: 'a', is_correct: false }),
          q({ user_answer: null, is_correct: false }),
        ]),
      ),
    );
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(4); // header + 3
    expect(rows.slice(1).map(r => r[r.length - 5])).toEqual(['Correct', 'Incorrect', 'Skipped']);
  });

  it('keeps every row the same width as the header', () => {
    const csv = buildQuestionCsv(
      buildAttemptReport(
        detail([
          q(),
          q({ options: null, user_answer: null }),
          q({ options: { A: 'alpha', B: 'beta' } as any }),
          q({ body: 'A stem\nover two lines, with a comma', explanation: 'He said "yes".' }),
        ]),
      ),
    );
    const rows = parseCsv(csv);
    // 7 identity columns + 6 options + 9 result columns. Pinned explicitly so a
    // dropped column fails here rather than shifting every cell after it.
    const width = rows[0].length;
    expect(width).toBe(22);
    for (const r of rows) expect(r).toHaveLength(width);
  });

  it('resolves the answer letter to the option text', () => {
    const csv = buildQuestionCsv(buildAttemptReport(detail([q({ user_answer: 'a', is_correct: false })])));
    const [header, row] = parseCsv(csv);
    const at = (name: string) => row[header.indexOf(name)];
    expect(at('Your Answer')).toBe('A');
    expect(at('Your Answer (text)')).toBe('three');
    expect(at('Correct Answer')).toBe('B');
    expect(at('Correct Answer (text)')).toBe('four');
    expect(at('Option D')).toBe('six');
  });

  it('leaves both answer columns blank for a skipped question', () => {
    const csv = buildQuestionCsv(buildAttemptReport(detail([q({ user_answer: null })])));
    const [header, row] = parseCsv(csv);
    expect(row[header.indexOf('Your Answer')]).toBe('');
    expect(row[header.indexOf('Your Answer (text)')]).toBe('');
    // The correct answer is still given — that is the point of reviewing it.
    expect(row[header.indexOf('Correct Answer (text)')]).toBe('four');
  });

  it('carries the taxonomy, including sub-topic', () => {
    const csv = buildQuestionCsv(
      buildAttemptReport(detail([q({ subject: 'General Tamil', topic: 'Grammar', subtopic: 'Sandhi' })])),
    );
    const [header, row] = parseCsv(csv);
    expect(row[header.indexOf('Subject')]).toBe('General Tamil');
    expect(row[header.indexOf('Topic')]).toBe('Grammar');
    expect(row[header.indexOf('Sub-topic')]).toBe('Sandhi');
    expect(row[header.indexOf('Difficulty')]).toBe('Medium');
  });

  it('keeps Tamil text intact', () => {
    const TAMIL = 'சிலப்பதிகாரத்தின் ஆசிரியர் யார்?';
    const csv = buildQuestionCsv(buildAttemptReport(detail([q({ body: TAMIL })])));
    const [header, row] = parseCsv(csv);
    expect(row[header.indexOf('Question')]).toBe(TAMIL);
  });

  it('preserves a multi-line stem and escapes quotes', () => {
    const csv = buildQuestionCsv(
      buildAttemptReport(detail([q({ body: 'Line one\nLine two, with a comma', explanation: 'He said "yes".' })])),
    );
    const [header, row] = parseCsv(csv);
    expect(row[header.indexOf('Question')]).toBe('Line one\nLine two, with a comma');
    expect(row[header.indexOf('Explanation')]).toBe('He said "yes".');
  });

  it('defuses a stem that a spreadsheet would read as a formula', () => {
    const csv = buildQuestionCsv(buildAttemptReport(detail([q({ body: '=SUM(A1:A9) equals what?' })])));
    const [header, row] = parseCsv(csv);
    expect(row[header.indexOf('Question')].startsWith("'=")).toBe(true);
  });

  it('writes nothing rather than 0 when no time was recorded', () => {
    const csv = buildQuestionCsv(buildAttemptReport(detail([q({ time_spent_seconds: 0 })])));
    const [header, row] = parseCsv(csv);
    expect(row[header.indexOf('Time Taken (sec)')]).toBe('');
  });
});

describe('questionCsvFilename', () => {
  it('names the paper and the day', () => {
    const name = questionCsvFilename(buildAttemptReport(detail([q()])));
    expect(name).toBe('G4-Simple-2026-09-17-questions.csv');
  });
});
