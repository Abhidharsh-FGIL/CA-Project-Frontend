/**
 * A paper's title as a student reads it.
 *
 * Titles are written "TNPSC Group 4 — இலக்கணம் · Simple": the exam, then what the paper is. Every screen a student
 * sees is already inside one exam, so the exam prefix is noise. It is removed only when it names an exam the
 * product knows, so a title that merely contains a dash is left alone.
 */
// The stage may follow the group ("TNPSC Group 2 Prelims — …"); it goes with the prefix.
const EXAM_PREFIX =
  /^\s*(?:TNPSC\s+Group\s*\d+[A-Za-z]*|Group\s*\d+|GAT-?B)(?:\s+(?:Prelims|Preliminary|Mains|Main|Written))?\s*[—–-]\s+/i;

export function displayTitle<T extends string | null | undefined>(title: T): T | string {
  if (!title) return title;
  const stripped = title.replace(EXAM_PREFIX, '').trim();
  return stripped || title;
}
