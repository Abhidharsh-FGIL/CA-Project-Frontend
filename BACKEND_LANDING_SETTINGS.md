# Landing page "Live exams" text, set by the admin

The landing page's hero chip ("● LIVE — TNPSC Group 4 & 2 / RRB NTPC CBT-1 (UG & Graduate)"), its "Currently Available"
banner and the closing call to action read one list of exam names. The admin edits it under **Admin Settings → Landing
page** (a text box, one exam a line). **Nothing is saved until the server has these endpoints.** Until then the portal
shows its built-in list (`TNPSC Group 4 & 2`, `RRB NTPC CBT-1 (UG & Graduate)`), and the admin form says the server has no
setting yet.

## Endpoints

```
GET /api/v1/public/landing-settings     (no auth — the landing page is public; cacheable, the frontend keeps it 5 min)
GET /api/v1/admin/landing-settings      (admin auth)
PUT /api/v1/admin/landing-settings      (admin auth)
```

Body, for all three:

```json
{ "live_exams": ["TNPSC Group 4 & 2", "RRB NTPC CBT-1 (UG & Graduate)"] }
```

* `PUT` replaces the list. Trim each name, drop blanks and repeats; reject more than 4 names or a name over 60 characters
  with 422.
* `GET` with nothing saved: return `{ "live_exams": [] }` (or 404) — the frontend then shows its built-in list.
* The frontend also accepts `live_exams` as a newline-separated string.
* Names are plain text; the frontend renders them as text, never HTML.
