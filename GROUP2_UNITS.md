# Group 2 Prelims units

Group 2 Prelims has its **own unit ids**, with the `g2-` prefix: `g2-gs-general-science`, `g2-ta-grammar`,
`g2-apt-aptitude` and so on. They are the ids the server lists for the stage (`GET /syllabus/group-2/group-2-prelims`)
and stores on every Group 2 assessment. A Group 4 `g4-` id is not a unit of `group-2-prelims`, and the server refuses it
with `UNIT_NOT_IN_STAGE`.

The units match Group 4's one for one. Each has the same name, label, question split and topics, and its id is the
Group 4 id with the prefix swapped.

## Frontend

- `src/config/tnpsc.ts`: Group 2's sections are Group 4's unit lists re-keyed to `g2-` (`asGroup2`). This is the
  bundled fallback, and it matches the server's list.
- Creating an assessment (`useCreateEvalAssessment`) reads the stage's unit ids from `GET /syllabus/{exam}/{stage}` and
  sends `unit_ids`, `unit_weights`, `pool_filter.unit_ids` and `tnpsc_unit_id` as the stage lists them
  (`stageUnitIds` in `assessment-pool.ts`). An id the stage doesn't list is swapped for the stage's unit of the same
  family. If the syllabus can't be read, the ids go as chosen.
- Bank questions tagged with Group 4 ids still count toward the matching Group 2 unit (`byFamily` in `unit-pool.ts`).
- `findUnit` also tries the stage's unit of the same family, so Group 4-keyed tables (such as the study plan) still
  resolve on Group 2.
