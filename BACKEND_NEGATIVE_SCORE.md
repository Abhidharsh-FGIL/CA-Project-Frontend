# Negative marking — return the real score, not 0

## Why

A paper with negative marking can score below zero: 2 right and 18 wrong at 0.33 each on a 20-mark paper is
2 − 5.94 = **−3.94**. The server stores and returns `max(0, score)`, so every screen that reads the score from the API
shows 0 / 0%.

The attempt **report** screen now works the true net out itself (correct × marks-per-question − marks lost) and shows
−3.94 / −19.7%. Every list screen only has the server's `score` and `percentage`, so they still show 0:

| Screen | Source | Shows today |
|---|---|---|
| Report | `GET /user/history/{attempt_id}` + frontend correction | −3.94 (correct) |
| History list, rows and cards | `GET /user/history/` | 0 / 0% |
| History cards: Best / Average Score | same list | too high — negatives counted as 0 |
| Dashboard and Performance: scores, trend, averages | dashboard analytics | too high — same reason |

The list has no correct/wrong counts or marking rate to work the net out from, and opening every report to do it would
be hundreds of calls.

## What to change

1. **Stop clamping at 0 when the score is stored or returned.** `score` may be negative, and `percentage` is
   `score / max_score × 100`, so it may be negative too (−19.7). Do it everywhere the attempt's score is read: the
   attempt list and detail, the dashboard analytics, the progress trend and any average or best-score aggregate.
2. **Keep the 0–100 assumption only where something needs it** (for example the level gate
   `LEVEL_PASS_PERCENTAGE`): clamp at that point, not in the stored value. GAT_B_BACKEND_CHANGES.md §6 says to clamp
   "before computing the percentage" for the same reason; that clamp now belongs in the gate, not the stored percentage.
3. **Old attempts:** recompute `score` and `percentage` for attempts already stored as 0 where marks lost exceed marks
   earned. Marks earned is `correct × points`, marks lost is `wrong × negative_mark_value`; use each question's own
   `points`, which sections of different weight (GAT-B: 1 and 3) need.

## Frontend

- **Done:** the report works out the net itself when the server sends exactly 0
  (`scoreBelowZero` in `src/lib/attempt-report.ts`). It assumes one marks-per-question rate (total ÷ questions), so a
  paper weighted by section is not corrected there.
- **Little needed once this ships.** The helper only acts on a server score of exactly 0, so a server that sends the
  real negative score is used as-is. The History rows, rings and bars already cope with negative values (they clamp
  the drawing, not the number). The dashboard and Performance charts should be looked at once negative values arrive.
