/**
 * Placing the question bank's existing NTPC and TNPSC questions in SSC CHSL units.
 *
 * CHSL is a new exam, so no question in the bank is tagged with a CHSL unit yet. What the bank does hold — 34,000 questions —
 * is RRB NTPC's (subject "Mathematics", topic "Number System"; subject "General Awareness", topic "History of India") and
 * TNPSC's (subject "English", "Aptitude", "General Studies"). Their subject matter overlaps CHSL's, and
 * `SSC_CHSL_Question_Match_NTPC_TNPSC.xlsx` lists which NTPC and TNPSC topic stands for which CHSL topic. This is that list,
 * written as rules the unit picker can apply, so a CHSL paper can be built from questions that already exist.
 *
 * A rule names the words a question's own tags must contain and the CHSL units they point to. It is a bridge, not a re-tag:
 * a question stays in the bank under its own subject and topic, and the picker simply also offers it to the CHSL unit.
 * A question that names a CHSL unit itself (`c1-…`, `c2-…`, or a subject and topic that say so) never reaches this file.
 *
 * Deliberately left out, because the match sheet says so: everything Tamil Nadu-specific (state history, geography, economy,
 * current affairs), the Tamil paper, English literature and technical terms, and the railway-flavoured NTPC topics.
 */

/** A CHSL unit's id without its tier prefix (`c1-` / `c2-`): the subject's name and the unit's name, slugged. */
const U = {
  // English Language
  vocabulary: 'english-language-vocabulary',
  spelling: 'english-language-spelling',
  grammar: 'english-language-grammar',
  transformation: 'english-language-sentence-transformation',
  comprehension: 'english-language-comprehension',
  // General Intelligence and Reasoning
  analogy: 'general-intelligence-and-reasoning-analogy',
  classification: 'general-intelligence-and-reasoning-classification',
  series: 'general-intelligence-and-reasoning-series-and-patterns',
  coding: 'general-intelligence-and-reasoning-coding-and-operations',
  spatial: 'general-intelligence-and-reasoning-spatial-and-non-verbal-reasoning',
  logical: 'general-intelligence-and-reasoning-logical-and-analytical-reasoning',
  social: 'general-intelligence-and-reasoning-intelligence-and-social-reasoning',
  // Quantitative Aptitude
  numbers: 'quantitative-aptitude-number-systems',
  arithmetic: 'quantitative-aptitude-fundamental-arithmetic',
  algebra: 'quantitative-aptitude-algebra',
  geometry: 'quantitative-aptitude-geometry',
  mensuration: 'quantitative-aptitude-mensuration',
  trigonometry: 'quantitative-aptitude-trigonometry',
  dataInterpretation: 'quantitative-aptitude-data-interpretation',
  statistics: 'quantitative-aptitude-statistics-and-probability',
  // General Awareness
  currentAffairs: 'general-awareness-current-affairs',
  history: 'general-awareness-history',
  geography: 'general-awareness-geography',
  polity: 'general-awareness-indian-polity-and-general-policy',
  economy: 'general-awareness-economy',
  science: 'general-awareness-general-science',
  culture: 'general-awareness-culture-and-miscellaneous-general-knowledge',
  // Computer Knowledge (Tier II)
  computers: 'computer-knowledge-computer-fundamentals',
  operatingSystems: 'computer-knowledge-operating-systems',
  office: 'computer-knowledge-microsoft-office',
  internet: 'computer-knowledge-internet-and-email',
} as const;

/** Every unit id (without tier prefix) the bridge can name. Exported so a test can check each exists in the catalog. */
export const BRIDGE_UNIT_KEYS: string[] = Object.values(U);

type Unit = (typeof U)[keyof typeof U];
interface Rule {
  /** Normalised phrases; the rule fires when any appears as whole words in the question's tags. */
  any: string[];
  units: Unit[];
}

const COMPUTER_UNITS: Unit[] = [U.computers, U.operatingSystems, U.office, U.internet];

const MATHS: Rule[] = [
  { any: ['number system', 'number systems', 'decimals', 'fractions', 'decimals and fractions', 'lcm', 'hcf', 'lcm and hcf', 'simplification', 'whole numbers'], units: [U.numbers] },
  {
    any: [
      'ratio and proportion', 'ratio and proportions', 'ratio', 'proportion', 'percentage', 'percentages', 'simple interest', 'compound interest',
      'simple and compound interest', 'profit and loss', 'profit', 'discount', 'time and work', 'time work and distance', 'time speed and distance',
      'time and distance', 'speed', 'average', 'averages', 'partnership', 'mixture', 'alligation', 'square root', 'square roots', 'boats and streams',
      'pipes and cisterns',
    ],
    units: [U.arithmetic],
  },
  { any: ['mensuration', 'area', 'areas', 'volume', 'volumes', 'surface area', 'perimeter'], units: [U.mensuration] },
  { any: ['elementary algebra', 'algebra'], units: [U.algebra] },
  { any: ['geometry', 'geometry and trigonometry', 'triangles', 'circles'], units: [U.geometry] },
  { any: ['trigonometry', 'geometry and trigonometry', 'heights and distances', 'height and distance'], units: [U.trigonometry] },
  {
    any: ['data interpretation', 'elementary statistics', 'statistics', 'bar graph', 'pie chart', 'line graph', 'tables and graphs', 'histogram', 'maps and graph interpretation'],
    units: [U.dataInterpretation],
  },
  { any: ['elementary statistics', 'statistics', 'data interpretation', 'mean median and mode', 'probability'], units: [U.statistics] },
];

