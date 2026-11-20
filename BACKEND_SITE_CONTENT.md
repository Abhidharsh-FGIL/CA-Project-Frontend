# Site text set by the admin (landing page and every aspirant screen)

Extends `BACKEND_LANDING_SETTINGS.md` (the "Live exams" list stays as it is). The portal's headings, paragraphs, labels,
empty states and so on are now **fields**, each with a key and a built-in text. An admin edits them under **Admin Settings →
Site content**. **Nothing is saved until the server has these endpoints.** Until then every screen shows its built-in text,
and the admin screen says the server has no setting yet.

## Endpoints

```
GET /api/v1/public/site-content     (no auth — the landing, sign-in and register pages are public; cacheable, 5 min)
GET /api/v1/admin/site-content      (admin auth)
PUT /api/v1/admin/site-content      (admin auth)
```

Body, for all three — only the keys the admin changed:

```json
{
  "content": {
    "landing.hero.lead": "Prepare smarter with …",
    "landing.cta.join": "Join {students} aspirants preparing for {exams} with MyGovExams."
  }
}
```

* A flat map of **key → text**. Keys are `area.section.name` (`[a-z0-9._-]`, up to 120 characters). **Do not validate keys
  against a list** — the frontend adds fields over time; store whatever arrives.
* `PUT` replaces the whole map. A key that is absent follows the built-in text. Trim values; an empty string is the same as
  absent. Limit a value to 4,000 characters and the map to 2,000 keys (422 beyond that).
* `GET` with nothing saved: `{ "content": {} }`.
* Text is plain. `{name}` placeholders are filled in by the frontend (leave them alone); `*word*` marks emphasis in headings;
  a line break is a line break. The frontend renders it as text, never HTML — but do not strip `*`, `{`, `}` or newlines.
* Admin audit log: record who changed which keys, as for other settings.
