# Collections as the syllabus — backend changes

The Evaluation Hub → Collections tab now lists collections as **exam → subject → unit → collections**
(TNPSC Group 4 → General Tamil / General English / General Studies / Aptitude & Mental Ability → the published
units → the question sets filed there). The frontend is done; it works from what the server stores on each
collection. Until the server stores and returns a collection's unit, collections are placed from their *names*
(only where a name settles it, e.g. `Unit_4_Tamil_50Q_Hard`) and the rest sit in an **Unassigned** tab.

## 1. Store the placement on the collection

A collection (`paper`) needs four nullable fields:

| Field          | Example                         | Meaning                                    |
|----------------|---------------------------------|--------------------------------------------|
| `group_id`     | `group-4`                       | the exam                                   |
| `stage_id`     | `group-4-written`               | the stage whose syllabus the unit is from  |
| `section_name` | `General Tamil`                 | the subject (the stage's printed section)  |
| `unit_id`      | the catalog id of "Unit I …"    | the published unit                         |

The frontend also reads them as `tnpsc_group_id`, `tnpsc_stage_id`, `tnpsc_section_name`, `tnpsc_unit_id`, or
nested as `placement: { groupId, stageId, unitId, sectionName }` — return whichever spelling the rest of the
Evaluation API uses.

## 2. Set it when a collection is saved (new uploads)

`POST /api/v1/evaluation/papers/save` already receives `config.placement`. It now carries:

```json
"placement": {
  "stageId": "group-4-written",
  "unitId": "<unit id>",
  "topicId": null,
  "groupId": "group-4",
  "sectionName": "General Tamil"
}
```

Today the server uses `unitId` to file the *questions* under the unit. Please also write `group_id`, `stage_id`,
`section_name` and `unit_id` onto the **paper row**, so a collection appears under its unit the moment it is
uploaded, with no one moving it.

## 3. Return it from the list

`GET /api/v1/evaluation/papers` must include the four fields on every row. (Today a row has `id, title,
question_count, difficulty, created_at, board, grade, source_type`.) Without them the tab can only place
collections by name.

## 4. Accept it on PATCH (the "Move to a unit" button)

`PATCH /api/v1/evaluation/papers/{id}` — the endpoint the list already renames through — must accept
`group_id`, `stage_id`, `section_name` and `unit_id`, store them, and return the updated row.

* Validate that `unit_id` belongs to `stage_id`'s syllabus (422 `UNIT_NOT_IN_STAGE` otherwise).
* The frontend re-reads the list after the call and only says "moved" if the row comes back with the unit. A
  server that answers 200 but ignores the fields is reported as "did not keep the placement".

## 5. Backfill existing collections

Collections uploaded before this change have no placement. Either:

* **derive it:** if ≥ 80 % of a collection's questions carry the same `unit_id`, set the collection's placement to
  that unit (and its subject / stage / group); leave the rest empty. Or
* leave them empty — they show in **Unassigned**, and an admin moves each with "Move to a unit".

Collections whose questions span several units (a full mock) should stay unplaced, or take a separate
`scope = "full_paper"`; the tab lists them as Unassigned.

## 6. Optional

* `GET /api/v1/evaluation/papers?group_id=&unit_id=` so a unit can be listed without loading every collection.
* `question_count` per unit on the list response, to show "12 collections · 480 questions" on a unit header.
