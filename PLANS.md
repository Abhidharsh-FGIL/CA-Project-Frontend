# Plans

Three plans, each for a different stage of preparation. **The backend owns the plans** (`GET /api/v1/user/subscription/plans`) and the
portal now reads them from there. This document is what to set on the Admin → Plans
page to get these three, and what is and is not enforced. Nothing here is hardcoded
in the frontend.

| | **Free** | **Standard** | **Ultimate** |
|---|---|---|---|
| For | Seeing whether the method works on your syllabus | Steady daily preparation | The final stretch before the exam |
| Monthly | ₹0 | ₹199 | ₹499 |
| Yearly | ₹0 | ₹1,999 | ₹4,999 |
| Unit practice | 10 sets / month | Unlimited | Unlimited |
| Full mocks | 1 / month | 4 / month | Unlimited |
| Explanation on every answer | ✔ | ✔ | ✔ |
| Personalised study plan | ✔ | ✔ | ✔ |
| AI-written insights on reports | — | — | ✔ |
| Attempt history | 30 days | 6 months | Kept |
| Support | Community | Email | Priority email |

**Premium (₹999) is retired**, not deleted — see §4.

---

## 1. Why these three, and why these differences

**Price points are unchanged.** ₹199 and ₹499 (and ₹1,999 / ₹4,999 yearly) are what the
backend already charges, and there is no sales or conversion data here to justify
moving them. Treat them as the starting point to test, not as a finding. The yearly
prices are a 16% saving (≈ two months free), which the page already says.

**The plans differ where cost and value are highest, not where it is easiest to
withhold.**

- **Mocks are what an aspirant is really buying.** A Group 4 mock is a three-hour,
  200-question sitting, and the number they can take is the honest measure of how
  seriously they are preparing. So it is the main ladder: 1 → 4 → unlimited.
- **AI-written insights are the only feature with a per-use cost.** Each one is an
  LLM generation. Everything else on a report is computed deterministically and costs
  nothing to serve — so Free and Standard get the full deterministic report, and the
  AI wording is the Ultimate differentiator.
- **Explaining a wrong answer is deliberately *not* gated.** It is the reason a free
  user comes back, it costs nothing, and hiding it would make the free plan feel
  punitive rather than useful.
- **The study plan is free.** It is generated deterministically, so it is cheap, and a
  plan someone returns to every day is the strongest retention hook the product has.

**Free is deliberately generous in volume.** The earlier free plan allowed 2 practice
sets a month and no mocks. A Group 4 stage has 22 units with four difficulty buttons
each; two sets cannot touch even one unit's buttons, so the free plan could not show
what the other plans sell. Ten sets and one mock lets someone try a unit end to end
and see a full diagnostic report once — which is the experience that converts.

**What was removed from the old plans, and why.** A pricing page is a list of claims,
and these could not be kept:

| Removed | Why |
|---|---|
| "PDF download" (Standard+) | The aspirant report has no export — the handler only ever raised "coming soon" |
| "Priority mock access" (Premium) | Nothing in the app distinguishes a priority mock |
| "Dedicated support" (Premium) | Not deliverable at self-serve scale; no process behind it |
| A fourth tier at all | With Premium's real differences gone, it duplicated Ultimate for 67% more |

---

## 2. What to change on the Admin → Plans page

Tier names are a **closed set** in the admin API (`free | standard | ultimate |
premium`); a fifth cannot be created, which is why Premium is retired rather than
replaced. The live values below are what the backend returns today.

| Field | free | standard | ultimate | premium |
|---|---|---|---|---|
| `price_monthly` | 0 | 199 *(live)* | 499 *(live)* | — |
| `price_yearly` | 0 | 1999 *(live)* | 4999 *(live)* | — |
| `highlight` | false | false | **true** *(live)* | false |
| `active` | true | true | true | **false** *(live: true)* |

`features` — **bold is a change from what is live**:

| Key | free | standard | ultimate |
|---|---|---|---|
| `practice_tests_per_month` | **10** *(live 2)* | unlimited | unlimited |
| `mock_tests_per_month` | **1** *(live none)* | **4** *(live 3)* | unlimited |
| `ai_report_level` | basic | standard | detailed *(or `full`)* |
| `history_retention_days` | 30 | **180** *(live 90)* | **unlimited** *(live 365)* |
| `support` | community | email | priority email |
| `download_pdf` | false | **false** *(live false)* | false |

`perks` — replace with:

