/**
 * Whether a row from any assessment or attempt list is a promotional test — such a paper is never listed among the
 * exams, and its attempts never count against the plan (BACKEND_PROMOTIONAL.md). Kept apart from `promotionalApi`
 * so the plan arithmetic does not pull in the API clients.
 */
export const isPromotional = (row: unknown): boolean => {
  const r = row as Record<string, unknown> | null | undefined;
  return !!r && (r.is_promotional === true || r.promotional === true || r.kind === 'promotional');
};

/** The rows that are not promotional — what every exam listing shows. */
export const withoutPromotional = <T,>(rows: T[] | null | undefined): T[] => (rows ?? []).filter(r => !isPromotional(r));
