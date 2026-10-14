# Difficulty, levels and unit placement — everything the backend needs

Three related gaps stop the aspirant portal's Exams screen filling in. All three are
frontend-complete; this is the backend half of each, smallest first.

| # | Change | Size | Blocks |
|---|---|---|---|
| 1 | `PATCH /evaluation/papers/{id}` accepts `difficulty` + `tnpsc_level` | ~1 hour | Reclassify tool writing anything |
| 2 | Those two columns on `papers`, and inheriting them when an assessment is built | half a day | Simple / Medium / Complex buttons |
| ~~2b~~ | ~~Allow `tnpsc_level` on `track='practice'`~~ (§2.3) | — | **Shipped** (commit 29ee589) |
| 3 | `tnpsc_unit_id` on papers/tests/assessments | half a day | Unit rows showing their papers |
| 4 | `GET /evaluation/subjects` returning what the bank actually holds | ~1 hour | Subject filters missing most of the bank |

§3 is specified separately in [`TNPSC_UNIT_TAGGING.md`](TNPSC_UNIT_TAGGING.md); it is
listed here so the whole picture is in one place.

---

## 0. Where classification belongs

**On the collection, not the assessment.** A collection is the content; an
assessment is one publication of it. Fixing the collection fixes every assessment
built from it afterwards, and there is typically one collection where there are
several assessments — so it is both the smaller job and the one that stays fixed.

```
Question (difficulty: easy|medium|hard)
   └─ Collection / paper  ← classify HERE: difficulty + tnpsc_level
        └─ Assessment     ← inherits at build time
             └─ Portal shows it behind Simple / Medium / Complex
```

Questions already carry their own `difficulty` and need no change.

---

## 1. `PATCH /api/v1/evaluation/papers/{id}` — accept two more fields

The route already exists; the Collections list renames through it. It needs to
accept two more keys:

```http
PATCH /api/v1/evaluation/papers/{paper_id}
{ "difficulty": "hard", "tnpsc_level": "complex" }
```

| Field | Values | Meaning |
|---|---|---|
| `difficulty` | `easy` \| `medium` \| `hard` \| `mixed` | What the collection's questions actually are. `mixed` is already used by existing assessment rows. |
| `tnpsc_level` | `simple` \| `medium` \| `complex` | Which difficulty button the portal files it behind. |

Either may be sent alone. Anything else in the body behaves as it does today.

**Until this lands** the admin tool scans and shows its findings but can write
nothing — it catches `404`/`405`/`422` and says *"This backend does not accept
difficulty / level on a collection yet"*. Nothing half-applies.

---

## 2. Columns, and inheriting them

```sql
ALTER TABLE papers ADD COLUMN difficulty   VARCHAR(10) NULL;  -- easy|medium|hard|mixed
ALTER TABLE papers ADD COLUMN tnpsc_level  VARCHAR(10) NULL;  -- simple|medium|complex
```

`papers` already returns a `difficulty` on its rows, so that column may exist —
check before adding. `tnpsc_level` is new.

Return both on `GET /api/v1/evaluation/papers`. The tool reads them to show
"what it is now" beside "what its questions say"; without them every row looks
unclassified and the whole list is proposed as a change.

### 2.1 Why this is what fixes the empty buttons

The portal's stage page reads `TnpscTest.level` to decide which of Simple /
Medium / Complex a paper sits behind. Only **mock** tests were ever given a level,
so every practice unit shows three empty buttons and one "Full Unit".

So when an assessment is created from a collection, carry the collection's
`tnpsc_level` onto it as `tnpsc_level` unless the admin set one explicitly. One
line at create time, and the buttons fill in.

### 2.2 Vocabulary

Questions are `easy` / `medium` / `hard`. Levels are `simple` / `medium` /
`complex`. They are **not** the same words and must not be conflated:

| Questions | → Level |
|---|---|
| `easy` | `simple` |
| `medium` | `medium` |
| `hard` | `complex` |

