/**
 * Every unit, subject, key topic and category is shown in both languages: "English / தமிழ்".
 *
 * The names come from three places, in this order:
 *   1. a name the server sends in the other language (`name_ta`, `name_en`) — the way to fix or add a pair
 *      without a release;
 *   2. the syllabus (`config/tnpsc.ts`), whose units and subjects carry both;
 *   3. the glossary below: every printed syllabus topic, and the category names the question bank uses.
 * A name none of these knows is shown as it is, in its one language.
 */
import { TNPSC_GROUPS, stageUnits, unitTopics } from '@/config/tnpsc';
import { displayTitle } from '@/lib/display-title';

export const BILINGUAL_SEPARATOR = ' / ';

/** [English, Tamil]. Order does not matter for lookup; it decides nothing but readability here. */
const GLOSSARY: Array<[string, string]> = [
  // ── Papers and sections ──
  ['General Tamil', 'பொதுத் தமிழ்'],
  ['General English', 'பொது ஆங்கிலம்'],
  ['General Studies', 'பொது அறிவு'],
  ['Aptitude & Mental Ability', 'திறனறிவு மற்றும் மனக்கணக்கு நுண்ணறிவு'],
  ['Aptitude and Mental Ability', 'திறனறிவு மற்றும் மனக்கணக்கு நுண்ணறிவு'],
  ['Aptitude', 'திறனறிவு'],
  ['Reasoning', 'தருக்க அறிவு'],
  ['Current Affairs', 'நடப்பு நிகழ்வுகள்'],
  ['Current Events', 'நடப்பு நிகழ்வுகள்'],

  // ── Current affairs categories ──
  ['Sports', 'விளையாட்டு'],
  ['National Affairs', 'தேசிய நிகழ்வுகள்'],
  ['Tamil Nadu Affairs', 'தமிழ்நாடு நிகழ்வுகள்'],
  ['International Affairs', 'சர்வதேச நிகழ்வுகள்'],
  ['Awards Honours and Personalities', 'விருதுகள், கௌரவங்கள் மற்றும் ஆளுமைகள்'],
  ['Economy and Banking', 'பொருளாதாரம் மற்றும் வங்கியியல்'],
  ['Environment and Important Days', 'சுற்றுச்சூழல் மற்றும் முக்கிய நாட்கள்'],
  ['Science Technology and Defence', 'அறிவியல், தொழில்நுட்பம் மற்றும் பாதுகாப்பு'],

  // ── General Science ──
  ['General Science', 'பொது அறிவியல்'],
  ['Physics', 'இயற்பியல்'],
  ['Chemistry', 'வேதியியல்'],
  ['Biology', 'உயிரியல்'],
  ['Botany', 'தாவரவியல்'],
  ['Zoology', 'விலங்கியல்'],
  ['Environmental Science', 'சுற்றுச்சூழல் அறிவியல்'],
  ['Universe and Space Science', 'பேரண்டம் மற்றும் விண்வெளி அறிவியல்'],
  ['Human Physiology, Nutrition and Health', 'மனித உடலியல், ஊட்டச்சத்து மற்றும் உடல்நலம்'],
  ['Human Physiology Nutrition and Health', 'மனித உடலியல், ஊட்டச்சத்து மற்றும் உடல்நலம்'],
  ['Science and Technology', 'அறிவியல் மற்றும் தொழில்நுட்பம்'],
  ['Nature of Universe', 'பேரண்டத்தின் இயல்பு'],
  ['Measurement of physical quantities', 'இயற்பியல் அளவுகளின் அளவீடு'],
  ['General scientific laws in motion — force, pressure and energy', 'இயக்கத்தின் பொது அறிவியல் விதிகள் — விசை, அழுத்தம் மற்றும் ஆற்றல்'],
  ['Everyday application of mechanics, electricity, magnetism, light, sound, heat and nuclear physics', 'இயக்கவியல், மின்சாரம், காந்தவியல், ஒளி, ஒலி, வெப்பம் மற்றும் அணுக்கரு இயற்பியலின் அன்றாடப் பயன்பாடுகள்'],
  ['Elements and compounds, acids, bases, salts', 'தனிமங்கள், சேர்மங்கள், அமிலங்கள், காரங்கள், உப்புகள்'],
  ['Petroleum products, fertilizers, pesticides', 'பெட்ரோலியப் பொருட்கள், உரங்கள், பூச்சிக்கொல்லிகள்'],
  ['Metallurgy and food adulterants', 'உலோகவியல் மற்றும் உணவுக் கலப்படம்'],
  ['Main concepts of life science', 'உயிர் அறிவியலின் முக்கியக் கருத்துகள்'],
  ['Classification of living organisms', 'உயிரினங்களின் வகைப்பாடு'],
  ['Evolution, genetics and physiology', 'பரிணாமம், மரபியல் மற்றும் உடலியல்'],
  ['Nutrition, health and hygiene, human diseases', 'ஊட்டச்சத்து, உடல்நலம், சுகாதாரம், மனித நோய்கள்'],
  ['Latest inventions in science and technology', 'அறிவியல் மற்றும் தொழில்நுட்பத்தில் சமீபத்திய கண்டுபிடிப்புகள்'],

  // ── Geography ──
  ['Geography', 'புவியியல்'],
  ['Geography of India', 'இந்திய புவியியல்'],
  ['Earth location', 'புவியின் அமைவிடம்'],
  ['Physical features', 'இயற்கை அமைப்புகள்'],
  ['Monsoon, rainfall, weather and climate', 'பருவமழை, மழைப்பொழிவு, வானிலை மற்றும் காலநிலை'],
  ['Water resources and rivers', 'நீர் வளங்கள் மற்றும் ஆறுகள்'],
  ['Soil, minerals and natural resources', 'மண், கனிமங்கள் மற்றும் இயற்கை வளங்கள்'],
  ['Forest and wildlife', 'காடுகள் மற்றும் வனவிலங்குகள்'],
  ['Agriculture pattern', 'வேளாண்மை முறை'],
  ['Transport and communication', 'போக்குவரத்து மற்றும் தகவல் தொடர்பு'],
  ['Population density and distribution in Tamil Nadu and India', 'தமிழ்நாடு மற்றும் இந்தியாவில் மக்கள் அடர்த்தி மற்றும் பரவல்'],
  ['Calamities and disaster management', 'பேரிடர்கள் மற்றும் பேரிடர் மேலாண்மை'],
  ['Environment and climate change', 'சுற்றுச்சூழல் மற்றும் காலநிலை மாற்றம்'],
  ['Geographical landmarks', 'புவியியல் அடையாளங்கள்'],

  // ── History and the national movement ──
  ['History, Culture of India, and Indian National Movement', 'இந்திய வரலாறு, பண்பாடு மற்றும் இந்திய தேசிய இயக்கம்'],
  ['History and Culture of India', 'இந்திய வரலாறு மற்றும் பண்பாடு'],
  ['Indian National Movement', 'இந்திய தேசிய இயக்கம்'],
  ['Indus Valley Civilization', 'சிந்து சமவெளி நாகரிகம்'],
  ['Guptas, Delhi Sultans, Mughals and Marathas', 'குப்தர்கள், டெல்லி சுல்தான்கள், முகலாயர்கள் மற்றும் மராத்தியர்கள்'],
  ['South Indian History', 'தென்னிந்திய வரலாறு'],
  ['National Renaissance', 'தேசிய மறுமலர்ச்சி'],
  ['Early uprising against British Rule', 'ஆங்கிலேய ஆட்சிக்கு எதிரான தொடக்கக் கால எழுச்சிகள்'],
  ['Indian National Congress', 'இந்திய தேசிய காங்கிரஸ்'],
  ['Emergence of leaders — Ambedkar, Bhagat Singh, Bharathiar, V.O.C., Periyar, Nehru, Tagore, Kamarajar, Gandhi', 'தலைவர்களின் எழுச்சி — அம்பேத்கர், பகத் சிங், பாரதியார், வ.உ.சி., பெரியார், நேரு, தாகூர், காமராஜர், காந்தி'],
  ['Different modes of agitation of Tamil Nadu and movements', 'தமிழ்நாட்டின் பல்வேறு போராட்ட முறைகள் மற்றும் இயக்கங்கள்'],
  ['Characteristics of Indian culture — unity in diversity, race, language, custom', 'இந்தியப் பண்பாட்டின் சிறப்பியல்புகள் — வேற்றுமையில் ஒற்றுமை, இனம், மொழி, வழக்கம்'],
  ['India as a secular state', 'மதச்சார்பற்ற நாடாக இந்தியா'],

  // ── Polity ──
  ['Indian Polity', 'இந்திய அரசியலமைப்பு'],
  ['Constitution of India — Preamble', 'இந்திய அரசியலமைப்பு — முகவுரை'],
  ['Salient features of the Constitution', 'அரசியலமைப்பின் முக்கிய அம்சங்கள்'],
  ['Union, State and Union Territory', 'ஒன்றியம், மாநிலம் மற்றும் யூனியன் பிரதேசம்'],
  ['Citizenship, Fundamental Rights and Fundamental Duties', 'குடியுரிமை, அடிப்படை உரிமைகள் மற்றும் அடிப்படைக் கடமைகள்'],
  ['Directive Principles of State Policy', 'அரசு நெறிமுறைக் கோட்பாடுகள்'],
  ['Union Executive and Union Legislature', 'ஒன்றிய நிர்வாகம் மற்றும் ஒன்றிய சட்டமன்றம்'],
  ['State Executive and State Legislature', 'மாநில நிர்வாகம் மற்றும் மாநில சட்டமன்றம்'],
  ['Local Governments and Panchayat Raj', 'உள்ளாட்சி அமைப்புகள் மற்றும் பஞ்சாயத்து ராஜ்'],
  ['Spirit of federalism — Centre–State relationships', 'கூட்டாட்சித் தத்துவம் — மத்திய–மாநில உறவுகள்'],
  ['Election', 'தேர்தல்'],
  ['Judiciary in India — Rule of Law', 'இந்திய நீதித்துறை — சட்டத்தின் ஆட்சி'],
  ['Corruption in public life — Lokpal and Lokayukta', 'பொது வாழ்வில் ஊழல் — லோக்பால் மற்றும் லோக் ஆயுக்தா'],
  ['Right to Information', 'தகவல் அறியும் உரிமை'],
  ['Empowerment of Women', 'பெண்கள் அதிகாரமளித்தல்'],
  ['Consumer Protection Forums', 'நுகர்வோர் பாதுகாப்பு மன்றங்கள்'],
  ['Human Rights Charter', 'மனித உரிமைகள் சாசனம்'],
  ['Political parties and political system in Tamil Nadu and India', 'தமிழ்நாடு மற்றும் இந்தியாவில் அரசியல் கட்சிகள் மற்றும் அரசியல் அமைப்பு'],

  // ── Economy and development administration ──
  ['Indian Economy and Development Administration in Tamil Nadu', 'இந்தியப் பொருளாதாரம் மற்றும் தமிழ்நாட்டில் வளர்ச்சி நிர்வாகம்'],
  ['Indian Economy', 'இந்தியப் பொருளாதாரம்'],
  ['Development Administration in Tamil Nadu', 'தமிழ்நாட்டில் வளர்ச்சி நிர்வாகம்'],
  ['Nature of Indian economy', 'இந்தியப் பொருளாதாரத்தின் இயல்பு'],
  ['Five-year plan models — an assessment', 'ஐந்தாண்டுத் திட்ட மாதிரிகள் — ஒரு மதிப்பீடு'],
  ['Planning Commission and NITI Aayog', 'திட்டக் குழு மற்றும் நிதி ஆயோக்'],
  ['Sources of revenue', 'வருவாய் ஆதாரங்கள்'],
  ['Reserve Bank of India', 'இந்திய ரிசர்வ் வங்கி'],
  ['Finance Commission', 'நிதிக் குழு'],
  ['Resource sharing between Union and State Governments', 'ஒன்றிய மற்றும் மாநில அரசுகளுக்கு இடையிலான வளப் பகிர்வு'],
  ['Goods and Services Tax', 'சரக்கு மற்றும் சேவை வரி'],
  ['Economic trends — employment generation', 'பொருளாதாரப் போக்குகள் — வேலைவாய்ப்பு உருவாக்கம்'],
  ['Land reforms and agriculture', 'நிலச் சீர்திருத்தங்கள் மற்றும் வேளாண்மை'],
  ['Application of science and technology in agriculture', 'வேளாண்மையில் அறிவியல் மற்றும் தொழில்நுட்பப் பயன்பாடு'],
  ['Industrial growth', 'தொழில் வளர்ச்சி'],
  ['Rural welfare oriented programmes', 'ஊரக நலத் திட்டங்கள்'],
  ['Social problems — population, education, health, employment, poverty', 'சமூகப் பிரச்சனைகள் — மக்கள் தொகை, கல்வி, சுகாதாரம், வேலைவாய்ப்பு, வறுமை'],
  ['Social justice and social harmony', 'சமூக நீதி மற்றும் சமூக நல்லிணக்கம்'],
  ['Education and health systems in Tamil Nadu', 'தமிழ்நாட்டில் கல்வி மற்றும் சுகாதார அமைப்புகள்'],
  ['Geography of Tamil Nadu and its impact on economic growth', 'தமிழ்நாட்டின் புவியியலும் பொருளாதார வளர்ச்சியில் அதன் தாக்கமும்'],
  ['Welfare schemes of Government', 'அரசின் நலத்திட்டங்கள்'],
  ['Current socio-economic issues', 'தற்போதைய சமூக-பொருளாதாரப் பிரச்சனைகள்'],

  // ── Tamil Nadu history ──
  ['History, Culture, Heritage, and Socio-Political Movements of Tamil Nadu', 'தமிழ்நாட்டின் வரலாறு, பண்பாடு, பாரம்பரியம் மற்றும் சமூக-அரசியல் இயக்கங்கள்'],
  ['History of Tamil Society and related archaeological discoveries', 'தமிழ்ச் சமூகத்தின் வரலாறு மற்றும் தொடர்புடைய தொல்லியல் கண்டுபிடிப்புகள்'],
  ['Tamil literature from Sangam age till contemporary times', 'சங்க காலம் முதல் தற்காலம் வரை தமிழ் இலக்கியம்'],
  ['Thirukkural — significance as a secular literature', 'திருக்குறள் — மதச்சார்பற்ற இலக்கியமாக அதன் சிறப்பு'],
  ['Thirukkural — relevance to everyday life and impact on humanity', 'திருக்குறள் — அன்றாட வாழ்வில் பொருத்தமும் மனிதகுலத்தின் மீதான தாக்கமும்'],
  ['Thirukkural and universal values', 'திருக்குறளும் உலகளாவிய விழுமியங்களும்'],
  ['Thirukkural — relevance to socio-politico-economic affairs', 'திருக்குறள் — சமூக-அரசியல்-பொருளாதார விவகாரங்களில் பொருத்தம்'],
  ['Philosophical content in Thirukkural', 'திருக்குறளில் உள்ள தத்துவக் கருத்துகள்'],
  ['Role of Tamil Nadu in the freedom struggle', 'விடுதலைப் போராட்டத்தில் தமிழ்நாட்டின் பங்கு'],
  ['Early agitations against British Rule', 'ஆங்கிலேய ஆட்சிக்கு எதிரான தொடக்கக் காலப் போராட்டங்கள்'],
  ['Role of women in the freedom struggle', 'விடுதலைப் போராட்டத்தில் பெண்களின் பங்கு'],
  ['Various social reformers', 'பல்வேறு சமூக சீர்திருத்தவாதிகள்'],
  ['Social reform movements', 'சமூக சீர்திருத்த இயக்கங்கள்'],
  ['Social transformation of Tamil Nadu', 'தமிழ்நாட்டின் சமூக மாற்றம்'],
  ['Thirukkural', 'திருக்குறள்'],

  // ── Aptitude and reasoning ──
  ['Simplification', 'சுருக்குதல்'],
  ['Percentage', 'சதவீதம்'],
  ['Highest Common Factor (HCF)', 'மீப்பெரு பொது வகுத்தி (மீ.பொ.வ)'],
  ['HCF', 'மீப்பெரு பொது வகுத்தி (மீ.பொ.வ)'],
  ['Lowest Common Multiple (LCM)', 'மீச்சிறு பொது மடங்கு (மீ.சி.ம)'],
  ['LCM', 'மீச்சிறு பொது மடங்கு (மீ.சி.ம)'],
  ['HCF and LCM', 'மீ.பொ.வ மற்றும் மீ.சி.ம'],
  ['Ratio and Proportion', 'விகிதம் மற்றும் விகிதாசாரம்'],
  ['Simple interest', 'தனிவட்டி'],
  ['Compound interest', 'கூட்டுவட்டி'],
  ['Area', 'பரப்பளவு'],
  ['Volume', 'கனஅளவு'],
  ['Area and Volume', 'பரப்பளவு மற்றும் கனஅளவு'],
  ['Time and Work', 'காலமும் வேலையும்'],
  ['Time and Distance', 'காலமும் தூரமும்'],
  ['Arithmetic and Geometric Progression', 'கூட்டுத் தொடர் மற்றும் பெருக்குத் தொடர்'],
  ['Fractions and Decimals', 'பின்னங்கள் மற்றும் தசமங்கள்'],
  ['Average', 'சராசரி'],
  ['Profit and Loss', 'லாபம் மற்றும் நஷ்டம்'],
  ['Number System', 'எண் முறை'],
  ['Logical reasoning', 'தருக்கக் காரணவியல்'],
  ['Puzzles', 'புதிர்கள்'],
  ['Dice', 'பகடை'],
  ['Visual reasoning', 'காட்சி காரணவியல்'],
  ['Alpha numeric reasoning', 'எழுத்து-எண் காரணவியல்'],
  ['Number series', 'எண் தொடர்'],
  ['Blood Relations', 'இரத்த உறவுகள்'],
  ['Coding and Decoding', 'குறியீடு மற்றும் குறிவிலக்கம்'],
  ['Direction Sense', 'திசை அறிவு'],
  ['Calendar', 'நாள்காட்டி'],
  ['Clocks', 'கடிகாரம்'],

  // ── General Tamil units and categories (English is the gloss) ──
  ['Grammar', 'இலக்கணம்'],
  ['Vocabulary', 'சொல்லகராதி'],
  ['Writing Skills', 'எழுதும் திறன்'],
  ['Technical Terms', 'கலைச் சொற்கள்'],
  ['Reading Comprehension', 'வாசித்தல் – புரிந்து கொள்ளும் திறன்'],
  ['Simple Translation', 'எளிய மொழி பெயர்ப்பு'],
  ['Literature, Tamil Scholars and Service to Tamil', 'இலக்கியம், தமிழ் அறிஞர்களும், தமிழ்த்தொண்டும்'],
  ['Orthography', 'எழுத்திலக்கணம்'],
  ['Morphology', 'சொல்லிலக்கணம்'],
  ['Syntax', 'தொடரிலக்கணம்'],
  ['Porul Grammar', 'பொருளிலக்கணம்'],
  ['Prosody', 'யாப்பிலக்கணம்'],
  ['Rhetoric', 'அணியிலக்கணம்'],
  ['Traditional Usage', 'மரபிலக்கணம்'],
  ['Prosody and Porul Grammar', 'யாப்பு மற்றும் பொருளிலக்கணம்'],
  ['Grammar Notes', 'இலக்கணக் குறிப்பு'],
  ['Simile', 'உவமை'],
  ['Splitting words', 'பிரித்து எழுதுதல்'],
  ['Joining words', 'சேர்த்து எழுதுதல்'],
  ['Sandhi errors', 'சந்திப்பிழை'],
  ['Short and long vowels', 'குறில் – நெடில் வேறுபாடு'],
  ['La, La and Zha distinction', 'லகர, ளகர, ழகர வேறுபாடு'],
  ['Na and Nna distinction', 'னகர, ணகர வேறுபாடு'],
  ['Ra and Rra distinction', 'ரகர, றகர வேறுபாடு'],
  ['Kindred letters', 'இனவெழுத்துகள் அறிதல்'],
  ['Demonstrative and interrogative letters', 'சுட்டு எழுத்துகள், வினா எழுத்துகள்'],
  ['Singular and plural', 'ஒருமை – பன்மை அறிதல்'],
  ['Root words', 'வேர்ச்சொல் அறிதல்'],
  ['Finite verbs and participles', 'வினைமுற்று, வினையெச்சம், பெயரெச்சம்'],
  ['Participial nouns', 'வினையாலணையும் பெயர்'],
  ['Loan words and Tamil words', 'அயற்சொல், தமிழ்ச்சொல்'],
  ['Antonyms', 'எதிர்ச்சொல்'],
  ['Spelling and consonant errors', 'எழுத்துப் பிழை, ஒற்றுப் பிழை அறிதல்'],
  ['Writing antonyms', 'எதிர்ச்சொல்லை எடுத்தெழுதுதல்'],
  ['One-letter words', 'ஓரெழுத்து ஒரு மொழி'],
  ['Synonyms', 'ஒருபொருள் தரும் பல சொற்கள்'],
  ['Odd word out', 'பொருந்தா சொல்லைக் கண்டறிதல்'],
  ['Alphabetical order', 'அகர வரிசைப்படி சொற்களைச் சீர்செய்தல்'],
  ['Redundant phrases', 'ஒருபொருள் பன்மொழி'],
  ['Words with two meanings', 'இருபொருள் குறிக்கும் சொற்கள்'],
  ['Spoken and written usage', 'பேச்சு வழக்கு, எழுத்து வழக்கு'],
  ['Colloquial place names', 'ஊர்ப் பெயர்களின் மரூஉ'],
  ['Error correction', 'பிழை திருத்துதல்'],
  ['Choosing the right word', 'பொருத்தமான சொல்லைத் தேர்வு செய்தல்'],
  ['Sentence formation', 'சொற்களை ஒழுங்குபடுத்திச் சொற்றொடர் அமைத்தல்'],
  ['Active and passive voice', 'தொடர் வகைகள் – செய்வினை, செயப்பாட்டு வினை'],
  ['Transitive and causative verbs', 'தன்வினை, பிறவினை'],
  ['Class usage', 'திணை மரபு'],
  ['Gender usage', 'பால் மரபு'],
  ['Tense usage', 'கால மரபு'],
  ['Names of the young', 'இளமைப் பெயர்'],
  ['Sounds of animals', 'ஒலி மரபு'],
  ['Verb usage', 'வினை மரபு'],
  ['Collective nouns', 'தொகை மரபு'],
  ['Punctuation', 'நிறுத்தற் குறியீடுகள்'],
  ['Science terms', 'அறிவியல் கலைச் சொற்கள்'],
  ['Education terms', 'கல்வி கலைச் சொற்கள்'],
  ['Medicine', 'மருத்துவம்'],
  ['Management', 'மேலாண்மை'],
  ['Law', 'சட்டம்'],
  ['Technology', 'தொழில்நுட்பம்'],
  ['Media', 'ஊடகம்'],
  ['Information Technology', 'தகவல் தொழில்நுட்பம்'],
  ['Passage questions', 'பத்தியிலிருந்து வினாக்களுக்கு விடை தேர்ந்தெடுத்தல்'],
  ['Newspapers and editorials', 'செய்தித்தாள், தலையங்கம்'],
  ['Headlines and government news', 'முகப்புச் செய்திகள், அரசு சார்ந்த செய்திகள்'],
  ['Essays', 'கட்டுரைகள்'],
  ['Meaning of similes', 'உவமைத் தொடரின் பொருளறிதல்'],
  ['Meaning of idioms', 'மரபுத் தொடரின் பொருளறிதல்'],
  ['Meaning of proverbs', 'பழமொழிகள் பொருளறிதல்'],
  ['Understanding documents', 'ஆவண உள்ளடக்கங்களைப் புரிந்து கொள்ளுதல்'],
  ['Tamil equivalents of English words', 'ஆங்கிலச் சொற்களுக்கு இணையான தமிழ்ச் சொற்கள்'],
  ['Translating English words', 'ஆங்கிலச் சொற்களை மொழிபெயர்த்தல்'],
  ['Document titles', 'ஆவணங்களின் தலைப்பு'],
  ['Files, letters and petitions', 'கோப்புகள், கடிதங்கள், மனுக்கள்'],
  ['Understanding translation', 'மொழிபெயர்ப்பு புரிந்து கொள்ளுதல்'],
  ['Thirukkural (twenty chapters only)', 'திருக்குறள் (இருபது அதிகாரங்கள் மட்டும்)'],
  ['Naladiyar, Nanmanikkadigai', 'நாலடியார், நான்மணிக்கடிகை'],
  ['Pazhamozhi Nanooru, Muthumozhikanchi', 'பழமொழி நானூறு, முதுமொழிக்காஞ்சி'],
  ['Thirikadugam, Inna Narpathu', 'திரிகடுகம், இன்னா நாற்பது'],
  ['Sirupanchamoolam, Elathi, Avvaiyar songs', 'சிறுபஞ்சமூலம், ஏலாதி, ஔவையார் பாடல்கள்'],
  ['Antiquity and greatness of Tamil', 'தமிழின் தொன்மை, சிறப்பு'],
  ['Dravidian languages', 'திராவிட மொழிகள்'],
  ['U.Ve. Saminatha Iyer, T.P. Meenakshi Sundaram', 'உ.வே.சாமிநாத ஐயர், தெ.பொ.மீனாட்சி சுந்தரம்'],
  ['C. Ilakkuvanar, Devaneya Pavanar', 'சி.இலக்குவனார், தேவநேய பாவாணர்'],
  ['G.U. Pope, Veeramamunivar', 'ஜி.யு.போப், வீரமாமுனிவர்'],
  ['Tamil scholars', 'தமிழ்ச் சான்றோர்கள்'],
  ['Grammar note', 'இலக்கணக் குறிப்பு'],
  ['Literature', 'இலக்கியம்'],
  ['Sandhi Grammar', 'புணர்ச்சி இலக்கணம்'],
  ['Error Correction', 'பிழை திருத்தம்'],
  ['Word Meanings', 'சொற்பொருள் அறிதல்'],
  ['Word Relationships', 'சொற்களின் பொருள் தொடர்புகள்'],
  ['Similes and Idioms', 'உவமை மற்றும் மரபுத்தொடர்கள்'],
  ['Proverbs', 'பழமொழிகள்'],
  ['Traditional Words', 'மரபுச் சொற்கள்'],
];

