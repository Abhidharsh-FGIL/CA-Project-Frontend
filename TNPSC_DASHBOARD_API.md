# Aspirant Dashboard — Backend Changes

The user portal has been rebuilt to the new design: sidebar navigation, a stats row,
progress and weekly-performance charts, subject strengths, a study streak, and
Bookmarks / Notes sections.

**Nothing is blocked on you.** Everything the client can compute from data it already
has, it computes ([`src/lib/userDashboardApi.ts`](src/lib/userDashboardApi.ts)) — so
the dashboard is live now and gets more accurate as these land. What follows is
ordered by how much it's worth.

---

## 1. `GET /api/v1/user/dashboard/analytics` — the one that matters

One authenticated call returning everything the dashboard plots. The client merges
**field by field**, server winning, so a partial implementation still helps — ship
`subject_strengths` alone and it will be used.

```jsonc
{
  "assessments_assigned": { "value": 14, "delta": 12 },
  "mock_tests_attempted": { "value": 11, "delta": 8 },
  "average_score":        { "value": 68, "delta": 5 },
  "tests_this_month":     { "value": 11, "delta": 3 },

  // Rolling average score per day — the big area chart. 14–30 points.
  "progress_trend": [
    { "date": "2026-08-26", "label": "26 Aug", "value": 41 },
    { "date": "2026-08-27", "label": "27 Aug", "value": 47 }
  ],

  // "You're preparing better than 68% of learners" — omit or null if not computed.
  "percentile": 68,

  // ★ THE ONE THE CLIENT CANNOT DERIVE — see §2.
  "subject_strengths": [
    { "subject": "Indian Polity", "accuracy": 72 },
    { "subject": "History and Culture of India", "accuracy": 60 }
  ],

  "weekly_performance": {
    "average": 68,
    "improvement": 15,          // percentage points vs last week; null if no baseline
    "days": [                   // Monday-first, always 7
      { "day": "Mon", "value": 62 }, { "day": "Tue", "value": 71 }
    ]
  },

  "streak": {
    "days": 7,
    "week": [true, true, true, true, true, true, false]   // Monday-first, always 7
  }
}
```

`delta` is a percentage change against the previous comparable window; `null` when
there's no baseline. All percentages are **0–100 numbers**, not 0–1.

### What the client already derives (so don't rush these)

Computed from `/user/history` today: all four stat values, `progress_trend`,
`weekly_performance`, and `streak`. They're honest but limited — history is capped at
50 attempts, so an aspirant with more gets a truncated curve. Server-side removes that.

---

## 1b. Shipped 2026-09-02 — what differs, and what to fix

The endpoint is live and **§2 subject strengths works** — the donut has real data. Thank you.
The payload does not match §1's shape, so the client now adapts it
(`adaptServerAnalytics` in [`src/lib/userDashboardApi.ts`](src/lib/userDashboardApi.ts)).
**No action needed on the shape** — it's handled, and the adapter tolerates both. Recorded
so nobody "fixes" it into a second mismatch:

| §1 says | You ship | Handled by |
|---|---|---|
| `average_score: {value, delta}` at top level | nested under `stats`, with `delta_percentage` | reads both |
| `progress_trend[].value` | `running_average` + `percentage` | plots `running_average` |
| `progress_trend[].label` = axis label | the test name | date formatted for the axis, name moved to the tooltip |
| `weekly_performance: {average, improvement, days}` | a flat 7-element array | wrapped; average recomputed weighted by `attempts` |
| `streak.week[]` — 7 booleans | absent (`current_days`, `active_days_total`) | rebuilt from `weekly_performance[].attempts` |

Three things **are** worth your time:

**a. `study_minutes` is inflated and unusable.** You report 1356 minutes, of which 1328 fell
on a single day — 22 hours. That's an attempt left open and auto-closed, not study time.
Clamp per-attempt duration to the paper's `duration_minutes` (or exclude attempts with no
submit event) before summing. The dashboard does **not** display this figure today,
precisely because "22h studied" would be a visible lie.

