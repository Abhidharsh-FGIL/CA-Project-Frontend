# Evaluation Portal — Backend API Specification

Scope: the three tabs the admin uses inside `/org/evaluation` — **Create Paper**, **Question Bank**, and **Papers**.

This document lists every HTTP endpoint the frontend already calls, the **exact** path / method / query / payload / response shape the React code expects, plus realistic example payloads and responses you can paste straight into Postman or a unit test.

If you implement these endpoints to the letter, the existing UI will work without any frontend change.

> Note: the broader [`API_SPECIFICATION.md`](API_SPECIFICATION.md) covers the whole platform under `/api/v1/admin/...`. **The evaluation portal calls a different prefix (`/api/v1/evaluation/...`)** — that's what's documented here.

---

## Table of Contents

1. [Conventions](#1-conventions)
2. [Shared Types](#2-shared-types)
3. [Create Paper](#3-create-paper) — generate, review, save, autocomplete, file upload
4. [Question Bank](#4-question-bank) — list, update, delete
5. [Papers](#5-papers) — list, detail, rename, delete

---

## 1. Conventions

| | |
|---|---|
| **Base URL** | `/api/v1/evaluation` |
| **Auth** | `Authorization: Bearer <admin-jwt>` on every request |
| **Workspace scoping** | Every list/create/generate endpoint takes `org_id` as a query string parameter. Backend MUST enforce: a paper / question / generation belongs to the org if it was created with that `org_id`. Cross-org reads must 404. |
| **Content-Type** | `application/json` for all non-file endpoints. `multipart/form-data` only for [§3.5 Upload Source File](#35-upload-source-file). |
| **Timestamps** | ISO 8601 UTC strings (e.g. `"2026-05-19T10:24:00Z"`). |
| **IDs** | Opaque strings. Suggested prefixes: `pap_xxx` for papers, `qb_xxx` for questions. |
| **Empty list contract** | The frontend treats an empty array `[]` as "use built-in demo fallback". For production, return `[]` if there really are no rows — that's fine. Avoid returning `null`. |
| **Errors** | Use shape `{ "error": { "code": string, "message": string, "details"?: any } }` with appropriate HTTP status. |
| **Idempotency** | `DELETE` endpoints are idempotent (404 still acceptable on second call, but 204 is preferred). |

### HTTP status conventions

| Status | When |
|---|---|
| 200 | Successful read / update |
| 201 | Successful create (paper generated, paper saved) |
| 204 | Successful delete |
| 400 | Validation error (missing/invalid fields) — return field-level `details` |
| 401 | Missing or expired token |
| 403 | Authenticated but not allowed (wrong org, non-admin user) |
| 404 | Resource not found in this org |
| 409 | Conflict (e.g. deleting a paper that's referenced by an active assessment) |
| 422 | Semantic validation error (e.g. `weightage` doesn't sum to 100) |
| 500 | Unhandled server error |

---

## 2. Shared Types

### 2.1 `Question`

The canonical shape every endpoint that returns questions must conform to. The frontend normalizes a few fields, so both `question_text`/`text` and `marks`/`points` are accepted on read — but **always return `question_text` and `marks` from the API**.

```ts
interface Question {
  id: string;                     // e.g. "qb_001"
  question_text: string;          // alias the FE also reads as `text`
  question_type:                  // alias FE also reads as `type`
    | 'mcq'
    | 'fill'
    | 'short'
    | 'long'
    | 'true_false'
    | 'match';

  // Type-specific fields below — only the ones relevant to the type are required.
  options?:
    | string[]                            // legacy array form, FE accepts
    | Record<string, string>              // PREFERRED dict form: { A: "...", B: "...", C: "...", D: "..." }
    | { pairs: Array<{ left: string; right: string }> }; // for `match` type
  correct_answer?:
    | string                              // raw value, e.g. "₹5,70,000" or "true"
    | number                              // option index for MCQ
    | string                              // OR a JSON-stringified value (FE will JSON.parse)
    | null;
  pairs?: Array<{ left: string; right: string }>;  // alternative for `match`, FE reads either

  explanation?: string | null;
  marks: number;                  // alias FE also reads as `points`
  difficulty: 'easy' | 'medium' | 'hard';

  subject?: string;               // e.g. "Accounting"
  chapter?: string;               // e.g. "Property, Plant & Equipment"
  grade?: number | null;
  board?: string;                 // e.g. "ICAI", "ICMAI", "ICSI", "Other"

  source?: 'online' | 'text' | 'file';   // FE reads either of these two…
  source_type?: 'online' | 'text' | 'file'; // …prefer `source_type`

  attachment_url?: string | null; // reference image / diagram, if any
  attachment_name?: string | null;

  paper_id?: string | null;       // if the question is part of a paper
  created_at: string;             // ISO 8601
  updated_at?: string;            // ISO 8601
}
```

#### `correct_answer` encoding rules

| Question type | Stored as |
|---|---|
| `mcq` | Option index as integer (0-based) **or** the option's letter (`"A"`, `"B"`, …) **or** the full option string. The FE tries all three when matching. Return whatever you store, but a stable JSON-stringified integer index is recommended (e.g. `"2"`). |
| `true_false` | The strings `"true"` or `"false"` (case-insensitive). |
| `fill`, `short` | The expected answer as a plain string. |
| `long` | The model answer as a paragraph string. |
| `match` | A free-form string like `"A-2, B-1, C-4, D-3"` describing the mapping. The `pairs` array on the same row is the authoritative key-value. |

The FE applies `JSON.parse(correct_answer)` if it looks like a JSON string, otherwise treats it as the raw value. Safe default: always store a string.

### 2.2 `Paper`

```ts
interface Paper {
  id: string;                     // e.g. "pap_001"
  title: string;
  subject?: string;               // primary / dominant subject of the paper
  board?: string;
  grade?: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  mode: 'practice' | 'exam';
  time_limit_seconds?: number | null;
  negative_marking: boolean;
  negative_mark_value?: number;   // only meaningful if negative_marking=true
  question_count: number;
  max_score: number;
  status: 'draft' | 'published';
  created_by: string;             // user id or "admin"
  created_at: string;
  updated_at: string;
}
```

### 2.3 `SubjectConfig` (used in [§3.1 Generate Paper](#31-generate-paper))

```ts
interface SubjectConfig {
  subject: string;                // e.g. "Accounting"
  weightage: number;              // 0..100 — must sum to 100 across the subjects array
  source_type: 'online' | 'file' | 'text';
  source_text?: string;           // when source_type='text' — raw pasted content
  source_ref_id?: string;         // when source_type='file' — file id from §3.5
  chapters: Array<{
    name: string;                 // e.g. "Property, Plant & Equipment"
    weightage: number;            // 0..100 — must sum to 100 within this subject
  }>;
}
```

---

## 3. Create Paper

The **Create Paper** tab walks the admin through: pick subjects/chapters → choose question count and MCQ subtypes → click *Generate Question Paper*. The backend AI-generates the questions, the admin reviews/edits them, then clicks *Save* to persist.

End-to-end call sequence:

1. Autocomplete subjects → [`GET /subjects`](#33-subject-autocomplete)
2. (When a subject is picked) autocomplete chapters → [`GET /chapters`](#34-chapter-autocomplete)
3. (If source_type=`file`) upload the file → [`POST /papers/upload-source`](#35-upload-source-file) → use `source_ref_id` in the generate payload
4. Generate the questions → [`POST /papers/generate`](#31-generate-paper)
5. Save the reviewed questions → [`POST /papers/save`](#32-save-paper)

---

### 3.1 Generate Paper

`POST /api/v1/evaluation/papers/generate?org_id={orgId}`

Kicks off an AI generation run. The frontend currently treats this as **synchronous** — it `await`s the response and renders the questions. If your generator is slow (>30 s), return a 202 with a job id and add a polling endpoint, then tell the frontend team to switch — but for now, return the questions inline.

#### Query

| Name | Type | Required | Notes |
|---|---|---|---|
| `org_id` | string | yes | Workspace scoping |

#### Request body

```ts
{
  title: string;                  // 1-200 chars
  grade?: number;                 // optional
  board?: string;                 // optional, e.g. "ICAI"
  language: 'en' | 'hi' | 'ta';
  language_label: string;         // "English" | "Hindi" | "Tamil" — provided for prompt context
  language_instruction: string;   // pre-baked prompt the FE sends; treat as advisory hint to the LLM
  difficulty: 'easy' | 'medium' | 'hard';
  question_count: number;         // 5-75 (FE enforces max 75)
  question_types: string[];       // currently always ['mcq']
  mcq_subtypes: string[];         // one or more of: 'standard' | 'case' | 'assertion_reason' | 'higher_order'
  type_weightage: Record<string, number>;  // currently always { mcq: 100 }
  negative_marking: boolean;
  negative_mark_value?: number;   // e.g. 0.25, only set when negative_marking=true
  subjects: SubjectConfig[];      // see §2.3, length 1..10
}
```

##### Validation rules

- `subjects.length >= 1` (max 10).
- `subjects[].weightage` must sum to 100 (±0.5 tolerance).
- Within each subject, `chapters[].weightage` must sum to 100 if `chapters` is non-empty.
- `mcq_subtypes.length >= 1`.
- `question_count` ≤ 75.

#### Example request

```json
{
  "title": "CA Foundation — Accounting Practice Paper 1",
  "grade": null,
  "board": "ICAI",
  "language": "en",
  "language_label": "English",
  "language_instruction": "Generate ALL question text, options, and any explanatory content strictly in English. Do not mix languages. Proper nouns and standard scientific/mathematical symbols may remain in English.",
  "difficulty": "medium",
  "question_count": 30,
  "question_types": ["mcq"],
  "mcq_subtypes": ["standard", "case"],
  "type_weightage": { "mcq": 100 },
  "negative_marking": true,
  "negative_mark_value": 0.25,
  "subjects": [
    {
      "subject": "Accounting",
      "weightage": 60,
      "source_type": "online",
      "chapters": [
        { "name": "Property, Plant & Equipment", "weightage": 50 },
        { "name": "Depreciation", "weightage": 50 }
      ]
    },
    {
      "subject": "Business Laws",
      "weightage": 40,
      "source_type": "online",
      "chapters": [
        { "name": "Indian Contract Act", "weightage": 100 }
      ]
    }
  ]
}
```

#### Example response (201)

The shape **must** include `question_json` (the questions) and `answer_key_json` (the per-question answer + explanation). The FE pairs them by `id`.

```json
{
  "id": "pap_temp_a1b2c3",
  "title": "CA Foundation — Accounting Practice Paper 1",
  "status": "draft",
  "question_count": 30,
  "capped": false,
  "question_json": [
    {
      "id": "q_tmp_001",
      "type": "mcq",
      "text": "A machinery is purchased for ₹5,00,000 on 1-Apr-2025. Installation charges ₹50,000 and freight ₹20,000 are also paid. What is the cost of the machinery as per AS 10 / Ind AS 16?",
      "options": ["₹5,00,000", "₹5,50,000", "₹5,70,000", "₹5,20,000"],
      "points": 1,
      "subject": "Accounting",
      "chapter": "Property, Plant & Equipment",
      "difficulty": "medium"
    }
  ],
  "answer_key_json": [
    {
      "id": "q_tmp_001",
      "correctAnswer": "₹5,70,000",
      "explanation": "All directly attributable costs to bring the asset to its location and condition for intended use are capitalised: 5,00,000 + 50,000 + 20,000."
    }
  ]
}
```

> **Important fields:**
> - `capped: boolean` — set to `true` if the LLM produced fewer questions than requested (FE shows an info toast).
> - The temporary `id` on each question is used only to pair questions with the answer key. The real, persistent ids are assigned by [§3.2 Save Paper](#32-save-paper).
> - `correctAnswer` in `answer_key_json` uses camelCase (matches the existing FE code at `EvaluationHubPage.tsx:94`). Do NOT switch to snake_case here.

#### Errors

| Status | When |
|---|---|
| 400 | Missing required fields, validation failure |
| 422 | Weightages don't sum to 100 |
| 429 | Generation quota exceeded for the org |
| 500 | LLM failure — return `{ error: { code: "LLM_FAILED", message: "..." } }` |

---

### 3.2 Save Paper

`POST /api/v1/evaluation/papers/save`

Called after the admin has reviewed (and possibly edited) the generated questions and clicks *Save*. Persists the paper + all its questions + the answer key.

#### Request body

```ts
{
  org_id: string;                 // workspace
  config: EvalPaperConfig;        // the same shape sent to /generate
  questions: ReviewQuestion[];    // possibly edited by the admin
  answer_key: Array<{
    id: string;                   // matches questions[].id
    correctAnswer: any;
    explanation?: string;
  }>;
}

interface ReviewQuestion {
  id: string;                     // temp id from /generate, or admin-assigned
  type: string;                   // 'mcq' | 'fill' | ...
  text: string;
  options?: string[] | Record<string, string>;
  pairs?: Array<{ left: string; right: string }>;
  points: number;
  correctAnswer?: any;
  explanation?: string;
  subject?: string;
  chapter?: string;
  difficulty?: string;
}
```

#### Example request

```json
{
  "org_id": "org_fgil",
  "config": {
    "title": "CA Foundation — Accounting Practice Paper 1",
    "board": "ICAI",
    "difficulty": "medium",
    "mode": "practice",
    "negativeMarking": true,
    "negativeMarkValue": 0.25,
    "questionCount": 30,
    "questionTypes": ["mcq"],
    "mcqSubtypes": ["standard"],
    "typeWeightage": { "mcq": 100 },
    "subjects": [
      { "id": "sub_1", "subject": "Accounting", "weightage": 100, "sourceType": "online", "chapters": [] }
    ]
  },
  "questions": [
    {
      "id": "q_tmp_001",
      "type": "mcq",
      "text": "What is the cost of the machinery as per AS 10 / Ind AS 16?",
      "options": ["₹5,00,000", "₹5,50,000", "₹5,70,000", "₹5,20,000"],
      "points": 1,
      "subject": "Accounting",
      "chapter": "Property, Plant & Equipment",
      "difficulty": "easy"
    }
  ],
  "answer_key": [
    {
      "id": "q_tmp_001",
      "correctAnswer": "₹5,70,000",
      "explanation": "All directly attributable costs are capitalised."
    }
  ]
}
```

#### Response (201)

Return the newly-persisted `Paper` (see [§2.2](#22-paper)). The FE invalidates `eval-papers` and `eval-questions` queries on success.

```json
{
  "id": "pap_001",
  "title": "CA Foundation — Accounting Practice Paper 1",
  "subject": "Accounting",
  "board": "ICAI",
  "grade": null,
  "difficulty": "medium",
  "mode": "practice",
  "time_limit_seconds": null,
  "negative_marking": true,
  "negative_mark_value": 0.25,
  "question_count": 1,
  "max_score": 1,
  "status": "published",
  "created_by": "admin",
  "created_at": "2026-05-22T10:24:00Z",
  "updated_at": "2026-05-22T10:24:00Z"
}
```

#### Side effects (backend must implement)

- Insert N rows in the `questions` table linked to this paper.
- Each question's `correct_answer` should be persisted as a JSON-encoded string (FE round-trips via `JSON.parse` / `JSON.stringify`).
- `max_score = sum(points)` across all questions.

#### Errors

| Status | When |
|---|---|
| 400 | `questions.length === 0` |
| 422 | `answer_key` is missing entries for some question ids |

---

### 3.3 Subject Autocomplete

`GET /api/v1/evaluation/subjects?org_id={orgId}&grade=&board=&source=`

Powers the *Subject* dropdown in the Create Paper form. Returns a deduplicated list of subjects the org has used previously (plus, optionally, syllabus-suggested ones).

#### Query

| Name | Type | Required | Notes |
|---|---|---|---|
| `org_id` | string | yes | |
| `grade` | number | no | Filter by grade if set |
| `board` | string | no | Filter by board (e.g. `ICAI`) |
| `source` | string | no | `'online' \| 'file' \| 'text'` — narrows suggestions to what the AI can actually generate from |

#### Response (200)

```json
[
  "Accounting",
  "Business Laws",
  "Quantitative Aptitude",
  "Business Economics",
  "GST",
  "Direct Tax",
  "Cost Accounting",
  "Auditing"
]
```

> Simple string array, alphabetised. Return `[]` if the org has no history.

---

### 3.4 Chapter Autocomplete

`GET /api/v1/evaluation/chapters?org_id={orgId}&subject={subject}`

Used once a subject has been picked. Returns the chapter list under that subject.

#### Query

| Name | Type | Required | Notes |
|---|---|---|---|
| `org_id` | string | yes | |
| `subject` | string | yes | URL-encoded subject name |

#### Response (200)

```json
[
  "Property, Plant & Equipment",
  "Depreciation",
  "Inventories",
  "Cash Flow Statements",
  "Accounting Standards"
]
```

> Disabled on the FE until a subject is selected (`enabled: !!orgId && !!subject`). Don't worry about handling empty `subject` server-side — the request won't be sent.

---

### 3.5 Upload Source File

`POST /api/v1/evaluation/papers/upload-source?org_id={orgId}`

When the admin picks `source_type=file` for a subject, they upload a PDF/DOCX containing the source material (a syllabus chapter, a textbook section, etc.). The backend extracts text and returns it, so the FE can preview before generating.

#### Request

`Content-Type: multipart/form-data`

| Field | Type | Required |
|---|---|---|
| `file` | binary (PDF / DOCX / TXT) | yes |

#### Accepted extensions

`.pdf`, `.docx`, `.doc`, `.txt`. Reject anything else with 400.

#### Response (200)

```json
{
  "extracted_text": "Property, Plant and Equipment (AS 10 / Ind AS 16)\n\nAn item of PPE that qualifies for recognition as an asset shall be measured at cost. Cost comprises:\n  (a) Purchase price including non-refundable duties and taxes...",
  "filename": "as10_ppe.pdf",
  "word_count": 1247
}
```

#### Notes for the backend

- The FE uses `word_count` only as a guide ("X words ingested"), so it doesn't need to be exact — but it should be approximately the count of whitespace-separated tokens in `extracted_text`.
- Return the extracted text inline. If the file is huge (>50k words), truncate and add `"truncated": true` to the response (the FE doesn't read this yet but will eventually).
- Persist the uploaded file under a temporary id and optionally return `source_ref_id` so the admin can re-use it without re-uploading — currently the FE sends the raw text along, but a future version may switch.

#### Errors

| Status | When |
|---|---|
| 400 | Unsupported file type, file > 25 MB |
| 422 | OCR / parser couldn't extract any text |

---

## 4. Question Bank

The **Question Bank** tab is a paginated, filterable, editable list of every question the org has ever generated.

### 4.1 List Questions

`GET /api/v1/evaluation/questions?org_id={orgId}&subject=&type=&difficulty=&source=&grade=&board=&paper_id=`

#### Query

All filters are optional. Skip the param if the user hasn't set it. Use `AND` semantics across filters.

| Name | Type | Notes |
|---|---|---|
| `org_id` | string | required |
| `subject` | string | e.g. `Accounting` |
| `type` | string | `mcq` \| `fill` \| `short` \| `long` \| `true_false` \| `match` |
| `difficulty` | string | `easy` \| `medium` \| `hard` |
| `source` | string | `online` \| `file` \| `text` |
| `grade` | string | numeric as string |
| `board` | string | `ICAI`, `ICMAI`, `ICSI`, `Other` |
| `paper_id` | string | filter to questions belonging to one paper |

> No `search` param yet — the FE does client-side text matching on `text`, `subject`, and `chapter`. You can add server-side `search=` later if the bank gets large.

#### Response (200)

**Plain array** of `Question` objects (no pagination wrapper). The FE applies infinite-scroll client-side at 25 per page.

```json
[
  {
    "id": "qb_001",
    "question_text": "A machinery is purchased for ₹5,00,000 on 1-Apr-2025...",
    "question_type": "mcq",
    "options": ["₹5,00,000", "₹5,50,000", "₹5,70,000", "₹5,20,000"],
    "correct_answer": "₹5,70,000",
    "explanation": "All directly attributable costs are capitalised: 5,00,000 + 50,000 + 20,000.",
    "marks": 1,
    "difficulty": "easy",
    "subject": "Accounting",
    "chapter": "Property, Plant & Equipment",
    "grade": null,
    "board": "ICAI",
    "source_type": "online",
    "paper_id": "pap_001",
    "created_at": "2026-05-20T10:24:00Z"
  },
  {
    "id": "qb_002",
    "question_text": "An asset costing ₹1,00,000 with useful life of 5 years and salvage value ₹10,000 is depreciated on SLM. What is the annual depreciation?",
    "question_type": "mcq",
    "options": ["₹20,000", "₹18,000", "₹16,000", "₹22,000"],
    "correct_answer": "₹18,000",
    "explanation": "(Cost − Salvage) / Useful Life = (1,00,000 − 10,000) / 5 = ₹18,000.",
    "marks": 1,
    "difficulty": "easy",
    "subject": "Accounting",
    "chapter": "Depreciation",
    "board": "ICAI",
    "source_type": "online",
    "created_at": "2026-05-20T10:24:00Z"
  }
]
```

> Return `[]` for "no matches" — the FE shows an empty-state message.

#### Performance notes

- The FE renders 25 at a time but expects the full filtered set in one response. If the org has 10k+ questions, add cursor pagination later — coordinate with the FE team before flipping.

---

### 4.2 Update Question

`PATCH /api/v1/evaluation/questions/{question_id}`

Called when the admin edits a question inline (the pencil icon → dialog).

#### Path params

| Name | Type |
|---|---|
| `question_id` | string |

#### Request body

Partial — only the fields the admin actually changed are sent.

```ts
{
  question_text?: string;
  marks?: number;
  explanation?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;

  // MCQ
  options?: Record<string, string>;  // dict form: { A: "...", B: "...", ... }
  correct_answer?: string;           // JSON-stringified value (FE does JSON.stringify before sending)

  // true_false / fill / short
  // correct_answer same as above

  // match
  // options = { pairs: [{ left, right }] }
}
```

#### Example request — edit an MCQ

```json
{
  "question_text": "A machinery is purchased for ₹6,00,000. Installation ₹40,000, freight ₹10,000. Cost per AS 10?",
  "marks": 2,
  "options": {
    "A": "₹6,00,000",
    "B": "₹6,40,000",
    "C": "₹6,50,000",
    "D": "₹6,10,000"
  },
  "correct_answer": "2",
  "explanation": "Capitalise all directly attributable costs."
}
```

#### Response (200)

Return the full updated `Question` object.

```json
{
  "id": "qb_001",
  "question_text": "A machinery is purchased for ₹6,00,000. Installation ₹40,000, freight ₹10,000. Cost per AS 10?",
  "question_type": "mcq",
  "options": { "A": "₹6,00,000", "B": "₹6,40,000", "C": "₹6,50,000", "D": "₹6,10,000" },
  "correct_answer": "2",
  "explanation": "Capitalise all directly attributable costs.",
  "marks": 2,
  "difficulty": "easy",
  "subject": "Accounting",
  "chapter": "Property, Plant & Equipment",
  "board": "ICAI",
  "source_type": "online",
  "paper_id": "pap_001",
  "created_at": "2026-05-20T10:24:00Z",
  "updated_at": "2026-05-22T11:00:00Z"
}
```

#### Errors

| Status | When |
|---|---|
| 404 | Question doesn't exist or belongs to another org |
| 422 | `correct_answer` doesn't match any option for MCQ |

---

### 4.3 Delete Question

`DELETE /api/v1/evaluation/questions/{question_id}`

Single-row delete (red trash icon on the row, or per-row delete from the dropdown). Bulk delete is just N parallel calls from the FE (no dedicated bulk endpoint yet).

#### Response (204)

Empty body.

#### Side effects

- If the question is the **last** one in a paper, the FE does NOT auto-delete the paper — backend should leave the paper row in place even if `question_count` drops to 0. The admin can delete the paper separately via [§5.4](#54-delete-paper).
- Decrement `paper.question_count` and re-compute `paper.max_score` if the deleted question was part of a paper.

#### Errors

| Status | When |
|---|---|
| 404 | Already deleted, or wrong org |
| 409 | The question is locked because it's part of a published assessment with live attempts |

---

## 5. Papers

The **Papers** tab is a grid of every paper the org has saved. Each card shows the title, badges (mode, difficulty), and a question count. Clicking a card opens [§5.2 Get Paper Questions](#52-get-paper-questions).

### 5.1 List Papers

`GET /api/v1/evaluation/papers?org_id={orgId}`

#### Query

| Name | Type | Required |
|---|---|---|
| `org_id` | string | yes |

> No filters — the FE does client-side search on `title`. Returns all papers for the org, newest-first (sort by `created_at desc`).

#### Response (200)

Array of `Paper`. Return `[]` if none.

```json
[
  {
    "id": "pap_001",
    "title": "CA Foundation — Accounting Practice Paper 1",
    "subject": "Accounting",
    "board": "ICAI",
    "grade": null,
    "difficulty": "medium",
    "mode": "practice",
    "time_limit_seconds": 2700,
    "negative_marking": true,
    "negative_mark_value": 0.25,
    "question_count": 30,
    "max_score": 30,
    "status": "published",
    "created_by": "admin",
    "created_at": "2026-05-19T10:24:00Z",
    "updated_at": "2026-05-19T10:24:00Z"
  },
  {
    "id": "pap_002",
    "title": "CA Foundation — Full Syllabus Mock 1",
    "subject": "All Papers",
    "board": "ICAI",
    "grade": null,
    "difficulty": "mixed",
    "mode": "exam",
    "time_limit_seconds": 10800,
    "negative_marking": true,
    "negative_mark_value": 0.25,
    "question_count": 100,
    "max_score": 100,
    "status": "published",
    "created_by": "admin",
    "created_at": "2026-05-17T10:24:00Z",
    "updated_at": "2026-05-17T10:24:00Z"
  }
]
```

---

### 5.2 Get Paper Questions

`GET /api/v1/evaluation/papers/{paper_id}/questions`

Used by the paper-detail page and by Question-Bank's "view by paper" filter alternative.

#### Path params

| Name | Type |
|---|---|
| `paper_id` | string |

#### Response (200)

Array of `Question` (see [§2.1](#21-question)). Order MUST be stable — the questions should come back in the order they were saved (Q1, Q2, …).

```json
[
  {
    "id": "qb_001",
    "question_text": "A machinery is purchased for ₹5,00,000...",
    "question_type": "mcq",
    "options": ["₹5,00,000", "₹5,50,000", "₹5,70,000", "₹5,20,000"],
    "correct_answer": "₹5,70,000",
    "explanation": "All directly attributable costs are capitalised.",
    "marks": 1,
    "difficulty": "easy",
    "subject": "Accounting",
    "chapter": "Property, Plant & Equipment",
    "board": "ICAI",
    "source_type": "online",
    "paper_id": "pap_001",
    "created_at": "2026-05-19T10:24:00Z"
  }
]
```

#### Errors

| Status | When |
|---|---|
| 404 | Paper not in this org |

---

### 5.3 Update Paper Metadata

`PATCH /api/v1/evaluation/papers/{paper_id}`

Currently used only to rename a paper from the Papers tab. Future expansion: difficulty / mode / time_limit could become editable here too — keep the body shape forward-compatible.

#### Request body

```ts
{
  title?: string;          // 1-200 chars
  // Future: difficulty?, mode?, time_limit_seconds?, status?
}
```

#### Example request

```json
{ "title": "CA Foundation — Accounting Practice Paper 1 (Revised)" }
```

#### Response (200)

Return the full updated `Paper`.

```json
{
  "id": "pap_001",
  "title": "CA Foundation — Accounting Practice Paper 1 (Revised)",
  "subject": "Accounting",
  "board": "ICAI",
  "grade": null,
  "difficulty": "medium",
  "mode": "practice",
  "time_limit_seconds": 2700,
  "negative_marking": true,
  "negative_mark_value": 0.25,
  "question_count": 30,
  "max_score": 30,
  "status": "published",
  "created_by": "admin",
  "created_at": "2026-05-19T10:24:00Z",
  "updated_at": "2026-05-22T11:30:00Z"
}
```

#### Errors

| Status | When |
|---|---|
| 404 | Paper not in this org |
| 400 | `title` empty after trim |

---

### 5.4 Delete Paper

`DELETE /api/v1/evaluation/papers/{paper_id}`

Cascading delete: removes the paper and **all** its questions. The FE invalidates the question-bank cache on success because some questions disappear.

#### Response (204)

Empty body.

#### Side effects

- Delete every `Question` row with `paper_id` matching this paper.
- Refuse with 409 if any active assessment (under `/api/v1/evaluation/assessments`) references this paper id.

#### Errors

| Status | When |
|---|---|
| 404 | Already deleted / wrong org |
| 409 | Paper is referenced by at least one live assessment — return `{ error: { code: "PAPER_IN_USE", message: "Paper is used by 2 active assessments. Archive or delete those first.", details: { assessment_ids: ["asm_001", "asm_005"] } } }` |

---

## Appendix A — Frontend call sites (for cross-reference)

| Endpoint | Frontend hook | Component |
|---|---|---|
| `POST /papers/generate` | `useGenerateEvalPaper` | `EvalPaperConfigPanel` |
| `POST /papers/save` | `useSaveEvalPaper` | `EvaluationHubPage` |
| `GET /subjects` | `useEvalSubjectSuggestions` | `EvalPaperConfigPanel`, `EvalQuestionBank` |
| `GET /chapters` | `useEvalChapterSuggestions` | `EvalPaperConfigPanel` |
| `POST /papers/upload-source` | `useUploadEvalSource` | `EvalSubjectCard` |
| `GET /questions` | `useEvalQuestions` | `EvalQuestionBank` |
| `PATCH /questions/{id}` | `useUpdateEvalQuestion` | `EvalQuestionBank` (edit dialog) |
| `DELETE /questions/{id}` | `useDeleteEvalQuestion` | `EvalQuestionBank` |
| `GET /papers` | `useEvalPapers` | `EvalPapersList`, `EvalPaperDetailPage` |
| `GET /papers/{id}/questions` | `useEvalPaperQuestions` | `EvalPaperDetailPage` |
| `PATCH /papers/{id}` | `useUpdateEvalPaperMeta` | `EvalPapersList` (edit dialog) |
| `DELETE /papers/{id}` | `useDeleteEvalPaper` | `EvalPapersList` |

Source files:
- Hooks: [`src/hooks/use-evaluation.ts`](src/hooks/use-evaluation.ts)
- Sample data shapes (use as fixtures): [`src/data/sampleAdminEvalData.ts`](src/data/sampleAdminEvalData.ts)

---

## Appendix B — Demo-mode fallback contract

The frontend wraps every list endpoint in `withSampleFallback()` ([`src/hooks/use-evaluation.ts:18`](src/hooks/use-evaluation.ts#L18)):

```ts
async function withSampleFallback<T>(apiCall, fallback) {
  try {
    const data = await apiCall();
    if (Array.isArray(data) && data.length > 0) return data;
    return fallback;
  } catch {
    return fallback;
  }
}
```

That means:

- If your endpoint returns `[]`, the FE silently substitutes built-in sample data so the panel isn't empty during demos.
- If your endpoint **throws** (5xx, network error), same thing — fallback data shows up.

For a normal production org with real data, this fallback is invisible. But during initial backend rollout, an org with zero questions will keep showing the demo set until at least one real question is generated. If you want the empty state to actually show, return a non-array shape like `{ items: [] }` and tell the FE team to adjust the hook.

---

## Appendix C — Open questions for the backend team

These weren't determined when the frontend was built. Decide and document:

1. **Pagination strategy** — flat arrays for now. Switch to cursor-based when the bank gets >5k rows? Define cutoff with FE team.
2. **AI generation timeout** — current FE awaits the response indefinitely. Recommend a hard server-side timeout (e.g. 90s) and the 202 + polling pattern for anything longer.
3. **Idempotency keys** on `POST /papers/save` — the FE could double-submit if the admin rage-clicks. Consider requiring `Idempotency-Key` header.
4. **Question-bank deduplication** — if the AI generates a question identical to an existing one, do you store both or merge? Define a fingerprint (e.g. `sha256(question_text + correct_answer)`) and decide.
5. **Status field on questions** — the FE doesn't surface a question status, but you may want `draft` / `published` / `archived` for moderation.