const REASONING: Rule[] = [
  { any: ['analogy', 'analogies'], units: [U.analogy] },
  { any: ['classification', 'odd one out', 'odd man out', 'similarities and differences'], units: [U.classification] },
  { any: ['number series', 'alphabetical series', 'alphabet series', 'letter series', 'series', 'pattern completion'], units: [U.series] },
  {
    any: ['coding and decoding', 'coding', 'decoding', 'jumbling', 'mathematical operations', 'arithmetical operations', 'symbol operations', 'word building'],
    units: [U.coding],
  },
  {
    any: [
      'venn diagram', 'venn diagrams', 'non verbal reasoning', 'visual reasoning', 'directions and distances', 'direction sense', 'direction and distance',
      'embedded figures', 'paper folding', 'mirror image', 'water image', 'dice', 'cubes',
    ],
    units: [U.spatial],
  },
  {
    any: [
      'syllogism', 'statement and conclusion', 'statements and conclusions', 'statement and courses of action', 'statement and course of action',
      'decision making', 'analytical reasoning', 'puzzles', 'puzzle', 'data sufficiency', 'blood relations', 'relationships', 'relationship',
      'clock and calendar', 'clock', 'calendar', 'ordering and ranking', 'ranking', 'logical reasoning', 'seating arrangement', 'inference', 'critical thinking',
    ],
    units: [U.logical],
  },
  { any: ['decision making', 'social intelligence', 'emotional intelligence'], units: [U.social] },
  // NTPC files map and graph reading under reasoning; in CHSL it is the data-reading of Data Interpretation.
  { any: ['maps and graph interpretation'], units: [U.dataInterpretation, U.statistics] },
];

const AWARENESS: Rule[] = [
  {
    any: [
      'current events', 'current affairs', 'current events of national and international importance', 'games and sports', 'sports', 'awards', 'honours',
      'famous personalities', 'personalities', 'flagship government programmes', 'government programmes', 'government schemes', 'schemes and policies', 'appointments',
    ],
    units: [U.currentAffairs],
  },
  {
    any: [
      'history', 'history of india', 'ancient india', 'medieval india', 'modern india', 'indian freedom struggle', 'freedom struggle', 'national movement',
      'indian national movement', 'national leaders', 'history and culture of india',
    ],
    units: [U.history],
  },
  {
    any: [
      'art and culture', 'art and architecture', 'culture', 'indian literature', 'monuments', 'heritage', 'important monuments and places of india',
      'science and technology', 'scientific and technological developments', 'general scientific and technological developments', 'latest inventions',
      'common abbreviations', 'abbreviations',
    ],
    units: [U.culture],
  },
  {
    any: [
      'geography', 'physical geography', 'rivers', 'climate', 'monsoon', 'agriculture', 'minerals', 'environment', 'environmental issues', 'flora and fauna',
      'flora', 'fauna', 'natural resources',
    ],
    units: [U.geography],
  },
  {
    any: [
      'polity', 'indian polity', 'constitution', 'fundamental rights', 'fundamental duties', 'parliament', 'judiciary', 'governance', 'united nations',
      'un and other important world organizations', 'world organizations', 'world organisations', 'political parties', 'political system', 'election',
      'elections',
    ],
    units: [U.polity],
  },
  {
    any: [
      'economy', 'indian economy', 'economics', 'banking', 'finance', 'finance commission', 'budget', 'national income', 'planning', 'niti aayog',
      'five year plan', 'five year plans', 'land reforms', 'reserve bank', 'reserve bank of india', 'revenue', 'goods and services tax', 'gst', 'industrial growth',
    ],
    units: [U.economy],
  },
  {
    any: [
      'general science', 'physics', 'chemistry', 'biology', 'life science', 'botany', 'zoology', 'science in everyday life', 'everyday science',
      'science and technology', 'scientific and technological developments', 'general scientific and technological developments',
    ],
    units: [U.science],
  },
  { any: ['basics of computers and computer applications', 'computer applications', 'computers', 'computer'], units: COMPUTER_UNITS },
];