**b. `weekly_performance` is a rolling 7 days (Thu…Wed), not Monday-first.** §1 asked for
Monday-first, and the streak strip under the chart is Monday-first. The client reorders by
weekday name, which is only safe while the window is exactly 7 days. Either send Monday-first,
or add `week_start` so the client stops guessing.

**c. Duplicate subject names in the bank.** `subject_strengths` returns both
`"Quantitative Aptitude"` (3 attempted) and `"Quantitative"` (0), and both
`"Aptitude & Mental Ability"` and `"Numerical Ability"` (0). The client drops any subject
with `attempted = 0` — otherwise a 0% accuracy over zero questions tops the "weakest subject"
list — but the underlying duplication should be merged in the question bank, or grouped by
`tnpsc_subject_id` as §2 suggests.

Still missing, both optional: `percentile` (§3), and no `assessments_assigned` /
`tests_this_month` / mock-only count — the client keeps deriving those from `/user/history`,
which is capped at 50 attempts (§6.1).

---

## 2. Subject strengths — the real gap

**This is the only widget that cannot work without you.** `/user/history` returns
per-attempt totals (`score`, `percentage`) and no per-subject breakdown, so the donut
renders an empty state today.

You already compute this per attempt — `AttemptDetailResponse.performance_breakdown.subject_breakdown`
carries `subject`, `correct`, `total_questions`, `accuracy_percentage`. What's needed is
the same thing **aggregated across all of a user's attempts**:

```sql
SELECT q.subject,
       SUM(CASE WHEN r.is_correct THEN 1 ELSE 0 END)::float / COUNT(*) * 100 AS accuracy
FROM attempt_responses r
JOIN questions q ON q.id = r.question_id
JOIN attempts a  ON a.id = r.attempt_id
WHERE a.user_id = :user AND a.status IN ('submitted','auto_submitted')
GROUP BY q.subject
ORDER BY accuracy DESC;
```

Return the top 5–7. Once TNPSC subject tagging (§4.3 of `TNPSC_API_SPEC.md`) is in
place, group by `tnpsc_subject_id` instead so the labels match the syllabus the
practice tests are bucketed by — then "weak in Indian Polity" can link straight to
Polity practice sets.

---

## 3. `percentile` — "better than N% of learners"

The design's headline line. Needs a cohort comparison: this user's average against all
users on the same stage.

```sql
SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE avg_score < :user_avg) / NULLIF(COUNT(*),0))
FROM (SELECT user_id, AVG(percentage) AS avg_score
      FROM attempts WHERE status IN ('submitted','auto_submitted') GROUP BY user_id) t;
```

Two things to get right: exclude users with fewer than ~3 attempts (otherwise one lucky
test tops the table), and **omit the field rather than sending 0** when the cohort is too
small — the UI falls back to a neutral subtitle, which is better than telling an aspirant
they beat 0% of learners.

---

## 4. Bookmarks and Notes — new, currently dead ends

Both are in the sidebar because the design has them, and both render an empty state
that says plainly they aren't switched on yet. No fake saving.

### 4.1 Bookmarks

```
GET    /api/v1/user/bookmarks?type=question|topic
POST   /api/v1/user/bookmarks        { "type": "question", "question_id": "…" }
DELETE /api/v1/user/bookmarks/{id}
```

```jsonc
{ "items": [{
  "bookmark_id": "…", "type": "question",
  "question_id": "…", "question_text": "…",     // enough to render without a second call
  "subject": "Indian Polity", "topic": "Fundamental Rights & Duties",
  "attempt_id": "…",                             // so "review in context" can deep-link
  "created_at": "2026-09-01T10:00:00Z"
}], "total": 12 }
```

```sql
CREATE TABLE user_bookmarks (
  bookmark_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type        VARCHAR(16) NOT NULL CHECK (type IN ('question','topic')),
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  topic_id    UUID REFERENCES tnpsc_topics(topic_id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, question_id, topic_id)
);
```

The unique constraint matters — the bookmark control is a toggle, and a double tap must
not create two rows.

### 4.2 Notes

