import { SUPPORT_EMAIL, SUPPORT_PHONE } from '@/config/support';
import { textFor } from './useText';
import { useSiteContent } from './store';

/**
 * How a student reaches support — the admin's (Site content → Support contact), else `config/support`. The footers, the
 * legal pages, the portal's help menu and the referral mail all read this, so they never disagree.
 */
export function useSupport() {
  const overrides = useSiteContent();
  const email = textFor('site.support.email', undefined, overrides).trim() || SUPPORT_EMAIL;
  const phone = textFor('site.support.phone', undefined, overrides).trim() || SUPPORT_PHONE;
  /** For `tel:` links: digits and a leading +. */
  const phoneLink = phone.replace(/[^\d+]/g, '');
  return { email, phone, phoneLink, contact: `${email} or ${phone}` };
}
