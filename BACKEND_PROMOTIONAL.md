# Promotional assessments — backend changes

A **promotional assessment** is a free test an admin schedules and shares by link. It is open only between a start and
an end time. It is not one of the exams: it never appears in the exam lists. It does not use up the student's plan
tests. After it closes, students see the top 50 and their own rank.

The portal is built and calls the endpoints below. Until they exist, the promotional pages show an empty list or an
error and the daily popup and dashboard card stay hidden.

## 1. Data

On the assessment (or a one-to-one `promotional_assessments` table keyed by assessment id):

| field | type | notes |
|---|---|---|
| `is_promotional` | bool, default false | The portal never lists such a row among exams. |
| `starts_at` | timestamptz, required when promotional | Opens. |
| `ends_at` | timestamptz, required when promotional | Closes. Must be after `starts_at`. |
| `results_at` | timestamptz, optional | When ranks are published. Defaults to `ends_at`. |
| `description` | text, optional | Shown on the link page. |
| `is_active` | bool, default true | The admin's on/off switch (§4). Off closes the test to students whatever the times say. |

Rules:
- `pricing_type` is always `free`. `max_attempts` is always `1`. The server enforces both, whatever is sent.
- A promotional assessment has no TNPSC placement (no `tnpsc_stage_id`, `track` or unit). The portal sends none.
  Make sure it still works without one.
- Store times in UTC. The portal sends ISO strings.

## 2. Create

`POST /api/v1/evaluation/assessments?org_id=…` (the existing create) now also accepts:
`is_promotional`, `starts_at`, `ends_at`.

When `is_promotional` is true:
- `starts_at` and `ends_at` are required. `starts_at` must be in the future, and `ends_at` must be after it. Otherwise
  return 422 with a clear message.
- Force `pricing_type = free` and `max_attempts = 1`.
- The response includes `id` and `is_promotional`.

## 3. Edit — only before it opens

`PATCH /api/v1/evaluation/promotional/{id}` with any of `title`, `description`, `starts_at`, `ends_at`.
- Allowed only while `now < starts_at`. After that return 409 `PROMO_LOCKED` ("It has already opened").
- The same checks on the new times as on create.
- Returns the updated promotional assessment (shape in §5).

## 4. Active and inactive