```json
// free
["10 unit practice sets a month", "1 full mock a month", "Every answer explained", "Personalised study plan"]
// standard
["Everything in Free", "Unlimited unit and section practice", "4 full mocks a month", "6-month attempt history"]
// ultimate
["Everything in Standard", "Unlimited full mocks", "AI-written insights on every report", "Your full attempt history, kept"]
```

**Premium's perks make three promises the product cannot keep** — "Priority mock tests",
"Full *downloadable* AI reports" (`download_pdf: true`, but the aspirant report has no
export) and "priority" support with nothing behind it. That is the reason to retire
it rather than leave it on sale.

**Check before deactivating Premium:** what does `toggle-active` do to people already
subscribed? It must leave them on the plan until expiry. If it downgrades or
suspends them, do not toggle — leave Premium active and hide it from sale another way.

The pricing page adapts on its own: it shows one column per *active* plan, so
deactivating Premium takes it from four columns to three with no code change, and a
holder sees a note that their plan is no longer sold.

---

## 3. What is enforced, and what is not

This is the section that matters. A plan is only a plan if the boundary holds.

| Line | Enforced today? | Where |
|---|---|---|
| Practice sets / month | **Client only** | `UserPortalContext` `canStart`, from `user.usage` |
| Full mocks / month | **Client only** | Same |
| AI-written insights | **Client only** | `ReportBody` no longer requests them below Ultimate |
| Attempt history | **No** — display text | Nothing purges or hides older attempts |
| Study plan | **No** — open to all | No tier check |
| Support | Operational | — |

"Client only" means a user who calls the API directly walks straight through. For two
of these that is not a theoretical concern:

- **AI insights are the costly one.** `POST /user/history/{id}/report-insights`
  generates for anyone who calls it. The frontend now stops asking below Ultimate, but
  the endpoint still answers. **It should return `403 PLAN_REQUIRED` unless the user's
  plan has `ai_report_level` of `detailed` or `full`.**
- **Monthly limits.** The start-test endpoint should reject past the limit with
  `403 PLAN_LIMIT_REACHED` and the limit and usage in the body, so the portal can show
  "you have used 1 of 1 mocks this month" rather than a generic error.

Behaviour change worth knowing: **Standard users no longer get AI-written report
wording**, which they previously did because nothing gated it. Reports they have
already opened keep theirs, since it is cached; new ones fall back to the
deterministic text, which is the designed fallback and renders in full.

---

## 4. Retiring Premium

Premium holders keep everything Premium promised until their subscription expires.

- An inactive plan is treated as retired (`legacy`) but stays resolvable through
  `getPlan`, so a Premium user's screens keep working. Removing it would crash
  everything that reads their plan.
- The pricing page does not offer it; a Premium holder sees a note saying their plan is
  no longer sold and stays active until expiry.
- On renewal they choose among the three. Ultimate is the like-for-like at a lower
  price, so expect this to read as a downgrade offer rather than a loss — worth a line
  in the renewal email.

---

## 5. What this exposed

**The pricing page was quoting prices the backend does not charge.** The portal read a
bundled file saying ₹299 / ₹599 while `GET /user/subscription/plans` returns ₹199 /
₹499. The endpoint existed; the frontend simply never called it. It now does, once
per session, and the bundled list survives only as an offline fallback that is held
to the live values by a test.

**Buying a plan is now real, through Razorpay.** The backend already had the whole
flow — `POST /user/payment/order`, `POST /user/payment/verify`,
`POST /user/promo/validate` and a `/webhooks/razorpay` endpoint — and the portal was
bypassing it with a local simulation (a 900 ms timer that set the tier in browser
state and charged nothing). It now uses them. See `PAYMENTS.md`.

---

## 6. What to add to Ultimate when it exists

These are the honest next differentiators. They are **not** on the pricing page
because they are not built, and a perk list should not run ahead of the product.

| Feature | Status | Spec |
|---|---|---|
| Adaptive study plan — re-tunes itself after each mock, rolls forward nightly | Not built | `STUDY_PLAN_BACKEND_CHANGES.md` §S7 |
| Calendar (ICS) feed and reminders | Not built | Same, §S4.10 |
| PDF report download | Not built | — |
| Progress report across all attempts | Built, not gated | Could gate to Ultimate |

Adaptive planning is the strongest of these: it is what a printed timetable cannot do,
it needs the server and so cannot be shared by copying a screenshot, and it grows more
valuable the closer the exam gets — which is exactly Ultimate's positioning.
