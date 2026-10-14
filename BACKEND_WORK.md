# Backend work outstanding — index

Everything the frontend is waiting on, in one list. Each row links to the document
that specifies it; this page is the index, not a fourth spec.

**Nothing here blocks a frontend release.** Every screen degrades deliberately: an
unknown field sent to the API is ignored, and a missing one falls back to the
behaviour that preceded it. What the work buys is listed under *Unblocks*.

Last updated 2026-10-14.

---

## Shipped

| Change | Where |
|---|---|
| `tnpsc_level` optional on `track='practice'` | [TNPSC_RECLASSIFY.md §2.3](TNPSC_RECLASSIFY.md) |
| `PATCH /evaluation/papers/custom-questions` → `409 CUSTOM_PAPER_NOT_EDITABLE` | — |
| New assessments inherit `tnpsc_level` from their source papers when the papers agree | — |
| Study plan — tables, generation, endpoints (live; what it plans from is item 12) | [STUDY_PLAN_BACKEND_CHANGES.md](STUDY_PLAN_BACKEND_CHANGES.md) |
| Plans, Razorpay order / verify / webhook routes, promo create and validate | [PLANS.md](PLANS.md), [PAYMENTS.md](PAYMENTS.md) |

The frontend already skips `custom-questions` in the reclassify tool, so no
further change is needed there.

---

## Outstanding

Ordered by cost. The first three are an hour or so each.

