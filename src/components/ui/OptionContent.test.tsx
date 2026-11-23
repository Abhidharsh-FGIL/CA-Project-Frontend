import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OptionContent } from '@/components/ui/OptionContent';

const html = (p: Parameters<typeof OptionContent>[0]) => renderToStaticMarkup(<OptionContent {...p} />);

describe('OptionContent', () => {
  it('shows the text alone', () => {
    const out = html({ text: 'Paris', imageUrl: null, alt: 'Option A' });
    expect(out).toContain('Paris');
    expect(out).not.toContain('<img');
  });

  it('shows the image alone', () => {
    const out = html({ text: null, imageUrl: 'https://x/y.png', alt: 'Option A' });
    expect(out).toContain('<img');
    expect(out).toContain('https://x/y.png');
  });

  it('shows both when an option has both', () => {
    const out = html({ text: 'Figure A', imageUrl: 'https://x/y.png', alt: 'Option A' });
    expect(out).toContain('Figure A');
    expect(out).toContain('https://x/y.png');
    expect(out.indexOf('Figure A')).toBeLessThan(out.indexOf('<img'));
  });

  it('treats blank text as no text', () => {
    const out = html({ text: '   ', imageUrl: 'https://x/y.png', alt: 'Option A' });
    expect(out).toContain('<img');
    expect(out).not.toContain('block');
  });
});