/** Letters of any script and Tamil's combining marks, lowercased — "HCF" and "hcf " are the same key. */
const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');

const TAMIL = /[஀-௿]/;
export const isTamil = (s: string) => TAMIL.test(s);

/** Tamil → English and English → Tamil, built once from the glossary and the syllabus. */
let toTa: Map<string, string> | null = null;
let toEn: Map<string, string> | null = null;

function add(en: string | undefined, ta: string | undefined) {
  if (!en || !ta || !toTa || !toEn) return;
  const e = en.trim();
  const t = ta.trim();
  if (!e || !t || isTamil(e) || !isTamil(t)) return;
  if (!toTa.has(key(e))) toTa.set(key(e), t);
  if (!toEn.has(key(t))) toEn.set(key(t), e);
}

function maps() {
  if (toTa && toEn) return { toTa, toEn };
  toTa = new Map();
  toEn = new Map();
  for (const group of TNPSC_GROUPS) {
    for (const stage of group.stages) {
      for (const sub of stage.subjects ?? []) add(sub.name, sub.name_ta);
      for (const { unit } of stageUnits(stage)) {
        add(unit.name, unit.name_ta);
        // "பிரித்து எழுதுதல் (Splitting words)" — a printed topic that carries its own gloss.
        for (const t of unitTopics(stage, unit)) {
          const m = t.name.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
          if (m && isTamil(m[1]) && !isTamil(m[2])) add(m[2], m[1]);
        }
      }
    }
  }
  GLOSSARY.forEach(([en, ta]) => add(en, ta));
  return { toTa, toEn };
}

