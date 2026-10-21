import { describe, expect, it } from 'vitest';
import { filenameFromDisposition } from '@/lib/content-disposition';

describe('filenameFromDisposition', () => {
  it('reads a plain quoted name', () => {
    expect(filenameFromDisposition('attachment; filename="Invoice_Reeba_Plan_20-Oct-2026.pdf"')).toBe('Invoice_Reeba_Plan_20-Oct-2026.pdf');
  });

  it('prefers the UTF-8 name, so a Tamil name survives', () => {
    const header = `attachment; filename="Invoice_Student_Topup_20-Oct-2026.pdf"; filename*=UTF-8''Invoice_%E0%AE%B0%E0%af%80%E0%AE%AA%E0%AE%BE_Topup_20-Oct-2026.pdf`;
    expect(filenameFromDisposition(header)).toBe('Invoice_ரீபா_Topup_20-Oct-2026.pdf');
  });

  it('falls back to the plain name when the UTF-8 one is malformed', () => {
    expect(filenameFromDisposition(`attachment; filename*=UTF-8''%E0%A4%A; filename="Invoice_X_Plan_20-Oct-2026.pdf"`)).toBe(
      'Invoice_X_Plan_20-Oct-2026.pdf',
    );
  });

  it('reads an unquoted name', () => {
    expect(filenameFromDisposition('attachment; filename=invoice.pdf')).toBe('invoice.pdf');
  });

  it('is null when the header is absent or names no file', () => {
    expect(filenameFromDisposition(null)).toBeNull();
    expect(filenameFromDisposition(undefined)).toBeNull();
    expect(filenameFromDisposition('')).toBeNull();
    expect(filenameFromDisposition('attachment')).toBeNull();
  });
});
