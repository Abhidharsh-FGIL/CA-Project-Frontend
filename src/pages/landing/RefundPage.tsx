/**
 * Refund & Cancellation Policy — the public page at `/refund`.
 *
 * The wording is the business's; it lives in `SECTIONS` so a change to it is a change to text, not to
 * markup. The layout is shared with the Terms and Privacy pages (`LegalPage`).
 */
import LegalPage, { contactSection, type LegalSection } from './LegalPage';

const TOP_UPS: Array<[string, string]> = [
  ['Mock Starter – 3 Mock Tests', '₹99'],
  ['Mock Booster – 10 Mock Tests', '₹299'],
  ['Practice Starter – 10 Practice Tests', '₹99'],
  ['Practice Booster – 35 Practice Tests', '₹299'],
  ['Combo Starter – 3 Mock + 10 Practice Tests', '₹149'],
  ['Combo Booster – 10 Mock + 30 Practice Tests', '₹449'],
];

const SECTIONS: LegalSection[] = [
  {
    title: 'Subscription Plans',
    body: ['My Gov Exams offers the following subscription options:'],
    points: [
      'Free Plan: Access to a limited number of mock and practice tests at no cost.',
      'Monthly Subscription: ₹499, valid for one month from activation.',
      'Annual Subscription: ₹1,999, valid for 12 months from activation.',
      'Each subscription provides access to a specified number of mock tests, practice tests, and applicable platform features.',
      'Subscriptions are activated after successful payment verification.',
    ],
  },
  {
    title: 'Additional Test Top-Ups',
    body: [
      'Students with an active Monthly or Annual subscription may purchase additional mock tests and practice tests through the following top-up plans:',
      <table key="topups" className="mge-legal-table">
        <thead>
          <tr>
            <th>Top-Up Plan</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {TOP_UPS.map(([plan, price]) => (
            <tr key={plan}>
              <td>{plan}</td>
              <td>{price}</td>
            </tr>
          ))}
        </tbody>
      </table>,
      'Important conditions:',
    ],
    points: [
      'Top-ups can be purchased and used only with an active paid subscription.',
      'Purchased top-up credits do not expire.',
      "If a subscription expires, unused top-up credits remain associated with the student's account.",
      'Unused top-up credits become accessible again when the student activates an eligible paid subscription.',
      'Top-up purchases do not extend the validity of the base subscription.',
    ],
  },
  {
    title: 'Subscription Cancellation',
    points: [
      'Students may choose not to renew their subscription after its validity period.',
      'For subscriptions purchased as one-time payments, no separate cancellation request is required to prevent renewal.',
      'Cancellation or non-renewal does not automatically entitle the student to a refund for an already activated subscription.',
      'If automatic renewal is introduced, the applicable cancellation procedure and renewal terms will be disclosed separately.',
    ],
  },
  {
    title: 'Refund Eligibility',
    body: ['Refund requests may be considered in the following circumstances:'],
    points: [
      'Duplicate Payment: The same purchase has been charged more than once due to a payment or processing error.',
      'Payment Deducted but Service Not Activated: Payment has been successfully collected, but the subscription or purchased top-up has not been credited, and the issue cannot be resolved within a reasonable period.',
      'Technical Issues: A verified platform-related issue substantially prevents access to the purchased service and cannot be resolved or appropriately remedied.',
      'Incorrect Charges: An amount has been collected incorrectly due to a verified billing error.',
      'Refund eligibility will be assessed based on payment records, service usage, the nature of the issue, and applicable consumer protection laws.',
    ],
  },
  {
    title: 'Non-Refundable Circumstances',
    body: ['Refunds will generally not be provided in the following situations, except where required by applicable law:'],
    points: [
      'A student changes their mind after purchasing and accessing the subscription or top-up.',
      'A student does not use the purchased tests during the subscription validity period.',
      'A student purchases a subscription but later decides not to prepare for the examination.',
      'A student is dissatisfied with their examination performance or results.',
      'A student is unable to complete preparation due to personal circumstances.',
      'Refund requests involving technical failures, incorrect charges, or non-delivery of purchased services will be reviewed separately.',
    ],
  },
  {
    title: 'Failed or Cancelled Payments',
    body: ['If a payment fails or is cancelled before successful completion:'],
    points: [
      'The subscription or top-up will not be activated unless payment is subsequently verified as successful.',
      'Students may retry the payment.',
      'If an amount has been deducted but the purchase is not reflected in the account, students should contact customer support with the payment reference.',
      'Students are advised not to make repeated payments for the same purchase while an earlier transaction is still pending verification.',
    ],
  },
  {
    title: 'Refund Request Process',
    body: ['To request a refund, students should contact My Gov Exams customer support and provide:'],
    points: [
      'Registered name and email address',
      'Registered mobile number, if applicable',
      'Payment date and amount',
      'Transaction or payment reference number',
      'Reason for the refund request',
      'Relevant screenshots, where available',
      'Our team will review the request and may seek additional information to verify the transaction.',
    ],
  },
  {
    title: 'Refund Processing',
    points: [
      'Approved refunds will ordinarily be initiated to the original payment method, subject to payment gateway and banking procedures.',
      'The time taken for the refunded amount to appear in the student’s account may vary depending on the payment provider and bank.',
      'Students will be informed of the outcome of their refund request through the registered contact details.',
    ],
  },
  {
    title: 'Examination and Service Disclaimer',
    points: [
      'My Gov Exams provides preparation materials, practice tests, mock examinations, performance insights, and study-planning tools.',
      'Purchasing a subscription or using the platform does not guarantee success, selection, employment, or any particular score in a government examination.',
      'My Gov Exams is an independent examination preparation platform and is not affiliated with or endorsed by TNPSC or any government recruitment authority unless expressly stated otherwise.',
    ],
  },
  {
    title: 'Changes to This Policy',
    points: [
      'My Gov Exams reserves the right to update this policy to reflect changes in services, payment processes, or applicable legal requirements.',
      'Any revised policy will be published on the website with an updated effective date. Changes will not override rights available to consumers under applicable law.',
    ],
  },
  contactSection('For refund requests or questions, please contact customer support:'),
];

export default function RefundPage() {
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      effective="20 October 2026"
      lead="Welcome to My Gov Exams (www.mygovexams.com), an online government examination preparation platform operated by FutureGen Innovation Lab. This Refund & Cancellation Policy explains the terms applicable to subscription purchases, additional test top-ups, cancellations, and refund requests."
      sections={SECTIONS}
    />
  );
}
