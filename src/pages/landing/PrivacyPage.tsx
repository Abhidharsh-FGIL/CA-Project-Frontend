/**
 * Privacy Policy — the public page at `/privacy`.
 *
 * The wording is the business's; it lives in `SECTIONS` so a change to it is a change to text,
 * not to markup. The layout is shared with the Terms page (`LegalPage`).
 */
import LegalPage, { contactSection, type LegalSection } from './LegalPage';

const SECTIONS: LegalSection[] = [
  {
    title: 'Information We Collect',
    body: ['When you use our platform, we may collect:'],
    points: [
      'Name, email address, and account details.',
      'Selected examinations and learning preferences.',
      'Mock test attempts, scores, and performance information.',
      'Study plans, progress, and activity history.',
      'Basic technical information, such as device type, browser, and website usage.',
    ],
  },
  {
    title: 'How We Use Your Information',
    body: ['We use this information to:'],
    points: [
      'Create and manage your account.',
      'Provide mock tests and practice materials.',
      'Generate performance reports and personalized study plans.',
      'Track your learning progress.',
      'Improve the platform and provide customer support.',
      'Send important service-related updates.',
    ],
  },
  {
    title: 'Data Protection',
    body: [
      'We use reasonable security measures to protect your information against unauthorized access, misuse, and disclosure.',
    ],
  },
  {
    title: 'Sharing of Information',
    body: [
      'We do not sell your personal information to advertisers.',
      'We may share necessary information with trusted service providers who help operate the platform, or when required by law.',
    ],
  },
  {
    title: 'Cookies',
    body: [
      'Our website may use cookies and similar technologies to maintain login sessions, remember preferences, and improve the user experience.',
    ],
  },
  {
    title: 'Data Retention',
    body: [
      'We retain personal information for as long as reasonably necessary to provide our services, meet legal obligations, and resolve disputes.',
    ],
  },
  {
    title: 'Your Rights',
    body: [
      'You may contact us to request access to, correction of, or deletion of your personal information, subject to applicable laws.',
      'You may also contact us regarding consent, privacy concerns, or complaints.',
    ],
  },
  {
    title: "Children's Privacy",
    body: [
      'Where parental or guardian consent is required by applicable law, it must be obtained before a child uses the platform or provides personal information.',
    ],
  },
  {
    title: 'Changes to This Policy',
    body: ['We may update this Privacy Policy periodically. Any changes will be published on this page.'],
  },
  contactSection('For privacy-related questions or requests, please contact:'),
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      effective="14 October 2026"
      lead="At MyGovExams, we respect your privacy and are committed to protecting your personal information."
      sections={SECTIONS}
    />
  );
}
