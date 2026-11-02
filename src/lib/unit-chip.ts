import { inLanguage, type PaperLang } from './bilingual';

/**
 * The label on a unit's filter chip.
 *
 * A chip is a few words wide, and a unit's printed name can be a line long — "Indian
 * Economy and Development Administration in Tamil Nadu". The label has to be short
 * and still tell the units apart.
 */

/** Words that read badly as the last thing before an ellipsis. */
const DANGLING = /\s+(?:and|of|in|the|for|to|&)$/i;

/**
 * A name cut to fit, at a word, with an ellipsis where it was cut.
 *
 * Cutting at the first comma — the obvious way to shorten these — turned two
 * different units into the same chip: "History, Culture of India, and Indian National
 * Movement" and "History, Culture, Heritage, and Socio-Political Movements of Tamil
 * Nadu" both became "History". Cutting by length keeps them apart.
 */
export function shortEnglishName(name: string, max = 26): string {
  const clean = name.trim();
  if (clean.length <= max) return clean;

  const room = clean.slice(0, max + 1);
  const at = room.lastIndexOf(' ');
  let head = (at > 0 ? room.slice(0, at) : clean.slice(0, max)).replace(/[\s,;:–—-]+$/, '');
  while (DANGLING.test(head)) head = head.replace(DANGLING, '').replace(/[\s,;:–—-]+$/, '');
  return `${head}…`;
}

/**
 * The Tamil paper's titles separate their clauses with a dash as well as a comma —
 * "வாசித்தல் – புரிந்து கொள்ளும் திறன்" wants to become "வாசித்தல்", not the first two
 * words of it.
 */
export function shortTamilName(name: string): string {
  const head = name.split(/[,&(–—]/)[0].trim();
  const words = head.split(/\s+/);
  return words.length <= 3 ? head : words.slice(0, 2).join(' ');
}

/**
 * What the chip says: both names, English first and each cut short — "Grammar / இலக்கணம்". Every unit is
 * named in both languages across the portal, except the two language papers: General Tamil's chips are in Tamil
 * only (`lang` 'ta') and General English's in English only ('en').
 */
export function unitChipLabel(unit: { name: string; nameTa?: string | null }, lang?: PaperLang): string {
  if (lang === 'ta') return shortTamilName(unit.nameTa || inLanguage(unit.name, 'ta'));
  if (lang === 'en') return shortEnglishName(inLanguage(unit.name, 'en'), 20);
  const en = shortEnglishName(unit.name, 20);
  return unit.nameTa && unit.nameTa !== unit.name ? `${en} / ${shortTamilName(unit.nameTa)}` : en;
}