| # | Change | Size | Unblocks | Spec |
|---|---|---|---|---|
| 0 | **`PATCH /evaluation/questions/{id}` must store `difficulty`** — see below | ~1h | **Every difficulty button in the portal** | below |
| 1 | `PATCH /evaluation/papers/{id}` accepts `difficulty` + `tnpsc_level` | ~1h | The reclassify tool writing anything at all | [RECLASSIFY §1](TNPSC_RECLASSIFY.md) |
| 2 | `GET /evaluation/subjects` returns the bank's distinct subjects | ~1h | Subject filters that can reach the whole bank | [RECLASSIFY §4](TNPSC_RECLASSIFY.md) |
| 3 | `difficulty` + `tnpsc_level` columns on `papers`, returned on the list | ~2h | Reclassify showing "what it is now" | [RECLASSIFY §2](TNPSC_RECLASSIFY.md) |
| 4 | `tnpsc_unit_id` on tests/assessments, returned on the practice listing | ~4h | Unit rows showing their papers without guessing | [UNIT_TAGGING §2–3](TNPSC_UNIT_TAGGING.md) |
| 5 | `tnpsc_scope`, `tnpsc_section_name`, `tnpsc_language` | ~2h | Section-wise practice; exams knowing their language | [UNIT_TAGGING §3.4](TNPSC_UNIT_TAGGING.md) |
| 7 | Excel importer reads **Unit**, **Language** and **Subtopic** columns and stores `unit_id` on the question | ~3h | Unit papers drawn by unit, not by guessing from Topic | below |
| 8 | **Importer reads the Difficulty column properly** — accepts `Simple` / `Medium` / `Complex`, returns it per question, and reports an unknown value as a row issue instead of defaulting it | ~1h | A sheet of Simple questions arriving as Simple (it arrived as Medium) | below |
| 9 | **Plans** — `report-insights` returns `403 PLAN_REQUIRED` below Ultimate; start-test returns `403 PLAN_LIMIT_REACHED` past the monthly limit | ~3h | The AI-insight cost boundary and the mock ladder actually holding | [PLANS.md §3](PLANS.md) |
| 10 | **Razorpay configuration** — key id + secret + webhook secret set on the server; webhook subscribed to `order.paid`, `payment.captured`, `payment.failed` | config | Payments actually working end to end | [PAYMENTS.md](PAYMENTS.md) |
| 11 | **Promo preview must know the plan.** `POST /user/promo/validate` takes only `code`, so a code limited to Yearly or to Ultimate previews as valid for every plan, then the order comes back at full price. Accept optional `plan_id` + `billing_cycle` (or return `applies_to_tiers` / `applies_to_billing`) so the checkout can say "this code does not apply to this plan" before the payment window opens. Also confirm `PATCH /admin/promos/{id}` stores `applies_to_tiers` / `applies_to_billing`; the admin page now reads them back and warns if not | ~1h | The price shown at checkout matching the price charged | — |
| 12 | **Study plan from the published units.** Plan work items are the server's own subject list (55 topics), which reaches 175 of the 235 printed Group 4 topics and never schedules Tamil Writing Skills, Technical Terms or Translation (30 of 100 questions). Plan from `TNPSC_G4_SYLLABUS.json` and put `unit_id` + the printed `topic_id` on every task | ~1 day | A plan that covers the syllabus as printed | [STUDY_PLAN §S6.8](STUDY_PLAN_BACKEND_CHANGES.md) |
| 13 | **Group 4 Written must have the `general-tamil` and `general-english` subjects**, and the Tamil / English units registered under them. Tagging a Tamil unit paper fails today: `PATCH /evaluation/assessments/{id}/tnpsc` → `404 SUBJECT_NOT_FOUND`, "'Written Examination' has no subject 'general-tamil'." The paper is created but cannot be placed, so aspirants never see it. Seed the subjects and units from `TNPSC_G4_SYLLABUS.json` (it now lists `subjects` and each unit's `subject_ids`). Also confirm `general-english` is there | ~1h | Any Tamil or English unit-wise or section-wise paper appearing in the portal | — |
| 14 | **Assessments composed by unit.** The create-assessment step now picks the published syllabus units, not subjects. Needs `unit_id` on questions (item 7) plus: accept `unit_ids` / `unit_weights` on `POST /evaluation/assessments`, and draw a shuffled paper **stratified by unit** — today it is a plain `random.sample` that ignores weights. Also a per-unit bank count and a backfill for the questions already in the bank | ~1 day | A Group 4 paper that follows the printed unit split on every attempt, and a picker that does not download the whole bank to count | below |
| 15 | **A deleted collection's questions must not reach students.** `delete_paper` only retires the collection; its questions stayed in every assessment and were still dealt. **Done in the local backend copy, not deployed:** new and resumed attempts now deal only live questions (the question bank's own rule). Still to do: stop hard-deleting single questions, and stop add / remove rewriting `question_count` | ~1h to deploy, ~1h left | A deleted collection actually disappearing from the papers built from it | [BACKEND_LIVE_POOL.md §A+B, D](BACKEND_LIVE_POOL.md) |
| 16 | **Live question pools.** An assessment is sampled from a list of ids frozen at creation, so questions uploaded later never reach it — and a paper whose questions were all deleted stays empty even after new ones are added. **Done in the local backend copy, not deployed:** `pool_mode` + `pool_filter` columns (SQL script), stored on create, and each attempt is drawn from the stored questions **plus** the bank's matches (tagged to the unit, or untagged with a subject and topic the paper already holds). The frontend already sends the rule | ~2h to deploy + run the SQL | "I added 50 questions to the unit — the test should use them" | [BACKEND_LIVE_POOL.md §C, E](BACKEND_LIVE_POOL.md) |

Items 4 and 5 are the same tables and the same routes; doing them together is
cheaper than doing either alone.

---

## Item 0 — questions do not store `difficulty` on PATCH

**Observed.** Select 146 Indian Polity questions in the Question Bank, set
difficulty to Complex. The request sends `{ "difficulty": "hard" }` to
`PATCH /api/v1/evaluation/questions/{id}`. Every call returns **200**. Reload the
list: all 146 still say Medium.

**Likely cause.** The endpoint's documented body (`EVALUATION_API.md`, the PATCH
questions section) lists `question_text`, `marks`, `explanation`, `options`,
`correct_answer` and the attachment fields — **not `difficulty`**. A server that
ignores keys it does not recognise answers 200 and changes nothing, which is
exactly this. The frontend's own edit dialog loads a difficulty into its form but
has never included it in the save, so nothing has ever exercised the path.

**To confirm in thirty seconds:** open DevTools → Network, change one question's
difficulty, and look at the PATCH response. If it echoes `"difficulty": "medium"`,
that is the server declining it.

**The change.** Accept `difficulty` on that route:

```http
PATCH /api/v1/evaluation/questions/{question_id}
{ "difficulty": "hard" }
```

