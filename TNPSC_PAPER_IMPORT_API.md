# Question-Paper Import — Specification & Prompt

> **STATUS: SHIPPED, with a different contract than originally specced.**
> The backend implemented `POST /api/v1/evaluation/papers/extract` (flat multipart
> fields, not a JSON `config`), reusing the **generator's** job store — so polling
> goes to `GET /papers/generate/status/{job_id}` and `POST /papers/save` accepts the
> result untouched. Per-question `answer_confidence` became a `confidence` of
> `high|medium|low` on the answer-key entry, `source_question_number` became
> `source_number`, and `summary` became `extraction_stats`. **§1 below is superseded
> by §0; §3 (extraction rules) and §4 (the prompt) still stand.** The frontend is
> aligned to the shipped contract.

---

## 0. The shipped contract

```
POST /api/v1/evaluation/papers/extract?org_id=<org-id>
Authorization: Bearer <admin-token>
Content-Type: multipart/form-data
```

| Field | Required | Value for a TNPSC Group 1 paper |
|---|---|---|
| `file` | yes | the PDF / DOCX / TXT, 25 MB max |
| `language` | no (`en`) | `en` — the language the questions are printed in |
| `secondary_language` | no | `ta` — **set this**; it pairs the two printings into one question |
| `subject` | no | e.g. `General Studies` — tags every question |
| `exam_label` | no | `TNPSC Group 1` — context for the model |
| `max_questions` | no | cap it while testing |

**202** → `{ "job_id": "...", "status": "queued", "message": "Paper uploaded — reading the questions." }`

Then poll `GET /api/v1/evaluation/papers/generate/status/{job_id}` — the extraction task
writes the generator's job shape, so existing polling and SSE work unchanged.

```jsonc
"question_json": [{
  "id": "q_tmp_0001",
  "source_number": 139,                    // number printed in the booklet
  "text": "Kumaran bought a raincoat and saved Rs. 25 with discount of 20%...",
  "options": ["Rs. 125", "Rs. 250", "Rs. 175", "Rs. 150", "Answer not known"],
  "translations": { "ta": { "text": "…", "options": ["ரூ. 125", "…", "விடை தெரியவில்லை"] } }
}],
"answer_key_json": [{
  "id": "q_tmp_0001",
  "correctAnswer": "Rs. 125",
  "explanation": "A 20% discount saved Rs. 25, so the original price is 25 / 0.20 = Rs. 125.",
  "confidence": "high"                     // high | medium | low
}],
"extraction_stats": { "sections_read": 24, "extracted": 198, "dropped": 2, "low_confidence": 11 }
```

**Guards the backend implemented** (worth knowing, because they change what "missing" means):

- A question whose `correctAnswer` matches none of its options is **dropped** — that one would
  silently mark every aspirant wrong. Dropped counts appear in `extraction_stats.dropped`.
- Chunks overlap by 250 words so a question spanning a page break is seen whole; duplicates are
  deduped on the printed number.
- One unreadable section is skipped, not fatal.
- A misaligned Tamil option list drops the translation and keeps the question.

**`422 NO_TEXT_EXTRACTED`** — the PDF is a photo scan with no text layer. Checked at upload rather
than after a long job. Run OCR (Tamil + English) and upload the searchable PDF. The frontend
surfaces this as guidance rather than an error code.

---


**What it does:** an admin uploads a real exam paper (e.g. *TNPSC Group 1 Prelims, 15 Jun 2025*) and
the platform turns it into an assessment — questions and options **reproduced as printed**, with the
correct answer and an explanation attached to each.

**How it differs from `/papers/generate`:** the generator *invents* questions from a syllabus.
The importer must **not invent anything except the answer key and explanations**. Wording, option
order and the five-option TNPSC layout come out of the file exactly as they went in.

Frontend is built and calls these endpoints: [`src/lib/paperImportApi.ts`](src/lib/paperImportApi.ts),
[`EvalPaperImportPanel.tsx`](src/components/evaluation/EvalPaperImportPanel.tsx) (Evaluation Hub →
**Import Paper** tab).

---

## 1. Endpoints

### 1.1 Start an import

```
POST /api/v1/evaluation/papers/import?org_id={orgId}
Content-Type: multipart/form-data
Authorization: Bearer <admin token>
```

