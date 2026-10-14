# Unit-wise tagging — backend changes required

The aspirant portal's Exams screen now lists **Practice by published syllabus unit**
("Unit IV: Indian Polity — 15 Questions"), not by catalog subject. The unit is the
level the commission publishes question counts against, so it is the level a paper
has to be tagged at.

Admin can now pick that unit when tagging a paper. This document is the backend
half: one column, carried through three endpoints.

It is a delta against [`TNPSC_BACKEND_CHANGES.md`](TNPSC_BACKEND_CHANGES.md) §2 and
§5, and nothing here changes the existing subject/topic fields — they stay, and
stay populated.

---

## 1. Why subject tagging was not enough

A published unit and a catalog subject are not the same thing, and the mapping is
not one-to-one:

| Published unit (Group 4, Part A) | Catalog subjects it covers |
|---|---|
| Unit III — History, Culture of India, and Indian National Movement | `history-and-culture` **+** `indian-national-movement` |
| Unit V — Indian Economy and Development Administration in Tamil Nadu | `indian-economy` **+** `development-administration-tn` |
| Unit I — General Science | `general-science` |

And the whole of Part C (General Tamil, 7 units) maps to the single subject
`general-tamil`, so a subject tag cannot say whether a paper is Grammar or
Vocabulary.

Until this lands, the portal infers the unit from `tnpsc_subject_id`, then
`tnpsc_topic_id`, then by matching the unit's name against the paper's subject or
topic name. That inference is why a correctly-tagged Tamil paper could still show
under no unit at all.

---

## 2. Database

One nullable column on each of the two paper tables, mirroring the existing
`tnpsc_subject_id`:

```sql
ALTER TABLE tests
  ADD COLUMN tnpsc_unit_id VARCHAR(64) NULL;   -- e.g. 'g4-gs-indian-polity'

ALTER TABLE assessments
  ADD COLUMN tnpsc_unit_id VARCHAR(64) NULL;

CREATE INDEX ix_tests_tnpsc_unit ON tests (tnpsc_stage_id, track, tnpsc_unit_id);
```

**`VARCHAR`, not a foreign key.** Unit ids are slugs from the published syllabus
(`g4-ta-grammar`, `g4-gs-economy-and-dev-admin`) and currently live only in the
frontend catalog (`src/config/tnpsc.ts`). If you later add a `tnpsc_units` table,
seed it from that file and promote this to a FK then — the ids are stable and will
not change.

### 2.1 Validation

Extend the existing track rules (§5 of the main document):

- `track = 'practice'` → **`tnpsc_unit_id` required**, and must belong to
  `tnpsc_stage_id`. `tnpsc_subject_id` stays required and is derived from the unit
  by the admin UI, so no caller has to send both consistently — but reject the pair
  if the subject is not one the unit covers.
- `track = 'mock'` → `tnpsc_unit_id` must be **null**. A mock follows the whole
  exam pattern, so it belongs to no single unit.

---

## 3. Endpoints

### 3.1 Accept it on the tagging routes

```
PATCH /api/v1/evaluation/assessments/{id}/tnpsc
PATCH /api/v1/admin/tests/{id}/tnpsc
POST  /api/v1/admin/tnpsc/bulk-tag
```

The frontend already sends it. Current body:

```json
{
  "stage_id": "group-4-written",
  "track": "practice",
  "level": null,
  "unit_id": "g4-gs-indian-polity",
  "subject_id": "indian-polity",
  "topic_id": "fundamental-rights"
}
```

`unit_id` is sent as `null` for mocks, exactly as `subject_id` and `topic_id`
already are.

### 3.2 Return it on the practice listing

```
GET /api/v1/user/tnpsc/stages/{stage_id}/practice-tests
```

Each test object gains `unit_id` alongside the existing `subject_id` /
`topic_id`:

```json
{
  "test_id": "…",
  "source": "test",
  "title": "Indian Polity — Fundamental Rights",
  "unit_id": "g4-gs-indian-polity",
  "subject_id": "indian-polity",
  "subject_name": "Indian Polity",
  "topic_id": "fundamental-rights",
  "topic_name": "Fundamental Rights",
  "question_count": 30
}
```

**This is the field that fixes the empty units.** The portal treats an explicit
`unit_id` as decisive and falls back to the old inference only when it is null, so
papers tagged before this ships keep working unchanged.

### 3.3 Carry it on history (optional, same as the others)

`GET /api/v1/user/history` already returns `tnpsc_subject_id` per attempt (§ main
doc). Adding `tnpsc_unit_id` there lets reports group an aspirant's attempts by
unit, which is how the study plan already thinks about coverage.

---

## 3.4 Three more fields alongside `unit_id`

Placement is now asked as a cascade — exam → track → scope → (unit + level | section)
— and three fields carry the answers. All nullable, all on the same routes and the
same tables as `tnpsc_unit_id`.

```sql
ALTER TABLE assessments
  ADD COLUMN tnpsc_scope        VARCHAR(10) NULL,  -- 'unit' | 'section'
  ADD COLUMN tnpsc_section_name VARCHAR(128) NULL, -- printed section name
  ADD COLUMN tnpsc_language     VARCHAR(10) NULL;  -- 'tamil' | 'english'
-- same three on `tests`
```

