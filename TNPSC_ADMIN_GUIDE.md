# TNPSC — Admin changes & step-by-step publishing guide

Companion to [`TNPSC_API_SPEC.md`](TNPSC_API_SPEC.md) (backend contract) and
[`TNPSC_CONTENT_RUNBOOK.md`](TNPSC_CONTENT_RUNBOOK.md) (raw API calls).
This document covers the **admin portal**: what changed in the UI, and how to take a paper from
nothing to live in the aspirant portal.

---

## Part 1 — What changed in the admin portal

The one idea behind every change: **a paper is invisible to aspirants until it has a TNPSC
placement** — stage + track (+ level for mock, subject for practice). The admin UI now makes that
placement impossible to forget.

### 1.1 New — TNPSC placement control

`src/components/evaluation/TnpscTagFields.tsx`

A single reusable control: **Exam Group → Stage → Track → (Level | Subject → Topic)**.

- Group 4 auto-selects its only open stage.
- Group 1 Mains appears but is disabled — "coming soon".
- Live validation mirroring the server rules: mock needs a level, practice needs a subject, mock
  question count should equal the stage pattern (200), practice must be 30–50.

### 1.2 Changed — Create Assessment wizard

`src/components/evaluation/EvalAssessmentConfigPanel.tsx`

| Before | After |
|---|---|
| "Test Type" dropdown (UPSC / SSC / IBPS …) | **Removed.** Test type is now derived from the placement — e.g. `TNPSC Group 1 Prelims` — so it always matches the syllabus keys the generator uses. |
| No placement | **TNPSC placement block** in Step 1, required. Step 1 cannot be completed and the assessment cannot be created without it. |
| Track chosen twice | **Mode is the track.** "Mock test" → `mock`, "Practice" → `practice`. One choice, no drift. |
| Manual question count / duration | **"Apply pattern" button** — one click sets 200 questions, 180 minutes, and the stage's negative-marking rule. |
| `max_attempts` defaulted to 1 for mocks | **Defaults to 3.** With the level gate, a single-attempt mock means one 49% score locks the aspirant out of every later level permanently. |
| — | On create, the tags are sent **in the create payload** *and* confirmed with a follow-up `PATCH …/tnpsc`. If the PATCH fails you get a warning naming the placement that didn't save — the assessment still exists and can be placed from the list. |

### 1.3 Changed — Assessments list

`src/components/evaluation/EvalAssessmentsList.tsx`

- Every card shows a **placement badge**: `G1 Prelims · Mock · Simple`, or an amber **"Not placed"** when untagged.
- A **Place / Placement** button opens the tagging dialog for any existing assessment.
- New **placement filter**: all / not placed / mock / practice / by stage.
- A banner at the top counts untagged assessments and jumps to them — these are the papers aspirants cannot see.

### 1.4 New — Tag dialog

`src/components/evaluation/TnpscTagDialog.tsx` — places an already-created assessment. Prefills from
whatever tags the row already carries, validates against the paper's real question count, and
invalidates the list on success.

### 1.5 New — TNPSC Coverage tab

`src/components/evaluation/TnpscCoveragePanel.tsx`, wired into the Evaluation Hub tab bar.

The content team's worklist:
- **Mock tests by level** — count vs target (3 Simple / 3 Medium / 2 Complex) with a ready/gap indicator.
- **Practice sets by subject** — topics covered out of total, per subject, with a progress bar.
- Warns when assessments are untagged, and explains why all three levels read "unlocked" while no Simple mock exists.

Counts are computed in the browser from the assessments list; when
`GET /api/v1/admin/tnpsc/coverage` ships it uses the server numbers instead.

### 1.6 Changed — Syllabus feeds the generator

`src/data/examSyllabus.ts`, `src/constants.ts`

`TNPSC Group 1 Prelims` and `TNPSC Group 4 Written` are now the first two entries in the exam list,
and their syllabus is **generated from [`src/config/tnpsc.ts`](src/config/tnpsc.ts)** — the same source
the portal and the tagging use. Selecting that test type in the question generator auto-suggests the
10–11 subjects and all 45–50 topics, with the official per-section question counts
(G1: GS 175 + Aptitude 25; G4: Language 100 + GS 75 + Aptitude 25).

