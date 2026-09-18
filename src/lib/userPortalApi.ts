/**
 * User Portal data API — authenticated endpoints for courses, history, notifications.
 *
 * All calls use `userApi` (sends user_access_token).
 *
 * Endpoints:
 *   GET  /api/v1/user/dashboard/                            → DashboardData
 *   GET  /api/v1/user/courses/                              → ApiCourse[]
 *   GET  /api/v1/user/history/?page=&limit=                → PaginatedResponse<ApiAttempt>
 *   GET  /api/v1/user/notifications/?page=&limit=&is_read= → PaginatedResponse<ApiNotification>
 *   PATCH /api/v1/user/notifications/{id}/read              → ApiNotification
 *   PATCH /api/v1/user/notifications/read-all               → { message, success }
 *   DELETE /api/v1/user/notifications/clear                 → { message, success }
 */
import { userApi, getUserToken, buildUrl } from './api';

// ─── Response types ───────────────────────────────────────────────────────────

export interface ApiCourse {
  course_id: string;
  name: string;
  description: string | null;
  subject: string | null;
  exam_body: string | null;
  thumbnail_color: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  enrolled_users: number;
  total_tests: number;
}

export interface ApiAttempt {
  attempt_id: string;
  test_id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  score: number | null;
  percentage: number | null;
  status: 'in_progress' | 'submitted' | 'auto_submitted';
  auto_submitted: boolean;
  malpractice_events: unknown[];
  /** Test name — populated by the history endpoint via JOIN with tests table. */
  test_name: string | null;
  /** Test mode: 'practice' | 'mock' — populated by history endpoint. */
  test_mode: string | null;
  /** Course UUID — populated by history endpoint. */
  course_id: string | null;
}