```
GET    /api/v1/user/notes
POST   /api/v1/user/notes            { "question_id": "…", "body": "…" }
PATCH  /api/v1/user/notes/{id}       { "body": "…" }
DELETE /api/v1/user/notes/{id}
```

Same shape plus `body` and `updated_at`. One note per user per question is enough;
`POST` on an existing pair should update rather than duplicate.

Once these exist, tell me and I'll add the bookmark toggle to the test player and the
report, and the note editor to the report — the pages and routes are already there.

---

## 5. Search — removed, no longer needed

**Deprioritised.** The search box has been taken out of the top bar rather than left as a
control that does nothing. Don't build `GET /api/v1/user/search` on our account — if you
want it later, say so and it goes back in with the keyboard shortcut.

---

## 6. Smaller things

| # | Change | Why |
|---|---|---|
| 6.1 | Raise `/user/history` beyond 50 items, or add `?limit=` | The trend chart truncates for active aspirants |
| 6.2 | Add `subject` / `tnpsc_subject_id` to history rows | Lets the client fall back to per-subject strengths without §2 |
| 6.3 | Return `target_groups` on the profile (§7.9 of the API spec) | Orders the two group cards by what the aspirant is preparing for |
| 6.4 | Include `mode` on assigned assessments | Already returned — the MOCK / PRACTICE badge and the chart's track filter depend on it staying |

---

## 6b. Progress-chart filters — `progress_trend` needs group and mode

The progress chart now filters by **exam group** (Group 1 / Group 4) and **track**
(mock / practice), plus a period (week / month / all time). `progress_trend` carries
`attempt_id`, `date`, `label` and `subject` — no group, no mode — so a filtered chart is
recomputed on the client from `/user/history`, which is **capped at 50 attempts**. An
aspirant past 50 gets a truncated curve the moment they touch a filter.

Two small changes fix it:

**a. Add `group_id` and `mode` to each trend point** (and ideally to history rows, §6.2):

```jsonc
{ "attempt_id": "…", "date": "2026-08-31", "label": "Group-4 Medium",
  "percentage": 4.0, "running_average": 1.6,
  "group_id": "group-4", "stage_id": "group-4-written", "mode": "mock" }
```

**b. Or accept the filters as query params** and return the trend already filtered — the
client will use them the moment they exist:

```
GET /api/v1/user/dashboard/analytics?group=group-1&mode=mock&period=month
```

Either is fine; (b) is better because the running average is then computed over the full
filtered set rather than the last 50 attempts. Without one of them, the group filter also
depends on matching attempts against the catalog by `test_id` (falling back to test title),
which breaks for any attempt whose test has since been renamed.

---

## 6c. `subject_strengths` is correct — two notes on using it

Verified against the payload: every `accuracy` equals `correct / (correct + incorrect)`.
Nothing to fix. Two things worth knowing, because they caused a UI bug on our side:

- **Accuracy is not the average score.** Accuracy divides by questions *answered* (56/237 =
  24%); `average_score` divides by every question in the paper including blanks (2.68%).
  The donut showed accuracies around a centre reading 2.68% — our bug, now fixed by showing
  overall accuracy in the centre. Keep the two clearly named if you add more figures.
- **Thin evidence.** "Current Events 57%" is 4 of 7 questions. The tooltip now shows the
  counts so a small sample can't read as mastery. If you ever rank or badge subjects
  server-side, apply a minimum-attempted threshold.

---

## 7. Priority

1. **§1b(a) `study_minutes`** — currently reports 22 hours in one day; unusable until clamped
2. **§6b group/mode on `progress_trend`** — the chart filters fall back to the 50-attempt history without it
3. **§4 bookmarks + notes** — two nav sections are dead ends until these exist
4. **§3 percentile** — one line of the design
5. ~~§5 search~~ — **dropped**, the control has been removed

§2 subject strengths is **done** and correct. If §4 is further out than a few weeks, tell me
and I'll take Bookmarks and Notes out of the sidebar rather than leave two doors that open
onto nothing — the search box has already gone that way.
