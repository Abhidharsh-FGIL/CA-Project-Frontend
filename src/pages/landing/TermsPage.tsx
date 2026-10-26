/**
 * Terms and Conditions — the public page at `/terms`.
 *
 * The wording is the business's; it lives in `SECTIONS` so a change to it is a change to text,
 * not to markup. The layout is shared with the Privacy page (`LegalPage`).
 */
import LegalPage, { contactSection, type LegalSection } from './LegalPage';

const SECTIONS: LegalSection[] = [
  {
    title: 'About Our Platform',
    body: [
      'MyGovExams is an online learning and exam preparation platform offering mock tests, practice questions, study plans, performance reports, and other educational resources for competitive examinations.',
    ],
  },
  {
    title: 'User Accounts',
    points: [
      'Users must provide accurate information when registering.',
      'Users are responsible for keeping their login details secure.',
      'Accounts should be used only by the registered user.',
    ],
  },
  {
    title: 'Use of the Platform',
    points: [
      'Our services are intended for educational and exam preparation purposes.',
      'Users must not misuse the platform, attempt unauthorized access, or copy and distribute our content without permission.',
      'We may restrict accounts involved in misuse.',
    ],
  },
  {
    title: 'Exam Content and Accuracy',
    body: [
      'We aim to provide accurate and useful study materials. However, we do not guarantee that all questions, answers, explanations, or exam-related information will be error-free or up to date.',
      'Users should refer to official examination websites for the latest notifications, eligibility requirements, syllabi, and examination dates.',
    ],
  },
  {
    title: 'Performance Reports and Study Plans',
    body: [
      'Scores, performance reports, recommendations, and personalized study plans are provided to support preparation. They do not guarantee examination success, selection, or any particular result.',
    ],
  },
  {
    title: 'Payments and Subscriptions',
    body: [
      'Where paid services are offered, applicable fees and subscription details will be displayed before purchase. Any cancellation or refund terms will be communicated at the time of purchase.',
    ],
  },
  {
    title: 'Refer & Earn Program',
    points: [
      "Cashback is applicable only to a friend's first eligible purchase.",
      'Cashback is calculated at 5% of the eligible purchase amount, excluding GST.',
      'Subsequent purchases are not eligible for referral cashback.',
      'Rewards remain pending for 15 days before becoming available for withdrawal.',
      "Rewards are reversed if a friend's payment is refunded.",
      'Withdrawals may require verification, such as PAN verification, and may be subject to applicable taxes.',
      "The minimum withdrawal amount is ₹200, and withdrawals are available once per month, subject to the program's terms.",
    ],
  },
  {
    title: 'Intellectual Property',
    body: [
      'The content, design, branding, and educational materials available on MyGovExams belong to their respective owners and may not be reproduced or commercially distributed without permission.',
    ],
  },
  {
    title: 'Service Availability',
    body: [
      'We may update, modify, or temporarily suspend parts of the platform for maintenance or improvements.',
    ],
  },
  {
    title: 'Disclaimer',
    body: [
      'MyGovExams is an independent exam preparation platform and is not affiliated with or endorsed by any government examination authority unless explicitly stated.',
    ],
  },
  {
    title: 'Changes to These Terms',
    body: [
      'We may update these terms when necessary. Continued use of the platform after changes are published indicates acceptance of the revised terms.',
    ],
  },
  contactSection('For questions or support, please contact:'),
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms and Conditions"
      effective="14 October 2026"
      lead="Welcome to MyGovExams. By accessing or using our website, you agree to the following terms and conditions."
      sections={SECTIONS}
    />
  );
}
