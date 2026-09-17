// ============================================
// Centralized App Constants
// Change these values in one place to update the entire app
// ============================================

// Competitive-exam bodies the platform prepares aspirants for.
// (Historically this list held school boards — CBSE/ICSE/etc. — hence the
// `BOARDS` name is kept as the stable identifier consumed across the app.)
// TNPSC stages lead the list — they are what this platform now prepares for.
// The remaining entries are kept so existing content stays valid.
// The two TNPSC values are sent verbatim as the generator's `test_type`, which is
// what switches it into TNPSC style (5 options, including "விடை தெரியவில்லை").
// 'GAT-B' does the same for the biotechnology paper — 4 options, English only,
// with negative marking. Keep them exactly as the backend matches them; each
// value here must also be a key of EXAM_SYLLABUS (src/data/examSyllabus.ts) and
// the `exam_type` of a group in src/config/tnpsc.ts.
export const BOARDS = [
  'TNPSC Group 1',
  'TNPSC Group 4',
  'GAT-B',
  'UPSC',
  'SSC',
  'IBPS',
  'SBI',
  'RRB',
  'State PSC',
] as const;

// Human-friendly alias for new code. Same values as BOARDS.
export const EXAMS = BOARDS;

// Fixed number of questions per passage-based set (e.g. Reading Comprehension,
// Cloze Test). Passage chapters generate fixed-size sets instead of following the
// weightage-% split. Sent to the backend generator as `passage_set_size`.
export const PASSAGE_SET_SIZE = 5;
