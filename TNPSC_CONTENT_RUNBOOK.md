# TNPSC — How to generate questions and get them into the portal

**Situation:** `GET /api/v1/user/tnpsc/stages/group-1-prelims/mock-tests` returns three unlocked levels
with `tests_total: 0`. That response is **correct** — the endpoint works, there is simply no tagged
content yet. All three levels show unlocked because of the empty-catalogue escape hatch
(§5.2 rule 5 in [`TNPSC_API_SPEC.md`](TNPSC_API_SPEC.md)): with zero Simple mocks published there is
nothing to clear, so the gate cannot dead-end the aspirant. Once Simple mocks exist, Medium and
Complex will lock automatically.

**Key point:** generating questions is not enough. A paper only appears in the TNPSC endpoints once
it is **tagged** with `tnpsc_stage_id` + `track` (+ `tnpsc_level` for mock, `tnpsc_subject_id` for
practice). Step 4 below is the one that makes `tests_total` move.

---

## The pipeline (existing endpoints — these already work)

```
1. POST /api/v1/evaluation/papers/generate?org_id=…   → AI-generates questions (1–200 per run, async job)
2. POST /api/v1/evaluation/papers/save                → persists paper + questions → paper_id
3. POST /api/v1/evaluation/assessments?org_id=…       → makes it attemptable → assessment_id
4. PATCH /api/v1/evaluation/assessments/{id}/tnpsc    → TNPSC tags  ← NEW, see §4
5. PATCH /api/v1/evaluation/assessments/{id}/status   → {"status":"published"}
```

Steps 1–3 and 5 exist today (see [`EVALUATION_API.md`](EVALUATION_API.md) §3.1, §3.2 and
[`use-eval-assessments.ts`](src/hooks/use-eval-assessments.ts)). Step 4 is the only new one.

---

## One run per mock — 200 questions in a single call

`POST /papers/generate` accepts **`question_count` 1–200**, so a full-length TNPSC paper is one
request with all its sections in `subjects[]`. (An earlier revision of this runbook described a
three-block split around a 75-question cap — that cap is gone; the frontend slider now goes to 200.)

For Group 1 Prelims that means one call with the section split as subject weightages:

| Section | Questions | Weightage |
|---|---|---|
| General Studies subjects | 175 | 87.5% |
| Aptitude & Mental Ability | 25 | 12.5% |
| **Total** | **200** | 100% |

Multi-paper assembly via `paper_ids` + `paper_weights` still works and is worth using when you want
a mock stitched from separately reviewed section papers — it is no longer required.

---

## Language handling (Tamil / English)

Two independent settings, each overridable per section:

| Field | Effect |
|---|---|
| `language` (top level) | The language questions are generated in |
| `secondary_language` (top level) | Prints each question **again** in that language under the same number |
| `subjects[].language` | Overrides the generation language for that section |
| `subjects[].secondary_language` | Overrides the translation language for that section |

Generation language resolves **most specific wins**:

1. `subjects[].language` — an explicit per-section override
2. **the subject's name** — a section named `General Tamil` generates in Tamil by itself, matched on
   the *whole* name (so `Tamil Nadu History` correctly stays English)
3. `language` at the top level — the paper default

> **`language_instruction` must be `""`.** Any text in it overrides all of the above and forces the
> whole paper into one language. The frontend always sends an empty string.

A mixed Group 4 paper is therefore just `"language": "en"` plus normally-named sections:
`General Tamil` comes back in Tamil with **விடை தெரியவில்லை** as option (E), while `General Studies`
and `Aptitude & Mental Ability` come back in English.

TNPSC style — five options including "answer not known" — is switched on by
`"test_type": "TNPSC Group 1"` / `"TNPSC Group 4"`.

### Bilingual output — Group 4 only

**Both Group 1 Prelims and Group 4 Written are bilingual** (changed 05 Sep 2026 — Group 1 was
English-only before). Send `secondary_language` on a
Group 4 request and omit it entirely for Group 1 (the admin UI enforces this — the control is
disabled unless the test type is TNPSC Group 4).

Set `"secondary_language": "ta"` and each generated question carries a `translations` block:

