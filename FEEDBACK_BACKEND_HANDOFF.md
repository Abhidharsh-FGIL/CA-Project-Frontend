# Feedback — backend handoff

Students send feedback from the user portal (**Profile menu → Feedback**, `/user/feedback`). Admins read it in
**Admin → Feedback** (`/org/feedback`). The frontend is built against the contract below; nothing exists on the
backend yet, so these endpoints are new. All under `/api/v1`. Errors use the usual `detail: { code, message }`.

## Table `feedback`

| column | type | notes |
|---|---|---|
| `feedback_id` | uuid, pk | |
| `user_id` | fk → users | |
| `rating` | smallint | 1–5, check constraint |
| `category` | text | `general` \| `bug` \| `suggestion` \| `content` \| `payment` |
| `message` | text | trimmed, 5–1000 characters |
| `page` | text, null | the screen the student was on (max 200 chars) |
| `status` | text | `new` (default) \| `reviewed` \| `resolved` |
| `created_at` | timestamptz | default now() |
| `updated_at` | timestamptz | |

Index on `(created_at desc)`, `(user_id)`, `(status)`.

## Student endpoints (user token)

### `POST /user/feedback`
Body: `{ "rating": 4, "category": "bug", "message": "…", "page": "/user/feedback" }`
Reply `201`: the saved row, as `MyFeedback` below. Validation failure → `422` with a readable `message`.
Limit it to about 10 per user per day (`429`, code `FEEDBACK_RATE_LIMITED`, "You have sent a lot of feedback today. Please try again tomorrow.").

### `GET /user/feedback?page=1&limit=20`
This user's own feedback only, newest first.
```json
{ "items": [ { "feedback_id": "…", "rating": 4, "category": "bug", "message": "…", "status": "new", "created_at": "2026-11-03T10:42:00Z" } ],
  "total": 1, "page": 1, "limit": 20, "pages": 1 }
```

## Admin endpoints (admin token)

Filters, the same on all three GETs (all optional): `date_from`, `date_to` (`YYYY-MM-DD`, read in IST, both ends
included), `rating` (1–5), `category`, `status`, `search` (case-insensitive match on the message, the student's
name, email or mobile).

### `GET /admin/feedback?<filters>&page=1&limit=50`
Newest first. `limit` up to 500.
```json
{ "items": [ {
    "feedback_id": "…", "user_id": "…", "name": "…", "email": "…", "mobile": "…",
    "rating": 2, "category": "bug", "message": "…", "page": "/user/history",
    "status": "new", "created_at": "2026-11-03T10:42:00Z",
    "created_at_ist": "03 Nov 2026, 04:12 PM"
  } ], "total": 1, "page": 1, "limit": 50, "pages": 1 }
```

### `GET /admin/feedback/summary?<filters>`
For the tiles and the star bars. Computed over everything the filters match (not one page).
```json
{ "total": 120, "average_rating": 4.2, "new_count": 17, "by_rating": { "1": 3, "2": 5, "3": 10, "4": 40, "5": 62 } }
```
`average_rating` is `null` when `total` is 0. Always include all five keys in `by_rating`.

### `PATCH /admin/feedback/{feedback_id}`
Body: `{ "status": "reviewed" }` (`new` \| `reviewed` \| `resolved`). Reply: the updated admin row. Unknown id → `404`.
Write an audit-log entry, as for other admin changes.

### `GET /admin/feedback/export?<filters>`
Excel file, `Content-Disposition: attachment; filename="feedback_<IST date>.xlsx"`. Same filters, no paging.
Columns: Date (IST), Name, Email, Mobile, Rating, About, Message, Status, Screen.
Refuse more than 50,000 rows with `422` `EXPORT_TOO_LARGE` and message "Too many rows to export. Narrow the filters."
(the same rule as the attempts report).

## Optional, if cheap

- Notify the admin team on a 1–2 star rating or a `bug` (email or the existing notification channel).
- Do not send the student's email or mobile anywhere other than the admin endpoints.
