/**
 * Evaluation Hub history, by user: who has attended which assessments, and how it went.
 *
 * An assessment's detail lists its attempts two ways — by invitation (a student invited by e-mail) and as
 * `direct_attempts` (a portal user who opened it themselves). This reads both, for every assessment given, and
 * turns them into one list of users, each with the attempts they made across assessments.
 */
import { readTnpscTag } from '@/lib/tnpscAdminApi';
import { kindOf, type AssessmentKind } from '@/lib/assessment-hierarchy';

type Row = Record<string, any>;

export type HistoryKind = AssessmentKind | 'unplaced';
export type AttemptState = 'submitted' | 'auto_submitted' | 'in_progress';

export interface EvalAttemptRow {
  /** The id the assessment's own report opens this attempt by. */
  attemptId: string | null;
  assessmentId: string;
  assessmentTitle: string;
  kind: HistoryKind;
  startedAt: string | null;
  submittedAt: string | null;
  state: AttemptState;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  timeSeconds: number | null;
}

export interface EvalHistoryUser {
  /** E-mail, lower-cased; the user's identity across assessments. */
  key: string;
  name: string;
  email: string;
  /** Newest first. */
  attempts: EvalAttemptRow[];
  /** Different assessments attended. */
  assessments: number;
  /** Attempts that were finished. */
  completed: number;
  avgPercentage: number | null;
  bestPercentage: number | null;
  lastAt: string | null;
}

const stateOf = (status: unknown): AttemptState => {
  const s = typeof status === 'string' ? status.toLowerCase() : '';
  if (s === 'auto_submitted') return 'auto_submitted';
  if (s === 'submitted' || s === 'evaluated' || s === 'completed') return 'submitted';
  return 'in_progress';
};

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

const ms = (iso: unknown) => (typeof iso === 'string' ? Date.parse(iso) : NaN);

/** The attempts that belong to an invitation: the linked ones, else the latest one embedded on the invitation. */
function invitationAttempts(detail: Row, inv: Row): Row[] {
  const linked = ((detail?.attempts as Row[]) || []).filter(a => a.invitation_id === inv.id);
  if (linked.length > 0) return linked;
  if (inv.attempt_id) {
    return [
      {
        id: inv.attempt_id,
        status: inv.attempt_status || inv.status,
        score: inv.score,
        max_score: inv.max_score,
        percentage: inv.percentage,
        started_at: inv.started_at ?? null,
        submitted_at: inv.submitted_at ?? null,
      },
    ];
  }
  return [];
}

function toRow(att: Row, assessment: Row, detail: Row, kind: HistoryKind): EvalAttemptRow {
  const state = stateOf(att.status);
  const score = num(att.score);
  const maxScore = num(att.max_score) ?? num(detail?.max_score) ?? num(assessment?.max_score);
  const started = att.started_at ?? att.start_time ?? null;
  const submitted = att.submitted_at ?? att.end_time ?? null;
  const pct = num(att.percentage) ?? (score != null && maxScore ? (score / maxScore) * 100 : null);
  const span = !Number.isNaN(ms(started)) && !Number.isNaN(ms(submitted)) ? Math.max(0, Math.round((ms(submitted) - ms(started)) / 1000)) : null;
  return {
    attemptId: att.id ?? att.attempt_id ?? null,
    assessmentId: String(assessment.id),
    assessmentTitle: assessment.title ?? detail?.title ?? 'Untitled assessment',
    kind,
    startedAt: started,
    submittedAt: submitted,
    state,
    // An unfinished attempt has no score to show.
    score: state === 'in_progress' ? null : score,
    maxScore,
    percentage: state === 'in_progress' ? null : pct,
    timeSeconds: state === 'in_progress' ? null : num(att.time_taken_seconds) ?? span,
  };
}

/** Which kind an assessment is — by its own tag — or `unplaced` when the tag does not say. */
export function kindOfAssessment(a: Row): HistoryKind {
  const tag = readTnpscTag(a);
  return (tag.stage_id && tag.track ? kindOf(tag) : null) ?? 'unplaced';
}

type Draft = Omit<EvalHistoryUser, 'assessments' | 'completed' | 'avgPercentage' | 'bestPercentage' | 'lastAt'>;

const finalise = (u: Draft): EvalHistoryUser => {
  const attempts = [...u.attempts].sort(
    (a, b) => (ms(b.submittedAt ?? b.startedAt) || 0) - (ms(a.submittedAt ?? a.startedAt) || 0),
  );
  const done = attempts.filter(a => a.state !== 'in_progress' && a.percentage != null);
  const pcts = done.map(a => a.percentage as number);
  return {
    ...u,
    attempts,
    assessments: new Set(attempts.map(a => a.assessmentId)).size,
    completed: attempts.filter(a => a.state !== 'in_progress').length,
    avgPercentage: pcts.length ? Math.round((pcts.reduce((s, p) => s + p, 0) / pcts.length) * 10) / 10 : null,
    bestPercentage: pcts.length ? Math.round(Math.max(...pcts) * 10) / 10 : null,
    lastAt: attempts[0] ? (attempts[0].submittedAt ?? attempts[0].startedAt) : null,
  };
};

/** The users who attended anything, each with their attempts across the assessments given. Most recent first. */
export function buildUserHistory(items: Array<{ assessment: Row; detail: Row | null | undefined }>): EvalHistoryUser[] {
  const users = new Map<string, Draft>();

  const add = (email: unknown, name: unknown, row: EvalAttemptRow) => {
    const mail = typeof email === 'string' ? email.trim() : '';
    const key = mail.toLowerCase() || `anon:${String(name ?? 'unknown')}`;
    const u = users.get(key) ?? { key, name: (typeof name === 'string' && name.trim()) || mail || 'Unknown user', email: mail, attempts: [] };
    if (!u.email && mail) u.email = mail;
    if ((u.name === 'Unknown user' || u.name === u.email) && typeof name === 'string' && name.trim()) u.name = name.trim();
    u.attempts.push(row);
    users.set(key, u);
  };

  for (const { assessment, detail } of items) {
    if (!detail) continue;
    const kind = kindOfAssessment({ ...assessment, ...detail });
    for (const inv of (detail.invitations as Row[]) || []) {
      for (const att of invitationAttempts(detail, inv)) {
        add(inv.email, inv.name ?? inv.full_name, toRow(att, assessment, detail, kind));
      }
    }
    for (const u of ((detail as Row).direct_attempts as Row[]) || []) {
      for (const att of (u.attempts as Row[]) || []) {
        add(u.email, u.name, toRow(att, assessment, detail, kind));
      }
    }
  }
  return [...users.values()].map(finalise).sort((a, b) => (ms(b.lastAt) || 0) - (ms(a.lastAt) || 0));
}
