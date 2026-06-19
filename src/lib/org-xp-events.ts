/**
 * Organization-specific XP events and point cost action keys.
 * Completely separate from personal XP_EVENTS in GamificationContext.
 * Values can be changed independently from personal workspace.
 */

/** XP amounts awarded for organization workspace actions */
export const ORG_XP_EVENTS = {
  // Student actions
  submit_assignment: 10,
  complete_quiz: 15,

  // Teacher actions
  create_assignment: 5,
  auto_grade_submission: 8,
  ai_feedback: 5,
  grade_submission_manual: 3,
  create_lesson_plan: 5,
  create_rubric: 5,
  generate_rubric_ai: 8,
  ai_suggest_questions: 5,
  auto_evaluate_attempt: 8,
  class_recommendations: 5,

  // Shared
  group_chat_message: 1,
} as const;

/** Point cost action keys for org AI features (mapped to point_costs table) */
export const ORG_POINT_COSTS = {
  auto_grade: 'org_auto_grade',
  ai_feedback: 'org_ai_feedback',
  lesson_plan_gen: 'org_lesson_plan_gen',
  ai_suggest_questions: 'org_ai_suggest_questions',
  rubric_ai_generate: 'org_rubric_ai_generate',
  auto_evaluate_attempt: 'org_auto_evaluate_attempt',
  class_recommendations: 'org_class_recommendations',
} as const;
