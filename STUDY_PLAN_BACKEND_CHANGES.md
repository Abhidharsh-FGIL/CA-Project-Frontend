# Study Plan — backend changes required

The aspirant portal now ships a **Study Plan** workspace: the candidate answers a short
intake (how long until the exam, which days they study, how many hours a day), and the
server returns a dated, day-by-day preparation plan covering the syllabus — personalised
from their mock-test report when they have one, and from the exam's own mark weights when
they do not.

**Every figure, date, task and sentence in that plan is computed server-side.** The
frontend renders it and ticks tasks off. It does no scheduling arithmetic, invents no task,
and holds no copy of the syllabus allocation logic. This is a deliberate reversal of how
the attempt report works today (see §S6.1).

The frontend ships independently and is already merged. Until the endpoints below exist
every study-plan screen renders one explicit state — *"Study plans are not enabled on this
account yet"* — rather than an error, so nothing is blocked on this document landing first.
See §S10 for the degradation contract.

This document is the delta against [`TNPSC_API_SPEC.md`](TNPSC_API_SPEC.md). Sections
numbered `§S` are this document's; bare `§` refers to that spec.

---

## §S0. Why this cannot be a frontend feature

A frontend implementation already existed (`src/lib/study-plan.ts`, now deleted — see
`git log`). It was removed rather than extended, for four reasons, each of which is a
requirement on the backend:

| Limitation | Why only the backend fixes it |
|---|---|
| Horizon capped at 4 weeks by a hardcoded array | A 6-month plan is ~160 study days × 3–5 tasks. That is a database, not a `useMemo`. |
| Nothing persisted | The candidate must tick off Tuesday's work and still see it ticked on Friday, on another device. |
| Recomputed on every render | A plan that silently changes when you reload is not a plan. Generate once, version it. |
| Could only run with a browser open | Adaptive revision, nightly re-scoring, ICS feeds and reminder notifications all run with nobody logged in. |

---

## §S1. The generation model: deterministic scheduler, bounded LLM

**Do not ask the LLM to emit the calendar.** Two layers:

```
Layer 1 — deterministic scheduler (pure Python, no model call)
  calendar + weekday mapping · minute budgeting · topic allocation across the
  horizon · spaced-revision offsets · mock placement · buffer · phase boundaries
  → reproducible, unit-testable, ~1-2s, free

Layer 2 — LLM narrative (bounded, cached)
  phase themes · week narratives (first 3 weeks only) · per-priority coaching
  notes · success-criterion wording
  → every field has a deterministic fallback and is optional in the response
```

Layer 2 uses the same contract `report_insights` already uses (§S9): a response missing a
section degrades to that section's deterministic text rather than the whole plan failing.
A plan is **never** blocked on the model call — if Layer 2 errors or times out, the plan is
still `active`, with null narratives and `model: null`.

**Rationale for the split.** An LLM asked for 160 days of tasks will exceed the minute
budget, skip syllabus units, repeat itself, cost ~50–100× more per plan, and produce a
different plan for the same input every time. All four are disqualifying. The arithmetic is
genuinely deterministic; only the prose benefits from a model.

### §S1.1 Progressive detail

Do not materialise day-level tasks for the whole horizon up front.

| Weeks | `detail_status` | Contents |
|---|---|---|
| Current + next 2 | `detailed` | Full `study_plan_days` + `study_plan_tasks` rows |
| Everything beyond | `outline` | `study_plan_weeks` row only: theme, target minutes, subjects in scope |

A nightly job (§S7.2) rolls the window forward, filling the next week as the current one
passes. This keeps generation under a minute and the tables small — but the real reason is
that week 14 then absorbs the three mocks the candidate sat since the plan was made,
instead of being decided on day one and going stale.

---

## §S2. Database changes (§4)

Seven tables. All `plan_id` foreign keys are `ON DELETE CASCADE`.