/**
 * Names that belong to one of the two language papers, by key. A name shown with no paper beside it — a dashboard row,
 * a report line — is read in that paper's language: General Tamil's in Tamil only, General English's in English only.
 * A name both papers carry ("Grammar") reads as the Tamil paper's, the one a Tamil-speaking candidate sits. Generic
 * words the Tamil glossary also pairs ("Law", "Antonyms") are left out, so they stay bilingual elsewhere.
 */
const GENERIC = new Set(['medicine', 'management', 'law', 'technology', 'media', 'informationtechnology', 'punctuation', 'essays', 'antonyms', 'synonyms'].map(key));
let paperNames: { ta: Set<string>; en: Set<string> } | null = null;

function languagePapers() {
  if (paperNames) return paperNames;
  const ta = new Set<string>();
  const en = new Set<string>();
  const put = (set: Set<string>, ...names: Array<string | undefined>) => names.forEach(n => n && set.add(key(n)));
  for (const group of TNPSC_GROUPS) {
    for (const stage of group.stages) {
      for (const { unit, sectionName } of stageUnits(stage)) {
        const into = paperLangOf(sectionName) === 'ta' ? ta : paperLangOf(sectionName) === 'en' ? en : null;
        if (!into) continue;
        put(into, unit.name, unit.name_ta);
        for (const t of unitTopics(stage, unit)) {
          const m = t.name.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
          put(into, m ? m[1] : t.name, m ? m[2] : undefined);
        }
      }
    }
  }
  const start = GLOSSARY.findIndex(([e]) => e === 'Grammar');
  GLOSSARY.slice(start).forEach(([e, t]) => {
    if (!GENERIC.has(key(e))) put(ta, e, t);
  });
  put(ta, 'General Tamil', 'பொதுத் தமிழ்');
  put(en, 'General English', 'பொது ஆங்கிலம்');
  // Names shared by both papers read as the Tamil paper's.
  ta.forEach(k => en.delete(k));
  paperNames = { ta, en };
  return paperNames;
}