```json
{
  "id": "q_tmp_0139",
  "text": "Kumaran bought a raincoat and saved Rs. 25 with discount of 20%...",
  "options": ["Rs. 125", "Rs. 250", "Rs. 175", "Rs. 150", "Answer not known"],
  "translations": {
    "ta": {
      "text": "குமரன் 20% தள்ளுபடியுடன் ஒரு ரெயின்கோட்டை வாங்கி ரூ. 25 ஐ சேமித்தார்...",
      "options": ["ரூ. 125", "ரூ. 250", "ரூ. 175", "ரூ. 150", "விடை தெரியவில்லை"],
      "passage": null
    }
  }
}
```

`translations` is **absent** on single-language questions (all of General Tamil), and
`correctAnswer` stays in the primary language. The portal renders both languages stacked, with a
Both / Hide toggle, and always stores the answer in the primary language so grading matches.

`translations` must be passed back **verbatim** in `POST /papers/save` — the frontend does this
automatically; a hand-rolled script that drops it loses the Tamil half permanently.

> ⚠️ Migration **e3a7d1c95b20** (the translations column) must be applied first, or `/papers/save`
> fails on any bilingual paper. Migration **b4e2a7c9d150** sets the pass mark to 50.

---

## 1. Generate — a full Simple-level mock (200 questions, one call)

```bash
curl -X POST "$BASE/api/v1/evaluation/papers/generate?org_id=$ORG_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{
  "title": "TNPSC Group 1 Prelims — Simple Mock 01",
  "test_type": "TNPSC Group 1",
  "language": "en",
  "language_instruction": "",
  "difficulty": "easy",
  "question_count": 200,
  "question_types": ["mcq"],
  "mcq_subtypes": ["standard"],
  "type_weightage": { "mcq": 100 },
  "negative_marking": false,
  "subjects": [
    { "subject": "General Science", "weightage": 12.5, "source_type": "online",
      "chapters": [
        { "name": "Physics", "weightage": 25 }, { "name": "Chemistry", "weightage": 25 },
        { "name": "Botany", "weightage": 25 }, { "name": "Zoology", "weightage": 25 }
      ] },
    { "subject": "Current Events", "weightage": 10, "source_type": "online",
      "chapters": [
        { "name": "National Current Affairs", "weightage": 50 },
        { "name": "Tamil Nadu Current Affairs", "weightage": 50 }
      ] },
    { "subject": "Geography of India", "weightage": 10, "source_type": "online",
      "chapters": [
        { "name": "Physical Geography", "weightage": 50 },
        { "name": "Tamil Nadu Geography", "weightage": 50 }
      ] },
    { "subject": "History and Culture of India", "weightage": 10, "source_type": "online",
      "chapters": [
        { "name": "Ancient India", "weightage": 34 }, { "name": "Medieval India", "weightage": 33 },
        { "name": "Modern India", "weightage": 33 }
      ] },
    { "subject": "Indian Polity", "weightage": 12.5, "source_type": "online",
      "chapters": [
        { "name": "Constitution — Basics & Preamble", "weightage": 40 },
        { "name": "Fundamental Rights & Duties", "weightage": 30 },
        { "name": "Union & State Executive", "weightage": 30 }
      ] },
    { "subject": "Indian Economy", "weightage": 10, "source_type": "online",
      "chapters": [ { "name": "National Income", "weightage": 100 } ] },
    { "subject": "Indian National Movement", "weightage": 7.5, "source_type": "online",
      "chapters": [ { "name": "Freedom Struggle", "weightage": 100 } ] },
    { "subject": "History, Culture & Socio-Political Movements of Tamil Nadu", "weightage": 10,
      "source_type": "online",
      "chapters": [ { "name": "Sangam Age", "weightage": 50 }, { "name": "Dravidian Movement", "weightage": 50 } ] },
    { "subject": "Development Administration in Tamil Nadu", "weightage": 5, "source_type": "online",
      "chapters": [ { "name": "Welfare Schemes of Tamil Nadu", "weightage": 100 } ] },
    { "subject": "Aptitude & Mental Ability", "weightage": 12.5, "source_type": "online",
      "chapters": [
        { "name": "Simplification & Percentage", "weightage": 40 },
        { "name": "Logical Reasoning", "weightage": 30 },
        { "name": "Data Interpretation", "weightage": 30 }
      ] }
  ]
}'
```

