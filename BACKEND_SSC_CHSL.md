# Backend work for SSC CHSL (Tier-1 and Tier-2)

The admin portal build now carries SSC CHSL as two exams, the way RRB NTPC's CBT-1 and CBT-2 are (`src/config/ssc-chsl.ts`).
Until the backend has the same exams, the portal shows them from its bundled copy, but nothing can be saved against them
(papers cannot be placed, the Active switch on Admin → Exams cannot persist, practice papers have no units to be drawn from).

Ids are **the same on the portal and the backend** (no wire mapping, like TNPSC Group 4 and GAT-B).

## 1. Exams and stages

| Exam (group) id | Name | `exam_type` | Stage id |
|---|---|---|---|
| `ssc-chsl-tier-1` | SSC CHSL Tier-1 | `SSC CHSL Tier-1` | `ssc-chsl-tier-1-exam` |
| `ssc-chsl-tier-2` | SSC CHSL Tier-2 | `SSC CHSL Tier-2` | `ssc-chsl-tier-2-exam` |

Authority: Staff Selection Commission (SSC). One stage each, objective (MCQ), not bilingual, four options per question.
Add both ids to everything that lists exams: `GET /api/v1/user/tnpsc/catalog`, `GET`/`PATCH /api/v1/admin/exams/:exam_id`
(the Active switch), the pass-mark settings, the exam-card settings, paper placement (`tnpsc_group_id`, `stage_id`,
`unit_id`) and the Excel importer's `exam` field.

## 2. Pattern

| | Tier-1 | Tier-2 |
|---|---|---|
| Questions / marks / minutes | 100 / 200 / 60 | 135 / 405 / 135 |
| Marks per correct answer | 2 | 3 |
| Wrong answer | −0.50 | −1 |
| Sections | English 25, Reasoning 25, Quantitative Aptitude 25, General Awareness 25 (15 min each) | Mathematical Abilities 30, Reasoning 30, English 40, General Awareness 20, Computer Knowledge 15 (qualifying) |

The Tier-2 negative mark is taken from coaching-site summaries of the 2026 notification and should be checked against the
official notice.

## 3. Subjects (the same in both tiers: one question bank serves both)

| Subject id | Name (what a sheet's Subject cell says) |
|---|---|
| `chsl-english` | English Language |
| `chsl-reasoning` | General Intelligence and Reasoning |
| `chsl-quant` | Quantitative Aptitude (Tier-2's section is titled "Mathematical Abilities"; the subject is the same) |
| `chsl-general-awareness` | General Awareness |
| `chsl-computer` | Computer Knowledge (Tier-2 only) |

## 4. Units

58 units in all: Tier-1 has 26 (English 5, Reasoning 7, Quantitative Aptitude 7, General Awareness 7) and Tier-2 has 32 (the same
plus Computer Knowledge's 6, with Maths ending in Statistics and Probability). Ids are `c1-<subject>-<unit>` for Tier-1 and `c2-<subject>-<unit>` for Tier-2, the same names in both, as NTPC's
`n1-` and `n2-` are. Each unit has topics.

**The full list, with every unit id and its topics, is the `Syllabus` sheet of `SSC_CHSL_2026_Question_Upload_Sample_v2.xlsx`.**
Serve it from `GET /api/v1/syllabus/{exam}/{stage}` as the other exams are:
units (the sheet's "Unit") > categories (its "Topics", one each) > sub-categories (none yet).

A question's sheet row carries `Subject`, `Topic` (a unit's name) and `Subtopic` (one of that unit's topics). A collection is
placed by the unit chosen at import, not by those cells, as for every other exam.

## 5. The sheet importer

`POST /evaluation/excel-papers/import` with `exam` = `SSC CHSL Tier-1` or `SSC CHSL Tier-2`: the same columns as the other
sheets (`Sno`, `Question ID`, `Question`, `Options`, `Correct Answer`, `Explanation`, `Type`, `Difficulty`, `Subject`,
`Topic`, `Subtopic`). English only for now. Whether Hindi rows should be paired by `Question ID` (as Tamil rows are for
TNPSC) is not decided.

## 6. Languages (Tamil, English, Hindi), as for RRB NTPC

SSC CHSL papers are made in Tamil, English and Hindi, and the aspirant chooses one, exactly as for RRB NTPC. The portal now treats the
two SSC exams like the NTPC ones for language, but has **no level** (no Graduate / Under-Graduate).

- **Field names (confirmed with the backend).** The portal sends the language as `tnpsc_language` on create (`POST` assessment) and
  as `language` on the placement (`PATCH /assessments/{id}/tnpsc`), with `tamil`, `english` or `hindi`. It sends nothing for
  "both languages", and never sends `ntpc_language` or `ntpc_level` (those are portal form fields only). The title still carries the
  language (`SSC CHSL Tier-1 (Hindi) — Full Mock`) and a live pool sends `pool_filter.language`; the backend's own fallback order is
  field, then `pool_filter.language`, then title, then the questions.
- **What comes back:** `tnpsc_language` as stored, and `language` as `en`, `ta` or `hi` (null when nothing says). The portal reads `language`.
- Student lists are not filtered by the student's language on the backend: the portal shows "their language plus papers that name none".
- Assessment pools are drawn from the questions of that language only; a question's language is stored with it (the portal also
  reads it from the script, Tamil / Devanagari / Latin).
- Excel import: one sheet row per question per language, English and Hindi (or Tamil) rows paired by `Question ID`, as for NTPC.
  Please confirm Hindi pairing works for `SSC CHSL Tier-1` and `SSC CHSL Tier-2` as it does for `RRB NTPC CBT-1`.
- Names: units and topics have no Tamil or Hindi names yet, so they show in English in every language. If names are supplied
  through the syllabus endpoint (`name_ta`, `name_hi` / `name_en`) the portal will use them.

## 7. Acceptance

1. `GET /user/tnpsc/catalog` lists both exams with the pattern above.
2. `GET /admin/exams` lists both; `PATCH` `{ "is_open": true }` on `ssc-chsl-tier-1` makes it appear as open to students.
3. `GET /syllabus/ssc-chsl-tier-1/ssc-chsl-tier-1-exam` returns 26 units; the Tier-2 call returns 32.
4. Import the sample sheet as Tier-1 with unit `c1-english-language-vocabulary`: 14 rows read, 0 rejected, collection saved
   under that unit.
5. The same import with no unit: refused, as for the other exams.
6. Pass marks can be saved for each of the two exams.
7. Create three assessments under Tier-1, one per language: each is stored with its `ntpc_language`, titled `SSC CHSL Tier-1 (<Language>) — …`,
   and an aspirant who chose Hindi is shown the Hindi one and the ones that name no language.