/** The language paper a bare name belongs to, or null for every other name. */
function nameLang(n: string): PaperLang {
  const { ta, en } = languagePapers();
  const parts = n.split(BILINGUAL_SEPARATOR).map(key);
  if (parts.some(p => ta.has(p))) return 'ta';
  if (parts.some(p => en.has(p))) return 'en';
  return null;
}

/**
 * Pairs the server sent (the official syllabus, built from the uploaded sheets). They win over the glossary above:
 * the sheet is where a name is decided, so what it says is what students see.
 */
const serverTa = new Map<string, string>();
const serverEn = new Map<string, string>();

export interface NamePair {
  name: string;
  name_ta?: string | null;
  name_en?: string | null;
}

export function registerServerNames(pairs: NamePair[]): void {
  for (const p of pairs) {
    const name = (p.name ?? '').trim();
    if (!name) continue;
    // Whichever side is Tamil: `name` may itself be the Tamil one, with `name_en` the English.
    const ta = (p.name_ta ?? '').trim() || (isTamil(name) ? name : '');
    const en = (p.name_en ?? '').trim() || (!isTamil(name) ? name : '');
    if (!ta || !en || !isTamil(ta) || isTamil(en)) continue;
    serverTa.set(key(en), ta);
    serverEn.set(key(ta), en);
    // The name as the question carries it, when it is worded a little differently from the paired English one.
    if (!isTamil(name)) serverTa.set(key(name), ta);
  }
}

