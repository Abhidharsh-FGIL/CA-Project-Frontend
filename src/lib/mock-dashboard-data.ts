// Centralized mock/fallback data for all personal workspace pages
// Used when real backend data is empty so new users see a rich preview

export const MOCK_DASHBOARD_STATS = {
  xp: 1250,
  streak: 7,
  avgScore: 72,
  documents: 12,
  chats: 34,
  aiPointsUsed: 38,
};

export const MOCK_RESUME_LEARNING = {
  title: 'Quadratic Equations',
  subject: 'Mathematics',
  mastery: 4,
  maxMastery: 10,
  lastAccessed: '2 hours ago',
  href: '/u/assessments',
};

export const MOCK_RECOMMENDATIONS = [
  { title: 'Revise Trigonometry', description: 'Your last score was 45%. Practice identities & formulas.', href: '/u/assessments', priority: 1, category: 'academic' },
  { title: 'Practice Physics MCQs', description: 'Mechanics concepts need reinforcement.', href: '/u/assessments', priority: 2, category: 'academic' },
  { title: 'Upload Biology Notes', description: 'No Biology documents found. Upload to unlock AI features.', href: '/u/library', priority: 3, category: 'skill' },
];

export const MOCK_SCORE_TREND = [
  { label: 'Week 1', score: 55 },
  { label: 'Week 2', score: 60 },
  { label: 'Week 3', score: 58 },
  { label: 'Week 4', score: 65 },
  { label: 'Week 5', score: 70 },
  { label: 'Week 6', score: 68 },
  { label: 'Week 7', score: 75 },
  { label: 'Week 8', score: 72 },
];

export const MOCK_RECENT_ACTIVITY = [
  { type: 'assessment', label: 'Completed Mathematics Assessment', time: '2 hours ago', icon: '📝' },
  { type: 'document', label: 'Uploaded Physics Chapter 5 Notes', time: '5 hours ago', icon: '📄' },
  { type: 'chat', label: 'AI Chat: Organic Chemistry Basics', time: 'Yesterday', icon: '💬' },
  { type: 'ebook', label: 'Generated eBook: Cell Biology', time: '2 days ago', icon: '📚' },
  { type: 'video', label: 'Created Video: Newton\'s Laws', time: '3 days ago', icon: '🎬' },
];

export const MOCK_QUICK_ACTIONS = [
  { label: 'Start Assessment', href: '/u/assessments', icon: 'PenTool' },
  { label: 'Upload Document', href: '/u/library', icon: 'Upload' },
  { label: 'Ask AI', href: '/u/ask', icon: 'MessageSquare' },
  { label: 'Explore Playground', href: '/u/playground', icon: 'Compass' },
];

// Recommendations page mock data
export const MOCK_WEEKLY_GOALS = [
  { title: 'Complete 2 Math assessments', category: 'academic', completed: true },
  { title: 'Upload Science notes', category: 'skill', completed: false },
  { title: 'Review weak topics', category: 'academic', completed: false },
];

export const MOCK_SCORED_RECOMMENDATIONS = [
  { title: 'Revise Trigonometry Identities', description: 'Your score dropped 15% — targeted practice recommended.', href: '/u/assessments', priority: 95, category: 'academic' },
  { title: 'Explore Data Science Career', description: 'Your Math & CS strengths align well with this path.', href: '/u/career', priority: 88, category: 'career' },
  { title: 'Practice Physics Numericals', description: 'Mechanics mastery is at 3/10 — solve 20 problems.', href: '/u/assessments', priority: 82, category: 'academic' },
  { title: 'Build Presentation Skills', description: 'Create a video project to practice communication.', href: '/u/video-studio', priority: 75, category: 'skill' },
  { title: 'Read Biology eBook', description: 'Generated eBook on Cell Biology awaiting review.', href: '/u/ebooks', priority: 70, category: 'academic' },
];

