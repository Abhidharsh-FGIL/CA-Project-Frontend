/**
 * The figures and feature tiles on the Exams page.
 *
 * Display claims taken from the approved design. None of them is measured by this app, so the business owns
 * them: confirm each before it goes public, and change them here.
 */
export const EXAMS_STATS = {
  questions: '15,000+',
  aspirants: '5,000+',
  newQuestions: '2,000+',
};

/** The feature strip under the exam cards. The study-plan tile follows `SHOW_STUDY_PLAN`. */
export const EXAMS_FEATURES: Array<{ key: string; title: string; detail: string; tone: string }> = [
  { key: 'pyq', title: 'Previous Year Question Papers', detail: 'Last 10 years available', tone: 'rose' },
  { key: 'tests', title: 'Mock & Practice Tests', detail: 'Unit-wise & full-length tests', tone: 'blue' },
  { key: 'ai', title: 'AI Performance Insights', detail: 'Know your strengths and weak areas', tone: 'emerald' },
  { key: 'plan', title: 'Personalized Study Plan', detail: 'Based on your needs, time and performance', tone: 'violet' },
  { key: 'topic', title: 'Topic-wise Learning', detail: 'Concept clarity with detailed explanations', tone: 'amber' },
];