Values are the stored vocabulary — `easy` | `medium` | `hard`. And please **echo
the updated row in the response**; the frontend now verifies writes against it
and can only say "unverified" when it is not sent.

**Why it matters more than it looks.** Everything downstream reads this field: the
portal's Simple / Medium / Complex buttons, the 20/30/50 blend a full paper is
composed to, the reclassify tool, the report's difficulty analysis. With
`difficulty` stuck at its import default, none of them can do anything.

**Strongly recommended alongside it — a bulk route.** Re-grading a bank is
hundreds of questions, and the client currently makes one request each:

```http
POST /api/v1/evaluation/questions/bulk-update
{ "ids": ["…", "…"], "difficulty": "hard" }
→ { "updated": 146, "skipped": [] }
```

One round trip, one transaction, and it cannot half-apply.

---

## Item 4 — the placement is saved, but nothing returns it (observed 12 Oct 2026)

**What happened.** A unit practice paper was created from the wizard and placed
(`PATCH /evaluation/assessments/{id}/tnpsc` → 200, `is_visible_to_users: true`,
`blockers: []`, `unit_id: "g4-ta-grammar"`, `level: "simple"`). The aspirant portal's
unit I still showed "No paper yet" on all four buttons.

**Why.** The portal files a practice paper under a unit by the `unit_id` on the *listing*
(`GET /user/tnpsc/stages/{stage}/practice-tests`), and under a difficulty button by its
`level`. The tagging response proves the server has both. Nothing that reads the paper
back returns them:

| Endpoint | Missing |
|---|---|
| `GET /user/tnpsc/stages/{stage}/practice-tests` (each card) | `unit_id`, and `level` for practice (the backend copy I can read sends `level: null` — "practice sets are never level-tagged", which is no longer true) |
| `GET /evaluation/assessments/{id}` and the list | every `tnpsc_*` / `track` / `level` / `unit_id` field — the detail of the paper above has none, though it is placed |

If the list omits them too (only the detail was captured), the **admin Assessments list
cannot know a paper is placed** and would show "Not placed" on it — which would also explain
papers that look unplaced there while being placed. Worth checking against the list response.

**The change.** Return what is already stored:

```json
{ "unit_id": "g4-ta-grammar", "level": "simple", "subject_id": "general-tamil", … }
```

on each practice card, and `tnpsc_stage_id`, `track`, `tnpsc_level`, `tnpsc_unit_id`,
`tnpsc_subject_id`, `tnpsc_scope`, `tnpsc_section_name` on the assessment list and detail.

**One more mismatch.** The paper's `subject_id` came back as `general-tamil-english`
("General Tamil / General English") — one combined subject. The catalog the portal ships
has `general-tamil` and `general-english` separately, so no subject-based match can work for
the Tamil or English units. That is item 13; until it ships, `unit_id` on the listing is the
only thing that can place these papers.

**Frontend stopgap, already in.** `src/lib/tnpsc-title-placement.ts` reads the unit and
difficulty back out of a wizard-written title ("TNPSC Group 4 — இலக்கணம் · Simple") when the
listing omits them. It never overrides a `unit_id` the server sends, and a title an admin
has rewritten does not parse. Remove it once the listing is fixed.

---

## Item 7 — the question sheet cannot say which unit a question belongs to

**What the sheet carries today:** Sno, Question ID, Question, Options, Correct
Answer, Explanation, Type, Difficulty, Subject, Topic. The importer reads
`subject`, `topic` (stored as `chapter`), `subtopic`, `difficulty`, `question_type`
and, for bilingual papers, a `language` per row.

**Why that is enough for most units, and not for some.** A unit-wise paper is
drawn from the bank by *subject*. That is exact for General Studies — each unit
has its own subject (Unit V and Unit III each span two, which the wizard handles by
selecting both). It is **not** exact for:

| Section | Units | Subjects | Problem |
|---|---|---|---|
| General Tamil | 7 | 1 (`general-tamil`) | Nothing separates Grammar from Vocabulary except Topic |
| General English | 7 | 1 (`general-english`) | Same |
| Aptitude & Mental Ability | 2 | 1 | Aptitude vs Reasoning |

For those, the unit has to be inferable from `Topic`, which means every admin must
type the unit name identically, forever. One stray spelling and the question
belongs to no unit and silently drops out of the pool.

