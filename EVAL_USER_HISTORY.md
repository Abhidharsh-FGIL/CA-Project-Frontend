# Evaluation Hub → History tab (by user)

The Evaluation Hub has a **History** tab beside Reports: a list of users with how many assessments and attempts each
has, and — opening one — every assessment they attended with date, score, time and status. Each attempt's
**View Report** button opens that attempt's own report; Back returns to History.

## Where the data comes from today

`GET /admin/history/users` (the Admin → History page) does **not** count attempts made on Evaluation Hub
assessments — it reports 0 mock / 0 practice for users who have plenty. So this tab reads the attempts where they are:

1. `GET /evaluation/assessments` and the bulk `GET /evaluation/assessments/stats?ids=…` (in batches of 30 ids) say
   which assessments have anyone invited or submitted.
2. For those (newest 120) it reads `GET /evaluation/assessments/{id}` — `invitations`, `attempts`, and
   `direct_attempts` (portal users who opened it themselves) — and groups the attempts by e-mail.

One request per assessment: fine for dozens, slow for hundreds. Past 120 the tab says it is built from the newest.

## The bug that made everything read 0

The stats request put every assessment id in one address. At ~240 assessments that is ~9 KB, which the server
refuses; the error was swallowed and **every** assessment then showed 0 invited / 0 submitted (on Reports and, before
this change, on History). It now asks in batches of 30. If Reports still shows 0 / 0 for an assessment that was taken,
the stats endpoint itself is not counting portal (direct) attempts — see below.

## Backend, to make this fast and complete

1. **Count assessment attempts in the user history.** `GET /admin/history/users` (and `/{id}`) should include
   attempts on Evaluation Hub assessments (`attempt_type: "eval"`) in `mock_attempts` / `practice_attempts`, with
   `test_id` = the assessment's id. Then Admin → History and this tab can both read it.
2. **Or a per-user endpoint for assessments**, so the tab needs one request:

   ```
   GET /api/v1/evaluation/history/users?search=&page=&limit=
   GET /api/v1/evaluation/history/users/{user_id}
   ```
   with `assessments_attended`, `total_attempts`, `finished_attempts`, `avg_percentage`, `last_attempt_at` per user,
   and per attempt: `attempt_id`, `assessment_id`, `assessment_title`, `kind` (mock | keytopic | practice | unplaced),
   `status`, `start_time`, `end_time`, `time_taken_seconds`, `score`, `max_score`, `percentage`.
3. **Stats:** `GET /evaluation/assessments/stats` should count portal (direct) attempts as `submitted`, and accept
   a long `ids` list (or a POST), so the Reports counts are right.