export interface ApiNotification {
  notification_id: string;
  user_id: string;
  type: string;
  message: string;
  test_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface DashboardData {
  user: {
    name: string;
    email: string;
    subscription_tier: string;
  };
  courses: ApiCourse[];
  unread_notifications: number;
  subscription: {
    status: string;
    end_date: string | null;
  };
}

// ─── API functions ────────────────────────────────────────────────────────────

/** GET /api/v1/user/dashboard/ — summary card data */
export function getDashboard(): Promise<DashboardData> {
  return userApi.get<DashboardData>('/api/v1/user/dashboard/');
}

/** GET /api/v1/user/courses/ — enrolled courses */
export function getEnrolledCourses(): Promise<ApiCourse[]> {
  return userApi.get<ApiCourse[]>('/api/v1/user/courses/');
}

// ─── Attempt Detail Types ─────────────────────────────────────────────────────

export interface QuestionReviewItem {
  question_id: string;
  number: number;
  body: string;
  title: string | null;
  options: string[] | null;
  correct_answer: string;
  user_answer: string | null;
  is_correct: boolean;
  time_spent_seconds: number;
  subject: string;
  /**
   * Syllabus topic under the subject, and the sub-topic under that.
   *
   * The question bank already stores this as `chapter` (the evaluation module
   * writes it, filters on it, and serves suggestions from
   * `GET /api/v1/evaluation/chapters`), and the Excel importer reads a Topic
   * column into its parse report. What is missing is the projection: this
   * response stops at `subject`, so the report cannot go below subject level.
   *
   * Read under every name the pipeline uses, so whichever the backend projects
   * first lights up the topic breakdown without another client change.
   */
  topic?: string | null;
  subtopic?: string | null;
  /** The question bank's own name for `topic`. */
  chapter?: string | null;
  /**
   * Stable ids for the three taxonomy levels, where the backend assigns them.
   *
   * Preferred over slugging the name: a bilingual paper prints the same subject
   * under two names, and an id keeps both halves in one row.
   */
  subject_id?: string | null;
  topic_id?: string | null;
  subtopic_id?: string | null;
  /**
   * The canonical subject name, where the backend resolved one.
   *
   * `subject` is the wording printed on the paper — Tamil on a Group 4 booklet.
   * This is the catalog's name for the same subject, so a report read in English
   * has an English label to use.
   */
  subject_name?: string | null;
  difficulty: string;
  /**
   * Format of the question, e.g. "standard" / "assertion_reason".
   *
   * Present on the wire from the history-detail endpoint though it was missing
   * from the documented contract — optional here so an older payload still parses.
   */
  question_type?: string | null;
  explanation: string | null;
  /**
   * The same question in the paper's other language.
   *
   * A Group 4 booklet prints every question twice, and the attempt endpoint that
   * drives the test screen projects both copies. The history-detail endpoint this
   * shape describes currently sends only one, so the report shows whichever
   * language the paper was written in. Declared here so the Question Insights
   * language control lights up the moment the field is projected.
   */
  translations?: Record<string, QuestionTranslation>;
  tip: string | null;
  /**
   * The stem's diagram, for image-based questions.
   *
   * Present on the question record (`attachment_url`, EVALUATION_API.md §5) but
   * NOT currently projected into this response, so image questions render with an
   * empty stem — the option images come through only because they are embedded
   * inside `options`. The client reads it as soon as the backend includes it.
   */
  attachment_url?: string | null;
  attachment_name?: string | null;
  /** Alias some payloads use for the same thing. */
  question_image_url?: string | null;
}

export interface AttemptStats {
  correct_count: number | null;
  incorrect_count: number | null;
  unattempted_count: number;
  avg_time_per_question: number | null;
  slow_question_count: number | null;
  time_taken_seconds: number;
}

export interface StrengthItem {
  topic: string;
  accuracy: number;
  detail: string | null;
}

export interface ImprovementAreaItem {
  topic: string;
  accuracy: number;
  advice: string | null;
}

// ── Performance breakdown (richer report payload) ────────────────────────────

export interface OverallDistribution {
  correct: number;
  incorrect: number;
  unattempted: number;
  total: number;
}

export interface SubjectBreakdown {
  subject: string;
  total_questions: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  accuracy_percentage: number;
  estimated_marks: number;
  max_marks: number;
}

export interface FeedbackStrength {
  title: string;
  accuracy: number | null;
  note: string | null;
}

export interface FeedbackImprovement {
  title: string;
  accuracy: number | null;
  suggestion: string | null;
}

export interface PerformanceFeedback {
  performance_level: string;
  motivation: string | null;
  strengths: FeedbackStrength[];
  improvement_areas: FeedbackImprovement[];
}

export interface AttemptBadge {
  id: string;
  icon: string;
  title: string;
  criteria: string;
  /** 'achievement' | 'level' */
  group: string;
  earned: boolean;
  message?: string | null;
}

export interface TopicFocus {
  topic: string;
  accuracy: number;
  recommended_questions: number;
}

export interface TopicPerformance {
  well_performed: TopicFocus[];
  needs_focus: TopicFocus[];
  summary: string | null;
}

export interface PerformanceBreakdown {
  overall_distribution: OverallDistribution;
  subject_breakdown: SubjectBreakdown[];
  feedback: PerformanceFeedback;
  badges?: AttemptBadge[];
  topic_performance?: TopicPerformance | null;
}

// ── SKHC progress report (multi-exam knowledge health check) ─────────────────

export interface SkhcExamRow {
  label: string;
  attempt_id?: string;
  date: string;
  type?: string;
  score: number;
  max_score: number;
  percentage: number;
  grade?: string;
}

export interface SkhcProfile {
  student_name: string;
  email: string;
  assessment_title: string;
  total_exams: number;
  report_generated: string;
  /** Auto-generated report identifier, e.g. "SKHC-2025-8A-017" */
  report_id?: string;
  date_of_birth?: string;
  gender?: string;
  student_class?: string;
  section?: string;
  /** Human-readable class + section, e.g. "Class 8 – Section A" */
  class_section?: string;
  roll_no?: string;
  school?: string;
  medium?: string;
  class_teacher?: string;
  academic_year?: string;
  assessment_platform?: string;
  latest_grade?: string;
}

export interface SkhcComparisonSubject {
  subject: string;
  previous_marks: number;
  current_marks: number;
  delta_marks: number;
  previous_percentage: number;
  current_percentage: number;
  delta_percentage: number;
  verdict: string;
}

export interface SkhcComparison {
  has_previous: boolean;
  current: SkhcExamRow | null;
  previous: SkhcExamRow | null;
  marks_change: number;
  percentage_change: number;
  verdict: string;
  message: string;
  subjects: SkhcComparisonSubject[];
}

export interface SkhcTrendPoint {
  label: string;
  date: string;
  score: number;
  max_score: number;
  percentage: number;
}

export interface SkhcTrendSegment {
  period?: string;
  start_score: number;
  end_score: number;
  points_gained: number;
  pct_growth: number;
  observation: string;
}

export interface SkhcScoreTrend {
  points: SkhcTrendPoint[];
  segments: SkhcTrendSegment[];
  overall: SkhcTrendSegment | null;
}

export interface SkhcSubjectExam {
  label: string;
  scored: number;
  max_marks: number;
  percentage: number;
  correct: number;
  incorrect: number;
  unattempted: number;
}

export interface SkhcSubjectPerformance {
  subject: string;
  max_marks: number;
  exams: SkhcSubjectExam[];
  first_percentage: number;
  latest_percentage: number;
  delta_marks: number;
  delta_percentage: number;
  grade: string;
}

export interface SkhcSubjectDiagnostic {
  subject: string;
  scored: number;
  max_marks: number;
  percentage: number;
  grade: string;
  accuracy_percentage: number;
  observation: string;
}

export interface SkhcRadarItem {
  subject: string;
  first_percentage: number;
  latest_percentage: number;
}

export interface SkhcImprovementPlanItem {
  priority: string;
  subject: string;
  gap_identified: string;
  recommended_action: string;
  duration?: string;
  platform_module?: string;
}

export interface SkhcOverallAssessment {
  grade: string;
  latest_percentage: number;
  growth_points: number;
  trajectory: string;
  recommendation: string;
  exams_covered: number;
}

export interface SkhcCohortComparison {
  cohort_size: number;
  student_percentage: number;
  rank: number;
  percentile: number;
  mean_percentage: number;
  median_percentage: number;
  top_percentage: number;
  lowest_percentage: number;
  above_mean: boolean;
  gap_to_topper: number;
  message: string;
}

export interface SkhcBehaviourPerExam {
  label: string;
  level: string;
}

export interface SkhcBehaviourParameter {
  name: string;
  category: string;
  latest_level: string;
  per_exam: SkhcBehaviourPerExam[] | null;
  note: string;
}

export interface SkhcBehaviouralProfile {
  parameters: SkhcBehaviourParameter[];
  derived_from: string;
  note: string;
}

export interface SkhcWaterfallBar {
  label: string;
  /** 'baseline' | 'growth' | 'score' | 'final' */
  type: string;
  value: number;
  display?: string;
}

export interface SkhcGrowthWaterfall {
  title: string;
  y_max: number;
  bars: SkhcWaterfallBar[];
}

export interface SkhcSubjectChartSubject {
  subject: string;
  max_marks: number;
  scores: number[];
  percentages: number[];
  first_percentage: number;
  latest_percentage: number;
  delta_marks: number;
  grade: string;
}

export interface SkhcSubjectChart {
  title: string;
  exam_labels: string[];
  subjects: SkhcSubjectChartSubject[];
}

export interface SkhcPercentilePoint {
  label: string;
  percentage: number;
  percentile: number;
}

export interface SkhcPercentileChart {
  title: string;
  cohort_size: number;
  median_line: number;
  x_labels: string[];
  points: SkhcPercentilePoint[];
}

export interface SkhcDistributionBin {
  range: string;
  from: number;
  to: number;
  count: number;
  is_student_bin: boolean;
}

export interface SkhcClassDistribution {
  title: string;
  max_score: number;
  class_size: number;
  mean_score: number;
  median_score: number;
  std_deviation: number;
  minimum_score: number;
  maximum_score: number;
  q1: number;
  q3: number;
  iqr: number;
  student_score: number;
  student_above_n_students: number;
  student_vs_mean: number;
  students_above_80?: { threshold_percent: number; threshold_marks: number; count: number; percent: number };
  students_above_70?: { threshold_percent: number; threshold_marks: number; count: number; percent: number };
  histogram: SkhcDistributionBin[];
}

export interface SkhcPsychometricParameter {
  name: string;
  category: string;
  per_exam: string[];
  first_level: string;
  latest_level: string;
  movement: string;
}

export interface SkhcPsychometricProfile {
  title: string;
  note: string;
  legend: Record<string, string>;
  exam_labels: string[];
  parameters: SkhcPsychometricParameter[];
  summary?: { strengths: number; developing: number; focus_areas: number };
}

export interface SkhcStakeholderGuideItem {
  stakeholder: string;
  name: string | null;
  actions: string[];
  /** Optional tool/module per stakeholder (single or list) — shown if present. */
  tool?: string;
  tools?: string[];
}

export interface SkhcCertificationExam {
  label: string;
  date: string;
}

export interface SkhcCertification {
  report_title?: string;
  student_id?: string;
  student_name?: string;
  academic_year?: string;
  class_section?: string;
  school?: string;
  class_teacher?: string;
  report_generated?: string;
  exams_covered?: SkhcCertificationExam[];
  exams_count?: number;
  assessment_platform?: string;
  assessment_methodology?: string;
  psychometric_framework?: string;
}

export interface SkhcReport {
  report_title: string;
  profile: SkhcProfile;
  growth_waterfall?: SkhcGrowthWaterfall | null;
  key_statistics?: any;
  subject_chart?: SkhcSubjectChart | null;
  percentile_chart?: SkhcPercentileChart | null;
  class_distribution?: SkhcClassDistribution | null;
  psychometric_profile?: SkhcPsychometricProfile | null;
  stakeholder_guide?: SkhcStakeholderGuideItem[] | null;
  certification?: SkhcCertification | null;
  exam_overview: SkhcExamRow[];
  comparison: SkhcComparison | null;
  growth_analysis?: SkhcTrendSegment[];
  cohort_comparison?: SkhcCohortComparison | null;
  behavioural_profile?: SkhcBehaviouralProfile | null;
  score_trend: SkhcScoreTrend | null;
  subject_performance: SkhcSubjectPerformance[];
  subject_diagnostics: SkhcSubjectDiagnostic[];
  proficiency_radar: SkhcRadarItem[];
  improvement_plan: SkhcImprovementPlanItem[];
  overall_assessment: SkhcOverallAssessment | null;
  unavailable_sections: string[];
}

export interface AttemptDetailResponse {
  attempt: {
    attempt_id: string;
    test_name: string | null;
    test_mode: string | null;
    course_id: string | null;
    subject: string | null;
    score: number | null;
    max_score: number | null;
    percentage: number | null;
    start_time: string;
    end_time: string | null;
    status: string;
    auto_submitted: boolean;
    malpractice_events: unknown[];
    attempt_type: 'test' | 'eval';
    analysis_text?: string | null;
  };
  stats: AttemptStats;
  skhc_report?: SkhcReport | null;
  performance_breakdown?: PerformanceBreakdown | null;
  ai_report: {
    generation_status: string;
    overall_summary: string | null;
    strengths: (StrengthItem | string)[];
    improvement_areas: (ImprovementAreaItem | string)[];
    question_reviews: any[];
    recommendations: string[];
  } | null;
  /**
   * The LLM-generated report narrative, cached server-side the first time
   * someone views this attempt's report (see `requestReportInsights` below).
   * Null while nothing has been generated yet — `buildAttemptReport` falls
   * back to computing every one of these sections deterministically in that
   * case, so a missing value here is never a broken report, just an
   * un-primed cache.
   */
  report_insights?: ReportInsightsContent | null;
  questions: QuestionReviewItem[];
}

/**
 * One report's worth of LLM-generated narrative text. Every section here has
 * a deterministic counterpart computed in attempt-report.ts and is used only
 * when present — a response missing a section, or missing one subject's
 * entry in a keyed section, degrades to that section's (or that subject's)
 * deterministic text rather than the whole report falling back.
 */
export interface ReportInsightsContent {
  verdict: { label: string; note: string; detail: string };
  quick_insights: Array<{ text: string; evidence?: string[]; basis: string }>;
  /** Up to 7 sentences reading the proficiency radar aloud. */
  radar_interpretation?: string[] | null;
  /** One sentence per subject id. */
  subject_diagnosis?: Record<string, string> | null;
  analyses?: {
    by_subject?: string;
    error_focus?: string;
    difficulty?: string;
    time?: string;
    question_type?: string;
  } | null;
  coverage?: {
    overall?: string;
    /** Keyed by subject id — one entry per row with a coverage gap. */
    rows?: Record<string, { action: string; rationale: string }>;
  } | null;
  /** Keyed by subject id — one sentence per ranked (or queued) priority. */
  priorities?: Record<string, string> | null;
  model: string;
  generated_at: string | null;
  source: 'llm';
}

/** GET /api/v1/user/history/{attemptId} — full attempt detail with question data */
export function getAttemptDetail(attemptId: string): Promise<AttemptDetailResponse> {
  return userApi.get<AttemptDetailResponse>(`/api/v1/user/history/${attemptId}`);
}

/**
 * POST /api/v1/user/history/{attemptId}/report-insights — generate (once) the
 * LLM narrative text for this attempt's report, from facts already computed
 * by `buildAttemptReport` (see `factsFromModel`). Idempotent: safe to call
 * whenever the cache looks empty, since the backend returns the existing row
 * untouched if one was written between this attempt's last read and now.
 */
export function requestReportInsights(
  attemptId: string,
  facts: unknown,
): Promise<ReportInsightsContent> {
  return userApi.post<ReportInsightsContent>(
    `/api/v1/user/history/${attemptId}/report-insights`,
    facts,
  );
}

/** GET /api/v1/user/history/?page=&limit= — paginated attempt history */
export function getAttemptHistory(
  page = 1,
  limit = 50,
): Promise<PaginatedResponse<ApiAttempt>> {
  return userApi.get<PaginatedResponse<ApiAttempt>>(
    `/api/v1/user/history/?page=${page}&limit=${limit}`,
  );
}

/** GET /api/v1/user/notifications/?page=&limit=&is_read= */
export function getNotifications(
  page = 1,
  limit = 50,
  is_read?: boolean,
): Promise<PaginatedResponse<ApiNotification>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (is_read !== undefined) params.set('is_read', String(is_read));
  return userApi.get<PaginatedResponse<ApiNotification>>(
    `/api/v1/user/notifications/?${params}`,
  );
}

