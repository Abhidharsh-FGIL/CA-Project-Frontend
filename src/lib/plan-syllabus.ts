/**
 * The printed syllabus behind a study-plan task.
 *
 * The plan is built by the server, and it schedules a generic subject taxonomy —
 * "Physics", "Botany", "Constitution — Basics & Preamble" — not the commission's
 * published units. A task for "Physics" tells a candidate nothing about which of
 * the paper's printed topics to open.
 *
 * This resolves a task to the unit it belongs to and the printed topics it covers,
 * so the plan can say what to study in the syllabus's own words.
 *
 * Two routes, in order:
 *  1. The task names its unit (`unit_id`). This is the proper route, and what the
 *     server should send once it plans from units — see STUDY_PLAN_BACKEND_CHANGES.md.
 *  2. Otherwise today's taxonomy topic is mapped to the printed topics it covers.
 *     That is an interpretation, kept deliberately narrow and written out below so
 *     it can be read and argued with.
 *
 * Several printed topics have no taxonomy topic, and several taxonomy topics have
 * no printed topic. Neither is papered over: a task that matches nothing shows no
 * syllabus block rather than an invented one.
 */
import { findUnit, stageUnits, unitDisplayName, type TnpscStage, type TnpscTopic } from '@/config/tnpsc';
import type { PlanTask } from '@/lib/studyPlanApi';

export interface TaskSyllabus {
  /** The Roman numeral as printed, e.g. "IV". */
  unitLabel?: string;
  unitName: string;
  unitNameTa?: string;
  /** What the unit is worth in the real paper. */
  questions: number;
  /** The printed topics this task covers, in printed order. */
  topics: TnpscTopic[];
}

interface Covers {
  unit: string;
  /** Printed topic ids, or every topic of the unit. */
  topics: string[] | 'all';
}

const ALL = 'all' as const;

/**
 * Group 4: the server's `subject_id/topic_id` → the printed topics it stands for.
 *
 * Left out on purpose, because the syllabus lists nothing they could point at:
 *  - every `current-events/*` topic — the syllabus puts "current affairs" inside each
 *    unit rather than as a unit of its own;
 *  - `aptitude-and-mental-ability/data-interpretation` — not a printed topic;
 *  - `development-administration-tn/e-governance-tn` — not a printed topic.
 */