**The change.** An optional **Unit** column on the sheet, stored as `unit_id` on the
question, using the same slugs as [`TNPSC_UNIT_TAGGING.md` §5](TNPSC_UNIT_TAGGING.md)
(`g4-ta-grammar`, `g4-apt-reasoning`, …). Unit papers then draw
`WHERE unit_id = :unit` — exact, with no fuzzy matching.

- Return `unit_id` on `GET /evaluation/questions` and
  `GET /evaluation/papers/{id}/questions`.
- Accept it on `PATCH /evaluation/questions/{id}` (together with `difficulty`, item 0).
- Accept it in `POST /evaluation/questions/bulk-update` if that route is built.
- Reject an unknown slug at import with a row-level issue, rather than storing it.

Also confirm the importer **requires a `Language` column for bilingual sheets**
("one sheet row per question per language"). A single-language sheet should not need
one; please say which it is.

## Item 8 — The Difficulty column on import

**Observed.** A sheet whose Difficulty column said *Simple* was imported, reviewed
and saved. Every question in the bank came out **Medium**.

**Two causes, one on each side.**

1. *The portal* dropped each row's difficulty when it read the sheet back, so the
   save fell through to the paper's default. **Fixed in the frontend** — the review
   screen now shows each question's level and the import form has a Difficulty
   selector.
2. *The importer* is the part the portal cannot see into. What it does with a value
   it does not know is not documented, and the portal cannot tell a real Medium
   from a defaulted one.

**What the portal now depends on — please confirm each:**

- `GET /evaluation/excel-papers/{import_id}` returns **`difficulty` on every item of
  `question_json`**, copied from the sheet. (If a row has none, omit it or send
  `null`; do not send `"medium"`.)
- The importer accepts **`Simple` / `Medium` / `Complex` and `easy` / `medium` /
  `hard`**, case-insensitive, and normalises to the stored `easy | medium | hard`.
  The portal now says Simple / Medium / Complex everywhere and the team writes
  sheets in those words.
- A value that is **not recognised** (`"tricky"`, a typo) is reported as a **row
  issue** in `issues`, not stored as `medium`. A silent default is how a whole bank
  ends up ungraded.
- `POST /evaluation/papers/save` stores `questions[].difficulty` **per question**
  (its own documentation says it does) and falls back to the paper's level only when
  a question has none.

**To check in a minute:** re-upload any sheet with a mix of levels and look at the
review header. It should read "Simple 40 · Medium 30 · Complex 30". If it reads
"N questions came back without a recognised difficulty", the importer is not
returning the column.

---

## Item 14 — assessments composed by syllabus unit

**What changed in the frontend.** Source & content, when the placed stage publishes
units (Group 4 Written), no longer offers the flat subject list. It offers the
published units grouped by section — "IV. Indian Polity · 15 in paper · 62 in bank" —
and defaults the weights to the printed split (Units IV and V open at 15 : 20). A
practice paper placed on a unit, or on a section, pre-selects that unit or section's
units.

**What works without any backend change.**

| Case | Today |
|---|---|
| **Constant** order (fixed questions) | **Exact.** The browser picks the questions per unit before sending the ids. |
| Units that own their subject — Part A (General Science, Geography, History, Polity, Economy, TN History) | Pool is exact; it is matched on `subject`. |
| **Shuffle** order, split between units | **Not honoured.** The pool is right, but the server draws it uniformly (below). |
| General Tamil's 7 units, General English's 7, Aptitude's 2 | Matched on the question's **Topic** spelling. A stray spelling drops the question from its unit (counted in the picker as "in no unit"). |

**Why Shuffle is not honoured.** Starting an attempt calls `_build_attempt_question_ids`,
whose `shuffle=True` branch is `random.sample(all_ids, count)` over the assessment's
`question_ids` (`routers/user/eval_assessments.py`). `subject_weights` is
stored on the assessment and then never read, so the weights an admin sets — for
subjects *or* units — have no effect on a shuffled paper. That is true before this
work; it just matters more now that the picker is about units.

(Read from the backend copy under `New TNPSC/ca-project`. If production differs,
the asks below still stand; only the "today" column changes.)

### 14.1 Store the unit on the question — item 7