/** PATCH /api/v1/user/notifications/{id}/read */
export function markNotificationReadApi(
  notificationId: string,
): Promise<ApiNotification> {
  return userApi.patch<ApiNotification>(
    `/api/v1/user/notifications/${notificationId}/read`,
  );
}

/** PATCH /api/v1/user/notifications/read-all */
export function markAllNotificationsReadApi(): Promise<{ message: string; success: boolean }> {
  return userApi.patch<{ message: string; success: boolean }>(
    '/api/v1/user/notifications/read-all',
  );
}

/** DELETE /api/v1/user/notifications/clear */
export function clearAllNotificationsApi(): Promise<{ message: string; success: boolean }> {
  return userApi.delete<{ message: string; success: boolean }>(
    '/api/v1/user/notifications/clear',
  );
}

// ─── Course Tests ─────────────────────────────────────────────────────────────

/** Shape returned by GET /api/v1/user/courses/{id}/tests */
export interface ApiTest {
  test_id: string;
  name: string | null;
  course_id: string;
  source_type: string;
  source_id: string | null;
  subject: string | null;
  question_count: number;
  difficulty: string | null;
  /** practice | mock */
  mode: 'practice' | 'mock';
  /** Duration in minutes (0 = untimed) */
  time_limit: number;
  negative_marking: boolean;
  negative_marking_fraction: number;
  price: number;
  required_tier: string | null;
  link_token: string;
  status: string;
  created_at: string;
  published_at: string | null;
  shareable_link: string | null;
  /** Server-computed: true when the user's subscription tier is insufficient */
  is_locked: boolean;
  /** Server-computed: true when the user has never attempted this test */
  is_new: boolean;
  lock_reason: string | null;
}