export const MOCK_INSIGHTS = [
  { id: 'mock-1', insight_type: 'weak_topic', title: '📉 Your Trigonometry scores are dropping', description: 'Based on your last 3 assessments, your accuracy in trigonometry fell to 45%. We recommend practicing identities and inverse functions this week.', priority: 1, dismissed: false, created_at: new Date().toISOString() },
  { id: 'mock-2', insight_type: 'retry_suggestion', title: '🔄 Retry Mechanics Assessment for a mastery boost', description: 'You scored 52% on your last Mechanics attempt. Students who retry within 3 days typically improve by 20%. Give it another shot!', priority: 2, dismissed: false, created_at: new Date().toISOString() },
  { id: 'mock-3', insight_type: 'difficulty_upgrade', title: '🚀 Ready for Hard mode in Algebra', description: 'You\'ve scored 85%+ consistently in Algebra for the past 2 weeks. Challenge yourself with Hard difficulty to keep growing.', priority: 3, dismissed: false, created_at: new Date().toISOString() },
  { id: 'mock-4', insight_type: 'content_recommendation', title: '📂 Upload Chemistry notes to unlock AI features', description: 'We noticed you have no Chemistry documents in your vault. Upload your notes to get AI summaries, flashcards, and targeted assessments.', priority: 4, dismissed: false, created_at: new Date().toISOString() },
  { id: 'mock-5', insight_type: 'improvement', title: '🎉 Grammar mastery jumped from 6 to 9!', description: 'Your English Grammar mastery improved significantly this month. Keep up the momentum — try advanced comprehension exercises next.', priority: 5, dismissed: false, created_at: new Date().toISOString() },
  { id: 'mock-6', insight_type: 'content_recommendation', title: '🧪 Try the AI Playground for Optics', description: 'Your Optics scores suggest gaps in reflection and refraction concepts. The AI Playground can help you explore these interactively.', priority: 6, dismissed: false, created_at: new Date().toISOString() },
];

export const MOCK_LEARNING_FOCUS = [
  { label: 'Academic Health', value: 72, color: 'hsl(var(--primary))' },
  { label: 'Skill Growth', value: 58, color: 'hsl(142 76% 36%)' },
  { label: 'Career Readiness', value: 45, color: 'hsl(280 65% 60%)' },
];

// Career Guidance mock data
export const MOCK_SUBJECT_STRENGTHS: [string, number][] = [
  ['Mathematics', 85],
  ['Physics', 78],
  ['Computer Science', 72],
  ['Chemistry', 65],
  ['English', 60],
];

export const MOCK_CAREER_PATHS = [
  { title: 'Software Engineer', description: 'Design and build software systems, apps, and platforms. Strong demand in AI, web, and mobile development.', compatibility: 92, skills: ['Programming', 'Data Structures', 'System Design', 'Problem Solving'], education: 'B.Tech Computer Science → M.Tech / MS' },
  { title: 'Data Scientist', description: 'Analyze data to uncover insights using ML, statistics, and visualization techniques.', compatibility: 87, skills: ['Statistics', 'Python', 'Machine Learning', 'Data Visualization'], education: 'B.Tech + Data Science specialization → MS' },
  { title: 'Mechanical Engineer', description: 'Design and develop mechanical systems, from engines to robotics.', compatibility: 80, skills: ['CAD/CAM', 'Thermodynamics', 'Material Science', 'Manufacturing'], education: 'B.Tech Mechanical Engineering → M.Tech' },
  { title: 'Research Scientist', description: 'Conduct cutting-edge research in physics, chemistry, or biology.', compatibility: 75, skills: ['Research Methodology', 'Scientific Writing', 'Lab Skills', 'Critical Analysis'], education: 'B.Sc/B.Tech → M.Sc → Ph.D.' },
  { title: 'Financial Analyst', description: 'Analyze financial data, market trends, and investment opportunities.', compatibility: 68, skills: ['Financial Modeling', 'Excel', 'Accounting', 'Risk Analysis'], education: 'B.Com/BBA → MBA Finance / CFA' },
];

export const MOCK_SKILL_GAPS = [
  { skill: 'Programming', current: 65, required: 85, career: 'Software Engineer' },
  { skill: 'Statistics', current: 50, required: 80, career: 'Data Scientist' },
  { skill: 'Scientific Writing', current: 40, required: 75, career: 'Research Scientist' },
  { skill: 'Financial Modeling', current: 30, required: 70, career: 'Financial Analyst' },
];