Everything below depends on item 7: `unit_id` on `eval_questions`, returned on
`GET /evaluation/questions` and `GET /evaluation/papers/{id}/questions`, accepted on
`PATCH /evaluation/questions/{id}` and the bulk route, reject an unknown slug.

The frontend already prefers it: a question with a `unit_id` is matched on that and
nothing else; the subject/topic inference is only the fallback.

### 14.2 Accept the unit selection on create

```http
POST /api/v1/evaluation/assessments
{
  "unit_ids": ["g4-gs-indian-polity", "g4-gs-economy-and-dev-admin"],
  "unit_weights": { "g4-gs-indian-polity": 42.86, "g4-gs-economy-and-dev-admin": 57.14 },
  "subject_weights": { "Indian Polity": 42.86, "Indian Economy": 28.57, "Development Administration in Tamil Nadu": 28.57 },
  "question_ids": ["…"], "question_count": 35, "shuffle_questions": true
}
```

- Both fields are **already sent**. They are ignored today.
- Validate: every id belongs to `tnpsc_stage_id`; weights are percentages, 2 decimals,
  each ≥ 1, total 100 (the same rule the editor enforces). Omit `unit_weights` → default
  to each unit's published `questions` count.
- Persist both on `assessments` (JSON column, like `subject_weights`) and return them on
  the detail response, so the edit screen and reports can show "drawn from Units IV, V".
- `subject_weights` is still sent, collapsed from the unit weights, for a server that
  only knows subjects. It is lossy — General Tamil's seven units are one subject — which
  is the reason `unit_weights` exists.

### 14.3 Draw a shuffled paper stratified by unit

In `_build_attempt_question_ids`, `shuffle=True` branch, when the assessment has `unit_weights`:

1. Group `question_ids` by the question's `unit_id`.
2. Allocate `question_count` across the units by `unit_weights` — largest remainder, so
   the total is exact.
3. Cap each unit at what its group holds and **spill the shortfall** to the units that
   still have questions, rather than returning fewer than `question_count`.
4. `random.sample` within each unit, then shuffle the combined list as today.

Without `unit_weights`, fall back to `subject_weights` against `question.subject`, and
without either keep today's uniform sample. A question with no `unit_id` counts toward
no unit; if any exist, say so in the response (`unmapped_questions: n`) rather than
silently skipping them.

### 14.4 Per-unit bank counts

The picker shows "N in bank" beside each unit, which it currently computes by pulling
the **whole** question bank into the browser (`GET /evaluation/questions`, unfiltered).

**Measured, 12 Oct 2026:** that one request is about **26 MB and takes ~40 s** on the
current bank (DevTools showed 52.1 MB across two calls). Nothing about the answer needs
26 MB — it is every question's full text, options, explanation and Tamil translation, to
produce a handful of counts. This is the single largest cost in the create-assessment
screen, and a plausible source of the `500 Internal Server Error` seen on it (not
confirmed — the server log for that request would say).

At minimum, make the list cheaper:

- `GET /evaluation/questions?fields=id,subject,chapter,subtopic,difficulty,unit_id,marks,paper_id`
  (or `?slim=true`) — the wizard needs only these to build a pool; the full rows are
  needed for ~50 questions, not 20,000.
- `limit` / `offset` (or a cursor) with an `X-Total-Count`, defaulting to something finite.
  An unbounded `SELECT` over the whole org is the 500 waiting to happen.
- gzip/br on the response — repetitive JSON like this typically compresses several-fold.

```http
GET /api/v1/evaluation/questions/unit-counts?stage_id=group-4-written&source=online
→ {
    "units": [
      { "unit_id": "g4-gs-indian-polity", "total": 62,
        "by_difficulty": { "easy": 20, "medium": 30, "hard": 12 } }
    ],
    "unmapped": 14
  }
```

`by_difficulty` lets the same call tell a Simple unit paper whether its unit has enough
Simple questions. `unmapped` is questions in the stage's subjects with no `unit_id`.
Also accept `unit_id` (repeatable) as a filter on `GET /evaluation/questions`, so the
pool for chosen units can be fetched instead of filtered client-side.

