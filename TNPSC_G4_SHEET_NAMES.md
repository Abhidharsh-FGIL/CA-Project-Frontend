# Group 4 — what to write in the question sheet

Every name below is the wording printed in the commission's syllabus (Code 496, dated
12.12.2024). Copy it as printed. In **Subject**, case, commas, and "&" versus "and" do not matter.
In **Topic**, spell it the same way every time: it is compared as written.

The columns that decide where a question lands are **Subject** and **Topic**.

## Part A — General Studies (75)

Write the unit's printed name in **Subject**. **Topic** is free: put the finer topic there.

| Unit | Subject | Questions |
|---|---|---|
| I | General Science | 5 |
| II | Geography | 5 |
| III | History, Culture of India, and Indian National Movement | 10 |
| IV | Indian Polity | 15 |
| V | Indian Economy and Development Administration in Tamil Nadu | 20 |
| VI | History, Culture, Heritage, and Socio-Political Movements of Tamil Nadu | 20 |

Units III and V are each one printed unit but two subjects in the portal. The long printed name
is accepted and the question stays inside that unit's papers. If you want it counted under one
half for reports, use the shorter name instead: *History and Culture of India* or *Indian
National Movement*; *Indian Economy* or *Development Administration in Tamil Nadu*.

**Do not use "Current Events" or "Current Affairs" as a Subject.** The syllabus puts current
affairs inside each unit. A question under that name belongs to no unit and never appears in a
unit paper. Tag it with the subject it is about.

## Part B — Aptitude and Mental Ability (25)

**Subject** = `Aptitude and Mental Ability`.
**Topic** = the unit, `Aptitude` (15) or `Reasoning` (10).

## Part C — Tamil (100)

**Subject** = `General Tamil`. **Topic** = the unit's printed Tamil name:

| Unit | Topic | Questions |
|---|---|---|
| I | இலக்கணம் | 25 |
| II | சொல்லகராதி | 15 |
| III | எழுதும் திறன் | 15 |
| IV | கலைச் சொற்கள் | 10 |
| V | வாசித்தல் – புரிந்து கொள்ளும் திறன் | 15 |
| VI | எளிய மொழி பெயர்ப்பு | 5 |
| VII | இலக்கியம், தமிழ் அறிஞர்களும், தமிழ்த்தொண்டும் | 15 |

## Part C — English, for differently abled candidates (100)

**Subject** = `General English`. **Topic** = the unit:

| Unit | Topic | Questions |
|---|---|---|
| I | Grammar | 25 |
| II | Vocabulary | 15 |
| III | Writing Skills | 10 |
| IV | Technical Terms | 10 |
| V | Reading Comprehension | 20 |
| VI | Translation | 5 |
| VII | Literary Works | 15 |

Tamil and English both have a "Grammar" and a "Writing Skills". The word alone does not say
which language, so **always fill Subject** for these rows. A Subject-less row with Topic
"Grammar" is not placed.

## Name the collection after its unit

When a sheet is imported its title becomes the collection's name, and **the portal reads that
name** to place any question whose own tags do not say which unit it is. This is what makes Tamil
Unit IV (கலைச் சொற்கள், technical terms) work: its questions are tagged by the discipline the
term comes from — `புள்ளியியல்`, `மருத்துவம்` — and nothing in a tag like that says "Unit IV".

Use **`Unit_<number>_<paper>_<count>Q_<level>`**:

| Good | Places the questions in |
|---|---|
| `Unit_4_Tamil_50Q_Hard` | Tamil · Unit IV (கலைச் சொற்கள்) |
| `Unit_4_English_50Q` | English · Unit IV (Technical Terms) |
| `Unit_4_GS_20Q` | General Studies · Unit IV (Indian Polity) |
| `Unit_1_Aptitude_30Q`, `Unit_2_Reasoning_30Q` | Aptitude · Unit I, Reasoning · Unit II |

The **paper word is required** — Tamil, English, GS or Aptitude/Reasoning. Unit IV is a different
unit in each, so `Unit_4_50Q_Hard` places nothing, and the unit picker will say so by name.
A name carrying two papers (`Unit_4_Tamil_English`) is left alone too.

The question's own tags still win where they name a unit (a Subject of `Indian Polity` is Unit IV
whatever the collection is called), and a `Unit` column on the sheet, once the importer reads it
([BACKEND_WORK.md](BACKEND_WORK.md) item 7), wins over both.

## Every row, whatever the part

- **Difficulty** must be filled in: `easy`, `medium` or `hard`. A blank row cannot be placed in
  a Simple, Medium or Complex paper or in the 20/30/50 blend.
- Spell the unit the same way every time.

## What still depends on typing

For Part B, Tamil and English, the unit comes from **Topic**, so a typo drops the question out
of its unit. The fix is a `Unit` column stored on the question, which is
[BACKEND_WORK.md](BACKEND_WORK.md) item 7. Until it ships, do one batch of about 20 rows first
and check it in the question bank before writing more.

## What the picker already understands, and what it will not guess

The assessment wizard places a bank question in a unit from its **Subject** and **Topic**. It
now also reads the spellings the existing sheets actually use (measured 12 Oct 2026 on 4,209
questions: 32% placed by the printed names alone, **86%** with these):

| Written in the sheet | Read as |
|---|---|
| `தமிழ்`, `பொதுத்தமிழ்`, `Tamil`, `English` as the Subject | General Tamil / General English |
| `பொதுத்தமிழ் - பகுதி அ - இலக்கணம்` (Subject made of pieces) | General Tamil, unit **I** — the last piece names the unit |
| `தமிழ் – சொல்லகராதி` | General Tamil, unit **II** |
| `கலைச்சொற்கள்` (no space) | unit **IV** |
| `Unit III: Writing Skills`, `Part A – Unit V: …` | the prefix is ignored, the name after it counts |
| `இந்திய பொருளாதாரம் மற்றும் தமிழ்நாட்டில் வளர்ச்சி நிர்வாகம்` | Part A unit **V** |
| `English Grammar`, Topic `Parts of Speech / Verbs`, `Sentence Transformation` | English, unit **I** |
| Topic `Dice`, `Syllogism`, `Direction Sense`, `Coding`… / `சதவீதம்`, `பரப்பளவு`, `LCM`… | Reasoning / Aptitude |

The list lives in `src/config/g4-tag-aliases.ts`. Add a spelling there when a new sheet uses one.

**It does not guess.** These stay out of every unit, because the tag does not say which:

- A bare `Vocabulary`, `Technical Terms` or `Writing Skills` — Tamil's or English's? Write
  `General Tamil` or `General English` in **Subject**, and the unit in **Topic**.
- `தமிழ் தகுதி மற்றும் மதிப்பீட்டுத் தேர்வு` with no Topic — the whole Tamil paper, not a unit.
- `Current Affairs` — it belongs inside each unit, so tag the subject it is about.
- `Part A – Unit VI` with no name — "VI" is a different unit in each part.

The picker counts these ("N bank questions sit in this exam's subjects but in no unit") so the
gap is visible. The lasting fix is a **Unit** column on the sheet — BACKEND_WORK.md item 7.
