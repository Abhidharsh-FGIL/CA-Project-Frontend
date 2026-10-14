import { describe, it, expect } from 'vitest';
import { mergeCatalog } from '@/lib/tnpscApi';
import { TNPSC_GROUPS } from '@/config/tnpsc';

describe('mergeCatalog — the exam description', () => {
  const serverGroup = (id: string, description: string) => ({ id, name: id, description, stages: [] }) as any;

  it("keeps the bundled wording over the server's for an exam the app knows", () => {
    const merged = mergeCatalog([serverGroup('group-4', 'An older description from the server.')], TNPSC_GROUPS);
    const bundled = TNPSC_GROUPS.find(g => g.id === 'group-4')!.description;
    expect(merged.find(g => g.id === 'group-4')!.description).toBe(bundled);
  });

  it("keeps the server's wording for an exam the app has never heard of", () => {
    const merged = mergeCatalog([serverGroup('group-2', 'Interview and descriptive posts.')], TNPSC_GROUPS);
    expect(merged.find(g => (g.id as string) === 'group-2')!.description).toBe('Interview and descriptive posts.');
  });
});
