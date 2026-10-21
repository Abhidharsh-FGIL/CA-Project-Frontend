# Assessments as the exam — backend changes

The Evaluation Hub → Assessments tab now lists assessments as

```
TNPSC Group 4
 ├─ Mock          the full-length mock assessments
 ├─ Key Topics    Subject → Unit → assessments
 └─ Practice      Subject → Unit → assessments   (+ whole-subject sets under their subject)
```

with Subjects = General Tamil / General English / General Studies / Aptitude & Mental Ability, and a **New**
button beside every mock / unit / subject that opens the create form already placed there.

The frontend only reads what the list already returns for each assessment's TNPSC tag. Most of this needs no
backend change; the points below make it reliable.

## 1. The list must return the full tag on every row

`GET /api/v1/evaluation/assessments` — each row needs (bare names or `tnpsc_`-prefixed, both are read):

| Field          | Why the tree needs it                                                          |
|----------------|--------------------------------------------------------------------------------|
| `stage_id`     | which exam / syllabus                                                          |
| `track`        | `mock` or `practice` → the Mock vs Key Topics / Practice split                 |
| `scope`        | `unit` or `section` (practice only)                                            |
| `topic_id`     | **what makes a practice set a Key Topics set** (scope `unit` + a `topic_id`)    |
| `unit_id`      | the unit → its subject                                                         |
| `section_name` | the subject of a whole-subject (section-scoped) set                            |
| `level`, `language`, `subject_id`, `group_id` | shown on the cards / used for the title          |

The one that matters most is **`topic_id`** (or `scope: "topic"`): if the list omits both, a Key Topics assessment
looks identical to a Practice one and is filed under Practice. Today's list already returns enough for the badge
("Group 4 Written · Practice · Translation · Mixed"); please confirm `topic_id` and `scope` are among the fields.

## 2. Validate placement when an assessment is created

`POST /api/v1/evaluation/assessments` already receives the tag (`tnpsc_stage_id`, `track`, `tnpsc_scope`,
`tnpsc_unit_id`, `tnpsc_topic_id`, `tnpsc_section_name`, `tnpsc_language`, `tnpsc_level`). Please reject a bad
combination with a 422 and a code, so nothing is created that the tree cannot place:

| Rule                                                       | Code                    |
|------------------------------------------------------------|-------------------------|
| `stage_id` and `track` are both required                   | `PLACEMENT_REQUIRED`    |
| `track = practice` requires `scope` (`unit` \| `section`)   | `SCOPE_REQUIRED`        |
| `scope = unit` requires `unit_id`, and the unit must belong to `stage_id` | `UNIT_NOT_IN_STAGE` |
| a key topic requires `unit_id` and a `topic_id` that belongs to that unit | `TOPIC_NOT_IN_UNIT` |
| `scope = section` requires a `section_name` the stage prints | `SECTION_NOT_IN_STAGE`  |
| `track = mock` has no unit, topic or scope                 | `MOCK_HAS_NO_UNIT`      |
| a mock's `level` is required (already: `LEVEL_REQUIRED`)   | —                       |

Return the created row with the stored tag, so the frontend can confirm it was kept (it does not trust a bare 200).

## 3. Same rules on `PATCH /api/v1/evaluation/assessments/{id}/tnpsc` (the Placement button)

Same validation and codes as above, and return the updated row.

## 4. Backfill existing assessments

Assessments with no tag appear under **Unplaced** (they are invisible to aspirants today, as the old banner said).
Either place them by hand with **Placement**, or backfill: for an assessment whose questions are all in one unit,
set `track = practice`, `scope = unit`, `unit_id`, `stage_id` from those questions; leave mocks to a person.

## 5. Optional, for a large list

* `GET /api/v1/evaluation/assessments?stage_id=&track=&scope=&unit_id=` — server-side filters, so a unit can be
  listed without loading every assessment.
* `GET /api/v1/evaluation/assessments/tree?group_id=group-4` — the counts per node (`mock`, and per subject/unit
  for key topics and practice), for the numbers on the folded headers without loading the rows.
