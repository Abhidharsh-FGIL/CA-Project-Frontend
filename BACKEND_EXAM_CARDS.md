# Exam cards — the Exams page, managed by the admin

The admin screen (**Admin → Exams**) and the Exams page are built. **Nothing is saved until the server has these
endpoints.** Until then the page shows its built-in cards, and the admin screen says the server has no exam-card setting yet.

## 1. What this adds

A *card* is how an exam looks on the Exams page: name, conducting body, subtitle, description, emblem (logo), colour,
languages, and where it sits in the row. It is **not** the exam — stages, subjects and papers still come from
`GET /api/v1/user/tnpsc/catalog`, and whether an exam is open is still the Active switch (`/admin/exams`, below).

| Card for…                         | How it is told apart                | On the page |
|-----------------------------------|-------------------------------------|-------------|
| An exam the catalog has           | its `id` is a catalog exam id       | Open or "Coming soon" by its Active switch; stages and subjects from the catalog; the card's text, emblem, colour and languages on top |
| An exam announced but not built   | its `id` is **not** in the catalog  | Always greyed, "Coming soon"; shows the card's own `subjects`; cannot be switched Active |

What was hard-coded in the frontend (`UPCOMING_EXAMS`, the logo per exam, the colour per exam, the language strip) is now
data. The frontend keeps the old values as the fallback when the list is empty or the endpoint is missing.

## 2. Endpoints

### Admin

```
GET  /api/v1/admin/exam-cards
PUT  /api/v1/admin/exam-cards
POST /api/v1/admin/exam-cards/logo        (multipart)
```

`GET` and the `PUT` body share one shape:

```json
{
  "items": [
    {
      "id": "rrb-ntpc-cbt-1-grad",
      "name": "RRB NTPC CBT-1 (Graduate)",
      "authority": "Railway Recruitment Boards (RRB)",
      "tagline": "Non-Technical Popular Categories — First-stage CBT · Graduate posts",
      "description": "First-stage computer-based test …",
      "logo_url": "https://…/exam-logos/3f9c1e.png",
      "tone": "violet",
      "languages": ["tamil", "english", "hindi"],
      "subjects": [],
      "order": 1
    },
    {
      "id": "rrb-group-d",
      "name": "RRB Group D",
      "authority": "Railway Recruitment Boards (RRB)",
      "tagline": "Expected 2027",
      "description": null,
      "logo_url": null,
      "tone": null,
      "languages": null,
      "subjects": ["Mathematics", "General Intelligence & Reasoning", "General Science", "General Awareness"],
      "order": 2
    }
  ]
}
```

* **`PUT` replaces the whole list** (like `/admin/app-config`). A card absent from the body is deleted; the frontend sends
  every card every time. `order` is each card's position (1, 2, 3 …) — return `items` sorted by it.
* `GET` with nothing saved answers `{ "items": [] }` (not 404). An empty list means "use the built-in page".
* **No extra keys** in a PUT body → 422.
* Return a **422 with a readable `detail`/`message`** on any limit below; the screen shows it.

| Field         | Type                     | Rules |
|---------------|--------------------------|-------|
| `id`          | string, required         | `^[a-z0-9][a-z0-9_-]*$`, ≤ 64, unique in the list. For a catalog exam it **must equal the catalog's exam id** (`group-4`, `rrb-ntpc-cbt-1-grad`, …) |
| `name`        | string, required         | ≤ 80 |
| `authority`   | string \| null           | ≤ 100. Required for a card that is not a catalog exam |
| `tagline`     | string \| null           | ≤ 120 |
| `description` | string \| null           | ≤ 400 |
| `logo_url`    | string \| null           | ≤ 500; an address returned by the logo upload (or any http(s) URL). `null` = the built-in emblem |
| `tone`        | string \| null           | one of `blue`, `teal`, `violet`, `indigo`, `amber`, `rose`. `null` = the exam's own colour |
| `languages`   | string[] \| null         | any of `tamil`, `english`, `hindi`, no repeats. `null` = the built-in list; `[]` = show none |
| `subjects`    | string[]                 | ≤ 20 items, each ≤ 80. Used only for a card that is not a catalog exam; ignored (but stored) otherwise |
| `order`       | integer                  | 1-based position; ≤ 60 cards in the list |

Where a catalog exam's card has `name`, `authority`, `tagline` or `description` set, the frontend shows the card's text
over the catalog's; `null`/blank leaves the catalog's text.

### Logo upload

```
POST /api/v1/admin/exam-cards/logo     Content-Type: multipart/form-data, field "file"
→ 200 { "logo_url": "https://…/exam-logos/3f9c1e.png" }
```

* Accept PNG, JPEG, WebP, SVG; **≤ 1 MB**. Judge the type by the file's content, not its name or declared type.
* **SVG:** either refuse it or sanitise it (strip `<script>`, event handlers, external references) — it is shown in an
  `<img>` on every aspirant's page, and opened directly by the admin.
* Store under a generated name; do not trust the uploaded one. Serve it publicly (the aspirant app loads it with a plain
  `<img src>`, no auth header) with long-lived cache headers, from an origin the site's CSP allows for images.
* The upload does not attach the image to a card: the admin screen puts the returned `logo_url` on the card and saves the
  list. An image no card uses any more may be cleaned up later.
* 413/422 with a message for a wrong type or a too-big file; the screen shows it.

### Aspirant — read

```
GET /api/v1/user/exam-cards
```

The same body as the admin `GET` (the same `items`, in order). Needs a signed-in aspirant, like `/user/exams/availability`.
The frontend keeps it 5 minutes. An empty `items` is fine.

## 3. Keep the Active switch where it is

Opening an exam is **unchanged**: `PATCH /api/v1/admin/exams/:exam_id { is_open }` and
`GET /api/v1/user/exams/availability`. The cards do not carry an open flag — there is one source of truth for "open".
For a card that is not a catalog exam, the screen disables the switch; if a PATCH for an unknown exam does arrive, answer
404/422.

## 4. What a *new real exam* needs (beyond a card)

A card makes an exam *appear*. To let aspirants actually sit it, the exam also needs, as RRB NTPC and GAT-B did:

1. An entry in `GET /api/v1/user/tnpsc/catalog` (group → stages → subjects → topics, `pattern`) and in
   `GET /api/v1/admin/exams` (so it can be switched Active), with the same `id` as the card.
2. Papers tagged with `tnpsc_group_id` = that id, and its syllabus at `GET /syllabus/{exam}`.

Then, in the admin: **Add exam** with that id → the card is the exam's, and its Active switch works.

> **Known gap (frontend, not backend):** the admin's other pickers — Create Assessment, taxonomy, coverage, pass marks — still
> read the exam list built into the app. A new exam shows on the Exams page from this work, but it appears in those
> pickers only once the pickers read the server catalog. That is a follow-up on the frontend.

## 5. Suggested storage

One table `exam_cards(id PK, name, authority, tagline, description, logo_url, tone, languages JSON, subjects JSON,
position INT)`, replaced in a single transaction on `PUT`. A logo store (object storage or `/uploads`) for the images.
