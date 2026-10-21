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
