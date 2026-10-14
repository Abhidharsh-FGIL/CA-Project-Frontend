/**
 * What the Exams page offers, and in what order.
 *
 * The catalog (`TNPSC_GROUPS`) says which examinations the product *can* render; this says
 * which of them are open to aspirants today. They are different questions: Group 1 and
 * GAT-B have catalog entries — the admin hub places papers under them — but only Group 4
 * is on sale, so the page shows the rest as coming soon rather than as a door that opens
 * onto unfinished screens.
 *
 * The upcoming exams below are announcements, not catalog entries. They are kept out of
 * `TNPSC_GROUPS` on purpose: everything that reads that list — the admin placement pickers,
 * the study-plan wizard, coverage reports — would otherwise offer an exam that has no
 * syllabus, stages or papers behind it.
 */
import type { TnpscGroup } from '@/config/tnpsc';

/** Examinations aspirants can open today. Everything else in the catalog is shown as coming soon. */
export const OPEN_EXAM_IDS: ReadonlySet<string> = new Set(['group-4']);

export interface UpcomingExam {
  id: string;
  name: string;
  /** The body that conducts it — the card's eyebrow. */
  authority: string;
  /** What the examination is called officially. */
  tagline: string;
  description: string;
}

/** Announced, not built. Descriptions say what the exam is, never what the portal will offer. */
export const UPCOMING_EXAMS: UpcomingExam[] = [
  {
    id: 'tnpsc-group-2',
    name: 'TNPSC Group 2 & 2A',
    authority: 'Tamil Nadu Public Service Commission',
    tagline: 'Combined Civil Services Examination — II',
    description: 'Interview and non-interview posts in departments of the Tamil Nadu government.',
  },
  {
    id: 'ssc-cgl',
    name: 'SSC CGL',
    authority: 'Staff Selection Commission',
    tagline: 'Combined Graduate Level Examination',
    description: 'Group B and Group C posts in ministries, departments and offices of the Government of India.',
  },
  {
    id: 'ibps-bank',
    name: 'IBPS Bank PO & Clerk',
    authority: 'Institute of Banking Personnel Selection',
    tagline: 'Common Recruitment Process for Banks',
    description: 'Probationary Officer and Clerk recruitment for public sector banks.',
  },
];

/** The examinations that are open, and those that are not, each in catalog order. */
export function splitExams(groups: TnpscGroup[]): { open: TnpscGroup[]; soon: TnpscGroup[] } {
  return {
    open: groups.filter(g => OPEN_EXAM_IDS.has(g.id)),
    soon: groups.filter(g => !OPEN_EXAM_IDS.has(g.id)),
  };
}