/** One name with the pair the server sent beside it, under the field names that response uses. */
export function registerPair(name: unknown, en: unknown, ta: unknown): void {
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  const n = str(name);
  if (n) registerServerNames([{ name: n, name_en: str(en), name_ta: str(ta) }]);
}

/** Every unit, category and sub-category of a syllabus response, as pairs. */
export function syllabusNamePairs(syllabus: { units?: Array<NamePair & { categories?: Array<NamePair & { subcategories?: NamePair[] }> }> } | null | undefined): NamePair[] {
  const out: NamePair[] = [];
  for (const u of syllabus?.units ?? []) {
    out.push(u);
    for (const c of u.categories ?? []) {
      out.push(c);
      for (const s of c.subcategories ?? []) out.push(s);
    }
  }
  return out;
}

/** The other-language name for one name, or null when none is known. */
export function otherName(name: string | null | undefined): string | null {
  const n = (name ?? '').trim();
  if (!n) return null;
  const m = maps();
  return (isTamil(n) ? serverEn.get(key(n)) ?? m.toEn.get(key(n)) : serverTa.get(key(n)) ?? m.toTa.get(key(n))) ?? null;
}

/**
 * One name in both languages, English first: "Physics / இயற்பியல்", "Orthography / எழுத்திலக்கணம்".
 *
 * `other` is a name the caller already has in the other language (a server's `name_ta`, a unit's
 * `name_ta`); it wins over the glossary. A name that already holds both, or that no source knows, is
 * returned as it is. A printed topic with its gloss in brackets — "பிரித்து எழுதுதல் (Splitting words)" —
 * becomes "Splitting words / பிரித்து எழுதுதல்".
 */