**`paper_id` must stay on every row.** The wizard joins it to the collection list to read a
collection's name (`Unit_4_Tamil_50Q_Hard`), which is how Tamil technical-terms questions —
tagged by discipline, not by unit — reach their unit today. A slim response that drops
`paper_id` silently turns that off. (Returning `paper_title` beside it would save the join.)

### 14.5 Backfill what is already in the bank

Every question imported before item 7 has no `unit_id`. A one-off, re-runnable job:

```http
POST /api/v1/admin/tnpsc/backfill-units?stage_id=group-4-written&dry_run=true
→ { "mapped": 1840, "unmapped": 112, "ambiguous": 6,
    "unmapped_samples": [ { "id": "…", "subject": "General Tamil", "topic": "ilakkanam" } ] }
```

Map by the same rule the frontend uses (`src/lib/unit-pool.ts`) — subject first, then
Topic against the unit's printed name, Tamil name or any of its printed topics, ignoring
case, punctuation, "&" vs "and", spacing in Tamil and a trailing "(English gloss)". Port
`src/config/g4-tag-aliases.ts` with it: it holds the spellings real sheets use.

**Measured on 4,209 questions from the sheets in use (12 Oct 2026): this rule places 86%.**
The other 14% cannot be placed by any rule, because the tag does not say — a bare
`Vocabulary` (Tamil or English?), 100 rows of the whole Tamil eligibility paper with no
Topic, `Current Affairs`, `Part A – Unit VI`. Report them from the dry run; they need a
person or a content-based pass, not a cleverer matcher. `TNPSC_G4_SYLLABUS.json` has every unit with
its subjects and topics. **`dry_run=true` first** and send the unmapped samples back: they
are the spellings the sheets used that nobody listed, and cheaper to read than to
discover as short pools. Never overwrite a `unit_id` that is already set. **Use the collection name as a last resort**, as the frontend now does: a collection called `Unit_<n>_<Tamil|English|GS|Aptitude>_…` names its unit for any question whose tags do not (see `src/lib/collection-unit.ts`). It is the only signal for Tamil Unit IV, whose questions are tagged by discipline.

### 14.6 Return it on attempts

Add `unit_id` to each question in the attempt and review payloads
(`EvalAttemptQuestion`, the attempt-detail `questions[]`). The report can then group by
published unit and the study plan (item 12) can say "Unit V" instead of inferring it.

### Order of work

14.1 (= item 7) → 14.5 backfill → 14.2 → 14.3. 14.4 and 14.6 are independent and can
go any time. **Until 14.3 ships, set the order to Constant** for any paper whose unit
split matters: it is the one mode that is exact today.

---

## One question back

> *"New assessments take `tnpsc_level` from their source papers when the papers agree."*

Which field is that reading?

- If **papers already carry a `tnpsc_level`**, then item 3 is partly done and we
  only need it returned on `GET /evaluation/papers` so the reclassify tool can show
  the current value.
- If it is derived from **the questions inside** the source papers, that is the
  same derivation the frontend does, and item 3's columns are still entirely open.

Knowing which decides whether item 3 is two hours or twenty minutes.

---

## What needs no backend change

Worth stating so it is not scheduled by mistake.

**The 20 / 30 / 50 blend.** A Full Unit paper, a section paper and every mock are
composed 20% Simple / 30% Medium / 50% Complex. The frontend picks the questions to
those proportions at creation time, so the blend is recorded in the questions the
assessment holds — there is nothing to store.

The one place it would matter server-side is **question generation**: anything that
generates a full paper should use the same proportions, or a generated paper will
not match a hand-built one. [UNIT_TAGGING §3.5](TNPSC_UNIT_TAGGING.md) has the
numbers.

---

## A convention worth fixing while you are in there

Two error shapes are in play across the API:

```json
{"detail": {"code": "...", "message": "..."}}      // FastAPI style
{"success": false, "error_code": "...", ...}        // user-auth style
```

The shared client parser (`src/lib/api.ts`, `toRequestError`) lifts `detail.code`
only. So an endpoint answering `error_code` — `CUSTOM_PAPER_NOT_EDITABLE` is one —
arrives at the caller with `err.code === undefined`, and any code-matching logic
silently misses it.

We work around it where we know about it, by matching the status and both
spellings. Standardising the evaluation endpoints on `detail.code` would remove the
class of bug rather than the instances.