// Analytics / Learning Curve mock data
export const MOCK_ANALYTICS_SCORE_TREND = [
  { attempt: 1, score: 45 }, { attempt: 2, score: 52 }, { attempt: 3, score: 48 },
  { attempt: 4, score: 58 }, { attempt: 5, score: 62 }, { attempt: 6, score: 55 },
  { attempt: 7, score: 68 }, { attempt: 8, score: 72 }, { attempt: 9, score: 70 },
  { attempt: 10, score: 75 },
];

export const MOCK_TOPIC_MASTERY = [
  { id: '1', subject: 'Mathematics', topic: 'Algebra', mastery_level: 8 },
  { id: '2', subject: 'Mathematics', topic: 'Trigonometry', mastery_level: 4 },
  { id: '3', subject: 'Physics', topic: 'Mechanics', mastery_level: 7 },
  { id: '4', subject: 'Physics', topic: 'Optics', mastery_level: 3 },
  { id: '5', subject: 'Chemistry', topic: 'Organic Chemistry', mastery_level: 6 },
  { id: '6', subject: 'English', topic: 'Grammar', mastery_level: 9 },
];

export const MOCK_STUDY_TIME = [
  { subject: 'Mathematics', hours: 12 },
  { subject: 'Physics', hours: 8 },
  { subject: 'Chemistry', hours: 6 },
  { subject: 'English', hours: 4 },
  { subject: 'Biology', hours: 3 },
];

export const MOCK_MONTHLY_COMPARISON = {
  thisMonth: { assessments: 8, documents: 5, chats: 18, avgScore: 72 },
  lastMonth: { assessments: 5, documents: 3, chats: 12, avgScore: 65 },
};

export const MOCK_MILESTONES = [
  { title: 'First Assessment', description: 'Completed your first practice assessment', achieved: true, icon: '🎯' },
  { title: '7-Day Streak', description: 'Maintained a 7-day learning streak', achieved: true, icon: '🔥' },
  { title: '10 Documents', description: 'Uploaded 10 documents to your library', achieved: true, icon: '📚' },
  { title: '50 AI Chats', description: 'Had 50 conversations with AI assistant', achieved: false, icon: '💬' },
  { title: 'Score 90%+', description: 'Score above 90% in any assessment', achieved: false, icon: '⭐' },
];

export const MOCK_ENGAGEMENT = {
  activeDays: 18,
  consistencyScore: 60,
  totalStudyMinutes: 420,
  totalInteractions: 87,
  dailyActivity: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
    count: Math.floor(Math.random() * 8),
  })),
};

export const MOCK_PREDICTIONS = {
  predictions: [{ type: 'score_growth', trendDirection: 'up', currentAvg: 72, projectedNext: 78 }],
};

// Insight Feed mock articles
export const MOCK_INSIGHT_ARTICLES = [
  { id: 'feed-1', title: 'ISRO Successfully Launches Chandrayaan-4 Mission', summary: 'India\'s space agency achieves another milestone with the successful launch of Chandrayaan-4, aimed at studying the lunar south pole in greater detail.', category: 'science_tech', bookmarked: false, image_query: 'ISRO rocket launch', source_url: null, language: 'english', created_at: new Date().toISOString(), metadata: {} },
  { id: 'feed-2', title: 'New NCERT Guidelines for AI Integration in Schools', summary: 'NCERT releases comprehensive guidelines for integrating artificial intelligence concepts into school curricula from Class 6 onwards.', category: 'education', bookmarked: false, image_query: 'AI education classroom', source_url: null, language: 'english', created_at: new Date().toISOString(), metadata: {} },
  { id: 'feed-3', title: 'Nobel Prize in Physics 2025: Quantum Computing Breakthrough', summary: 'This year\'s Nobel Prize recognizes pioneering work in fault-tolerant quantum computing that could revolutionize drug discovery and cryptography.', category: 'science_tech', bookmarked: true, image_query: 'quantum computing', source_url: null, language: 'english', created_at: new Date().toISOString(), metadata: {} },
  { id: 'feed-4', title: 'India\'s GDP Growth Reaches 7.2% in Q3', summary: 'Strong manufacturing and services sectors drive India\'s GDP growth, making it the fastest-growing major economy globally.', category: 'current_affairs', bookmarked: false, image_query: 'India economy growth', source_url: null, language: 'english', created_at: new Date().toISOString(), metadata: {} },
  { id: 'feed-5', title: 'Climate Change: Arctic Ice at Record Low', summary: 'Scientists report Arctic sea ice has reached its lowest extent on record, raising concerns about accelerated global warming effects.', category: 'environment', bookmarked: false, image_query: 'arctic ice melting', source_url: null, language: 'english', created_at: new Date().toISOString(), metadata: {} },
  { id: 'feed-6', title: 'JEE Advanced 2026: Key Changes Announced', summary: 'NTA announces significant changes to JEE Advanced pattern including adaptive testing and expanded syllabus coverage for engineering aspirants.', category: 'exam_updates', bookmarked: false, image_query: 'JEE exam preparation', source_url: null, language: 'english', created_at: new Date().toISOString(), metadata: {} },
];

