/**
 * What a paper is made of, as a short list a candidate can read at a glance.
 *
 * The group page used to list the posts a candidate could be appointed to, which
 * says nothing about the exam in front of them. The structure — how many questions
 * come from each part — is what they need before choosing where to start.
 */
import type { TnpscExamPattern } from '@/config/tnpsc';

export interface StructureRow {
  /** "General Studies", or "General Tamil / General English" for a pair sat in place of each other. */
  label: string;
  questions: number;
}

/**
 * The pattern's sections, one row each.
 *
 * Group 4 lists its language paper twice — one section per language, so each can
 * carry its own units — but a candidate sits only one. Shown as two rows it would
 * read as 200 questions of language; shown as one it is the 100 it really is.
 */
export function paperStructure(pattern?: TnpscExamPattern): StructureRow[] {
  if (!pattern) return [];

  const rows: StructureRow[] = [];
  const merged = new Set<string>();

  for (const sec of pattern.sections) {
    if (merged.has(sec.name)) continue;

    const partner = sec.alternative_to
      ? pattern.sections.find(s => s.name === sec.alternative_to)
      : undefined;

    if (partner) {
      merged.add(partner.name);
      rows.push({ label: `${sec.name} / ${partner.name}`, questions: sec.questions });
    } else {
      rows.push({ label: sec.name, questions: sec.questions });
    }
  }
  return rows;
}
