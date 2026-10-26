import { toast } from 'sonner';
import { beginPrinting, endPrinting } from '@/lib/print-state';

/**
 * Download a report as a PDF file - straight to the downloads folder, with no print dialog.
 *
 * Each card of the report on screen (`#report-pdf-root`) is drawn to its own image and the images are laid onto
 * A4 pages one under another, so Tamil text and the charts come out exactly as on screen. A card is never cut
 * across a page break; a card that is taller than a page by itself (the unit table) is cut only between its rows.
 * Cards that sit side by side on screen are stacked, each at the full width.
 *
 * For the capture the report is made a fixed width (so the text is a readable size on paper), parts marked
 * `data-no-print` are taken out (the portal's header and buttons and the list of every question with the
 * student's answer), folded parts are opened, long names are shown whole, and the page is drawn in the light
 * theme whatever the screen is showing. The libraries are fetched only when the button is pressed.
 */

const PAGE_W = 210; // A4, in mm
const PAGE_H = 297;
const MARGIN = 10;
const FOOT = 8; // room kept at the foot for the page number
const GAP = 3; // between cards, in mm
const CAPTURE_WIDTH = 860; // CSS px the report is laid out at while it is drawn
const SCALE = 2;

const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
const frame = () => new Promise<void>(r => requestAnimationFrame(() => r()));

/**
 * The pieces to lay on pages: each card, found at any depth. A wrapper that only holds cards (two side by side,
 * say) is looked through; a card, or anything with no card inside it, is one piece.
 */
function pieces(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  const isCard = (el: HTMLElement) => el.classList.contains('rounded-2xl') || el.classList.contains('rounded-xl');
  const walk = (el: HTMLElement) => {
    if (el.hasAttribute('data-no-print') || el.offsetHeight === 0) return;
    const holdsCards = !isCard(el) && !!el.querySelector('.rounded-2xl');
    if (!holdsCards) {
      out.push(el);
      return;
    }
    for (const child of Array.from(el.children)) if (child instanceof HTMLElement) walk(child);
  };
  for (const child of Array.from(root.children)) if (child instanceof HTMLElement) walk(child);
  return out;
}

export async function downloadReportPdf(title: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const root = document.getElementById('report-pdf-root');
  if (!root) {
    toast.error('The report is not ready to download yet.');
    return;
  }

  const toastId = toast.loading('Preparing your report…');
  const html = document.documentElement;
  const wasDark = html.classList.contains('dark');
  const saved = { width: root.style.width, maxWidth: root.style.maxWidth, margin: root.style.margin };
  try {
    const [{ jsPDF }, { toCanvas }] = await Promise.all([import('jspdf'), import('html-to-image')]);

    // Open what folds away, draw in the light theme, hold the animations still, and fix the layout width.
    await beginPrinting();
    html.classList.remove('dark');
    html.classList.add('pdf-capture');
    root.style.width = `${CAPTURE_WIDTH}px`;
    root.style.maxWidth = 'none';
    root.style.margin = '0';
    await frame();
    await frame();
    await frame();

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const usableW = PAGE_W - MARGIN * 2;
    const mmPerCssPx = usableW / CAPTURE_WIDTH;
    const bottom = PAGE_H - MARGIN - FOOT;
    let y = MARGIN;
    let firstPage = true;

    const newPage = () => {
      if (!firstPage) pdf.addPage();
      firstPage = false;
      y = MARGIN;
    };
    newPage();

    for (const piece of pieces(root)) {
      // The browser itself lays out and draws the text (html-to-image), so labels sit exactly as they do on screen.
      const canvas = await toCanvas(piece, { pixelRatio: SCALE, backgroundColor: '#ffffff', cacheBust: false });
      if (canvas.width === 0 || canvas.height === 0) continue;
      const mmPerPx = mmPerCssPx / SCALE;
      const drawW = canvas.width * mmPerPx;
      const drawH = canvas.height * mmPerPx;

      if (drawH <= bottom - MARGIN) {
        // Fits a page by itself: here if there is room, else on a fresh page.
        if (y + drawH > bottom) newPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN, y, drawW, drawH);
        y += drawH + GAP;
        continue;
      }

      // Taller than a page (the unit table): cut it between its rows - or its direct pieces - and never through one.
      const pieceTop = piece.getBoundingClientRect().top;
      const cuts = Array.from(piece.querySelectorAll<HTMLElement>('tr, li'))
        .map(el => Math.round((el.getBoundingClientRect().bottom - pieceTop) * SCALE))
        .filter(v => v > 0 && v < canvas.height)
        .sort((a, b) => a - b);

      let from = 0;
      while (from < canvas.height - 2) {
        const room = Math.floor((bottom - y) / mmPerPx);
        // Start on a fresh page when what is left of this one is too small to hold a few rows.
        if (room < 120 * SCALE && y > MARGIN) {
          newPage();
          continue;
        }
        let to = Math.min(canvas.height, from + room);
        if (to < canvas.height) {
          const fits = cuts.filter(c => c > from + room * 0.4 && c <= from + room);
          if (fits.length) to = fits[fits.length - 1];
        }
        const h = to - from;
        const part = document.createElement('canvas');
        part.width = canvas.width;
        part.height = h;
        part.getContext('2d')!.drawImage(canvas, 0, from, canvas.width, h, 0, 0, canvas.width, h);
        pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN, y, drawW, h * mmPerPx);
        y += h * mmPerPx + GAP;
        from = to;
        if (from < canvas.height - 2) newPage();
      }
    }

    // A footer on every page: the brand and the page number.
    const pages = pdf.getNumberOfPages();
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      pdf.text('MyGovExams', MARGIN, PAGE_H - 6);
      pdf.text(`Page ${i} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 6, { align: 'right' });
    }

    pdf.save(`${fileSafe(title) || 'MyGovExams'} - report.pdf`);
    toast.success('Report downloaded', { id: toastId });
  } catch (e) {
    console.error('Report download failed', e);
    toast.error('Could not create the PDF. Please try again.', { id: toastId });
  } finally {
    root.style.width = saved.width;
    root.style.maxWidth = saved.maxWidth;
    root.style.margin = saved.margin;
    html.classList.remove('pdf-capture');
    if (wasDark) html.classList.add('dark');
    endPrinting();
  }
}
