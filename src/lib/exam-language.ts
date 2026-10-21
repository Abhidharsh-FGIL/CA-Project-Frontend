/**
 * Which language paper an aspirant sits — General Tamil or General English — and what follows from it.
 *
 * Group 4's paper is General Studies and Aptitude plus *one* of the two language papers, never both.
 * The aspirant says which at sign-up, and every screen that lists papers or syllabus then shows only
 * theirs: the other language's section, its practice sets, its mock papers.
 *
 * The answer is stored in the profile's existing `medium` field — the backend already keeps it, the
 * Profile page already edits it as English or Tamil, and nothing else reads it. Reusing it means no
 * schema change and that anyone who already chose English or Tamil is already covered.
 */
import type { TnpscGroup, TnpscStage } from '@/config/tnpsc';

export type ExamLanguage = 'tamil' | 'english';

/** What the sign-up and Profile selects offer. `value` is what is stored in `medium`. */
export const EXAM_LANGUAGE_OPTIONS: ReadonlyArray<{ value: string; label: string; language: ExamLanguage }> = [
  { value: 'Tamil', label: 'General Tamil', language: 'tamil' },
  { value: 'English', label: 'General English', language: 'english' },
];

export const examLanguageLabel = (language: ExamLanguage): string => (language === 'tamil' ? 'General Tamil' : 'General English');

/** The value to store in `medium` for a language. */
export const examLanguageValue = (language: ExamLanguage): string => (language === 'tamil' ? 'Tamil' : 'English');

/**
 * The language paper a stored `medium` means, or null when it names neither.
 *
 * Accepts the label as well as the stored value, and ignores case — and anything else, which an
 * account made before this question existed may hold, is "not chosen yet" rather than a guess.
 */
export function examLanguageOf(medium?: string | null): ExamLanguage | null {
  const m = (medium ?? '').trim().toLowerCase().replace(/^general\s+/, '');
  return m === 'tamil' ? 'tamil' : m === 'english' ? 'english' : null;
}

/** A language as the backend or a catalog writes it: "tamil", "ta", "english", "en". */
function languageOfCode(code?: string | null): ExamLanguage | null {
  const c = (code ?? '').trim().toLowerCase();
  return c === 'tamil' || c === 'ta' ? 'tamil' : c === 'english' || c === 'en' ? 'english' : null;
}

/** The language a subject id names — only the two language papers have one. */
export function subjectLanguage(subjectId?: string | null): ExamLanguage | null {
  return subjectId === 'general-tamil' ? 'tamil' : subjectId === 'general-english' ? 'english' : null;
}

/**
 * The language a name or title says, if it says exactly one.
 *
 * "(Tamil)" / "(English)" after a title, or "General Tamil" / "General English" anywhere in it. A bare
 * "Tamil" is not enough — "Tamil Nadu History" is a General Studies unit, not the language paper —
 * and a title naming both says neither.
 */
export function textLanguage(text?: string | null): ExamLanguage | null {
  const t = text ?? '';
  const tamil = /\(\s*tamil\s*\)|general\s+tamil|பொதுத்\s?தமிழ்/i.test(t);
  const english = /\(\s*english\s*\)|general\s+english/i.test(t);
  return tamil && !english ? 'tamil' : english && !tamil ? 'english' : null;
}

/** What is known about a paper that says which language it is in. Every field is optional. */
export interface PaperLanguageSource {
  title?: string | null;
  /** The placement's own word, when the server sends it: "tamil" | "english". */
  language?: string | null;
  tnpsc_language?: string | null;
  section_name?: string | null;
  tnpsc_section_name?: string | null;
  subject_id?: string | null;
}

/**
 * The language paper a paper belongs to, or null when it is for everyone — General Studies,
 * Aptitude, a full mock that says nothing.
 *
 * In order of how much to trust it: the server's own `language`, the section it is the full set
 * of, its subject, and only then the words of its title.
 */
export function paperLanguage(p: PaperLanguageSource): ExamLanguage | null {
  return (
    languageOfCode(p.language) ??
    languageOfCode(p.tnpsc_language) ??
    textLanguage(p.section_name) ??
    textLanguage(p.tnpsc_section_name) ??
    subjectLanguage(p.subject_id) ??
    textLanguage(p.title)
  );
}

/** Whether a paper is for this aspirant: it says nothing, or says their language — or they have not chosen. */
export function paperIsFor(language: ExamLanguage | null, p: PaperLanguageSource): boolean {
  if (!language) return true;
  const own = paperLanguage(p);
  return own === null || own === language;
}

export function papersFor<T extends PaperLanguageSource>(language: ExamLanguage | null, papers: T[]): T[] {
  return language ? papers.filter(p => paperIsFor(language, p)) : papers;
}

type Section = NonNullable<TnpscStage['pattern']>['sections'][number];

/** The language paper a section is, when it is one of a pair sat in place of each other. */
export function sectionLanguage(section: Pick<Section, 'name' | 'alternative_to'>): ExamLanguage | null {
  return section.alternative_to ? textLanguage(`General ${section.name.replace(/^general\s+/i, '')}`) : null;
}

/** Whether the stage offers the choice — a pair of sections sat one instead of the other. */
export function hasLanguageChoice(stage?: TnpscStage | null): boolean {
  const langs = new Set((stage?.pattern?.sections ?? []).map(sectionLanguage).filter(Boolean));
  return langs.size > 1;
}

/**
 * The stage as someone sitting `language` sees it: the other language's section and subject gone,
 * and the section that stays no longer "or General English".
 *
 * Returns the stage itself when there is nothing to take out, so an unchanged stage stays the same
 * object.
 */
export function stageForLanguage(stage: TnpscStage, language: ExamLanguage | null): TnpscStage {
  if (!language || !stage.pattern) return stage;
  const sections = stage.pattern.sections;
  const gone = sections.filter(s => {
    const l = sectionLanguage(s);
    return l !== null && l !== language;
  });
  if (gone.length === 0) return stage;

  const goneNames = new Set(gone.map(s => s.name));
  const goneSubjects = new Set(gone.flatMap(s => s.syllabus_subject_ids ?? s.subject_ids ?? []));

  return {
    ...stage,
    pattern: {
      ...stage.pattern,
      sections: sections
        .filter(s => !goneNames.has(s.name))
        .map(s => {
          if (!s.alternative_to || !goneNames.has(s.alternative_to)) return s;
          const { alternative_to: _removed, ...rest } = s;
          void _removed;
          return rest;
        }),
    },
    subjects: stage.subjects.filter(sub => !goneSubjects.has(sub.id)),
  };
}

/** Every stage of every group, as `stageForLanguage` has it. Unchanged groups come back as they were. */
export function catalogForLanguage(groups: TnpscGroup[], language: ExamLanguage | null): TnpscGroup[] {
  if (!language) return groups;
  return groups.map(g => {
    const stages = g.stages.map(st => stageForLanguage(st, language));
    return stages.every((st, i) => st === g.stages[i]) ? g : { ...g, stages };
  });
}