const G4_TAXONOMY: Record<string, Covers> = {
  // Part C — Tamil
  'general-tamil/grammar': { unit: 'g4-ta-grammar', topics: ALL },
  'general-tamil/vocabulary': { unit: 'g4-ta-vocabulary', topics: ALL },
  'general-tamil/comprehension': { unit: 'g4-ta-comprehension', topics: ALL },
  'general-tamil/literature': {
    unit: 'g4-ta-literature',
    topics: ['thirukkural', 'naladiyar', 'pazhamozhi-nanooru', 'thirikadugam', 'sirupanchamoolam', 'tamizh-thonmai', 'dravida-mozhikal'],
  },
  'general-tamil/authors-and-works': {
    unit: 'g4-ta-literature',
    topics: ['uve-saminatha-iyer', 'ilakkuvanar-paavaanar', 'gu-pope-veeramamunivar', 'tamizh-saandror'],
  },

  // Part C — English
  'general-english/grammar': { unit: 'g4-en-grammar', topics: ALL },
  'general-english/vocabulary': { unit: 'g4-en-vocabulary', topics: ALL },
  'general-english/comprehension': { unit: 'g4-en-comprehension', topics: ALL },
  'general-english/literature': {
    unit: 'g4-en-literary-works',
    topics: ['en-figures-of-speech', 'poetry-appreciation', 'lines-of-significance', 'prescribed-poems', 'prescribed-prose'],
  },
  'general-english/authors-and-works': {
    unit: 'g4-en-literary-works',
    topics: ['prescribed-poems', 'prescribed-prose'],
  },

  // Part A, Unit I — General Science
  'general-science/physics': {
    unit: 'g4-gs-general-science',
    topics: ['nature-of-universe', 'measurement', 'laws-in-motion', 'everyday-physics'],
  },
  'general-science/chemistry': {
    unit: 'g4-gs-general-science',
    topics: ['elements-and-compounds', 'petroleum-fertilizers', 'metallurgy-adulterants'],
  },
  'general-science/botany': {
    unit: 'g4-gs-general-science',
    topics: ['life-science', 'classification-living', 'environmental-science'],
  },
  'general-science/zoology': {
    unit: 'g4-gs-general-science',
    topics: ['life-science', 'evolution-genetics', 'nutrition-health'],
  },
  'general-science/science-in-everyday-life': {
    unit: 'g4-gs-general-science',
    topics: ['everyday-physics', 'petroleum-fertilizers', 'metallurgy-adulterants', 'nutrition-health', 'latest-inventions'],
  },

  // Part A, Unit II — Geography
  'geography/physical-geography': {
    unit: 'g4-gs-geography',
    topics: ['earth-location', 'physical-features', 'geographical-landmarks'],
  },
  'geography/climate-and-monsoon': {
    unit: 'g4-gs-geography',
    topics: ['monsoon-climate', 'calamities-disaster', 'environment-climate-change'],
  },
  'geography/rivers-and-water-resources': { unit: 'g4-gs-geography', topics: ['water-resources-rivers'] },
  'geography/agriculture-and-minerals': {
    unit: 'g4-gs-geography',
    topics: ['soil-minerals', 'forest-wildlife', 'agriculture-pattern'],
  },
  'geography/tamil-nadu-geography': {
    unit: 'g4-gs-geography',
    topics: ['population-density', 'transport-communication'],
  },

  // Part A, Unit III — History, Culture of India, and Indian National Movement
  'history-and-culture/ancient-india': {
    unit: 'g4-gs-history-and-inm',
    topics: ['indus-valley', 'guptas-sultans-mughals', 'south-indian-history'],
  },
  'history-and-culture/medieval-india': {
    unit: 'g4-gs-history-and-inm',
    topics: ['guptas-sultans-mughals', 'south-indian-history'],
  },
  'history-and-culture/modern-india': {
    unit: 'g4-gs-history-and-inm',
    topics: ['national-renaissance', 'early-uprising', 'indian-national-congress'],
  },
  'history-and-culture/art-and-architecture': {
    unit: 'g4-gs-history-and-inm',
    topics: ['indian-culture', 'secular-state'],
  },
  'indian-national-movement/freedom-struggle': {
    unit: 'g4-gs-history-and-inm',
    topics: ['early-uprising', 'indian-national-congress', 'national-renaissance'],
  },
  'indian-national-movement/national-leaders': { unit: 'g4-gs-history-and-inm', topics: ['emergence-of-leaders'] },
  'indian-national-movement/role-of-tamil-nadu': { unit: 'g4-gs-history-and-inm', topics: ['tn-modes-of-agitation'] },

  // Part A, Unit IV — Indian Polity
  'indian-polity/constitution-basics': {
    unit: 'g4-gs-indian-polity',
    topics: ['constitution-preamble', 'salient-features', 'union-state-ut'],
  },
  'indian-polity/fundamental-rights-duties': {
    unit: 'g4-gs-indian-polity',
    topics: ['citizenship-rights-duties', 'directive-principles', 'human-rights-charter'],
  },
  'indian-polity/union-and-state-executive': {
    unit: 'g4-gs-indian-polity',
    topics: ['union-executive-legislature', 'state-executive-legislature', 'federalism'],
  },
  'indian-polity/parliament-and-judiciary': {
    unit: 'g4-gs-indian-polity',
    topics: ['union-executive-legislature', 'state-executive-legislature', 'election', 'judiciary-rule-of-law'],
  },
  'indian-polity/local-self-government': { unit: 'g4-gs-indian-polity', topics: ['local-government-panchayat'] },

  // Part A, Unit V — Indian Economy and Development Administration in Tamil Nadu
  'indian-economy/national-income': {
    unit: 'g4-gs-economy-and-dev-admin',
    topics: ['nature-of-economy', 'employment-generation', 'industrial-growth'],
  },
  'indian-economy/planning-and-niti-aayog': {
    unit: 'g4-gs-economy-and-dev-admin',
    topics: ['five-year-plans', 'planning-niti-aayog'],
  },
  'indian-economy/banking-and-finance': {
    unit: 'g4-gs-economy-and-dev-admin',
    topics: ['sources-of-revenue', 'reserve-bank', 'finance-commission', 'resource-sharing', 'gst'],
  },
  'indian-economy/rural-and-urban-economy': {
    unit: 'g4-gs-economy-and-dev-admin',
    topics: ['land-reforms-agriculture', 'science-in-agriculture', 'rural-welfare', 'social-problems'],
  },
  'indian-economy/tamil-nadu-economy': {
    unit: 'g4-gs-economy-and-dev-admin',
    topics: ['tn-education-health', 'tn-geography-economy'],
  },
  'development-administration-tn/welfare-schemes-tn': { unit: 'g4-gs-economy-and-dev-admin', topics: ['welfare-schemes'] },
  'development-administration-tn/human-development-indicators': {
    unit: 'g4-gs-economy-and-dev-admin',
    topics: ['social-problems', 'tn-education-health'],
  },

  // Part A, Unit VI — History, Culture, Heritage, and Socio-Political Movements of Tamil Nadu
  'tamil-nadu-history-and-society/sangam-age': {
    unit: 'g4-gs-tamil-nadu-history',
    topics: ['tamil-society-archaeology', 'tamil-literature-sangam'],
  },
  'tamil-nadu-history-and-society/tamil-society-and-culture': {
    unit: 'g4-gs-tamil-nadu-history',
    topics: [
      'tamil-society-archaeology',
      'thirukkural-secular',
      'thirukkural-everyday',
      'thirukkural-values',
      'thirukkural-socio-politico',
      'thirukkural-philosophy',
    ],
  },
  'tamil-nadu-history-and-society/dravidian-movement': {
    unit: 'g4-gs-tamil-nadu-history',
    topics: ['tn-early-agitations', 'social-reform-movements', 'social-transformation-tn'],
  },
  'tamil-nadu-history-and-society/social-reformers': {
    unit: 'g4-gs-tamil-nadu-history',
    topics: ['social-reformers', 'social-reform-movements'],
  },

  // Part B — Aptitude and Mental Ability
  'aptitude-and-mental-ability/simplification-and-percentage': {
    unit: 'g4-apt-aptitude',
    topics: ['simplification', 'percentage'],
  },
  'aptitude-and-mental-ability/ratio-and-proportion': { unit: 'g4-apt-aptitude', topics: ['ratio-and-proportion'] },
  'aptitude-and-mental-ability/time-work-distance': { unit: 'g4-apt-aptitude', topics: ['time-and-work'] },
  'aptitude-and-mental-ability/number-series': { unit: 'g4-apt-reasoning', topics: ['number-series'] },
  'aptitude-and-mental-ability/logical-reasoning': {
    unit: 'g4-apt-reasoning',
    topics: ['logical-reasoning', 'puzzles', 'dice', 'visual-reasoning', 'alpha-numeric-reasoning'],
  },
};