/**
 * GET /api/v1/user/courses/{courseId}/tests
 * Returns all active/published tests for the given course.
 * Pass `mode` to filter by 'practice' or 'mock'.
 */
export function getCourseTests(
  courseId: string,
  mode?: 'practice' | 'mock',
): Promise<ApiTest[]> {
  const params = mode ? `?mode=${mode}` : '';
  return userApi.get<ApiTest[]>(`/api/v1/user/courses/${courseId}/tests${params}`);
}

// ─── Course Evaluation-Hub Assessments ───────────────────────────────────────

/** Shape returned by GET /api/v1/user/courses/{id}/assessments */
export interface ApiEvalAssessment {
  assessment_id: string;
  title: string;
  /** 'practice' | 'mock'  (backend normalises "exam" → "mock") */
  mode: 'practice' | 'mock';
  difficulty: string | null;
  question_count: number;
  max_score: number;
  /** Duration in whole minutes, null = untimed */
  time_limit_minutes: number | null;
  negative_marking: boolean;
  negative_mark_value: number | null;
  due_date: string | null;
  created_at: string;
  /** true if the current user has an invitation for this assessment */
  has_invitation: boolean;
  /** Invitation token → pass to /take-assessment?token=... (null if not invited) */
  invitation_token: string | null;
  pricing_type: 'free' | 'paid';
  shuffle_questions: boolean;
  max_attempts: number | null;
}