const ENGLISH: Rule[] = [
  {
    any: [
      'vocabulary', 'synonyms', 'synonym', 'antonyms', 'antonym', 'homonyms', 'homophones', 'homonyms and homophones', 'one word substitution',
      'one word substitutions', 'idioms', 'idioms and phrases', 'phrasal verbs', 'correct usage',
    ],
    units: [U.vocabulary],
  },
  { any: ['spelling', 'spellings', 'spelling of words', 'misspelt', 'misspelled'], units: [U.spelling] },
  {
    any: [
      'grammar', 'concord', 'tense', 'tenses', 'parts of speech', 'sentence patterns', 'sentence pattern', 'clauses', 'phrases and clauses', 'articles',
      'prepositions', 'modals', 'verbs', 'spot the error', 'error spotting', 'sentence improvement', 'blanks', 'fill in the blanks', 'question tags',
      'punctuation', 'degrees of comparison', 'sentence types', 'agreement', 'common errors', 'transformation', 'transformation of sentences',
    ],
    units: [U.grammar],
  },
  {
    any: [
      'transformation', 'transformation of sentences', 'active and passive', 'active and passive voice', 'voice', 'direct and indirect', 'direct and indirect speech',
      'reported speech', 'narration', 'jumbled sentences', 'jumbling', 'sentence rearrangement', 'synthesis', 'writing skills',
    ],
    units: [U.transformation],
  },
  {
    any: [
      'comprehension', 'reading comprehension', 'unseen passage', 'unseen passages', 'passage', 'cloze', 'cloze test', 'order of sentences',
      'finding the right order of sentences', 'sentence completion',
    ],
    units: [U.comprehension],
  },
];

/** What a unit id of another exam stands for, when its tags say nothing more. Keyed by the id without its exam prefix. */
const UNIT_FALLBACK: Record<string, Unit[]> = {
  // RRB NTPC (`n1-`, `n2-`, `ng-`)
  'ma-number-system': [U.numbers],
  'ma-arithmetic': [U.arithmetic],
  'ma-time-and-work': [U.arithmetic],
  'ma-geometry-and-mensuration': [U.mensuration, U.geometry, U.trigonometry],
  'ma-algebra': [U.algebra],
  'ma-statistics': [U.dataInterpretation, U.statistics],
  'gi-series-and-operations': [U.series, U.coding],
  'gi-logical-reasoning': [U.logical],
  'gi-analytical-reasoning': [U.logical],
  'ga-current-affairs': [U.currentAffairs],
  'ga-art-and-culture': [U.culture],
  'ga-general-science': [U.science],
  'ga-history': [U.history],
  'ga-geography': [U.geography],
  'ga-polity': [U.polity],
  'ga-science-and-technology': [U.culture, U.science],
  'ga-economy': [U.economy],
  'ga-computers': COMPUTER_UNITS,
  // TNPSC (`g4-`, `g2-`)
  'gs-general-science': [U.science],
  'gs-geography': [U.geography],
  'gs-history-and-inm': [U.history, U.culture],
  'gs-indian-polity': [U.polity],
  'gs-economy-and-dev-admin': [U.economy],
  'apt-aptitude': [U.arithmetic],
  'apt-reasoning': [U.logical],
  'en-vocabulary': [U.vocabulary],
  'en-grammar': [U.grammar],
  'en-writing': [U.transformation],
  'en-comprehension': [U.comprehension],
};

/** Tags that rule a question out wherever they appear: content CHSL does not examine, or too narrow to be worth it. */
const EXCLUDED = [
  'phobias', 'transport systems', 'public sector organizations', 'public sector organisations',
  // TNPSC's Tamil Nadu history unit, its English paper's translation, letters and set texts.
  'socio political movements of tamil nadu', 'translation', 'letter writing', 'types of letters', 'literary works', 'prescribed poems',
  'prescribed prose', 'technical terms',
];

/**
 * Tamil Nadu content is state-specific and SSC asks national content. Read from the most specific tag: TNPSC's economy unit is
 * printed "Indian Economy and Development Administration in Tamil Nadu", and most of its topics (RBI, GST, five-year plans) are
 * national; only a topic that itself names Tamil Nadu is left out. A question whose only tag names Tamil Nadu is left out too.
 */
const STATE = ['tamil nadu', 'tamilnadu'];

/** Lower-case words with single spaces and a space at each end, so a phrase is found only as whole words. */
function key(s: unknown): string {
  if (typeof s !== 'string') return ' ';
  const k = s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  return k ? ` ${k} ` : ' ';
}

const has = (hay: string, phrase: string) => hay.includes(` ${phrase} `);

type Group = 'maths' | 'reasoning' | 'aptitude' | 'awareness' | 'english';

