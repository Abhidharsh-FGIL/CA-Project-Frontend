# Group 2 Prelims units — backend change

## Decision

Group 2 Prelims uses **Group 4's units, under Group 4's ids**. There are no `g2-…` unit ids any more.

A Group 2 assessment is placed with `stage_id: "group-2-prelims"` and a Group 4 unit id, for example:

```json
{ "group_id": "group-2", "stage_id": "group-2-prelims", "track": "practice", "scope": "unit", "unit_id": "g4-apt-reasoning" }
```

The group and stage say which exam a paper is for. The unit id says which syllabus unit it covers, and that unit is the
same in both exams: same name, label, section, question split and topics. The question bank is already filed under the
`g4-…` ids, so nothing needs translating.

## What the backend must change

1. **Accept the Group 4 units on `group-2-prelims`.** Placement is checked against the stage's own unit list, so today
   `g4-apt-reasoning` on a Group 2 paper is refused with *"Unit 'g4-apt-reasoning' is not a unit of
   'group-2-prelims'"*. Either list the same `g4-ta-*`, `g4-en-*`, `g4-gs-*` and `g4-apt-*` units under
   `group-2-prelims`, or validate `group-2-prelims` against `group-4-written`'s units. Topic ids inside a unit are
   unchanged.
2. **Drop the `g2-*` units** if any were added from the earlier version of this note. Re-save any assessment stored
   with a `g2-…` id with the matching `g4-…` id: swap the prefix, and the rest of the id is identical.
3. **Catalogue:** `GET /user/tnpsc/catalog` should list the same `g4-…` units under `group-2-prelims`.

## Frontend (done)

- `src/config/tnpsc.ts`: Group 2's sections use the Group 4 unit lists directly.
- Old `g2-…` ids still read as the Group 4 unit of the same name (`findUnit`, `unitForAssessment`), so anything saved
  earlier is still shown in its unit.
- A Group 2 assessment with no unit id is filed by its title ("Reasoning · Mixed" → Unit II · Reasoning) in the
  Assessments tree and in History.