```sql
-- ─── One row per plan generated. Revisions version; they never overwrite. ───
CREATE TABLE study_plans (
  plan_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  group_id         VARCHAR(32) NOT NULL,        -- 'group-1' | 'group-4' | 'gat-b'
  stage_id         VARCHAR(48) NOT NULL,
  basis_kind       VARCHAR(16) NOT NULL,        -- 'attempt'|'latest'|'progress'|'cold_start'
  basis_attempt_id UUID NULL REFERENCES test_attempts(attempt_id) ON DELETE SET NULL,
  status           VARCHAR(16) NOT NULL,        -- 'generating'|'active'|'paused'|'archived'|'superseded'|'failed'
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  exam_date        DATE NULL,
  intake           JSONB NOT NULL,              -- the raw answers, verbatim (§S4.1)
  feasibility      VARCHAR(16) NOT NULL,        -- 'comfortable'|'tight'|'not_feasible'
  total_minutes    INTEGER NOT NULL,            -- planned, summed over study days
  revision_of      UUID NULL REFERENCES study_plans(plan_id) ON DELETE SET NULL,
  version          INTEGER NOT NULL DEFAULT 1,
  model            VARCHAR(64) NULL,            -- NULL when Layer 2 did not run
  generated_at     TIMESTAMPTZ NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NULL
);

-- At most one active plan per user. Enforce in the schema, not the service layer.
CREATE UNIQUE INDEX study_plans_one_active
  ON study_plans (user_id) WHERE status = 'active';
CREATE INDEX study_plans_user_status ON study_plans (user_id, status);

-- ─── Foundation → Build → Integrate → Revise → Final sprint ───
CREATE TABLE study_plan_phases (
  phase_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id    UUID NOT NULL REFERENCES study_plans(plan_id) ON DELETE CASCADE,
  idx        SMALLINT NOT NULL,
  label      VARCHAR(64) NOT NULL,       -- deterministic, e.g. 'Foundation'
  theme      TEXT NULL,                  -- LLM; NULL → frontend shows label alone
  goal       TEXT NULL,                  -- LLM
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  UNIQUE (plan_id, idx)
);

CREATE TABLE study_plan_weeks (
  week_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id        UUID NOT NULL REFERENCES study_plans(plan_id) ON DELETE CASCADE,
  phase_id       UUID NOT NULL REFERENCES study_plan_phases(phase_id) ON DELETE CASCADE,
  week_no        SMALLINT NOT NULL,      -- 1-based
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  theme          VARCHAR(128) NOT NULL,  -- deterministic
  narrative      TEXT NULL,              -- LLM, first 3 weeks only
  target_minutes INTEGER NOT NULL,
  detail_status  VARCHAR(8) NOT NULL,    -- 'outline' | 'detailed'
  subject_ids    TEXT[] NOT NULL DEFAULT '{}',  -- in scope; lets outline weeks say something
  UNIQUE (plan_id, week_no)
);

CREATE TABLE study_plan_days (
  day_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id           UUID NOT NULL REFERENCES study_plans(plan_id) ON DELETE CASCADE,
  week_id           UUID NOT NULL REFERENCES study_plan_weeks(week_id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  weekday           SMALLINT NOT NULL,   -- 1=Mon … 7=Sun (ISO)
  is_rest           BOOLEAN NOT NULL DEFAULT false,
  planned_minutes   INTEGER NOT NULL DEFAULT 0,
  status            VARCHAR(8) NOT NULL DEFAULT 'pending',  -- pending|done|partial|skipped
  completed_minutes INTEGER NOT NULL DEFAULT 0,
  UNIQUE (plan_id, date)
);
CREATE INDEX study_plan_days_range ON study_plan_days (plan_id, date);

CREATE TABLE study_plan_tasks (
  task_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id            UUID NOT NULL REFERENCES study_plan_days(day_id) ON DELETE CASCADE,
  ord               SMALLINT NOT NULL,
  subject_id        VARCHAR(64) NOT NULL,
  topic_id          VARCHAR(64) NULL,
  unit_id           VARCHAR(64) NULL,    -- published syllabus unit, when the task maps to one
  kind              VARCHAR(12) NOT NULL,-- concept|notes|practice|review|revision|mock|diagnostic
  title             VARCHAR(256) NOT NULL,
  minutes           INTEGER NOT NULL,
  question_target   INTEGER NOT NULL DEFAULT 0,
  resource_ref      TEXT NULL,
  test_id           UUID NULL REFERENCES tests(test_id) ON DELETE SET NULL,  -- §S6.3
  test_source       VARCHAR(16) NULL,    -- 'test' | 'assessment' — which take-flow (§S6.3). Shipped.
  success_criterion TEXT NULL,
  coaching_note     TEXT NULL,           -- LLM
  status            VARCHAR(8) NOT NULL DEFAULT 'pending',
  actual_minutes    INTEGER NULL,
  score             NUMERIC(5,2) NULL,
  completed_at      TIMESTAMPTZ NULL,
  UNIQUE (day_id, ord)
);
CREATE INDEX study_plan_tasks_day ON study_plan_tasks (day_id, ord);

-- ─── Proves nothing was skipped; powers the "syllabus coverage 62%" meter. ───
CREATE TABLE study_plan_coverage (
  plan_id            UUID NOT NULL REFERENCES study_plans(plan_id) ON DELETE CASCADE,
  subject_id         VARCHAR(64) NOT NULL,
  topic_id           VARCHAR(64) NOT NULL DEFAULT '',  -- '' = subject-level row
  planned_sessions   INTEGER NOT NULL DEFAULT 0,
  completed_sessions INTEGER NOT NULL DEFAULT 0,
  planned_minutes    INTEGER NOT NULL DEFAULT 0,
  first_scheduled    DATE NULL,
  last_scheduled     DATE NULL,
  priority_rank      SMALLINT NULL,     -- from the report basis; NULL on cold start
  archetype          VARCHAR(32) NULL,  -- CONCEPT_REPAIR, SPEED_DRILL, … (§S6.1)
  PRIMARY KEY (plan_id, subject_id, topic_id)
);

-- ─── Generation jobs. Reuse the existing generator job store if you prefer; the
--     frontend only needs the status shape in §S4.4. ───
CREATE TABLE study_plan_jobs (
  job_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES study_plans(plan_id) ON DELETE CASCADE,
  status      VARCHAR(12) NOT NULL,   -- queued|running|completed|failed
  progress    SMALLINT NOT NULL DEFAULT 0,
  stage_label VARCHAR(128) NULL,
  error       TEXT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NULL
);
```

