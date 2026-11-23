# Essential plan — a new tier, and plan card text editable from the admin

The admin (**Admin → Subscription Plans**) can now add a plan for a tier the server doesn't have yet, and edit the words on
each plan's pricing card. The first new plan is **Essential** (₹149 / month). The frontend is done; it needs the backend below.

## 1. A new tier: `essential`

The tier ladder becomes `free < essential < standard < ultimate < premium`.

* Add `essential` wherever the tier is an enum or validated list: the plan `name`, a user's `subscription_tier`, a test's
  `required_tier`, a promo code's `applies_to_tiers`, the subscription-distribution report, and any CSV/export filter by tier.
* "Does this user's plan cover this test" compares positions on that ladder, so `essential` ranks **above Free and below
  Standard**. Please confirm nothing compares tier names alphabetically or by hard-coded list of four.
* Users already on Free / Standard / Ultimate / Premium are unaffected.

## 2. Create a plan — `POST /api/v1/admin/plans/`

Body (the same fields as the existing `PATCH /admin/plans/{tier}`, plus `name`):

```json
{
  "name": "essential",
  "price_monthly": 149,
  "price_yearly": 0,
  "duration_days_monthly": 30,
  "duration_days_yearly": 365,
  "highlight": false,
  "active": true,
  "perks": ["1 full-length mock test", "15 subject-wise practice tests", "Detailed performance reports"],
  "tagline": "Start small. Practise smart. Improve every day.",
  "features": {
    "mock_tests_per_month": 1,
    "practice_tests_per_month": 15,
    "ai_report_level": "standard",
    "history_retention_days": 90,
    "download_pdf": false,
    "support": "Email"
  },
  "cards": { "monthly": { "…": "see §3" }, "yearly": null }
}
```

* Returns the created plan (`PlanOut`, with a `plan_id`). `409`/`422` with a readable `detail` if a plan for that tier exists.
* **`price_yearly: 0` means "no yearly option"**, so the pricing page shows the monthly card even with the yearly toggle on.
  Don't reject a paid plan with a yearly price of 0.
* Seeding it yourself (migration) is fine too — the admin then simply edits it. The "Add plan" button only appears for a tier
  the list doesn't contain.
* It must then appear in `GET /api/v1/user/subscription/plans` and be purchasable through the normal order flow, with
  the order's price taken from `price_monthly`.

## 3. Card text — `cards` and `tagline` on a plan

Both are returned by `GET /admin/plans/` and `GET /user/subscription/plans`, accepted on `POST` and `PATCH /admin/plans/{tier}`:

```json
"tagline": "Start small. Practise smart. Improve every day.",
"cards": {
  "monthly": {
    "headline": "Start Small. Practise Smart. Improve Every Day.",
    "description": "An affordable way to begin your government exam preparation with regular practice and detailed performance insights.",
    "included": [
      { "title": "{mock} Full-Length Mock Test{mock_s}", "detail": "Evaluate your exam readiness with a timed test following the relevant examination pattern." },
      { "title": "{practice} Subject-wise Practice Test{practice_s}", "detail": "Strengthen your understanding of important subjects." },
      { "title": "Detailed Performance Reports", "detail": "Access comprehensive insights into your scores, accuracy and subject-wise performance." }
    ],
    "excluded": [],
    "best_for": "Beginners and budget-conscious aspirants who want to start practising, evaluate their preparation and improve consistently.",
    "cta": "Choose Essential",
    "badge": null
  },
  "yearly": null
}
```

* Any field may be `null`. `cards`, or one of `monthly` / `yearly`, may be `null` — the pricing page then uses its built-in wording.
* **`PATCH` semantics:** a `cards` or `tagline` key that is present replaces what is stored (`null` clears it); a key that is
  absent leaves it alone. Same for the whole `cards` object — it is replaced, not merged.
* **Do not substitute the `{…}` placeholders.** `{mock}`, `{mock_s}`, `{practice}`, `{practice_s}` are filled by the
  frontend from the plan's own counts, so a change to a limit changes the card. Store and return them as written.
* Limits (return `422` with a readable message): tagline ≤ 120; headline ≤ 120; description ≤ 300; `included` ≤ 12 points,
  title ≤ 80, detail ≤ 200; `excluded` ≤ 8 lines, each ≤ 120; `best_for` ≤ 200; `cta` ≤ 40; `badge` ≤ 60.
* Plain text only — the frontend renders it as text, but please strip or refuse HTML anyway.

## 4. Promo codes and reports

* `applies_to_tiers` on a promo code must accept `essential` (the admin's promo form now offers it).
* The subscription-distribution dashboard endpoint should include `essential` rows.

## 5. How to check

1. **Admin → Subscription Plans** → "Add essential plan" → the form opens pre-filled (₹149, 1 mock, 15 practice, card text).
   Save → the plan appears in the table; reload → still there.
2. Edit its card text, save; open the pricing page (signed in and the public landing page): the new words show, with
   "1 Full-Length Mock Test" and "15 Subject-wise Practice Tests" taken from the limits.
3. Change the mock limit to 2 in the admin: the card now reads "2 Full-Length Mock Tests".
4. Buy it as a Free user: the order is ₹149 (plus GST per the existing rules), the user's tier becomes `essential`, and
   they get 1 mock + 15 practice tests; a Standard-only test still says "upgrade".