export function bilingual(name: string | null | undefined, other?: string | null): string {
  const n = (name ?? '').trim();
  if (!n) return '';
  const own = nameLang(n);
  if (own) return inLanguage(n, own, other);
  if (n.includes(BILINGUAL_SEPARATOR)) return n;
  const glossed = n.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (glossed && isTamil(glossed[1]) && !isTamil(glossed[2])) return `${glossed[2].trim()}${BILINGUAL_SEPARATOR}${glossed[1].trim()}`;
  const o = (other ?? '').trim() || otherName(n);
  if (!o || key(o) === key(n)) return n;
  // Mixed already ("Thirukkural திருக்குறள்") — leave it.
  if (isTamil(n) === isTamil(o)) return n;
  return isTamil(n) ? `${o}${BILINGUAL_SEPARATOR}${n}` : `${n}${BILINGUAL_SEPARATOR}${o}`;
}

/** Words in a test title that are not names: levels and set kinds stay as they are. */
const NOT_A_NAME = /^(mixed|simple|medium|complex|full set|full mock|set \d+|part [a-z]|mock \d+|practice|test \d+)$/i;

/**
 * A test title with each name in it in both languages. Titles are built from names joined by ":" and "·"
 * ("இலக்கணம்: எழுத்திலக்கணம் · Mixed"), so each piece is looked up on its own — "Grammar / இலக்கணம்:
 * Orthography / எழுத்திலக்கணம் · Mixed". A title with no known name comes back unchanged.
 */
