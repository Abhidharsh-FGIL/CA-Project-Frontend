# Backend task: map a collection to a syllabus unit on import (TNPSC Group 4)

Written for: the backend developer who owns `/api/v1/evaluation/papers/*` and the Excel importer.

## 1. What the admin does now

In **Evaluation Hub → Collections → Import paper**, the admin picks the exam and a **Syllabus unit**.
The unit is **mandatory**: the Import button stays disabled until one is chosen. Every question the import
brings in is filed under that unit. The Key topic picker has been removed, so a collection is always
filed under a whole unit.

The frontend sends it inside the existing save call:

```
POST /api/v1/evaluation/papers/save
{
  "org_id": "...",
  "config": {
    "title": "TNPSC_Group4_Tamil_Grammar_Easy_125",
    "testType": "TNPSC Group 4",
    "difficulty": "easy",
    ...existing fields...,
    "placement": { "stageId": "group-4-written", "unitId": "g4-ta-grammar", "topicId": null }
  },
  "questions": [ ... ],
  "answer_key": [ ... ]
}
```

`placement` is always sent now, with a `unitId`. `topicId` is always `null` and can be ignored.

Note the key names are camelCase inside `config`, like `testType` and `negativeMarking` already are.

## 2. What the server does

### P0 — Accept and check the placement

1. `placement` is required. A save without a `unitId` is refused with **422 `TNPSC_UNIT_REQUIRED`**.
2. Check it against the **published syllabus**, `TNPSC_G4_SYLLABUS.json`, not the `tnpsc_units`
   or `tnpsc_topics` tables (the same source the frontend reads):
   - `stageId` is a known stage (`group-4-written`).
   - `unitId` is one of that stage's `sections[].units[].id`. Otherwise **422 `TNPSC_UNIT_MISMATCH`**.
3. Reject the whole save on a bad placement. Do not save the collection half-placed.
4. Ignore `topicId`, which the frontend no longer sends.

Checking against the JSON means this does not depend on the key-topic seed (BACKEND_PROMPT_KEY_TOPICS.md).

### P0 — Store the placement on the collection

Add three nullable columns to the collection table (the one `/papers/save` writes, `eval_papers` or
whatever it is called on the server):

```sql
ALTER TABLE <collection_table> ADD COLUMN tnpsc_stage_id VARCHAR(64) NULL;
ALTER TABLE <collection_table> ADD COLUMN tnpsc_unit_id  VARCHAR(64) NULL;
ALTER TABLE <collection_table> ADD COLUMN tnpsc_topic_id VARCHAR(64) NULL;
```

Existing collections stay `NULL` (unmapped). No backfill.

### P0 — Stamp every question with the unit

For each question saved in a mapped collection:

- `unit_id` = `placement.unitId`
- `tnpsc_topic_id` = null
- `tnpsc_subject_id` = the unit's catalog subject, which is `unit.subject_ids[0]` when the unit has one,
  otherwise the section's `syllabus_subject_ids[0]` (the same rule as `subjectForUnit` in
  `src/config/tnpsc.ts`).

The collection's unit **overrides** whatever the sheet's own Subject / Topic implied for that question.
That is the point: the admin said which unit this sheet is for. The sheet's Subject and Topic columns in the
new format do not name catalog subjects or units, so they must not decide placement.

### P0 — Return the placement

- `GET /api/v1/evaluation/papers` rows (and the single-paper read) carry `tnpsc_stage_id`,
  `tnpsc_unit_id`, `tnpsc_topic_id`, so the Collections list can show which unit a collection is for.
- Question rows carry `unit_id` as they already do, so the bank's unit counts and the assessment picker
  pick the stamped unit up without further change.

### P1 — Change the mapping on a collection that already exists

`PATCH /api/v1/evaluation/papers/{paper_id}` already exists (the frontend calls it for difficulty and
level). Accept the same three fields, `tnpsc_stage_id`, `tnpsc_unit_id`, `tnpsc_topic_id`, with the same
checks as §2, and **re-stamp every question in the collection** when the unit or topic changes. A null
`tnpsc_unit_id` clears the mapping and leaves the questions' units as they were stamped last time.

