# GAT-B — backend changes required

The aspirant portal now renders **GAT-B** (Graduate Aptitude Test — Biotechnology)
as a third examination alongside TNPSC Group 1 and Group 4.

The frontend ships independently. `getTnpscCatalog` merges the server payload over the
bundled catalog in [`src/config/tnpsc.ts`](src/config/tnpsc.ts) field by field, so
GAT-B renders today even though the catalog endpoint has never heard of it — see
§9 for what that merge does and does not buy you.

This document is the delta against [`TNPSC_API_SPEC.md`](TNPSC_API_SPEC.md). Section
numbers below refer to that spec.

---

## 0. Why GAT-B does not fit the existing shape

Three assumptions baked into the TNPSC contract are false for GAT-B. Each drives a
schema change below.

| Assumption (true for TNPSC) | GAT-B reality |
|---|---|
| Every printed question is answered | 160 printed, **120 answered** — Section B offers a choice of 60 out of 100 |
| One negative-mark value for the whole paper | Section A deducts **0.5**, Section B deducts **1** |
| Every question carries equal marks | Section A is **1 mark**, Section B is **3 marks** |
| The exam body is TNPSC | Conducted by **NTA** for **DBT / RCB** |

> **Do not** model the Section B choice by storing 60 questions. The paper prints 100
> and the candidate picks; storing 60 loses the other 40 and makes `total_questions`
> disagree with the printed paper.

---

## 1. Enum widening (§3)

```diff
-type TnpscGroupCode = 'group-1' | 'group-4';
-type TnpscStageCode = 'group-1-prelims' | 'group-1-mains' | 'group-4-written';
+type TnpscGroupCode = 'group-1' | 'group-4' | 'gat-b';
+type TnpscStageCode = 'group-1-prelims' | 'group-1-mains' | 'group-4-written' | 'gat-b-exam';
```

`TnpscLevel` (`simple`/`medium`/`complex`) and `TnpscTrack` (`mock`/`practice`) are
**unchanged** — GAT-B uses the same level progression and the same two tracks.

Every endpoint that validates `group_id` / `stage_id` against these enums must accept
the new codes: §5.2, §5.3, §5.4, §6.2, §6.3, §6.6, §7.8 and the `?group_id=` /
`?stage_id=` filters in §9.

---

## 2. Database changes (§4)

### 2.1 `tnpsc_groups` — two new columns

```sql
ALTER TABLE tnpsc_groups
  ADD COLUMN authority VARCHAR(128),   -- conducting body, shown as the card eyebrow
  ADD COLUMN exam_type VARCHAR(64);    -- the generator's `test_type` for this group

UPDATE tnpsc_groups SET
  authority = 'Tamil Nadu Public Service Commission',
  exam_type = 'TNPSC ' || short_name
WHERE code IN ('group-1','group-4');

ALTER TABLE tnpsc_groups
  ALTER COLUMN authority SET NOT NULL,
  ALTER COLUMN exam_type SET NOT NULL;
```

`authority` was previously hardcoded in the UI as "Tamil Nadu Public Service
Commission" and is now read off the group — a non-TNPSC exam cannot use it.

`exam_type` must match a value in `BOARDS` ([`src/constants.ts`](src/constants.ts))
and a key of `EXAM_SYLLABUS` ([`src/data/examSyllabus.ts`](src/data/examSyllabus.ts)).
It was previously composed as `` `TNPSC ${short_name}` ``, which would have produced
the nonsensical `"TNPSC GAT-B"`.

### 2.2 `tnpsc_stages` — the answered-question count

```sql
ALTER TABLE tnpsc_stages
  ADD COLUMN total_attempted INT;   -- NULL when every printed question is mandatory
```

NULL for all three TNPSC stages; `120` for `gat-b-exam`.

### 2.3 `tnpsc_sections` — per-section choice and marking

```sql
ALTER TABLE tnpsc_sections
  ADD COLUMN attempt             INT,           -- answer any N of question_count; NULL = all
  ADD COLUMN marks_per_question  NUMERIC(4,2),  -- NULL = uniform across the paper
  ADD COLUMN negative_mark_value NUMERIC(4,2);  -- overrides tnpsc_stages.negative_mark_value
```

All three are NULL for existing TNPSC sections, so current behaviour is unchanged.

---

