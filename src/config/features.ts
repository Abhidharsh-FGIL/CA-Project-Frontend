/**
 * Whether the study plan is offered to students — the "Study Plan" entry in the nav, the card
 * on the dashboard and the call to action at the end of an attempt report.
 *
 * Turned off deliberately rather than deleted: the pages, routes and API client are untouched
 * (`/user/study-plan` still resolves if typed in), so restoring the feature is this one line.
 */
export const SHOW_STUDY_PLAN = false;

/**
 * Whether students can sign in with an email and password. Off, the student login page is the
 * OTP form alone: no password form, no "Forgot Password?", no way to switch to one.
 *
 * Turned off deliberately rather than deleted, like the study plan above: the password form, its
 * reset flow and the API client are untouched, so restoring it is this one line. The admin login
 * is a page of its own and is not affected.
 */
export const STUDENT_PASSWORD_LOGIN = false;

/**
 * Whether an attempt report has a "Progress" tab beside "This Attempt". Off, the report is the one attempt and
 * nothing else — no tabs.
 *
 * Turned off deliberately rather than deleted: the progress view is untouched, so restoring the tab is this
 * one line.
 */
export const SHOW_PROGRESS_TAB = false;
