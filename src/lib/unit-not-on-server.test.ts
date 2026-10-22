import { describe, expect, it } from 'vitest';
import { describeTagError, describeUnitNotOnServer } from './tnpscAdminApi';

describe('describeUnitNotOnServer', () => {
  const raw = "Unit 'g2-ta-grammar' is not a unit of 'group-2-prelims'.";

  it('names the unit and the exam, and says the fix is on the server', () => {
    const text = describeUnitNotOnServer(raw)!;
    expect(text).toContain('g2-ta-grammar');
    expect(text).toContain('group-2-prelims');
    expect(text).toMatch(/server/i);
  });

  it('says nothing about any other message', () => {
    expect(describeUnitNotOnServer("Topic 'x' is printed under unit 'a', not 'b'.")).toBeNull();
    expect(describeUnitNotOnServer('Network error')).toBeNull();
    expect(describeUnitNotOnServer(null)).toBeNull();
    expect(describeUnitNotOnServer(undefined)).toBeNull();
  });

  it('is what a refused placement reads as', () => {
    const tag = { stage_id: 'group-2-prelims', group_id: 'group-2' } as any;
    expect(describeTagError({ message: raw }, tag)).toBe(describeUnitNotOnServer(raw));
  });
});