export function bilingualTitle(title: string | null | undefined): string {
  const t = (title ?? '').trim();
  if (!t || t.includes(BILINGUAL_SEPARATOR)) return t;
  return t
    .split(/(\s*[:·|]\s*|\s+[—–-]\s+)/)
    .map(part => (/^\s*[:·|]\s*$|^\s+[—–-]\s+$/.test(part) || NOT_A_NAME.test(part.trim()) ? part : bilingual(part)))
    .join('');
}

/** The language a paper is sat in: General Tamil reads in Tamil only, General English in English only; every other paper in both. */
export type PaperLang = 'ta' | 'en' | null;

export function paperLangOf(paperName: string | null | undefined): PaperLang {
  const n = (paperName ?? '').trim();
  if (/^general tamil\b/i.test(n) || n.startsWith('பொதுத் தமிழ்')) return 'ta';
  if (/^general english\b/i.test(n) || n.startsWith('பொது ஆங்கிலம்')) return 'en';
  return null;
}

/** One name in a single language. A name already in it is kept; otherwise its counterpart is used, and the name itself when none is known. */
export function inLanguage(name: string | null | undefined, lang: 'ta' | 'en', other?: string | null): string {
  const n = (name ?? '').trim();
  if (!n) return '';
  const wantTamil = lang === 'ta';
  if (n.includes(BILINGUAL_SEPARATOR)) {
    const hit = n.split(BILINGUAL_SEPARATOR).map(x => x.trim()).find(x => isTamil(x) === wantTamil);
    if (hit) return hit;
  }
  const glossed = n.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (glossed && isTamil(glossed[1]) && !isTamil(glossed[2])) return (wantTamil ? glossed[1] : glossed[2]).trim();
  if (isTamil(n) === wantTamil) return n;
  return (other ?? '').trim() || otherName(n) || n;
}

