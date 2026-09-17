# TNPSC Portal — Backend Changes Required

> **This is the 2-page summary.** The full engineering spec — every endpoint with request/response
> JSON, DDL, error codes, algorithms, migration plan and QA checklist — is in
> **[`TNPSC_API_SPEC.md`](TNPSC_API_SPEC.md)**. Give the backend team that one; this page is the
> orientation.

_The frontend (aspirant portal) has already been restructured around this contract and ships with a
client-side fallback, so nothing is broken while these endpoints are built — but the hierarchy,
level gating and question-count rules are only **real** once the backend owns them._

---

## 1. What changed on the frontend

The aspirant portal is no longer a flat list of courses/assessments. It is now a 4-level hierarchy:

```
Login
 └── Exam Group          TNPSC Group 1            TNPSC Group 4
      └── Stage          ├── Prelims  (live)      └── Written (live)
                         └── Mains    (coming soon)
           └── Track     ├── Mock Test        (level gated)
                         └── Practice Test    (syllabus wise, ungated)
                └── Level (mock only)   Simple → Medium → Complex
                └── Subject/Topic (practice only)
```

Routes added: `/user/exams`, `/user/exams/:groupId`, `/user/exams/:groupId/:stageId?tab=mock|practice`.

**Business rules the UI now expresses (backend must enforce them):**

| # | Rule |
|---|------|
| R1 | A mock test belongs to exactly one level: `simple`, `medium` or `complex`. |
| R2 | **Medium is locked until Simple is cleared; Complex is locked until Medium is cleared.** "Cleared" = a submitted attempt on any mock test of that level scoring **≥ 50%** (make this a config value, `TNPSC_LEVEL_PASS_PERCENTAGE`). |
| R3 | A **mock test is a full-length paper** in the real TNPSC pattern — Group 1 Prelims and Group 4 Written are both **200 questions / 300 marks / 180 minutes**. |
| R4 | A **practice test is syllabus based** — one set per subject/topic, **30–50 questions** (target 40), short duration (≈1 min/question). Practice tests are **not** level-gated. |
| R5 | Group 1 Mains and any other stage marked `coming_soon` must not return attemptable papers yet. |

> ⚠️ R2 must be enforced **server-side on attempt start**, not only in the UI. A locked-level
> `POST .../start` must return `403` with `{"detail": {"code": "LEVEL_LOCKED", "message": "...", "required_level": "simple", "required_percentage": 50}}`.

---

## 2. Data model changes

### 2.1 Taxonomy tables (new)

```sql
tnpsc_groups     (group_id PK, code 'group-1'|'group-4', name, tagline, description, display_order, is_active)
tnpsc_stages     (stage_id PK, group_id FK, code 'group-1-prelims'|'group-1-mains'|'group-4-written',
                  name, short_name, description, paper_type 'objective'|'descriptive',
                  status 'active'|'coming_soon', total_questions, total_marks, duration_minutes,
                  negative_marking bool, negative_mark_value numeric, display_order)
tnpsc_sections   (section_id PK, stage_id FK, name, question_count, marks, display_order)
tnpsc_subjects   (subject_id PK, stage_id FK, code slug, name, name_ta, display_order)
tnpsc_topics     (topic_id PK, subject_id FK, code slug, name, display_order)
```

Seed values (codes must match exactly — the frontend keys off them) are in
[`src/config/tnpsc.ts`](src/config/tnpsc.ts): 2 groups, 3 stages, and the syllabus subject/topic tree
(General Science, Current Events, Geography, History & Culture, Indian Polity, Indian Economy,
Indian National Movement, TN History & Socio-Political Movements, Development Administration in TN,
Aptitude & Mental Ability, plus General Tamil and General English for Group 4). Use that file as the seed script
source of truth.

### 2.2 Tag the existing papers

Add to **both** `tests` and `eval_assessments` (whichever table backs an attemptable paper):

```sql
ALTER TABLE tests ADD COLUMN tnpsc_stage_id  UUID NULL REFERENCES tnpsc_stages(stage_id);
ALTER TABLE tests ADD COLUMN track           VARCHAR(10) NULL;  -- 'mock' | 'practice'
ALTER TABLE tests ADD COLUMN tnpsc_level     VARCHAR(10) NULL;  -- 'simple' | 'medium' | 'complex' (mock only)
ALTER TABLE tests ADD COLUMN tnpsc_subject_id UUID NULL REFERENCES tnpsc_subjects(subject_id);  -- practice only
ALTER TABLE tests ADD COLUMN tnpsc_topic_id   UUID NULL REFERENCES tnpsc_topics(topic_id);      -- practice only
CREATE INDEX ix_tests_tnpsc ON tests (tnpsc_stage_id, track, tnpsc_level);
```

