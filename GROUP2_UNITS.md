# Group 2 Prelims units — backend change

## The error

Creating or placing a Group 2 assessment in a unit fails with:

> Unit 'g2-ta-grammar' is not a unit of 'group-2-prelims'.

## Why

The portal now has a syllabus for **TNPSC Group 2 · Preliminary Examination**: the same General Tamil, General
English, General Studies and Aptitude units as Group 4, filed under Group 2's own ids so that an assessment says which
exam it belongs to (`g2-ta-grammar`, `g2-gs-indian-polity`, … — Group 4's `g4-…` ids with the prefix swapped).
The server validates a placement against *its* list of units for the stage, and its `group-2-prelims` has none of
them yet, so it refuses every unit-placed Group 2 paper. Group 4 is unaffected.

## What to change

1. **Add the `g2-*` units to `group-2-prelims`** in the server's catalogue — one row per unit, same name, label,
   section, question count and topics as the Group 4 unit it is copied from:

   | Group 4 unit id (source) | Group 2 unit id (to add) |
   |--------------------------|--------------------------|
   | `g4-ta-*`  (General Tamil)            | `g2-ta-*` |
   | `g4-en-*`  (General English)          | `g2-en-*` |
   | `g4-gs-*`  (General Studies)          | `g2-gs-*` |
   | `g4-apt-*` (Aptitude & Mental Ability)| `g2-apt-*` |

   The ids are the Group 4 ids with `g4-` replaced by `g2-`. Topic ids inside a unit stay as they are in Group 4.
2. **Questions:** Group 2 draws on Group 4's question bank. The portal already sends the bank the `g4-` id when it
   fetches questions for a `g2-` unit (`bankUnitId`), so questions do not need re-tagging. A question tagged with
   `g4-ta-grammar` should be found by a paper placed in `g2-ta-grammar`.
3. **Validation:** keep checking that a unit belongs to the stage (`UNIT_NOT_IN_STAGE`), and return that as a code
   next to the message. The portal now recognises the sentence "Unit 'x' is not a unit of 'y'" and shows an
   explanation instead of the bare text.
4. **Student side:** `GET /user/tnpsc/catalog` (and the stage's practice-test listing) should include the `g2-*`
   units for `group-2-prelims`, so a paper placed in one appears under its unit for aspirants.

## Until then

A Group 2 assessment can still be created at **Mock** level, or placed by whole section, but not into a unit.
