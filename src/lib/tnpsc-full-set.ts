/**
 * Which paper is a section's "Full Set".
 *
 * A full set is the one paper that covers a whole section — "Aptitude & Mental Ability · Full
 * Set", 25 questions across both of its units. The stage page offers it at the foot of the
 * section's units, so what it opens had better be that section's paper.
 *
 * It used to be found by question count alone: the first paper with no topic and as many
 * questions as the section. Every practice paper in the stage was in the running, so a Tamil
 * literature unit paper of 25 questions was served as Aptitude's full set. A count says how big
 * a paper is, not which section it belongs to — so nothing here is decided on a count by itself.
 *
 * A paper is a section's full set when it is *placed* there:
 *
 *  1. by its tag — the admin chose "this section's Full Set" when creating it; or
 *  2. by its title — the wizard writes `<exam> — <section> · Full Set`; or
 *  3. by its subject — it sits under one of the section's own subjects and is the section's size.
 *
 * Whatever the section, a paper tagged to a unit or a topic is a unit paper and never a full set,
 * and a paper placed in a *different* section is never taken for this one. With nothing placed
 * here the answer is null and the page says "Not available" rather than opening the wrong paper.
 */
import { sectionSyllabus, type TnpscPatternSection, type TnpscStage } from '@/config/tnpsc';
import type { TnpscTest } from '@/lib/tnpscApi';

/** Case, spacing and Unicode composition do not distinguish two spellings of a name. */
const key = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * The section a title names, for a title of the form `<exam> — <section> · Full Set`.
 * Null for every other title — a unit paper, a mock, or a title an admin has rewritten.
 */
export function fullSetSectionFromTitle(title: string | null | undefined): string | null {
  const t = title?.trim();
  if (!t) return null;

  const dash = t.indexOf(' — ');
  if (dash < 0) return null;
  const rest = t.slice(dash + 3);
  const dot = rest.lastIndexOf(' · ');
  if (dot < 0 || key(rest.slice(dot + 3)) !== 'full set') return null;

  return rest.slice(0, dot).trim() || null;
}

/** The section a paper says it belongs to — its tag first, its title otherwise. */
function claimedSection(t: TnpscTest): string | null {
  return t.section_name?.trim() || fullSetSectionFromTitle(t.title);
}

export function fullSetFor(
  stage: TnpscStage | undefined,
  section: TnpscPatternSection,
  tests: TnpscTest[],
): TnpscTest | null {
  const name = key(section.name);
  const ownSubjects = new Set(sectionSyllabus(stage, section).map(s => s.id));

  // A unit or topic tag makes it a unit paper. One placed in another section is theirs.
  const open = tests.filter(t => {
    if (t.unit_id || t.topic_id) return false;
    const claimed = claimedSection(t);
    return claimed == null || key(claimed) === name;
  });

  // Placed here by tag or title. Prefer the one of the section's size if there are several.
  const named = open.filter(t => claimedSection(t) != null);
  const placed = named.find(t => t.question_count === section.questions) ?? named[0];
  if (placed) return placed;

  // Not placed by name: it must at least sit under this section's own subjects, and be its size.
  return (
    open.find(
      t =>
        (t.subject_id != null && ownSubjects.has(t.subject_id) && t.question_count === section.questions) ||
        (t.subject_name != null && key(t.subject_name) === name),
    ) ?? null
  );
}
