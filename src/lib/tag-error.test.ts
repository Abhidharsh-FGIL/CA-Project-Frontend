/**
 * What an admin is told when the server refuses a paper's placement.
 *
 * The real failure that prompted this: tagging a Tamil unit paper answered
 * `404 SUBJECT_NOT_FOUND — 'Written Examination' has no subject 'general-tamil'`,
 * and the portal reported it as "the endpoint is not deployed yet".
 */
import { describe, expect, it } from 'vitest';
import { toRequestError } from '@/lib/api';
import { EMPTY_TAG, describeTagError, type TnpscTagValue } from '@/lib/tnpscAdminApi';

const tag: TnpscTagValue = { ...EMPTY_TAG, group_id: 'group-4', stage_id: 'group-4-written' };

/** The body the server actually sent. */
const SUBJECT_NOT_FOUND = {
  success: false,
  error_code: 'SUBJECT_NOT_FOUND',
  message: "'Written Examination' has no subject 'general-tamil'.",
  details: null,
};

describe('toRequestError', () => {
  it('lifts the code from either spelling', () => {
    expect((toRequestError(SUBJECT_NOT_FOUND, 404) as any).code).toBe('SUBJECT_NOT_FOUND');
    expect(
      (toRequestError({ detail: { code: 'PLAN_REQUIRED', message: 'Upgrade' } }, 403) as any).code,
    ).toBe('PLAN_REQUIRED');
  });

  it('keeps the message and status', () => {
    const err = toRequestError(SUBJECT_NOT_FOUND, 404) as any;
    expect(err.message).toBe("'Written Examination' has no subject 'general-tamil'.");
    expect(err.status).toBe(404);
  });
});

describe('describeTagError', () => {
  it('names the missing subject and the exam, and says the paper is saved', () => {
    const text = describeTagError(toRequestError(SUBJECT_NOT_FOUND, 404), tag);
    expect(text).toContain('General Tamil');
    expect(text).toContain('TNPSC Group 4 Written');
    expect(text).toContain('saved');
  });

  it('does not blame a missing endpoint for a missing subject', () => {
    expect(describeTagError(toRequestError(SUBJECT_NOT_FOUND, 404), tag)).not.toMatch(/not available|not deployed/i);
  });

  it('still recognises a missing subject when only the message arrives', () => {
    const err = new Error("'Written Examination' has no subject 'general-tamil'.");
    expect(describeTagError(err, tag)).toContain('General Tamil');
  });

  it('falls back to the slug for a subject the catalog has not heard of', () => {
    const err = toRequestError({ ...SUBJECT_NOT_FOUND, message: "'Written Examination' has no subject 'brand-new'." }, 404);
    expect(describeTagError(err, tag)).toContain('brand-new');
  });

  it('says the endpoint is missing only when the route itself is', () => {
    expect(describeTagError(toRequestError({ detail: 'Not Found' }, 404), tag)).toMatch(/endpoint is not available/i);
  });

  it('passes any other server message through untouched', () => {
    const err = toRequestError({ detail: { code: 'X', message: 'A practice test needs a subject.' } }, 422);
    expect(describeTagError(err, tag)).toBe('A practice test needs a subject.');
  });

  it('has something to say when there is nothing to go on', () => {
    expect(describeTagError({}, tag)).toBeTruthy();
  });
});