Weightages: GS subjects 87.5% (= 175 questions) + Aptitude 12.5% (= 25) = 200 ✔

Rules: `subjects[].weightage` must sum to **100** (±0.5) and each subject's `chapters[].weightage`
must sum to 100. Difficulty per level: `easy` → Simple, `medium` → Medium, `hard` → Complex.

For a **Group 4** paper, use `"test_type": "TNPSC Group 4"`, add `"secondary_language": "ta"` at the
top level, and add the language section as `General Tamil` (100 questions = 50% weightage) — it
generates in Tamil on its own, no extra field needed. Use `General English` for the English-medium
variant. Leave the Tamil section itself untranslated via `"secondary_language": null` on that
subject, while GS and Aptitude inherit `"ta"`.

The Group 1 example above deliberately has **no** `secondary_language` — that paper is
single-language.

**Use the exact subject and topic names from [`src/config/tnpsc.ts`](src/config/tnpsc.ts)** — the
generator matches subject names for language selection, and the names must match the taxonomy so the
questions can be tagged and reused.

Returns `{ job_id }`. Poll `GET /api/v1/evaluation/papers/generate/status/{job_id}` (or the SSE
`/stream/` variant) until `status: "completed"`; `capped: true` means the model returned fewer
questions than requested.

---

## 2. Save the paper

```bash
curl -X POST "$BASE/api/v1/evaluation/papers/save" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{
  "org_id": "'"$ORG_ID"'",
  "config": { … the same object sent to /generate … },
  "questions": [ … question_json, after review/edit … ],
  "answer_key": [ … answer_key_json … ]
}'
```

→ returns the persisted paper with a real `id`.

---

## 3. Create the attemptable assessment

### 3a. Mock — from the generated paper(s)

```bash
curl -X POST "$BASE/api/v1/evaluation/assessments?org_id=$ORG_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{
  "title": "TNPSC Group 1 Prelims — Simple Mock 01",
  "course_id": null,
  "paper_ids": ["pap_A"],
  "paper_weights": { "pap_A": 100 },
  "test_type": "mock",
  "difficulty": "easy",
  "question_count": 200,
  "max_score": 300,
  "mode": "exam",
  "time_limit_seconds": 10800,
  "negative_marking": false,
  "max_attempts": 3,
  "shuffle_questions": true,
  "pricing_type": "free",
  "price": 0,
  "due_date": null
}'
```

Notes:
- `mode: "exam"` — the backend normalises `exam` → `mock` for the user API
  (see `ApiEvalAssessment` in [`src/lib/userPortalApi.ts`](src/lib/userPortalApi.ts)).
- `max_attempts: 3`, **not 1** — with the level gate, a single attempt means one 49% score locks the
  aspirant out of the whole product permanently (§8.3 of the spec).
- `max_score: 300` vs 200 questions → 1.5 marks each. Either set `points: 1.5` on every question at
  save time, or keep `max_score: 200` and scale for display. **Pick one and be consistent** — the
  percentage that drives the 50% gate is computed from these numbers.

### 3b. Practice — one 40-question set per topic

```bash
curl -X POST "$BASE/api/v1/evaluation/assessments?org_id=$ORG_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{
  "title": "Indian Polity — Fundamental Rights (Set 1)",
  "paper_id": "pap_polity_fr_01",
  "test_type": "practice",
  "difficulty": "medium",
  "question_count": 40,
  "max_score": 40,
  "mode": "practice",
  "time_limit_seconds": 2400,
  "negative_marking": false,
  "max_attempts": 3,
  "shuffle_questions": true,
  "pricing_type": "free",
  "price": 0
}'
```

Practice sets must be **30–50 questions** — one generate run each, no assembly needed.

---

## 4. Tag it TNPSC — the step that makes it appear ★

```bash
# Mock
curl -X PATCH "$BASE/api/v1/evaluation/assessments/$ASSESSMENT_ID/tnpsc" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{
  "stage_id": "group-1-prelims",
  "track": "mock",
  "level": "simple",
  "subject_id": null,
  "topic_id": null
}'

# Practice
curl -X PATCH "$BASE/api/v1/evaluation/assessments/$ASSESSMENT_ID/tnpsc" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{
  "stage_id": "group-1-prelims",
  "track": "practice",
  "level": null,
  "subject_id": "indian-polity",
  "topic_id": "fundamental-rights-duties"
}'
```