| Field | Set when | Meaning |
|---|---|---|
| `tnpsc_scope` | practice | `unit` — one published unit. `section` — a whole printed section. |
| `tnpsc_section_name` | practice + `scope='section'` | Which section, by its printed name ("General Studies"). |
| `tnpsc_language` | mock, where the stage offers a choice | Which language paper the mock is sat in. Group 4 is General Studies + Aptitude plus **one** of General Tamil or General English. |

Validation, extending §2.1:

- `track='practice'` → `tnpsc_scope` required.
  - `scope='unit'` → `tnpsc_unit_id` required; `tnpsc_section_name` must be null.
  - `scope='section'` → `tnpsc_section_name` required; `tnpsc_unit_id` and `tnpsc_level` must be null.
- `track='mock'` → `tnpsc_scope`, `tnpsc_unit_id` and `tnpsc_section_name` all null. `tnpsc_language` required where the stage has a pair of alternative sections, null otherwise.

A row written before these existed infers its scope: a `tnpsc_unit_id` means
`unit`, a `tnpsc_section_name` means `section`, neither means null. The frontend
already does that on read, so no backfill is required for the scope itself.

### Why a section paper is not just a unit paper with more units

The portal renders them in different places. A unit paper sits behind one of a
unit's four difficulty buttons; a section paper is the **Full Set Practice** bar at
the foot of that section's unit list. Today the portal has to guess which a paper
is, by matching its question count against the section's published count — these
fields replace that guess.

---

## 3.5 The 20 / 30 / 50 blend

A paper that stands for the *whole* of something is composed across the difficulty
range rather than filtered to one level:

| Paper | Composition |
|---|---|
| Unit + a level (Simple / Medium / Complex) | that difficulty only |
| Unit + **Full Unit** (`tnpsc_level` null) | **20% Simple · 30% Medium · 50% Complex** |
| Section (`scope='section'`) | same blend |
| Mock | same blend |

The frontend does this at creation time — it picks the questions to those
proportions and reports a shortfall when the bank cannot supply the mix. **No
backend change is needed for the blend**; it is recorded in the questions the
assessment holds.

It is written down here because anything that *generates* questions server-side
should use the same proportions, or a generated full paper will not match a
hand-built one.

---

## 4. Backfill

Existing practice papers have no unit. They will keep appearing via the portal's
inference, but an explicit tag is better. A one-off mapping gets most of them:

```sql
-- Where a unit covers exactly one subject, the unit is unambiguous.
UPDATE tests SET tnpsc_unit_id = 'g4-gs-general-science'
  WHERE tnpsc_stage_id = 'group-4-written' AND tnpsc_subject_id = 'general-science';
UPDATE tests SET tnpsc_unit_id = 'g4-gs-geography'
  WHERE tnpsc_stage_id = 'group-4-written' AND tnpsc_subject_id = 'geography';
UPDATE tests SET tnpsc_unit_id = 'g4-gs-indian-polity'
  WHERE tnpsc_stage_id = 'group-4-written' AND tnpsc_subject_id = 'indian-polity';
UPDATE tests SET tnpsc_unit_id = 'g4-gs-tamil-nadu-history'
  WHERE tnpsc_stage_id = 'group-4-written' AND tnpsc_subject_id = 'tamil-nadu-history-and-society';
```

Three groups cannot be backfilled from the subject alone and need a human or a
topic-level rule:

| Subject(s) | Why |
|---|---|
| `history-and-culture`, `indian-national-movement` | Both roll up into Unit III — so this one *is* unambiguous: set `g4-gs-history-and-inm` for either. |
| `indian-economy`, `development-administration-tn` | Both roll up into Unit V: set `g4-gs-economy-and-dev-admin` for either. |
| `general-tamil` / `general-english` | Seven units behind one subject. Decide from `tnpsc_topic_id` (`grammar` → `g4-ta-grammar`, `vocabulary` → `g4-ta-vocabulary`, …) or re-tag by hand. |

---

## 5. Unit ids

Taken from `src/config/tnpsc.ts`. Stable; safe to store.

| Section | Unit ids, in printed order |
|---|---|
| General Studies (Part A) | `g4-gs-general-science`, `g4-gs-geography`, `g4-gs-history-and-inm`, `g4-gs-indian-polity`, `g4-gs-economy-and-dev-admin`, `g4-gs-tamil-nadu-history` |
| Aptitude (Part B) | `g4-apt-aptitude`, `g4-apt-reasoning` |
| General Tamil (Part C) | `g4-ta-grammar`, `g4-ta-vocabulary`, `g4-ta-writing`, `g4-ta-technical-terms`, `g4-ta-comprehension`, `g4-ta-translation`, `g4-ta-literature` |
| General English (Part C) | `g4-en-grammar`, `g4-en-vocabulary`, `g4-en-writing`, `g4-en-technical-terms`, `g4-en-comprehension`, `g4-en-translation`, `g4-en-literary-works` |

---

## 6. Nothing is blocked on this

The admin UI sends `unit_id` today; a backend that ignores an unknown field keeps
working, and the portal keeps inferring the unit as it does now. Landing §3.2 is
what turns the inference off and makes unit placement exact.
