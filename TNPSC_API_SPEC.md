# TNPSC Portal — Backend API Specification

**Audience:** backend engineering team
**Status:** proposed — frontend is already built against this contract
**Companion docs:** [`TNPSC_BACKEND_CHANGES.md`](TNPSC_BACKEND_CHANGES.md) (2-page summary), [`API_SPECIFICATION.md`](API_SPECIFICATION.md) (existing platform API), [`EVALUATION_API.md`](EVALUATION_API.md) (question bank / papers)
**Frontend contract source of truth:** [`src/config/tnpsc.ts`](src/config/tnpsc.ts) (codes + seed data), [`src/lib/tnpscApi.ts`](src/lib/tnpscApi.ts) (call sites + TS interfaces)

---

## Table of contents

1. [Why this exists / scope](#1-why-this-exists--scope)
2. [Conventions](#2-conventions)
3. [Enums and shared types](#3-enums-and-shared-types)
4. [Database changes](#4-database-changes)
5. [NEW — User-facing endpoints](#5-new--user-facing-endpoints)
6. [NEW — Admin endpoints](#6-new--admin-endpoints)
7. [MODIFIED — Existing endpoints](#7-modified--existing-endpoints)
8. [Business rules and algorithms](#8-business-rules-and-algorithms)
9. [Error codes](#9-error-codes)
10. [Seed data](#10-seed-data)
11. [Migration and backfill plan](#11-migration-and-backfill-plan)
12. [Performance, caching, security](#12-performance-caching-security)
13. [Acceptance criteria / QA checklist](#13-acceptance-criteria--qa-checklist)
14. [Delivery phases](#14-delivery-phases)
15. [Open questions for product](#15-open-questions-for-product)

---

## 1. Why this exists / scope

The aspirant portal was a flat list of courses and assessments. It is now a TNPSC-shaped hierarchy:

```
Login
└── Exam group ──────── TNPSC Group 1                    TNPSC Group 4
    └── Stage ───────── Prelims (live) │ Mains (soon)    Written (live)
        └── Track ───── Mock Test (level gated)  │  Practice Test (syllabus wise)
            ├── Level ─ Simple → Medium → Complex        (mock only, sequential unlock)
            └── Subject/Topic                             (practice only, no gate)
```

Five rules the backend must own:

| ID | Rule | Enforced where |
|----|------|----------------|
| **R1** | Every mock test belongs to exactly one level: `simple`, `medium`, `complex`. | DB constraint + create/update validation (§4.2, §7.8) |
| **R2** | ⚠️ **CURRENTLY DISABLED — all three levels are open to every aspirant.** The portal ships with `LEVEL_GATE_ENABLED = false` ([`src/config/tnpsc.ts`](src/config/tnpsc.ts)), so **`POST .../start` must NOT return `403 LEVEL_LOCKED`** for any level. Levels still report `is_completed` (a submitted attempt scoring `>= TNPSC_LEVEL_PASS_PERCENTAGE`, **50**) as a progress marker only. When the gate is re-enabled: `medium` locked until `simple` is cleared, `complex` until `medium` is. | §5.2 read path + §7.1/§7.2 write path |
| **R3** | A mock test is a **full-length paper in the real exam pattern** — both G1 Prelims and G4 Written are 200 questions / 300 marks / 180 minutes. | §6.4 generator + §7.8 validation |
| **R4** | A practice test is **syllabus based**: 1 subject (optionally 1 topic), **30–50 questions**, no level gate. | §6.5 generator + §7.8 validation |
| **R5** | Stages with `status = 'coming_soon'` (Group 1 Mains today) expose no attemptable papers. | §5.1, §5.2, §5.3 |
| **R6** | **Both objective papers are bilingual** — Group 1 Prelims and Group 4 Written each repeat every question in Tamil, so `secondary_language: "ta"` applies to both. (This reverses the earlier Group-4-only rule, changed 05 Sep 2026.) Group 1 Mains is descriptive and generates nothing. | §5.1 `bilingual` flag + generator payload |

**Out of scope for this document:** the AI report pipeline, payments, and the malpractice engine — all unchanged.

---

## 2. Conventions

Matches what the frontend client already does ([`src/lib/api.ts`](src/lib/api.ts)).

| Item | Value |
|---|---|
| Base URL | `VITE_API_BASE_URL`, e.g. `https://futuregenautomation.com/school_assessment/api` |
| User endpoints | `/api/v1/user/...` — `Authorization: Bearer <user_access_token>` |
| Admin endpoints | `/api/v1/admin/...`, `/api/v1/evaluation/...` — admin JWT |
| Errors | FastAPI style `{"detail": ...}`. `detail` may be a string **or** an object `{code, message, ...}`; the client renders a string and reads `code` when present. |
| 401 handling | The client auto-refreshes the user token once and retries. Do not return 401 for business-rule failures — use 403. |
| Timestamps | ISO 8601 UTC strings |
| Percentages | numbers **0–100** (not 0–1), 1 decimal place max |
| Durations | `time_limit_minutes` in whole minutes; `null` = untimed |
| Booleans | real JSON booleans, never `0/1` or `"true"` |
| Unknown enum value | Client falls back to a safe default; still, never invent new codes without updating [`src/config/tnpsc.ts`](src/config/tnpsc.ts) |
| Empty collections | Return `[]`, never `null` |

> **Codes are contractual.** `group-1`, `group-4`, `group-1-prelims`, `group-1-mains`, `group-4-written`, `simple`/`medium`/`complex`, `mock`/`practice`, and every subject/topic slug in §10 are matched **exactly** (case-sensitive) by the frontend. Renaming one breaks navigation silently.

---

## 3. Enums and shared types

```ts
type TnpscGroupCode = 'group-1' | 'group-4';
type TnpscStageCode = 'group-1-prelims' | 'group-1-mains' | 'group-4-written';
type TnpscLevel     = 'simple' | 'medium' | 'complex';
type TnpscTrack     = 'mock' | 'practice';
type StageStatus    = 'active' | 'coming_soon';
type PaperType      = 'objective' | 'descriptive';
type PaperSource    = 'test' | 'assessment';   // which take-flow the client opens
```

### 3.1 `TnpscTest` — the single card object used everywhere

Returned by §5.2, §5.3 and §5.4. Field names are consumed verbatim by `TnpscTest` in
[`src/lib/tnpscApi.ts`](src/lib/tnpscApi.ts).

```ts
interface TnpscTest {
  test_id: string;                    // uuid of the test OR eval assessment
  source: 'test' | 'assessment';      // 'test' → /user/test/{id}/start, 'assessment' → /user/assessment/{id}
  title: string;
  group_id: TnpscGroupCode | null;
  stage_id: TnpscStageCode | null;
  test_type: 'mock' | 'practice';
  level: TnpscLevel | null;           // required for mock, null for practice
  subject_id: string | null;          // slug, e.g. 'indian-polity' (practice)
  subject_name: string | null;
  topic_id: string | null;            // slug, e.g. 'fundamental-rights-duties'
  topic_name: string | null;
  question_count: number;
  max_marks: number;
  time_limit_minutes: number | null;
  negative_marking: boolean;
  negative_mark_value: number | null;
  price: number;                      // INR, 0 = free
  required_tier: 'free' | 'standard' | 'ultimate' | 'premium' | null;
  is_locked: boolean;                 // PAYWALL/tier lock only — never the level lock
  lock_reason: string | null;         // human sentence when is_locked
  attempts_used: number;              // this user
  max_attempts: number | null;        // null = unlimited
  best_percentage: number | null;     // this user, 0–100
  is_completed: boolean;              // best_percentage >= pass mark (mock) / any submit (practice)
}
```

**`is_locked` vs level lock — do not conflate.** `is_locked` means *subscription tier or payment*.
The level gate lives on the level object (§3.2) and hides the whole level.

### 3.2 `TnpscLevelGroup`

```ts
interface TnpscLevelGroup {
  level: TnpscLevel;
  is_unlocked: boolean;
  lock_reason: string | null;         // shown verbatim in the locked panel
  required_percentage: number;        // 50
  best_percentage: number | null;     // best across all mocks of this level
  is_completed: boolean;              // this level cleared → next level unlocks
  tests_total: number;                // count even when `tests` is empty (locked)
  tests_completed: number;
  tests: TnpscTest[];                 // [] when locked
}
```

### 3.3 `TnpscCatalogGroup` / `TnpscCatalogStage`

```ts
interface TnpscCatalogGroup {
  id: TnpscGroupCode;
  name: string;                 // "TNPSC Group 1"
  short_name: string;           // "Group 1"
  tagline: string;              // "Combined Civil Services Examination — I"
  description: string;
  accent: string;               // tailwind gradient, e.g. "from-indigo-500 via-violet-500 to-purple-600"
  posts: string[];              // ["Deputy Collector", …]
  display_order: number;
  stages: TnpscCatalogStage[];
}

interface TnpscCatalogStage {
  id: TnpscStageCode;
  group_id: TnpscGroupCode;
  name: string;                 // "Preliminary Examination"
  short_name: string;           // "Prelims"
  description: string;
  status: 'active' | 'coming_soon';
  paper_type: 'objective' | 'descriptive';
  /** Group 4 papers are printed in two languages; Group 1 Prelims is English only. */
  bilingual: boolean;
  secondary_language: 'ta' | 'en' | null;   // the repeat language when `bilingual`
  display_order: number;
  pattern: {
    total_questions: number;    // 200
    total_marks: number;        // 300
    duration_minutes: number;   // 180
    negative_marking: boolean;
    negative_mark_value: number | null;
    sections: Array<{ name: string; questions: number; marks: number | null }>;
  } | null;                     // null for descriptive stages
  subjects: Array<{
    id: string;                 // slug
    name: string;
    name_ta: string | null;     // Tamil label
    display_order: number;
    topics: Array<{ id: string; name: string; display_order: number }>;
  }>;
}
```

---

## 4. Database changes

### 4.1 Taxonomy tables (new)

```sql
CREATE TABLE tnpsc_groups (
    group_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code           VARCHAR(32)  NOT NULL UNIQUE,          -- 'group-1' | 'group-4'
    name           VARCHAR(128) NOT NULL,
    short_name     VARCHAR(64)  NOT NULL,
    tagline        VARCHAR(255),
    description    TEXT,
    accent         VARCHAR(128),                          -- UI gradient token
    posts          JSONB NOT NULL DEFAULT '[]'::jsonb,    -- string[]
    display_order  INT  NOT NULL DEFAULT 0,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ
);

CREATE TABLE tnpsc_stages (
    stage_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id           UUID NOT NULL REFERENCES tnpsc_groups(group_id) ON DELETE CASCADE,
    code               VARCHAR(48) NOT NULL UNIQUE,       -- 'group-1-prelims' | …
    name               VARCHAR(128) NOT NULL,
    short_name         VARCHAR(64)  NOT NULL,
    description        TEXT,
    status             VARCHAR(16) NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','coming_soon')),
    paper_type         VARCHAR(16) NOT NULL DEFAULT 'objective'
                       CHECK (paper_type IN ('objective','descriptive')),
    total_questions    INT,
    total_marks        INT,
    duration_minutes   INT,
    negative_marking   BOOLEAN NOT NULL DEFAULT FALSE,
    negative_mark_value NUMERIC(4,2),
    display_order      INT NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ
);

CREATE TABLE tnpsc_sections (            -- exam-pattern rows shown on the stage header
    section_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id       UUID NOT NULL REFERENCES tnpsc_stages(stage_id) ON DELETE CASCADE,
    name           VARCHAR(128) NOT NULL,
    question_count INT NOT NULL,
    marks          INT,
    display_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE tnpsc_subjects (
    subject_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id      UUID NOT NULL REFERENCES tnpsc_stages(stage_id) ON DELETE CASCADE,
    code          VARCHAR(64) NOT NULL,                   -- slug, e.g. 'indian-polity'
    name          VARCHAR(160) NOT NULL,
    name_ta       VARCHAR(160),
    display_order INT NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (stage_id, code)
);

CREATE TABLE tnpsc_topics (
    topic_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id    UUID NOT NULL REFERENCES tnpsc_subjects(subject_id) ON DELETE CASCADE,
    code          VARCHAR(64) NOT NULL,                   -- slug
    name          VARCHAR(160) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (subject_id, code)
);
```

> Subject codes repeat across stages on purpose (`indian-polity` exists under both G1 Prelims and
> G4 Written) — uniqueness is **per stage**, and the API always returns the slug, never the UUID.

### 4.2 Tag the attemptable papers

Apply to **both** tables that back an attemptable paper — `tests` and `eval_assessments`:

```sql
ALTER TABLE tests
  ADD COLUMN tnpsc_stage_id   UUID REFERENCES tnpsc_stages(stage_id),
  ADD COLUMN track            VARCHAR(10) CHECK (track IN ('mock','practice')),
  ADD COLUMN tnpsc_level      VARCHAR(10) CHECK (tnpsc_level IN ('simple','medium','complex')),
  ADD COLUMN tnpsc_subject_id UUID REFERENCES tnpsc_subjects(subject_id),
  ADD COLUMN tnpsc_topic_id   UUID REFERENCES tnpsc_topics(topic_id);

-- R1 + R4: shape must match the track
ALTER TABLE tests ADD CONSTRAINT ck_tests_tnpsc_shape CHECK (
      track IS NULL
   OR (track = 'mock'     AND tnpsc_level IS NOT NULL
                          AND tnpsc_subject_id IS NULL AND tnpsc_topic_id IS NULL)
   OR (track = 'practice' AND tnpsc_level IS NULL
                          AND tnpsc_subject_id IS NOT NULL)
);

CREATE INDEX ix_tests_tnpsc_mock     ON tests (tnpsc_stage_id, track, tnpsc_level)
       WHERE track = 'mock';
CREATE INDEX ix_tests_tnpsc_practice ON tests (tnpsc_stage_id, track, tnpsc_subject_id, tnpsc_topic_id)
       WHERE track = 'practice';
```

Repeat verbatim for `eval_assessments`.

### 4.3 Question-bank tagging (prerequisite for the generator)

```sql
ALTER TABLE questions
  ADD COLUMN tnpsc_subject_id UUID REFERENCES tnpsc_subjects(subject_id),
  ADD COLUMN tnpsc_topic_id   UUID REFERENCES tnpsc_topics(topic_id);
CREATE INDEX ix_questions_tnpsc ON questions (tnpsc_subject_id, tnpsc_topic_id, difficulty);
```

Without this, §6.4/§6.5 cannot source questions and the whole feature stays empty. **Start here.**

### 4.4 Level progress (new)

```sql
CREATE TABLE tnpsc_level_progress (
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    stage_id        UUID NOT NULL REFERENCES tnpsc_stages(stage_id) ON DELETE CASCADE,
    level           VARCHAR(10) NOT NULL CHECK (level IN ('simple','medium','complex')),
    attempts        INT NOT NULL DEFAULT 0,
    best_percentage NUMERIC(5,2),
    tests_completed INT NOT NULL DEFAULT 0,      -- distinct mocks cleared at this level
    cleared_at      TIMESTAMPTZ,                 -- non-null ⇒ level cleared
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, stage_id, level)
);
```

This is a **denormalised cache** of the attempts table. It must be rebuildable — ship a
`rebuild_tnpsc_level_progress(user_id)` routine and run it in the backfill (§11).

### 4.5 Settings

```sql
INSERT INTO system_settings (key, value) VALUES
  ('TNPSC_LEVEL_PASS_PERCENTAGE', '50'),   -- R2 threshold
  ('TNPSC_LEVEL_UNLOCK_RULE',     'any'),  -- 'any' | 'all' mocks of the level must be cleared
  ('TNPSC_PRACTICE_MIN_QUESTIONS','30'),
  ('TNPSC_PRACTICE_MAX_QUESTIONS','50');
```

---

## 5. NEW — User-facing endpoints

All require `Authorization: Bearer <user_access_token>`.

### 5.1 Get catalog

```
GET /api/v1/user/tnpsc/catalog
```

Everything needed to render the group → stage → syllabus tree. Static per deployment; cache hard.

**Query params:** none.

**Response 200**

```json
{
  "groups": [
    {
      "id": "group-1",
      "name": "TNPSC Group 1",
      "short_name": "Group 1",
      "tagline": "Combined Civil Services Examination — I",
      "description": "Deputy Collector, Deputy Superintendent of Police, Assistant Commissioner and other Group 1 services.",
      "accent": "from-indigo-500 via-violet-500 to-purple-600",
      "posts": ["Deputy Collector", "DSP (Category-1)", "Assistant Commissioner (Commercial Taxes)", "District Revenue Officer"],
      "display_order": 1,
      "stages": [
        {
          "id": "group-1-prelims",
          "group_id": "group-1",
          "name": "Preliminary Examination",
          "short_name": "Prelims",
          "description": "Single objective paper of 200 questions — General Studies with Aptitude & Mental Ability.",
          "status": "active",
          "paper_type": "objective",
          "bilingual": true,
          "secondary_language": null,
          "display_order": 1,
          "pattern": {
            "total_questions": 200,
            "total_marks": 300,
            "duration_minutes": 180,
            "negative_marking": false,
            "negative_mark_value": null,
            "sections": [
              { "name": "General Studies", "questions": 175, "marks": null },
              { "name": "Aptitude & Mental Ability", "questions": 25, "marks": null }
            ]
          },
          "subjects": [
            {
              "id": "indian-polity",
              "name": "Indian Polity",
              "name_ta": "இந்திய அரசியலமைப்பு",
              "display_order": 5,
              "topics": [
                { "id": "constitution-basics", "name": "Constitution — Basics & Preamble", "display_order": 1 },
                { "id": "fundamental-rights-duties", "name": "Fundamental Rights & Duties", "display_order": 2 }
              ]
            }
          ]
        },
        {
          "id": "group-1-mains",
          "group_id": "group-1",
          "name": "Main Written Examination",
          "short_name": "Mains",
          "description": "Three descriptive papers followed by the interview. Coming soon on the portal.",
          "status": "coming_soon",
          "paper_type": "descriptive",
          "display_order": 2,
          "pattern": null,
          "subjects": []
        }
      ]
    },
    { "id": "group-4", "…": "…" }
  ]
}
```

**Notes**
- Return groups ordered by `display_order`, stages likewise.
- A bare array `[{…}]` is also accepted by the client, but prefer `{ "groups": [...] }`.
- Include `coming_soon` stages — the UI renders them disabled with a "Coming soon" chip.
- Add `ETag` + `Cache-Control: public, max-age=3600`.

**cURL**
```bash
curl -H "Authorization: Bearer $USER_TOKEN" \
     "$BASE/api/v1/user/tnpsc/catalog"
```

---

### 5.2 Get mock tests for a stage (level gated) — ★ core endpoint

```
GET /api/v1/user/tnpsc/stages/{stage_id}/mock-tests
```

`{stage_id}` is the **code** (`group-1-prelims`), not a UUID. Accept the UUID too if convenient.

**Query params**

| Param | Type | Default | Notes |
|---|---|---|---|
| `level` | `simple\|medium\|complex` | — | optional filter; the UI does not send it (it renders all three) |
| `include_locked_tests` | bool | `false` | when `true`, locked levels also return their `tests` array (for admin preview) |

**Response 200** — always exactly three level objects, in order `simple`, `medium`, `complex`:

```json
{
  "stage_id": "group-1-prelims",
  "pass_percentage": 50,
  "levels": [
    {
      "level": "simple",
      "is_unlocked": true,
      "lock_reason": null,
      "required_percentage": 50,
      "best_percentage": 62.5,
      "is_completed": true,
      "tests_total": 3,
      "tests_completed": 1,
      "tests": [
        {
          "test_id": "0f6c8a3e-2b71-4a10-9c33-6d1f0a2e7b45",
          "source": "test",
          "title": "Group 1 Prelims — Simple Mock 01",
          "group_id": "group-1",
          "stage_id": "group-1-prelims",
          "test_type": "mock",
          "level": "simple",
          "subject_id": null,
          "subject_name": null,
          "topic_id": null,
          "topic_name": null,
          "question_count": 200,
          "max_marks": 300,
          "time_limit_minutes": 180,
          "negative_marking": false,
          "negative_mark_value": null,
          "price": 0,
          "required_tier": "free",
          "is_locked": false,
          "lock_reason": null,
          "attempts_used": 1,
          "max_attempts": 3,
          "best_percentage": 62.5,
          "is_completed": true
        }
      ]
    },
    {
      "level": "medium",
      "is_unlocked": false,
      "lock_reason": "Score at least 50% in a Simple level mock test to unlock this level.",
      "required_percentage": 50,
      "best_percentage": null,
      "is_completed": false,
      "tests_total": 3,
      "tests_completed": 0,
      "tests": []
    },
    {
      "level": "complex",
      "is_unlocked": false,
      "lock_reason": "Clear the Medium level to unlock this level.",
      "required_percentage": 50,
      "best_percentage": null,
      "is_completed": false,
      "tests_total": 2,
      "tests_completed": 0,
      "tests": []
    }
  ]
}
```

**Hard requirements**
1. All three levels always present, even with `tests_total: 0`.
2. `tests: []` for a locked level (don't leak ids), but **`tests_total` must still be the real count** — the UI shows "0/3 cleared".
3. `lock_reason` is rendered verbatim — write it as a full sentence, aspirant-facing.
4. `is_unlocked` for `simple` is always `true`.
5. **Empty-previous-level escape hatch:** if the previous level has `tests_total = 0` (nothing published yet), the next level must be **unlocked** — otherwise aspirants dead-end on an empty catalogue. The frontend fallback already does this; mirror it.
6. `attempts_used` / `best_percentage` / `is_completed` are per-calling-user.
7. Only `status = 'published'`/`active` papers count toward `tests_total`.
8. **`is_completed` is score-derived, never attempt-derived** — set it only when
   `best_percentage >= pass_percentage`. Having sat the paper is not clearing it.
   *(Observed in the first deployment: a 2% attempt came back `is_completed: true`,
   `tests_completed: 1`, which unlocked Medium. The portal now recomputes clearance from
   `best_percentage` and ignores a contradicting flag, but the server must not emit it —
   `POST .../start` is still the real gate and would wrongly allow that aspirant in.)*
9. `pass_percentage` and every `required_percentage` must reflect the configured threshold
   (**50**). The client applies the stricter of its own constant and this value, so a stale
   lower number here shows up as a UI/server disagreement rather than a silent unlock.

**Errors:** `404 STAGE_NOT_FOUND`, `409 STAGE_NOT_ACTIVE` (stage is `coming_soon`).

**cURL**
```bash
curl -H "Authorization: Bearer $USER_TOKEN" \
     "$BASE/api/v1/user/tnpsc/stages/group-1-prelims/mock-tests"
```

---

### 5.3 Get practice tests for a stage (syllabus wise)

```
GET /api/v1/user/tnpsc/stages/{stage_id}/practice-tests?subject=&topic=&only_with_tests=false
```

**Query params**

| Param | Type | Notes |
|---|---|---|
| `subject` | slug | optional; restrict to one subject |
| `topic` | slug | optional; requires `subject` |
| `only_with_tests` | bool, default `false` | when `false` **return every syllabus subject of the stage, including ones with `tests: []`** — the portal renders the full syllabus with a "being prepared" note |

**Response 200**

```json
{
  "stage_id": "group-1-prelims",
  "question_count_range": { "min": 30, "max": 50 },
  "subjects": [
    {
      "subject_id": "indian-polity",
      "subject_name": "Indian Polity",
      "subject_name_ta": "இந்திய அரசியலமைப்பு",
      "display_order": 5,
      "tests_total": 2,
      "tests": [
        {
          "test_id": "c31a77e9-01d2-4c8b-9a55-77b6c2e51f80",
          "source": "test",
          "title": "Indian Polity — Fundamental Rights (Set 1)",
          "group_id": "group-1",
          "stage_id": "group-1-prelims",
          "test_type": "practice",
          "level": null,
          "subject_id": "indian-polity",
          "subject_name": "Indian Polity",
          "topic_id": "fundamental-rights-duties",
          "topic_name": "Fundamental Rights & Duties",
          "question_count": 40,
          "max_marks": 40,
          "time_limit_minutes": 40,
          "negative_marking": false,
          "negative_mark_value": null,
          "price": 0,
          "required_tier": "free",
          "is_locked": false,
          "lock_reason": null,
          "attempts_used": 0,
          "max_attempts": 3,
          "best_percentage": null,
          "is_completed": false
        }
      ]
    },
    {
      "subject_id": "general-science",
      "subject_name": "General Science",
      "subject_name_ta": "பொது அறிவியல்",
      "display_order": 1,
      "tests_total": 0,
      "tests": []
    }
  ]
}
```

**Notes**
- Order subjects by `display_order`; order tests within a subject by topic `display_order`, then title.
- Practice tests are **never level-locked**. `is_locked` may still be `true` for tier/paywall.
- A flat `{ "tests": [ … ] }` response is also accepted (the client buckets it by `subject_id` itself), but the grouped form above is preferred.

---

### 5.4 Get stage progress (dashboard roll-up)

```
GET /api/v1/user/tnpsc/progress?stage_id=
```

Optional but recommended — lets the dashboard show progress without fetching every level.

**Response 200**

```json
{
  "stages": [
    {
      "stage_id": "group-1-prelims",
      "group_id": "group-1",
      "mock": {
        "current_level": "medium",
        "levels": {
          "simple":  { "is_unlocked": true,  "is_completed": true,  "best_percentage": 62.5, "tests_completed": 1, "tests_total": 3 },
          "medium":  { "is_unlocked": true,  "is_completed": false, "best_percentage": 31.0, "tests_completed": 0, "tests_total": 3 },
          "complex": { "is_unlocked": false, "is_completed": false, "best_percentage": null, "tests_completed": 0, "tests_total": 2 }
        }
      },
      "practice": { "tests_total": 48, "tests_attempted": 7, "average_percentage": 58.4 },
      "last_attempt_at": "2026-08-21T11:04:33Z"
    }
  ]
}
```

---

### 5.5 Get syllabus only (optional convenience)

```
GET /api/v1/user/tnpsc/stages/{stage_id}/syllabus
```

Returns just the `subjects[]` block of §5.1 for one stage. Only worth building if the catalog
payload gets large; skip in phase 1.

---

## 6. NEW — Admin endpoints

Admin JWT. These make the taxonomy manageable without SQL access and let content be produced at scale.

### 6.1 Taxonomy CRUD

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/admin/tnpsc/groups` | list groups (with stages) |
| `POST` | `/api/v1/admin/tnpsc/groups` | create group |
| `PATCH` | `/api/v1/admin/tnpsc/groups/{group_id}` | rename, reorder, activate/deactivate |
| `GET` | `/api/v1/admin/tnpsc/stages?group_id=` | list stages |
| `POST` | `/api/v1/admin/tnpsc/stages` | create stage (+ `sections[]`, pattern) |
| `PATCH` | `/api/v1/admin/tnpsc/stages/{stage_id}` | edit pattern / flip `status` `coming_soon`→`active` |
| `GET` | `/api/v1/admin/tnpsc/stages/{stage_id}/subjects` | list subjects + topics |
| `POST` | `/api/v1/admin/tnpsc/subjects` | create subject `{stage_id, code, name, name_ta, display_order}` |
| `PATCH`/`DELETE` | `/api/v1/admin/tnpsc/subjects/{subject_id}` | edit / soft-delete |
| `POST` | `/api/v1/admin/tnpsc/topics` | create topic `{subject_id, code, name, display_order}` |
| `PATCH`/`DELETE` | `/api/v1/admin/tnpsc/topics/{topic_id}` | edit / soft-delete |

**Delete rule:** soft-delete only (`is_active = false`) when any test or question references the row;
return `409 TAXONOMY_IN_USE` with `{ "tests": 4, "questions": 812 }` in `detail`.

### 6.2 Tag an existing test / assessment

```
PATCH /api/v1/admin/tests/{test_id}/tnpsc
PATCH /api/v1/evaluation/assessments/{assessment_id}/tnpsc
```

**Request**
```json
{
  "stage_id": "group-1-prelims",
  "track": "mock",
  "level": "simple",
  "subject_id": null,
  "topic_id": null
}
```
**Response 200:** the updated test object.
**Errors:** `422 TNPSC_TAG_INVALID` when the shape violates R1/R3/R4 (see §9).

### 6.3 Bulk tag

```
POST /api/v1/admin/tnpsc/bulk-tag
```
```json
{
  "target": "tests",                       // "tests" | "assessments" | "questions"
  "ids": ["uuid1", "uuid2"],
  "stage_id": "group-4-written",
  "track": "practice",
  "subject_id": "general-tamil",
  "topic_id": "grammar"
}
```
**Response 200:** `{ "updated": 2, "skipped": [{ "id": "uuid3", "reason": "question_count 12 outside 30–50" }] }`

For `target: "questions"` only `subject_id` / `topic_id` apply. Support an alternative selector
`{"filter": {"subject": "Polity", "created_before": "2026-01-01"}}` so the 100k-row question bank can
be tagged in batches without shipping id lists.

### 6.4 Generate a mock test (pattern driven)

```
POST /api/v1/admin/tnpsc/mock-tests/generate
```
```json
{
  "stage_id": "group-1-prelims",
  "level": "simple",
  "title": "Group 1 Prelims — Simple Mock 04",
  "count": 1,
  "source": "question_bank",
  "difficulty_mix": { "easy": 0.7, "medium": 0.3, "hard": 0.0 },
  "section_split": [
    { "name": "General Studies", "questions": 175 },
    { "name": "Aptitude & Mental Ability", "questions": 25 }
  ],
  "time_limit_minutes": 180,
  "max_marks": 300,
  "negative_marking": false,
  "max_attempts": 3,
  "required_tier": "free",
  "price": 0,
  "publish": false
}
```

**Server-side validation (R3):**
- `sum(section_split.questions)` **must equal** `stage.total_questions` (200) — else `422 MOCK_PATTERN_MISMATCH`.
- Section names must match `tnpsc_sections` for the stage.
- Difficulty mix must sum to 1.0 (±0.01).

**Recommended default mixes** (product to confirm — §15):

| Level | easy | medium | hard |
|---|---|---|---|
| simple | 0.70 | 0.30 | 0.00 |
| medium | 0.30 | 0.50 | 0.20 |
| complex | 0.00 | 0.40 | 0.60 |

**Response 202** `{ "job_id": "...", "status": "queued" }` — reuse the existing generation-job
polling endpoint from [`EVALUATION_API.md`](EVALUATION_API.md) §3.1.

**Insufficient bank:** `409 INSUFFICIENT_QUESTIONS` with
`{"required": 175, "available": 96, "subject": "general-studies", "difficulty": "easy"}`.

### 6.5 Generate practice tests in bulk

```
POST /api/v1/admin/tnpsc/practice-tests/generate
```
```json
{
  "stage_id": "group-1-prelims",
  "scope": "all_topics",              // "all_topics" | "subject" | "topic"
  "subject_id": null,
  "topic_id": null,
  "questions_per_set": 40,            // must be 30–50 (R4)
  "sets_per_topic": 1,
  "time_limit_minutes": null,         // null → auto = questions_per_set minutes
  "title_template": "{subject} — {topic} (Set {n})",
  "publish": false
}
```
**Response 202** `{ "job_id": "...", "planned_sets": 47 }`
**Errors:** `422 PRACTICE_SIZE_INVALID`, `409 INSUFFICIENT_QUESTIONS` (per topic; report which topics were skipped).

### 6.6 Content coverage report

```
GET /api/v1/admin/tnpsc/coverage?stage_id=group-1-prelims
```
```json
{
  "stage_id": "group-1-prelims",
  "mock": { "simple": 3, "medium": 3, "complex": 2 },
  "practice": {
    "subjects": [
      { "subject_id": "indian-polity", "topics_total": 5, "topics_with_sets": 3, "sets": 4, "questions_tagged": 812 },
      { "subject_id": "general-science", "topics_total": 5, "topics_with_sets": 0, "sets": 0, "questions_tagged": 0 }
    ]
  },
  "gaps": ["general-science: 0 of 5 topics have practice sets"]
}
```
This is the content team's worklist — worth building early.

### 6.7 Reset / override a user's level progress (support tool)

```
POST /api/v1/admin/tnpsc/users/{user_id}/level-progress
```
```json
{ "stage_id": "group-1-prelims", "level": "medium", "action": "unlock" }   // "unlock" | "reset" | "recompute"
```
Write an audit-log entry (existing `/api/v1/admin/audit` pipeline). Needed for support cases where an
aspirant is stuck behind a broken paper.

### 6.8 Settings

```
GET  /api/v1/admin/tnpsc/settings
PUT  /api/v1/admin/tnpsc/settings     { "level_pass_percentage": 50, "level_unlock_rule": "any" }
```
Changing `level_pass_percentage` must **not** retroactively re-lock anyone: keep `cleared_at` once set,
and apply the new threshold only to future submissions (see §8.2).

---

## 7. MODIFIED — Existing endpoints

Summary, then details:

| # | Endpoint | Change | Breaking? |
|---|---|---|---|
| 7.1 | `POST /api/v1/test-engine/{test_id}/start` | reject locked level `403 LEVEL_LOCKED` | no (new error path) |
| 7.2 | `POST /api/v1/user/eval-assessments/{id}/start` | same | no |
| 7.3 | `POST /api/v1/test-engine/{attempt_id}/submit` | upsert level progress; add unlock fields to response | no (additive) |
| 7.4 | `POST /api/v1/user/eval-assessments/{id}/attempts/{aid}/submit` | same | no |
| 7.5 | `GET /api/v1/user/history` | add TNPSC fields + filters | no (additive) |
| 7.6 | `GET /api/v1/user/eval-assessments` | add TNPSC fields; drop `board`/`grade` filtering | soft |
| 7.7 | `GET /api/v1/user/tests/{id}`, `GET /api/v1/user/courses/{id}/tests` | add TNPSC fields | no |
| 7.8 | `POST /api/v1/admin/tests`, `POST /api/v1/evaluation/assessments` | accept + validate TNPSC tags | no |
| 7.9 | `POST /api/v1/user/auth/register`, `GET/POST /api/v1/user/profile/` | `target_groups` replaces school fields | **yes** |
| 7.10 | `GET /api/v1/user/dashboard/` | add `tnpsc` summary block | no |
| 7.11 | `GET /api/v1/user/notifications` | add deep-link fields | no |

---

### 7.1 / 7.2 Start attempt — enforce the level gate

`POST /api/v1/test-engine/{test_id}/start`
`POST /api/v1/user/eval-assessments/{assessment_id}/start`

Add this check **before** any attempt row is created, after the existing tier/payment checks:

```
if test.track == 'mock' and test.tnpsc_level != 'simple':
    prev = previous_level(test.tnpsc_level)
    if not level_cleared(user, test.tnpsc_stage_id, prev)  and  level_has_tests(stage, prev):
        403 LEVEL_LOCKED
```

**Error 403**
```json
{
  "detail": {
    "code": "LEVEL_LOCKED",
    "message": "Clear the Simple level with at least 50% to unlock Medium level mock tests.",
    "required_level": "simple",
    "required_percentage": 50,
    "your_best_percentage": 31.0
  }
}
```

> Client note: [`src/lib/api.ts`](src/lib/api.ts) reads `detail` and renders it as a string when it is
> one. Keep `message` present so the toast is readable even if the client doesn't parse `code`.

Existing error semantics stay: `402` payment required, `403` tier insufficient, `409` attempt already
in progress, `423` test inactive.

---

### 7.3 / 7.4 Submit attempt — record progress and report the unlock

After scoring, for **mock** papers only:

1. Upsert `tnpsc_level_progress` (§8.2).
2. If this submission crosses the threshold and the level was not already cleared, set `cleared_at = now()`.
3. Enqueue a notification: *"Simple level cleared — Medium level mock tests are now unlocked."*

**Response — additive fields** (existing fields unchanged):

```json
{
  "attempt_id": "…",
  "score": 187.5,
  "percentage": 62.5,
  "…": "existing fields",

  "tnpsc": {
    "stage_id": "group-1-prelims",
    "track": "mock",
    "level": "simple",
    "pass_percentage": 50,
    "passed": true,
    "level_cleared": true,
    "level_cleared_now": true,
    "next_level_unlocked": "medium"
  }
}
```

`level_cleared_now` is the "first time" flag — the portal uses it to celebrate the unlock rather than
showing the banner on every retake.

For **practice** papers return `"track": "practice"` and omit the level keys.

---

### 7.5 `GET /api/v1/user/history` — TNPSC fields + filters

**New query params:** `group_id`, `stage_id`, `track`, `level`, `subject_id` (all optional, AND-combined).

**New fields per item** (added to the existing `ApiAttempt` shape):

```ts
{
  // …existing: attempt_id, test_id, start_time, score, percentage, status, test_name, test_mode, course_id
  tnpsc_group_id: string | null;     // "group-1"
  tnpsc_stage_id: string | null;     // "group-1-prelims"
  tnpsc_stage_name: string | null;   // "Preliminary Examination"
  track: 'mock' | 'practice' | null;
  tnpsc_level: 'simple' | 'medium' | 'complex' | null;
  tnpsc_subject_id: string | null;
  tnpsc_subject_name: string | null;
  tnpsc_topic_name: string | null;
}
```

Needed so History and the report pages can say "Group 1 Prelims · Mock · Medium" instead of a bare test name.

---

### 7.6 `GET /api/v1/user/eval-assessments` — retire the school filters

Today the client sends `?board=CBSE&grade=8` (from
[`src/contexts/UserPortalContext.tsx`](src/contexts/UserPortalContext.tsx) `assessmentFilter`).
That is school-portal logic and is meaningless for TNPSC.

- **Ignore** `board` and `grade` if still sent (don't 422 — old clients exist).
- **Add** `group_id`, `stage_id`, `track`, `level` filters.
- **Add** the TNPSC fields from §7.5 to each item.
- This endpoint now feeds only the dashboard's "Assigned Assessments" panel (invitation-based work).
  Everything else comes from §5.2 / §5.3.

---

### 7.7 Test detail / course tests — add TNPSC fields

`GET /api/v1/user/tests/{test_id}` and `GET /api/v1/user/courses/{course_id}/tests` gain
`tnpsc_stage_id`, `track`, `tnpsc_level`, `tnpsc_subject_id`, `tnpsc_topic_id`, plus
`max_attempts`, `attempts_used`, `best_percentage` if not already present.

The pre-start screen must also surface the level gate: if the paper is a locked-level mock, return
`403 LEVEL_LOCKED` from the **detail** endpoint too, so a bookmarked URL can't render a Start button
that will fail.

---

### 7.8 Admin create/update test — accept and validate tags

`POST /api/v1/admin/tests`, `PATCH /api/v1/admin/tests/{id}`,
`POST /api/v1/evaluation/assessments`, `PATCH /api/v1/evaluation/assessments/{id}`

**New request fields** (all optional at the API level, required to publish):

```ts
{
  tnpsc_stage_id?: string;    // stage code or uuid
  track?: 'mock' | 'practice';
  tnpsc_level?: 'simple' | 'medium' | 'complex';
  tnpsc_subject_id?: string;  // slug or uuid
  tnpsc_topic_id?: string;
}
```

**Validation matrix**

| Condition | Result |
|---|---|
| `track='mock'` and `tnpsc_level` missing | `422 TNPSC_LEVEL_REQUIRED` |
| `track='mock'` and `subject_id`/`topic_id` set | `422 TNPSC_TAG_INVALID` |
| `track='mock'` and `question_count != stage.total_questions` | `422 MOCK_PATTERN_MISMATCH` |
| `track='practice'` and `subject_id` missing | `422 TNPSC_SUBJECT_REQUIRED` |
| `track='practice'` and `tnpsc_level` set | `422 TNPSC_TAG_INVALID` |
| `track='practice'` and `question_count` outside 30–50 | `422 PRACTICE_SIZE_INVALID` |
| `topic_id` not a child of `subject_id` | `422 TNPSC_TOPIC_MISMATCH` |
| `subject_id` not attached to `stage_id` | `422 TNPSC_SUBJECT_MISMATCH` |
| publish attempted with `track` null | `422 TNPSC_TAG_REQUIRED` |

Enforce the last row on the **publish** transition specifically (`POST /admin/tests/{id}/publish`), so
drafts can stay untagged while being authored.

---

### 7.9 Registration and profile — `target_groups` replaces the school fields

Current payload ([`src/lib/userAuthApi.ts`](src/lib/userAuthApi.ts)) carries `student_class`,
`section`, `roll_no`, `school_name`, `medium`, `class_teacher`, `academic_year`, `board` — none of
which apply to a TNPSC aspirant.

**`POST /api/v1/user/auth/register`** — new optional field, old fields become optional/ignored:

```json
{
  "full_name": "…", "email_address": "…", "mobile_number": "…", "password": "…",
  "date_of_birth": "1999-04-02",
  "gender": "female",
  "target_groups": ["group-1", "group-4"],
  "preferred_medium": "tamil"
}
```

**`GET /api/v1/user/profile/`** returns `target_groups: string[]` and `preferred_medium`.
**`POST /api/v1/user/profile/`** accepts both for update.

Rules:
- `target_groups` must contain only valid group codes; empty array allowed (portal then shows both).
- Keep the legacy columns nullable for one release; stop requiring them **now** (registration
  currently fails without `student_class` etc., which is wrong for this product).
- Use `target_groups` to order the group cards and to scope notification targeting.

---

### 7.10 `GET /api/v1/user/dashboard/` — add a TNPSC block

```json
{
  "user": { "…": "…" },
  "unread_notifications": 3,
  "subscription": { "…": "…" },
  "tnpsc": {
    "target_groups": ["group-1"],
    "stages": [
      { "stage_id": "group-1-prelims", "current_level": "medium",
        "mock_completed": 1, "mock_total": 8, "practice_attempted": 7, "practice_total": 48 }
    ]
  }
}
```

---

### 7.11 Notifications — deep links

Add `stage_id`, `track`, `level` (nullable) to each notification so a "Medium level unlocked" push can
open `/user/exams/group-1/group-1-prelims?tab=mock`. Also add the existing-but-missing `course_id`
field the client already reads.

---

## 8. Business rules and algorithms

### 8.1 Unlock evaluation (read path, §5.2)

```python
PASS = settings.TNPSC_LEVEL_PASS_PERCENTAGE            # 50
RULE = settings.TNPSC_LEVEL_UNLOCK_RULE                # 'any' | 'all'

def level_state(user, stage, level):
    tests      = published_mocks(stage, level)
    progress   = level_progress(user, stage, level)     # may be None
    cleared_ct = count_cleared_tests(user, tests, PASS)
    completed  = (cleared_ct == len(tests)) if RULE == 'all' else (cleared_ct > 0)
    return completed and len(tests) > 0

def is_unlocked(user, stage, level):
    if level == 'simple':
        return True
    prev = previous_level(level)                        # medium→simple, complex→medium
    if len(published_mocks(stage, prev)) == 0:
        return True                                     # escape hatch — nothing to clear yet
    return level_state(user, stage, prev)
```

Prefer reading `tnpsc_level_progress.cleared_at IS NOT NULL` over recomputing from attempts on every
request; recompute only in the rebuild routine.

### 8.2 Progress upsert (write path, §7.3)

```sql
INSERT INTO tnpsc_level_progress (user_id, stage_id, level, attempts, best_percentage, tests_completed, cleared_at)
VALUES (:user, :stage, :level, 1, :pct, :cleared_now, CASE WHEN :pct >= :pass THEN now() END)
ON CONFLICT (user_id, stage_id, level) DO UPDATE SET
    attempts        = tnpsc_level_progress.attempts + 1,
    best_percentage = GREATEST(COALESCE(tnpsc_level_progress.best_percentage, 0), EXCLUDED.best_percentage),
    tests_completed = (SELECT COUNT(DISTINCT a.test_id) FROM attempts a
                        WHERE a.user_id = :user AND a.test_id IN (SELECT … level mocks …)
                          AND a.status IN ('submitted','auto_submitted') AND a.percentage >= :pass),
    cleared_at      = COALESCE(tnpsc_level_progress.cleared_at, EXCLUDED.cleared_at),
    updated_at      = now();
```

- `cleared_at` is **sticky** — never cleared by a later low score, and never by raising the threshold.
- Only `status IN ('submitted','auto_submitted')` counts. `in_progress` and `expired` do not.
- Run inside the same transaction as attempt scoring; the `ON CONFLICT` makes concurrent submits safe.

### 8.3 ⚠️ Attempt limits vs the gate — design trap

Mock tests currently default to `max_attempts = 1`
([`src/data/userPortalSampleData.ts`](src/data/userPortalSampleData.ts) `DEFAULT_MAX_ATTEMPTS`).
Combined with R2 that means: **score 49% on your only Simple mock and you are permanently locked out
of the entire product.**

Pick one before launch (product decision, §15):
- **(a) Recommended** — TNPSC mocks get `max_attempts = 3` (or unlimited), so a failed level can be retried.
- (b) Failed attempts (`percentage < pass`) don't consume an attempt.
- (c) Publish ≥3 mocks per level so a failure on one still leaves others.

Whatever is chosen, `max_attempts` must be returned per test (§3.1) and enforced server-side.

### 8.4 Ordering

- Groups, stages, subjects, topics: `display_order ASC, name ASC`.
- Levels: always `simple, medium, complex`.
- Tests within a level: `is_completed ASC` (unattempted first), then `created_at ASC` — so the aspirant's next paper is on top.

### 8.5 Time limits

- Mock: `stage.duration_minutes` (180).
- Practice: `question_count` minutes when unset (40 Qs → 40 min).

---

## 9. Error codes

Return as `{"detail": {"code": …, "message": …, …extras}}`.

| HTTP | `code` | When | Extras |
|---|---|---|---|
| 403 | `LEVEL_LOCKED` | start/detail of a mock whose level is not unlocked | `required_level`, `required_percentage`, `your_best_percentage` |
| 403 | `TIER_INSUFFICIENT` | existing tier gate | `required_tier` |
| 402 | `PAYMENT_REQUIRED` | paid paper, unpaid | `price` |
| 409 | `ATTEMPT_IN_PROGRESS` | existing | `attempt_id` |
| 409 | `STAGE_NOT_ACTIVE` | stage is `coming_soon` | `status` |
| 409 | `MAX_ATTEMPTS_REACHED` | attempts exhausted | `max_attempts` |
| 409 | `TAXONOMY_IN_USE` | deleting a referenced subject/topic | `tests`, `questions` |
| 409 | `INSUFFICIENT_QUESTIONS` | generator can't fill the pattern | `required`, `available`, `subject`, `difficulty` |
| 404 | `STAGE_NOT_FOUND` / `SUBJECT_NOT_FOUND` | bad code | — |
| 422 | `MOCK_PATTERN_MISMATCH` | mock ≠ stage pattern | `expected`, `got` |
| 422 | `PRACTICE_SIZE_INVALID` | practice outside 30–50 | `min`, `max`, `got` |
| 422 | `TNPSC_TAG_INVALID` / `TNPSC_LEVEL_REQUIRED` / `TNPSC_SUBJECT_REQUIRED` / `TNPSC_TOPIC_MISMATCH` / `TNPSC_SUBJECT_MISMATCH` / `TNPSC_TAG_REQUIRED` | see §7.8 matrix | field names |

---

## 10. Seed data

Authoritative source: [`src/config/tnpsc.ts`](src/config/tnpsc.ts) — write the seed script by reading
that file so codes cannot drift.

### 10.1 Groups and stages

| group code | stage code | short | status | paper | questions | marks | minutes |
|---|---|---|---|---|---|---|---|
| `group-1` | `group-1-prelims` | Prelims | active | objective | 200 | 300 | 180 |
| `group-1` | `group-1-mains` | Mains | coming_soon | descriptive | — | — | — |
| `group-4` | `group-4-written` | Written | active | objective | 200 | 300 | 180 |

**Sections**

| stage | section | questions |
|---|---|---|
| `group-1-prelims` | General Studies | 175 |
| `group-1-prelims` | Aptitude & Mental Ability | 25 |
| `group-4-written` | General Tamil / General English | 100 |
| `group-4-written` | General Studies | 75 |
| `group-4-written` | Aptitude & Mental Ability | 25 |

### 10.2 Subjects and topics

`group-1-prelims` = rows 1–10 below. `group-4-written` = rows 0a + 0b (the candidate sits one of the two) + rows 1–10.

| # | subject code | name (name_ta) | topic codes |
|---|---|---|---|
| 0a | `general-tamil` | General Tamil (பொதுத் தமிழ்) | `grammar`, `literature`, `authors-and-works`, `comprehension`, `vocabulary` |
| 0b | `general-english` | General English | `grammar`, `literature`, `authors-and-works`, `comprehension`, `vocabulary` |
| 1 | `general-science` | General Science (பொது அறிவியல்) | `physics`, `chemistry`, `botany`, `zoology`, `science-in-everyday-life` |
| 2 | `current-events` | Current Events (நடப்பு நிகழ்வுகள்) | `national-current-affairs`, `international-current-affairs`, `tamil-nadu-current-affairs`, `sports-and-awards`, `schemes-and-policies` |
| 3 | `geography` | Geography of India (இந்திய புவியியல்) | `physical-geography`, `climate-and-monsoon`, `rivers-and-water-resources`, `agriculture-and-minerals`, `tamil-nadu-geography` |
| 4 | `history-and-culture` | History and Culture of India (இந்திய வரலாறு மற்றும் பண்பாடு) | `ancient-india`, `medieval-india`, `modern-india`, `art-and-architecture` |
| 5 | `indian-polity` | Indian Polity (இந்திய அரசியலமைப்பு) | `constitution-basics`, `fundamental-rights-duties`, `union-and-state-executive`, `parliament-and-judiciary`, `local-self-government` |
| 6 | `indian-economy` | Indian Economy (இந்தியப் பொருளாதாரம்) | `national-income`, `planning-and-niti-aayog`, `banking-and-finance`, `rural-and-urban-economy`, `tamil-nadu-economy` |
| 7 | `indian-national-movement` | Indian National Movement (இந்திய தேசிய இயக்கம்) | `freedom-struggle`, `national-leaders`, `role-of-tamil-nadu` |
| 8 | `tamil-nadu-history-and-society` | History, Culture & Socio-Political Movements of Tamil Nadu (தமிழ்நாட்டு வரலாறு மற்றும் சமூக இயக்கங்கள்) | `sangam-age`, `tamil-society-and-culture`, `dravidian-movement`, `social-reformers` |
| 9 | `development-administration-tn` | Development Administration in Tamil Nadu (தமிழ்நாட்டில் வளர்ச்சி நிர்வாகம்) | `welfare-schemes-tn`, `human-development-indicators`, `e-governance-tn` |
| 10 | `aptitude-and-mental-ability` | Aptitude & Mental Ability (திறனறிவு மற்றும் மனத்திறன்) | `simplification-and-percentage`, `ratio-and-proportion`, `time-work-distance`, `number-series`, `logical-reasoning`, `data-interpretation` |

Totals: G1 Prelims **10 subjects / 45 topics**; G4 Written **12 subjects / 55 topics**.
At 1 practice set per topic that is 100 practice papers to generate — plan the bank tagging accordingly.

> The subject/topic list is a working syllabus map, not a legal transcription of the TNPSC
> notification. Have the content team review it before seeding production, and treat §6.1 as the way
> to correct it afterwards.

---

## 11. Migration and backfill plan

**Step 1 — schema** (`alembic revision`): §4.1 tables, §4.2/§4.3 columns, §4.4 progress table, §4.5 settings. All nullable/additive; zero downtime.

**Step 2 — seed** taxonomy from §10 (idempotent upsert on `code`).

**Step 3 — backfill existing content.** Best-effort, then human review via §6.6:

```sql
-- mode → track
UPDATE tests SET track = CASE WHEN mode = 'mock' THEN 'mock' ELSE 'practice' END
WHERE track IS NULL;

-- difficulty → level (mock only)
UPDATE tests SET tnpsc_level = CASE lower(difficulty)
        WHEN 'easy' THEN 'simple' WHEN 'medium' THEN 'medium'
        WHEN 'hard' THEN 'complex' ELSE 'simple' END
WHERE track = 'mock' AND tnpsc_level IS NULL;

-- title keyword → stage
UPDATE tests SET tnpsc_stage_id = (SELECT stage_id FROM tnpsc_stages WHERE code='group-4-written')
WHERE tnpsc_stage_id IS NULL AND (name ILIKE '%group 4%' OR name ILIKE '%vao%');

UPDATE tests SET tnpsc_stage_id = (SELECT stage_id FROM tnpsc_stages WHERE code='group-1-prelims')
WHERE tnpsc_stage_id IS NULL AND (name ILIKE '%group 1%' OR name ILIKE '%prelim%');
```

Then a report of everything still `NULL` for the content team to tag via §6.3.

**Step 4 — rebuild progress** for all users from the attempts table:
`SELECT rebuild_tnpsc_level_progress(user_id) FROM users;` (batch it).

**Step 5 — enable enforcement** behind a flag: `TNPSC_ENFORCE_LEVEL_GATE` (default `false`).
Turn it on only after §5.2 has been verified against real data — otherwise a mis-tagged paper locks
users out on day one.

**Rollback:** flag off + columns are additive, so a revert is data-safe. Keep the taxonomy tables.

---

## 12. Performance, caching, security

- **§5.1 catalog** — fully static; cache in-process for 1h + `ETag`. Target < 50 ms.
- **§5.2 / §5.3** — one query for papers + one for the user's progress/attempt aggregates. Do **not** N+1 per test for `attempts_used`; aggregate once:
  ```sql
  SELECT test_id, COUNT(*) AS attempts, MAX(percentage) AS best
  FROM attempts WHERE user_id = :u AND status IN ('submitted','auto_submitted')
    AND test_id = ANY(:test_ids) GROUP BY test_id;
  ```
  Target < 200 ms for a stage with 100 papers.
- **Authorisation** — every per-user field must be derived from the JWT subject, never from a query param. There is no endpoint here that takes `user_id` except the admin support tool (§6.7).
- **Locked levels must not leak `test_id`s** — a determined user could otherwise POST straight to `/start`. §7.1 is the real gate; §5.2 hiding ids is defence in depth.
- **Rate limits** — reuse existing per-user limits; the catalog endpoint is safe to allow generously.

---

## 13. Acceptance criteria / QA checklist

Level gate:
- [ ] New user, `GET .../group-1-prelims/mock-tests` → `simple.is_unlocked = true`, `medium`/`complex` false with a readable `lock_reason`, `tests: []`.
- [ ] `POST /test-engine/{medium_mock_id}/start` for that user → `403 LEVEL_LOCKED`.
- [ ] Submit a Simple mock at 49% → still locked; response `tnpsc.passed=false`, `level_cleared=false`.
- [ ] Submit at 50.0% (boundary, inclusive) → `level_cleared_now = true`, `next_level_unlocked = "medium"`; re-fetch shows `medium.is_unlocked = true`.
- [ ] Retake the same Simple mock at 20% → `medium` stays unlocked (`cleared_at` sticky).
- [ ] A 2% attempt returns `is_completed: false`, `tests_completed: 0`, and `medium.is_unlocked: false` — a submitted attempt alone never clears a level.
- [ ] Complex stays locked until a Medium mock is cleared.
- [ ] Stage with 0 published Simple mocks → Medium unlocked (escape hatch).
- [ ] Two attempts submitted concurrently → progress row consistent, no duplicate-key error.

Shape/validation:
- [ ] Create a mock with 150 questions on a 200-question stage → `422 MOCK_PATTERN_MISMATCH`.
- [ ] Create a practice test with 20 questions → `422 PRACTICE_SIZE_INVALID`.
- [ ] Practice test with `level` set → `422 TNPSC_TAG_INVALID`.
- [ ] Publish an untagged test → `422 TNPSC_TAG_REQUIRED`.

Catalog/listing:
- [ ] `group-1-mains` present in catalog with `status: "coming_soon"`, `subjects: []`.
- [ ] `GET .../group-1-mains/mock-tests` → `409 STAGE_NOT_ACTIVE`.
- [ ] Practice listing returns all 10 subjects for G1 Prelims even when 8 have no sets.
- [ ] Practice listing for G4 Written includes `general-tamil` and `general-english` first.

Cross-cutting:
- [ ] History rows carry `tnpsc_stage_id` / `track` / `tnpsc_level`, and the filters work.
- [ ] Registration succeeds without any school field, with `target_groups: ["group-4"]`.
- [ ] Levels array is always length 3, in order, for every stage.
- [ ] All percentages are 0–100 in every payload.

---

## 14. Delivery phases

| Phase | Scope | Unblocks |
|---|---|---|
| **P0** | §4.1–§4.5 schema + §10 seed + §4.3 question tagging columns | everything |
| **P1** | §5.1 catalog | real group/stage/syllabus tree in the portal |
| **P2** | §5.2 mock-tests + §7.1/§7.2 `LEVEL_LOCKED` + §7.3/§7.4 progress | the level gate becomes real |
| **P3** | §5.3 practice-tests | syllabus track becomes real |
| **P4** | §6.2/§6.3 tagging + §6.4/§6.5 generators + §6.6 coverage | content team can produce at scale |
| **P5** | §7.5–§7.7 field additions, §5.4 progress, §7.10 dashboard | history/report/dashboard polish |
| **P6** | §7.9 `target_groups`, §6.7 support tool, §6.8 settings | onboarding + operations |

The frontend works today against a client-side fallback (see §15 of
[`TNPSC_BACKEND_CHANGES.md`](TNPSC_BACKEND_CHANGES.md)); each phase above simply makes it accurate.
Nothing needs to be big-banged.

---

## 15. Open questions for product

1. **Pass mark** — is 50% the right unlock threshold, or should it be attempt-only ("finish one Simple mock, regardless of score")? One config value either way.
2. **Attempt limits** — §8.3. Without a fix, one bad attempt on a single-attempt mock is a dead end. Recommend 3 attempts for TNPSC mocks.
3. **Unlock rule** — clear *any* mock in a level, or *all* of them? Spec assumes `any`.
4. **Are levels per stage or per group?** Spec assumes **per stage** (clearing G1-Prelims Simple does not unlock G4-Written Medium). Confirm.
5. **Difficulty mixes** per level (§6.4 table) — content team to confirm.
6. **Practice set size** — fixed 40, or per-topic based on syllabus weight within 30–50?
7. **Does the level gate apply to practice tests at all?** Spec says no (per the requirement, levels were described for mock tests).
8. **Pricing** — are Medium/Complex levels or mocks paid, and does the level gate stack with the paywall? Spec keeps them independent.
9. **Language** — do Group 4 papers need a Tamil/English medium switch per attempt (`preferred_medium`), or separate papers per medium?
10. **Group 1 Mains** — descriptive evaluation is out of scope today; confirm it stays `coming_soon` for this release.