/** A name as a paper shows it: in the paper's own language, or in both for the other papers. */
export function paperName(name: string | null | undefined, lang: PaperLang, other?: string | null): string {
  return lang ? inLanguage(name, lang, other) : bilingual(name, other);
}

/** The language paper a unit id belongs to: 'g4-ta-…' is General Tamil (Tamil only), 'g4-en-…' General English (English only). */
export function unitIdLang(id: string | null | undefined): PaperLang {
  const m = (id ?? '').replace(/^unit:/, '').match(/^g\d+-(ta|en)-/);
  return m ? (m[1] as 'ta' | 'en') : null;
}

/**
 * A report node's name as its paper shows it: a unit of General Tamil or General English in that paper's language,
 * every other node in both, using the node's own other-language name when it carries one.
 */
export function nodeName(node: { name: string; nameLocal?: string | null; subjectId?: string | null; lang?: PaperLang }): string {
  const local = node.nameLocal?.trim();
  const other = local && isTamil(local) !== isTamil(node.name) ? local : null;
  const lang = node.lang ?? unitIdLang(node.subjectId);
  return lang ? inLanguage(node.name, lang, other) : bilingual(node.name, other);
}

/** A test title as a paper shows it. */
export function paperTitle(title: string | null | undefined, lang: PaperLang): string {
  if (!lang) return bilingualTitle(title);
  const t = (title ?? '').trim();
  if (!t) return '';
  return t
    .split(/(\s*[:·|]\s*|\s+[—–-]\s+)/)
    .map(part => (/^\s*[:·|]\s*$|^\s+[—–-]\s+$/.test(part) || NOT_A_NAME.test(part.trim()) ? part : inLanguage(part, lang)))
    .join('');
}

/** A paper's title as a student reads it: no exam prefix, and every name in it in both languages. */
export function studentTitle(title: string | null | undefined): string {
  return bilingualTitle(displayTitle(title ?? '') || '');
}
