// Mock data for Content Governance page fallback display

const MOCK_MEMBER_T1 = 'mock-teacher-1';
const MOCK_MEMBER_T2 = 'mock-teacher-2';
const MOCK_MEMBER_S1 = 'mock-student-1';
const MOCK_MEMBER_S2 = 'mock-student-2';
const MOCK_MEMBER_S3 = 'mock-student-3';

export const MOCK_MEMBERS = [
  { user_id: MOCK_MEMBER_T1, role: 'teacher', profiles: { name: 'Dr. Priya Sharma' } },
  { user_id: MOCK_MEMBER_T2, role: 'teacher', profiles: { name: 'Rajesh Kumar' } },
  { user_id: MOCK_MEMBER_S1, role: 'student', profiles: { name: 'Aarav Patel' } },
  { user_id: MOCK_MEMBER_S2, role: 'student', profiles: { name: 'Meera Gupta' } },
  { user_id: MOCK_MEMBER_S3, role: 'student', profiles: { name: 'Rohan Singh' } },
];

export const MOCK_QUESTIONS = [
  { id: 'mq1', text: 'What is the derivative of sin(x)?', subject: 'Mathematics', topic: 'Calculus', type: 'mcq', difficulty: 'medium', created_by: MOCK_MEMBER_T1, created_at: '2026-02-18T10:00:00Z' },
  { id: 'mq2', text: 'Explain Newton\'s Third Law of Motion with examples.', subject: 'Science', topic: 'Physics', type: 'long_answer', difficulty: 'easy', created_by: MOCK_MEMBER_T1, created_at: '2026-02-17T14:30:00Z' },
  { id: 'mq3', text: 'Identify the figure of speech: "The wind howled."', subject: 'English', topic: 'Literature', type: 'short_answer', difficulty: 'easy', created_by: MOCK_MEMBER_T2, created_at: '2026-02-16T09:00:00Z' },
  { id: 'mq4', text: 'Solve: If 2x + 5 = 17, find x.', subject: 'Mathematics', topic: 'Algebra', type: 'mcq', difficulty: 'easy', created_by: MOCK_MEMBER_S1, created_at: '2026-02-15T11:00:00Z' },
  { id: 'mq5', text: 'Describe the process of photosynthesis.', subject: 'Science', topic: 'Biology', type: 'long_answer', difficulty: 'hard', created_by: MOCK_MEMBER_T2, created_at: '2026-02-14T08:00:00Z' },
];

export const MOCK_ASSESSMENTS = [
  { id: 'ma1', title: 'Mid-Term Mathematics Quiz', subject: 'Mathematics', question_count: 25, mode: 'exam', difficulty: 'medium', created_by: MOCK_MEMBER_T1, created_at: '2026-02-19T10:00:00Z', scope: 'class' },
  { id: 'ma2', title: 'Science Chapter 5 Practice', subject: 'Science', question_count: 15, mode: 'practice', difficulty: 'easy', created_by: MOCK_MEMBER_S2, created_at: '2026-02-18T14:00:00Z', scope: 'personal' },
  { id: 'ma3', title: 'English Grammar Assessment', subject: 'English', question_count: 30, mode: 'exam', difficulty: 'hard', created_by: MOCK_MEMBER_T2, created_at: '2026-02-17T09:00:00Z', scope: 'class' },
];

export const MOCK_EBOOKS = [
  { id: 'me1', title: 'Fundamentals of Algebra', language: 'en', source_type: 'topic', user_id: MOCK_MEMBER_T1, created_at: '2026-02-18T12:00:00Z' },
  { id: 'me2', title: 'Introduction to Organic Chemistry', language: 'en', source_type: 'document', user_id: MOCK_MEMBER_T2, created_at: '2026-02-16T15:00:00Z' },
  { id: 'me3', title: 'World War II Summary Notes', language: 'hi', source_type: 'topic', user_id: MOCK_MEMBER_S1, created_at: '2026-02-15T10:00:00Z' },
];

export const MOCK_MINDMAPS = [
  { id: 'mm1', title: 'Cell Division Overview', source_type: 'topic', language: 'en', user_id: MOCK_MEMBER_S2, created_at: '2026-02-19T08:00:00Z' },
  { id: 'mm2', title: 'Indian Independence Movement', source_type: 'document', language: 'en', user_id: MOCK_MEMBER_T1, created_at: '2026-02-17T11:00:00Z' },
];

export const MOCK_LIBRARY_DOCS = [
  { id: 'ml1', title: 'Physics Chapter 3 Notes', type: 'pdf', folder: 'Physics', language: 'en', user_id: MOCK_MEMBER_T1, created_at: '2026-02-19T09:00:00Z' },
  { id: 'ml2', title: 'Essay Draft - Climate Change', type: 'notes', folder: 'English', language: 'en', user_id: MOCK_MEMBER_S3, created_at: '2026-02-18T16:00:00Z' },
  { id: 'ml3', title: 'Lab Experiment Photos', type: 'image', folder: 'Science', language: 'en', user_id: MOCK_MEMBER_S1, created_at: '2026-02-16T13:00:00Z' },
];

export const MOCK_VIDEO_PROJECTS = [
  { id: 'mv1', topic: 'Quadratic Equations Explained', language: 'en', user_id: MOCK_MEMBER_T2, created_at: '2026-02-18T10:00:00Z' },
  { id: 'mv2', topic: 'Solar System Tour', language: 'hi', user_id: MOCK_MEMBER_S2, created_at: '2026-02-15T14:00:00Z' },
];
