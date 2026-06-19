// User types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'teacher' | 'student' | 'normal_user' | 'guardian' | 'org_admin';
  avatar?: string;
  schoolName?: string;
  teacherId?: string;
  grade?: number;
  section?: string;
  boardPreference?: string;
  rollNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  personaBand?: PersonaBand;
  xp?: number;
  streak?: number;
  onboardingCompleted?: boolean;
  achievements?: Achievement[];
  classIds?: string[];
  language?: string;
}

export type PersonaBand = 'A' | 'B' | 'C' | 'D' | 'E';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earnedAt: string;
  xpReward: number;
}

// Class types
import { BOARDS } from '@/constants';
export type Board = typeof BOARDS[number];

export interface Class {
  id: string;
  name: string;
  board: Board;
  grade: number;
  subject: string;
  section: string;
  joinCode: string;
  teacherId: string;
  teacherName: string;
  studentCount: number;
  color: string;
  createdAt: string;
  orgId?: string;
  isActive?: boolean;
  academicYear?: string;
  isClassTeacherView?: boolean;
}

export interface ClassStudent {
  id: string;
  userId: string;
  name: string;
  email: string;
  rollNo: string;
  joinedAt: string;
  avatar?: string;
}

// Assignment types
export interface Assignment {
  id: string;
  classId: string;
  topicId?: string;
  title: string;
  instructions: string;
  dueDate: string;
  points: number;
  rubricId?: string;
  attachments: Attachment[];
  status: 'draft' | 'published';
  createdAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'file' | 'link';
}

export interface Topic {
  id: string;
  classId: string;
  name: string;
  order: number;
}

// Rubric types
export interface Rubric {
  id: string;
  title: string;
  board: Board;
  grade: number;
  subject: string;
  criteria: RubricCriterion[];
  createdAt: string;
  updatedAt: string;
}

export interface RubricCriterion {
  id: string;
  title: string;
  weight: number;
  linkedOutcome?: string;
  levels: RubricLevel[];
}

export interface RubricLevel {
  id: string;
  title: string;
  points: number;
  descriptor: string;
}

// Submission types
export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentAvatar?: string;
  submittedAt: string;
  status: 'submitted' | 'late' | 'graded' | 'returned';
  files: Attachment[];
  textResponse?: string;
  grade?: SubmissionGrade;
}

export interface SubmissionGrade {
  totalScore: number;
  maxScore: number;
  criterionScores: CriterionScore[];
  overallComment?: string;
  xpAwarded?: number;
  remediationPlan?: RemediationItem[];
}

export interface CriterionScore {
  criterionId: string;
  selectedLevelId: string;
  points: number;
  comment?: string;
}

export interface RemediationItem {
  id: string;
  criterionTitle: string;
  recommendation: string;
  resources?: string[];
}

// Lesson Plan types
export interface LessonPlan {
  id: string;
  classId: string;
  title: string;
  objectives: string[];
  timeEstimate: number;
  steps: LessonStep[];
  practiceTasks: string[];
  formativeCheck: string;
  homework: string;
  differentiation: {
    easy: string;
    standard: string;
    advanced: string;
  };
  createdAt: string;
  status: 'draft' | 'published';
}

export interface LessonStep {
  id: string;
  title: string;
  duration: number;
  description: string;
}

// Announcement types
export interface Announcement {
  id: string;
  classId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  allowComments: boolean;
  comments: Comment[];
  createdAt: string;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
}

// Analytics types
export interface ClassInsight {
  criterionId: string;
  criterionTitle: string;
  averageScore: number;
  maxScore: number;
  studentCount: number;
}

export interface StudentProgress {
  outcomeId: string;
  outcomeTitle: string;
  masteryLevel: number;
  trend: 'improving' | 'stable' | 'declining';
}

// Theme types
export type ThemeMode = 'light' | 'dark';
export type ThemePreset = 'classic' | 'indigo' | 'teal' | 'sunset' | 'emerald';

export interface ThemeConfig {
  mode: ThemeMode;
  preset: ThemePreset;
}

// i18n
export type Language = 'en' | 'hi' | 'ta';

// Class Teacher types
export interface GradeSectionTeacher {
  id: string;
  orgId: string;
  teacherId: string;
  teacherName?: string;
  teacherEmail?: string;
  grade: number;
  section: string;
  board?: string;
  academicYear: string;
}

export interface SuggestedStudent {
  id: string;
  name: string;
  email: string;
  rollNumber?: string;
  grade?: number;
  section?: string;
  boardPreference?: string;
}

export interface GradePromotionRequest {
  fromGrade: number;
  toGrade: number;
  section?: string;
  newSection?: string;
  excludeStudentIds?: string[];
}

export interface ClassTeacherReport {
  students: ClassTeacherStudentPerformance[];
  subjects: ClassTeacherSubjectStats[];
  overall: {
    totalStudents: number;
    totalClasses: number;
    totalAssignments: number;
    totalSubmissions: number;
  };
}

export interface ClassTeacherStudentPerformance {
  id: string;
  name: string;
  email: string;
  rollNumber?: string;
  subjects: Record<string, {
    submissions: number;
    graded: number;
    totalScore: number;
    maxScore: number;
    averagePercentage?: number;
  }>;
}

export interface ClassTeacherSubjectStats {
  subject: string;
  classId: string;
  className: string;
  totalAssignments: number;
  totalSubmissions: number;
  gradedCount: number;
  averageScore?: number;
}
