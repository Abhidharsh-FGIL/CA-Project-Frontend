/**
 * Noto Sans font loader for jsPDF — enables ₹ (rupee) symbol rendering.
 *
 * Fetches Noto Sans from Google Fonts API, converts to base64,
 * and registers with jsPDF. Falls back to Helvetica + "Rs." if loading fails.
 */
import type jsPDF from 'jspdf';

// Static Noto Sans Regular from Google Fonts CDN (supports Latin + ₹)
const FONT_URLS = [
  'https://fonts.gstatic.com/s/notosans/v36/o-0IIpQlx3QUlC5A4PNb4j5Ba_2c7A.ttf',
  'https://fonts.gstatic.com/s/notosans/v36/o-0bIpQlx3QUlC5A4PNr4DRASf6M7VBj.ttf',
];

let cachedFontBase64: string | null = null;
let fontLoadAttempted = false;

async function fetchFontBase64(): Promise<string | null> {
  if (cachedFontBase64) return cachedFontBase64;
  if (fontLoadAttempted) return null;
  fontLoadAttempted = true;

  for (const url of FONT_URLS) {
    try {
      const resp = await fetch(url, { cache: 'force-cache' });
      if (!resp.ok) continue;
      const buf = await resp.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      cachedFontBase64 = btoa(binary);
      return cachedFontBase64;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Register Noto Sans with a jsPDF instance.
 * Returns the font family name to use with `doc.setFont()`.
 * Returns 'helvetica' if font loading fails (caller should use "Rs." instead of ₹).
 */
export async function registerInvoiceFont(doc: jsPDF): Promise<string> {
  const base64 = await fetchFontBase64();
  if (!base64) return 'helvetica';

  doc.addFileToVFS('NotoSans-Regular.ttf', base64);
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  // jsPDF uses the same font file for bold — it fakes bold via stroke
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'bold');
  return 'NotoSans';
}

/**
 * Format a rupee amount string, using ₹ if the custom font is loaded, or "Rs." as fallback.
 */
export function formatRupee(amount: string, fontFamily: string): string {
  if (fontFamily === 'helvetica') {
    // Fallback: replace ₹ with Rs.
    return amount.replace(/\u20B9/g, 'Rs.');
  }
  return amount;
}
