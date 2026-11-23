# Questions and options with text AND an image

Until now the admin's *Add Question* form forced a choice: a question (or an option) was **either** typed text **or** an
uploaded image. The form now allows **both at once** — e.g. an option "Figure A" with its diagram, or a question stem with a
figure under it. The frontend is done; it needs the backend to accept, store and return both.

The wire format does not change — the fields already exist. What changes is that **both may now be non-null together**.

## 1. Create — `POST /api/v1/evaluation/questions`

```json
{
  "org_id": "…",
  "subject": "…", "chapter": "…", "category": "…", "difficulty": "medium",
  "question_text": "Which figure completes the series?",
  "question_image_url": "/static/questions/72613f97.png",
  "options": [
    { "text": "Figure A", "image_url": "/static/questions/a1.png" },
    { "text": null,       "image_url": "/static/questions/b2.png" },
    { "text": "None of these", "image_url": null },
    { "text": "Figure D", "image_url": "/static/questions/d4.png" }
  ],
  "correct_index": 0,
  "marks": 1.0,
  "explanation": "…"
}
```

Please check the validation, because a rule that was true before may now reject valid input:

* **Remove any "exactly one of text / image" rule** on the question and on each option. Text only, image only, and both must
  all be accepted.
* **Keep this rule:** each question needs `question_text` **or** `question_image_url` (at least one); each option may have
  `text`, `image_url`, or both; at least 2 options must have one of the two; the option at `correct_index` must have one.
* Store both. Do **not** merge them into one string, and do not drop one when the other is present. (Old rows may hold the
  literal text `{'text': None, 'image_url': '/static/…'}` in one field — the frontend still reads those, but new rows should
  use the separate fields.)
* Image upload is unchanged: `POST /api/v1/evaluation/questions/upload-image` → `{ url, name }` (≤ 5 MB; JPEG, PNG, WebP, GIF).

## 2. Return both everywhere a question is read

Wherever a question or its options come back, return **both fields as stored** — not "image if there is one, else text":

| Read | Question | Options |
|---|---|---|
| `GET /api/v1/evaluation/questions` (question bank) and the paper's question list | `question_text` / `text`, **and** `question_image_url` (or `attachment_url`) | `[{ text, image_url }]` |
| The question detail / paper detail used by the admin | same | same |
| The aspirant's test: `GET /api/v1/user/eval-assessments/{id}` and the questions it lists | same | same |
| Attempt review / report (`ApiAttempt` question rows: your answer, the correct answer) | same | `text` **and** `image_url` on each option, on "your answer" and on "correct answer" |
| Assessments built from the bank (the question copy taken when an assessment is created) | copied **with both** | copied **with both** |

The frontend reads the question's picture from `attachment_url` first, then `question_image_url`; send whichever you use
consistently. Translations (`translation.options`, etc.), where they exist, keep the same `{text, image_url}` shape.

## 3. Update — `PATCH /api/v1/evaluation/questions/{id}`

The admin's Edit dialog already sends `options: [{ text, image_url }]` with both and `correct_index`. Make sure a PATCH
that sends `text` for an option that has an `image_url` **keeps the image** (and the other way round), and that
`question_text` and `attachment_url` / `question_image_url` are updated independently.

## 4. Grading — please confirm

When an option has text, the aspirant's app submits the **option's text** as the answer; when an option has only an image
it submits its **letter** ("A", "B" …). Before, an image option always submitted the letter. Please confirm grading
works from `correct_index` (or accepts text, letter and index), so that:

* an option with text + image is marked right when its text, its letter or its index is the answer;
* two options with the **same text** but different images do not both count as correct. (Prefer comparing by index.)

## 5. Exports and other readers

Paper/question exports (DOCX, Excel, PDF) and any server-side rendering that currently prints "image if present else text"
should print **text and image**. The frontend's own export keeps text first and the image after it.

## 6. How to check

1. In the admin, *Add Question*: a text question with an image under it, and options where A has text + image, B only an
   image, C only text. Save — it succeeds.
2. Reload the question bank and open the question: the same fields come back, none dropped.
3. Put it in an assessment and open it as an aspirant: question and options all show text and image.
4. Answer A (text + image) and submit; the review shows A as your answer, with both its text and its image.
