import { describe, expect, it } from 'vitest';
import { findStage, orderBySection, resolveSubjectId, subjectDisplayName } from '@/config/tnpsc';
import { resolveExamContext } from '@/lib/exam-report-config';
import { subjectIdForQuestion } from '@/lib/unit-pool';
import { buildAttemptReport } from '@/lib/attempt-report';
import type { AttemptDetailResponse, QuestionReviewItem } from '@/lib/userPortalApi';

const stage = findStage('group-4', 'group-4-written')!.stage;

/**
 * A Full Mock (Tamil) filter listed "General Tamil (30)", "தமிழ் (40)", "கலைச்சொற்கள் (2)"
 * and "எளிய மொழிபெயர்ப்பு (5)" as separate subjects, with a stray "Current Affairs (1)".
 * They are one subject, and the counts — and the report's percentages — were split across them.
 */
describe('the subject tags on a real Group 4 mock', () => {
  it('reads every Tamil tag as General Tamil', () => {
    for (const tag of [
      'General Tamil',
      'தமிழ்',
      'பொதுத்தமிழ்',
      'தமிழ் – சொல்லகராதி',
      'கலைச்சொற்கள்',
      'எளிய மொழிபெயர்ப்பு',
      'பொதுத்தமிழ் - பகுதி அ - இலக்கணம்',
      'பொதுத்தமிழ் - பகுதி ஆ - இலக்கியம்',
    ]) {
      expect(resolveSubjectId(stage, tag), tag).toBe('general-tamil');
    }
  });

  it('reads English the same way, and a language word leading a label', () => {
    expect(resolveSubjectId(stage, 'English')).toBe('general-english');
    expect(resolveSubjectId(stage, 'English Grammar')).toBe('general-english');
  });

  it('reads a unit name behind a "Part A – Unit V:" prefix', () => {
    expect(
      resolveSubjectId(stage, 'Part A – Unit V: Indian Economy and Development Administration in Tamil Nadu'),
    ).toBe('indian-economy');
  });

  it('shows a Tamil tag under the catalog name, so the filter has one entry', () => {
    expect(subjectDisplayName(stage, 'தமிழ்')).toBe('General Tamil');
    expect(subjectDisplayName(stage, 'கலைச்சொற்கள்')).toBe('General Tamil');
  });

  it('does not claim what it cannot tell', () => {
    expect(resolveSubjectId(stage, 'Vocabulary')).toBeUndefined();
    expect(resolveSubjectId(stage, 'Technical Terms')).toBeUndefined();
    expect(resolveSubjectId(stage, 'Current Events')).toBe('current-events'); // its own subject, not Tamil's
    expect(resolveSubjectId(stage, 'Physics')).toBeUndefined();
  });

  it('keeps a bare "English" from pulling another exam into Group 4', () => {
    const gatb = findStage('gat-b', 'gat-b-exam')!.stage;
    expect(resolveSubjectId(gatb, 'English')).toBeUndefined();
    expect(resolveSubjectId(gatb, 'தமிழ்')).toBeUndefined();
  });
});

describe('subjectIdForQuestion', () => {
  it('uses the Subject when it names one', () => {
    expect(subjectIdForQuestion(stage, { subject: 'தமிழ்' })).toBe('general-tamil');
  });

  /**
   * "மருத்துவம்" (medicine), "சட்டம்" (law), "தகவல் தொழில்நுட்பம்" (IT) and "கல்வி" (education) are
   * the topic list of Tamil Unit IV, Technical Terms. A sheet that puts the domain in the Subject
   * column has still said which unit — and so which subject — the question is.
   */
  it('reads a Unit IV technical-term domain as General Tamil', () => {
    for (const subject of ['மருத்துவம்', 'சட்டம்', 'தகவல் தொழில்நுட்பம்']) {
      expect(subjectIdForQuestion(stage, { subject }), subject).toBe('general-tamil');
      expect(subjectIdForQuestion(stage, { subject, chapter: 'கலைச் சொற்கள்' }), subject).toBe('general-tamil');
    }
  });

  it('says nothing when neither the Subject nor the Topic does, or when they disagree', () => {
    expect(subjectIdForQuestion(stage, { subject: 'something nobody printed' })).toBeUndefined();
    expect(subjectIdForQuestion(stage, { subject: 'zzz', chapter: 'something else' })).toBeUndefined();
    // Names two units — the passage unit and the term unit — so it is not guessed.
    expect(
      subjectIdForQuestion(stage, { subject: 'மருத்துவம்', chapter: 'வாசித்தல் – புரிந்து கொள்ளும் திறன்' }),
    ).toBeUndefined();
    expect(subjectIdForQuestion(undefined, { subject: 'தமிழ்' })).toBeUndefined();
  });
});

