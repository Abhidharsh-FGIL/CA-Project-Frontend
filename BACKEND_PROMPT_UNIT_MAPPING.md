# Backend task: map every question to a syllabus unit (TNPSC Group 4)

You own the FastAPI service behind the evaluation hub and the aspirant portal. This is a
self-contained brief. Attach these files from the frontend repo with it — they are the
executable spec, and the tests in them are your acceptance tests:

- `src/lib/unit-pool.ts` — the matching rules (read this first)
- `src/lib/unit-pool.test.ts` — fixtures with expected results
- `src/config/g4-tag-aliases.ts` — real-world spellings and unit hints
- `TNPSC_G4_SYLLABUS.json` — the 22 units (`sections[].units[]`: `id`, `label`, `name`,
  `name_ta`, `questions`, `subject_ids`, `topics`). **Unit ids are stable slugs; seed from this.**

---

## 1. Goal

Every question in `eval_questions` carries the syllabus **unit** it belongs to, as a stored
`unit_id`, so that an admin can build an assessment "20 from Unit IV, 15 from Unit V" and get
exactly that — on every attempt — without anyone reading `subject` and `chapter` strings.

## 2. Why — what is wrong today (measured, not guessed)

The bank holds questions imported from sheets written by several people. They tag the same
unit many ways. The frontend currently *infers* the unit from `subject` + `chapter` (Topic)
text, and that is the only link there is.

On 4,209 questions from 55 real sheets: **32%** match a unit on the printed names alone; about
**91%** with the frontend's rules. Examples of what the tags look like:

| `subject` | `chapter` (Topic) | Means |
|---|---|---|
| `General English` | `Unit IV: Technical Terms` | English unit IV |
| `Technical Terms` | `Administrative Terms` | English unit IV (Tamil unit IV has the *same English name*) |
| `பொதுத்தமிழ் - பகுதி அ - இலக்கணம்` | — | Tamil unit I (old 3-part syllabus) |
| `தமிழ்` | `இலக்கணம்` | Tamil unit I |
| `மருத்துவம்` | — | Tamil unit IV (a domain of technical terms) |
| `Mathematics – Aptitude & Reasoning` | `HCF` | Aptitude unit |
| `Part A – Unit VI` | `Archaeology` | General Studies unit VI |

Concrete failure that triggered this: three 50-question collections for English unit IV
(Simple / Medium / Complex). Only the Simple one carried `Unit IV: Technical Terms`; the other
two said just `Technical Terms`, so 100 questions never reached the unit and the admin saw
"0 Complex questions". A guess from strings cannot be made reliable. **Store the unit.**

## 3. Deliverables, in order

### P0-1. Schema and API field
- Alembic migration: `eval_questions.unit_id VARCHAR(64) NULL`, plus
  `unit_source VARCHAR(16) NULL` (`sheet` | `rule` | `manual` | `ambiguous`).
  Index `(org_id, unit_id)`.