// Personal Insights feed — learning-personalized articles
export const MOCK_PERSONAL_FEED = [
  { id: 'pf-1', title: 'Your Trigonometry Accuracy Dropped to 45% — Here\'s a Recovery Plan', summary: 'Based on your last 3 assessments, your trigonometry scores have declined. We\'ve built a targeted revision plan covering identities, ratios, and application problems.', category: 'revision', bookmarked: false, image_query: 'trigonometry revision', source_url: null, language: 'english', created_at: new Date().toISOString(), metadata: {} },
  { id: 'pf-2', title: '5 Must-Know Formulas for Quadratic Equations', summary: 'These high-yield formulas appear in 80% of exam questions. Master them to boost your algebra scores quickly.', category: 'study_tip', bookmarked: false, image_query: 'quadratic equations formulas', source_url: null, language: 'english', created_at: new Date().toISOString(), metadata: {} },
  { id: 'pf-3', title: 'Mechanics Mastery: You\'re 3 Problems Away from Level 8', summary: 'Your Newton\'s Laws accuracy is at 92%. Solve 3 more advanced problems to unlock Level 8 mastery and earn the Physics Pro badge.', category: 'practice', bookmarked: false, image_query: 'physics mechanics practice', source_url: null, language: 'english', created_at: new Date().toISOString(), metadata: {} },
  { id: 'pf-4', title: 'Organic Chemistry Reaction Maps — Visual Guide', summary: 'A curated visual flowchart of key organic reactions. Great for quick revision before exams.', category: 'resource', bookmarked: true, image_query: 'organic chemistry reaction map', source_url: null, language: 'english', created_at: new Date().toISOString(), metadata: {} },
  { id: 'pf-5', title: 'Why Spaced Repetition Works: Boost Your Physics Scores', summary: 'Evidence shows spaced repetition can improve retention by 40%. Here\'s how to apply it to your weakest physics topics.', category: 'study_tip', bookmarked: false, image_query: 'spaced repetition study', source_url: null, language: 'english', created_at: new Date().toISOString(), metadata: {} },
  { id: 'pf-6', title: 'Grammar Mastery Hit Level 9 — Try Advanced Comprehension Next', summary: 'Congratulations! Your grammar accuracy is now at 95%. We recommend moving to advanced reading comprehension to round out your English skills.', category: 'progress', bookmarked: false, image_query: 'english grammar mastery', source_url: null, language: 'english', created_at: new Date().toISOString(), metadata: {} },
];

// Video Studio mock history
export const MOCK_VIDEO_PROJECTS = [
  { id: 'v1', topic: 'Newton\'s Laws of Motion', created_at: '2025-02-10T10:30:00Z', scenes: 6, style: 'modern' },
  { id: 'v2', topic: 'Photosynthesis Process', created_at: '2025-02-08T14:00:00Z', scenes: 5, style: 'whiteboard' },
  { id: 'v3', topic: 'Introduction to Calculus', created_at: '2025-02-05T09:15:00Z', scenes: 8, style: 'modern' },
  { id: 'v4', topic: 'World War II Summary', created_at: '2025-01-28T11:00:00Z', scenes: 7, style: 'cinematic' },
];