/** Which family of bank questions a Subject belongs to, or null when it is none of the ones CHSL can borrow from. */
function groupOf(subject: string): Group | null {
  if (!subject.trim()) return null;
  if (has(subject, 'english') || has(subject, 'general english') || has(subject, 'english language')) return has(subject, 'tamil') ? null : 'english';
  if (has(subject, 'aptitude') && !has(subject, 'quantitative')) return 'aptitude';
  if (['mathematics', 'maths', 'quantitative aptitude', 'arithmetic'].some(p => has(subject, p))) return 'maths';
  if (['reasoning', 'general intelligence'].some(p => has(subject, p))) return 'reasoning';
  const awareness = [
    'general awareness', 'general studies', 'current affairs', 'current events', 'general science', 'general knowledge', 'geography', 'history',
    'indian polity', 'polity', 'indian economy', 'economy', 'science',
  ];
  return awareness.some(p => has(subject, p)) ? 'awareness' : null;
}

const RULES: Record<Group, Rule[]> = {
  maths: MATHS,
  reasoning: REASONING,
  // TNPSC's one "Aptitude and Mental Ability" subject holds both; its Topic "Reasoning" names the whole second unit.
  aptitude: [...MATHS, ...REASONING, { any: ['reasoning'], units: [U.logical] }],
  awareness: AWARENESS,
  english: ENGLISH,
};

export interface BankTags {
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  /** The unit a question names when it names one of another exam's (`n1-ma-algebra`, `g4-gs-indian-polity`, or the other tier's `c2-…`). */
  unitId?: string | null;
}

const CACHE = new Map<string, string[]>();

/**
 * The CHSL units (ids without tier prefix) a bank question belongs to, by the tags it already carries. Empty when its tags are
 * not ones the match sheet bridges.
 */
export function chslUnitKeys(tags: BankTags): string[] {
  const cacheKey = [tags.subject, tags.chapter, tags.topic, tags.subtopic, tags.unitId].map(v => v ?? '').join('\u0001');
  const hit = CACHE.get(cacheKey);
  if (hit) return hit;
  const out = compute(tags);
  CACHE.set(cacheKey, out);
  return out;
}

function compute(tags: BankTags): string[] {
  // The other tier's own id ("c2-english-language-grammar" while building Tier I) is the same unit.
  const unitId = (tags.unitId ?? '').trim();
  const sibling = /^c[12]-(.+)$/.exec(unitId);
  if (sibling) return BRIDGE_UNIT_KEYS.includes(sibling[1]) ? [sibling[1]] : [];

  const subject = key(tags.subject);
  // Most specific first: the sub-topic, then the topic, then the chapter, and the Subject last.
  const levels = [key(tags.subtopic), key(tags.topic), key(tags.chapter)].filter(k => k.trim());
  const hay = [subject, ...levels].join('');
  if (EXCLUDED.some(p => has(hay, p))) return [];
  const statewide = (k: string) => STATE.some(p => has(k, p));
  if (levels.length > 0 ? statewide(levels[0]) : statewide(subject)) return [];

  const found = new Set<string>();
  const group = groupOf(subject);
  if (group) {
    /*
     * The first tag that names anything decides, so "Writing Skills → Jumbled sentences" is Sentence Transformation alone and
     * not every unit "Writing Skills" could mean. Within it the longest phrase wins: "Phrasal verbs" is Vocabulary, not
     * Grammar for its "verbs". Rules naming the same phrase ("Geometry and Trigonometry") all stand.
     */
    for (const text of [...levels, subject]) {
      let best = 0;
      const hits: Array<{ rule: Rule; len: number }> = [];
      for (const rule of RULES[group]) {
        const len = Math.max(0, ...rule.any.filter(p => has(text, p)).map(p => p.length));
        if (len > 0) hits.push({ rule, len });
        best = Math.max(best, len);
      }
      if (best > 0) {
        hits.filter(h => h.len === best).forEach(h => h.rule.units.forEach(u => found.add(u)));
        break;
      }
    }
  }

  if (found.size === 0 && unitId) {
    const family = unitId.replace(/^(?:n[12g]|g\d+)-/, '');
    (UNIT_FALLBACK[family] ?? []).forEach(u => found.add(u));
  }
  return [...found];
}

/** Whether a question's tags name content CHSL leaves out (Tamil Nadu, translation, set texts…), whichever route would place it. */
export function chslExcluded(tags: BankTags): boolean {
  const subject = key(tags.subject);
  const levels = [key(tags.subtopic), key(tags.topic), key(tags.chapter)].filter(k => k.trim());
  if (EXCLUDED.some(p => has([subject, ...levels].join(''), p))) return true;
  return STATE.some(p => has(levels.length > 0 ? levels[0] : subject, p));
}

/** The bridge's tables, read-only, for exporting the mapping to the backend team. */
export const CHSL_BRIDGE_TABLES = { rules: RULES, excluded: EXCLUDED, state: STATE, unitFallback: UNIT_FALLBACK } as const;
