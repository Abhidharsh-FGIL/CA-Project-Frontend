# App pre-login screen — admin setting

What the mobile app shows before sign-in. Edited in **Admin Settings → Site content → App pre-login screen**.

```
GET /api/v1/admin/app-config    (admin auth)
PUT /api/v1/admin/app-config    (admin auth) — replaces the whole document; every field is sent back, not only what changed
```

Body for both:

```json
{
  "tagline": "Practice · Prepare · Succeed",
  "tagline_ta": null,
  "exam_chips": [
    { "id": "group-4", "label": "TNPSC", "label_ta": null, "order": 1, "is_active": true }
  ],
  "highlights": [
    { "icon": "mock_tests", "title": "Full mock tests", "title_ta": null, "order": 1, "is_active": true }
  ],
  "login_title": "Welcome Back",
  "login_title_ta": null,
  "login_subtitle": "Enter your registered email ID to get a one-time password",
  "login_subtitle_ta": null
}
```

* With nothing saved, `GET` returns empty strings and empty lists — the form is shown empty, not as an error.
* `order` is the row's position in the form (1, 2, 3…), 0–999. A row with `is_active: false` is kept but hidden from the app.
* An empty Tamil box is sent as `null`. The server may also accept `""`.
* Unknown keys are rejected.

## Limits (the server answers 422; the form shows its message)

| Field | English | Tamil |
|---|---|---|
| `tagline` | ≤ 80 | ≤ 120 |
| `login_title` | ≤ 60 | ≤ 90 |
| `login_subtitle` | ≤ 160 | ≤ 240 |
| chip `label` | ≤ 40 | ≤ 60 |
| highlight `title` | ≤ 60 | ≤ 90 |

* chip `id`: lowercase slug (letters, digits, `-` or `_`), ≤ 64, unique in the list.
* highlight `icon`: lowercase slug ≤ 40; the form offers `mock_tests`, `practice`, `previous_papers`, `ai_reports`.
* At most 12 chips and 12 highlights.

Until the endpoint exists (404) the card says the server has no setting yet.