| Field | Type | Notes |
|---|---|---|
| `file` | binary | `.pdf`, `.docx`, `.doc`, `.png`, `.jpg`. ≤ 25 MB. Scans are OCR'd. |
| `config` | string (JSON) | the object below |
| `answer_key_file` | binary | *optional* — the official key, when the admin has it |

```jsonc
{
  "title": "TNPSC Group 1 Prelims 2025",
  "test_type": "TNPSC Group 1",
  "difficulty": "medium",
  "language": "en",            // language of the printed question text
  "secondary_language": "ta",  // set when each question is printed twice; null otherwise
  "derive_answers": true,      // work out the answer where the paper has none
  "generate_explanations": true,
  "explanation_language": "en",
  "answer_key_source_ref_id": null
}
```

**Response 202** — `{ "job_id": "imp_9f2c…", "status": "queued" }`

Reject early with `400` for an unsupported type or an oversized file, `422` when no text can be
extracted at all (a photo of a blank page, a corrupt PDF).

### 1.2 Poll

```
GET /api/v1/evaluation/papers/import/status/{job_id}
```

```jsonc
{
  "job_id": "imp_9f2c…",
  "status": "running",             // queued | running | completed | failed
  "message": "Reading page 42 of 155…",
  "progress": { "done": 96, "total": 200 },
  "error": null
}
```

On `completed`, add `question_json`, `answer_key_json` and `summary` (§2). The frontend polls every
3 s; an SSE variant at `/import/stream/{job_id}` may mirror it, same payloads.

