# Edit the difficulty mix of a saved assessment

Admin → Evaluation Hub → Assessments now has a **Difficulty** button on three kinds of assessment:

- **Mock tests** (`track: "mock"`)
- **Full sets**: a whole section (`track: "practice"`, `tnpsc_scope: "section"`)
- **Mixed unit and key-topic sets**: `track: "practice"`, `tnpsc_scope: "unit"` (with or without `tnpsc_topic_id`) and **no** `tnpsc_level`

It opens a dialog where the admin sets Simple / Medium / Complex percentages (they must add up to 100) and saves.
Today the mix is only used once, in the browser, when the paper is first created: the questions are picked to the mix
and saved as a fixed `question_ids` list. The mix itself is not stored and cannot be changed later, so this needs
the backend.

## 1. New endpoint

```
PATCH /api/v1/evaluation/assessments/{assessment_id}/blend
Authorization: Bearer <admin token>

{ "difficulty_blend": { "easy": 20, "medium": 30, "hard": 50 } }
```

**Validation**

- `easy`, `medium`, `hard` are whole numbers from 0 to 100 and add up to 100. Otherwise answer `422`.
- Only for the three kinds above. For a unit set pitched at one level, answer `422` (`code: "BLEND_NOT_APPLICABLE"`).
- `404` if the assessment does not exist or is not in the admin's org.

**What it does**

1. Store the mix on the assessment (`difficulty_blend`, a JSON column or three integer columns).
2. Draw the paper's questions again to the new mix, from the **same pool the paper was made from**:
   - the same units (`unit_ids`) and unit weights (`unit_weights`), the same collections (`paper_ids` / `paper_weights`),
     and the same filters in `pool_filter` (question types, source type);
   - the same `question_count`;
   - apply the mix **inside each unit** (each unit gets its weighted share, and that share is split Simple / Medium /
     Complex by the mix), the same way the frontend composes a new paper;
   - where a band runs short, fill the remaining slots from the other bands, so the paper keeps its question count,
     and report the shortfall.
3. Replace the assessment's `question_ids` with the new set, and recalculate `max_score` from the new questions' marks.
4. If the assessment is a **live pool** (`pool_mode: "live"`), there is no fixed set to replace. Store the mix and use it
   when each attempt draws its questions.
5. **Do not touch attempts already taken**, whether finished or in progress. They keep the questions they were given.
   Only new attempts get the new set.

**Response** `200`

```json
{
  "id": "…",
  "difficulty_blend": { "easy": 20, "medium": 30, "hard": 50 },
  "question_count": 200,
  "max_score": 300,
  "distribution": { "easy": 40, "medium": 60, "hard": 100 },
  "shortfall": { "hard": 0 },
  "message": null
}
```

- `distribution`: how many questions of each difficulty the paper now holds.
- `shortfall`: how many were missing in a band and made up from the others. The frontend shows a warning when any
  value is above 0, using `message` if one is given.

## 2. Return the mix on the assessment

Add `difficulty_blend` (`{ easy, medium, hard }` or `null`) to:

- `GET /api/v1/evaluation/assessments` (each row), so the card shows it, e.g. "Mixed 20/30/50";
- `GET /api/v1/evaluation/assessments/{id}`.

`null` means the paper was made before the mix was stored. The dialog then opens on the standard 30 / 30 / 40.

## 3. Optional: store the mix on create

`POST /api/v1/evaluation/assessments` can also accept `difficulty_blend` (the same shape). The frontend can then send the
mix chosen at creation, so it is on record from the start rather than only after the first edit. This is a frontend
one-liner once the backend accepts the field.

## Frontend status

Built and waiting for the endpoint. Until it exists, saving shows "Changing the mix of a saved assessment is not
available on the server yet." (on a `404` or `405`), and nothing else changes.
