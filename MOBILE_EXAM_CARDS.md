# Exam cards in the mobile app

The web Exams page now takes its cards from the admin (Admin → Exams). The mobile app's exam list should do the same, so
an exam added, re-ordered, re-worded or given a new logo in the admin shows up in the app with no app release.

The endpoints already exist (they are the ones the web uses). Nothing new is needed from the backend.

## 1. What to call

| Purpose | Request | Notes |
|---|---|---|
| The cards, in order | `GET /api/v1/user/exam-cards` | Signed-in user's bearer token. Cache ~5 min. |
| Which exams are open | `GET /api/v1/user/exams/availability` → `{ "open_exam_ids": [...] }` | Cache ~1 min. |
| Stages, subjects, patterns | `GET /api/v1/user/tnpsc/catalog` | Already used by the app. |

`/user/exam-cards` answers:

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
    }
  ]
}
```

Any of `authority`, `tagline`, `description`, `logo_url`, `tone`, `languages` can be `null`.

## 2. How to build the list

1. **Empty `items`, or the call fails → show the app's existing built-in list.** Never show a blank screen.
2. Otherwise, **the list is `items` in the order given** (sorted by `order`). One card each.
3. For each card, look its `id` up in the catalog:
   * **In the catalog → a real exam.**
     * *Open* if its id is in `open_exam_ids`; the card is tappable and goes into the exam.
     * *Coming soon* if not: greyed, not tappable, with a "Coming soon" tag.
     * Stages, subject chips, "N stages · M open" and negative marking still come from the catalog, as today.
     * Where the card has `name`, `authority`, `tagline` or `description`, **show the card's text instead of the
       catalog's**. `null` or empty means keep the catalog's.
   * **Not in the catalog → an announced exam.** Always greyed, "Coming soon", never tappable. Show the card's own `subjects`
     as the subject chips (the catalog has none).
4. **A catalog exam that has no card** still shows — after the cards, in catalog order, in its normal state — so a new exam
   on the server never disappears for want of a card.
5. Do not re-add an announced exam that isn't in `items`; the admin removed it on purpose.

## 3. Fields

| Field | Use |
|---|---|
| `name` | Card title (and the exam's display name wherever the app shows it) |
| `authority` | Small caps line above the title, in the card's colour |
| `tagline` | Grey line under the title |
| `description` | Body text, ≤ 3 lines |
| `logo_url` | The emblem in the card's top-right badge. `null` → the app's built-in emblem for that exam (Railways logo for `rrb-ntpc-*`, TNPSC logo for the rest). Show it **on Coming-soon cards too**, greyscale. Load with a plain image request — no auth header. Use it as given; if it is not an absolute URL, resolve it against the API base. |
| `tone` | The card's colour (below). `null` → the exam's default colour (below). |
| `languages` | The "Available in" strip. `null` → built-in list; `[]` → show no strip. Write each in its own script (below). |
| `subjects` | Chips, for announced exams only |

### Colours (`tone`)

| tone | Hex (accent bar, eyebrow text, badge tint) |
|---|---|
| `blue` | `#3b82f6` |
| `teal` | `#14b8a6` |
| `violet` | `#8b5cf6` |
| `indigo` | `#6366f1` |
| `amber` | `#f59e0b` |
| `rose` | `#f43f5e` |

Default colour when `tone` is `null`: `group-1` blue · `group-2` indigo · `group-4` teal · `gat-b` violet ·
`rrb-ntpc-cbt-1` amber · `rrb-ntpc-cbt-1-grad` violet · `rrb-ntpc-cbt-2` rose · any other id: cycle
blue, teal, violet, amber, rose by position. A Coming-soon card is grey whatever its tone.

### Languages

`tamil` → தமிழ் · `english` → English · `hindi` → हिन्दी. Built-in when `null`: `rrb-ntpc-*` → all three;
`group-<n>` → Tamil and English; anything else → none.

## 4. Exam ids — three things to know

* The web treats RRB NTPC as separate exams: `rrb-ntpc-cbt-1` (UG), `rrb-ntpc-cbt-1-grad` (Graduate), `rrb-ntpc-cbt-2`.
  The server's catalog also carries one combined group `rrb-ntpc`; **ignore that one** — it is not a card.
* The availability list may use older spellings. Map them before comparing: `ntpc-cbt-1` / `rrb-ntpc-cbt-1` →
  `rrb-ntpc-cbt-1`; `ntpc-cbt-2` / `rrb-ntpc-cbt-2` → `rrb-ntpc-cbt-2`; `rrb-ntpc` → both `rrb-ntpc-cbt-1` and
  `rrb-ntpc-cbt-2`. (`rrb-ntpc-cbt-1-grad` is spelled the same everywhere.)
* Card `id`s are the same ids, so compare after the same mapping.

## 5. Behaviour to keep

* Opening an exam is still decided only by `open_exam_ids`. A card never opens an exam by itself.
* The exam's header (stage list, test list) should use the same `logo_url` as its card, when there is one.
* Refresh the cards when the Exams screen is shown if the cache is older than 5 minutes; a pull-to-refresh should force it.

## 6. How to check it

1. In the web admin (Admin → Exams) change a card's name, upload a logo, move it to first, add an announced exam.
2. Pull-to-refresh the app's exams: new order, new name and logo, the announced exam greyed with its subjects.
3. Switch an exam Active/off in the admin: it opens/greys in the app within a minute.
4. With the network off: the built-in list shows.