/** The taxonomy keys this module maps — exposed so a test can check them against the catalog. */
export const G4_TAXONOMY_KEYS = Object.keys(G4_TAXONOMY);

/** The printed topic ids the Group 4 taxonomy reaches, by unit. */
export function g4ReachedTopics(): Map<string, Set<string>> {
  const reached = new Map<string, Set<string>>();
  for (const cover of Object.values(G4_TAXONOMY)) {
    const set = reached.get(cover.unit) ?? new Set<string>();
    if (cover.topics !== ALL) cover.topics.forEach(t => set.add(t));
    reached.set(cover.unit, set);
  }
  return reached;
}

function describe(
  stage: TnpscStage,
  unitId: string,
  topics: string[] | 'all',
): TaskSyllabus | null {
  const unit = findUnit(stage, unitId);
  if (!unit) return null;

  const printed = unit.topics ?? [];
  const wanted = topics === ALL ? printed : printed.filter(t => topics.includes(t.id));
  if (wanted.length === 0) return null;

  // A Tamil unit is named in Tamil; repeating it as a gloss would just print it twice.
  const name = unitDisplayName(stage, unit);
  return {
    unitLabel: unit.label,
    unitName: name,
    unitNameTa: name === unit.name ? unit.name_ta : undefined,
    questions: unit.questions,
    topics: wanted,
  };
}

/** The unit and printed topics a task covers, or null when the syllabus lists nothing for it. */
export function syllabusForTask(
  stage: TnpscStage | undefined,
  task: Pick<PlanTask, 'subject_id' | 'topic_id' | 'unit_id'>,
): TaskSyllabus | null {
  if (!stage || stageUnits(stage).length === 0) return null;

  // 1. The server named the unit — and, if it did, perhaps the printed topic too.
  if (task.unit_id) {
    const unit = findUnit(stage, task.unit_id);
    if (unit) {
      const own = task.topic_id ? unit.topics?.find(t => t.id === task.topic_id) : undefined;
      return describe(stage, unit.id, own ? [own.id] : ALL);
    }
  }

  // 2. Today's taxonomy, for the one stage it has been read against.
  if (stage.id === 'group-4-written' && task.topic_id) {
    const covers = G4_TAXONOMY[`${task.subject_id}/${task.topic_id}`];
    if (covers) return describe(stage, covers.unit, covers.topics);
  }

  return null;
}
