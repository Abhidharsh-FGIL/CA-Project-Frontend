# Pass marks from the backend

The portal judges a test against a **pass mark** and an **aim** (target), by kind of paper:

| Paper            | Pass | Aim |
|------------------|------|-----|
| Simple practice  | 70 % | 85 % |
| Medium practice  | 60 % | 75 % |
| Complex practice | 50 % | 65 % |
| Mixed practice   | 60 % | 75 % |
| Full-length mock | 60 % (180/300) | 75 % (225/300) |

These are MyGovExams learning benchmarks, not TNPSC's official pass marks. They are now read from the server, so
they can be changed without a release. The frontend keeps the table above as a fallback: it is used until the
server's arrive, and if the endpoint is missing or sends nothing usable.

## 1. The endpoint

```
GET /api/v1/user/tnpsc/pass-marks        (aspirant auth, same as /user/tnpsc/catalog)
```

```json
{
  "simple":  { "pass": 70, "target": 85 },
  "medium":  { "pass": 60, "target": 75 },
  "complex": { "pass": 50, "target": 65 },
  "mixed":   { "pass": 60, "target": 75 },
  "mock":    { "pass": 60, "target": 75 }
}
```

* All five keys; values are percentages from 0 to 100, and `target` ≥ `pass`.
* Also accepted: the table under a `pass_marks` key; `easy` / `hard` / `full_mock` for the keys; `pass_percentage` /
  `target_percentage` for the fields; a bare number for just the pass mark (`"complex": 50`).
* A key that is missing or not a sensible percentage keeps the bundled value, so a partial response is fine.
* Cacheable: the frontend reads it once and keeps it for 10 minutes.

## 2. Where it is set

Store the five rows in a settings table (or per-exam, if Group 1 / Group 2 should differ later — then return the
rows for the aspirant's exam, e.g. `?stage_id=`; the frontend will pass it when that is needed). Give the admin
portal a small **Settings → Pass marks** form to edit them. Changing a value takes effect for every student
within the cache window; no deploy.

## 3. Keep the server's own gate in step

* `TNPSC_LEVEL_PASS_PERCENTAGE` (what a mock must reach to clear a level) should read the **`mock.pass`** row,
  not its own number. The frontend now uses the server's `pass_percentage` on the mock levels response as the
  authority, falling back to `mock.pass` from this endpoint.
* If the level lock is ever switched on, per-difficulty gates should read the same table.
* Reports that say "passed" server-side (emails, certificates, `is_completed`) should judge against the same rows,
  by the paper's `level` (and `track = mock` for a mock), so the portal and the server never disagree.

## 4. What is not affected

Practice papers are not gated by these marks anywhere; they only drive the verdict on a report, the colours on
its category bars, and the "cleared" marker on mock levels. The subject / unit status labels (Strong, Developing,
Needs focus) are accuracy bands within one paper and are separate.
