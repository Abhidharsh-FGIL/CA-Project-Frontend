# Pass marks set by the admin — per assessment, per exam, and overall

Extends `PASS_MARKS_API.md`. The portal and the admin screens are built; **nothing is saved until the server has these
endpoints and fields.** Until then the portal keeps using the built-in marks, and the admin form says the server has no
setting yet.

## 1. What an admin can set

Three layers. The narrowest one that has a value wins:

1. **The assessment's own** pass mark (and aim) — set in the Rules step of *Create Assessment*.
2. **The exam's** setting for that *kind of paper* — set under **Evaluation Hub → Pass marks**, one exam at a time
   (for example RRB NTPC CBT-1 Graduate: unit papers 60 %, key topics 75 %, mock 70 %).
3. **The default** for every exam (same screen, "All exams"), then the built-in table.

An exam names only what it overrides; a kind it leaves out follows the default.

### Kinds of paper (keys)

| Key        | Paper                                   | Built-in pass / aim |
|------------|-----------------------------------------|---------------------|
| `simple`   | Unit paper, Simple button               | 70 / 85 |
| `medium`   | Unit paper, Medium button               | 60 / 75 |
| `complex`  | Unit paper, Complex button              | 50 / 65 |
| `mixed`    | Unit paper, Mixed button                | 60 / 75 |
| `keytopic` | Key-topic paper (has a `topic_id`)      | 60 / 75 |
| `section`  | A section's Full Set (`section_name`)   | 60 / 75 |
| `mock`     | Full-length mock                        | 60 / 75 |

"Unit-wise 60 %" in the admin screen just fills `simple`, `medium`, `complex` and `mixed` together.

An exam is its **group id**: `group-1`, `group-2`, `group-4`, `rrb-ntpc-cbt-1` (Under-Graduate),
`rrb-ntpc-cbt-1-grad` (Graduate), `rrb-ntpc-cbt-2`, … — the same id as `tnpsc_group_id` / `GET /syllabus/{exam}`.

## 2. Endpoints

### Admin — read and write

```
GET /api/v1/admin/tnpsc/pass-marks
PUT /api/v1/admin/tnpsc/pass-marks
```

```json
{
  "default": {
    "simple":  { "pass": 70, "target": 85 },
    "medium":  { "pass": 60, "target": 75 },
    "complex": { "pass": 50, "target": 65 },
    "mixed":   { "pass": 60, "target": 75 },
    "keytopic":{ "pass": 60, "target": 75 },
    "section": { "pass": 60, "target": 75 },
    "mock":    { "pass": 60, "target": 75 }
  },
  "exams": {
    "rrb-ntpc-cbt-1-grad": {
      "simple":  { "pass": 60, "target": 75 },
      "medium":  { "pass": 60, "target": 75 },
      "complex": { "pass": 60, "target": 75 },
      "mixed":   { "pass": 60, "target": 75 },
      "keytopic":{ "pass": 75, "target": 85 },
      "mock":    { "pass": 70, "target": 80 }
    }
  }
}
```

* `PUT` replaces the whole document. An exam that is absent from `exams` follows `default`.
* Values are percentages 0–100, `target` ≥ `pass`. Reject anything else with 422.
* Admin auth, same as `/admin/tnpsc/coverage`.

### Aspirant — read

```
GET /api/v1/user/tnpsc/pass-marks
```

Same body, same shape. The frontend reads `default` (also accepted bare, or under `pass_marks`) and `exams`, and resolves
the layers itself. Cacheable; the frontend keeps it 10 minutes.

## 3. Per-assessment pass mark

Create/update an assessment (`POST /api/v1/evaluation/assessments`) now accepts:

```json
{ "pass_percentage": 80, "target_percentage": 90 }
```

Both optional; `null` means "follow the exam / default". `target_percentage` alone is ignored. Store on the assessment and
return them on:

* `GET /api/v1/user/eval-assessments/{id}` — `pass_percentage`, `target_percentage`
* the practice and mock listings (`TnpscTest`) — `pass_percentage`, `target_percentage`
* the attempt history rows (`ApiAttempt`) — `pass_percentage`, `target_percentage`

Return them **resolved** (the assessment's own, else its exam's for that kind of paper, else the default) if you can. The
frontend uses whatever it gets as the assessment's own value, so a resolved number is always safe; a `null` means it will
resolve from the settings above.

## 4. Keep the server's own judgements in step

* `is_completed` / "cleared" on a practice or mock paper, emails, certificates: judge against the same resolved mark,
  not a fixed number.
* The mock level gate (`TNPSC_LEVEL_PASS_PERCENTAGE`, `pass_percentage` on the mock levels response) should read the
  **exam's `mock.pass`**, falling back to `default.mock.pass`.

## 5. What changed in the portal

* A unit, key-topic or section set is now marked **cleared** at its own pass mark (it used the mock's before), so the
  tick on the Exams screen agrees with the verdict on its report.
* Report verdicts, the landing page's "pass mark", and the mock level gate follow the layers in §1.
