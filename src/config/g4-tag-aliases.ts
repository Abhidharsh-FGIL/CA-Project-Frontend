/**
 * How Group 4 questions are actually tagged, as opposed to how the catalog names things.
 *
 * The catalog uses the commission's printed names ("General Tamil", "Grammar"). The
 * question bank was built from sheets written by several people over several weeks,
 * and they tagged the same thing many ways: "தமிழ்", "பொதுத்தமிழ் - பகுதி அ - இலக்கணம்",
 * "English Grammar", "Unit III: Writing Skills". Measured on the sheets in use on
 * 12 Oct 2026, only 32% of 4,209 questions matched a unit on the printed names alone.
 *
 * Each entry below is a spelling that was **seen in a real sheet** and whose meaning
 * is not in doubt. Nothing here guesses: a tag that does not say which unit it means
 * ("Vocabulary" — Tamil's or English's? — or a bare "தமிழ்") is deliberately absent,
 * and those questions are reported as belonging to no unit rather than filed somewhere
 * plausible. The real fix for them is a Unit column on the sheet (BACKEND_WORK.md
 * item 7); this list only recovers what is already unambiguous.
 *
 * Used by `src/lib/unit-pool.ts` only. It is not merged into the catalog's subject
 * aliases, because those drive stage detection and section marking across the whole
 * app, where a bare "English" or "Tamil" is not safe to claim.
 */

/**
 * Spellings of a *subject* that the catalog's own name and aliases do not cover.
 * Keyed by catalog subject id. Matched whole, or as a leading word ("English Grammar").
 */
export const G4_SUBJECT_ALIASES: Record<string, string[]> = {
  'general-tamil': ['தமிழ்', 'பொதுத்தமிழ்', 'Tamil'],
  'general-english': ['English'],
  // Class 6–10 maths sheets tag their questions "Mathematics – Aptitude & Reasoning", with the
  // topic ("HCF", "Percentage") saying which of the two units it is.
  'aptitude-and-mental-ability': ['Mathematics', 'Aptitude & Reasoning'],
};

/**
 * Words and names that identify a unit, beyond its printed name and topics.
 * Keyed by unit id.
 *
 * Matched as whole words inside a tag, so "Parts of Speech / Verbs" is Grammar and
 * "Dice — Opposite Faces" is Reasoning. They only ever *choose between units that
 * share a subject* (the Tamil units, the English units, Aptitude and Reasoning) or name
 * a unit outright when the hint is the unit's own name in another spelling — so a hint
 * can never move a question out of its subject.
 */
export const G4_UNIT_HINTS: Record<string, string[]> = {
  // General Studies — the unit's printed name, spelt the way sheets spell it.
  'g4-gs-economy-and-dev-admin': [
    'இந்திய பொருளாதாரம் மற்றும் தமிழ்நாட்டில் வளர்ச்சி நிர்வாகம்',
    'இந்திய பொருளாதாரம் மற்றும் தமிழ்நாட்டின் வளர்ச்சி நிர்வாகம்',
    'இந்தியப் பொருளாதாரம் மற்றும் தமிழ்நாட்டின் வளர்ச்சி நிர்வாகம்',
  ],

  // Tamil — unit VII covers the literature texts and the scholars together, and older
  // sheets split it as Part ஆ (literature) and Part இ (scholars and service to Tamil).
  'g4-ta-literature': [
    'இலக்கியம்',
    'தமிழ் அறிஞர்களும் தமிழ்த் தொண்டும்',
    'அறநூல்கள்',
    'பாவாணர்',
    'தமிழின் தொன்மை',
    'திராவிட மொழிகள்',
    'உ.வே.சா',
    'தெ.பொ.மீ',
    'தமிழ்ச் சான்றோர்கள்',
  ],

  // English — grammar's sub-topics, as named in the grammar sheets.
  'g4-en-grammar': [
    'english grammar',
    'parts of speech',
    'sentence types',
    'clauses',
    'punctuation',
    'question tags',
    'degrees of comparison',
    'reported speech',
    'synthesis',
    'verbs and verbals',
    'sentence transformation',
    'tenses',
    'articles',
    'prepositions',
    'voice',
    'modals',
  ],

  // English — vocabulary: the word-level topics of the vocabulary sheets.
  'g4-en-vocabulary': [
    'synonyms',
    'antonyms',
    'homophones',
    'homonyms',
    'commonly confused',
    'idioms',
    'phrasal verbs',
    'one word substitution',
    'spelling',
    'word creation',
    'word formation',
    'derivatives',
    'compound words',
    'abbreviations',
    'correct usage',
    'word distinctions',
    'foreign words',
    'proverbs',
  ],

  // Aptitude & Mental Ability — Reasoning (10) vs Aptitude (15).
  'g4-apt-reasoning': [
    'dice',
    'syllogism',
    'coding',
    'decoding',
    'direction sense',
    'seating arrangement',
    'visual reasoning',
    'mirror images',
    'alphanumeric',
    'alpha numeric',
    'logical reasoning',
    'puzzles',
    'blood relation',
    'number series',
    'எண் தொடர்',
    'பகுத்தறிதல்',
    'புதிர்கள்',
    'தர்க்க',
  ],
  'g4-apt-aptitude': [
    'simplification',
    'percentage',
    'hcf',
    'lcm',
    'ratio',
    'proportion',
    'interest',
    'area',
    'volume',
    'time and work',
    'work and time',
    'average',
    'profit and loss',
    'சுருக்குதல்',
    'மீச்சிறு பொது மடங்கு',
    'மீப்பெரு பொது வகுத்தி',
    'மீப்பெரு பொதுக் காரணி',
    'மீச்சிறு பொதுமடங்கு',
    'சதவீதம்',
    'பரப்பளவு',
    'கனஅளவு',
    'விகிதம்',
    'தனிவட்டி',
    'கூட்டுவட்டி',
  ],
};

/**
 * Group 2 prelims shares Group 4's language, General Studies and Aptitude units, filed under `g2-` ids, so the
 * spellings sheets use for them are the same — only the id differs.
 */
for (const id of Object.keys(G4_UNIT_HINTS)) {
  if (/^g4-(gs|apt|ta|en)-/.test(id)) G4_UNIT_HINTS[id.replace('g4-', 'g2-')] = G4_UNIT_HINTS[id];
}

/** "Part A", "Unit III", "பகுதி அ", "அலகு VI" — a marker, not a name. */
const MARKER = /^(part|unit|பகுதி|அலகு) \S{1,4}$/;

/**
 * A tag taken apart at its separators, markers dropped.
 *
 * Sheets join several things into one cell — "பொதுத்தமிழ் - பகுதி அ - இலக்கணம்",
 * "Part A – Unit V: Indian Economy…", "Unit III: Writing Skills" — and the subject or the
 * unit is in one of the pieces. Only *spaced* dashes split, so a hyphen inside a word is
 * left alone.
 */
export function splitTag(raw: string): string[] {
  return raw
    .split(/\s+[-–—]\s+|\s*:\s+|\s+\/\s+|\s*\|\s*/)
    .map(p => p.trim())
    .filter(p => p && !MARKER.test(p.toLowerCase().replace(/\s+/g, ' ')));
}