/**
 * GET /api/v1/user/courses/{courseId}/assessments
 * Returns Evaluation-Hub assessments mapped to this course,
 * enriched with the current user's invitation status.
 */
export function getCourseEvalAssessments(courseId: string): Promise<ApiEvalAssessment[]> {
  return userApi.get<ApiEvalAssessment[]>(`/api/v1/user/courses/${courseId}/assessments`);
}

/**
 * GET /api/v1/user/eval-assessments?board=&grade=
 * All assessments available to the student, filtered by their board + grade.
 * Used by the dashboard "Your Assessments" list (no enrolled-courses lookup needed).
 */
export function getUserAssessments(params?: { board?: string; grade?: number }): Promise<ApiEvalAssessment[]> {
  const qs = new URLSearchParams();
  if (params?.board) qs.set('board', params.board);
  if (params?.grade) qs.set('grade', String(params.grade));
  const suffix = qs.toString() ? `?${qs}` : '';
  return userApi.get<ApiEvalAssessment[]>(`/api/v1/user/eval-assessments${suffix}`);
}

// ─── Free Assessment Taking ───────────────────────────────────────────────────

/** One question rendered in a second language. Display only — answers are always
 *  stored and graded in the paper's primary language. */
export interface QuestionTranslation {
  text?: string;
  options?: string[];
  passage?: string | null;
  /** The worked solution in this language, where the paper carries one. */
  explanation?: string | null;
}

