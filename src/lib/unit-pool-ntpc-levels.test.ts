import { describe, expect, it } from 'vitest';
import { findStage } from '@/config/tnpsc';
import { inSelectedUnits, unitBankCounts } from './unit-pool';

const ug = findStage('rrb-ntpc-cbt-1', 'rrb-ntpc-cbt-1-exam')!.stage;
const grad = findStage('rrb-ntpc-cbt-1-grad', 'rrb-ntpc-cbt-1-grad-exam')!.stage;

// A bank holding both levels' RRB NTPC questions. The Graduate pack is tagged with the `n1-` ids (its Unit column),
// the Under-Graduate packs too; a question tagged by the Graduate stage's own `ng-` ids is the third spelling.
const bank = [
  ...Array.from({ length: 5 }, () => ({ unit_id: 'n1-ma-lcm-and-hcf' })),
  ...Array.from({ length: 3 }, () => ({ unit_id: 'ng-ma-lcm-and-hcf' })),
  ...Array.from({ length: 2 }, () => ({ unit_id: 'n1-ga-current-affairs' })),
];

describe('an RRB NTPC CBT-1 pool counts both levels, whichever exam the paper is placed under', () => {
  it('Under-Graduate: n1- and ng- questions of a unit are all in it', () => {
    const { byUnit } = unitBankCounts(ug, bank);
    expect(byUnit['n1-ma-lcm-and-hcf']).toBe(8);
    expect(byUnit['n1-ga-current-affairs']).toBe(2);
  });

  it('Graduate: the same questions, under the Graduate stage’s own unit ids', () => {
    const { byUnit } = unitBankCounts(grad, bank);
    expect(byUnit['ng-ma-lcm-and-hcf']).toBe(8);
    expect(byUnit['ng-ga-current-affairs']).toBe(2);
  });

  it('a selected unit draws on both', () => {
    const lcm = grad.pattern!.sections.flatMap(s => s.units ?? []).find(u => u.id === 'ng-ma-lcm-and-hcf')!;
    expect(bank.filter(q => inSelectedUnits(grad, q, [lcm]))).toHaveLength(8);
  });
});