The frontend does not call this yet; it is the way to fix a collection imported under the wrong unit.
A "Syllabus unit" edit on the collection card would use it.

### P2 — Optional: the sheet's own Unit column

If an Excel sheet carries a Unit column per row, a per-row unit could be read as now. The collection
placement still wins when it is set. Say if you want per-row units honoured in unmapped collections.

## 3. Acceptance

1. Save with `placement: {stageId: "group-4-written", unitId: "g4-gs-geography", topicId: null}` on a sheet
   whose Subject is "Indian Polity": every saved question has `unit_id = "g4-gs-geography"`, and the
   collection row reads back `tnpsc_unit_id = "g4-gs-geography"`.
2. Save with `placement: null` (or no key): the save succeeds and questions keep their own units.
3. `unitId` from another stage → **422 `TNPSC_UNIT_MISMATCH`**; no collection is created.
4. `topicId: "forest-wildlife"` with `unitId: "g4-ta-grammar"` → **422 `TNPSC_TOPIC_MISMATCH`**.
5. `PATCH` the collection to a different unit: every question's `unit_id` follows, and the
   `GET /evaluation/questions/unit-counts` figures move with it.
6. Loop over every `(unit, topic)` in the JSON and save a one-question collection against each: none is
   refused.

## 4. What the frontend already does

- `src/components/evaluation/CollectionUnitField.tsx`: the unit and key-topic pickers, built from the same
  published list as the assessment form.
- `src/components/evaluation/EvalPaperImportPanel.tsx`: shows the picker on the import form and sends
  `config.placement` on save.
- `src/hooks/use-evaluation.ts`: the `placement` field on `EvalPaperConfig`.

Nothing else changes on the frontend when the backend ships.

## 5. The new sheet format (checked against a real file)

The admin is now importing this layout (`Indian_Economy_Tamil_Nadu_Reworded_Shuffled.xlsx`, 200 rows):

| Column | Example | Notes |
|---|---|---|
| `Sno` | `1` | Row number |
| `Question ID` | `5301` | **Repeats**: each question appears once in English and once in Tamil under the same ID. 100 IDs, 200 rows. |
| `Question` | `what is social justice in development policy?` | Question text |
| `Options` | `A) Fair treatment…
B) …
C) …
D) …` | Four options in one cell, separated by newlines, each starting with its letter and `)`. |
| `Correct Answer` | `A) Fair treatment and equitable access…` | **The full option text, with its letter**, not just `A`. |
| `Explanation` | `The correct answer is A) …` | |
| `Type` | `Conceptual / General Knowledge` or `கருத்தியல் / பொது அறிவு` | The Tamil rows use the Tamil label. |
| `Difficulty` | `Hard` | Every row in this file is Hard. The form's chosen level replaces it. |
| `Subject` | `Indian Economy and Development Administration in Tamil Nadu` | **Not a catalog subject.** Tamil rows carry the Tamil name. |
| `Topic` | a full sentence | **Not a topic name.** Ignore it for placement. |

There is **no Language, Unit or Subtopic column.** The importer must:

1. Accept the headers as named above, and not require `Unit`, `Language` or `Subtopic`.
2. Read the **language** from each row's text, since there is no column for it (the Tamil rows are Tamil script).
3. **Pair** the English and Tamil rows by `Question ID`, so each question is saved once with both languages.
4. Match `Correct Answer` to the options by the full text. This file: 200 of 200 match. Reject a row that matches none
   (the existing rule).
5. Take the unit from the **placement**, not from `Subject` or `Topic`.

**Checked on this file:** 200 rows, 100 Question IDs (each twice), 4 options per row, 200/200 answers match an option,
2 Types, 1 Difficulty value, 2 Subject names (English and Tamil). The importer should report these counts back.

## 6. Acceptance additions

7. Import `Indian_Economy_Tamil_Nadu_Reworded_Shuffled.xlsx` with unit `g4-gs-economy-and-dev-admin` and difficulty
   Simple: 100 questions saved, each with both languages, all filed under that unit at difficulty Simple.
8. The same import with no `placement`: **422 `TNPSC_UNIT_REQUIRED`**, nothing saved.