export interface EvalAttemptQuestion {
  question_id: string;
  text: string;
  /** Present on bilingual papers, keyed by language code (e.g. `ta`). */
  translations?: Record<string, QuestionTranslation>;
  type: string;
  subtype?: string;
  options?: any;
  pairs?: any;
  marks: number;
  difficulty?: string;
  subject?: string;
  /**
   * The canonical subject name, where the backend resolved one.
   *
   * `subject` is the wording printed on the booklet — Tamil on a Group 4 paper —
   * so a filter built from it lists every subject in Tamil. This is the same
   * subject under the catalog's name. Read when present; the exam configuration
   * is the fallback.
   */
  subject_name?: string | null;
  chapter?: string;
  subtopic?: string | null;
  attachment_url?: string;
  attachment_name?: string;
  // only present in results
  correct_answer?: any;
  explanation?: string;
  user_answer?: any;
  is_correct?: boolean;
}

export interface StartAttemptResponse {
  attempt_id: string;
  start_time: string;
  time_limit_seconds: number | null;
  questions: EvalAttemptQuestion[];
  responses: Array<{ question_id: string; answer: any }>;
}

export interface SubmitAttemptResponse {
  attempt_id: string;
  score: number;
  max_score: number;
  percentage: number;
  auto_submitted: boolean;
  completed_attempts: number;
  can_retake: boolean;
  questions: EvalAttemptQuestion[];
  responses: Array<{ question_id: string; answer: any }>;
}

