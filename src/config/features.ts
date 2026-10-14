/**
 * Whether the study plan is offered to students — the "Study Plan" entry in the nav, the card
 * on the dashboard and the call to action at the end of an attempt report.
 *
 * Turned off deliberately rather than deleted: the pages, routes and API client are untouched
 * (`/user/study-plan` still resolves if typed in), so restoring the feature is this one line.
 */
export const SHOW_STUDY_PLAN = false;