## 3. Seed data (§10.1)

### `tnpsc_groups`

| code | name | short_name | authority | exam_type | accent | display_order |
|---|---|---|---|---|---|---|
| `gat-b` | GAT-B | GAT-B | DBT · Regional Centre for Biotechnology (NTA) | `GAT-B` | `from-lime-500 via-green-500 to-emerald-600` | 3 |

- **tagline** — `Graduate Aptitude Test — Biotechnology`
- **description** — `Entrance to DBT-supported postgraduate biotechnology programmes (M.Sc./M.Tech./M.V.Sc.) across the participating universities, with the DBT-JRF linked studentship.`
- **posts** — `["M.Sc. Biotechnology", "M.Tech. Biotechnology", "M.V.Sc. Animal Biotechnology", "M.Sc. Agricultural Biotechnology"]`

### `tnpsc_stages`

| column | value |
|---|---|
| `code` | `gat-b-exam` |
| `name` | Graduate Aptitude Test — Biotechnology |
| `short_name` | GAT-B |
| `status` | `active` |
| `paper_type` | `objective` |
| `total_questions` | `160` |
| `total_attempted` | `120` |
| `total_marks` | `240` |
| `duration_minutes` | `180` |
| `negative_marking` | `true` |
| `negative_mark_value` | `NULL` — both sections override it |
| `bilingual` | `false` |
| `secondary_language` | `NULL` |

> GAT-B is **English-only**. It must not go through the bilingual duplication path
> that both TNPSC objective stages use — no Tamil half, no repeated question numbers.

### `tnpsc_sections`

| name | question_count | attempt | marks | marks_per_question | negative_mark_value | order |
|---|---|---|---|---|---|---|
| Section A — 10+2 Level | 60 | `NULL` (all) | 60 | 1 | 0.5 | 1 |
| Section B — Graduate Level | 100 | 60 | 180 | 3 | 1 | 2 |

Arithmetic to assert in a migration test: `60×1 + 60×3 = 240` marks;
`60 + 100 = 160` printed; `60 + 60 = 120` answered.

---

## 4. Subject and topic slugs (§10.2)

16 subjects under `gat-b-exam`, matched **exactly** (case-sensitive) by the frontend.
Source of truth is `GATB_SECTION_A_SUBJECTS` / `GATB_SECTION_B_SUBJECTS` in
[`src/config/tnpsc.ts`](src/config/tnpsc.ts) — copy from there rather than retyping.

### Section A — 10+2 level (60 questions)

| subject slug | name | Qs | topic slugs |
|---|---|---|---|
| `physics-12` | Physics (10+2) | 15 | `mechanics`, `thermodynamics-and-kinetic-theory`, `optics-and-waves`, `electricity-and-magnetism`, `modern-physics` |
| `chemistry-12` | Chemistry (10+2) | 15 | `atomic-structure-and-bonding`, `physical-chemistry`, `organic-chemistry`, `inorganic-chemistry`, `biomolecules-basics` |
| `mathematics-12` | Mathematics (10+2) | 15 | `algebra`, `calculus`, `coordinate-geometry`, `probability-and-statistics`, `matrices-and-determinants` |
| `biology-12` | Biology (10+2) | 15 | `cell-structure-and-function`, `plant-physiology`, `human-physiology`, `genetics-and-evolution-basics`, `biology-in-human-welfare` |

### Section B — graduate level (100 printed, 60 answered)