export interface AssessmentDetailResponse {
  assessment_id: string;
  title: string;
  difficulty: string;
  mode: string;
  question_count: number;
  max_score: number;
  time_limit_seconds: number | null;
  time_limit_minutes: number | null;
  shuffle_questions: boolean;
  negative_marking: boolean;
  negative_mark_value: number | null;
  max_attempts: number | null;
  attempt_count: number;
  can_attempt: boolean;
  due_date: string | null;
  pricing_type: string;
  course_id: string | null;
  in_progress_attempt_id?: string;
  in_progress_start_time?: string;
  in_progress_responses?: Array<{ question_id: string; answer: any }>;
  in_progress_question_ids?: string[];
}

export function getEvalAssessmentDetail(assessmentId: string): Promise<AssessmentDetailResponse> {
  return userApi.get<AssessmentDetailResponse>(`/api/v1/user/eval-assessments/${assessmentId}`);
}

export function startEvalAttempt(assessmentId: string): Promise<StartAttemptResponse> {
  return userApi.post<StartAttemptResponse>(`/api/v1/user/eval-assessments/${assessmentId}/start`);
}

export function autosaveEvalAttempt(
  assessmentId: string,
  attemptId: string,
  responses: Array<{ question_id: string; answer: any }>,
): Promise<void> {
  return userApi.patch<void>(
    `/api/v1/user/eval-assessments/${assessmentId}/attempts/${attemptId}/autosave`,
    { responses },
  );
}

/** Why an attempt ended. Read back by the report as `attempt_metadata.submit_reason`. */
export type SubmitReason = 'manual' | 'time_expired' | 'tab_violations' | 'browser_close';

export function submitEvalAttempt(
  assessmentId: string,
  attemptId: string,
  responses: Array<{ question_id: string; answer: any }>,
  autoSubmitted = false,
  proctoring?: { tab_violations?: number; submit_reason?: SubmitReason },
): Promise<SubmitAttemptResponse> {
  return userApi.post<SubmitAttemptResponse>(
    `/api/v1/user/eval-assessments/${assessmentId}/attempts/${attemptId}/submit`,
    {
      responses,
      auto_submitted: autoSubmitted,
      // The client is the only place that knows how often the candidate left the
      // tab and what forced the submit — this flow has no per-violation endpoint
      // like the test engine's `recordTestMalpractice`. Without these two fields
      // every report reads "Tab / window switches: 0" no matter what happened.
      tab_violations: proctoring?.tab_violations ?? 0,
      submit_reason: proctoring?.submit_reason ?? (autoSubmitted ? 'time_expired' : 'manual'),
    },
  );
}

/** PATCH — persist the AI analysis text after SSE streaming completes. */
export function saveEvalAnalysis(
  assessmentId: string,
  attemptId: string,
  analysisText: string,
): Promise<{ saved: boolean }> {
  return userApi.patch<{ saved: boolean }>(
    `/api/v1/user/eval-assessments/${assessmentId}/attempts/${attemptId}/save-analysis`,
    { analysis_text: analysisText },
  );
}

// ─── Test Engine (regular tests via /api/v1/test-engine/) ───────────────────

/** A single question returned by the test engine (correct_answer is stripped). */
export interface TestEngineQuestion {
  question_id: string;
  title: string;
  body: string;
  options: string[] | null;
  question_type: string;
  subject: string;
  difficulty: string;
  tags: string[] | null;
  correct_answer: '';
}

/** Response from POST /api/v1/test-engine/{testId}/start */
export interface StartTestAttemptResponse {
  attempt_id: string;
  test_id: string;
  questions: TestEngineQuestion[];
  time_limit: number;
  negative_marking: boolean;
  negative_marking_fraction: number;
}