A collection whose questions are genuinely mixed records `difficulty: "mixed"` and
takes the level of its **dominant** difficulty — `mixed` is not one of the three
buttons and every paper has to sit behind one.

---

## 2.3 `tnpsc_level` on practice papers — **shipped**

> Deployed in commit 29ee589. Practice `tnpsc_level` is optional: `simple` /
> `medium` / `complex` or null; mock still requires it. Kept below for the record.

`TNPSC_BACKEND_CHANGES.md` §5 currently states:

> `track = 'practice'` → `tnpsc_subject_id` required (topic optional), **`tnpsc_level`
> must be null**, `30 ≤ question_count ≤ 50`.

**That rule has to go.** The portal gives every syllabus unit four buttons — Simple,
Medium, Complex and Full Unit — and reads the paper's `tnpsc_level` to decide which
one opens it. While practice papers are forbidden a level, three of those four
buttons can never be filled, which is exactly what the Exams screen shows today.

The revised rule:

| Track | `tnpsc_level` |
|---|---|
| `mock` | **required** — `simple` \| `medium` \| `complex`. Gates progression, unchanged. |
| `practice` | **optional** — the same three values, or null. |

A practice paper with a level sits behind that difficulty button for its unit. One
with `null` covers the whole unit and sits behind **Full Unit**. Nothing else about
the practice rules changes; `tnpsc_subject_id` stays required and the question-count
band is untouched.

The admin UI already sends it: the level selector now appears for both tracks, with
a fourth "Full Unit" choice on practice that sets it to null.

---

## 3. Unit placement

Specified in [`TNPSC_UNIT_TAGGING.md`](TNPSC_UNIT_TAGGING.md). In short: one
nullable `tnpsc_unit_id VARCHAR(64)` on `tests` and `assessments`, accepted on the
three tagging routes, returned on the practice listing. The admin UI already sends
it.

Without it the portal guesses which syllabus unit a paper belongs to from subject
ids, topic ids and name matching — which is why correctly-tagged Tamil papers can
still appear under no unit.

---

## 4. `GET /api/v1/evaluation/subjects`

This returns a curated list that has drifted from the bank. Observed: the endpoint
offers *English Language, Numerical Ability, Quantitative Aptitude, Reasoning
Ability* while 6,148 questions in the same bank are tagged **`Reasoning`** — a
value the endpoint never returns, so the Question Bank's subject filter could not
reach most of its own contents.

It should return the distinct subjects actually present, scoped by `org_id`:

```sql
SELECT DISTINCT subject FROM questions
 WHERE org_id = :org_id AND subject IS NOT NULL AND subject <> ''
 ORDER BY subject;
```

The frontend currently unions the response with the subjects on whatever questions
are loaded, which patches the symptom; this removes the cause.

---

## 5. Optional — make the scan one request

The tool reads one collection at a time (4 concurrently) to count the difficulties
inside it. Fine for a few hundred collections, wasteful for thousands. Either of
these turns it into a single call:

- Return the counts on the list: `"difficulty_mix": {"hard": 100}` per paper row.
- Or add `GET /api/v1/evaluation/papers/difficulty-audit?org_id=` returning
  `[{id, title, stored_difficulty, stored_level, counts}]`.

Neither is required.

---

## 6. What the frontend already does

| Endpoint | Used for |
|---|---|
| `GET /evaluation/papers?org_id=` | the collection list |
| `GET /evaluation/papers/{id}/questions` | reading each collection's question difficulties |
| `PATCH /evaluation/papers/{id}` | writing the result — **needs §1** |
| `POST /admin/tnpsc/bulk-tag` | unit/level tagging from the placement card |

Derivation rules and their 16 unit tests: `src/lib/reclassify.ts`,
`src/lib/reclassify.test.ts`. The create form already derives an assessment's
difficulty from its questions at save time, so papers made from today forward are
correct without any of the above.