Active exactly while `is_active` is true **and** `starts_at <= now < ends_at`, by the **server's clock**. The admin has a
switch per test (`PATCH /evaluation/promotional/{id}` with `{"is_active": false}`), allowed at any time, even after the
start (§3's lock does not apply to it). Switched off, a test is closed to students: `/start` returns 403
`PROMO_INACTIVE`, the public and student endpoints still return it with `is_active: false` (the portal then shows it as
expired), and it is left out of `GET /user/promotional` unless the student took it. Switching it on again reopens it if
the window allows. Attempts already in progress may finish. The server must enforce this, not only the page:

- `POST /api/v1/user/eval-assessments/{id}/start` for a promotional assessment:
  - before `starts_at` → 403 with `error_code: "PROMO_NOT_STARTED"`
  - at or after `ends_at` → 403 with `error_code: "PROMO_ENDED"`
  - already submitted once → 409 with `error_code: "PROMO_ALREADY_TAKEN"`
  - an attempt still in progress → resume it, as today.
  - the portal reads these three codes and sends the student to the countdown, the expiry page or their result.
- **Time limit:** an attempt must not run past `ends_at`. Submission by the timer or by the student is accepted until
  `ends_at` plus a short grace of 60 seconds. Anything still open after that is auto-submitted with what was saved.
  Decide whether a student who starts a minute before the close gets the full limit (the portal tells admins they do)
  or is cut at `ends_at`. The portal assumes the full limit, so the server must keep the attempt open for it, and the
  ranks are published at `results_at`, which must then be at least `ends_at` + the time limit. Set it accordingly.

## 5. Public endpoint (no sign-in) — for the share link

`GET /api/v1/public/promotional/{id}` → no auth, rate-limited.

```json
{
  "id": "…", "title": "…", "description": "…", "mode": "exam",
  "question_count": 50, "max_score": 100, "time_limit_seconds": 3600,
  "starts_at": "2026-11-10T12:30:00Z", "ends_at": "2026-11-10T14:30:00Z", "results_at": null,
  "server_time": "2026-11-09T08:00:00Z"
}
```

- **Never** return questions or answers.
- `server_time` is required: the countdown follows it, not the visitor's device clock.
- 404 for an unknown id or a non-promotional assessment.
- An ended test still returns 200 (the page shows "expired" and redirects).

## 6. Student endpoints (signed in)

- `GET /api/v1/user/promotional` → promotional tests the student should see: those that are **upcoming or live**, plus
  ones **they took that closed in the last 7 days**. Same shape as §5 plus:
  `attempted` (bool), `attempt_id`, `in_progress_attempt_id`, and `server_time`. Used by the dashboard card and the
  daily popup. Not per exam, not per plan: every signed-in student sees them.
- `GET /api/v1/user/promotional/{id}` → one test (same shape as above).
- `GET /api/v1/user/promotional/{id}/leaderboard`:

```json
{
  "assessment_id": "…", "title": "…",
  "total_participants": 1234,
  "published": true, "results_at": "2026-11-10T14:30:00Z",
  "top": [ { "rank": 1, "user_id": "…", "name": "Priya S", "score": 92, "max_score": 100, "percentage": 92, "time_taken_seconds": 1710 } ],
  "me":  { "rank": 87, "user_id": "…", "name": "…", "score": 60, "max_score": 100, "percentage": 60, "time_taken_seconds": 2400, "attempt_id": "…" }
}
```

  - `top` is the best 50, never more. `me` is the caller's own ranked row even outside the top 50, or null if they did
    not take it.
  - Before `results_at`: `published: false`, `top: []`, but `me` carries their own **score** (no rank) so the page can
    show it. Do not leak other people's scores early.
  - **Rank:** higher score first. Tie-break by lower `time_taken_seconds`, then earlier `submitted_at`. Equal on all
    three share a rank. Use competition ranking (1, 2, 2, 4).
  - **Names:** the student's display name only. No email or phone to other students.
  - Only submitted attempts count; an auto-submitted one counts as submitted.

## 7. Not consuming the exam count

For a promotional assessment, `/start` must **not** consume the plan's mock or practice allowance or a top-up, and
must **not** refuse for "no plan" or "no tests left". Specifically:
- Skip the plan check on `/start` and on `/submit`.
- Do not count its attempts in `mock_used` / `practice_used` / the subscription `usage` figures, or in `/user/subscription/current`.
- A free-plan student and a student with an expired plan can take it.
- Its report is available to every student, whatever their plan.

## 8. Never listed among exams

For a promotional assessment:
- Exclude it from `GET /api/v1/user/eval-assessments`, `/user/tnpsc/stages/*/mock-tests`, `/practice-tests`, the TNPSC
  catalog counts, course assessment lists and any search or recommendation. The portal also filters
  `is_promotional` rows it receives, as a safety net.
- It must still open by its direct id (`GET /user/eval-assessments/{id}` and `/start`), for a signed-in student.
- Return `is_promotional: true` in the detail response and on the student's attempt history rows (`/user/history`).

## 9. History

A promotional attempt appears in the student's history like any other (it is tagged "Free test"). It counts
as a completed attempt for their performance numbers, if you want it to; if not, say so and we will exclude it. Today
the portal counts it in History and Performance.

## 10. Admin

All under the existing admin auth (and the org the assessment belongs to):

- `GET /api/v1/evaluation/promotional?org_id=…` → all promotional assessments, newest first, each with
  `participants` (submitted attempts) and the shape in §5. Includes ended ones.
- `GET /api/v1/evaluation/promotional/{id}/leaderboard` → **everyone** who submitted, ranked as in §6, each row with
  `attempt_id`, `email`, `phone`, `name`. No 50 limit (paginate if above ~2,000: add `?page=&limit=`).
  Available at any time, including while the test is live.
- The admin attempt report the portal already uses
  (`GET /evaluation/assessments/{assessmentId}/attempts/{attemptId}/detail`) must work for these assessments.
- Deleting or unpublishing: not needed now.

## 11. Daily popup and dashboard

The portal decides the popup itself: once per day (India time) per student, while `GET /user/promotional` returns an
upcoming or live test they have not taken. No server state is needed for that. If you would rather it be server-side
(shown once per day across devices), add `popup_seen_on` per student and say so; the portal will use it.

Optional: a notification row (`/user/notifications`) when a promotional test is created or goes live.

## 12. Login and sign-up

No backend change. The share link is `…/#/promotional/{id}`. The portal keeps the destination and, after login
(password, OTP or Google) or sign-up, goes straight to `/user/promotional/{id}`, which starts the test the moment it
is open. Make sure these work for a brand-new account with no plan and no profile details beyond what sign-up asks.

## 13. Testing checklist

1. Create one for 10 minutes ahead: link shows a countdown; `/start` before the time → `PROMO_NOT_STARTED`.
2. At the start time a signed-in student lands in the test; a signed-out one logs in or signs up, then lands in it.
3. After submit: score, then (after `results_at`) top 50 with the student's row highlighted, rank beyond 50 shown below.
4. A student on the free plan with 0 tests left can take it; their plan's count is unchanged afterwards.
5. After `ends_at`: link and `/start` give "expired" (`PROMO_ENDED`).
6. It is absent from every exam list and from `/user/eval-assessments`.
7. Edit before the start works; after the start → 409 `PROMO_LOCKED`.
8. Admin results list is ranked, each row opens the attempt's report.
