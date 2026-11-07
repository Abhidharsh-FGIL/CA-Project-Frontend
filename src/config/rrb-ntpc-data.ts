/**
 * RRB NTPC syllabus as the backend published it: 52 units over three subjects, each with its CBT-1 and CBT-2 question
 * counts, its topics, and every name in English, Tamil and Hindi.
 *
 * Generated from `rrb_ntpc_52_units_map_2026-11-07.xlsx` (the backend's sheet). Unit ids are `n1-<key>` for CBT-1 and
 * `n2-<key>` for CBT-2.
 */

export interface NtpcSubjectData {
  /** The backend's subject code. */
  code: string;
  /** The portal's subject id — prefixed so it cannot meet another exam's `mathematics`. */
  id: string;
  en: string;
  ta: string;
  hi: string;
}

export interface NtpcUnitData {
  subject: string;
  key: string;
  en: string;
  ta: string;
  hi: string;
  /** Questions in CBT-1 / CBT-2. */
  q: [number, number];
  /** Topics: English, Tamil, Hindi. */
  topics: Array<[string, string, string]>;
}

export const NTPC_SUBJECTS: NtpcSubjectData[] = [
  { code: "general-awareness", id: "ntpc-general-awareness", en: "General Awareness", ta: "பொது விழிப்புணர்வு", hi: "सामान्य जागरूकता" },
  { code: "mathematics", id: "ntpc-mathematics", en: "Mathematics", ta: "கணிதம்", hi: "गणित" },
  { code: "general-intelligence-and-reasoning", id: "ntpc-reasoning", en: "General Intelligence & Reasoning", ta: "பொது அறிவுத்திறன் மற்றும் பகுத்தறிவு", hi: "सामान्य बुद्धिमत्ता एवं तर्कशक्ति" },
];

