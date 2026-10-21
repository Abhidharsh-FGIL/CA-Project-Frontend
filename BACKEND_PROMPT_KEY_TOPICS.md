# Backend task: accept the syllabus's printed topics (TNPSC Group 4) — "Key Topics"

You own the FastAPI service behind the evaluation hub and the aspirant portal. This brief is
self-contained. Attach `TNPSC_G4_SYLLABUS.json` from the frontend repo — it is the data to seed.

---

## 1. What the product does now

The aspirant portal has a **Key Topics** tab on each exam stage. Each printed section (General
Tamil, General English, General Studies, Aptitude & Mental Ability) is a dropdown; opening it lists
the syllabus topics that have a test, and pressing a topic starts that test.

An admin makes such a test in the Evaluation Hub: *Create assessment → Practice → Covers: **A key
topic*** → unit → topic. The paper is drawn from the question bank's questions for that topic only.

## 2. What goes wrong

Saving the placement fails:

```
PATCH /api/v1/evaluation/assessments/{id}/tnpsc
{ "stage_id": "group-4-written", "track": "practice", "scope": "unit",
  "unit_id": "g4-gs-geography", "subject_id": "geography",
  "topic_id": "forest-wildlife", "level": null, ... }

→ 404  "'Geography of India' has no topic 'forest-wildlife'."
```

The server validates `topic_id` against its own `tnpsc_topics` rows for the subject. Those rows are the
old catalog's (Geography of India has five: `physical-geography`, `climate-and-monsoon`,
`rivers-and-water-resources`, `agriculture-and-minerals`, `tamil-nadu-geography`). The syllabus the
commission prints, and that the portal shows, has **13** for Geography (`earth-location`,
`physical-features`, `forest-wildlife`, …). So every printed topic that is not also an old catalog topic
is refused, and the assessment is left created but unplaced.

Group 4 prints **235 topics**; the server's own list reaches about 175 of them by name (this is the same
gap as `BACKEND_WORK.md` item 12).

The frontend now works around the refusal (it saves the paper as a plain unit paper and reads the topic back
from the title), so nothing is blocked — but the topic is then held in a title string, which is fragile.
This task removes the need for that.

## 3. What to build

### P0 — Accept the printed topics

1. **Seed** every topic in `TNPSC_G4_SYLLABUS.json` — `sections[].units[].topics[]` (`id`, `name`) — as a
   row of `tnpsc_topics`, under the subject that unit belongs to:
   - the unit's `subject_ids[0]` when it has one (General Studies, Aptitude);
   - otherwise the section's subject: `general-tamil` for the seven Tamil units, `general-english` for
     the seven English units (those units carry no `subject_ids`; see `subjectForUnit` in
     `src/config/tnpsc.ts`).
2. `topic.id` → `tnpsc_topics.code` (the slug the frontend sends as `topic_id`); `topic.name` → `name`.
3. **Add, never remove.** Existing topic rows stay (old practice sets point at them). A printed topic whose
   `code` already exists under that subject is updated in place (`name`), not duplicated.
4. Make the seed **idempotent** and re-runnable (an upsert on `(subject_id, code)`), so a syllabus edit is
   a re-run, not a migration. Topic ids are unique within a subject across all units — checked against the
   file — so `(subject_id, code)` is a safe key.
5. Optional but useful: store the printed `unit_id` on the topic row, so a topic can say which unit prints it.

Counts to check the seed against (from the file):

| Subject code | Units | Printed topics |
|---|---|---|
| `general-tamil` | 7 | 71 |
| `general-english` | 7 | 60 |
| `general-science` | 1 | 14 |
| `geography` | 1 | 13 |
| `history-and-culture` | 1 | 10 |
| `indian-polity` | 1 | 18 |
| `indian-economy` | 1 | 20 |
| `tamil-nadu-history-and-society` | 1 | 13 |
| `aptitude-and-mental-ability` | 2 | 16 |
| **Total** | **22** | **235** |

