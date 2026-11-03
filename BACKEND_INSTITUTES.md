# Institutes — backend changes

## What the portal now does

1. **Admin → Institutes** (`#/org/institutes`): add an institute with its **name, contact number, email and password**; edit it; change its password; block or unblock it. Each institute has a details page (`#/org/institutes/{id}`) showing its details, its two addresses and its students.
2. **An address for each institute.** The institute's name gives it a **sign-in page**: `#/institute/{slug}`, for example `#/institute/sri-ram-academy`. It also gives a **student sign-up link**: `#/register?institute={slug}`.
3. **Institute sign-in.** The institute opens its page and signs in with the email and password the admin set. It then sees its own details and **only its own students**, each with their test history (mock and practice, scores, times, status).
4. **Students are tied to an institute** when they sign up from the institute's sign-up link.

Nothing the institute sees is decided by the page. **Every institute call must be limited by the institute in the token**, never by an id sent from the browser.

## 1. Data

**`institutes`**

| column | notes |
|---|---|
| `institute_id` | uuid, primary key |
| `name` | required, 2–120 characters |
| `slug` | unique, lowercase `a-z0-9-`, made from the name (below). Never changes after creation, even if the name is edited, so printed links keep working |
| `contact_number` | 10-digit Indian mobile, stored without spaces. The portal sends it already cleaned |
| `email` | unique (case-insensitive), stored lowercase. The institute's sign-in email |
| `password_hash` | same hashing as admin and student passwords. Never returned by any endpoint |
| `is_active` | default true. A blocked institute cannot sign in, and its tokens stop working |
| `created_at`, `updated_at` | |

**`users.institute_id`**: nullable foreign key to `institutes`, indexed. Null for every student who did not come from an institute.

**Slug.** Lowercase the name, drop accents, turn every run of characters outside `a-z0-9` into one `-`, trim `-`, cut to 60 characters. If it is taken, add `-2`, `-3`. Refuse a slug that is empty (a name with no usable letters, e.g. only Tamil): ask for a name with Latin letters, or fall back to `institute-{short id}`. Also refuse reserved words (`admin`, `login`, `api`, `user`, `org`, `institute`).

## 2. Admin endpoints (admin token, super admin)

`/api/v1/admin/institutes`

| call | body / query | reply |
|---|---|---|
| `GET /` | `search` (name, email, contact number), `page`, `limit` | `{ items, total, page, limit, pages }` of **Institute** |
| `POST /` | `{ name, contact_number, email, password }` | the new **Institute** (201). 409 if the email is already an institute's, with a readable message |
| `GET /{institute_id}` | | **Institute**, 404 if unknown |
| `PATCH /{institute_id}` | any of `{ name, contact_number, email, is_active }` | the updated **Institute**. Does not change `slug`. Blocking an institute ends its sessions |
| `POST /{institute_id}/reset-password` | `{ password }` | `{ message }`. Ends the institute's existing sessions |

**Institute** (reply shape): `{ institute_id, name, slug, contact_number, email, is_active, created_at, student_count }`. `student_count` = users with that `institute_id`.

Password rule for create and reset: the same rule as everywhere else (8+ characters, 1 uppercase, 1 number, 1 special character). The portal checks it first; the server must check it too.

Write each create, edit, block and password change to the **audit log**.

## 3. Institute authentication

`/api/v1/institute/auth`

- `POST /login` `{ slug, email, password }` → `{ access_token, refresh_token, token_type, institute }` where `institute` is the **Institute** shape above.
  - Look the institute up by `slug`, then check that `email` is that institute's and the password matches. **One institute's email and password must never open another's page.**
  - Give the same answer (401, "These details do not match this institute") for an unknown slug, a wrong email and a wrong password, so nothing can be guessed.
  - A blocked institute gets 403 with a clear message.
  - Rate-limit per IP and per slug, as for the other logins.
- `POST /refresh` `{ refresh_token }` → new `{ access_token, refresh_token }`.
- `POST /logout` `{ refresh_token }`.

The token's role is `institute` and it carries the `institute_id`. **An institute token must be refused by every admin and student endpoint, and admin and student tokens must be refused here.**

## 4. Institute endpoints (institute token)

`/api/v1/institute`

- `GET /me` → **Institute** (the one in the token).
- `GET /history/users?search=&page=&limit=` → `PaginatedResponse<HistoryUser>`: exactly the shape of `GET /admin/history/users`, but **only users whose `institute_id` is the token's**. `search` matches name and email.
- `GET /history/users/{user_id}[?mode=mock|practice]` → `HistoryUserDetail`, same shape as the admin one. **404 (not 403) when that user is not in the institute**, so ids cannot be probed.

Add **`subscription_expiry`** (ISO date-time, null for a free plan) next to `subscription_tier` in both `HistoryUser` rows (list and detail); the institute list shows each student's plan and when it ends.

Also add **`mock_available`** and **`practice_available`** (integers) to the same rows: how many mock and how many practice tests the student's current plan gives access to. The institute list shows them as "attended / available" (e.g. `2 / 10`). Leave them out (or null) to show attended only.

The portal does not use `promo_codes_used` or `promo_redemptions` in this view, so those may be left empty here. Do not send anything else about a student (payments, notes, answers).

- `GET /history/attempts/{attempt_id}` → **one attempt's full report**, in exactly the shape the student's own report reads from `GET /api/v1/user/history/{attempt_id}` (the attempt, its questions with the student's answers and the correct ones, subject and unit breakdown, timings). It must serve **every finished attempt of an institute's student, whether it came from a test or from an assessment** (the History list marks which, but the portal opens both the same way). **404 when the attempt's user is not in the institute**, and for an attempt still in progress. The institute portal shows it on the page only (no copy, no PDF, no download), so it needs no download endpoint.

## 5. Tying a student to an institute

- `POST /api/v1/user/auth/register` accepts an optional `institute_slug`. If it names an active institute, set the new user's `institute_id`. **A slug that is unknown or blocked must not stop the sign-up**: ignore it, as is done for a wrong referral link.
- `POST /api/v1/user/auth/google` accepts `institute_slug` too, at the top level of the body, and uses it **only when it creates a new account** (the call that carries `profile`). An existing student signing in is never moved to an institute.
- Once set, `institute_id` is changed only by an admin (below). A student cannot change it.

## 6. Admin side of the same data

- `GET /api/v1/admin/history/users` accepts `institute_id` and returns only that institute's students. The institute details page in the admin portal uses this.
- Optional but useful: add `institute_id` and `institute_name` to the admin `GET /admin/users` rows and let `PATCH /admin/users/{user_id}` take `{ institute_id }` (null to untie), so an admin can tie students who signed up before the institute existed, or by another route. The portal does not show this yet.

## 7. Checks to run

1. Create two institutes, A and B. Sign up one student from A's link and one from B's link.
2. Sign in as A: the list shows only A's student. Open B's student by id from A's token: **404**.
3. Sign in on B's page with A's email and password: **401**.
4. Block A: A's login gives 403, and A's existing token stops working.
5. Use A's token on an admin endpoint and on a student endpoint: both refused.
6. Sign up with an unknown `institute_slug`: the account is created with no institute.
7. Edit A's name: A's `slug` and its links are unchanged.

## 8. Release

The portal can be deployed before the backend: the Institutes page then shows its error message, and a sign-up sends the extra `institute_slug` field only when it came from an institute link. If the server rejects unknown fields (422), accept `institute_slug` before any institute link is handed out.