> Emit `progress` as soon as the question count is known (from the paper's own numbering) so the
> admin sees "96 of 200" rather than a spinner for four minutes.

### 1.3 Save

No new endpoint. The reviewed questions go through the existing
`POST /api/v1/evaluation/papers/save`, so imported papers land in the same Collections list and can
be turned into an assessment exactly like generated ones.

---

## 2. Response shape

`question_json` matches the generator's contract, plus four import-only fields:

```jsonc
{
  "id": "imp_q_001",
  "type": "mcq",
  "text": "Which of statements are True?\n(i) Octane number increases with chain length.\n(ii) Cycloalkanes have higher Octane number than straight chain alkanes.\n(iii) Alkenes and aromatic hydrocarbon have higher Octane number than straight chain alkanes.\n(iv) Branched chain alkanes have lower octane number than straight chain alkanes.",
  "options": [
    "(i) and (iv)",
    "(i) and (ii)",
    "(ii) and (iii)",
    "(i), (ii), (iii) and (iv)",
    "Answer not known"
  ],
  "correctAnswer": "(ii) and (iii)",
  "explanation": "Cycloalkanes and aromatics resist knocking better than straight-chain alkanes, so both have higher octane numbers; branched alkanes are higher, not lower, than straight chains.",
  "points": 1,
  "subject": "General Science",
  "chapter": "Chemistry",
  "passage": null,
  "group_id": null,

  "translations": {
    "ta": {
      "text": "கீழ்கண்டவற்றில் எது சரியான கூற்று?\n(i) சங்கிலி தொடர் கூடும் போது ஆக்டேன் எண் உயர்கிறது.\n…",
      "options": ["(i) மற்றும் (iv)", "(i) மற்றும் (ii)", "(ii) மற்றும் (iii)", "(i), (ii), (iii) மற்றும் (iv)", "விடை தெரியவில்லை"],
      "explanation": "…"
    }
  },

  "answer_source": "ai_derived",     // paper | answer_key | ai_derived | unknown
  "answer_confidence": 0.82,          // 0–1; required when answer_source = ai_derived
  "source_question_number": 1,        // as printed — lets a reviewer find it in the original
  "source_page": 3
}
```

`answer_key_json` mirrors the generator: `[{ id, correctAnswer, explanation }]`.

### 2.1 `summary` — shown above the review screen

```jsonc
{
  "pages": 155,
  "questions_found": 200,
  "bilingual_pairs": 200,
  "answers_from_key": 0,
  "answers_ai_derived": 200,
  "low_confidence": 14,
  "warnings": [
    "Q200 contains a diagram that could not be extracted — the question text may be incomplete.",
    "Pages 1–2 were instructions, not questions."
  ]
}
```

---

## 3. Extraction rules

These come from the structure of a real TNPSC paper. Each has bitten a naive importer.

| # | Rule |
|---|------|
| **E1** | **Reproduce, don't rewrite.** Question and option text is copied verbatim — no paraphrasing, no fixing the paper's own grammatical errors (real papers contain them: *"The Cholas were a ancient dynasty"*). |
| **E2** | **Keep all five options.** TNPSC papers end every question with `(E) Answer not known` / `விடை தெரியவில்லை`. Keep it as a real option — it is selectable in the exam. |
| **E3** | **Never inline the options into the stem.** They belong in `options[]` only. (The generator has done this; the portal now strips it, but the importer must not create the problem.) |
| **E4** | **Pair the two languages.** A bilingual paper prints question 1 in English, then the same question in Tamil, before question 2. With `secondary_language` set, emit **one** question with the Tamil in `translations.ta` — never 400 questions from a 200-question paper. Match on the printed question number, not on position. |
| **E5** | **Preserve statement lists.** `(i)…(iv)` statements, Assertion/Reason pairs and match-the-following columns are part of the stem. Keep line breaks; the options are only the lettered choices `(A)–(E)`. |
| **E6** | **Match-the-following stays intact.** Column A / Column B and the `(a) (b) (c) (d)` header row belong in the stem; the options are the four permutation strings (`"5 1 2 3"`). |
| **E7** | **Skip front matter.** Instructions, OMR guidance, "Space for Rough Work" and the cover page are not questions. |
| **E8** | **Number from the paper.** `source_question_number` is what is printed, so an admin can cross-check. Report gaps in `warnings` rather than renumbering silently. |
| **E9** | **Flag what you couldn't read.** A question with a diagram, map or unreadable scan gets a `warnings` entry and, if the text is partial, `answer_confidence` ≤ 0.3 — never a confident guess. |
| **E10** | **Subject and chapter** are tagged from content against the stage syllabus in [`src/config/tnpsc.ts`](src/config/tnpsc.ts), using the exact subject names, so imported questions land in the right practice buckets. |

### 3.1 Answers

Priority order, recorded in `answer_source`:

1. **`answer_key`** — an official key was uploaded; map by question number. Always preferred.
2. **`paper`** — the paper itself marks answers (some solved papers do).
3. **`ai_derived`** — the model determines it. Requires `answer_confidence`.
4. **`unknown`** — could not be determined. Leave `correctAnswer` empty rather than guessing; the
   admin fills it in during review.

**A question paper carries no key**, so a plain import of the 2025 Group 1 paper produces 200
`ai_derived` answers. That is expected — the UI warns the admin and surfaces every low-confidence
one. Calibrate honestly: mark ≤ 0.5 when the question is ambiguous, depends on a diagram, or turns
on a fact you are unsure of. **An overconfident wrong key is worse than an empty one**, because
aspirants are graded against it.

---

## 4. The extraction prompt

Run per page-batch (10–15 pages), then merge. Send the page images for scans, the extracted text
layer for digital PDFs, or both.

```text
SYSTEM
You are extracting questions from a printed competitive-examination question paper
(Tamil Nadu Public Service Commission). You are a transcriber, not an author.

ABSOLUTE RULES
1. Reproduce the question and option text EXACTLY as printed. Do not paraphrase,
   summarise, translate, correct spelling, or fix grammar — the paper's own errors
   must survive verbatim.
2. Every question has five options, (A) through (E). (E) is always
   "Answer not known" / "விடை தெரியவில்லை". Include it.
3. Options go in the `options` array ONLY. Never repeat them inside the question text.
4. Numbered statements (i)/(ii)/(iii), Assertion–Reason pairs, and match-the-following
   columns are PART OF THE QUESTION TEXT, not options. Preserve their line breaks.
   The options are only the lettered choices.
5. If a question refers to a diagram, map or image you cannot read, still extract the
   text, set "extraction_complete": false, and say what is missing in "warning".
6. Ignore the cover page, general instructions, OMR instructions and "Space for Rough
   Work" pages. They contain no questions.

BILINGUAL PAPERS
This paper prints every question twice: first in {{primary_language}}, then the same
question in {{secondary_language}}. Emit ONE object per question. Put the
{{secondary_language}} version in "translations".{{secondary_language}}, matching by the
printed question number. Never emit the same question twice.

ANSWERS
{{#if derive_answers}}
For each question, determine the correct option and give a confidence from 0 to 1.
- Base it on established fact. If the question is ambiguous, has no clearly correct
  option, or hinges on something you cannot read, set confidence at or below 0.3.
- Never invent a plausible-looking answer to appear complete. An empty answer is fine;
  a wrong one is not — aspirants are graded against this key.
- Return the correct option's FULL TEXT exactly as it appears in `options`, not its letter.
{{/if}}

EXPLANATIONS
{{#if generate_explanations}}
Write 1–2 sentences in {{explanation_language}} explaining why the correct option is
right — and, when the distractors are the point of the question, why the closest wrong
option is wrong. State facts; do not address the reader or use filler.
{{/if}}

SUBJECT TAGGING
Tag each question with the closest subject from this list, using the exact string:
{{syllabus_subject_names}}
Add a "chapter" from that subject's topics where the question makes it obvious.

OUTPUT
Return ONLY a JSON array. One object per question:

[
  {
    "source_question_number": 1,
    "source_page": 3,
    "text": "…verbatim question text, \n for line breaks…",
    "options": ["…", "…", "…", "…", "Answer not known"],
    "correctAnswer": "…full text of the correct option…",
    "answer_confidence": 0.85,
    "explanation": "…",
    "subject": "General Science",
    "chapter": "Chemistry",
    "translations": {
      "ta": { "text": "…", "options": ["…","…","…","…","விடை தெரியவில்லை"], "explanation": "…" }
    },
    "extraction_complete": true,
    "warning": null
  }
]
```

### 4.1 Notes for whoever wires the prompt

- **Tamil OCR is the weak point.** A vision model reading page images beats a text-layer parse on
  scanned papers — the sample paper's Tamil text layer is unreliable. Prefer images when the PDF has
  no embedded text or the extracted Tamil looks like mojibake.
- **Batch by page, not by question count.** Questions straddle page breaks; overlap batches by one
  page and de-duplicate on `source_question_number`.
- **Validate before returning.** Drop any object with fewer than 2 options or empty `text`, and add
  it to `warnings` instead of silently discarding it.
- **Don't let the model renumber.** If it returns 1..200 while the paper printed 1..200 with a gap
  at 105, you have a silent misalignment against the official key. Trust the printed number.

---

## 5. Cost and time

A 155-page, 200-question bilingual paper is roughly:

| Stage | Cost driver |
|---|---|
| OCR / page render | 155 pages |
| Extraction | ~13 batches × (page images + output JSON) |
| Answer derivation | 200 questions, reasoning-heavy |
| Explanations | 200 short generations |

Budget minutes, not seconds — hence the async job. Emit progress per batch. Consider making
`derive_answers` and `generate_explanations` separate follow-up passes so a failure in answer
derivation doesn't discard a successful extraction.

---

## 6. Acceptance criteria

Import the attached 2025 Group 1 Prelims paper and check:

- [ ] **200 questions**, not 400 — bilingual pairing worked.
- [ ] Q1 keeps its four `(i)–(iv)` statements in the stem, with `(A)–(E)` as options.
- [ ] Every question has exactly 5 options, the fifth being "Answer not known" / "விடை தெரியவில்லை".
- [ ] Q2 (match hormones to disorders) keeps both columns in the stem; options are the four permutations.
- [ ] Tamil renders as Tamil, not mojibake, in `translations.ta`.
- [ ] No question text contains its own options repeated.
- [ ] Cover page and instruction pages produced no questions.
- [ ] `source_question_number` runs 1–200 and matches the print.
- [ ] Every `ai_derived` answer carries a confidence; low ones are listed in `summary.low_confidence`.
- [ ] Q95–Q102 (maths) survive: fractions and formulae are readable, even if plain-text.
- [ ] Uploading an official key alongside flips `answer_source` to `answer_key` for matched numbers.

---

## 7. Admin flow (already built)

1. **Evaluation Hub → Import Paper** — drop the PDF, set title, test type, printed language.
2. Toggles: *paper prints each question twice*, *work out the correct answer*, *write explanations*.
3. **Import paper** → progress ("96 of 200") → review screen with the import summary on top.
4. Every question is editable before saving — correct any wrong key here.
5. **Save to Collections** → the paper appears in Collections like any generated one.
6. **Assessments → Create Assessment** → pick that collection, set the TNPSC placement, publish.