### 1.7 New — Admin API layer

`src/lib/tnpscAdminApi.ts` — `tagAssessment`, `tagTest`, `bulkTag`, `getTnpscCoverage`,
`validateTnpscTag`, `readTnpscTag`, `describeTag`. Tolerates both `tnpsc_*`-prefixed and bare column
names so it works whichever spelling the backend settles on.

---

## Part 2 — What the backend must provide

| Capability | Endpoint | Without it |
|---|---|---|
| Save a placement | `PATCH /api/v1/evaluation/assessments/{id}/tnpsc` (§6.2) | UI warns; tag via SQL (runbook §4) |
| Accept placement at create | the 5 `tnpsc_*` fields on `POST /api/v1/evaluation/assessments` (§7.8) | ignored harmlessly; the PATCH covers it |
| Serve the tagged papers | `GET /api/v1/user/tnpsc/stages/{id}/mock-tests` and `.../practice-tests` (§5.2, §5.3) | portal stays empty |
| Coverage numbers | `GET /api/v1/admin/tnpsc/coverage` (§6.6) | counted in the browser instead |
| Bulk tagging | `POST /api/v1/admin/tnpsc/bulk-tag` (§6.3) | tag one at a time |

Everything else in the admin UI works today against the existing generate/save/create endpoints.

---

## Part 3 — Step by step: publish your first Simple mock

**Goal:** one 200-question Group 1 Prelims Simple mock, live for aspirants.

### Step 1 — Generate the paper (200 questions, one run)

1. Evaluation Hub → **Generate Question Set**.
2. **Test Type:** `TNPSC Group 1` → subject and chapter suggestions become the TNPSC syllabus, and
   the backend switches to TNPSC style (5 options, including "விடை தெரியவில்லை").
3. **Title:** `TNPSC G1 Prelims — Simple Mock 01`.
4. **Difficulty:** `Easy` (this is what makes it a *Simple* level paper).
5. **Paper Language:** English is the default for both groups. On a Group 4 set, also add a
   `General Tamil` section — it generates in Tamil on its own. Per-section overrides live on each
   subject card.
6. **Bilingual — repeat each question in:** available on **both** Group 1 Prelims and Group 4
   Written (changed 05 Sep 2026 — Group 1 was English-only before). Pick `Tamil` and every question
   is printed again in Tamil under the same number, with விடை தெரியவில்லை as option E. Each subject
   card then gets its own Translation toggle; a `General Tamil` section is normally left
   untranslated.
7. **Subjects:** add all ten syllabus subjects with weightages summing to 100 — General Studies
   subjects 87.5% (175 questions) and Aptitude & Mental Ability 12.5% (25).
8. **Question Count:** 200 (the slider now goes the full way).
9. **Generate** → the job polls to completion → review the questions → **Save**. Bilingual questions show the Tamil version in a dashed box under
   the English one — check a few before saving.

### Step 2 — (Optional) split across runs

One 200-question run is the norm. Generate section papers separately only when you want each
reviewed on its own; the assessment builder can then stitch them with `paper_ids` + weights.

### Step 3 — Create the assessment

1. Evaluation Hub → **Assessments** → **Create Assessment**.
2. **Step 1 — Basics**
   - Title: `TNPSC Group 1 Prelims — Simple Mock 01`
   - Mode: **Mock test**
   - Default difficulty: **Easy**
   - **TNPSC placement:** Group `TNPSC Group 1` → Stage `Prelims` → Level **Simple**
   - Click **Apply Prelims pattern — 200 Qs · 180 min**
3. **Step 2 — Content:** source **Collections**, select the paper you just saved (or all section papers, weights summing to 100).
4. **Step 3 — Rules:** attempts **3** (do not set 1), shuffle as you prefer, negative marking off.
5. **Step 4 — Schedule:** leave the due date empty for an always-available mock.
6. **Step 5 — Review:** confirm the placement line reads `G1 Prelims · Mock · Simple`, then **Create**.

