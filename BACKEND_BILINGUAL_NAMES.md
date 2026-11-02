# Names in both languages, from the uploaded sheets — backend change

## Why

The student portal shows every unit, category, sub-category and key topic as **"English / தமிழ்"**, for example
*Physics / இயற்பியல்* or *Grammar / இலக்கணம்*.

The Tamil name should come from the sheet that was uploaded, like the English one does. Today it does not:

- the sheet has no Tamil name column. It carries `Subject`, `Topic` (stored as `chapter`), `Subtopic`, `Difficulty`
  and, on bilingual sheets, one row per question per language;
- the official list (`GET /api/v1/syllabus/{exam}/{stage}` and the Topic Names tree) is built from those sheets, and
  it has one `name` per unit, category and sub-category;
- so the portal falls back to a short built-in list of about 230 pairs (`src/lib/bilingual.ts`). A category that is
  not in that list shows in one language only, and that list will always fall behind the sheets.

## What to change

0. **No re-upload.** The sheets are already uploaded and will not be uploaded again. Fill the Tamil names for the
   questions already stored. Use what each stored question holds: its Tamil row (`translations.ta`), and its Tamil
   `Topic` / `Subtopic` where the sheet had one. Where nothing stored carries a Tamil name, leave it empty and let an
   admin set it (item 4). Do not guess.
1. **Read the Tamil name from the sheet (for sheets uploaded from now on).** Two ways. Support the first, and the second where it applies:
   - **Columns.** Optional `Category (Tamil)`, `Subtopic (Tamil)` and `Unit (Tamil)` columns next to the existing
     ones. Where the sheet gives the English name only, the Tamil is left empty, not guessed.
   - **Bilingual sheets.** A sheet with one row per question per language already has the Tamil row for each
     question. When that row's `Topic`/`Subtopic` is in Tamil, store it as the Tamil name of the category/sub-category
     its English row names.
2. **Store both names on every unit, category and sub-category** of the official list: `name_en` and `name_ta`, next
   to `name`. Keep a Tamil name that is already stored when a later sheet leaves the column empty.
3. **Return them.** On `GET /api/v1/syllabus/{exam}/{stage}` and on the Topic Names tree
   (`GET /api/v1/admin/taxonomy`), for units, categories and sub-categories. On the tests list, send the pair for the
   topic and unit a test is about (`topic_name_ta`, `unit_name_ta`). In the attempt report, send `category_ta` and
   `subtopic_ta` per question.
4. **Let the admin fix one.** The Topic Names `rename` action should accept `name_ta` / `name_en`, so a wrong
   translation is corrected without a re-upload. Log it and allow undo, like the other changes.

## Frontend (done)

- Every student screen shows both names. The pair comes from the server first and from the built-in list second.
- The syllabus response is read for `name_ta` / `name_en` on units, categories and sub-categories. Every pair in it
  replaces the built-in one wherever that name is shown.
- Nothing sent to the server or used for matching changes; only the displayed text does.
