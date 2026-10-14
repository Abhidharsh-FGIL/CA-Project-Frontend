import { describe, it, expect } from 'vitest';
import {
  VIRTUAL_PAPER_ID,
  changeOf,
  describeMix,
  difficultyMix,
  isNotEditableError,
  isVirtualPaper,
  levelFor,
  mapLimit,
  writeOutcome,
} from '@/lib/reclassify';

const q = (difficulty?: string | null) => ({ difficulty });

describe('difficultyMix', () => {
  it('reads a unanimous paper as that difficulty', () => {
    const mix = difficultyMix(Array.from({ length: 100 }, () => q('hard')));
    expect(mix.verdict).toBe('hard');
    expect(mix.dominant).toBe('hard');
    expect(mix.total).toBe(100);
  });

  it('reads a genuine mix as mixed, and still names the dominant', () => {
    const mix = difficultyMix([q('easy'), q('hard'), q('hard'), q('hard')]);
    expect(mix.verdict).toBe('mixed');
    expect(mix.dominant).toBe('hard');
  });

  it('counts untagged questions without letting them decide', () => {
    const mix = difficultyMix([q('hard'), q(null), q(''), q('hard')]);
    expect(mix.verdict).toBe('hard');
    expect(mix.unknown).toBe(2);
  });

  it('has no verdict when nothing is declared', () => {
    const mix = difficultyMix([q(null), q(undefined)]);
    expect(mix.verdict).toBeNull();
    expect(mix.dominant).toBeNull();
  });

  it('treats case and padding as the same level', () => {
    const mix = difficultyMix([q('Hard'), q(' hard '), q('HARD')]);
    expect(mix.verdict).toBe('hard');
    expect(mix.counts).toEqual({ hard: 3 });
  });
});

describe('levelFor', () => {
  it('maps the question vocabulary onto the level vocabulary', () => {
    expect(levelFor(difficultyMix([q('easy')]))).toBe('simple');
    expect(levelFor(difficultyMix([q('medium')]))).toBe('medium');
    expect(levelFor(difficultyMix([q('hard')]))).toBe('complex');
  });

  it('gives a mixed paper the level its majority justifies', () => {
    // 'mixed' is not a level, so the paper still has to sit under one button.
    const mix = difficultyMix([q('easy'), q('hard'), q('hard')]);
    expect(mix.verdict).toBe('mixed');
    expect(levelFor(mix)).toBe('complex');
  });

  it('proposes no level when no question declares a difficulty', () => {
    expect(levelFor(difficultyMix([q(null)]))).toBeNull();
  });
});

describe('changeOf', () => {
  it('spots the reported bug — hard questions recorded as medium', () => {
    expect(
      changeOf({
        currentDifficulty: 'medium',
        currentLevel: null,
        proposedDifficulty: 'hard',
        proposedLevel: 'complex',
      }),
    ).toBe('both');
  });

  it('separates a level-only fix from a difficulty-only one', () => {
    expect(
      changeOf({
        currentDifficulty: 'hard',
        currentLevel: null,
        proposedDifficulty: 'hard',
        proposedLevel: 'complex',
      }),
    ).toBe('level');

    expect(
      changeOf({
        currentDifficulty: 'medium',
        currentLevel: 'complex',
        proposedDifficulty: 'hard',
        proposedLevel: 'complex',
      }),
    ).toBe('difficulty');
  });

  it('reports nothing for a paper already correct', () => {
    expect(
      changeOf({
        currentDifficulty: 'hard',
        currentLevel: 'complex',
        proposedDifficulty: 'hard',
        proposedLevel: 'complex',
      }),
    ).toBeNull();
  });

  it('never proposes a change it has no answer for', () => {
    expect(
      changeOf({
        currentDifficulty: 'medium',
        currentLevel: 'simple',
        proposedDifficulty: null,
        proposedLevel: null,
      }),
    ).toBeNull();
  });
});

