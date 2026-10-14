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
 * What the chip says: the printed Tamil name under the Tamil paper, the English name
 * everywhere else. A General Studies unit's `nameTa` is a translation supplied for
 * display, and a chip that led with it left an English-reading aspirant looking at
 * a row of Tamil.
 */
export function unitChipLabel(unit: { name: string; nameTa?: string | null }, tamilOnly: boolean): string {
  return tamilOnly && unit.nameTa ? shortTamilName(unit.nameTa) : shortEnglishName(unit.name);
}