Validation on create/update:
- `track = 'mock'` → `tnpsc_level` required, `subject/topic` must be null, `question_count` must equal the stage's `total_questions` (200).
- `track = 'practice'` → `tnpsc_subject_id` required (topic optional), `tnpsc_level` must be null, `30 ≤ question_count ≤ 50`.

### 2.3 Level progress (new)

```sql
tnpsc_level_progress (user_id, stage_id, level, best_percentage, attempts, cleared_at, PRIMARY KEY (user_id, stage_id, level))
```

Upsert this on every attempt submission (mock track only). It is what powers unlock checks without
re-scanning the attempt table.

---

## 3. New endpoints

All are authenticated with the **user** access token (same auth as `/api/v1/user/*`).

### 3.1 `GET /api/v1/user/tnpsc/catalog`

Returns the whole navigable tree. Response:

```json
{
  "groups": [
    {
      "id": "group-1",
      "name": "TNPSC Group 1",
      "short_name": "Group 1",
      "tagline": "Combined Civil Services Examination — I",
      "description": "Deputy Collector, DSP, Assistant Commissioner …",
      "accent": "from-indigo-500 via-violet-500 to-purple-600",
      "posts": ["Deputy Collector", "DSP (Category-1)"],
      "stages": [
        {
          "id": "group-1-prelims",
          "group_id": "group-1",
          "name": "Preliminary Examination",
          "short_name": "Prelims",
          "description": "Single objective paper of 200 questions …",
          "status": "active",
          "paper_type": "objective",
          "pattern": {
            "total_questions": 200,
            "total_marks": 300,
            "duration_minutes": 180,
            "negative_marking": false,
            "sections": [
              { "name": "General Studies", "questions": 175 },
              { "name": "Aptitude & Mental Ability", "questions": 25 }
            ]
          },
          "subjects": [
            { "id": "indian-polity", "name": "Indian Polity", "name_ta": "இந்திய அரசியலமைப்பு",
              "topics": [{ "id": "constitution-basics", "name": "Constitution — Basics & Preamble" }] }
          ]
        },
        { "id": "group-1-mains", "short_name": "Mains", "status": "coming_soon", "paper_type": "descriptive", "subjects": [] }
      ]
    },
    { "id": "group-4", "…": "…", "stages": [{ "id": "group-4-written", "status": "active", "…": "…" }] }
  ]
}
```

### 3.2 `GET /api/v1/user/tnpsc/stages/{stage_id}/mock-tests`

Returns the three levels **with the unlock state already computed for the calling user**.

```json
{
  "stage_id": "group-1-prelims",
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
          "test_id": "0f6c…",
          "source": "test",
          "title": "Group 1 Prelims — Simple Mock 01",
          "group_id": "group-1",
          "stage_id": "group-1-prelims",
          "test_type": "mock",
          "level": "simple",
          "subject_id": null, "subject_name": null, "topic_id": null, "topic_name": null,
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
          "max_attempts": 1,
          "best_percentage": 62.5,
          "is_completed": true
        }
      ]
    },
    { "level": "medium", "is_unlocked": false,
      "lock_reason": "Score at least 50% in a simple mock test to unlock this level.",
      "required_percentage": 50, "best_percentage": null, "is_completed": false,
      "tests_total": 3, "tests_completed": 0, "tests": [] },
    { "level": "complex", "is_unlocked": false, "…": "…" }
  ]
}
```

Notes:
- Always return **all three levels**, even when empty (`tests_total: 0`).
- For a locked level you may return `tests: []` (recommended) or the metadata without ids — the UI
  hides the cards either way.
- `source` tells the client which take-flow to open: `"test"` → `/user/test/{id}/start`,
  `"assessment"` → `/user/assessment/{id}`. Keep it accurate.
- `is_locked` / `lock_reason` on a **test** are for subscription/paywall locks — separate from the
  level lock, which lives on the level object.

### 3.3 `GET /api/v1/user/tnpsc/stages/{stage_id}/practice-tests`

Query params: `subject` (subject code, optional), `topic` (topic code, optional).

```json
{
  "stage_id": "group-1-prelims",
  "subjects": [
    {
      "subject_id": "indian-polity",
      "subject_name": "Indian Polity",
      "subject_name_ta": "இந்திய அரசியலமைப்பு",
      "tests": [
        {
          "test_id": "c31a…",
          "source": "test",
          "title": "Indian Polity — Fundamental Rights (Set 1)",
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
    }
  ]
}
```

