# API Specification — Online Test & Assessment Platform

Maps every endpoint the BRD (v1.0, May 2026) requires, plus the endpoints the current frontend already calls. Each entry lists method, path, inputs, and the response shape.

**Conventions**

- Base URL: `/api/v1`
- All responses are JSON unless noted. Errors use shape `{ "error": { "code": string, "message": string, "details"?: any } }` with appropriate HTTP status (400 / 401 / 403 / 404 / 409 / 422 / 429 / 500).
- All authenticated endpoints require `Authorization: Bearer <jwt>` header. Admin endpoints additionally require an admin-role JWT.
- Timestamps are ISO 8601 strings (UTC).
- IDs are opaque strings (`usr_xxx`, `crs_xxx`, `test_xxx`, etc.).
- Cursor-based pagination uses `?cursor=<opaque>&limit=<n>`; list responses include `{ items, next_cursor }`.

---

## Table of Contents

1. [Shared Types](#1-shared-types)
2. [Authentication](#2-authentication)
3. [Admin — Dashboard](#3-admin--dashboard)
4. [Admin — Courses](#4-admin--courses)
5. [Admin — Question Bank](#5-admin--question-bank)
6. [Admin — Papers](#6-admin--papers)
7. [Admin — Tests / Assessments](#7-admin--tests--assessments)
8. [Admin — Promo Codes](#8-admin--promo-codes)
9. [Admin — Subscription Plans](#9-admin--subscription-plans)
10. [Admin — Users](#10-admin--users)
11. [Admin — Attempts & Reports](#11-admin--attempts--reports)
12. [Admin — Payments](#12-admin--payments)
13. [Admin — Audit Log](#13-admin--audit-log)
14. [Admin — Settings](#14-admin--settings)
15. [User — Profile](#15-user--profile)
16. [User — Courses & Tests](#16-user--courses--tests)
17. [User — Test Engine](#17-user--test-engine)
18. [User — AI Reports](#18-user--ai-reports)
19. [User — Promo Codes](#19-user--promo-codes)
20. [User — Subscription](#20-user--subscription)
21. [User — Payments](#21-user--payments)
22. [User — Notifications](#22-user--notifications)
23. [User — History](#23-user--history)
24. [File Uploads](#24-file-uploads)
25. [Webhooks](#25-webhooks)

---

## 1. Shared Types

```ts
type SubscriptionTier = 'free' | 'standard' | 'ultimate' | 'premium';
type AssessmentMode = 'practice' | 'mock';
type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';
type QuestionType = 'mcq' | 'true_false' | 'fill_blank' | 'short_answer';
type McqSubtype = 'standard' | 'multi_correct' | 'assertion_reasoning' | 'case_study' | 'hots' | 'matching';
type CourseStatus = 'active' | 'draft' | 'archived';
type TestStatus = 'draft' | 'published' | 'deactivated' | 'archived';
type AttemptStatus = 'in_progress' | 'submitted' | 'auto_submitted' | 'expired';
type AdminRole = 'super_admin' | 'content_admin';
type UserStatus = 'active' | 'locked' | 'suspended';
type PromoScope = 'test' | 'subscription' | 'platform';
type PromoStatus = 'active' | 'paused' | 'expired' | 'exhausted';
type PaymentMethod = 'card' | 'upi' | 'netbanking' | 'wallet';
type TxnStatus = 'success' | 'failed' | 'refunded';
type BillingCycle = 'monthly' | 'yearly';

interface Pagination<T> {
  items: T[];
  next_cursor: string | null;
  total?: number;
}

interface ApiError {
  error: { code: string; message: string; details?: any };
}
```

## 3. Admin — Dashboard

### 3.1 Get Dashboard KPIs — BRD §3.1.5
`GET /api/v1/admin/dashboard/metrics`

**Response 200**
```ts
{
  total_questions: number;
  total_papers: number;
  active_tests: number;
  archived_tests: number;
  total_users: number;
  active_subscriptions: number;
  total_attempts_month: number;
  reports_generated_month: number;
  delta: {
    total_questions: { value: number; trend: 'up' | 'down' | 'flat'; period: string };
    // …same shape per key
  };
}
```

### 3.2 Daily Attempts Chart
`GET /api/v1/admin/dashboard/daily-attempts?days=7`

**Response 200**
```ts
{
  buckets: Array<{
    date: string;          // YYYY-MM-DD
    label: string;         // "Mon"
    practice: number;
    mock: number;
  }>;
}
```

### 3.3 Recent Attempts Strip
`GET /api/v1/admin/dashboard/recent-attempts?limit=10`

**Response 200**
```ts
{
  items: Array<{
    attempt_id: string;
    user_name: string;
    user_id: string;
    test: string;
    course: string;
    mode: AssessmentMode;
    score: number;
    total: number;
    percentage: number;
    date: string;
    malpractice_events?: number;
    auto_submitted?: boolean;
  }>;
}
```

### 3.4 Subscription Distribution
`GET /api/v1/admin/dashboard/subscription-distribution`

**Response 200**
```ts
{
  total: number;
  distribution: Array<{
    tier: SubscriptionTier;
    count: number;
    percentage: number;
  }>;
}
```

### 3.5 Recent Tests with Shareable Links
`GET /api/v1/admin/dashboard/recent-tests?limit=5`

**Response 200**
```ts
{
  items: Array<{
    test_id: string;
    name: string;
    course: string;
    mode: AssessmentMode;
    promo_code?: string;
    attempts_count: number;
    link_token: string;
    created_at: string;
  }>;
}
```

### 3.6 Top Courses
`GET /api/v1/admin/dashboard/top-courses?limit=5`

**Response 200**
```ts
{
  items: Array<{
    course_id: string;
    name: string;
    attempts: number;
    avg_score: number;
  }>;
}
```

---

## 4. Admin — Courses

BRD §3.1.5 — *"Admin can manage courses (create, edit, archive)"*

### 4.1 List Courses
`GET /api/v1/admin/courses?status=&search=&cursor=&limit=50`

**Query**: `status?: CourseStatus | 'all'`, `search?: string`
**Response 200**: `Pagination<AdminCourse>`

```ts
interface AdminCourse {
  course_id: string;
  name: string;
  description: string;
  subject: string;
  status: CourseStatus;
  exam_body?: 'ICAI' | 'ICMAI' | 'ICSI' | 'Other';
  thumbnail_color: string;
  enrolled_users: number;
  total_tests: number;
  created_by: string;
  created_at: string;
}
```

### 4.2 Create Course
`POST /api/v1/admin/courses`

**Request**
```ts
{
  name: string;             // required, max 200
  description: string;      // required
  subject: string;          // required
  exam_body?: 'ICAI' | 'ICMAI' | 'ICSI' | 'Other';
  thumbnail_color: string;  // tailwind gradient class
  status?: CourseStatus;    // default 'draft'
}
```
**Response 201**: `AdminCourse`

### 4.3 Get Course
`GET /api/v1/admin/courses/{course_id}`
**Response 200**: `AdminCourse`

### 4.4 Update Course
`PATCH /api/v1/admin/courses/{course_id}`

**Request**: any subset of create fields.
**Response 200**: `AdminCourse`

### 4.5 Archive Course
`POST /api/v1/admin/courses/{course_id}/archive`
**Response 200**: `AdminCourse` (with `status: 'archived'`)

### 4.6 Restore Course
`POST /api/v1/admin/courses/{course_id}/restore`
**Response 200**: `AdminCourse` (with `status: 'active'`)

### 4.7 Delete Course
`DELETE /api/v1/admin/courses/{course_id}`
**Response 204**: empty. **Errors**: `409` if active tests reference it.

---

## 5. Admin — Question Bank

BRD §3.1.2 / §3.1.3

### 5.1 Generate Questions (AI)
`POST /api/v1/admin/questions/generate`

**Request**
```ts
{
  title: string;                  // required, max 200
  source: {
    type: 'file' | 'topic';
    file_id?: string;             // from §24.1 upload, when type='file'
    topic?: string;               // when type='topic'
  };
  subject: string;                // required
  question_count: number;         // 1-200 per batch
  question_types: QuestionType[]; // at least one
  mcq_subtypes?: McqSubtype[];
  difficulty: Difficulty;
  blooms_level?: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create' | 'mixed';
  language?: 'en' | 'hi' | 'ta';
  negative_marking?: boolean;
  negative_mark_value?: number;
}
```
**Response 202** (async)
```ts
{
  generation_job_id: string;
  status: 'queued' | 'in_progress';
  estimated_seconds: number;
}
```

### 5.2 Get Generation Status
`GET /api/v1/admin/questions/generate/{job_id}`

**Response 200**
```ts
{
  job_id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress_pct: number;
  questions?: GeneratedQuestion[];  // populated when completed
  error?: string;                   // when failed
}

interface GeneratedQuestion {
  temp_id: string;
  question_text: string;
  question_type: QuestionType;
  mcq_subtype?: McqSubtype;
  options?: string[];               // for MCQ
  correct_answer: string | string[];
  explanation?: string;
  difficulty: Difficulty;
  subject: string;
  blooms_level?: string;
  marks: number;
}
```

### 5.3 Save Generated Questions (after review)
`POST /api/v1/admin/questions/save`

**Request**
```ts
{
  job_id: string;
  paper_id?: string;                // if assembling into a paper too
  questions: GeneratedQuestion[];   // possibly edited from generation
  tags?: string[];
}
```
**Response 201**
```ts
{
  saved: Question[];                // see 5.5 schema
  paper_id?: string;                // if paper was created/updated
}
```

### 5.4 List Questions (Question Bank)
`GET /api/v1/admin/questions?subject=&type=&difficulty=&search=&tag=&paper_id=&cursor=&limit=50`

**Query**: `subject?`, `type?: QuestionType`, `difficulty?`, `search?`, `tag?`, `paper_id?`, `source?: 'ai' | 'manual'`, `grade?`, `board?`, `blooms_level?`
**Response 200**: `Pagination<Question>`

```ts
interface Question {
  question_id: string;
  question_text: string;
  question_type: QuestionType;
  mcq_subtype?: McqSubtype;
  options?: string[];
  correct_answer: string | string[];
  explanation?: string;
  marks: number;
  subject: string;
  difficulty: Difficulty;
  blooms_level?: string;
  source: 'ai' | 'manual';
  paper_ids: string[];
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}
```

### 5.5 Get Question
`GET /api/v1/admin/questions/{question_id}`
**Response 200**: `Question`

### 5.6 Update Question
`PATCH /api/v1/admin/questions/{question_id}`

**Request**: any subset of `{ question_text, options, correct_answer, explanation, marks, subject, difficulty, mcq_subtype, blooms_level, tags }`
**Response 200**: `Question`

### 5.7 Delete Question
`DELETE /api/v1/admin/questions/{question_id}`
**Response 204**: empty

### 5.8 Regenerate Single Question
`POST /api/v1/admin/questions/{question_id}/regenerate`
**Response 200**: `Question` (replaced content, same id)

### 5.9 Add / Remove Tags
`POST /api/v1/admin/questions/{question_id}/tags` — Request: `{ tags: string[] }`
`DELETE /api/v1/admin/questions/{question_id}/tags` — Request: `{ tags: string[] }`
**Response 200**: `Question`

### 5.10 Bulk Delete
`POST /api/v1/admin/questions/bulk-delete`
**Request**: `{ question_ids: string[] }`
**Response 200**: `{ deleted: number; skipped: string[] }`

---

## 6. Admin — Papers

### 6.1 List Papers
`GET /api/v1/admin/papers?search=&cursor=&limit=50`

**Response 200**: `Pagination<Paper>`

```ts
interface Paper {
  paper_id: string;
  name: string;
  question_count: number;
  question_ids: string[];
  grade?: number;
  board?: string;
  subjects: string[];
  difficulty: Difficulty;
  created_by: string;
  created_at: string;
  updated_at: string;
}
```

### 6.2 Create Paper
`POST /api/v1/admin/papers`

**Request**
```ts
{
  name: string;
  question_ids: string[];
  grade?: number;
  board?: string;
}
```
**Response 201**: `Paper`

### 6.3 Get Paper
`GET /api/v1/admin/papers/{paper_id}`
**Response 200**: `Paper`

### 6.4 Get Paper Questions
`GET /api/v1/admin/papers/{paper_id}/questions?limit=`
**Response 200**: `{ items: Question[] }`

### 6.5 Update Paper
`PATCH /api/v1/admin/papers/{paper_id}`
**Request**: `{ name?: string }` (rename only — content edits via question endpoints)
**Response 200**: `Paper`

### 6.6 Add / Remove Questions from Paper
`POST /api/v1/admin/papers/{paper_id}/questions`
**Request**: `{ question_ids: string[] }`
**Response 200**: `Paper`

`DELETE /api/v1/admin/papers/{paper_id}/questions`
**Request**: `{ question_ids: string[] }`
**Response 200**: `Paper`

### 6.7 Delete Paper
`DELETE /api/v1/admin/papers/{paper_id}`
**Response 204**: empty. **Errors**: `409` if active tests reference it.

---

## 7. Admin — Tests / Assessments

BRD §3.1.4

### 7.1 List Tests
`GET /api/v1/admin/tests?course_id=&status=&mode=&search=&cursor=&limit=50`

**Response 200**: `Pagination<Test>`

```ts
interface Test {
  test_id: string;
  name: string;
  course_id: string;
  course_name: string;
  source_type: 'paper' | 'question_bank';
  source_id?: string;
  subject: string;
  question_types: QuestionType[];
  question_count: number;
  difficulty: Difficulty;
  mode: AssessmentMode;
  time_limit_min: number;            // 0 = no limit
  negative_marking: boolean;
  negative_mark_value?: number;      // e.g. 0.25
  required_tier: SubscriptionTier;
  price: number;                     // INR
  promo_code?: string;
  link_token: string;                // unique per BRD §3.1.4
  shareable_url: string;             // full URL
  status: TestStatus;
  attempts_count: number;
  created_by: string;
  created_at: string;
}
```

### 7.2 Create Test — BRD §3.1.4
`POST /api/v1/admin/tests`

**Request**
```ts
{
  name: string;
  course_id: string;                 // mandatory per BRD
  source_type: 'paper' | 'question_bank';
  source_id?: string;                // paper_id or null for bank
  subjects: string[];
  question_types: QuestionType[];
  question_count: number;
  difficulty: Difficulty;
  mode: AssessmentMode;
  time_limit_min: number;            // required when mode='mock'
  negative_marking: boolean;
  negative_mark_value?: number;
  required_tier?: SubscriptionTier;
  price?: number;
  promo_code?: string;
}
```
**Response 201**: `Test` (with `link_token` + `shareable_url`)

### 7.3 Get Test
`GET /api/v1/admin/tests/{test_id}`
**Response 200**: `Test`

### 7.4 Update Test
`PATCH /api/v1/admin/tests/{test_id}`
**Request**: any subset of create fields.
**Response 200**: `Test`

### 7.5 Publish Test
`POST /api/v1/admin/tests/{test_id}/publish`
**Response 200**: `Test` (with `status: 'published'`)
**Side-effect**: triggers notification to enrolled users (BRD §3.2.5).

### 7.6 Deactivate Test
`POST /api/v1/admin/tests/{test_id}/deactivate`
**Response 200**: `Test`

### 7.7 Archive Test
`POST /api/v1/admin/tests/{test_id}/archive`
**Response 200**: `Test`

### 7.8 Share via Email — BRD §3.1.4
`POST /api/v1/admin/tests/{test_id}/share-email`

**Request**
```ts
{
  recipients: string[];   // email addresses
  message?: string;       // optional personalised note
}
```
**Response 200**: `{ sent: number; failed: Array<{ email: string; reason: string }> }`

### 7.9 Regenerate Test Link
`POST /api/v1/admin/tests/{test_id}/rotate-token`
**Response 200**: `{ link_token: string; shareable_url: string }`

### 7.10 Delete Test
`DELETE /api/v1/admin/tests/{test_id}`
**Response 204**: empty. **Errors**: `409` if attempts exist.

---

## 8. Admin — Promo Codes

BRD §7 Promo Code entity

### 8.1 List Promo Codes
`GET /api/v1/admin/promos?scope=&status=&search=&cursor=&limit=50`

**Response 200**: `Pagination<PromoCode>`

```ts
interface PromoCode {
  code_id: string;
  code_string: string;
  scope: PromoScope;
  test_id?: string;          // when scope='test'
  test_name?: string;
  discount_pct: number;       // 1-100
  max_uses: number | null;    // null = unlimited
  used_count: number;
  expiry_date: string | null;
  status: PromoStatus;
  applies_to_tiers?: SubscriptionTier[];
  applies_to_billing?: BillingCycle[];
  created_by: string;
  created_at: string;
}
```

### 8.2 Create Promo Code
`POST /api/v1/admin/promos`

**Request**
```ts
{
  code_string: string;            // unique, uppercased
  scope: PromoScope;
  test_id?: string;
  discount_pct: number;           // 1-100
  max_uses?: number | null;
  expiry_date?: string | null;
  applies_to_tiers?: SubscriptionTier[];
  applies_to_billing?: BillingCycle[];
}
```
**Response 201**: `PromoCode`
**Errors**: `409` code_string already exists.

### 8.3 Get Promo Code
`GET /api/v1/admin/promos/{code_id}`
**Response 200**: `PromoCode`

### 8.4 Update Promo Code
`PATCH /api/v1/admin/promos/{code_id}`
**Request**: any subset of create fields (except `code_string`).
**Response 200**: `PromoCode`

### 8.5 Pause / Resume
`POST /api/v1/admin/promos/{code_id}/pause` → `PromoCode` with `status: 'paused'`
`POST /api/v1/admin/promos/{code_id}/resume` → `PromoCode` with `status: 'active'`

### 8.6 Delete Promo Code
`DELETE /api/v1/admin/promos/{code_id}`
**Response 204**: empty

### 8.7 Promo Analytics
`GET /api/v1/admin/promos/{code_id}/analytics`

**Response 200**
```ts
{
  total_redemptions: number;
  total_discount_given: number;     // INR
  total_revenue: number;            // INR
  by_day: Array<{ date: string; count: number; discount: number }>;
  recent_redemptions: Array<{
    user_id: string;
    user_name: string;
    discount: number;
    redeemed_at: string;
  }>;
}
```

---

## 9. Admin — Subscription Plans

BRD §3.4 / §4.4 — *"configurable via admin UI without a code deployment"*

### 9.1 List Plans
`GET /api/v1/admin/plans`

**Response 200**: `{ items: Plan[] }`

```ts
interface Plan {
  tier: SubscriptionTier;
  name: string;
  active: boolean;
  highlight: boolean;
  price_monthly: number;
  price_yearly: number;
  duration_days_monthly: number;
  duration_days_yearly: number;
  features: {
    practice_tests_per_month: number | 'unlimited';
    mock_tests_per_month: number | 'unlimited' | 'none';
    ai_report_level: 'basic' | 'standard' | 'detailed' | 'full';
    history_retention_days: number | 'unlimited';
    support: string;
    download_pdf: boolean;
  };
  perks: string[];
}
```

### 9.2 Update Plan
`PATCH /api/v1/admin/plans/{tier}`

**Request**: any subset of `Plan` fields (except `tier`).
**Response 200**: `Plan`

### 9.3 Toggle Plan Active
`POST /api/v1/admin/plans/{tier}/toggle-active`
**Response 200**: `Plan`

---

## 10. Admin — Users

### 10.1 List Users
`GET /api/v1/admin/users?tier=&status=&search=&cursor=&limit=50`

**Query**: `tier?: SubscriptionTier`, `status?: UserStatus`, `search?` (matches name / email / phone)
**Response 200**: `Pagination<AdminUserView>`

```ts
interface AdminUserView {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  subscription_tier: SubscriptionTier;
  subscription_expiry: string;
  status: UserStatus;
  otp_verified: boolean;
  failed_login_attempts: number;
  total_attempts: number;
  total_spent: number;
  last_login: string | null;
  created_at: string;
}
```

### 10.2 Get User Detail
`GET /api/v1/admin/users/{user_id}`

**Response 200**
```ts
{
  ...AdminUserView,
  recent_attempts: Array<{ attempt_id: string; test: string; score: number; date: string }>;
  recent_transactions: Array<{ txn_id: string; type: 'test' | 'subscription'; amount: number; date: string }>;
}
```

### 10.3 Lock / Unlock User — BRD §3.2.2
`POST /api/v1/admin/users/{user_id}/lock`
**Response 200**: `AdminUserView`

`POST /api/v1/admin/users/{user_id}/unlock`
**Response 200**: `AdminUserView` (resets `failed_login_attempts` to 0)

### 10.4 Suspend / Reactivate User
`POST /api/v1/admin/users/{user_id}/suspend`
**Request**: `{ reason?: string }`
**Response 200**: `AdminUserView`

`POST /api/v1/admin/users/{user_id}/reactivate`
**Response 200**: `AdminUserView`

### 10.5 Force Subscription Change (manual override)
`PATCH /api/v1/admin/users/{user_id}/subscription`
**Request**: `{ tier: SubscriptionTier; expiry: string }`
**Response 200**: `AdminUserView`

### 10.6 Export Users CSV
`GET /api/v1/admin/users/export?tier=&status=&search=`
**Response 200**: `text/csv` stream
**Headers**: `Content-Disposition: attachment; filename=users-YYYY-MM-DD.csv`

### 10.7 GDPR / DPDP Data Export (per user) — BRD §4.5
`POST /api/v1/admin/users/{user_id}/data-export`
**Response 202**: `{ export_job_id: string }`

### 10.8 GDPR / DPDP Account Deletion
`DELETE /api/v1/admin/users/{user_id}`
**Request**: `{ confirm: true; reason: string }`
**Response 204**: empty. Soft-deletes with anonymisation; immutable audit log retained.

---

## 11. Admin — Attempts & Reports

BRD §3.1.6

### 11.1 List All Attempts (full history)
`GET /api/v1/admin/attempts?course_id=&user_id=&test_id=&mode=&date_from=&date_to=&cursor=&limit=50`

**Response 200**: `Pagination<AdminAttempt>`

```ts
interface AdminAttempt {
  attempt_id: string;
  user_id: string;
  user_name: string;
  test_id: string;
  test_name: string;
  course_id: string;
  course_name: string;
  mode: AssessmentMode;
  score: number;
  total_marks: number;
  percentage: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  time_taken_sec: number;
  date: string;
  malpractice_events: number;
  auto_submitted: boolean;
  status: AttemptStatus;
}
```

### 11.2 Get Attempt Detail (with malpractice events)
`GET /api/v1/admin/attempts/{attempt_id}`

**Response 200**
```ts
{
  ...AdminAttempt,
  answers: Array<{
    question_id: string;
    question_text: string;
    user_answer: string | string[] | null;
    correct_answer: string | string[];
    is_correct: boolean;
    marks_awarded: number;
    time_spent_sec: number;
  }>;
  malpractice_log: Array<{
    type: 'tab_blur' | 'fullscreen_exit' | 'paste_attempt';
    timestamp: string;
    metadata?: any;
  }>;
}
```

### 11.3 Get Attempt's AI Report
`GET /api/v1/admin/attempts/{attempt_id}/report`
**Response 200**: `AIReport` (see §18.1)

### 11.4 Download Attempt Report PDF
`GET /api/v1/admin/attempts/{attempt_id}/report/pdf`
**Response 200**: `application/pdf` stream

### 11.5 Export Attempts CSV
`GET /api/v1/admin/attempts/export?course_id=&date_from=&date_to=...`
**Response 200**: `text/csv` stream

---

## 12. Admin — Payments

### 12.1 List Transactions
`GET /api/v1/admin/payments?type=&status=&user_id=&date_from=&date_to=&search=&cursor=&limit=50`

**Response 200**: `Pagination<AdminPaymentTxn>`

```ts
interface AdminPaymentTxn {
  txn_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  type: 'test' | 'subscription';
  item_id: string;
  item_name: string;
  mode?: AssessmentMode;
  billing_cycle?: BillingCycle;
  base_amount: number;
  discount_amount: number;
  final_amount: number;
  promo_code?: string;
  status: TxnStatus;
  payment_method: PaymentMethod;
  gateway: 'razorpay' | 'stripe';
  gateway_txn_ref: string;
  invoice_no: string;
  created_at: string;
}
```

### 12.2 Get Transaction
`GET /api/v1/admin/payments/{txn_id}`
**Response 200**: `AdminPaymentTxn`

### 12.3 Revenue Analytics
`GET /api/v1/admin/payments/analytics?range=7d|30d|90d|all`

**Response 200**
```ts
{
  total_revenue: number;
  net_revenue: number;         // after refunds
  refunded_amount: number;
  failed_count: number;
  successful_count: number;
  unique_paying_users: number;
  avg_order_value: number;
  discounts_given: number;
  daily_revenue: Array<{
    date: string;
    total: number;
    tests: number;
    subscriptions: number;
  }>;
  by_method: Array<{ method: PaymentMethod; amount: number; count: number; pct: number }>;
  by_tier: Array<{ tier: SubscriptionTier; revenue: number; count: number }>;
  by_promo: Array<{ code: string; redemptions: number; discount_total: number; revenue: number }>;
}
```

### 12.4 Issue Refund
`POST /api/v1/admin/payments/{txn_id}/refund`

**Request**: `{ amount?: number; reason: string }` (omit amount for full refund)
**Response 200**: `AdminPaymentTxn` (with `status: 'refunded'`)

### 12.5 Export Payments CSV
`GET /api/v1/admin/payments/export?...`
**Response 200**: `text/csv` stream

---

## 13. Admin — Audit Log

BRD §4.5

### 13.1 List Audit Entries
`GET /api/v1/admin/audit-log?resource_type=&actor=&action=&date_from=&date_to=&cursor=&limit=50`

**Response 200**: `Pagination<AuditEntry>`

```ts
interface AuditEntry {
  log_id: string;
  actor_id: string;
  actor_name: string;
  actor_email: string;
  actor_role: AdminRole;
  action:
    | 'question_create' | 'question_edit' | 'question_delete'
    | 'test_publish' | 'test_archive' | 'test_deactivate'
    | 'paper_create' | 'paper_delete'
    | 'course_create' | 'course_archive'
    | 'promo_create' | 'promo_pause'
    | 'plan_update'
    | 'user_lock' | 'user_unlock'
    | 'login' | 'logout';
  resource_type: 'question' | 'test' | 'paper' | 'course' | 'promo' | 'plan' | 'user' | 'session';
  resource_id: string;
  resource_name?: string;
  description: string;
  ip_address: string;
  user_agent?: string;
  timestamp: string;
}
```

### 13.2 Export Audit Log CSV
`GET /api/v1/admin/audit-log/export?...`
**Response 200**: `text/csv` stream

---

## 14. Admin — Settings

BRD §8.1 / §3.1.1

### 14.1 Get Settings
`GET /api/v1/admin/settings`

**Response 200**
```ts
{
  profile: {
    admin_id: string;
    name: string;
    email: string;
    role: AdminRole;
  };
  policy: {
    idle_timeout_minutes: number;
    otp_expiry_minutes: number;
    otp_cooldown_seconds: number;
    max_failed_logins: number;
    malpractice_warning_count: number;
    default_negative_marking_fraction: number;
    subscription_reminder_days: number[];   // e.g. [7, 1]
  };
  notifications: {
    email_on_new_user: boolean;
    email_on_payment_failure: boolean;
    email_on_promo_exhausted: boolean;
  };
}
```

### 14.2 Update Profile
`PATCH /api/v1/admin/settings/profile`
**Request**: `{ name?: string; email?: string }`
**Response 200**: profile object

### 14.3 Change Admin Password
`POST /api/v1/admin/settings/change-password`
**Request**: `{ current_password: string; new_password: string }`
**Response 200**: `{ message: string }`

### 14.4 Update System Policy
`PATCH /api/v1/admin/settings/policy`
**Request**: any subset of policy fields.
**Response 200**: policy object

### 14.5 Update Notification Prefs
`PATCH /api/v1/admin/settings/notifications`
**Request**: any subset of notification flags.
**Response 200**: notifications object

---

## 16. User — Courses & Tests

### 16.1 List My Courses
`GET /api/v1/users/me/courses`

**Response 200**: `{ items: UserCourse[] }`

```ts
interface UserCourse {
  course_id: string;
  name: string;
  description: string;
  subject: string;
  exam_body?: string;
  thumbnail_color: string;
  total_tests: number;
  attempted_tests: number;
  enrolled_at: string;
  has_new: boolean;          // BRD §3.2.4 NEW badge
}
```

### 16.2 List Course Tests
`GET /api/v1/users/me/courses/{course_id}/tests?mode=practice|mock`

**Response 200**: `{ items: UserTest[] }`

```ts
interface UserTest {
  test_id: string;
  name: string;
  subject: string;
  mode: AssessmentMode;
  question_count: number;
  time_limit_min: number;
  difficulty: Difficulty;
  negative_marking: boolean;
  negative_mark_value?: number;
  required_tier: SubscriptionTier;
  price: number;
  has_promo: boolean;
  is_new: boolean;           // §3.2.4
  is_attempted: boolean;
  is_paid: boolean;
  published_at: string;
  unlock: {
    unlocked: boolean;
    reason?: 'tier' | 'monthly_limit' | 'mock_disabled' | 'unpaid';
  };
  subtype_mix?: Array<{ subtype: McqSubtype; count: number }>;
}
```

### 16.3 Get Test Detail (pre-start screen)
`GET /api/v1/users/me/tests/{test_id}`

**Response 200**
```ts
{
  ...UserTest,
  instructions: string[];        // standard instructions
  promo_code_hint?: string;      // only the existence, never the code itself
}
```

---

## 17. User — Test Engine

BRD §3.3

### 17.1 Start Attempt
`POST /api/v1/test-engine/start`

**Request**
```ts
{
  test_id: string;
  // OR for token-based access (shared link):
  link_token?: string;
}
```
**Response 200**
```ts
{
  attempt_id: string;
  started_at: string;
  expires_at: string | null;     // null when no time limit
  question_count: number;
  time_limit_min: number;
  negative_marking: boolean;
  negative_mark_value?: number;
  malpractice_threshold: number; // BRD §3.3.3, default 3
}
```
**Errors**: `402` payment required, `403` tier insufficient, `409` already in_progress, `423` test locked/inactive.

### 17.2 Fetch Questions for Attempt
`GET /api/v1/test-engine/attempts/{attempt_id}/questions`

**Response 200**
```ts
{
  questions: Array<{
    question_id: string;
    q_no: number;
    question_text: string;
    question_type: QuestionType;
    mcq_subtype?: McqSubtype;
    options?: string[];         // shuffled
    marks: number;
    // correct_answer never sent here
  }>;
}
```

### 17.3 Auto-save Answer
`PATCH /api/v1/test-engine/attempts/{attempt_id}/answers/{question_id}`

**Request**: `{ answer: string | string[] | null; time_spent_sec: number; is_flagged: boolean }`
**Response 200**: `{ saved_at: string }`

### 17.4 Flag Question for Review
`POST /api/v1/test-engine/attempts/{attempt_id}/flag/{question_id}`
**Request**: `{ flagged: boolean }`
**Response 200**: `{ flagged: boolean }`

### 17.5 Record Malpractice Event — BRD §3.3.3
`POST /api/v1/test-engine/attempts/{attempt_id}/malpractice`

**Request**
```ts
{
  type: 'tab_blur' | 'fullscreen_exit' | 'paste_attempt' | 'right_click';
  timestamp: string;
  metadata?: any;
}
```
**Response 200**
```ts
{
  warning_count: number;
  threshold: number;
  auto_submit_triggered: boolean;  // true when warning_count === threshold
}
```

### 17.6 Submit Attempt
`POST /api/v1/test-engine/attempts/{attempt_id}/submit`

**Request**
```ts
{
  trigger: 'manual' | 'time_expired' | 'malpractice' | 'browser_close';
}
```
**Response 200**
```ts
{
  attempt_id: string;
  score: number;
  total_marks: number;
  percentage: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  time_taken_sec: number;
  pass_status: 'pass' | 'fail';
  passing_marks: number;
  ai_report_job_id: string;       // async; poll §18.2
}
```

### 17.7 Get Result Summary
`GET /api/v1/test-engine/attempts/{attempt_id}/result`
**Response 200**: same shape as `submit` response

---

## 18. User — AI Reports

BRD §3.5

### 18.1 Get AI Report
`GET /api/v1/users/me/attempts/{attempt_id}/report`

**Response 200**: `AIReport`
**Response 202**: `{ status: 'generating'; job_id: string }` when not yet ready.

```ts
interface AIReport {
  report_id: string;
  attempt_id: string;
  generated_at: string;
  summary: string;
  performance: {
    score: number;
    total_marks: number;
    percentage: number;
    percentile?: number;          // mock only
    pass_status: 'pass' | 'fail';
  };
  strengths: Array<{ topic: string; accuracy: number }>;
  weaknesses: Array<{ topic: string; accuracy: number; recommendation: string }>;
  time_analysis: {
    avg_seconds_per_question: number;
    slow_questions: Array<{ q_no: number; time_spent_sec: number }>;
  };
  question_reviews: Array<{
    q_no: number;
    question: string;
    your_answer: string | null;
    correct_answer: string;
    is_correct: boolean;
    explanation: string;
    time_spent_sec: number;
  }>;
  recommendations: string[];
  recommended_tests: Array<{ test_id: string; name: string; reason: string }>;
}
```

### 18.2 Poll Report Generation
`GET /api/v1/ai-reports/jobs/{job_id}`

**Response 200**
```ts
{
  job_id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress_pct?: number;
  report_id?: string;        // when completed
  error?: string;
}
```

### 18.3 Download Report PDF
`GET /api/v1/users/me/attempts/{attempt_id}/report/pdf`
**Response 200**: `application/pdf` stream
**Errors**: `403` PDF download not allowed for Free tier (BRD AC-10).

---

## 19. User — Promo Codes

BRD §3.2.6

### 19.1 Validate Promo Code (preview discount, no commit)
`POST /api/v1/users/me/promo/validate`

**Request**
```ts
{
  code: string;
  context:
    | { type: 'test'; test_id: string }
    | { type: 'subscription'; tier: SubscriptionTier; billing: BillingCycle };
}
```
**Response 200**
```ts
{
  valid: boolean;
  code: string;
  discount_pct: number;
  base_amount: number;
  discount_amount: number;
  final_amount: number;
  message?: string;
}
```
**Errors**: `400` invalid, `410` expired, `409` exhausted, `403` not applicable.

### 19.2 Redeem Promo Code (commits use)
Embedded inside the payment flow (`§21.1`). For free-tier mock unlocks where no payment occurs:

`POST /api/v1/users/me/promo/redeem`
**Request**: `{ code: string; test_id: string }`
**Response 200**: `{ code: string; redeemed_at: string }`

---

## 20. User — Subscription

### 20.1 Get My Subscription
`GET /api/v1/users/me/subscription`

**Response 200**
```ts
{
  tier: SubscriptionTier;
  expiry: string;
  auto_renew: boolean;
  current_plan: Plan;             // see §9.1
  upgrade_options: Plan[];
}
```

### 20.2 List Available Plans (public)
`GET /api/v1/plans`
**Response 200**: `{ items: Plan[] }` — only `active: true` plans returned.

---

## 22. User — Notifications

BRD §3.2.5

### 22.1 List My Notifications
`GET /api/v1/users/me/notifications?cursor=&limit=30&unread_only=false`

**Response 200**: `Pagination<UserNotification>`

```ts
interface UserNotification {
  notification_id: string;
  type: 'new_test' | 'subscription_reminder' | 'promo' | 'system';
  message: string;
  test_id?: string;
  course_id?: string;
  link_url?: string;
  is_read: boolean;
  created_at: string;
}
```

### 22.2 Unread Count
`GET /api/v1/users/me/notifications/unread-count`
**Response 200**: `{ count: number }`

### 22.3 Mark Notification Read
`PATCH /api/v1/users/me/notifications/{id}/read`
**Response 200**: `UserNotification`

### 22.4 Mark All Read
`POST /api/v1/users/me/notifications/mark-all-read`
**Response 200**: `{ updated: number }`

### 22.5 Clear All
`DELETE /api/v1/users/me/notifications`
**Response 200**: `{ deleted: number }`

### 22.6 WebSocket (real-time delivery) — BRD §6 Push Notification Service
`WSS /api/v1/ws/notifications`
**Auth**: `?access_token=<jwt>` query param.
**Server-pushed messages**:
```ts
{ type: 'notification.created'; payload: UserNotification }
{ type: 'notification.read'; payload: { notification_id: string } }
```

---

## 23. User — History

BRD §3.2.7

### 23.1 List My Attempts
`GET /api/v1/users/me/attempts?course_id=&mode=&date_from=&date_to=&cursor=&limit=50`

**Response 200**: `Pagination<UserAttempt>`

```ts
interface UserAttempt {
  attempt_id: string;
  test_id: string;
  test_name: string;
  course_id: string;
  course_name: string;
  mode: AssessmentMode;
  score: number;
  total_marks: number;
  percentage: number;
  pass_status: 'pass' | 'fail';
  correct: number;
  incorrect: number;
  unattempted: number;
  time_taken_sec: number;
  malpractice_events: number;
  auto_submitted: boolean;
  date: string;
}
```

### 23.2 Get Attempt Detail
`GET /api/v1/users/me/attempts/{attempt_id}`

**Response 200**: same shape as §11.2 (admin attempt detail) without admin-only fields.

---

## 24. File Uploads

BRD §6 File Storage (S3 / signed URLs)

### 24.1 Upload Source File (PDF/DOCX for question generation)
`POST /api/v1/uploads/source`

**Request**: `multipart/form-data` with `file` field.
**Response 200**
```ts
{
  file_id: string;
  filename: string;
  word_count: number;
  extracted_text: string;        // first 2000 chars preview
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
}
```

### 24.2 Get Signed URL for Stored File
`GET /api/v1/files/{file_id}/signed-url?expires_in=300`
**Response 200**: `{ url: string; expires_at: string }`

### 24.3 Avatar Upload (optional)
`POST /api/v1/uploads/avatar`
**Request**: `multipart/form-data`
**Response 200**: `{ avatar_url: string }`


## Cross-cutting Notes

**Rate limits** (BRD §4.2 OWASP):
- Auth endpoints: 10 req/min/IP.
- OTP send: 1 per 60s/account (§3.2.1).
- Login: 5 failed attempts → lock (§3.2.2).
- Test engine answer auto-save: 30 req/min/attempt.

**Idempotency**: All `POST` endpoints that mutate state accept `Idempotency-Key: <uuid>` header.

**Versioning**: URL-versioned (`/api/v1`). Breaking changes go to `/api/v2`.

**Audit log emission** (BRD §4.5): every admin write endpoint emits a `13.1 AuditEntry` row server-side; no client action required.

**Error codes commonly used**:
- `400 invalid_input` — validation
- `401 unauthenticated` — missing/expired token
- `402 payment_required` — paid test without payment
- `403 forbidden` — tier insufficient / wrong role
- `404 not_found`
- `409 conflict` — duplicate, in-use resource
- `410 gone` — expired (OTP, promo)
- `422 unprocessable_entity` — semantic validation
- `423 locked` — account locked
- `429 rate_limited`
- `500 internal_error`

— End of Specification —
