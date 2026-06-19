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
  difficulty: string;
  explanation: string | null;
  tip: string | null;
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
  ai_report: {
    generation_status: string;
    overall_summary: string | null;
    strengths: (StrengthItem | string)[];
    improvement_areas: (ImprovementAreaItem | string)[];
    question_reviews: any[];
    recommendations: string[];
  } | null;
  questions: QuestionReviewItem[];
}

/** GET /api/v1/user/history/{attemptId} — full attempt detail with question data */
export function getAttemptDetail(attemptId: string): Promise<AttemptDetailResponse> {
  return userApi.get<AttemptDetailResponse>(`/api/v1/user/history/${attemptId}`);
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

// ─── Free Assessment Taking ───────────────────────────────────────────────────

export interface EvalAttemptQuestion {
  question_id: string;
  text: string;
  type: string;
  subtype?: string;
  options?: any;
  pairs?: any;
  marks: number;
  difficulty?: string;
  subject?: string;
  chapter?: string;
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

export function submitEvalAttempt(
  assessmentId: string,
  attemptId: string,
  responses: Array<{ question_id: string; answer: any }>,
  autoSubmitted = false,
): Promise<SubmitAttemptResponse> {
  return userApi.post<SubmitAttemptResponse>(
    `/api/v1/user/eval-assessments/${assessmentId}/attempts/${attemptId}/submit`,
    { responses, auto_submitted: autoSubmitted },
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

export function submitTestAttempt(attemptId: string): Promise<TestAttemptResult> {
  return userApi.post<TestAttemptResult>(`/api/v1/test-engine/${attemptId}/submit`);
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