**If §6.2 is not built yet**, tag directly in SQL to unblock testing:

```sql
UPDATE eval_assessments
   SET tnpsc_stage_id = (SELECT stage_id FROM tnpsc_stages WHERE code = 'group-1-prelims'),
       track          = 'mock',
       tnpsc_level    = 'simple'
 WHERE assessment_id  = '<uuid>';
```

```sql
UPDATE eval_assessments
   SET tnpsc_stage_id   = (SELECT stage_id FROM tnpsc_stages WHERE code = 'group-1-prelims'),
       track            = 'practice',
       tnpsc_subject_id = (SELECT s.subject_id FROM tnpsc_subjects s
                             JOIN tnpsc_stages st ON st.stage_id = s.stage_id
                            WHERE st.code = 'group-1-prelims' AND s.code = 'indian-polity'),
       tnpsc_topic_id   = (SELECT t.topic_id FROM tnpsc_topics t
                             JOIN tnpsc_subjects s ON s.subject_id = t.subject_id
                            WHERE s.code = 'indian-polity' AND t.code = 'fundamental-rights-duties')
 WHERE assessment_id = '<uuid>';
```

---

## 5. Publish

```bash
curl -X PATCH "$BASE/api/v1/evaluation/assessments/$ASSESSMENT_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"status": "published"}'
```

Only published/active papers count toward `tests_total`.

---

## 6. Verify

```bash
curl -H "Authorization: Bearer $USER_TOKEN" \
     "$BASE/api/v1/user/tnpsc/stages/group-1-prelims/mock-tests"
```

Expected after one Simple mock is published and tagged:

```json
{
  "stage_id": "group-1-prelims",
  "pass_percentage": 50.0,
  "levels": [
    { "level": "simple",  "is_unlocked": true,  "tests_total": 1, "tests_completed": 0,
      "tests": [ { "test_id": "…", "source": "assessment", "test_type": "mock", "level": "simple",
                   "question_count": 200, "time_limit_minutes": 180, "…": "…" } ] },
    { "level": "medium",  "is_unlocked": false,
      "lock_reason": "Score at least 50% in a Simple level mock test to unlock this level.",
      "tests_total": 0, "tests": [] },
    { "level": "complex", "is_unlocked": false, "tests_total": 0, "tests": [] }
  ]
}
```

Note how Medium/Complex **flip to locked** the moment a Simple mock exists — that is the gate
switching on, not a regression.

Checks if it still shows `tests_total: 0`:
1. Is `status` published/active?
2. Are `tnpsc_stage_id` **and** `track` both set? Either being null excludes the row.
3. Does the mock-tests query read `eval_assessments`, or only `tests`? It must union **both** tables —
   assessments created through the Evaluation Hub live in `eval_assessments` and must come back with
   `"source": "assessment"` so the portal routes to `/user/assessment/{id}`.
4. Is `pricing_type` free / does the user's tier satisfy `required_tier`? A tier-locked paper should
   still be listed, with `is_locked: true` — not filtered out.

---

## 7. Bulk production

For the full catalogue — 8 mocks per stage (3 Simple, 3 Medium, 2 Complex) and 95 practice sets
(45 topics for G1 Prelims + 50 for G4 Written) — that is ~120 generation runs. Script steps 1–5, or
build the two wrapper endpoints from the spec:

- `POST /api/v1/admin/tnpsc/mock-tests/generate` (§6.4) — builds the full-pattern paper, validates it and tags it in one call
- `POST /api/v1/admin/tnpsc/practice-tests/generate` (§6.5) — `scope: "all_topics"` generates a set per topic in one job

Both are P4 in the delivery plan. Until they exist, the loop above is the way.

**Prerequisite for either:** the question bank must be tagged with `tnpsc_subject_id` /
`tnpsc_topic_id` (§4.3), otherwise the generator has no pool to draw from and every run falls back
to open-ended LLM generation.
