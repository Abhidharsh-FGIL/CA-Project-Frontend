import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setUserTokens } from '@/lib/api';
import { downloadInvoice } from '@/lib/purchase-history';

/**
 * The invoice is a PDF behind the bearer token, so it is fetched and handed to the browser as a file
 * rather than linked to.
 */

let store: Map<string, string>;
let fetchMock: ReturnType<typeof vi.fn>;
let clicked: Array<{ href: string; download: string }>;
let revoked: string[];

beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal('window', { location: { href: '' } });
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  clicked = [];
  revoked = [];
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:invoice', revokeObjectURL: (u: string) => revoked.push(u) }));
  const anchor = { href: '', download: '', click() { clicked.push({ href: this.href, download: this.download }); }, remove() {} };
  vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild: () => {} } });
  setUserTokens('tok', 'ref');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const purchase = { invoice_url: '/api/v1/user/payment/invoice/abc', invoice_no: 'INV-2026-0042', txn_id: 'txn_1' };

describe('downloadInvoice', () => {
  it('fetches the PDF with the bearer token and, with no name from the server, saves it as invoice_<no>.pdf', async () => {
    fetchMock.mockResolvedValue(new Response(new Blob(['%PDF-1.4']), { status: 200 }));
    await downloadInvoice(purchase);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/v1/user/payment/invoice/abc');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(clicked).toEqual([{ href: 'blob:invoice', download: 'invoice_INV-2026-0042.pdf' }]);
    expect(revoked).toEqual(['blob:invoice']);
  });

  it('saves it under the name the server sends in Content-Disposition', async () => {
    fetchMock.mockResolvedValue(
      new Response(new Blob(['%PDF']), { status: 200, headers: { 'Content-Disposition': 'attachment; filename="Invoice_Reeba_Plan_20-Oct-2026.pdf"' } }),
    );
    await downloadInvoice(purchase);
    expect(clicked[0].download).toBe('Invoice_Reeba_Plan_20-Oct-2026.pdf');
  });

  it('names the file after the transaction when the purchase has no invoice number', async () => {
    fetchMock.mockResolvedValue(new Response(new Blob(['%PDF']), { status: 200 }));
    await downloadInvoice({ ...purchase, invoice_no: null });
    expect(clicked[0].download).toBe('invoice_txn_1.pdf');
  });

  it('says so, and fetches nothing, when there is no invoice to download', async () => {
    await expect(downloadInvoice({ ...purchase, invoice_url: null })).rejects.toThrow('no invoice');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes the server message up when the invoice is not found (404)', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'Invoice not found' }), { status: 404 }));
    await expect(downloadInvoice(purchase)).rejects.toThrow('Invoice not found');
    expect(clicked).toEqual([]);
  });
});
