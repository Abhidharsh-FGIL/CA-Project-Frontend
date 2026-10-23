/**
 * The exam, test type and date range an aspirant last chose on the dashboard and performance pages, kept so
 * the pages open on them next time.
 *
 * The starting exam is the one they registered for (or changed to on their profile). A choice made on the
 * page is remembered *against that* preference: if the profile's exam is later changed, the remembered exam is
 * for the old preference and is set aside, so changing the profile still moves the pages. Kept in the browser,
 * per account — it is a convenience, so storage that is missing or refuses is the same as nothing remembered.
 */
import { ALL_TIME, rangeForKey, type DateRange, type DateRangeKey } from '@/components/user/DateRangeFilter';
import { GROUP_STAGE, type ExamGroupKey, type ExamTrackKey } from '@/hooks/use-progress-trend';

export interface SavedView {
  group?: ExamGroupKey;
  /** The exam the profile named when `group` was chosen. */
  forPreferred?: ExamGroupKey;
  track?: ExamTrackKey;
  range?: DateRange;
}

const KEY = (userKey: string) => `mge.view.${userKey}`;
const RANGE_KEYS: DateRangeKey[] = ['all', 'week', 'month', 'quarter', 'custom'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function read(userKey: string): SavedView {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(userKey)) ?? 'null');
    if (!raw || typeof raw !== 'object') return {};
    const out: SavedView = {};
    if (typeof raw.group === 'string' && raw.group in GROUP_STAGE) out.group = raw.group;
    if (typeof raw.forPreferred === 'string' && raw.forPreferred in GROUP_STAGE) out.forPreferred = raw.forPreferred;
    if (raw.track === 'mock' || raw.track === 'practice') out.track = raw.track;
    const r = raw.range;
    if (r && RANGE_KEYS.includes(r.key)) {
      // A preset is "the last 30 days" — worked out again today, not the dates it meant when it was saved.
      out.range =
        r.key === 'custom'
          ? { key: 'custom', from: DAY.test(r.from) ? r.from : null, to: DAY.test(r.to) ? r.to : null }
          : rangeForKey(r.key) ?? ALL_TIME;
    }
    return out;
  } catch {
    return {};
  }
}

/** What was remembered for this account, with the exam only if it was chosen under the current profile exam. */
export function loadSavedView(userKey: string | null | undefined, preferred: ExamGroupKey): SavedView {
  if (!userKey) return {};
  const saved = read(userKey);
  if (saved.group && saved.forPreferred !== preferred) {
    const { group: _g, forPreferred: _f, ...rest } = saved;
    void _g;
    void _f;
    return rest;
  }
  return saved;
}

/** Forgets what was remembered, so the pages go back to opening on the profile's exam. */
export function clearSavedView(userKey: string | null | undefined): void {
  if (!userKey) return;
  try {
    localStorage.removeItem(KEY(userKey));
  } catch {
    /* Nothing to forget, or storage refused. */
  }
}

/** Remembers part of the view, keeping what was remembered of the rest. */
export function saveView(userKey: string | null | undefined, patch: SavedView): void {
  if (!userKey) return;
  try {
    localStorage.setItem(KEY(userKey), JSON.stringify({ ...read(userKey), ...patch }));
  } catch {
    /* Storage refused: the choice holds for this visit and is simply not kept. */
  }
}
