import { describe, expect, it } from 'vitest';
import {
  defaultQuestionLanguage,
  hasNoLevel,
  isLanguageExam,
  isLanguageExamTitle,
  isNtpcGroup,
  paperNtpcLanguage,
  papersForNtpc,
  questionsForPaperLanguage,
} from '@/lib/ntpc-level';
import { EMPTY_TAG, readTnpscTag, suggestAssessmentTitle, validateTnpscTag } from '@/lib/tnpscAdminApi';
import { builtInLanguages } from '@/config/exam-cards';

const CHSL = { ...EMPTY_TAG, group_id: 'ssc-chsl-tier-1', stage_id: 'ssc-chsl-tier-1-exam', track: 'mock' as const };

describe('SSC CHSL languages', () => {
  it('is a multi-language exam with no levels; RRB NTPC has both', () => {
    expect(isLanguageExam('ssc-chsl-tier-1')).toBe(true);
    expect(isLanguageExam('ssc-chsl-tier-2')).toBe(true);
    expect(isLanguageExam('rrb-ntpc-cbt-1')).toBe(true);
    expect(isLanguageExam('group-4')).toBe(false);
    expect(hasNoLevel('ssc-chsl-tier-2')).toBe(true);
    expect(hasNoLevel('rrb-ntpc-cbt-2')).toBe(false);
    // the level code (Graduate / Under-Graduate) stays RRB NTPC's
    expect(isNtpcGroup('ssc-chsl-tier-1')).toBe(false);
  });

  it('offers Tamil, English and Hindi on its card, as RRB NTPC does', () => {
    expect(builtInLanguages('ssc-chsl-tier-1')).toEqual(['tamil', 'english', 'hindi']);
  });

  it('names its language in the paper’s title, with no level', () => {
    const title = suggestAssessmentTitle({ ...CHSL, ntpc_language: 'hindi', ntpc_level: 'graduate' });
    expect(title).toMatch(/^SSC CHSL Tier-1 \(Hindi\)/);
    expect(title).not.toMatch(/Graduate/);
    expect(suggestAssessmentTitle({ ...CHSL, ntpc_language: 'both' })).toMatch(/^SSC CHSL Tier-1\b(?! \()/);
  });

  it('reads the title back: the language, and which papers an aspirant of that language is shown', () => {
    const hi = { title: 'SSC CHSL Tier-1 (Hindi) — Full Mock' };
    const ta = { title: 'SSC CHSL Tier-1 (Tamil) — Full Mock' };
    const all = { title: 'SSC CHSL Tier-1 — Full Mock' };
    expect(isLanguageExamTitle(hi.title)).toBe(true);
    expect(isLanguageExamTitle('TNPSC Group 4 — General Tamil')).toBe(false);
    expect(paperNtpcLanguage(hi)).toBe('hindi');
    expect(papersForNtpc({ level: null, language: 'tamil' }, [hi, ta, all])).toEqual([ta, all]);
  });

  it('opens a Hindi paper in Hindi and keeps only that translation', () => {
    expect(defaultQuestionLanguage('SSC CHSL Tier-1 (Hindi) — Mock')).toBe('translation');
    expect(defaultQuestionLanguage('SSC CHSL Tier-1 (English) — Mock')).toBe('primary');
    const q = { translations: { ta: { text: 'அ' }, hi: { text: 'अ' } } };
    expect(questionsForPaperLanguage([q], 'SSC CHSL Tier-1 (Hindi) — Mock')[0].translations).toEqual({ hi: { text: 'अ' } });
  });

  it('needs a language on the paper, but no level', () => {
    const errors = validateTnpscTag({ ...CHSL, ntpc_language: null, ntpc_level: null }).errors.join(' ');
    expect(errors).toMatch(/language/i);
    expect(errors).not.toMatch(/Graduate/);
    expect(validateTnpscTag({ ...CHSL, ntpc_language: 'tamil', ntpc_level: null }).errors.join(' ')).not.toMatch(/language|Graduate/i);
  });

  it('reads a placed paper’s language from the server’s own field', () => {
    const tag = readTnpscTag({ tnpsc_group_id: 'ssc-chsl-tier-1', tnpsc_stage_id: 'ssc-chsl-tier-1-exam', title: 'x', ntpc_language: 'hindi' });
    expect(tag.ntpc_language).toBe('hindi');
    expect(tag.ntpc_level).toBeNull();
  });
});

describe('what the portal sends the server for the language', () => {
  it('sends an SSC CHSL or RRB NTPC paper’s chosen language, whatever the track, and never `both`', async () => {
    const { wireLanguage } = await import('@/lib/tnpscAdminApi');
    expect(wireLanguage({ ...CHSL, track: 'practice', ntpc_language: 'hindi' })).toBe('hindi');
    expect(wireLanguage({ ...CHSL, ntpc_language: 'tamil' })).toBe('tamil');
    expect(wireLanguage({ ...CHSL, ntpc_language: 'both' })).toBeNull();
    expect(wireLanguage({ ...EMPTY_TAG, group_id: 'rrb-ntpc-cbt-2', stage_id: 'rrb-ntpc-cbt-2-exam', track: 'practice', ntpc_language: 'hindi' })).toBe('hindi');
  });

  it('leaves Group 4 as it was: a full mock’s own language, nothing for practice', async () => {
    const { wireLanguage } = await import('@/lib/tnpscAdminApi');
    const g4 = { ...EMPTY_TAG, group_id: 'group-4', stage_id: 'group-4-written', language: 'tamil' as const };
    expect(wireLanguage({ ...g4, track: 'mock' })).toBe('tamil');
    expect(wireLanguage({ ...g4, track: 'practice' })).toBeNull();
  });
});