export const NTPC_UNITS: NtpcUnitData[] = [
  { subject: "general-awareness", key: "ga-current-affairs", en: "Current Events", ta: "நடப்பு நிகழ்வுகள்", hi: "समसामयिक घटनाएँ", q: [4, 5], topics: [
    ["Current Events of National and International Importance", "தேசிய மற்றும் சர்வதேச முக்கியத்துவம் வாய்ந்த நடப்பு நிகழ்வுகள்", "राष्ट्रीय और अंतरराष्ट्रीय महत्व की समसामयिक घटनाएँ"],
  ] },
  { subject: "general-awareness", key: "ga-games-and-sports", en: "Games and Sports", ta: "விளையாட்டுகள்", hi: "खेलकूद", q: [2, 2], topics: [
    ["Games and Sports", "விளையாட்டுகள்", "खेलकूद"],
  ] },
  { subject: "general-awareness", key: "ga-art-and-culture", en: "Art and Culture", ta: "கலை மற்றும் பண்பாடு", hi: "कला और संस्कृति", q: [2, 3], topics: [
    ["Art and Culture of India", "இந்தியாவின் கலை மற்றும் பண்பாடு", "भारत की कला और संस्कृति"],
  ] },
  { subject: "general-awareness", key: "ga-indian-literature", en: "Indian Literature", ta: "இந்திய இலக்கியம்", hi: "भारतीय साहित्य", q: [1, 1], topics: [
    ["Indian Literature and Important Books", "இந்திய இலக்கியம் மற்றும் முக்கிய நூல்கள்", "भारतीय साहित्य और महत्वपूर्ण पुस्तकें"],
  ] },
  { subject: "general-awareness", key: "ga-monuments-and-places", en: "Monuments and Places", ta: "நினைவுச்சின்னங்கள் மற்றும் இடங்கள்", hi: "स्मारक और स्थान", q: [1, 1], topics: [
    ["Important Monuments and Places of India", "இந்தியாவின் முக்கிய நினைவுச்சின்னங்கள் மற்றும் இடங்கள்", "भारत के महत्वपूर्ण स्मारक और स्थान"],
  ] },
  { subject: "general-awareness", key: "ga-general-science", en: "General Science", ta: "பொது அறிவியல்", hi: "सामान्य विज्ञान", q: [3, 4], topics: [
    ["General Science (up to 10th CBSE)", "பொது அறிவியல் (10ஆம் வகுப்பு CBSE வரை)", "सामान्य विज्ञान (10वीं CBSE तक)"],
  ] },
  { subject: "general-awareness", key: "ga-life-science", en: "Life Science", ta: "உயிர் அறிவியல்", hi: "जीवन विज्ञान", q: [2, 3], topics: [
    ["Life Science", "உயிர் அறிவியல்", "जीवन विज्ञान"],
    ["List of Phobias", "பயங்களின் (ஃபோபியா) பட்டியல்", "भयों की सूची"],
  ] },
  { subject: "general-awareness", key: "ga-history", en: "History of India", ta: "இந்திய வரலாறு", hi: "भारत का इतिहास", q: [3, 4], topics: [
    ["History of India", "இந்திய வரலாறு", "भारत का इतिहास"],
  ] },
  { subject: "general-awareness", key: "ga-freedom-struggle", en: "Indian Freedom Struggle", ta: "இந்திய சுதந்திரப் போராட்டம்", hi: "भारतीय स्वतंत्रता संग्राम", q: [2, 2], topics: [
    ["Indian Freedom Struggle", "இந்திய சுதந்திரப் போராட்டம்", "भारतीय स्वतंत्रता संग्राम"],
  ] },
  { subject: "general-awareness", key: "ga-geography", en: "Geography of India and the World", ta: "இந்தியா மற்றும் உலக புவியியல்", hi: "भारत और विश्व का भूगोल", q: [3, 4], topics: [
    ["Physical, Social and Economic Geography of India and World", "இந்தியா மற்றும் உலகின் இயற்கை, சமூக மற்றும் பொருளாதார புவியியல்", "भारत और विश्व का भौतिक, सामाजिक और आर्थिक भूगोल"],
  ] },
  { subject: "general-awareness", key: "ga-polity", en: "Indian Polity and Governance", ta: "இந்திய அரசியல் மற்றும் ஆட்சிமுறை", hi: "भारतीय राजव्यवस्था और शासन", q: [3, 3], topics: [
    ["Indian Polity and Governance", "இந்திய அரசியல் மற்றும் ஆட்சிமுறை", "भारतीय राजव्यवस्था और शासन"],
  ] },
  { subject: "general-awareness", key: "ga-science-and-technology", en: "Science and Technology", ta: "அறிவியல் மற்றும் தொழில்நுட்பம்", hi: "विज्ञान और प्रौद्योगिकी", q: [2, 3], topics: [
    ["General Scientific and Technological Developments", "பொது அறிவியல் மற்றும் தொழில்நுட்ப வளர்ச்சிகள்", "सामान्य वैज्ञानिक और तकनीकी विकास"],
  ] },
  { subject: "general-awareness", key: "ga-un-and-world-organisations", en: "UN and World Organisations", ta: "ஐக்கிய நாடுகள் சபை மற்றும் உலக அமைப்புகள்", hi: "संयुक्त राष्ट्र और विश्व संगठन", q: [1, 1], topics: [
    ["UN and Other Important World Organizations", "ஐ.நா. மற்றும் பிற முக்கிய உலக அமைப்புகள்", "संयुक्त राष्ट्र और अन्य महत्वपूर्ण विश्व संगठन"],
  ] },
  { subject: "general-awareness", key: "ga-environment", en: "Environment", ta: "சுற்றுச்சூழல்", hi: "पर्यावरण", q: [2, 2], topics: [
    ["Environmental Issues Concerning India and World at Large", "இந்தியா மற்றும் உலகம் தொடர்பான சுற்றுச்சூழல் பிரச்சினைகள்", "भारत और विश्व से संबंधित पर्यावरणीय मुद्दे"],
  ] },
  { subject: "general-awareness", key: "ga-computers", en: "Basics of Computers", ta: "கணினி அடிப்படைகள்", hi: "कंप्यूटर की मूल बातें", q: [1, 2], topics: [
    ["Basics of Computers and Computer Applications", "கணினி அடிப்படைகள் மற்றும் கணினி பயன்பாடுகள்", "कंप्यूटर की मूल बातें और कंप्यूटर अनुप्रयोग"],
  ] },
  { subject: "general-awareness", key: "ga-abbreviations", en: "Common Abbreviations", ta: "பொதுவான சுருக்கெழுத்துகள்", hi: "सामान्य संक्षिप्त रूप", q: [1, 1], topics: [
    ["Common Abbreviations", "பொதுவான சுருக்கெழுத்துகள்", "सामान्य संक्षिप्त रूप"],
  ] },
  { subject: "general-awareness", key: "ga-transport", en: "Transport Systems in India", ta: "இந்தியாவின் போக்குவரத்து அமைப்புகள்", hi: "भारत में परिवहन प्रणालियाँ", q: [1, 2], topics: [
    ["Transport Systems in India", "இந்தியாவின் போக்குவரத்து அமைப்புகள்", "भारत में परिवहन प्रणालियाँ"],
  ] },
  { subject: "general-awareness", key: "ga-economy", en: "Indian Economy", ta: "இந்தியப் பொருளாதாரம்", hi: "भारतीय अर्थव्यवस्था", q: [2, 3], topics: [
    ["Indian Economy", "இந்தியப் பொருளாதாரம்", "भारतीय अर्थव्यवस्था"],
  ] },
  { subject: "general-awareness", key: "ga-famous-personalities", en: "Famous Personalities", ta: "புகழ்பெற்ற ஆளுமைகள்", hi: "प्रसिद्ध हस्तियाँ", q: [1, 1], topics: [
    ["Famous Personalities of India and World", "இந்தியா மற்றும் உலகின் புகழ்பெற்ற ஆளுமைகள்", "भारत और विश्व की प्रसिद्ध हस्तियाँ"],
  ] },
  { subject: "general-awareness", key: "ga-government-programmes", en: "Government Programmes", ta: "அரசுத் திட்டங்கள்", hi: "सरकारी कार्यक्रम", q: [1, 1], topics: [
    ["Flagship Government Programmes", "முதன்மை அரசுத் திட்டங்கள்", "प्रमुख सरकारी कार्यक्रम"],
  ] },
  { subject: "general-awareness", key: "ga-flora-and-fauna", en: "Flora and Fauna", ta: "தாவரங்கள் மற்றும் விலங்கினங்கள்", hi: "वनस्पति और जीव-जंतु", q: [1, 1], topics: [
    ["Flora and Fauna of India", "இந்தியாவின் தாவரங்கள் மற்றும் விலங்கினங்கள்", "भारत की वनस्पति और जीव-जंतु"],
  ] },
  { subject: "general-awareness", key: "ga-government-and-psu-organisations", en: "Government and Public Sector Organisations", ta: "அரசு மற்றும் பொதுத்துறை நிறுவனங்கள்", hi: "सरकारी और सार्वजनिक क्षेत्र के संगठन", q: [1, 1], topics: [
    ["Important Government and Public Sector Organizations of India", "இந்தியாவின் முக்கிய அரசு மற்றும் பொதுத்துறை நிறுவனங்கள்", "भारत के महत्वपूर्ण सरकारी और सार्वजनिक क्षेत्र के संगठन"],
  ] },
  { subject: "mathematics", key: "ma-number-system", en: "Number System", ta: "எண் முறைமை", hi: "संख्या पद्धति", q: [3, 4], topics: [
    ["Number System", "எண் முறைமை", "संख्या पद्धति"],
  ] },
  { subject: "mathematics", key: "ma-decimals-and-fractions", en: "Decimals and Fractions", ta: "தசமங்கள் மற்றும் பின்னங்கள்", hi: "दशमलव और भिन्न", q: [2, 2], topics: [
    ["Decimals", "தசமங்கள்", "दशमलव"],
    ["Fractions", "பின்னங்கள்", "भिन्न"],
  ] },
  { subject: "mathematics", key: "ma-lcm-and-hcf", en: "LCM and HCF", ta: "மீ.பொ.ம மற்றும் மீ.பொ.வ", hi: "लघुत्तम समापवर्त्य और महत्तम समापवर्तक (LCM और HCF)", q: [2, 2], topics: [
    ["LCM", "மீச்சிறு பொது மடங்கு (மீ.பொ.ம)", "लघुत्तम समापवर्त्य (LCM)"],
    ["HCF", "மீப்பெரு பொது வகுத்தி (மீ.பொ.வ)", "महत्तम समापवर्तक (HCF)"],
  ] },
  { subject: "mathematics", key: "ma-ratio-and-proportion", en: "Ratio and Proportion", ta: "விகிதம் மற்றும் விகிதாசாரம்", hi: "अनुपात और समानुपात", q: [3, 3], topics: [
    ["Ratio and Proportions", "விகிதம் மற்றும் விகிதாசாரம்", "अनुपात और समानुपात"],
  ] },
  { subject: "mathematics", key: "ma-percentage", en: "Percentage", ta: "சதவீதம்", hi: "प्रतिशत", q: [2, 2], topics: [
    ["Percentage", "சதவீதம்", "प्रतिशत"],
  ] },
  { subject: "mathematics", key: "ma-mensuration", en: "Mensuration", ta: "அளவியல்", hi: "क्षेत्रमिति", q: [3, 3], topics: [
    ["Mensuration", "அளவியல்", "क्षेत्रमिति"],
  ] },
  { subject: "mathematics", key: "ma-time-and-work", en: "Time and Work", ta: "காலமும் வேலையும்", hi: "समय और कार्य", q: [2, 3], topics: [
    ["Time and Work", "காலமும் வேலையும்", "समय और कार्य"],
  ] },
  { subject: "mathematics", key: "ma-time-and-distance", en: "Time and Distance", ta: "காலமும் தூரமும்", hi: "समय और दूरी", q: [3, 3], topics: [
    ["Time, Speed, and Distance", "காலம், வேகம் மற்றும் தூரம்", "समय, गति और दूरी"],
  ] },
  { subject: "mathematics", key: "ma-simple-and-compound-interest", en: "Simple and Compound Interest", ta: "தனி வட்டி மற்றும் கூட்டு வட்டி", hi: "साधारण और चक्रवृद्धि ब्याज", q: [2, 3], topics: [
    ["Simple and Compound Interest", "தனி வட்டி மற்றும் கூட்டு வட்டி", "साधारण और चक्रवृद्धि ब्याज"],
  ] },
  { subject: "mathematics", key: "ma-profit-and-loss", en: "Profit and Loss", ta: "இலாபம் மற்றும் நட்டம்", hi: "लाभ और हानि", q: [3, 3], topics: [
    ["Profit and Loss", "இலாபம் மற்றும் நட்டம்", "लाभ और हानि"],
  ] },
  { subject: "mathematics", key: "ma-algebra", en: "Elementary Algebra", ta: "அடிப்படை இயற்கணிதம்", hi: "प्रारंभिक बीजगणित", q: [2, 3], topics: [
    ["Elementary Algebra", "அடிப்படை இயற்கணிதம்", "प्रारंभिक बीजगणित"],
  ] },
  { subject: "mathematics", key: "ma-geometry-and-trigonometry", en: "Geometry and Trigonometry", ta: "வடிவியல் மற்றும் முக்கோணவியல்", hi: "ज्यामिति और त्रिकोणमिति", q: [2, 3], topics: [
    ["Geometry and Trigonometry", "வடிவியல் மற்றும் முக்கோணவியல்", "ज्यामिति और त्रिकोणमिति"],
  ] },
  { subject: "mathematics", key: "ma-statistics", en: "Elementary Statistics", ta: "அடிப்படை புள்ளியியல்", hi: "प्रारंभिक सांख्यिकी", q: [1, 1], topics: [
    ["Elementary Statistics", "அடிப்படை புள்ளியியல்", "प्रारंभिक सांख्यिकी"],
  ] },
  { subject: "general-intelligence-and-reasoning", key: "gi-analogies", en: "Analogies", ta: "ஒப்புமைகள்", hi: "सादृश्य", q: [3, 3], topics: [
    ["Analogies", "ஒப்புமைகள்", "सादृश्य"],
  ] },
  { subject: "general-intelligence-and-reasoning", key: "gi-number-series", en: "Number Series", ta: "எண் தொடர்", hi: "संख्या श्रृंखला", q: [2, 3], topics: [
    ["Number Series", "எண் தொடர்", "संख्या श्रृंखला"],
  ] },
  { subject: "general-intelligence-and-reasoning", key: "gi-alphabetical-series", en: "Alphabetical Series", ta: "எழுத்துத் தொடர்", hi: "वर्णमाला श्रृंखला", q: [2, 2], topics: [
    ["Alphabetical Series", "எழுத்துத் தொடர்", "वर्णमाला श्रृंखला"],
  ] },
  { subject: "general-intelligence-and-reasoning", key: "gi-coding-and-decoding", en: "Coding and Decoding", ta: "குறியீடாக்கம் மற்றும் குறிநீக்கம்", hi: "कोडिंग और डिकोडिंग", q: [3, 3], topics: [
    ["Coding and Decoding", "குறியீடாக்கம் மற்றும் குறிநீக்கம்", "कोडिंग और डिकोडिंग"],
  ] },
  { subject: "general-intelligence-and-reasoning", key: "gi-mathematical-operations", en: "Mathematical Operations", ta: "கணிதச் செயல்பாடுகள்", hi: "गणितीय संक्रियाएँ", q: [2, 2], topics: [
    ["Mathematical Operations", "கணிதச் செயல்பாடுகள்", "गणितीय संक्रियाएँ"],
  ] },
  { subject: "general-intelligence-and-reasoning", key: "gi-similarities-and-differences", en: "Similarities and Differences", ta: "ஒற்றுமைகள் மற்றும் வேற்றுமைகள்", hi: "समानताएँ और अंतर", q: [1, 2], topics: [
    ["Similarities and Differences", "ஒற்றுமைகள் மற்றும் வேற்றுமைகள்", "समानताएँ और अंतर"],
    ["Classification", "வகைப்படுத்துதல்", "वर्गीकरण"],
  ] },
  { subject: "general-intelligence-and-reasoning", key: "gi-relationships", en: "Relationships", ta: "உறவுமுறைகள்", hi: "संबंध", q: [2, 2], topics: [
    ["Relationships (Blood Relations)", "உறவுமுறைகள் (இரத்த உறவுகள்)", "संबंध (रक्त संबंध)"],
  ] },
  { subject: "general-intelligence-and-reasoning", key: "gi-analytical-reasoning", en: "Analytical Reasoning", ta: "பகுப்பாய்வுப் பகுத்தறிவு", hi: "विश्लेषणात्मक तर्कशक्ति", q: [2, 3], topics: [
    ["Analytical Reasoning", "பகுப்பாய்வுப் பகுத்தறிவு", "विश्लेषणात्मक तर्कशक्ति"],
    ["Non-Verbal Reasoning", "சொல்லற்ற பகுத்தறிவு", "गैर-मौखिक तर्कशक्ति"],
  ] },
  { subject: "general-intelligence-and-reasoning", key: "gi-syllogism", en: "Syllogism", ta: "தருக்க முடிவு (சிலாஜிசம்)", hi: "न्यायवाक्य", q: [2, 2], topics: [
    ["Syllogism", "தருக்க முடிவு (சிலாஜிசம்)", "न्यायवाक्य"],
  ] },
  { subject: "general-intelligence-and-reasoning", key: "gi-jumbling", en: "Jumbling", ta: "குழப்பிய வரிசையை சீரமைத்தல் (ஜம்ப்ளிங்)", hi: "क्रम-विन्यास", q: [2, 2], topics: [
    ["Jumbling", "குழப்பிய வரிசையை சீரமைத்தல் (ஜம்ப்ளிங்)", "क्रम-विन्यास"],
  ] },
  { subject: "general-intelligence-and-reasoning", key: "gi-venn-diagrams", en: "Venn Diagrams", ta: "வென் படங்கள்", hi: "वेन आरेख", q: [2, 2], topics: [
    ["Venn Diagrams", "வென் படங்கள்", "वेन आरेख"],
  ] },
  { subject: "general-intelligence-and-reasoning", key: "gi-puzzles", en: "Puzzles", ta: "புதிர்கள்", hi: "पहेलियाँ", q: [2, 3], topics: [
    ["Puzzles", "புதிர்கள்", "पहेलियाँ"],
    ["Clock & Calendar", "கடிகாரம் மற்றும் நாட்காட்டி", "घड़ी और कैलेंडर"],
    ["Ordering & Ranking", "வரிசைப்படுத்துதல் மற்றும் தரவரிசை", "क्रम और रैंकिंग"],
  ] },
  { subject: "general-intelligence-and-reasoning", key: "gi-data-sufficiency", en: "Data Sufficiency", ta: "தரவுப் போதுமை", hi: "आँकड़ों की पर्याप्तता", q: [1, 1], topics: [
    ["Data Sufficiency", "தரவுப் போதுமை", "आँकड़ों की पर्याप्तता"],
  ] },
  { subject: "general-intelligence-and-reasoning", key: "gi-statement-and-conclusion", en: "Statement and Conclusion", ta: "கூற்று மற்றும் முடிவு", hi: "कथन और निष्कर्ष", q: [1, 1], topics: [
    ["Statement and Conclusion", "கூற்று மற்றும் முடிவு", "कथन और निष्कर्ष"],
  ] },
  { subject: "general-intelligence-and-reasoning", key: "gi-statement-and-courses-of-action", en: "Statement and Courses of Action", ta: "கூற்று மற்றும் செயல்திட்டங்கள்", hi: "कथन और कार्यवाही के तरीके", q: [1, 1], topics: [
    ["Statement and Courses of Action", "கூற்று மற்றும் செயல்திட்டங்கள்", "कथन और कार्यवाही के तरीके"],
  ] },
  { subject: "general-intelligence-and-reasoning", key: "gi-decision-making", en: "Decision Making", ta: "முடிவெடுத்தல்", hi: "निर्णय लेना", q: [1, 1], topics: [
    ["Decision Making", "முடிவெடுத்தல்", "निर्णय लेना"],
  ] },
  { subject: "general-intelligence-and-reasoning", key: "gi-maps-and-graphs", en: "Maps and Graph Interpretation", ta: "வரைபடங்கள் மற்றும் கிராஃப் விளக்கம்", hi: "मानचित्र और ग्राफ की व्याख्या", q: [1, 2], topics: [
    ["Maps and Graph Interpretation", "வரைபடங்கள் மற்றும் கிராஃப் விளக்கம்", "मानचित्र और ग्राफ की व्याख्या"],
    ["Directions & Distances", "திசைகள் மற்றும் தூரங்கள்", "दिशाएँ और दूरियाँ"],
  ] },
];
