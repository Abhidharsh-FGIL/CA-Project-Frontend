/**
 * GST on what is sold here.
 *
 * The prices shown are what the customer pays, GST included: "₹499, inclusive of GST". This file is only
 * the *words* for that. The sums are the server's: the order says the GST and the total, and the checkout
 * shows those, never a figure worked out here.
 *
 * The backend has to agree: the price it charges for a plan or pack is the listed price. If it still adds
 * GST on top of the listed price, this label would be untrue.
 */
export const GST_LABEL = 'Inclusive of GST';

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
 * Whether the server's figures have the GST *inside* the price (the total is the listed price less any
 * discount) rather than added on top of it. Read from the server's own numbers — the page never works
 * out GST — so the checkout is right whichever way the backend charges while the two are being brought
 * into line. Within a paisa, since each is rounded to paise on its own.
 */
export function isGstInclusive(b: PriceBreakdown): boolean {
  return Math.abs(b.final_amount - (b.base_amount - b.discount_amount)) < 0.015;
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
