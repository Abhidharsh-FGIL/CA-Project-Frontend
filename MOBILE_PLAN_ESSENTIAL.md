# Essential plan in the mobile app

The server now has a fifth plan, **Essential** (₹149 / month). The plans screen should show it with no app release **if** it
builds its list from `GET /api/v1/user/subscription/plans` and tolerates a tier it has not seen. Please check the points below.

## 1. Read the plans from the server, don't list four

* Build the plan list from the response. Do not keep a fixed list of `free / standard / ultimate / premium` and look each
  one up — Essential would never appear. A plan whose `name` the app does not recognise must still be shown (use the
  server's `name`, capitalised), not dropped and not a crash.
* Show only plans with `active: true`. (Standard and Premium are paused today and are not returned.)
* The tier **order** is `free < essential < standard < ultimate < premium`. Anywhere the app compares tiers to decide "does
  this plan cover this test", "upgrade" vs "downgrade", or "which plan to suggest next", use that order. A Free user's
  next plan up is now Essential.

## 2. What Essential looks like in the response

```json
{
  "plan_id": "a4284320-…",
  "name": "essential",
  "price_monthly": 149.0,
  "price_yearly": 0.0,
  "duration_days_monthly": 30,
  "features": { "mock_tests_per_month": 1, "practice_tests_per_month": 15, "ai_report_level": "standard",
                "history_retention_days": 90, "download_pdf": false, "support": "Email" },
  "tagline": "Start small. Practise smart. Improve every day.",
  "cards": { "monthly": { "headline": "…", "description": "…", "included": [{ "title": "…", "detail": "…" }],
                          "excluded": [], "best_for": "…", "cta": "Choose Essential", "badge": "Most Popular" },
             "yearly":  { "…": "present, but do not use — see §3" } }
}
```

## 3. Monthly only

`price_yearly` is `0` — that means **no yearly option**. Show only the monthly card and price for this plan, even if the
"yearly" toggle is on and even though the response carries a `cards.yearly` block. Rule for any paid plan: offer yearly only
when `price_yearly > 0`. (Free is the other plan with a 0 price and has no yearly choice either.)

## 4. The card's words

Use the server's text; do not hard-code any plan wording in the app.

* `tagline` — the line under the plan name.
* `cards.monthly`: `headline`, `description`, `included` (each a bold `title` and the `detail` sentence under it),
  `excluded` (greyed-out lines, may be empty), `best_for` ("Best for: …"), `cta` (the button), `badge` (top-edge label,
  may be null).
* Any field can be `null` or empty — hide that part. If a plan has no `cards`, fall back to `tagline` + `perks`.
* A title may contain `{mock}`, `{mock_s}`, `{practice}`, `{practice_s}` (the web fills them from the plan's counts). If
  you see them, replace with `features.mock_tests_per_month` / `features.practice_tests_per_month`; `_s` is "s" when the count
  is not 1, else empty. Today Essential's text has the numbers typed in, so this only matters if an admin uses them later.
* Counts: `mock_tests_per_month` and `practice_tests_per_month` are a number, `"unlimited"`, or (mock only) `"none"`.

## 5. Buying it

Unchanged: create the order against the plan's `plan_id` with `billing_cycle: "monthly"`; the price is `price_monthly`
(plus GST as for the other plans). After payment the user's `subscription_tier` is `"essential"`, so wherever the app maps
`subscription_tier` to a label, badge or colour, add Essential (a missing entry must fall back to the capitalised name, not
blank). Top-ups already work for it.

## 6. How to check

1. Signed in as a Free user, open Plans: Free, Essential (₹149, one monthly card, no yearly toggle option), Ultimate.
2. Essential's card shows the headline, six included points, "Best for" and the "Choose Essential" button from the server.
3. Buy it: the user becomes Essential and gets 1 mock + 15 practice tests; a Standard-only test still asks to upgrade.
4. Change the card text in the web admin (Admin → Plans → Edit Essential): the app shows the new text after a refresh —
   no release.
