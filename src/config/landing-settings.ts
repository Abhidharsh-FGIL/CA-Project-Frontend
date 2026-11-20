/**
 * The exams the landing page says are open ("Live" chip in the hero, "Currently Available" banner, closing call to
 * action). Set by the admin under Admin Settings → Landing page, one exam a line; these are what shows until the server
 * sends its own (or when it has none), so the page never loses the chip.
 */
export const DEFAULT_LIVE_EXAMS: string[] = ['TNPSC Group 4 & 2', 'RRB NTPC CBT-1 (UG & Graduate)'];

/** The chip has room for a few short lines, not a paragraph. */
export const MAX_LIVE_EXAMS = 4;
export const MAX_LIVE_EXAM_LENGTH = 60;

/** One exam a line → trimmed, non-empty, de-duplicated names (case-insensitive), at most MAX_LIVE_EXAMS. */
export function parseLiveExams(raw: unknown): string[] {
  const lines = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/\r?\n/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    if (typeof l !== 'string') continue;
    const name = l.replace(/\s+/g, ' ').trim().slice(0, MAX_LIVE_EXAM_LENGTH);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
    if (out.length === MAX_LIVE_EXAMS) break;
  }
  return out;
}

/** The server's landing settings → the list to show. Accepts `live_exams` as a list or as a newline-separated string. */
export function liveExamsFromSettings(raw: unknown): string[] {
  const body = (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}) as Record<string, unknown>;
  const list = parseLiveExams(body.live_exams ?? body.liveExams);
  return list.length > 0 ? list : DEFAULT_LIVE_EXAMS;
}

/** "A", "A and B", "A, B and C" — for the sentence in the closing call to action. */
export function joinExamNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
