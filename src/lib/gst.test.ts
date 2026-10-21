import { describe, expect, it } from 'vitest';
import { breakdownFrom } from '@/lib/gst';

describe('breakdownFrom', () => {
  it('takes the server figures as they are', () => {
    expect(
      breakdownFrom({ base_amount: 499, discount_amount: 50, taxable_amount: 449, gst_percent: 18, gst_amount: 80.82, final_amount: 529.82 }),
    ).toEqual({ base_amount: 499, discount_amount: 50, taxable_amount: 449, gst_percent: 18, gst_amount: 80.82, final_amount: 529.82 });
  });

  it('treats a missing discount as none', () => {
    expect(breakdownFrom({ base_amount: 299, taxable_amount: 299, gst_percent: 18, gst_amount: 53.82, final_amount: 352.82 })?.discount_amount).toBe(0);
  });

  it('is null when the server sent no GST at all, so there is no summary with holes in it', () => {
    expect(breakdownFrom({ base_amount: 499, final_amount: 499 })).toBeNull();
    expect(breakdownFrom({})).toBeNull();
    expect(breakdownFrom(null)).toBeNull();
    expect(breakdownFrom(undefined)).toBeNull();
  });

  it('is null when one of the figures is missing', () => {
    expect(breakdownFrom({ base_amount: 499, taxable_amount: 449, gst_percent: 18, final_amount: 529.82 })).toBeNull();
  });
});

import { isGstInclusive } from '@/lib/gst';

describe('isGstInclusive', () => {
  it('is true when the total is the listed price (GST taken out of it, 1999 → 1694.07 + 304.93)', () => {
    expect(isGstInclusive({ base_amount: 1999, discount_amount: 0, taxable_amount: 1694.07, gst_percent: 18, gst_amount: 304.93, final_amount: 1999 })).toBe(true);
  });

  it('is true with a discount, when the total is the price less the discount', () => {
    expect(isGstInclusive({ base_amount: 1999, discount_amount: 500, taxable_amount: 1270.34, gst_percent: 18, gst_amount: 228.66, final_amount: 1499 })).toBe(true);
  });

  it('is false when GST is added on top (499 → 529.82 after a 50 discount)', () => {
    expect(isGstInclusive({ base_amount: 499, discount_amount: 50, taxable_amount: 449, gst_percent: 18, gst_amount: 80.82, final_amount: 529.82 })).toBe(false);
  });

  it('allows a paisa of rounding either way', () => {
    expect(isGstInclusive({ base_amount: 499, discount_amount: 0, taxable_amount: 422.88, gst_percent: 18, gst_amount: 76.12, final_amount: 499.01 })).toBe(true);
    expect(isGstInclusive({ base_amount: 499, discount_amount: 0, taxable_amount: 422.88, gst_percent: 18, gst_amount: 76.12, final_amount: 499.05 })).toBe(false);
  });
});