| subject slug | name | Qs | topic slugs |
|---|---|---|---|
| `biochemistry` | Biochemistry | 12 | `carbohydrates-and-lipids`, `proteins-and-amino-acids`, `enzymes-and-kinetics`, `metabolism-and-bioenergetics`, `vitamins-and-hormones` |
| `cell-biology` | Cell Biology | 8 | `membrane-structure-and-transport`, `organelles-and-cytoskeleton`, `cell-cycle-and-division`, `cell-signalling`, `apoptosis-and-cancer-biology` |
| `genetics` | Genetics | 15 | `mendelian-genetics`, `linkage-and-mapping`, `mutations-and-repair`, `population-genetics`, `human-and-medical-genetics` |
| `molecular-biology-and-rdna` | Molecular Biology & rDNA Technology | 18 | `dna-replication`, `transcription-and-translation`, `gene-regulation`, `cloning-vectors-and-hosts`, `pcr-and-blotting`, `sequencing-and-genome-editing` |
| `microbiology` | Microbiology | 10 | `microbial-classification`, `microbial-growth-and-nutrition`, `microbial-genetics`, `virology`, `industrial-and-food-microbiology` |
| `immunology` | Immunology | 8 | `innate-and-adaptive-immunity`, `antigens-and-antibodies`, `mhc-and-antigen-presentation`, `hypersensitivity-and-autoimmunity`, `vaccines-and-immunotechniques` |
| `plant-biotechnology` | Plant Biotechnology | 6 | `tissue-culture-and-micropropagation`, `transgenic-plants`, `plant-molecular-markers`, `secondary-metabolites` |
| `animal-biotechnology` | Animal Biotechnology & Cell Culture | 6 | `animal-cell-culture`, `transgenic-animals`, `stem-cells-and-cloning`, `monoclonal-antibodies` |
| `bioprocess-engineering` | Bioprocess Engineering & Technology | 7 | `bioreactor-design`, `fermentation-and-kinetics`, `sterilisation-and-media`, `downstream-processing`, `enzyme-immobilisation` |
| `bioinformatics-and-biostatistics` | Bioinformatics & Biostatistics | 5 | `biological-databases`, `sequence-alignment`, `phylogenetics`, `descriptive-statistics`, `hypothesis-testing` |
| `ecology-and-evolution` | Ecology, Evolution & Biodiversity | 3 | `ecosystems-and-energy-flow`, `population-and-community-ecology`, `evolutionary-mechanisms`, `conservation-and-biodiversity` |
| `analytical-techniques` | Analytical Techniques | 2 | `chromatography`, `electrophoresis`, `spectroscopy`, `centrifugation`, `microscopy-and-imaging` |

Section A sums to 60, Section B to 100, total 160 — matching `total_questions`.
Genetics + Molecular Biology/rDNA carry 33 of Section B's 100, in line with the
30–35% weightage those areas are given in practice.

---

## 5. Question generator — the `GAT-B` test type

`test_type: "GAT-B"` is sent verbatim by
[`examTypeLabel`](src/lib/tnpscAdminApi.ts) and must switch the generator into
GAT-B style:

| | TNPSC Group 1 / 4 | **GAT-B** |
|---|---|---|
| Options per question | 5, including `விடை தெரியவில்லை` as option E | **4** (A–D), no "don't know" option |
| Language | bilingual, every question repeated in Tamil | **English only** |
| Negative marking | none | **yes, per section** (see §2.3) |
| Question level | single level per paper | **Section A is 10+2, Section B is graduate** — the section decides, not the difficulty level |

The last row is the one most likely to be missed. A GAT-B paper mixes two academic
levels in one paper: a `physics-12` question must be pitched at Class 12, while a
`molecular-biology-and-rdna` question must be pitched at a B.Sc./B.Tech. graduate.
The portal's `simple`/`medium`/`complex` level is orthogonal to this — it varies
difficulty *within* the section's academic level.

---

## 6. Scoring a GAT-B attempt

Two rules differ from every existing paper.

**Per-section negative marking.** Resolve the deduction as
`section.negative_mark_value ?? stage.negative_mark_value ?? 0`. A wrong Section A
answer costs 0.5; a wrong Section B answer costs 1. Unanswered questions cost nothing.

The admin panel now sends this on assessment create as **`negative_mark_sections`**:

```jsonc
{
  "negative_marking": true,
  "negative_mark_value": 0.5,          // least punitive section — the lenient fallback
  "negative_mark_sections": [
    { "name": "Section A — 10+2 Level",     "subject_ids": ["physics-12", "chemistry-12", "mathematics-12", "biology-12"],
      "questions": 60,  "negative_mark_value": 0.5, "marks_per_question": 1 },
    { "name": "Section B — Graduate Level", "subject_ids": ["biochemistry", "cell-biology", "genetics", "..."],
      "questions": 100, "attempt": 60, "negative_mark_value": 1, "marks_per_question": 3 }
  ]
}
```

Match a question to its section by its **subject slug** against `subject_ids` — not by
question index, which breaks the moment questions are shuffled (and shuffling is on by
default). A question whose subject matches no section falls back to
`negative_mark_value`.