/** Detail for a single test — GET /api/v1/user/tests/{testId} */
export interface TestDetail {
  test_id: string;
  name: string | null;
  course_id: string;
  subject: string | null;
  mode: 'practice' | 'mock';
  question_count: number;
  difficulty: string | null;
  time_limit: number;
  negative_marking: boolean;
  negative_marking_fraction: number;
  price: number;
  required_tier: string | null;
  status: string;
}

export function getTestDetail(testId: string): Promise<TestDetail> {
  return userApi.get<TestDetail>(`/api/v1/user/tests/${testId}`);
}

export function startTestAttempt(testId: string, promoCode?: string): Promise<StartTestAttemptResponse> {
  const params = promoCode ? `?promo_code=${encodeURIComponent(promoCode)}` : '';
  return userApi.post<StartTestAttemptResponse>(`/api/v1/test-engine/${testId}/start${params}`);
}

export function saveTestAnswer(
  attemptId: string,
  questionId: string,
  selectedAnswer: string,
  timeSpentSeconds?: number,
): Promise<{ message: string }> {
  return userApi.post<{ message: string }>(`/api/v1/test-engine/${attemptId}/answer`, {
    question_id: questionId,
    selected_answer: selectedAnswer,
    time_spent_seconds: timeSpentSeconds ?? 0,
  });
}

export function flagTestQuestion(
  attemptId: string,
  questionId: string,
  flagged: boolean,
): Promise<{ message: string }> {
  return userApi.post<{ message: string }>(`/api/v1/test-engine/${attemptId}/flag`, {
    question_id: questionId,
    flagged,
  });
}

export function recordTestMalpractice(
  attemptId: string,
  eventType: string,
  timestamp?: string,
): Promise<{ message: string }> {
  return userApi.post<{ message: string }>(`/api/v1/test-engine/${attemptId}/malpractice`, {
    event_type: eventType,
    timestamp: timestamp ?? new Date().toISOString(),
  });
}

export interface TestAttemptResult {
  attempt_id: string;
  test_id: string;
  score: number | null;
  percentage: number | null;
  status: string;
  auto_submitted: boolean;
  start_time: string;
  end_time: string | null;
}

export function submitTestAttempt(
  attemptId: string,
  proctoring?: { tab_violations?: number; submit_reason?: SubmitReason },
): Promise<TestAttemptResult> {
  // Individual violations already go through `recordTestMalpractice`; this records
  // the outcome — whether the paper was force-submitted, and why.
  return userApi.post<TestAttemptResult>(`/api/v1/test-engine/${attemptId}/submit`, {
    auto_submitted: (proctoring?.submit_reason ?? 'manual') !== 'manual',
    tab_violations: proctoring?.tab_violations ?? 0,
    submit_reason: proctoring?.submit_reason ?? 'manual',
  });
}

/**
 * Stream an AI analysis for a completed attempt via SSE.
 * Uses raw fetch (not userApi) because EventSource doesn't support Auth headers.
 * Returns an AbortController — call .abort() to cancel.
 */
export function analyzeEvalAttempt(
  assessmentId: string,
  attemptId: string,
  onDelta: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void,
): AbortController {
  const controller = new AbortController();
  const token = getUserToken();

  (async () => {
    try {
      const res = await fetch(
        buildUrl(
          `/api/v1/user/eval-assessments/${assessmentId}/attempts/${attemptId}/analyze`,
        ),
        {
          headers: { Authorization: token ? `Bearer ${token}` : '' },
          signal: controller.signal,
        },
      );

      if (!res.ok) {
        onError(`Analysis request failed: ${res.status}`);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE messages are delimited by double newlines
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          for (const line of part.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'analysis' && event.delta) {
                onDelta(event.delta);
              } else if (event.type === 'done') {
                onDone();
              } else if (event.type === 'error') {
                onError(event.message ?? 'Analysis failed');
              }
            } catch {
              // ignore malformed SSE lines
            }
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        onError(err?.message ?? 'Analysis connection failed');
      }
    }
  })();

  return controller;
}