If the placement can't be saved you'll see an amber warning — the assessment still exists; place it
from the list (Step 5 below) once the backend endpoint is live.

### Step 4 — Publish

Set the assessment status to published/active (status control on the assessment, or
`PATCH /api/v1/evaluation/assessments/{id}/status` with `{"status":"published"}`).
Only published papers count.

### Step 5 — Verify

1. Evaluation Hub → **TNPSC Coverage** → stage `TNPSC Group 1 — Prelims`. Simple should read **1 / 3**.
2. Aspirant portal → **Exams → TNPSC Group 1 → Prelims → Mock Test**.
   - Simple: the paper is listed.
   - Medium and Complex: **now locked** with "Score at least 50% in a Simple level mock test to unlock this level."

That flip from unlocked to locked is the gate switching on — expected, not a regression.

---

## Part 4 — Step by step: publish a practice set

1. **Generate Question Set** → Test Type `TNPSC Group 1 Prelims`, difficulty `Medium`,
   **one subject** (Indian Polity), **one chapter** (Fundamental Rights & Duties), **40 questions** → Save.
2. **Assessments → Create Assessment**
   - Title: `Indian Polity — Fundamental Rights (Set 1)`
   - Mode: **Practice**
   - Placement: Group 1 → Prelims → Subject `Indian Polity` → Topic `Fundamental Rights & Duties`
   - Content: the paper just saved; count 40 (must stay 30–50)
   - Rules: attempts 3; time limit 40 min
3. Publish, then check **Exams → Group 1 → Prelims → Practice Test** — it appears under Indian Polity.

Practice sets are never level-gated: aspirants can take any of them from day one.

---

## Part 5 — Filling the catalogue

Target for a stage to feel complete:

| Track | Target | Group 1 Prelims | Group 4 Written |
|---|---|---|---|
| Mock — Simple | 3 | 3 × 200 Q | 3 × 200 Q |
| Mock — Medium | 3 | difficulty `medium` | difficulty `medium` |
| Mock — Complex | 2 | difficulty `hard` | difficulty `hard` |
| Practice | 1 set per topic | 45 sets | 55 sets |

That is 8 generation runs for mocks (one per paper) and 100 for practice. Two ways to shorten it:

- **Ask backend for the bulk generators** — `POST /api/v1/admin/tnpsc/practice-tests/generate` with
  `scope: "all_topics"` creates one set per topic in a single job (§6.5), and
  `POST /api/v1/admin/tnpsc/mock-tests/generate` builds the pattern and tags it in one call (§6.4).
- **Tag the question bank first** (§4.3) — `tnpsc_subject_id` / `tnpsc_topic_id` on every question. Without it
  the generators have no pool to draw from and every run is open-ended LLM generation.

Work Simple-first: until a Simple mock exists, no aspirant can ever reach Medium or Complex, so
Simple-level content is worth more than everything else combined.

---

## Part 6 — Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Portal shows `tests_total: 0` | paper not tagged, or not published | Assessments tab → placement badge; publish |
| All three levels unlocked | no Simple mocks published | expected — publish a Simple mock |
| Paper tagged but still missing | backend query reads only `tests`, not `eval_assessments` | it must union both and return `"source": "assessment"` |
| "Placement could not be saved" | `PATCH …/tnpsc` not deployed | tag via SQL (runbook §4), or wait for §6.2 |
| Mock rejected on publish | question count ≠ 200 | use **Apply pattern**, or fix the subject weightages |
| Practice set rejected | outside 30–50 questions | regenerate at 40 |
| Aspirant stuck at a level | failed their only attempt | raise `max_attempts`, or use the support override (§6.7) |
| Levels no longer lock | expected — the gate is off (`LEVEL_GATE_ENABLED = false`) | flip that constant to restore progression |
| Coverage tab says "counted in browser" | `/admin/tnpsc/coverage` not deployed | informational only |
