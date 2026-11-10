/**
 * The instructions a student reads before beginning a paper, in the paper's own language. The landing page has only
 * the assessment's title to go on (the questions load at the start), so the language is read from it: a Tamil paper
 * names its language ("… · Tamil", "… · Hindi") or is written in that script.
 */
export type InstructionLang = 'en' | 'ta' | 'hi';

export function instructionLang(title: string | null | undefined): InstructionLang {
  const t = title ?? '';
  if (/\btamil\b/i.test(t) || /தமிழ்/.test(t)) return 'ta';
  if (/\bhindi\b/i.test(t) || /हिन्दी|हिंदी/.test(t)) return 'hi';
  // A title that is mostly in one script is a paper in that language; a subject name beside an English title is not.
  const latin = (t.match(/[A-Za-z]/g) ?? []).length;
  const tamil = (t.match(/[\u0B80-\u0BFF]/g) ?? []).length;
  const hindi = (t.match(/[\u0900-\u097F]/g) ?? []).length;
  if (tamil > 0 && tamil >= latin && tamil >= hindi) return 'ta';
  if (hindi > 0 && hindi >= latin) return 'hi';
  return 'en';
}

const s = (n: number) => (n === 1 ? '' : 's');

export interface InstructionCopy {
  heading: string;
  readCarefully: string;
  navigateFreely: string;
  timerCannotPause: string;
  autoSaved: string;
  doNotClose: string;
  negativeEnabled: string;
  /** "Negative marking is enabled. Each wrong answer deducts 0.25 marks." */
  negativeFlat: (value: number | string) => string;
  /** "Negative marking is enabled, and differs by section: A deducts 1 mark; B deducts 0.5 marks per wrong answer." */
  negativeBySection: (parts: Array<{ section: string; value: number }>) => string;
  agree: string;
}

const EN: InstructionCopy = {
  heading: 'Instructions',
  readCarefully: 'Read each question carefully before answering.',
  navigateFreely: 'You can navigate between questions freely.',
  timerCannotPause: 'The timer cannot be paused. The test will auto-submit when time expires.',
  autoSaved: 'Your progress is auto-saved every 30 seconds.',
  doNotClose: 'Do not close or refresh this page during the assessment.',
  negativeEnabled: 'Negative marking is enabled',
  negativeFlat: v => `Each wrong answer deducts ${v} marks.`,
  negativeBySection: parts =>
    `, and differs by section: ${parts.map(p => `${p.section} deducts ${p.value} mark${s(p.value)}`).join('; ')} per wrong answer.`,
  agree: 'I have read and understood the instructions. I agree to abide by the assessment rules.',
};

const TA: InstructionCopy = {
  heading: 'வழிமுறைகள்',
  readCarefully: 'ஒவ்வொரு வினாவையும் பதிலளிக்கும் முன் கவனமாகப் படியுங்கள்.',
  navigateFreely: 'வினாக்களுக்கு இடையே நீங்கள் விரும்பியவாறு மாறிச் செல்லலாம்.',
  timerCannotPause: 'நேரத்தை நிறுத்த முடியாது. நேரம் முடிந்ததும் தேர்வு தானாகவே சமர்ப்பிக்கப்படும்.',
  autoSaved: 'உங்கள் முன்னேற்றம் ஒவ்வொரு 30 வினாடிகளுக்கும் தானாகச் சேமிக்கப்படும்.',
  doNotClose: 'தேர்வின் போது இந்தப் பக்கத்தை மூடவோ புதுப்பிக்கவோ வேண்டாம்.',
  negativeEnabled: 'எதிர்மறை மதிப்பெண் உண்டு',
  negativeFlat: v => `ஒவ்வொரு தவறான விடைக்கும் ${v} மதிப்பெண் குறைக்கப்படும்.`,
  negativeBySection: parts =>
    `, பிரிவுக்குப் பிரிவு மாறுபடும்: ${parts.map(p => `${p.section} பிரிவில் ${p.value} மதிப்பெண்`).join('; ')} (ஒவ்வொரு தவறான விடைக்கும்) குறைக்கப்படும்.`,
  agree: 'வழிமுறைகளைப் படித்துப் புரிந்துகொண்டேன். தேர்வு விதிகளுக்கு உட்படுகிறேன்.',
};

const HI: InstructionCopy = {
  heading: 'निर्देश',
  readCarefully: 'उत्तर देने से पहले प्रत्येक प्रश्न को ध्यान से पढ़ें।',
  navigateFreely: 'आप प्रश्नों के बीच अपनी इच्छानुसार आ-जा सकते हैं।',
  timerCannotPause: 'टाइमर रोका नहीं जा सकता। समय समाप्त होने पर परीक्षा अपने-आप जमा हो जाएगी।',
  autoSaved: 'आपकी प्रगति हर 30 सेकंड में अपने-आप सहेजी जाती है।',
  doNotClose: 'परीक्षा के दौरान इस पृष्ठ को बंद या रीफ़्रेश न करें।',
  negativeEnabled: 'नकारात्मक अंकन लागू है',
  negativeFlat: v => `प्रत्येक गलत उत्तर पर ${v} अंक काटे जाएँगे।`,
  negativeBySection: parts =>
    `, और यह खंड के अनुसार भिन्न है: ${parts.map(p => `${p.section} में ${p.value} अंक`).join('; ')} (प्रत्येक गलत उत्तर पर) काटे जाएँगे।`,
  agree: 'मैंने निर्देश पढ़ और समझ लिए हैं। मैं परीक्षा के नियमों का पालन करने के लिए सहमत हूँ।',
};

export const instructionCopy = (lang: InstructionLang): InstructionCopy => (lang === 'ta' ? TA : lang === 'hi' ? HI : EN);