- Not a foreign key yet. Validate against the catalog in code (seed from `TNPSC_G4_SYLLABUS.json`;
  reject an id that is not one of its 22 unit ids, or that is not in the paper's stage).
- Return `unit_id` (and `unit_source`) on `EvalQuestionOut`, so it is on
  `GET /evaluation/questions`, `GET /evaluation/papers/{id}/questions`, and on every question in
  attempt payloads (the question dicts built in `routers/user/eval_assessments.py`, and the
  attempt-detail / review `questions[]`).

### P0-2. The mapper (a port of `unit-pool.ts`)
Create `app/services/unit_mapper.py` with `map_question(stage, subject, topic, subtopic, text) ->
(unit_id | None, source, ambiguous: bool)`. Implement the rules in §4 and make every fixture in
§5 pass as a pytest. Keep the alias/hint tables in one data file so they can be edited without a
deploy of logic.

### P0-3. Backfill what is already in the bank
`POST /api/v1/admin/tnpsc/backfill-units?stage_id=group-4-written&dry_run=true`
```json
→ { "scanned": 4209, "mapped": 3839, "unmapped": 370, "ambiguous": 16,
    "by_unit": { "g4-en-technical-terms": 150, "…": 0 },
    "unmapped_groups": [ { "subject": "தமிழ்", "chapter": "", "count": 100, "sample": "…" } ] }
```
- `dry_run=true` first; the admin reads `unmapped_groups` before the real run.
- Idempotent. **Never overwrite** a row whose `unit_source` is `sheet` or `manual`.
- Batched, resumable, runs as a background job (Celery is already in the project).

### P0-4. Every path that creates a question sets `unit_id`
- Excel importer (`app/services/excel_question_import.py`): read an optional **`Unit`** column
  (id such as `g4-en-technical-terms`, or the printed unit name); if absent, call the mapper.
  A `Unit` value that is not a known unit is a **row issue**, not stored, not guessed.
  Also add `unit_id` to the assembled `question_json` so the review screen can show it.
- `POST /evaluation/papers/save`: accept `questions[].unit_id`; if missing, call the mapper.
- AI generation and PDF extraction paths: call the mapper.
- `POST /evaluation/papers/{paper_id}/questions` (manual add): accept `unit_id`.

### P0-5. Difficulty must stop collapsing (BACKEND_WORK.md items 0 and 8)
`_difficulty()` in the importer lowercases the cell and returns `"medium"` for anything that is
not exactly `easy`, `medium` or `hard`, so `Simple`, `Complex`, `very hard` and Tamil
`மிகவும் கடினம்` all become Medium silently — about 100 Reasoning questions in the real
sheets. Fix:
- Case-insensitive; `simple|easy` → `easy`; `medium|moderate` → `medium`;
  `hard|complex|difficult|very hard|மிகவும் கடினம்` → `hard`.
- An unrecognised value is a **row issue** returned in `issues`, never a default.
- `UpdateQuestionRequest` must accept `difficulty` (and `unit_id`) and **echo the updated row**.
  Today it ignores `difficulty` and answers 200.

### P1-6. Make the bank cheap to read, and fixable in bulk
- `GET /evaluation/questions` currently returns the whole bank: **~26 MB, ~40 s**. Add
  `?fields=id,subject,chapter,subtopic,difficulty,unit_id,marks,paper_id` (or `slim=true`),
  `limit`/`offset` with `X-Total-Count`, a `unit_id` filter (repeatable), and gzip/br.
- `GET /evaluation/questions/unit-counts?stage_id=group-4-written&source=` →
  `{ "units": [ { "unit_id", "total", "by_difficulty": {"easy","medium","hard"} } ], "unmapped": n }`.
- `POST /evaluation/questions/bulk-update` — `{ "ids": [...], "unit_id": "…", "difficulty": "…" }`
  → `{ "updated": n, "skipped": [] }`, one transaction.
- `POST /evaluation/questions/assign-unit` — `{ "where": { "subject": "…", "chapter": "…",
  "paper_id": "…" }, "unit_id": "…" }` sets `unit_source='manual'` on every match. This is how an
  admin clears the unmapped groups from the backfill report in a few clicks.
- `GET /evaluation/questions/unit-unmapped?stage_id=` → the same `unmapped_groups` list, live.

### P1-7. Assessments composed by unit
- `POST /evaluation/assessments` already receives `unit_ids` and `unit_weights` (the frontend
  sends them; the server stores them and ignores them). Validate: ids belong to the stage;
  weights are percentages, 2 decimals, each ≥ 1, total 100; default to each unit's published
  `questions` count when omitted. Persist and return them on the detail response.
- `_build_attempt_question_ids` (`routers/user/eval_assessments.py`) is
  `random.sample(all_ids, count)` and ignores weights. When `unit_weights` is set: group
  `question_ids` by `unit_id`; allocate `question_count` by weight (largest remainder); cap each
  unit at what it holds and **spill the shortfall to the same section's other units first**, then
  anywhere; `random.sample` within each unit; shuffle the result. Without `unit_weights`, fall
  back to today's behaviour. Return `unmapped_questions: n` if any chosen question has no unit.

### P1-8. Return what is already stored (BACKEND_WORK.md item 4)
- `GET /user/tnpsc/stages/{stage}/practice-tests`: each card gains `unit_id` and `level`
  (practice sets are level-tagged now; the code still sends `level: null`).
- `GET /evaluation/assessments` and `/{id}`: return `tnpsc_stage_id`, `track`, `tnpsc_level`,
  `tnpsc_unit_id`, `tnpsc_subject_id`, `tnpsc_scope`, `tnpsc_section_name`. Today a placed paper
  comes back with none of them, so the admin list shows "Not placed" for papers that are placed.

### P2-9. Seed the subjects (BACKEND_WORK.md item 13)
Group 4 Written has one combined `general-tamil-english` subject. The catalog the portal ships has
`general-tamil` and `general-english` separately, and tagging a Tamil unit paper fails with
`404 SUBJECT_NOT_FOUND`. Seed both subjects and register the units under them, from
`TNPSC_G4_SYLLABUS.json`.

## 4. Mapping rules (what `unit-pool.ts` does — port it faithfully)

**Normalising a tag:** lowercase; replace `&` and the word `and` with a space; remove everything
that is not a letter, digit or Unicode combining mark (**keep Tamil vowel signs**); collapse
spaces. Compare each tag in four forms: whole, with a trailing `(English gloss)` removed, and
each with spaces removed (Tamil is written both "கலைச் சொற்கள்" and "கலைச்சொற்கள்").

**Splitting a tag:** at *spaced* dashes (` - `, ` – `, ` — `), `: `, ` / `, `|`. Drop pieces that
are only a marker — `Part A`, `Unit III`, `பகுதி அ`, `அலகு VI`. The first piece may be the
subject, the rest the unit or topic.

**Order of evidence, strongest first:**
1. Explicit `unit_id` on the row (a `Unit` column) — always wins.
2. `Part A – Unit N` / `Part B – Unit N` (nothing else in the subject): A = General Studies,
   B = Aptitude, unit by its roman `label`. **Part C is ambiguous** (Tamil and English both have a
   unit VI) → null.
3. **Resolve the subject** to a catalog subject: catalog `name` / `name_ta` / aliases, then the
   spellings in `g4-tag-aliases.ts` (`தமிழ்`, `பொதுத்தமிழ்`, `English`, `Mathematics`, …), then
   the first piece of a compound tag, then a leading language word (`English Grammar`).
4. If the subject belongs to **one unit only** (General Studies units; units III and V cover two
   subjects each) → that unit. Done.
5. If the subject is **shared by several units** (Tamil's 7, English's 7, Aptitude's 2) → the tags
   have to name the unit. Try, in this order, and stop at the first tier that names a unit:
   (a) the Subject and anything left over after splitting it; (b) the *leading piece* of
   Topic/Subtopic; (c) the rest of Topic/Subtopic. A tag *names* a unit if it equals the unit's
   `name`, `name_ta`, any of its `topics` (name or id), or contains one of its **hints** as whole
   words (`G4_UNIT_HINTS`: `dice`, `syllogism`, `homophones`, `சதவீதம்`, `இலக்கியம்` …). What the
   author wrote in the **Subject** beats a Topic the catalog happens to list under another unit
   (`தமிழ் – சொல்லகராதி` + Topic `எதிர்ச்சொல்` is Vocabulary, not Grammar).
6. If the subject **cannot be resolved**: a tag may still name exactly one unit on its own — a
   Tamil-script unit name, or a General Studies unit's full printed name. Otherwise:
7. **A name both papers share** — `Technical Terms`, `Grammar`, `Vocabulary`, `Writing Skills`,
   `Reading Comprehension` — is settled by the **language of the question text**: count Tamil
   letters (U+0B80–U+0BFF) and Latin letters; Tamil share ≥ 0.4 → the Tamil unit; ≤ 0.1 → the
   English unit; anything in between, or < 8 letters → **null**. Only when the tags name exactly
   one such pair.
8. Otherwise **null**. A wrong unit is worse than no unit: it puts a question in the wrong paper.

If rules return two units (the catalog lists `Figures of speech` under both English
Vocabulary and Literary Works), store the first in syllabus order, `unit_source='ambiguous'`.

## 5. Fixtures (subject | topic | text language → unit_id) — all must pass

| subject | topic | text | → |
|---|---|---|---|
| `Indian Polity` | `Fundamental Rights` | | `g4-gs-indian-polity` |
| `Indian Economy` / `Development Administration in Tamil Nadu` | | | `g4-gs-economy-and-dev-admin` |
| `Part A – Unit V: Indian Economy and Development Administration in Tamil Nadu` | | | `g4-gs-economy-and-dev-admin` |
| `General Tamil` | `இலக்கணம்` | | `g4-ta-grammar` |
| `General Tamil` | `பிரித்து எழுதுதல் (Splitting words)` | | `g4-ta-grammar` |
| `பொதுத்தமிழ் - பகுதி அ - இலக்கணம்` | | | `g4-ta-grammar` |
| `பொதுத்தமிழ் - பகுதி ஆ - இலக்கியம்` | | | `g4-ta-literature` |
| `தமிழ் – சொல்லகராதி` | `எதிர்ச்சொல்` | | `g4-ta-vocabulary` |
| `கலைச்சொற்கள்` | `புவியியல்` | | `g4-ta-technical-terms` |
| `மருத்துவம்` / `சட்டம்` / `தகவல் தொழில்நுட்பம்` | | | `g4-ta-technical-terms` |
| `English` | `Unit III: Writing Skills` | | `g4-en-writing` |
| `English` | `Parts of Speech / Verbs` | | `g4-en-grammar` |
| `General English` | `Homophones / Commonly confused words` | | `g4-en-vocabulary` |
| `Technical Terms` | `Administrative Terms` | English | `g4-en-technical-terms` |
| `Technical Terms` | | Tamil | `g4-ta-technical-terms` |
| `Vocabulary` | | English | `g4-en-vocabulary` |
| `Aptitude and Mental Ability` | `Dice — Opposite Faces` | | `g4-apt-reasoning` |
| `Aptitude and Mental Ability` | `சதவீதம்` | | `g4-apt-aptitude` |
| `Mathematics – Aptitude & Reasoning` | `HCF` | | `g4-apt-aptitude` |
| `Part A – Unit VI` | `Archaeology` | | `g4-gs-tamil-nadu-history` |
| `தமிழ்` (bare, no topic) | | | **null** |
| `Technical Terms` | | none / too short / mixed | **null** |
| `Part C – Unit VI` | | | **null** |
| `Current Affairs` | | | **null** (current affairs sits inside every unit) |
| `Indian Polity`, row carries `unit_id = g4-gs-geography` | | | `g4-gs-geography` (explicit wins) |

**Acceptance on real data:** run the backfill dry-run on the production bank. Expected: ≥ 90%
mapped. Of sheets whose file name states a unit, ≥ 97% of rows land in that unit. Unmapped
should be dominated by the groups in §6.

## 6. What no rule can map — do not guess; give admins a queue

- Rows whose Subject is a science domain (`அறிவியல்`, `இயற்பியல்`, `புள்ளியியல்`) in the Tamil unit IV
  sheets (~70 rows): ambiguous with General Science, and the questions are not term-lookups.
- The whole Tamil eligibility paper with no Topic (`தமிழ் தகுதி மற்றும் மதிப்பீட்டுத் தேர்வு`, ~100).
- Bare `தமிழ்` with no Topic; `Current Affairs` (~96).

They stay `unit_id = NULL`. Expose them through `unit-unmapped` and clear them with
`assign-unit` / `bulk-update`. A `Unit` column on future sheets prevents the queue growing.

## 7. Compatibility and rollout

- Everything is additive and nullable; old clients ignore unknown fields.
- **The frontend already prefers `unit_id`**: a question that has one is matched on that and
  nothing else; the string inference is only the fallback. So each part ships independently and
  helps as soon as it lands. Order: P0-1 → P0-2 → P0-3 (dry-run, review, run) → P0-4 → P0-5 →
  P1-6 → P1-7 → P1-8 → P2-9.
- Until P1-7 ships, tell admins to set **Question Order = Constant** for any paper whose unit
  split matters; it is the one mode that is exact today (the browser picks the questions).
- Please reply with: the migration revision id, the backfill dry-run JSON, and which of the
  fixtures in §5 you could not make pass and why.