### §S2.1 One migration note

`study_plans_one_active` is a partial unique index, so `POST /study-plans` must either
archive the existing active plan in the same transaction or fail with
`PLAN_ALREADY_ACTIVE`. Do the former (§S4.3) — a candidate asking for a new plan is asking
to replace the old one, and surfacing a constraint violation for that is a bug.

---

## §S3. Where the plan's personalisation comes from

`basis_kind` decides what evidence the scheduler weights topics by.

| `basis_kind` | Evidence | Scheduler behaviour |
|---|---|---|
| `attempt` | One named attempt's subject metrics + ranked priorities | Weight weak subjects up; open with repair work on priority 1 |
| `latest` | The user's most recent submitted attempt in this stage | Same, resolved server-side |
| `progress` | Up to 10 recent attempts — trend, not snapshot | Weight by *persistent* weakness; ignore one bad day |
| `cold_start` | None | Weight purely by exam mark share; **weeks 1–2 carry diagnostic sets** so evidence arrives fast, then auto-revise (§S7.1) |

`cold_start` is not a degraded mode — it is the path most new users take, and it must
produce a plan as detailed as any other. The only differences are that priority ranks are
absent and the early weeks are instrumented to discover them.

---

## §S4. Endpoints

All under `/api/v1/user/`, all authenticated with the user access token, all scoped to the
calling user — a `plan_id` belonging to another user is a **404**, never a 403.

| Method | Path | § |
|---|---|---|
| `GET` | `study-plan/intake-options?group_id=&stage_id=` | S4.2 |
| `POST` | `study-plan/feasibility` | S4.2 |
| `POST` | `study-plans` | S4.3 |
| `GET` | `study-plans/{plan_id}/status` | S4.4 |
| `GET` | `study-plans/active` | S4.5 |
| `GET` | `study-plans` | S4.5 |
| `GET` | `study-plans/{plan_id}` | S4.6 |
| `GET` | `study-plans/{plan_id}/days?from=&to=` | S4.7 |
| `GET` | `study-plans/{plan_id}/today` | S4.7 |
| `PATCH` | `study-plans/{plan_id}/tasks/{task_id}` | S4.8 |
| `PATCH` | `study-plans/{plan_id}` | S4.9 |
| `POST` | `study-plans/{plan_id}/reschedule` | S4.9 |
| `POST` | `study-plans/{plan_id}/revise` | S4.9 |
| `GET` | `study-plans/{plan_id}/export?format=pdf\|docx\|ics` | S4.10 |

### §S4.1 The intake object

Posted to `feasibility` and `study-plans` unchanged, and stored verbatim in
`study_plans.intake` so a plan can always be regenerated from what was actually asked.

```json
{
  "group_id": "group-4",
  "stage_id": "group-4-written",
  "basis": { "kind": "attempt", "attempt_id": "8f1c…" },
  "horizon": { "mode": "months", "value": 6 },
  "start_date": "2026-10-05",
  "exam_date": "2027-04-11",
  "study_days": ["mon", "tue", "wed", "thu", "fri", "sat"],
  "minutes_per_day": 180,
  "per_day_minutes": { "sat": 300 },
  "revision_intensity": "balanced",
  "include_full_mocks": true,
  "coverage_mode": "full",
  "language": "ta",
  "optional_subjects": ["general-tamil"]
}
```

| Field | Rules |
|---|---|
| `basis.kind` | `attempt` requires `attempt_id`; the other three forbid it |
| `horizon.mode` | `days` \| `weeks` \| `months` \| `exam_date`. With `exam_date`, derive the horizon from `start_date`→`exam_date` and ignore `value` |
| `exam_date` | Optional unless `mode` is `exam_date`. When present, the last phase is a final sprint anchored to it and no task is scheduled on or after it |
| `study_days` | 1–7 of `mon`…`sun`. Days absent become `is_rest` rows — **still create the row**, so the calendar has no holes |
| `minutes_per_day` | 30–720. The default for every day in `study_days` |
| `per_day_minutes` | Per-weekday override, same bounds. Keys must be in `study_days` |
| `revision_intensity` | `light` \| `balanced` \| `heavy` → spaced-revisit offsets (§S6.4) |
| `coverage_mode` | `full` \| `high_yield`. `high_yield` drops the lowest-weight tail of topics; set by a feasibility suggestion |
| `optional_subjects` | Which of a mutually-exclusive pair the candidate sits (Group 4: General Tamil **or** General English — never both, see `STAGE_SECTION_QUESTIONS` in `src/data/examSyllabus.ts`). Unchosen subjects are excluded from coverage entirely |
| `language` | `en` \| `ta`. Governs Layer 2's output language and `title` wording |

Validation failures return `422` with
`{"detail": {"code": "INVALID_INTAKE", "field": "minutes_per_day", "message": "…"}}`.

### §S4.2 Intake options and feasibility — the two that matter most