Note the flat `negative_mark_value` is deliberately the **least** punitive section, not
an average: a backend that ignores `negative_mark_sections` then under-penalises rather
than inventing lost marks. Once §6 is implemented the flat value is only a fallback for
unmatched questions.

**Marks per question** are already carried per question as `points` (1 for Section A, 3
for Section B), stamped at import from the same `subject_ids` mapping, and `max_score`
is their sum. No backend change is needed for the 1-vs-3 weighting.

**Answer any 60 of 100 in Section B.** The candidate may leave 40 Section B questions
blank with no penalty — blank is not wrong. If a candidate answers *more* than 60,
decide and document a rule; the pragmatic one is to score the first 60 in question
order and ignore the rest, but the cleanest is to prevent it in the take-flow by
locking further Section B answers once 60 are filled.

`percentage` stays 0–100 against the 240-mark maximum, per §2. Since negative marking
can push a raw score below zero, clamp to 0 before computing the percentage — the
level gate (`LEVEL_PASS_PERCENTAGE = 50`) and the trend charts assume 0–100.

---

## 7. Catalog payload (§5.1)

`GET /api/v1/user/tnpsc/catalog` gains a third group. New fields are `authority`,
`exam_type`, `total_attempted`, and the three per-section fields.

```jsonc
{
  "id": "gat-b",
  "name": "GAT-B",
  "short_name": "GAT-B",
  "authority": "DBT · Regional Centre for Biotechnology (NTA)",
  "exam_type": "GAT-B",
  "tagline": "Graduate Aptitude Test — Biotechnology",
  "description": "Entrance to DBT-supported postgraduate biotechnology programmes …",
  "accent": "from-lime-500 via-green-500 to-emerald-600",
  "posts": ["M.Sc. Biotechnology", "M.Tech. Biotechnology", "M.V.Sc. Animal Biotechnology", "M.Sc. Agricultural Biotechnology"],
  "stages": [
    {
      "id": "gat-b-exam",
      "group_id": "gat-b",
      "name": "Graduate Aptitude Test — Biotechnology",
      "short_name": "GAT-B",
      "description": "Single objective paper. Section A is 60 compulsory 10+2-level questions; Section B prints 100 graduate-level questions of which any 60 are answered.",
      "status": "active",
      "paper_type": "objective",
      "bilingual": false,
      "secondary_language": null,
      "pattern": {
        "total_questions": 160,
        "total_attempted": 120,
        "total_marks": 240,
        "duration_minutes": 180,
        "negative_marking": true,
        "sections": [
          { "name": "Section A — 10+2 Level",      "questions": 60,  "marks": 60,  "marks_per_question": 1, "negative_mark_value": 0.5 },
          { "name": "Section B — Graduate Level",  "questions": 100, "attempt": 60, "marks": 180, "marks_per_question": 3, "negative_mark_value": 1 }
        ]
      },
      "subjects": [ /* the 16 subjects of §4, each with its topics */ ]
    }
  ]
}
```

The client tolerates the new fields being absent — it falls back to the local catalog
— but a server catalog that omits `authority` will render an empty card eyebrow.

---

## 8. Checklist

- [ ] §1 — widen `TnpscGroupCode` / `TnpscStageCode`, accept them in every validator
- [ ] §2.1 — `tnpsc_groups.authority`, `tnpsc_groups.exam_type` (+ backfill TNPSC rows)
- [ ] §2.2 — `tnpsc_stages.total_attempted`
- [ ] §2.3 — `tnpsc_sections.attempt`, `marks_per_question`, `negative_mark_value`
- [ ] §3 — seed the `gat-b` group, `gat-b-exam` stage and its 2 sections
- [ ] §4 — seed 16 subjects and their topics
- [ ] §5 — generator handles `test_type: "GAT-B"` (4 options, English, two academic levels)
- [ ] §6 — scoring honours per-section deductions and the 60-of-100 choice; clamp at 0
- [ ] §7 — catalog endpoint returns the third group with the new fields
- [ ] Admin tagging (§6.2/§6.3/§7.8) accepts `gat-b` / `gat-b-exam`


---

## 9. What works before any of this lands

The catalog merge (§10) means GAT-B is **visible and navigable now**. It is not yet
**correct**. Three different things are being conflated whenever someone asks "does
this need the backend?", so they are separated here.

### Works today, no backend change