If a subject code above does not exist on the server, create it first (`BACKEND_WORK.md` item 13).

### P0 — The same topics are accepted everywhere a topic is validated

- `PATCH /api/v1/evaluation/assessments/{id}/tnpsc`
- `PATCH /api/v1/admin/tests/{id}/tnpsc`
- `POST /api/v1/admin/tnpsc/bulk-tag` (targets `tests`, `assessments`, `questions`)
- `POST /api/v1/evaluation/assessments` — the inline `tnpsc_topic_id` on create

A key-topic paper is a **unit paper that names its topic**: `scope: "unit"`, `unit_id`, `subject_id`,
`topic_id`. Do **not** introduce a new scope value; the frontend sends exactly the body in §2.

### P0 — Return the topic

- `GET /api/v1/user/tnpsc/stages/{stage_id}/practice-tests` — every test carries `topic_id`, `topic_name`
  **and `unit_id`** (the portal files a topic under its unit; `BACKEND_WORK.md` item 4 asks for `unit_id` already).
- `GET /api/v1/evaluation/assessments` rows — `tnpsc_topic_id` and `tnpsc_unit_id`, so the admin list can tell a
  placed paper from an unplaced one.
- `GET /api/v1/user/tnpsc/catalog` — each subject's `topics` includes the new rows. (The frontend replaces its
  bundled topic list with the server's whenever the server sends one, so this must be the full list, old and new.)

### P1 — A refusal the frontend can read

When a topic is not a child of the subject, answer **422** with a machine-readable code instead of a 404
sentence:

```json
{ "detail": { "code": "TNPSC_TOPIC_MISMATCH",
              "message": "'Geography of India' has no topic 'forest-wildlife'.",
              "subject_id": "geography", "topic_id": "forest-wildlife" } }
```

The frontend recognises both this code and the current sentence, so this is a clean-up, not a blocker.

### P2 — Optional: stop matching questions to topics by name

The admin picker shows "N in bank" per topic by matching each bank question's `chapter` to the topic's name
(`src/lib/key-topics.ts`), which breaks on a stray spelling. If you store the topic on the question
(`tnpsc_topic_id`, via `bulk-tag` `target: "questions"`) and expose
`GET /api/v1/evaluation/questions/topic-counts?stage_id=&unit_id=`, the frontend can use the stored value. Not
needed for this task.

## 4. Acceptance

1. After the seed, the topics under the `group-4-written` stage's subjects number at least the 235 printed
   ones (the old catalog's extra rows stay), and re-running the seed changes nothing.
2. The request in §2 returns **200**, and the stored row reads back `tnpsc_topic_id = 'forest-wildlife'`,
   `topic_name = 'Forest and wildlife'`, `unit_id = 'g4-gs-geography'`.
3. The practice-tests list for `group-4-written` includes that paper with `topic_id: "forest-wildlife"`,
   `topic_name: "Forest and wildlife"`, `unit_id: "g4-gs-geography"`.
4. A topic under the wrong subject (`subject_id: "indian-polity"`, `topic_id: "forest-wildlife"`) is refused
   with `422 TNPSC_TOPIC_MISMATCH`.
5. Every `(unit, topic)` pair in the JSON is accepted by the PATCH above — loop over the file and PATCH a
   throwaway assessment with each; none may be refused.

## 5. Nothing else changes on the frontend

When this ships the portal and the admin form need no change: the key-topic paper is stored with its topic,
the Key Topics tab reads `topic_id` from the list, and the title fallback
(`src/lib/tnpsc-title-placement.ts`) simply stops being used. Frontend tests that describe the behaviour:
`src/lib/tnpsc-unit-tagging.test.ts` (*a key-topic paper*, *a key topic the server has no row for*),
`src/lib/tnpsc-title-placement.test.ts`, `src/lib/key-topic-sections.test.ts`.