`GET study-plan/intake-options` exists so the wizard hardcodes nothing:

```json
{
  "group_id": "group-4",
  "stage_id": "group-4-written",
  "stage_name": "Group 4 — Written Examination",
  "subject_count": 11,
  "topic_count": 240,
  "total_marks": 300,
  "estimated_syllabus_minutes": 54000,
  "suggested_minutes_per_day": 180,
  "suggested_horizons": [
    { "mode": "months", "value": 3,  "label": "3 months", "verdict": "tight" },
    { "mode": "months", "value": 6,  "label": "6 months", "verdict": "comfortable" },
    { "mode": "months", "value": 12, "label": "1 year",   "verdict": "comfortable" }
  ],
  "known_exam_date": "2027-04-11",
  "optional_subject_groups": [
    { "choose": 1, "options": [
      { "subject_id": "general-tamil",   "name": "General Tamil" },
      { "subject_id": "general-english", "name": "General English" }
    ]}
  ],
  "attempts_available": 3,
  "latest_attempt": {
    "attempt_id": "8f1c…", "test_name": "Group 4 Mock 3",
    "date": "2026-09-28", "percentage": 54.5,
    "weak_subjects": ["indian-polity", "aptitude-and-mental-ability"]
  },
  "has_active_plan": false
}
```

`POST study-plan/feasibility` takes an intake and **writes nothing**:

```json
{
  "verdict": "tight",
  "available_minutes": 46800,
  "required_minutes": 54000,
  "shortfall_minutes": 7200,
  "shortfall_pct": 13,
  "study_day_count": 156,
  "message": "6 months at 3 hours a day covers the syllabus once, with no slack for revision.",
  "suggestions": [
    { "kind": "add_minutes", "label": "Study 45 min more on study days", "patch": { "minutes_per_day": 225 } },
    { "kind": "add_day",     "label": "Add Sunday",                     "patch": { "study_days": ["mon","tue","wed","thu","fri","sat","sun"] } },
    { "kind": "extend",      "label": "Extend to 8 months",             "patch": { "horizon": { "mode": "months", "value": 8 } } },
    { "kind": "high_yield",  "label": "Cover high-yield units only",    "patch": { "coverage_mode": "high_yield" } }
  ]
}
```

`suggestions[].patch` is a partial intake the frontend merges and re-submits — the server
owns what a fix *is*, the frontend only offers it.

**This endpoint is the single highest-value item in this document.** A plan that cannot fit
the syllabus into the time available is abandoned in week two, and the only moment to say so
is before it is generated.

`verdict: "not_feasible"` (shortfall > 40%) must still allow generation if the user insists
— return it, let them proceed, store it on the plan so the workspace carries a standing
warning. Do not hard-block.

### §S4.3 Creating a plan

`POST study-plans` with an intake body. Synchronously: validate, compute feasibility,
archive any existing `active` plan, insert the `study_plans` row as `generating`, enqueue
the Celery task, return **202**:

```json
{ "plan_id": "…", "job_id": "…", "status": "queued", "feasibility": "tight" }
```

Generation must not happen in the request. A 6-month plan with a Layer 2 call takes 20–60s;
the frontend polls (§S4.4) and shows progress.

### §S4.4 Status

`GET study-plans/{plan_id}/status` — deliberately the same shape the paper generator already
returns, so the frontend's poll helper is a copy of `pollPaperExtraction`
(`src/lib/paperImportApi.ts:125`):

```json
{ "status": "running", "progress": 60, "stage_label": "Allocating topics across 26 weeks", "error": null }
```

`status` ∈ `queued|running|completed|failed`. Poll interval 2s. Suggested `stage_label`
sequence: *Reading your report* → *Weighting the syllabus* → *Allocating topics across N
weeks* → *Scheduling revision* → *Writing your plan*.

On `failed`, `error` is a sentence shown to the user and the plan row is `failed` — not left
`generating` forever. A plan stuck in `generating` > 10 minutes is swept to `failed` by the
nightly job.

### §S4.5 Active plan and list

