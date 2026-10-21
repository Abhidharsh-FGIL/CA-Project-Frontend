/**
 * Who may download the whole question paper from a report. Limited to the team's own accounts; compared
 * without regard to case. The server should enforce this as well — this only decides what the page shows.
 */
const QUESTION_DOWNLOAD_EMAILS = [
  'aravindhkumar@fgilservices.com',
  'reeba@fgilservices.com',
  'nambi@fgilservices.com',
  'sanjana@fgilservices.com',
];

export function canDownloadQuestions(email: string | null | undefined): boolean {
  return !!email && QUESTION_DOWNLOAD_EMAILS.includes(email.trim().toLowerCase());
}
