import {
  MessageSquare, FolderOpen, FileText, Video, ScanLine, PenTool,
  Map, Gamepad2, Sparkles, Compass, BarChart3, Lightbulb,
  ClipboardList, TrendingUp, ClipboardCheck, Trophy, Notebook,
} from 'lucide-react';

export type RoleScope = 'student' | 'teacher' | 'both';

export interface SubFeature {
  key: string;
  label: string;
  /** Short one-line description shown in the admin UI */
  desc: string;
}

export interface ModuleDefinition {
  key: string;
  label: string;
  icon: React.ElementType;
  availableFor: RoleScope;
  comingSoon?: boolean;
  features: SubFeature[];
}

export const ROLE_OPTIONS: Record<RoleScope, { value: string; label: string }[]> = {
  student: [
    { value: 'student', label: 'Students Only' },
  ],
  teacher: [
    { value: 'teacher', label: 'Teachers Only' },
  ],
  both: [
    { value: 'both', label: 'Both Roles' },
    { value: 'teacher', label: 'Teachers Only' },
    { value: 'student', label: 'Students Only' },
  ],
};

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  // ─── Available to Both Students & Teachers ───
  {
    key: 'ai_assistant', label: 'AI Assistant', icon: MessageSquare,
    availableFor: 'both',
    features: [
      { key: 'mind_map', label: 'Mind Map', desc: 'Visual concept maps generated from AI responses' },
      { key: 'video_references', label: 'Video References', desc: 'Curated YouTube videos related to the topic' },
      { key: 'infographic', label: 'Infographic', desc: 'Visual summary cards of AI explanations' },
      { key: 'practice_exercises', label: 'Practice Exercises', desc: 'MCQ, True/False & short-answer drills from chat' },
      { key: 'follow_up', label: 'Follow-up Questions', desc: 'Suggested deeper questions after each response' },
      { key: 'next_steps', label: 'Next Steps', desc: 'Recommended learning path after a topic' },
      { key: 'audio_qa', label: 'Audio Q&A', desc: 'Voice-based question & audio response mode' },
      { key: 'document_export', label: 'Document Export', desc: 'Download chat conversation as DOCX file' },
      { key: 'chat_settings', label: 'Chat Settings', desc: 'Customize AI behaviour, board & grade context' },
    ],
  },
  {
    key: 'knowledge_vault', label: 'Knowledge Vault', icon: FolderOpen,
    availableFor: 'both',
    features: [
      { key: 'download', label: 'Download', desc: 'Download stored files from the vault' },
      { key: 'batch_operations', label: 'Batch Operations', desc: 'Select & act on multiple files at once' },
      { key: 'folder_organization', label: 'Folder Organization', desc: 'Create & manage folders with color labels' },
    ],
  },
  {
    key: 'ebook_creator', label: 'eBook Creator', icon: FileText,
    availableFor: 'both',
    features: [
      { key: 'language_selection', label: 'Language Selection', desc: 'Generate eBooks in different languages' },
      { key: 'ai_chapters', label: 'AI Suggested Chapters', desc: 'AI auto-generates chapter outline' },
      { key: 'assessment_config', label: 'Assessment Configuration', desc: 'Add quizzes & exercises to eBook chapters' },
      { key: 'audio', label: 'Audio', desc: 'Convert eBooks into audio narration' },
      { key: 'pdf_export', label: 'PDF Export', desc: 'Download generated eBooks as PDF' },
      { key: 'docx_export', label: 'DOCX Export', desc: 'Download generated eBooks as Word document' },
    ],
  },
  {
    key: 'video_studio', label: 'Video Studio', icon: Video,
    availableFor: 'both',
    comingSoon: true,
    features: [
      { key: 'script_generation', label: 'Script Generation', desc: 'AI-generated video scripts from topics' },
      { key: 'storyboard', label: 'Storyboard', desc: 'Visual scene-by-scene planning for videos' },
      { key: 'video_references', label: 'Video References', desc: 'Related videos as source material' },
      { key: 'download', label: 'Download', desc: 'Export generated video projects' },
    ],
  },
  {
    key: 'extract_ocr', label: 'Extract OCR', icon: ScanLine,
    availableFor: 'both',
    features: [
      { key: 'pdf_support', label: 'PDF Support', desc: 'Extract text from uploaded PDF files' },
      { key: 'multi_page', label: 'Multi-page', desc: 'Process documents with multiple pages' },
      { key: 'text_editor', label: 'Text Editor', desc: 'Manually edit & correct extracted text' },
    ],
  },
  {
    key: 'past_papers', label: 'Past Papers', icon: Map,
    availableFor: 'both',
    features: [
      { key: 'download', label: 'Download', desc: 'Save past papers for offline access' },
    ],
  },
  {
    key: 'playground', label: 'Playground', icon: Gamepad2,
    availableFor: 'both',
    features: [
      { key: 'match_mania', label: 'Match Mania', desc: 'Flip-card game to match terms & definitions' },
      { key: 'swipe_sort', label: 'Swipe & Sort', desc: 'Rapid True/False swipe challenge' },
      { key: 'speed_blitz', label: 'Speed Blitz', desc: 'Timed MCQ speed round' },
      { key: 'concept_connect', label: 'Concept Connect', desc: 'Link related terms & definitions' },
      { key: 'roleplay', label: 'RolePlay', desc: 'Immersive AI character-based learning' },
      { key: 'imagine', label: 'Imagine', desc: 'Creative open-ended prompt exploration' },
    ],
  },
  {
    key: 'recommendations', label: 'Recommendations', icon: Sparkles,
    availableFor: 'both',
    features: [
      { key: 'weak_topics', label: 'Weak Topics', desc: 'Highlights areas needing improvement' },
      { key: 'retry_suggestions', label: 'Retry Suggestions', desc: 'Suggests re-attempting failed assessments' },
      { key: 'difficulty_upgrade', label: 'Difficulty Upgrade', desc: 'Recommends harder challenges when ready' },
      { key: 'content_recommendations', label: 'Content Recommendations', desc: 'Suggests related learning materials' },
    ],
  },
  {
    key: 'career_guidance', label: 'Career Guidance', icon: Compass,
    availableFor: 'both',
    features: [
      { key: 'career_paths', label: 'Career Paths', desc: 'AI-suggested career options based on profile' },
      { key: 'interest_assessment', label: 'Interest Assessment', desc: 'Define interests, skills & preferred streams' },
      { key: 'compatibility_analysis', label: 'Compatibility Analysis', desc: 'Career-skill matching with compatibility %' },
    ],
  },
  {
    key: 'personal_analytics', label: 'Analytics', icon: BarChart3,
    availableFor: 'both',
    features: [
      { key: 'engagement_heatmap', label: 'Engagement Heatmap', desc: 'Daily/weekly learning activity patterns' },
      { key: 'strength_weakness', label: 'Strength/Weakness', desc: 'Topic-wise mastery breakdown' },
      { key: 'study_time', label: 'Study Time', desc: 'Track total time spent learning' },
    ],
  },
  {
    key: 'personal_insights', label: 'Insights', icon: Lightbulb,
    availableFor: 'both',
    features: [
      { key: 'insight_feed', label: 'Insight Feed', desc: 'Personalised learning tips & observations' },
      { key: 'dismissible_insights', label: 'Dismissible Insights', desc: 'Hide insights that are no longer relevant' },
    ],
  },

  {
    key: 'assessment_hub', label: 'Assessment Hub', icon: PenTool,
    availableFor: 'both',
    features: [
      { key: 'mcq', label: 'MCQ', desc: 'Multiple-choice question assessments' },
      { key: 'fill_in_blank', label: 'Fill-in-the-Blank', desc: 'Complete the missing word/phrase' },
      { key: 'short_answer', label: 'Short Answer', desc: 'Brief written response questions' },
      { key: 'long_answer', label: 'Long Answer', desc: 'Detailed essay-style questions' },
      { key: 'true_false', label: 'True/False', desc: 'Statement verification questions' },
      { key: 'matching', label: 'Matching', desc: 'Pair related items together' },
      { key: 'timer', label: 'Timer', desc: 'Time-limited assessment mode' },
      { key: 'insights', label: 'Insights', desc: 'Performance analytics after assessment' },
    ],
  },

  // ─── Student Only ───
  {
    key: 'achievements', label: 'Achievements & Gamification', icon: Trophy,
    availableFor: 'student',
    features: [
      { key: 'badges', label: 'Badges', desc: 'Unlock badges for learning milestones' },
      { key: 'leaderboard', label: 'Leaderboard', desc: 'Class & org-wide competitive rankings' },
      { key: 'daily_challenge', label: 'Daily Challenge', desc: 'Auto-generated daily quiz for bonus XP' },
    ],
  },

  // ─── Teacher Only ───
  {
    key: 'lesson_plans', label: 'Lesson Plans', icon: Notebook,
    availableFor: 'teacher',
    features: [
      { key: 'ai_generation', label: 'AI Generation', desc: 'Auto-generate lesson plans with AI' },
      { key: 'differentiation', label: 'Differentiation', desc: 'Easy/standard/advanced level variants' },
      { key: 'pdf_export', label: 'PDF Export', desc: 'Download lesson plans as PDF' },
    ],
  },
  {
    key: 'rubrics', label: 'Rubrics', icon: ClipboardList,
    availableFor: 'teacher',
    features: [
      { key: 'ai_generation', label: 'AI Generation', desc: 'Auto-generate rubric criteria with AI' },
      { key: 'custom_criteria', label: 'Custom Criteria', desc: 'Manually define criteria & scoring levels' },
    ],
  },
  {
    key: 'teacher_insights', label: 'Teacher Insights', icon: TrendingUp,
    availableFor: 'teacher',
    features: [
      { key: 'student_reports', label: 'Student Reports', desc: 'Individual student performance summaries' },
      { key: 'trend_analysis', label: 'Trend Analysis', desc: 'Class-wide performance trends over time' },
    ],
  },
  {
    key: 'evaluation_hub', label: 'Evaluation Hub', icon: ClipboardCheck,
    availableFor: 'teacher',
    features: [
      { key: 'practice_mode', label: 'Practice Mode', desc: 'Allow students to practice assessments' },
      { key: 'negative_marking', label: 'Negative Marking', desc: 'Deduct marks for incorrect answers' },
      { key: 'student_distribution', label: 'Student Distribution', desc: 'Assign papers to students or classes' },
      { key: 'reports', label: 'Reports', desc: 'Evaluation results & analytics reports' },
    ],
  },
];

/** Group modules by their role scope for sectioned rendering */
export const MODULE_GROUPS: { label: string; scope: RoleScope; modules: ModuleDefinition[] }[] = [
  { label: 'Available to Both', scope: 'both', modules: MODULE_DEFINITIONS.filter(m => m.availableFor === 'both') },
  { label: 'Student Only', scope: 'student', modules: MODULE_DEFINITIONS.filter(m => m.availableFor === 'student') },
  { label: 'Teacher Only', scope: 'teacher', modules: MODULE_DEFINITIONS.filter(m => m.availableFor === 'teacher') },
];