Return **every syllabus subject of the stage**, including ones with `tests: []` — the portal renders
the full syllabus so the aspirant can see what is coming.

### 3.4 (Optional but useful) `GET /api/v1/user/tnpsc/progress`

Per-stage roll-up for the dashboard: `{ stage_id, mock: { simple: {...}, medium: {...}, complex: {...} }, practice: { attempted, total } }`.

---

## 4. Changes to existing endpoints

| Endpoint | Change |
|---|---|
| `POST /api/v1/user/eval-assessments/{id}/start` and `POST /api/v1/user/tests/{id}/start` | Reject with `403 LEVEL_LOCKED` when the paper's level is not yet unlocked for the user (R2). |
| `…/attempts/{attempt_id}/submit` | After scoring a **mock** attempt, upsert `tnpsc_level_progress` and mark the level cleared when `percentage ≥ TNPSC_LEVEL_PASS_PERCENTAGE`. Include `{"level_cleared": true, "next_level_unlocked": "medium"}` in the submit response so the portal can celebrate the unlock. |
| `GET /api/v1/user/history` | Add `tnpsc_stage_id`, `track`, `tnpsc_level`, `tnpsc_subject_id` to each attempt row so history/reports can be filtered by group, stage and level. |
| `GET /api/v1/user/eval-assessments` (dashboard list) | Keep working — it now feeds the "Assigned Assessments" panel only. Add the same four TNPSC fields to each item. |
| Registration / profile (`board`, `student_class`) | The school-portal fields no longer fit. Replace the filter with `target_group` (`group-1` / `group-4`, multi-select) captured at registration and editable in the profile; use it to order/pre-select the group cards. Existing `board`/`grade` filters on assessment listing should be dropped or ignored for TNPSC. |

---

## 5. Admin / content-authoring side

The admin Evaluation Hub must be able to tag what it generates, otherwise nothing lands in the
right bucket:

1. Assessment/test creation form gains: **Exam group → Stage → Track (Mock/Practice) → Level (mock)
   or Subject + Topic (practice)**.
2. Generator constraints per track:
   - Mock: exactly the stage pattern (200 Qs, section-wise split — G1 Prelims 175 GS + 25 Aptitude;
     G4 Written 100 Language + 75 GS + 25 Aptitude), difficulty mix skewed by level
     (Simple ≈ 70% easy / 30% medium; Medium ≈ 30/50/20; Complex ≈ 10% medium / 60% hard / 30% analytical).
   - Practice: 30–50 questions drawn from one subject (optionally one topic), difficulty mixed.
3. Bulk-tag the existing question bank with `tnpsc_subject_id` / `tnpsc_topic_id` so the generator
   can source syllabus-wise papers at all. **This is the long pole — please start here.**
4. A publish check that refuses a mock test whose `question_count ≠ stage.total_questions` and a
   practice test outside 30–50.

---

## 6. Contract details the frontend depends on

- Level codes are exactly `simple` | `medium` | `complex`; track codes `mock` | `practice`;
  group codes `group-1` | `group-4`; stage codes `group-1-prelims` | `group-1-mains` |
  `group-4-written`. Subject/topic codes are the slugs in `src/config/tnpsc.ts`.
- `percentage` values are 0–100 numbers (not 0–1).
- `time_limit_minutes` is minutes, `null` = untimed.
- Unknown/missing `is_completed` / `best_percentage` are tolerated — the client falls back to its own
  attempt history — but then the gate is only as good as what `/user/history` returns, so please
  populate them.

## 7. Until these ship

The portal calls the three endpoints above and, on any error, derives the hierarchy client-side from
`GET /api/v1/user/eval-assessments` (mode → track, difficulty → level, title keyword → group/stage,
title match → subject). That is a stop-gap for demos only: it cannot tell a Group 1 paper from a
Group 4 paper unless the title says so, and the level gate is computed from local attempt history.
Priority order for the backend work:

1. Taxonomy tables + seed + tagging columns (§2)
2. `GET /tnpsc/catalog` (§3.1)
3. `GET /tnpsc/stages/{id}/mock-tests` with server-computed unlocks (§3.2) + `403 LEVEL_LOCKED` on start (§4)
4. `GET /tnpsc/stages/{id}/practice-tests` (§3.3)
5. Admin tagging + generator constraints (§5)
