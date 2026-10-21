/**
 * GST on what is sold here.
 *
 * Prices from the backend (`/subscription/plans`, `/topup/packs`) are before GST, and GST is added at
 * payment. This file is only the *words* for that — "₹499 + 18% GST". The sums are the server's: the
 * order says the GST and the total, and the checkout shows those, never a figure worked out here.
 */
export const GST_LABEL = '+ 18% GST';

/** The GST breakdown of a priced thing, in the server's own figures. All rupees. */
export interface PriceBreakdown {
  base_amount: number;
  discount_amount: number;
  taxable_amount: number;
  gst_percent: number;
  gst_amount: number;
  final_amount: number;
}

/**
 * The server's breakdown, when it sent all of it. A server that has not got GST yet sends none of
 * these, and then there is nothing to show but the price — better than a summary with holes in it.
 */
export function breakdownFrom(
  r:
    | {
        base_amount?: number;
        discount_amount?: number;
        taxable_amount?: number;
        gst_percent?: number;
        gst_amount?: number;
        final_amount?: number;
      }
    | null
    | undefined,
): PriceBreakdown | null {
  if (!r) return null;
  const { base_amount, taxable_amount, gst_percent, gst_amount, final_amount } = r;
  if (
    typeof base_amount !== 'number' ||
    typeof taxable_amount !== 'number' ||
    typeof gst_percent !== 'number' ||
    typeof gst_amount !== 'number' ||
    typeof final_amount !== 'number'
  ) {
    return null;
  }
  return { base_amount, discount_amount: r.discount_amount ?? 0, taxable_amount, gst_percent, gst_amount, final_amount };
}
