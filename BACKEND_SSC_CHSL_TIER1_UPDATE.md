# SSC CHSL — backend changes after the portal update

The portal has been updated for SSC CHSL Tier-1. Unit ids do not change. Please do **1** and **3** first. **2** matters
only if the syllabus API returns per-unit question counts, and **4** can wait.

## 1. Tier-1 Maths topics (required)

Tier-1 Quantitative Aptitude now follows the official **Tier I** syllabus (a shorter list than Tier II's). Same 7 units,
same ids; replace the **Tier-1** topics of these units with:

| Unit id | Topics |
|---|---|
| `c1-quantitative-aptitude-number-systems` | Number systems · Fundamental arithmetic operations · Decimals and fractions |
| `c1-quantitative-aptitude-fundamental-arithmetic` | Percentages · Ratio and proportion · Averages · Interest · Profit and loss · Discount · Partnership · Mixture and alligation · Time and work · Time, speed and distance |
| `c1-quantitative-aptitude-algebra` | Basic algebra |
| `c1-quantitative-aptitude-geometry` | Geometry |
| `c1-quantitative-aptitude-mensuration` | Mensuration |
| `c1-quantitative-aptitude-trigonometry` | Trigonometry |
| `c1-quantitative-aptitude-data-interpretation` | Tables, graphs and basic data interpretation |

* Topic code = the name slugged (lower-case, `&` → `and`, every run of other characters → `-`), e.g.
  `time-speed-and-distance`, `fundamental-arithmetic-operations`, `tables-graphs-and-basic-data-interpretation`.
* Re-tag Tier-1 questions already uploaded under the old Maths topic names.
* English, Reasoning and General Awareness topics are unchanged. **Tier-2 (`c2-…`) is unchanged.**

## 2. Tier-1 question count per unit (if the syllabus API returns per-unit counts)

Tier I's 100 questions split by unit. Each section adds up to 25.

| Section | Unit | Questions |
|---|---|---|
| English Language | Vocabulary | 6 |
| | Spelling | 3 |
| | Grammar | 7 |
| | Sentence Transformation | 4 |
| | Comprehension | 5 |
| General Intelligence and Reasoning | Analogy | 4 |
| | Classification | 4 |
| | Series and Patterns | 5 |
| | Coding and Operations | 4 |
| | Spatial and Non-Verbal Reasoning | 4 |
| | Logical and Analytical Reasoning | 2 |
| | Intelligence and Social Reasoning | 2 |
| Quantitative Aptitude | Number Systems | 5 |
| | Fundamental Arithmetic | 13 |
| | Algebra | 1 |
| | Geometry | 2 |
| | Mensuration | 1 |
| | Trigonometry | 1 |
| | Data Interpretation | 2 |
| General Awareness | Current Affairs | 4 |
| | History | 4 |
| | Geography | 3 |
| | Indian Polity and General Policy | 4 |
| | Economy | 3 |
| | General Science | 4 |
| | Culture and Miscellaneous General Knowledge | 3 |
| **Total** | | **100** |

Tier-2 has no per-unit split yet.

## 3. CHSL papers built from existing NTPC and TNPSC questions (please confirm)

CHSL papers are now built partly from questions already in the bank — RRB NTPC and TNPSC questions, matched to CHSL
units by their subject and topic. Please confirm that creating such a paper works:

* Those questions carry **no `c1-` / `c2-` unit id** (they have their NTPC / TNPSC tags, or `n1-…` / `g4-…` unit ids).
  Creating the paper must not reject them for that. The paper sends its fixed list of question ids as usual.
* In a **Tamil or Hindi** CHSL paper, the **English Language** section's questions are in English. The paper must not
  reject them for not matching the paper's language.

## 4. Optional, later: tag the borrowed questions with CHSL unit ids

The portal's NTPC/TNPSC → CHSL mapping is in `src/config/chsl-bank-bridge.ts` (built from
`SSC_CHSL_Question_Match_NTPC_TNPSC.xlsx`). Storing the matching `c1-…` / `c2-…` unit id on those questions would let the
server find them by unit directly — needed if CHSL papers use live pools that draw new questions at each attempt.

## How to check

1. Admin → Evaluation Hub → new SSC CHSL Tier-1 (Tamil) full mock → select all 26 units: every unit shows a count, and
   Unit Weightage fills in as the table in §2 (total 100%).
2. Create the paper → it saves without an error.
3. Open it as a student: the English section is in English, the other sections in Tamil; −0.5 per wrong answer.
