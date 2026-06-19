// Sample MCQ pool used by the take-assessment page when running in demo mode
// (token starts with `demo-`). Real questions come from the backend in production.

export interface DemoQuestion {
  id: string;
  question_type: 'mcq' | 'true_false';
  question_text: string;
  options: Record<string, string>;
  marks: number;
  negative_marks: number;
  subject: string;
  chapter?: string;
  order_index: number;
}

export const SAMPLE_QUESTION_POOL: Omit<DemoQuestion, 'id' | 'order_index'>[] = [
  // ── Accounting ──
  {
    question_type: 'mcq',
    question_text:
      'A machinery is purchased for ₹5,00,000 on 1-Apr-2025. Installation charges ₹50,000 and freight ₹20,000 are also paid. As per AS 10, what is the cost at which the machinery should be capitalised?',
    options: {
      a: '₹5,00,000',
      b: '₹5,50,000',
      c: '₹5,70,000',
      d: '₹5,20,000',
    },
    marks: 1,
    negative_marks: 0.25,
    subject: 'Accounting',
    chapter: 'Property, Plant & Equipment',
  },
  {
    question_type: 'mcq',
    question_text:
      'Under the straight-line method, an asset costing ₹2,00,000 with a useful life of 5 years and salvage value of ₹20,000 will have an annual depreciation of:',
    options: {
      a: '₹40,000',
      b: '₹36,000',
      c: '₹44,000',
      d: '₹32,000',
    },
    marks: 1,
    negative_marks: 0.25,
    subject: 'Accounting',
    chapter: 'Depreciation',
  },
  {
    question_type: 'mcq',
    question_text:
      'Which of the following is a Capital Expenditure?',
    options: {
      a: 'Wages paid to install machinery',
      b: 'Salaries paid to staff',
      c: 'Repairs to machinery',
      d: 'Insurance premium',
    },
    marks: 1,
    negative_marks: 0.25,
    subject: 'Accounting',
    chapter: 'Capital vs Revenue',
  },
  {
    question_type: 'mcq',
    question_text:
      'The principle that requires recognising expenses in the same period as related revenues is known as:',
    options: {
      a: 'Going concern concept',
      b: 'Matching concept',
      c: 'Consistency principle',
      d: 'Materiality concept',
    },
    marks: 1,
    negative_marks: 0.25,
    subject: 'Accounting',
    chapter: 'Accounting Concepts',
  },
  {
    question_type: 'true_false',
    question_text:
      'Assertion (A): Goodwill is shown as an intangible asset in the balance sheet.\nReason (R): Goodwill represents the value of reputation that helps earn supernormal profits.\nChoose the correct option:',
    options: {
      a: 'Both A and R are true, and R is the correct explanation of A',
      b: 'Both A and R are true, but R is NOT the correct explanation of A',
      c: 'A is true, R is false',
      d: 'A is false, R is true',
    },
    marks: 2,
    negative_marks: 0.5,
    subject: 'Accounting',
    chapter: 'Intangible Assets',
  },

  // ── Business Laws ──
  {
    question_type: 'mcq',
    question_text:
      'Under the Indian Contract Act, 1872, an agreement enforceable by law is called:',
    options: {
      a: 'Proposal',
      b: 'Offer',
      c: 'Contract',
      d: 'Promise',
    },
    marks: 1,
    negative_marks: 0.25,
    subject: 'Business Laws',
    chapter: 'Indian Contract Act',
  },
  {
    question_type: 'mcq',
    question_text:
      'A contract entered into by a minor is:',
    options: {
      a: 'Valid',
      b: 'Voidable at the option of the minor',
      c: 'Void ab initio',
      d: 'Enforceable after attaining majority',
    },
    marks: 1,
    negative_marks: 0.25,
    subject: 'Business Laws',
    chapter: 'Capacity to Contract',
  },
  {
    question_type: 'mcq',
    question_text:
      'Under the Sale of Goods Act, 1930, the doctrine of "Caveat Emptor" means:',
    options: {
      a: 'Let the seller beware',
      b: 'Let the buyer beware',
      c: 'Let both beware',
      d: 'Let the government beware',
    },
    marks: 1,
    negative_marks: 0.25,
    subject: 'Business Laws',
    chapter: 'Sale of Goods Act',
  },

  // ── Taxation / GST ──
  {
    question_type: 'mcq',
    question_text:
      'The threshold limit for GST registration for a supplier of goods (in most States, other than special category States) is:',
    options: {
      a: '₹10 lakh',
      b: '₹20 lakh',
      c: '₹40 lakh',
      d: '₹50 lakh',
    },
    marks: 1,
    negative_marks: 0.25,
    subject: 'GST',
    chapter: 'Registration',
  },
  {
    question_type: 'mcq',
    question_text:
      'Input Tax Credit (ITC) under GST is NOT available on which of the following?',
    options: {
      a: 'Goods used for personal consumption',
      b: 'Raw materials used in manufacture',
      c: 'Capital goods used in business',
      d: 'Inputs used for taxable output supplies',
    },
    marks: 1,
    negative_marks: 0.25,
    subject: 'GST',
    chapter: 'Input Tax Credit',
  },
  {
    question_type: 'mcq',
    question_text:
      'Mr. X sells a residential house on 15-Sept-2025 for ₹80 lakh. Indexed cost of acquisition is ₹35 lakh. He invests ₹30 lakh in another residential house. The taxable LTCG under Section 54 will be:',
    options: {
      a: 'Nil',
      b: '₹15 lakh',
      c: '₹45 lakh',
      d: '₹30 lakh',
    },
    marks: 2,
    negative_marks: 0.5,
    subject: 'Income Tax',
    chapter: 'Capital Gains',
  },
  {
    question_type: 'mcq',
    question_text:
      'The standard deduction available to a salaried individual under the Income Tax Act for AY 2026-27 (old regime) is:',
    options: {
      a: '₹30,000',
      b: '₹40,000',
      c: '₹50,000',
      d: '₹75,000',
    },
    marks: 1,
    negative_marks: 0.25,
    subject: 'Income Tax',
    chapter: 'Salary',
  },

  // ── Cost & Management Accounting ──
  {
    question_type: 'mcq',
    question_text:
      'In a process where 1,000 units are introduced and 950 units are produced, with normal loss of 5%, the abnormal loss/gain is:',
    options: {
      a: 'Abnormal Loss of 50 units',
      b: 'Abnormal Gain of 50 units',
      c: 'Normal Loss only',
      d: 'No abnormal loss or gain',
    },
    marks: 2,
    negative_marks: 0.5,
    subject: 'Cost Accounting',
    chapter: 'Process Costing',
  },
  {
    question_type: 'mcq',
    question_text:
      'Material price variance is calculated as:',
    options: {
      a: '(Standard Price − Actual Price) × Actual Quantity',
      b: '(Actual Price − Standard Price) × Standard Quantity',
      c: '(Standard Quantity − Actual Quantity) × Standard Price',
      d: '(Actual Quantity − Standard Quantity) × Actual Price',
    },
    marks: 1,
    negative_marks: 0.25,
    subject: 'Cost Accounting',
    chapter: 'Standard Costing',
  },

  // ── Auditing ──
  {
    question_type: 'mcq',
    question_text:
      'Which Standard on Auditing deals with "Overall Objectives of the Independent Auditor"?',
    options: {
      a: 'SA 200',
      b: 'SA 210',
      c: 'SA 220',
      d: 'SA 230',
    },
    marks: 1,
    negative_marks: 0.25,
    subject: 'Auditing',
    chapter: 'Standards on Auditing',
  },
  {
    question_type: 'mcq',
    question_text:
      'The audit report issued when the financial statements give a true and fair view is called:',
    options: {
      a: 'Adverse Report',
      b: 'Qualified Report',
      c: 'Unmodified (Clean) Report',
      d: 'Disclaimer of Opinion',
    },
    marks: 1,
    negative_marks: 0.25,
    subject: 'Auditing',
    chapter: 'Audit Reports',
  },

  // ── Business Economics ──
  {
    question_type: 'mcq',
    question_text:
      'When the price of a good rises by 10% and the quantity demanded falls by 20%, the price elasticity of demand is:',
    options: {
      a: '0.5 — Inelastic',
      b: '1.0 — Unitary',
      c: '2.0 — Elastic',
      d: 'Infinity — Perfectly Elastic',
    },
    marks: 1,
    negative_marks: 0.25,
    subject: 'Business Economics',
    chapter: 'Elasticity',
  },
  {
    question_type: 'mcq',
    question_text:
      'The "Law of Demand" states that, other things being equal:',
    options: {
      a: 'Quantity demanded increases as price increases',
      b: 'Quantity demanded falls as price increases',
      c: 'Price and demand always move in the same direction',
      d: 'Demand is independent of price',
    },
    marks: 1,
    negative_marks: 0.25,
    subject: 'Business Economics',
    chapter: 'Demand',
  },

  // ── Financial Management ──
  {
    question_type: 'mcq',
    question_text:
      'The NPV (Net Present Value) of a project becomes zero at:',
    options: {
      a: 'Cost of Capital',
      b: 'Internal Rate of Return (IRR)',
      c: 'Bank Rate',
      d: 'Risk-free Rate',
    },
    marks: 1,
    negative_marks: 0.25,
    subject: 'Financial Management',
    chapter: 'Capital Budgeting',
  },
  {
    question_type: 'mcq',
    question_text:
      'The Weighted Average Cost of Capital (WACC) is used as the discount rate when:',
    options: {
      a: 'Evaluating projects funded by a single source of capital',
      b: 'Evaluating projects with the same risk and capital structure as the firm',
      c: 'Computing profit margins',
      d: 'Computing operating leverage',
    },
    marks: 1,
    negative_marks: 0.25,
    subject: 'Financial Management',
    chapter: 'Cost of Capital',
  },

  // ── Ind AS / Financial Reporting ──
  {
    question_type: 'true_false',
    question_text:
      'Assertion (A): Under Ind AS 115, revenue is recognised when control of goods or services is transferred to the customer.\nReason (R): The 5-step model under Ind AS 115 replaced the risk-and-reward criterion of AS 9.\nChoose the correct option:',
    options: {
      a: 'Both A and R are true, and R is the correct explanation of A',
      b: 'Both A and R are true, but R is NOT the correct explanation of A',
      c: 'A is true, R is false',
      d: 'A is false, R is true',
    },
    marks: 2,
    negative_marks: 0.5,
    subject: 'Financial Reporting',
    chapter: 'Ind AS 115',
  },
];

/**
 * Generate `count` demo questions by cycling through the sample pool.
 * Each generated question has a unique `id` and `order_index`.
 */
export function generateDemoQuestions(count: number): DemoQuestion[] {
  const out: DemoQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const template = SAMPLE_QUESTION_POOL[i % SAMPLE_QUESTION_POOL.length];
    out.push({
      ...template,
      id: `demo_q_${i + 1}`,
      order_index: i + 1,
    });
  }
  return out;
}
