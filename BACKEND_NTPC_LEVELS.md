# RRB NTPC CBT-1: Under-Graduate and Graduate as two exams (backend work)

## Where things stand

The portal now offers RRB NTPC CBT-1 as **two exams**:

| Portal exam id | Shown as | Status |
|---|---|---|
| `rrb-ntpc-cbt-1` | RRB NTPC CBT-1 (UG) | Open (unchanged id — existing students, links and attempts keep working) |
| `rrb-ntpc-cbt-1-grad` | RRB NTPC CBT-1 (Graduate) | **Coming soon** until you open it (step 5) |

CBT-2 is unchanged: one exam for both levels.

**Nothing is broken today.** Until the steps below ship, the frontend sends **both** exams to the backend as the one
CBT-1 stage you already have — `exam=rrb-ntpc`, `stage=rrb-ntpc-cbt-1` — and keeps, on each side, only the papers for
its level. It reads a paper's level from `ntpc_level`, or failing that from its title
(`RRB NTPC CBT-1 (Graduate · English) — …` / `(Under-Graduate · …)`). A paper that names no level is shown on both.

That is enough for the paper lists. It is **not** enough for anything the backend computes over the whole stage —
those still mix the two levels together. That is what this work fixes.

## What to build

### 1. A Graduate stage

Add a stage `rrb-ntpc-cbt-1-grad` under the exam `rrb-ntpc`, with the same subjects and units as `rrb-ntpc-cbt-1`
(`general-awareness`, `mathematics`, `general-intelligence-and-reasoning`; units `n1-…`). Keep `rrb-ntpc-cbt-1` as the
**Under-Graduate** stage.

### 2. Move the Graduate papers

Every assessment placed under `rrb-ntpc-cbt-1` whose `ntpc_level` is `graduate` — or, where `ntpc_level` is empty,
whose title contains `(Graduate` — moves to `rrb-ntpc-cbt-1-grad`. Under-Graduate papers and papers for both levels stay.
Keep attempts linked to their assessment as they are.

From then on, accept `stage_id = rrb-ntpc-cbt-1-grad` when an admin places a paper
(`PATCH /evaluation/assessments/{id}/tnpsc`).

### 3. Everything that takes `stage=` must accept the Graduate stage, and compute per stage

| Endpoint | What changes |
|---|---|
| `GET /user/tnpsc/stages/{stage}/practice-tests` | `rrb-ntpc-cbt-1-grad` lists Graduate papers (plus both-level ones) |
| `GET /user/tnpsc/stages/{stage}/mock-tests` | same |
| `GET /syllabus/rrb-ntpc/{stage}` | serve the same syllabus for `rrb-ntpc-cbt-1-grad` |
| `GET /user/recommendations?exam=rrb-ntpc&stage=…` and `POST …/{rec_id}/feedback` | picks, weak map and readiness from **that stage's** attempts only — today the AI Coach for UG also counts Graduate attempts |
| `GET /user/study-plan/intake-options?group_id=rrb-ntpc&stage_id=…`, `POST /user/study-plans` | plan per stage |
| `GET /user/tnpsc/catalog` | list the new stage under `rrb-ntpc` |

### 4. Usage counts (if they are per exam)

If mock / practice allowances or the `usage` block (`mock_used_all_time`, `mock_overall`, …) are split by exam or
stage, count Graduate on its own. If they are plan-wide, nothing to do.

### 5. Opening Graduate

`GET /user/exams/availability` → `open_exam_ids`: include **`rrb-ntpc-cbt-1-grad`** to open the Graduate exam. The
existing `ntpc-cbt-1` / `rrb-ntpc-cbt-1` entry now opens **Under-Graduate only**; `rrb-ntpc` still opens UG and CBT-2,
not Graduate.

The admin switch already lists the Graduate exam and sends `PATCH /admin/exams/rrb-ntpc-cbt-1-grad { is_open }` — accept
that id, and return it from `GET /admin/exams`.

### 6. A student's chosen exam

`preferred_exam` on the profile can now be `rrb-ntpc-cbt-1-grad`. Accept and store it.

## Telling the frontend it is live

**Done (13 Nov 2026):** the backend steps are complete and the frontend now sends `stage=rrb-ntpc-cbt-1-grad` for the
Graduate exam.

When steps 1–3 are deployed, tell the frontend developer. They change **one line** —
`CBT1_GRADUATE_WIRE_STAGE` in `src/config/rrb-ntpc.ts`, from `'rrb-ntpc-cbt-1'` to `'rrb-ntpc-cbt-1-grad'` — and the
Graduate exam starts sending its own stage everywhere. Rows you send back with `stage_id: rrb-ntpc-cbt-1-grad` are
already read as the Graduate exam.

## How to check

1. As an admin, place a paper under **CBT-1 (Graduate)**: it saves to `rrb-ntpc-cbt-1-grad`, titled
   `RRB NTPC CBT-1 (Graduate · …)`.
2. `GET /user/tnpsc/stages/rrb-ntpc-cbt-1-grad/practice-tests` lists it; the `rrb-ntpc-cbt-1` list does not.
3. A student who has only taken Under-Graduate papers gets `based_on_attempts: 0` from
   `GET /user/recommendations?exam=rrb-ntpc&stage=rrb-ntpc-cbt-1-grad`.
4. With `rrb-ntpc-cbt-1-grad` in `open_exam_ids`, the Graduate card on the Exams page shows **Open now**.