describe('describeMix', () => {
  it('summarises what the scan found, commonest first', () => {
    expect(describeMix(difficultyMix([q('hard'), q('hard'), q('easy')]))).toBe('2× hard · 1× easy');
    expect(describeMix(difficultyMix([q('hard'), q(null)]))).toBe('1× hard · 1 untagged');
    expect(describeMix(difficultyMix([]))).toBe('No questions');
  });
});

describe('mapLimit', () => {
  it('keeps input order however the work completes', async () => {
    const out = await mapLimit([30, 10, 20, 0], 2, async n => {
      await new Promise(r => setTimeout(r, n));
      return n;
    });
    expect(out).toEqual([30, 10, 20, 0]);
  });

  it('never runs more than `limit` at once', async () => {
    let running = 0;
    let peak = 0;
    await mapLimit(Array.from({ length: 12 }, (_, i) => i), 3, async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise(r => setTimeout(r, 2));
      running -= 1;
    });
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('reports progress once per item', async () => {
    const seen: number[] = [];
    await mapLimit([1, 2, 3], 2, async n => n, done => seen.push(done));
    expect(seen.sort()).toEqual([1, 2, 3]);
  });
});

describe('collections that cannot be classified', () => {
  it('knows the on-the-fly collection by id', () => {
    expect(isVirtualPaper({ id: VIRTUAL_PAPER_ID })).toBe(true);
    expect(isVirtualPaper({ id: '9f299a76-8229-464b-96b3-d1e976fe9969' })).toBe(false);
    expect(isVirtualPaper(null)).toBe(false);
    expect(isVirtualPaper(undefined)).toBe(false);
  });

  it('reads the backend’s refusal however it is spelled', () => {
    // `toRequestError` lifts `detail.code`; this endpoint answers `error_code`.
    // Either spelling, or the bare status, has to count.
    expect(isNotEditableError({ status: 409 })).toBe(true);
    expect(isNotEditableError({ code: 'CUSTOM_PAPER_NOT_EDITABLE' })).toBe(true);
    expect(isNotEditableError({ detail: { error_code: 'CUSTOM_PAPER_NOT_EDITABLE' } })).toBe(true);
  });

  it('does not mistake other failures for it', () => {
    // 404 means the id was malformed or gone — a real problem, not a skip.
    expect(isNotEditableError({ status: 404 })).toBe(false);
    expect(isNotEditableError({ status: 500 })).toBe(false);
    expect(isNotEditableError(null)).toBe(false);
  });
});

describe('writeOutcome — did the server actually store it?', () => {
  // A 200 means the request was understood, not that the field was stored. A
  // server that ignores keys it does not know answers 200 and changes nothing.
  it('sees a write that took', () => {
    expect(writeOutcome({ difficulty: 'hard' }, 'difficulty', 'hard')).toBe('applied');
    expect(writeOutcome({ tnpsc_level: 'complex' }, 'tnpsc_level', 'complex')).toBe('applied');
  });

  it('sees a write that was silently ignored', () => {
    // The reported case: PATCH answered 200, the row still says medium.
    expect(writeOutcome({ difficulty: 'medium' }, 'difficulty', 'hard')).toBe('ignored');
    expect(writeOutcome({ tnpsc_level: null }, 'tnpsc_level', 'complex')).toBe('ignored');
  });

  it('compares the two difficulty vocabularies as one', () => {
    expect(writeOutcome({ difficulty: 'complex' }, 'difficulty', 'hard')).toBe('applied');
    expect(writeOutcome({ difficulty: 'Simple' }, 'difficulty', 'easy')).toBe('applied');
  });

  it('says unknown rather than guessing when the row is not echoed back', () => {
    expect(writeOutcome({}, 'difficulty', 'hard')).toBe('unknown');
    expect(writeOutcome(undefined, 'difficulty', 'hard')).toBe('unknown');
    expect(writeOutcome('ok', 'difficulty', 'hard')).toBe('unknown');
  });

  it('reads a level echoed under its bare name', () => {
    expect(writeOutcome({ level: 'complex' }, 'tnpsc_level', 'complex')).toBe('applied');
  });
});