| | Notes |
|---|---|
| GAT-B card on `/user/exams` and the dashboard | Appended by the merge; carries its own `authority` |
| Group and stage pages, pattern header, section chips | `120 of 160`, `any 60 of 100`, `−0.5 / −1 per wrong answer` |
| Syllabus subjects and topics in the practice track | From the bundled catalog |
| Generating a paper with Test Type `GAT-B` | Subject/chapter autocomplete is wired via `EXAM_SYLLABUS` |
| An aspirant opening and attempting a GAT-B paper | Through the existing eval-assessment take flow |

**Interim placement without the tagging API.** `PATCH /evaluation/assessments/{id}/tnpsc`
will reject `group_id: "gat-b"` until §1 lands, but that failure is non-fatal — the
assessment is still created and a warning toast is shown. Meanwhile the client derives
placement from the paper **title** (`STAGE_KEYWORDS` in
[`src/lib/tnpscApi.ts`](src/lib/tnpscApi.ts)), so any paper whose title contains
**`GAT-B`**, `GAT B`, `GATB` or `Biotechnology Aptitude` lands in the GAT-B stage on
its own. Adopt that title convention and GAT-B is pilotable before a single migration
runs.

### Degraded until the backend catches up

| Gap | Effect |
|---|---|
| Generator does not know `test_type: "GAT-B"` (§5) | May 400 on an unknown value, or silently generate in TNPSC style — 5 options with a Tamil "don't know", wrong for GAT-B. **Generate one paper and look at it before trusting this.** |
| Tagging rejects the codes (§1) | Placement rests on the title convention above; a renamed paper silently leaves the stage |
| Catalog endpoint omits the group (§7) | GAT-B is client-only — invisible to any other consumer of the API |

### Actually blocking a correct GAT-B mock

These two cannot be worked around from the frontend:

1. **The 60-of-100 choice in Section B (§6).** The take flow presents every question as
   answerable, so a candidate can answer all 100 and be scored on all 100. The real
   exam scores 60. Until this lands, a full-length GAT-B mock is not faithful — *practice
   sets and Section A mocks are unaffected.*
2. **Per-section negative marking (§6).** The admin panel now *captures* 0.5 / 1 per
   section and sends `negative_mark_sections`, but scoring still applies the flat
   `negative_mark_value` until the backend reads that field. Papers are therefore
   scored leniently (−0.5 everywhere) rather than wrongly — the panel says so on
   screen. **Marks per question (1 vs 3) already work** via per-question `points`.

### Suggested order

§1 and §7 are cheap and unblock proper tagging. §5 decides whether generated content is
usable at all, so it is the one to validate first. §6 is the largest piece and gates
only full-length mocks — practice sets are useful before it lands.

---

## 10. Frontend changes already made

| File | Change |
|---|---|
| [`src/config/tnpsc.ts`](src/config/tnpsc.ts) | `gat-b` group + `gat-b-exam` stage + 16 subjects; `authority`/`exam_type` on `TnpscGroup`; `total_attempted` and per-section `attempt`/`marks_per_question`/`negative_mark_value` on `TnpscExamPattern` |
| [`src/constants.ts`](src/constants.ts) | `'GAT-B'` added to `BOARDS` |
| [`src/data/examSyllabus.ts`](src/data/examSyllabus.ts) | `'GAT-B'` syllabus key + per-subject question counts |
| [`src/components/user/TnpscGroupGrid.tsx`](src/components/user/TnpscGroupGrid.tsx) | card eyebrow reads `group.authority` instead of the hardcoded TNPSC string; grid widened to 3 columns |
| [`src/lib/tnpscAdminApi.ts`](src/lib/tnpscAdminApi.ts) | `examTypeLabel` returns `group.exam_type` instead of composing `` `TNPSC ${short_name}` `` |
| [`src/lib/tnpscApi.ts`](src/lib/tnpscApi.ts) | `STAGE_KEYWORDS` entry so GAT-B-titled papers bucket into the stage; **`mergeCatalog`** — the server payload is merged over the bundled catalog field by field instead of replacing it |
| [`src/hooks/use-progress-trend.ts`](src/hooks/use-progress-trend.ts) | `gat-b` added to the dashboard trend filter |

The stage page renders the pattern header, section chips, mock/practice tracks and the
level gate from catalog data alone, so no page component needed changing.