`GET study-plans/active` → **204 No Content** when there is none (the frontend's "create
your plan" state), otherwise the §S4.6 payload **plus** `today`:

```json
{
  "plan": { "…": "§S4.6 header" },
  "today": {
    "date": "2026-10-01", "is_rest": false,
    "planned_minutes": 180, "completed_minutes": 45, "status": "partial",
    "tasks": [ "…§S4.7 task objects…" ]
  },
  "adherence": { "window_days": 14, "planned_minutes": 2340, "completed_minutes": 1810, "pct": 77, "streak_days": 6 },
  "coverage": { "topics_total": 240, "topics_touched": 61, "pct": 25 }
}
```

`GET study-plans` → `{ "items": [header…], "total": n }`, newest first, all statuses.

### §S4.6 Plan header, phases, weeks

`GET study-plans/{plan_id}` returns the whole outline but **no day rows** — that keeps a
1-year plan's response a few KB:

```json
{
  "plan_id": "…", "status": "active", "version": 2, "revision_of": "…",
  "group_id": "group-4", "stage_id": "group-4-written", "stage_name": "Group 4 — Written",
  "basis": { "kind": "attempt", "attempt_id": "8f1c…", "test_name": "Group 4 Mock 3",
             "date": "2026-09-28", "percentage": 54.5 },
  "start_date": "2026-10-05", "end_date": "2027-04-04", "exam_date": "2027-04-11",
  "feasibility": "tight",
  "intake": { "…": "as posted" },
  "totals": { "weeks": 26, "study_days": 156, "planned_minutes": 28080, "mocks": 12 },
  "goal": { "headline": "Close the Polity gap, then build coverage to 80%",
            "targets": ["Raise attempt rate from 68% to 85%", "…"] },
  "phases": [
    { "phase_id": "…", "idx": 0, "label": "Foundation", "theme": "…", "goal": "…",
      "start_date": "2026-10-05", "end_date": "2026-11-15", "week_nos": [1,2,3,4,5,6] }
  ],
  "weeks": [
    { "week_id": "…", "week_no": 1, "phase_idx": 0,
      "start_date": "2026-10-05", "end_date": "2026-10-11",
      "theme": "Polity foundations + diagnostic baseline", "narrative": "…",
      "target_minutes": 1080, "detail_status": "detailed",
      "subject_ids": ["indian-polity", "general-tamil"],
      "progress": { "planned_minutes": 1080, "completed_minutes": 1080, "status": "done" } }
  ],
  "coverage": {
    "topics_total": 240, "topics_touched": 61, "pct": 25,
    "by_subject": [
      { "subject_id": "indian-polity", "name": "Indian Polity",
        "topics_total": 24, "topics_planned": 24, "topics_completed": 9,
        "planned_minutes": 3600, "priority_rank": 1, "archetype": "CONCEPT_REPAIR" }
    ]
  },
  "adherence": { "window_days": 14, "pct": 77, "streak_days": 6 },
  "narrative_source": "llm"
}
```

`narrative_source` is `"llm"` or `"deterministic"` — mirrors `report_insights.source` and
lets the UI be honest about what it is showing.

### §S4.7 Days and tasks

`GET study-plans/{plan_id}/days?from=2026-10-05&to=2026-10-11` — the week/calendar view's
only data call. Range inclusive, capped at **62 days** per request (`422` with
`RANGE_TOO_LARGE` beyond).

```json
{
  "from": "2026-10-05", "to": "2026-10-11", "outline_from": null,
  "days": [
    {
      "day_id": "…", "date": "2026-10-05", "weekday": 1, "week_no": 1,
      "is_rest": false, "planned_minutes": 180, "completed_minutes": 180, "status": "done",
      "tasks": [
        { "task_id": "…", "ord": 0, "kind": "concept",
          "subject_id": "indian-polity", "subject_name": "Indian Polity",
          "topic_id": "fundamental-rights", "topic_name": "Fundamental Rights",
          "unit_id": null,
          "title": "Fundamental Rights — Articles 12-35, concept pass",
          "minutes": 55, "question_target": 0,
          "resource_ref": "Concept notes + worked examples",
          "test_id": null, "test_source": null,
          "success_criterion": "Can state each Article's scope without notes",
          "coaching_note": "Your Mock 3 errors clustered on Art. 19 exceptions — start there.",
          "status": "done", "actual_minutes": 60, "score": null }
      ]
    },
    { "day_id": "…", "date": "2026-10-11", "weekday": 7, "week_no": 1,
      "is_rest": true, "planned_minutes": 0, "completed_minutes": 0,
      "status": "pending", "tasks": [] }
  ]
}
```

Rest days **are** returned, with `tasks: []`. The frontend draws a 7-column week and needs
every column to exist.

If a requested range falls in `outline` weeks, return the days that exist (possibly none)
and set `outline_from` to the first undetailed date, so the UI says *"this week is not
detailed yet"* rather than showing an empty week.

`GET study-plans/{plan_id}/today` → the single day object above for the user's local date.
Accepts `?date=`; absent, use the user's stored timezone, falling back to `Asia/Kolkata`.
**Do not use server UTC date** — a 23:30 IST session would see tomorrow's tasks.

### §S4.8 Ticking work off

`PATCH study-plans/{plan_id}/tasks/{task_id}`:

```json
{ "status": "done", "actual_minutes": 60, "score": 72.5 }
```

All three fields optional; `status` ∈ `pending|done|partial|skipped`. The response is the
**recomputed day plus the plan's rolled-up counters**, so one round trip refreshes every
meter on screen:

```json
{
  "task": { "…": "updated task" },
  "day": { "…": "recomputed day: completed_minutes, status" },
  "adherence": { "window_days": 14, "pct": 79, "streak_days": 7 },
  "coverage": { "topics_total": 240, "topics_touched": 62, "pct": 26 },
  "xp_awarded": 15
}
```

Side effects, in the same transaction:

1. Recompute `study_plan_days.completed_minutes` and `status` (`done` when every non-skipped task is done, `partial` when some are).
2. Increment `study_plan_coverage.completed_sessions` for the task's `(subject_id, topic_id)`.
3. Award XP / advance the streak — the portal already has `XPBar`, `StreakBadge` and `use-points.ts`. A plan with no streak is a document, not a habit.

Idempotent: re-sending `done` for a task already `done` must not double-count minutes,
coverage or XP.

### §S4.9 Mutating a live plan

`PATCH study-plans/{plan_id}` — `{"status": "paused" | "active" | "archived"}`, or
`{"intake": {partial}}` to change hours/days going forward. An intake change **reschedules
from tomorrow and never rewrites the past**: completed days keep their rows and their ticks.

`POST study-plans/{plan_id}/reschedule` —
`{"from": "2026-10-14", "strategy": "compress" | "shift"}` for the candidate who missed a
week. `compress` folds the missed work into the remaining budget; `shift` pushes everything
later and reports the new `end_date` (and whether it now passes `exam_date`, which the UI
must warn about).

`POST study-plans/{plan_id}/revise` — `{"basis": {"kind": "attempt", "attempt_id": "…"}}`.
Generates a **new plan row** with `revision_of` set and `version + 1`, marks the old one
`superseded`, carries completed history forward, and returns `{plan_id, job_id}` like §S4.3.
This is what the report page's *"Update my plan with this result"* button calls.

### §S4.10 Export

`GET study-plans/{plan_id}/export?format=pdf|docx|ics`. `pdf`/`docx` mirror the report
exports already in the codebase. `ics` is the cheap win: one `VEVENT` per task, `DTSTART`
from the day's date and a sensible start hour, so the plan subscribes into Google Calendar.
Serve as `text/calendar` with a stable `UID` per `task_id`, so re-subscribing updates rather
than duplicates.

---

## §S5. Celery task — generation pipeline

One task, `generate_study_plan(plan_id)`. Steps, with the `stage_label` each sets:

1. **Resolve basis → facts** (*Reading your report*). §S3.
2. **Build the work-item list** (*Weighting the syllabus*). Every `(subject_id, topic_id)` for the stage, excluding unchosen `optional_subjects`. Weight each (§S6.2).
3. **Budget.** `available = Σ per-weekday minutes across the horizon`. Reserve 15% buffer, 20% revision, plus mock slots. Compare to `required` → `feasibility`.
4. **Allocate into weeks** (*Allocating topics across N weeks*). §S6.3.
5. **Spaced revision** (*Scheduling revision*). §S6.4.
6. **Phases.** §S6.5.
7. **Day assembly** for the first 3 weeks only. §S6.6.
8. **Layer 2 LLM pass** (*Writing your plan*). §S6.7. Wrapped in try/except — a failure here leaves the plan `active` with null narratives, never `failed`.
9. **Write rows, mark `active`, job `completed`.**

Steps 1–7 should total < 2s; step 8 is the only slow one. Run step 8 **last**, so a timeout
costs prose, not the plan.

---

## §S6. The scheduler, specified

### §S6.1 Priorities — and the one architectural debt to clear

Priority ranking and intervention archetypes (`CONCEPT_REPAIR`, `COVERAGE_AND_SELECTION`,
`FOUNDATION_FIRST`, `SPEED_DRILL`, `MAINTENANCE`, `DIAGNOSTIC_FIRST`, `COLLECT_EVIDENCE`)
are currently computed **in the frontend**, in `src/lib/attempt-report.ts` (~106 KB). The
backend has never heard of them.

Two options:

- **Phase 1 (ship now).** The frontend posts a facts payload alongside the intake, exactly
  as it already does for `report-insights` via `factsFromModel`
  (`src/lib/attempt-report.ts:1342`). Zero porting. The intake's `basis` gains an optional
  `facts` object, and the backend uses it when present.
- **Phase 2 (required — do not skip).** Port the priority computation to Python. Until this
  lands, **a plan can only ever be created while a browser is open on the report page**,
  which rules out §S7.1 auto-revision, §S7.2 the nightly roll-forward, ICS feeds and
  reminder notifications. All four are in this document because they are what makes the
  feature worth building.

Treat `basis.facts` as a migration shim with a deletion date, not an interface.

### §S6.2 Topic weighting

```
weight(topic) = mark_share(subject)            # published syllabus counts
              × weakness_multiplier(subject)   # 1.0 strong … 2.5 priority-1 weak
              × evidence_multiplier(topic)     # 1.5 measured-weak, 1.0 unmeasured,
                                               #   0.6 measured-strong
              × recency_decay(subject)         # recent evidence counts more
```

`mark_share` comes from the published per-unit question counts — the source of truth the
frontend mirrors in `STAGE_SECTION_QUESTIONS` (`src/data/examSyllabus.ts`) and
`TnpscSyllabusUnit.questions` (`src/config/tnpsc.ts`). **Do not invent a distribution the
syllabus does not state.** Where a published unit spans several catalog subjects, keep the
unit's count on the unit and split time by topic count, not by guessed marks.

On `cold_start`, `weakness_multiplier` and `evidence_multiplier` are both 1.0 — weight is
pure mark share, which is the right prior when you know nothing.

### §S6.3 Allocation

Weighted greedy into weeks, under three constraints:

1. **Order where order matters.** Some subjects are sequential (Tamil grammar, Polity's constitutional spine) and must be scheduled in syllabus order; others interleave freely. Add a `sequential BOOLEAN` column to the subjects table rather than hardcoding a list.
2. **Interleave subjects within a week.** Two or three subjects per week, not one — blocked practice feels productive and tests worse.
3. **Link practice to real tests.** When a practice test exists for the `(stage, subject, topic)`, set `study_plan_tasks.test_id`. The frontend turns that into a one-click launch, which is the difference between a plan and homework prose. This is a large part of the feature's value — do not leave `test_id` always null.

   **Send `test_source` with it — already implemented, no work needed.** The portal has two take-flows and they are not interchangeable: admin-managed tests open at `/user/test/{id}/start`, eval assessments at `/user/assessment/{id}`. This is the same `source` discriminator `TnpscTest` carries (`src/lib/tnpscApi.ts`, `testHref`), and the backend already tags, carries, stores and returns it end to end (`study_plan_tasks.test_source`, returned by `task_out`). The frontend resolves it in `taskTestHref` (`src/lib/studyPlanApi.ts`) and falls back to `'test'` when the field is null.

   The one residual case: **plan rows generated before that code was deployed may carry a null `test_source` on an assessment-sourced paper**, which the fallback then routes to the wrong flow and lands on "Test not found". Regenerating the plan fixes it; there is nothing to change in either codebase.

For long horizons make the passes explicit: ~6 months = one full pass + revision; ~1 year =
two full passes + a revision pass, the second pass faster and practice-weighted.

### §S6.4 Spaced revision

Each taught topic gets revisits at offsets scaled by `revision_intensity`:

| `revision_intensity` | Offsets (days after the concept session) |
|---|---|
| `light` | +7, +30 |
| `balanced` | +3, +10, +30 |
| `heavy` | +2, +7, +21, +45 |

Revisits are `kind: 'revision'`, shorter than the original, and land on the nearest study
day at or after the offset. A revisit that would fall past `end_date` is dropped.

### §S6.5 Phases

Scale to horizon; never emit a phase shorter than a week.

| Horizon | Phases |
|---|---|
| ≤ 30 days | Sprint, Final revision |
| 1–3 months | Foundation, Build, Revise, Final sprint |
| 3–8 months | Foundation, Build, Integrate, Revise, Final sprint |
| > 8 months | Foundation, Build, Integrate, Second pass, Revise, Final sprint |

With `exam_date`, the final phase ends the day before it, and nothing is scheduled on or
after it.

### §S6.6 Day assembly

Fill each study day to its minute budget with tasks whose `kind` mix shifts by phase:

| Phase | concept | practice | review/revision | mock |
|---|---|---|---|---|
| Foundation | 50% | 30% | 20% | — |
| Build | 30% | 45% | 25% | occasional sectional |
| Integrate | 15% | 50% | 25% | 10% |
| Revise | 5% | 40% | 40% | 15% |
| Final sprint | — | 35% | 35% | 30% |

**Round every `minutes` to 5.** A timetable reading "55 min" is credible; "53 min" reads
like an optimiser's output and gets ignored. The deleted frontend generator got this right —
keep it.

Full mocks go at phase boundaries when `include_full_mocks`, with `minutes` from the stage's
real time allowance, and the following day carries a review task referencing the mock.

### §S6.7 The LLM pass — exactly what to ask for

One call, one JSON response, grounded in facts you already computed. Never ask it for dates,
minutes, question counts or task lists.

```json
{
  "goal":   { "headline": "…", "targets": ["…", "…"] },
  "phases": [{ "idx": 0, "theme": "…", "goal": "…" }],
  "weeks":  [{ "week_no": 1, "narrative": "…" }],
  "coaching_notes": { "indian-polity": "…", "aptitude-and-mental-ability": "…" }
}
```

Bounds: `phases` ≤ 6, `weeks` ≤ 3 (the detailed ones only), `coaching_notes` keyed by
subject id, ≤ 8 entries. Every field optional in your parsing. Store `model` and
`generated_at` on the plan; set `narrative_source: "deterministic"` when the call did not
land.

Language follows `intake.language` — Group 4's candidate base is largely Tamil-medium, and
the portal already carries bilingual report text (`src/lib/question-language.ts`).

---

## §S7. Adaptivity — what makes this worth building

A static timetable is something any coaching centre hands out on paper. These two jobs are
the feature's actual moat.

### §S7.1 On attempt submission

When a user with an `active` plan submits an attempt in that plan's stage:

1. Recompute subject metrics for the attempt.
2. Diff against the plan's assumptions: a subject that was priority 1 and is now at target is **demoted**; one that was `MAINTENANCE` and regressed is **promoted**.
3. If `adherence.pct < 60` over 14 days, scale `minutes_per_day` down toward what the user actually does — a plan they meet beats one they ignore.
4. If anything material changed, reschedule forward from tomorrow (not a new plan row) and write a notification: *"Your plan has been updated after Mock 4 — Polity moves to maintenance, Aptitude moves up."* The `notifications` table already exists.
5. If a `cold_start` plan receives its first real attempt, run a full §S4.9 `revise` — the diagnostic weeks have done their job.

### §S7.2 Nightly job

- Roll the detail window forward: fill the next `outline` week to `detailed`.
- Mark yesterday's untouched `pending` days `skipped`; recompute adherence and streak.
- Sweep plans stuck in `generating` > 10 min to `failed`.
- Expire plans past `end_date` to `archived`.

---

## §S8. Recommended build order

| Phase | Scope | Why here |
|---|---|---|
| **1** | §S2 tables; §S4.2 intake-options + feasibility; §S4.3–4.8; §S5 steps 1–7 (**no LLM**); `basis.facts` shim | A fully working plan with deterministic prose. The frontend is already written against this and lights up the moment it lands. |
| **2** | §S6.7 LLM pass; §S6.1 port priorities to Python | Prose quality, and the prerequisite for everything in phase 3. |
| **3** | §S7.1 + §S7.2 adaptivity; §S4.9 reschedule/revise | The moat. Needs phase 2's port. |
| **4** | §S4.10 exports (ICS first), reminder notifications, XP wiring (§S4.8) | Retention polish. |

Ship phase 1 before writing a line of phase 2. A deterministic plan with a feasibility check
is already more useful than most of what this competes with.

---

## §S9. Contract conventions this must follow

Three patterns already in the codebase. Matching them is not stylistic — the frontend is
written assuming them.

1. **Graceful narrative degradation.** `ReportInsightsContent` (`src/lib/userPortalApi.ts:625`) documents it: *"a response missing a section, or missing one subject's entry in a keyed section, degrades to that section's deterministic text rather than the whole report falling back."* Every LLM-sourced field in §S4.6 is nullable, and the UI handles null.
2. **Job + poll, not long requests.** `startPaperExtraction` / `pollPaperExtraction` (`src/lib/paperImportApi.ts:90-139`). §S4.4 reuses the status shape exactly.
3. **Errors.** FastAPI `{"detail": …}` where `detail` is a string **or** `{code, message}`; the client reads `code` when present. Codes the frontend handles: `INVALID_INTAKE`, `PLAN_ALREADY_ACTIVE`, `PLAN_NOT_READY`, `RANGE_TOO_LARGE`, `STUDY_PLANS_DISABLED`.

---

## §S10. Degradation while this is unbuilt

The frontend is merged and live now. Every study-plan call treats **404** and **501** as
"feature absent" and renders one explicit state — *"Study plans are not enabled on this
account yet"* — with no console error and no broken layout. Any other status is a real error
and is surfaced as one.

So you can land §S8 phase 1 endpoint by endpoint:

| Landed | Frontend gains |
|---|---|
| `intake-options` + `feasibility` | The wizard runs end to end and gives real feasibility advice |
| `POST study-plans` + `status` | Generation with live progress |
| `GET study-plans/active` + `{id}` | Dashboard card, overview, phase timeline, coverage meters |
| `GET {id}/days` | Week board and day detail |
| `PATCH {id}/tasks/{task_id}` | Tick-off, adherence, streak |

Return **501** with `{"detail": {"code": "STUDY_PLANS_DISABLED"}}` from any endpoint not yet
implemented, rather than letting it 404 as an unknown route. A 501 is a deliberate "not
yet", and distinguishing the two in logs will save a support thread.

---

## §S11. Tests to insist on

The frontend's analytics carry a 47 KB test file (`src/lib/attempt-report.test.ts`). Hold the
scheduler to the same bar. These are invariants, not examples — each is a bug class that will
otherwise reach a candidate's screen:

1. **Budget respected.** No day's `Σ task.minutes` exceeds that weekday's budget, across a generated matrix of horizons × `study_days` × `minutes_per_day`.
2. **No work on a rest day.** Every day not in `study_days` has `is_rest = true` and zero tasks — and the row still exists.
3. **Full coverage.** Every `(subject, topic)` for the stage, minus unchosen optional subjects, appears in `study_plan_coverage` with `planned_sessions ≥ 1`.
4. **Optional subjects excluded.** A Group 4 plan with `optional_subjects: ["general-tamil"]` schedules no General English task, and vice versa.
5. **Spaced revisits present.** Every concept task has ≥ 1 later `revision` task on its topic, within the horizon, at the §S6.4 offsets.
6. **Phases tile the horizon.** Phase date ranges are contiguous, non-overlapping, and span exactly `start_date`…`end_date`.
7. **Exam date respected.** No task on or after `exam_date`.
8. **Determinism.** The same intake and basis, generated twice with Layer 2 disabled, produces byte-identical schedules.
9. **Tick-off idempotence.** Re-sending `done` twice does not double-count minutes, coverage or XP.
10. **Degenerate intakes.** One study day a week; 30 min a day; a 7-day horizon; an `exam_date` tomorrow. None may crash, and each must return `not_feasible` rather than an empty plan.
11. **Timezone.** `/today` at 23:30 IST returns the IST date's tasks, not UTC tomorrow's.
12. **Tenancy.** Another user's `plan_id` is 404 on every endpoint.
