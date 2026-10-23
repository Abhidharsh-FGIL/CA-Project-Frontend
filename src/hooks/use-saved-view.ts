import { useCallback, useEffect, useRef, useState } from 'react';
import { ALL_TIME, type DateRange } from '@/components/user/DateRangeFilter';
import { openGroupKey, type ExamGroupKey, type ExamTrackKey } from '@/hooks/use-progress-trend';
import { clearSavedView, loadSavedView, saveView } from '@/lib/saved-view';

interface Named {
  user_id?: string;
  preferred_exam?: string | null;
}

/**
 * The exam, test type and date range of the dashboard and performance pages.
 *
 * They open on what the aspirant chose last time. With nothing chosen yet the exam is the one they registered
 * for or set on their profile, the test type is practice and the range is all time. A choice made here is kept
 * (see `saved-view.ts`); an exam named in the address (`link`) wins for that visit, and counts as chosen.
 *
 * The profile can arrive after the first render, so what is remembered is applied when it does — but never
 * over a choice the person has just made.
 */
export function useSavedView(user: Named | null | undefined, link: { group?: ExamGroupKey; track?: ExamTrackKey; range?: DateRange } = {}) {
  const userKey = user?.user_id ?? null;
  const preferred = openGroupKey(user?.preferred_exam);

  const [group, setGroup] = useState<ExamGroupKey>(link.group ?? preferred);
  const [track, setTrack] = useState<ExamTrackKey>(link.track ?? 'practice');
  const [range, setRange] = useState<DateRange>(link.range ?? ALL_TIME);
  const touched = useRef({ group: !!link.group, track: !!link.track, range: !!link.range });

  useEffect(() => {
    const saved = loadSavedView(userKey, preferred);
    if (!touched.current.group) setGroup(saved.group ?? preferred);
    if (!touched.current.track && saved.track) setTrack(saved.track);
    if (!touched.current.range && saved.range) setRange(saved.range);
  }, [userKey, preferred]);

  const chooseGroup = useCallback(
    (v: ExamGroupKey) => {
      touched.current.group = true;
      setGroup(v);
      saveView(userKey, { group: v, forPreferred: preferred });
    },
    [userKey, preferred],
  );
  const chooseTrack = useCallback(
    (v: ExamTrackKey) => {
      touched.current.track = true;
      setTrack(v);
      saveView(userKey, { track: v });
    },
    [userKey],
  );
  const chooseRange = useCallback(
    (v: DateRange) => {
      touched.current.range = true;
      setRange(v);
      saveView(userKey, { range: v });
    },
    [userKey],
  );

  /** Back to how it opens for someone who has chosen nothing: the profile's exam, practice, all time. */
  const resetView = useCallback(() => {
    touched.current = { group: false, track: false, range: false };
    clearSavedView(userKey);
    setGroup(preferred);
    setTrack('practice');
    setRange(ALL_TIME);
  }, [userKey, preferred]);

  return { group, track, range, preferred, chooseGroup, chooseTrack, chooseRange, resetView };
}
