import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

const saved: { blob?: Blob } = {};
vi.mock('file-saver', () => ({ saveAs: (b: Blob) => { saved.blob = b; } }));

import { downloadPaperAsDocx } from './eval-docx-export';
import { exportAssessment } from './eval-export-utils';

async function documentXml(): Promise<string> {
  const zip = await JSZip.loadAsync(await saved.blob!.arrayBuffer());
  return zip.file('word/document.xml')!.async('string');
}

const q = {
  text: 'Which is the capital of Tamil Nadu?',
  type: 'mcq',
  points: 1,
  options: ['Chennai', 'Madurai'],
  correct_answer: 'A',
  explanation: 'It is Chennai.',
  translations: { ta: { text: 'தமிழ்நாட்டின் தலைநகர் எது?', options: ['சென்னை', 'மதுரை'], explanation: 'அது சென்னை.' } },
};

describe('bilingual Word export', () => {
  it('collection download carries the Tamil stem, options and explanation', async () => {
    await downloadPaperAsDocx({ title: 'T' }, [q]);
    const xml = await documentXml();
    for (const t of ['தமிழ்நாட்டின் தலைநகர் எது?', 'சென்னை', 'மதுரை', 'அது சென்னை.']) expect(xml).toContain(t);
  });

  it('assessment export carries it too', async () => {
    await exportAssessment([], [q as any], 'T', 'docx');
    const xml = await documentXml();
    for (const t of ['தமிழ்நாட்டின் தலைநகர் எது?', 'சென்னை', 'அது சென்னை.']) expect(xml).toContain(t);
  });

  it('an English-only question exports without any Tamil font run', async () => {
    await downloadPaperAsDocx({ title: 'T' }, [{ ...q, translations: undefined }]);
    expect(await documentXml()).not.toContain('Nirmala UI');
  });

  it('Excel export adds Tamil columns beside the English ones', async () => {
    await exportAssessment([], [q as any], 'T', 'excel');
    const wb = XLSX.read(await saved.blob!.arrayBuffer());
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets['Questions'], { header: 1 });
    expect(rows[0]).toEqual(expect.arrayContaining(['Question (தமிழ்)', 'Options (தமிழ்)', 'Explanation (தமிழ்)']));
    const flat = rows[1].join('|');
    expect(flat).toContain('தமிழ்நாட்டின் தலைநகர் எது?');
    expect(flat).toContain('B) மதுரை');
    expect(flat).toContain('அது சென்னை.');
  });

  it('Excel export of English-only questions keeps its original columns', async () => {
    await exportAssessment([], [{ ...q, translations: undefined } as any], 'T', 'excel');
    const wb = XLSX.read(await saved.blob!.arrayBuffer());
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets['Questions'], { header: 1 });
    expect(rows[0]).toHaveLength(9);
  });
});
