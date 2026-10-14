/**
 * The unit a collection is named after.
 *
 * Questions are placed in a syllabus unit by their own tags — Subject, then Topic. That
 * fails for exactly the units whose questions cannot be tagged by what they are about:
 * Tamil Unit IV, "கலைச் சொற்கள்" (technical terms), is a list of terms from statistics,
 * medicine, law and the rest, so its questions are tagged `புள்ளியியல்`, `மருத்துவம்`
 * and so on — the *discipline* — and nothing in the tag says "Unit IV".
 *
 * The person who wrote the sheet knew which unit it was for, and said so in the
 * collection's name: `Unit_4_Tamil_50Q_Hard`. This reads that name — as a fallback only,
 * for a question whose own tags place it nowhere.
 *
 * It is deliberately strict. A unit number alone is not enough: Unit IV is Indian Polity
 * in General Studies, Technical Terms in Tamil, Technical Terms in English. The name has
 * to say which paper too (Tamil, English, GS, Aptitude), and a name that says two is
 * left unplaced rather than guessed.
 */
import type { TnpscStage } from '@/config/tnpsc';

const ROMAN: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
};

const ROMAN_LABEL = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** "Unit 4", "Unit IV", "Unit-4" — and the Tamil "அலகு 4". */
const UNIT_NUMBER = /(?:^|\s)(?:unit|அலகு)\s*(\d{1,2}|[ivx]{1,4})(?=\s|$)/;

/** What each paper is called in a collection's name → the catalog's section name. */
const SECTION_WORDS: Array<{ section: string; words: RegExp }> = [
  { section: 'General Tamil', words: /(?:^|\s)(?:tamil|தமிழ்|பொதுத்தமிழ்)(?=\s|$)/ },
  { section: 'General English', words: /(?:^|\s)english(?=\s|$)/ },
  { section: 'General Studies', words: /(?:^|\s)(?:gs|general\s+studies)(?=\s|$)/ },
  { section: 'Aptitude & Mental Ability', words: /(?:^|\s)(?:aptitude|reasoning|mental\s+ability)(?=\s|$)/ },
];

export interface ParsedCollection {
  /** The collection's name carries a unit number, so it was meant as a unit's collection. */
  looksLikeUnit: boolean;
  /** The unit it names, when the name also says which paper. */
  unitId: string | null;
}

const NONE: ParsedCollection = { looksLikeUnit: false, unitId: null };

const CACHE = new WeakMap<TnpscStage, Map<string, ParsedCollection>>();

function parse(stage: TnpscStage, title: string): ParsedCollection {
  const text = title.toLowerCase().replace(/[_\-./]+/g, ' ').replace(/\s+/g, ' ').trim();

  const m = text.match(UNIT_NUMBER);
  if (!m) return NONE;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : ROMAN[m[1]];
  if (!n || n < 1 || n >= ROMAN_LABEL.length) return NONE;

  const sections = SECTION_WORDS.filter(s => s.words.test(text)).map(s => s.section);
  // Unit IV exists in four papers; a name that does not say which — or says two — does not say.
  if (sections.length !== 1) return { looksLikeUnit: true, unitId: null };

  const section = (stage.pattern?.sections ?? []).find(sec => sec.name === sections[0]);
  const unit = section?.units?.find(u => u.label === ROMAN_LABEL[n]);
  return { looksLikeUnit: true, unitId: unit?.id ?? null };
}

export function parseCollectionTitle(stage: TnpscStage | undefined, title: unknown): ParsedCollection {
  if (!stage || typeof title !== 'string' || !title.trim()) return NONE;
  let byTitle = CACHE.get(stage);
  if (!byTitle) CACHE.set(stage, (byTitle = new Map()));
  let hit = byTitle.get(title);
  if (!hit) byTitle.set(title, (hit = parse(stage, title)));
  return hit;
}

/** The unit id a collection's name points at, or null. */
export function unitFromCollectionTitle(stage: TnpscStage | undefined, title: unknown): string | null {
  return parseCollectionTitle(stage, title).unitId;
}