describe('the order of the paper', () => {
  it('keeps every Tamil tag in the first hundred, not after the Aptitude questions', () => {
    const items = [
      { subject: 'Aptitude & Mental Ability' },
      { subject: 'தமிழ்' },
      { subject: 'Indian Polity' },
      { subject: 'கலைச்சொற்கள்' },
      { subject: 'General Tamil' },
    ];
    const ordered = orderBySection(stage, items, x => subjectDisplayName(stage, x.subject)).map(x => x.subject);
    // The Tamil block (all three spellings) comes first; General Studies and Aptitude follow.
    expect(ordered.slice(0, 3).sort()).toEqual(['General Tamil', 'கலைச்சொற்கள்', 'தமிழ்'].sort());
  });
});

describe('the report subject rows', () => {
  let seq = 0;
  const q = (subject: string, correct: boolean, over: Partial<QuestionReviewItem> = {}): QuestionReviewItem => {
    seq += 1;
    return {
      question_id: `s${seq}`,
      number: seq,
      body: 'stem',
      title: null,
      options: ['a', 'b'],
      correct_answer: 'a',
      user_answer: correct ? 'a' : 'b',
      is_correct: correct,
      time_spent_seconds: 30,
      subject,
      difficulty: 'easy',
      explanation: null,
      tip: null,
      ...over,
    } as QuestionReviewItem;
  };

  const detail = (questions: QuestionReviewItem[]): AttemptDetailResponse =>
    ({
      attempt: {
        attempt_id: 'a1',
        test_name: 'TNPSC Group 4 — Full Mock (Tamil)',
        test_mode: 'mock',
        course_id: null,
        subject: null,
        score: 0,
        max_score: questions.length,
        percentage: 0,
        start_time: '2026-10-12T10:00:00Z',
        end_time: '2026-10-12T11:00:00Z',
        status: 'submitted',
        auto_submitted: false,
        malpractice_events: [],
        attempt_type: 'test',
      },
      stats: {
        correct_count: questions.filter(x => x.is_correct).length,
        incorrect_count: questions.filter(x => !x.is_correct).length,
        unattempted_count: 0,
        avg_time_per_question: 30,
        slow_question_count: 0,
        time_taken_seconds: 1800,
      },
      ai_report: null,
      questions,
    }) as AttemptDetailResponse;

  const exam = resolveExamContext({ groupId: 'group-4', stageId: 'group-4-written' });

  it('folds every Tamil tag into one General Tamil row, with one percentage', () => {
    const questions = [
      ...Array.from({ length: 30 }, (_, i) => q('General Tamil', i < 15)), // 15 of 30
      ...Array.from({ length: 40 }, (_, i) => q('தமிழ்', i < 20)), //         20 of 40
      ...Array.from({ length: 5 }, () => q('எளிய மொழிபெயர்ப்பு', true)), //    5 of 5
      ...Array.from({ length: 2 }, () => q('கலைச்சொற்கள்', false)), //        0 of 2
    ];
    const m = buildAttemptReport(detail(questions), {}, exam);
    expect(m.subjects).toHaveLength(1);
    expect(m.subjects[0].metrics.questions).toBe(77);
    expect(m.subjects[0].metrics.correct).toBe(40);
  });

  it('counts a Unit IV technical-term domain under General Tamil, not as a subject of its own', () => {
    const questions = [
      ...Array.from({ length: 4 }, () => q('General Tamil', true)),
      q('தகவல் தொழில்நுட்பம்', true),
      q('மருத்துவம்', false, { topic: 'கலைச் சொற்கள்' } as Partial<QuestionReviewItem>),
    ];
    const m = buildAttemptReport(detail(questions), {}, exam);
    expect(m.subjects).toHaveLength(1);
    expect(m.subjects[0].metrics.questions).toBe(6);
  });
});

describe('a subject shared by both language papers, on the test screen and in the report', () => {
  const english = 'In an official order, which term most precisely conveys “Notification” to the public?';

  it('is resolved from the question text', () => {
    expect(resolveSubjectId(stage, 'Technical Terms')).toBeUndefined();
    expect(subjectIdForQuestion(stage, { subject: 'Technical Terms', text: english })).toBe('general-english');
    expect(subjectIdForQuestion(stage, { subject: 'Technical Terms', body: 'அரசாணை என்பதற்கு நிகரான ஆங்கிலச் சொல் எது?' })).toBe(
      'general-tamil',
    );
    expect(subjectIdForQuestion(stage, { subject: 'Technical Terms' })).toBeUndefined();
  });
});
