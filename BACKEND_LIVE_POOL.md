# Deleted collections and live question pools — backend changes

Observed 14 Oct 2026, on one assessment ("TNPSC Group 4 — Aptitude · Medium", 30 questions):

1. **A deleted collection's questions still appear.** The collection was deleted in the Question Bank;
   its questions were still served in the assessment.
2. **New questions do not reach existing papers.** A unit holds 100 Medium questions; 50 more are
   uploaded. A student starting the Medium paper for that unit should be able to get any of the 150.
   They get only the original 100.

Both have **one cause**: an assessment stores a photograph of the question bank — its `question_ids`
list, taken the day it was created. Every attempt is sampled from that list, and the questions are
then loaded by id with no check that they still exist or are still live.

## Status

| | | |
|---|---|---|
| **A, B** — a deleted collection's questions are never dealt | **Done in the local backend copy**, tested, **not deployed** | `app/services/attempt_questions.py`, `app/routers/user/eval_assessments.py`, `app/routers/evaluation/assessments.py`, `tests/test_attempt_questions.py` |
| **C** — live pools | **Done in the local backend copy**, 34 tests, **not deployed**. Needs `scripts/add_pool_columns.sql` run once | below |
| **D** — `question_count` rewrite on add / remove | Not started | below |
| **E** — switching existing papers to live | SQL written (Part 2 of `scripts/add_pool_columns.sql`), **not run** | below |

Nothing changes on the live site until the backend is deployed with the A / B change.

**The server the portal talks to is not the code in `D:\GKR\New TNPSC\ca-project`.** Its question
payload carries `unit_id`, which no branch of that repository defines. So the change below was written
against an older copy, and `BACKEND_PATCH_live_questions.patch` (it applies cleanly to that copy's
`HEAD`, 7fe92bb) is a *reference* for the three places to change, not a file to copy over. Apply the
same three changes to the deployed code:

1. a `live_question_ids(db, ids)` lookup — a question is live when it exists and has no collection or
   an active one (the same join the question bank's list uses);
2. `_build_attempt_question_ids` — draw only from live ids, and refuse an empty deal before the
   attempt row is created (both the signed-in and the public-link start);
3. resume of an open attempt — drop dead questions the student never answered and top back up.

To see whether the deployed server applies it: press Begin / Resume on a paper and read `skipped_deleted`
in the `start` response. The dev build also prints it to the browser console as `[start] ...`.

> **Read this against the deployed code.** The notes below come from the backend copy at
> `D:\GKR\New TNPSC\ca-project` (last commit 21 Sep). It predates `unit_ids` / `unit_weights`, which
> your live API already returns, so confirm each point against what is deployed.

---

## What the code does today

| Where | What it does | Consequence |
|---|---|---|
| `routers/evaluation/papers.py` `delete_paper` | `paper.is_active = False` — **nothing else** | The paper's questions stay in `eval_questions`, untouched |
| `routers/evaluation/excel_paper.py` `delete_excel_paper` | `record.is_active = False` ("Soft: the rows stay") | Same |
| `routers/evaluation/questions.py` list | Joins `eval_papers` and keeps only active papers | The *bank* hides them — which is why a collection looks gone |
| `routers/user/eval_assessments.py` `_build_attempt_question_ids` | `random.sample(assessment.question_ids, question_count)` | Samples only the frozen list, never the bank |
| `routers/user/eval_assessments.py` attempt start | `select(EvalQuestion).where(question_id.in_(ids))` | **No liveness check** — a retired paper's questions load like any other |
| `routers/evaluation/questions.py` `delete_question` | `db.delete(question)` (hard delete) | The id stays in every assessment; it is silently skipped at load, so the paper runs short, and past reports lose the question |
| `routers/evaluation/assessments.py` add-questions | `assessment.question_count = len(current_ids)` | Adding questions to a "30 per attempt" pool makes it "all N per attempt" |

`EvalQuestion` has no `is_active`; its only link to a collection is `paper_id` (FK `ON DELETE
CASCADE`, which never fires because the paper is only soft-deleted).

---

## A + B. A deleted collection's questions are never dealt — *done, ~1h to deploy*

**What was built** — a rule applied when questions are *read*, with no migration:

* A question is **live** when it exists and either belongs to no collection or to one that has not
  been deleted (`eval_papers.is_active`). That is exactly the test the question bank's own list
  already applies (`routers/evaluation/questions.py`), so a collection that looks gone in the bank is
  now gone from the tests too. `live_question_ids()` in `app/services/attempt_questions.py`.
* **A new attempt** (both the signed-in student flow and the public invitation-link flow) is dealt only
  from live questions. A paper whose questions are all dead answers `400 No questions available` —
  *before* the attempt row is created, so it does not count against the student's attempt limit.
* **An attempt already open** is refreshed when it is resumed: dead questions the student never answered
  are dropped and replaced from the paper's live pool, so a 30-question paper stays 30 where the pool
  has the spare. A dead question they **did** answer stays — the answer is theirs. The refreshed list is
  saved on the attempt, so the score is out of what they were actually shown.
* **Nothing is rewritten.** The assessment's own `question_ids` are left alone, so **restoring** a
  collection brings its questions straight back into every paper that held them. Finished attempts
  keep their questions, so reports read as they were sat.

**Why no `is_active` column on questions.** A column would be the cleaner long-term design and is still
worth doing — it makes the rule one flag rather than a join — but it needs a migration and a backfill
for every collection already deleted, and the join gives the identical result today. If the column is
added later, change the one query in `live_question_ids()` and nothing else.

**Not covered by this change**

* `delete_question` still hard-deletes a single question. Its id then stays in every assessment and is
  skipped silently, so a paper can run short, and reports of past attempts lose that question. Retire it
  (`is_active = false`) instead of `db.delete` once the column exists.
* The admin's assessment detail still counts the ids it holds, dead ones included. Students are
  unaffected; the admin may see a larger number than a student is dealt from.
* Return what a delete did — `questions_retired` and `assessments_affected` — and accept
  `?dry_run=true`, so the delete dialog can show real numbers. (Optional; the dialog is honest without.)

## C. Live pools — the feature — *done in the local backend copy, ~2h to deploy*

A paper made as a pool — "any 30 of the Medium Aptitude questions" — is not a fixed set, so it says so,
and each attempt is drawn from **the stored questions plus whatever in the bank matches its rule now**.
Nothing leaves the pool except what is deleted; new questions join it.

### C.1 What was built

| Piece | Where |
|---|---|
| Two columns on `assessments`: `pool_mode` (`'fixed'` default / `'live'`) and `pool_filter` (JSON) | `app/models/assessment.py`, **`scripts/add_pool_columns.sql` (run once, by hand)** |
| Accepted on `POST /evaluation/assessments`, stored, and returned on the list and detail | `app/schemas/assessment.py`, `app/routers/evaluation/assessments.py` |
| `pool_rule`, `matching_statement`, `matching_question_ids`, `pool_ids_for` | `app/services/attempt_questions.py` |
| Used by the signed-in start, the public-link start, and resume of an open attempt | `app/routers/user/eval_assessments.py`, `app/routers/evaluation/assessments.py` |
| The start response also reports `pool_size` and `skipped_deleted` | same |
| 34 tests, including the scenario below | `tests/test_attempt_questions.py` |

The create call sends `question_ids` exactly as before, so a server that ignores `pool_mode` loses nothing.

### C.2 The rule

`pool_filter`, as the frontend sends it (see *What the frontend sends*). Every field may be null.

A bank question **joins the pool** when it is live, belongs to the paper's organisation, matches
`difficulty` / `question_types` / `source_type` where given, **and any one of**:

| Route | Meaning | Why it exists |
|---|---|---|
| `unit_id IN unit_ids` | tagged to one of the paper's units | exact; what a sheet with a **Unit** column gets (item 7) |
| `unit_id IS NULL` **and** `lower(subject) IN subjects` **and** `lower(chapter) IN chapters` | not tagged to any unit, but of a subject *and* topic the paper already holds | a question added **by hand** carries a subject and a topic and no unit — the app's "Add question" dialog has no unit field — and this is how it finds its neighbours' paper |
| `paper_id IN paper_ids` | in a collection the paper was made from | a pool made of whole collections |

* `subjects` and `chapters` are only used **together**: a subject alone ("Aptitude & Mental Ability")
  spans both the Aptitude and the Reasoning unit and cannot say which a new question belongs to.
* The comparison is case-insensitive, on the text as stored on the question.
* A deployment whose questions have no `unit_id` column simply has no first route — the code checks
  for the column rather than assuming it.
* **Limit, stated plainly:** a hand-added question with a *new* topic (one no question in the paper
  has) and no unit does not join. Give it a unit — a sheet with the Unit column, or edit it — or
  recreate the paper.

### C.3 Resolving an attempt

At the start of a **new** attempt, and when an **open** attempt is resumed:

1. `pool` = the stored `question_ids`, then the bank's matches that are not already in it.
2. `live` = those of `pool` that exist and are not in a deleted collection (**A + B**).
3. Deal `min(question_count, len(live))` at random from `live`. `question_count` keeps meaning
   "questions per attempt"; the pool may be far larger.
4. If the rule's lookup fails for any reason it is logged and the paper falls back to its stored
   questions — a bad rule must never turn a working test into an empty one. (The lookup runs in a
   savepoint, so a failed statement cannot poison the attempt's transaction.)

Not done, deliberately: the stored `question_ids` are not rewritten as the pool grows, so the admin's
question list for the paper still shows what it was made with. The start response's `pool_size` is the
live count.

### C.3a Not in this phase

Papers that are **composed** — a full mock, a section's full set, a "Mixed" unit paper — are built by
the frontend to the exam's unit split and a 20 / 30 / 50 difficulty blend, and are sent as
`pool_mode: 'fixed'`. Making those live means the server re-composing per attempt. That is a larger
piece of work; do it once this is proven. Until then a composed paper is changed by recreating it.

## D. Adding or removing a question must not rewrite `question_count` — *bug, ~30 min*

`POST /assessments/{id}/questions` sets `question_count = len(current_ids)`. For a pool that is wrong:
a 30-per-attempt paper with 100 ids becomes 130 per attempt the moment one question is added. Only
change `question_count` when it was equal to the old length (i.e. the paper used every id it had).
Same for the `DELETE …/questions/{qid}` route.

## E. Existing assessments

They default to `fixed` and keep working — with the dead-question filter from **B**, but without
any new questions reaching them, because they carry no rule.

`scripts/add_pool_columns.sql` **Part 2** gives the single-level unit papers a rule — practice,
shuffled, placed on units, titled `… · Simple`, `… · Medium` or `… · Complex`. It starts with a
read-only preview and the `UPDATE` is wrapped for `BEGIN … COMMIT / ROLLBACK`. It was **written but
not run** against a real database.

**Select by the title suffix, not by `difficulty`.** The pasted assessment list shows why:
`TNPSC Group 4 — Indian Polity · Mixed` is stored with `difficulty: "medium"`, while
`… Geography · Mixed` is stored with `"mixed"`. A rule keyed on `difficulty = 'medium'` would turn
those 20 / 30 / 50 blends into all-Medium pools. The wizard writes the level into the title, so the
title says what the paper really is.

`TNPSC Group 4 — Aptitude · Medium` is exactly such a paper. Full sets (`· Full Set`, several units
with `unit_weights`), Mixed papers and every mock are composed and stay `fixed`.

---

## Checks that tell you it works

The dealing rules are covered by `tests/test_attempt_questions.py` (34 tests, run against fakes). Run
these against a real database before deploying, and read `pool_size` / `skipped_deleted` in the
`start` response (the dev build prints them as `[start] …`).

1. **Delete a collection.** A live Medium paper whose unit has 40 questions from collection X. Delete
   X. Start an attempt: none of the 40 is dealt; `skipped_deleted` is 40.
2. **Upload more.** Add 50 Medium questions to the unit — by sheet with the Unit column, and by hand
   with an existing subject and topic. `pool_size` grows by 50; over several new attempts some of
   them are dealt. An attempt already in progress is unchanged until it is resumed.
3. **A paper whose questions all died** (the case that was reported): it answers
   `400 No questions available` until questions are added — then it works again, with no need to
   recreate it.
4. **Restore X.** `pool_size` is back to what it was.
5. **A fixed paper** behaves as before, except that dead questions are skipped.
6. **Break the rule** (a unit nothing matches). The paper deals from its stored questions rather
   than failing.
7. **A hand-added question with a new topic and no unit** does *not* join — expected; see C.2.

---

## What the frontend sends

Only for papers made as a pool — a shuffled paper taken from the bank or from whole collections that
is **not** composed. Everything else is sent as `"pool_mode": "fixed"` with `"pool_filter": null`.
`question_ids` is sent exactly as before, so an older server loses nothing.

```json
{
  "title": "TNPSC Group 4 — Aptitude · Medium",
  "question_ids": ["…the matching questions, as they are today…"],
  "question_count": 30,
  "shuffle_questions": true,
  "unit_ids": ["g4-apt-aptitude"],
  "pool_mode": "live",
  "pool_filter": {
    "stage_id": "group-4-written",
    "unit_ids": ["g4-apt-aptitude"],
    "subjects": ["Aptitude & Mental Ability", "Aptitude"],
    "chapters": ["Percentage", "Ratio & Proportion", "Area"],
    "paper_ids": null,
    "difficulty": "medium",
    "question_types": null,
    "source_type": "online"
  }
}
```

`subjects` and `chapters` are the distinct subjects and topics **of the questions in the paper**, as
stored on them — the server lower-cases both sides when it compares. The rule that builds this is
`src/lib/assessment-pool.ts` (`describePool`); its tests are `src/lib/assessment-pool.test.ts`.

---

## Until this ships — what an admin can do

* **A stale paper:** remove its dead questions in the assessment's detail view, or recreate the paper
  (the wizard draws from the live bank, which already hides deleted collections).
* **Do not** use "add questions" on a pool paper to refresh it — see **D**; it changes the paper's size.
* **Deleting a collection** removes it from the bank and from new assessments only, *until the A / B
  change is deployed* — then it also removes its questions from every test students take.

When **A / B** ships, update the delete dialog in `EvalPapersList.tsx` (it says assessments "may still
contain its questions") and show `assessments_affected` from the response.
