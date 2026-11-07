import { describe, expect, it } from 'vitest';
import { registerPair } from './bilingual';
import { hindiName } from './hindi-names';
import { ntpcLabel } from '@/config/rrb-ntpc';

describe('Hindi names the server sends', () => {
  it('are remembered by English name, with or without a Tamil one beside them', () => {
    registerPair('Zoology Test Topic', null, null, 'प्राणि विज्ञान परीक्षण');
    expect(hindiName('zoology test topic')).toBe('प्राणि विज्ञान परीक्षण');
    expect(hindiName('Never Sent')).toBeNull();
  });

  it('beat the sheet the build was made from, and English is what is left when there is none', () => {
    registerPair('Games and Sports', null, null, 'खेल-कूद (server)');
    expect(ntpcLabel('Games and Sports', 'hindi')).toBe('खेल-कूद (server)');
    expect(ntpcLabel('Current Events', 'hindi')).not.toMatch(/[A-Za-z]/);
    expect(ntpcLabel('Not an NTPC name', 'hindi')).toBe('Not an NTPC name');
  });

  it('ignore a pair whose sides are the wrong scripts', () => {
    registerPair('Wrong Pair', null, null, 'English again');
    expect(hindiName('Wrong Pair')).toBeNull();
  });
});
