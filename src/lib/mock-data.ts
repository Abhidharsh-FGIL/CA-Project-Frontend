import type {
  User, Class, Assignment, Rubric, Submission, LessonPlan,
  Announcement, Topic, ClassStudent, Achievement, ClassInsight, StudentProgress
} from '@/types';

// Mock Users
export const mockTeacher: User = {
  id: 'teacher-1',
  email: 'priya.sharma@eduverse.school',
  name: 'Priya Sharma',
  role: 'teacher',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya',
  schoolName: 'Delhi Public School',
  teacherId: 'DPS-2024-001',
};

export const mockStudents: User[] = [
  {
    id: 'student-1',
    email: 'rahul.kumar@student.eduverse.school',
    name: 'Rahul Kumar',
    role: 'student',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=rahul',
    grade: 1,
    personaBand: 'A',
    xp: 450,
    streak: 5,
    classIds: ['class-1'],
    achievements: [
      { id: 'ach-1', title: 'First Star!', description: 'Completed your first assignment', icon: '⭐', earnedAt: '2024-01-15', xpReward: 50 },
    ],
  },
  {
    id: 'student-2',
    email: 'ananya.singh@student.eduverse.school',
    name: 'Ananya Singh',
    role: 'student',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ananya',
    grade: 4,
    personaBand: 'B',
    xp: 1250,
    streak: 12,
    classIds: ['class-1', 'class-2'],
    achievements: [
      { id: 'ach-1', title: 'Quest Master', description: 'Completed 10 quests', icon: '🏆', earnedAt: '2024-01-20', xpReward: 100 },
      { id: 'ach-2', title: 'Week Warrior', description: '7 day streak', icon: '🔥', earnedAt: '2024-01-22', xpReward: 75 },
    ],
  },
  {
    id: 'student-3',
    email: 'vikram.patel@student.eduverse.school',
    name: 'Vikram Patel',
    role: 'student',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=vikram',
    grade: 7,
    personaBand: 'C',
    xp: 2800,
    streak: 8,
    classIds: ['class-1'],
    achievements: [
      { id: 'ach-1', title: 'XP Hunter', description: 'Earned 2000 XP', icon: '💎', earnedAt: '2024-01-25', xpReward: 150 },
    ],
  },
  {
    id: 'student-4',
    email: 'meera.iyer@student.eduverse.school',
    name: 'Meera Iyer',
    role: 'student',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=meera',
    grade: 10,
    personaBand: 'D',
    xp: 5600,
    streak: 21,
    classIds: ['class-1', 'class-2'],
    achievements: [
      { id: 'ach-1', title: 'Mastery Milestone', description: 'Achieved 80% mastery in 3 skills', icon: '📈', earnedAt: '2024-01-28', xpReward: 200 },
    ],
  },
  {
    id: 'student-5',
    email: 'arjun.menon@student.eduverse.school',
    name: 'Arjun Menon',
    role: 'student',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=arjun',
    grade: 12,
    personaBand: 'E',
    xp: 8200,
    streak: 30,
    classIds: ['class-1', 'class-2', 'class-3'],
    achievements: [
      { id: 'ach-1', title: 'Scholar Elite', description: 'Top performer in class', icon: '🎓', earnedAt: '2024-01-30', xpReward: 300 },
      { id: 'ach-2', title: 'Consistency King', description: '30 day streak', icon: '👑', earnedAt: '2024-02-01', xpReward: 250 },
    ],
  },
];

// Mock Classes
export const mockClasses: Class[] = [
  {
    id: 'class-1',
    name: 'Mathematics - Algebra',
    board: 'CBSE',
    grade: 10,
    subject: 'Mathematics',
    section: 'A',
    joinCode: 'MATH10A',
    teacherId: 'teacher-1',
    teacherName: 'Priya Sharma',
    studentCount: 32,
    color: '#6366f1',
    createdAt: '2024-01-01',
  },
  {
    id: 'class-2',
    name: 'Physics - Mechanics',
    board: 'CBSE',
    grade: 11,
    subject: 'Physics',
    section: 'B',
    joinCode: 'PHY11B',
    teacherId: 'teacher-1',
    teacherName: 'Priya Sharma',
    studentCount: 28,
    color: '#14b8a6',
    createdAt: '2024-01-05',
  },
  {
    id: 'class-3',
    name: 'English Literature',
    board: 'ICSE',
    grade: 9,
    subject: 'English',
    section: 'A',
    joinCode: 'ENG9A',
    teacherId: 'teacher-1',
    teacherName: 'Priya Sharma',
    studentCount: 35,
    color: '#f59e0b',
    createdAt: '2024-01-10',
  },
];

export const mockClassStudents: ClassStudent[] = [
  { id: 'cs-1', userId: 'student-4', name: 'Meera Iyer', email: 'meera.iyer@student.eduverse.school', rollNo: '01', joinedAt: '2024-01-02', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=meera' },
  { id: 'cs-2', userId: 'student-5', name: 'Arjun Menon', email: 'arjun.menon@student.eduverse.school', rollNo: '02', joinedAt: '2024-01-02', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=arjun' },
  { id: 'cs-3', userId: 'student-6', name: 'Kavya Reddy', email: 'kavya.reddy@student.eduverse.school', rollNo: '03', joinedAt: '2024-01-03', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=kavya' },
  { id: 'cs-4', userId: 'student-7', name: 'Rohan Gupta', email: 'rohan.gupta@student.eduverse.school', rollNo: '04', joinedAt: '2024-01-03', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=rohan' },
  { id: 'cs-5', userId: 'student-8', name: 'Shreya Joshi', email: 'shreya.joshi@student.eduverse.school', rollNo: '05', joinedAt: '2024-01-04', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=shreya' },
];

// Mock Topics
export const mockTopics: Topic[] = [
  { id: 'topic-1', classId: 'class-1', name: 'Week 1: Linear Equations', order: 1 },
  { id: 'topic-2', classId: 'class-1', name: 'Week 2: Quadratic Equations', order: 2 },
  { id: 'topic-3', classId: 'class-1', name: 'Week 3: Polynomials', order: 3 },
];

// Mock Rubric
export const mockRubric: Rubric = {
  id: 'rubric-1',
  title: 'Algebra Problem Solving Rubric',
  board: 'CBSE',
  grade: 10,
  subject: 'Mathematics',
  criteria: [
    {
      id: 'crit-1',
      title: 'Mathematical Reasoning',
      weight: 30,
      linkedOutcome: 'Apply logical reasoning to solve problems',
      levels: [
        { id: 'level-1-1', title: 'Exemplary', points: 4, descriptor: 'Demonstrates exceptional mathematical reasoning with clear logical steps and innovative approaches' },
        { id: 'level-1-2', title: 'Proficient', points: 3, descriptor: 'Shows solid mathematical reasoning with mostly clear logical progression' },
        { id: 'level-1-3', title: 'Developing', points: 2, descriptor: 'Demonstrates basic reasoning but with some gaps in logic' },
        { id: 'level-1-4', title: 'Beginning', points: 1, descriptor: 'Limited reasoning shown, significant gaps in mathematical logic' },
      ],
    },
    {
      id: 'crit-2',
      title: 'Procedural Accuracy',
      weight: 25,
      linkedOutcome: 'Execute mathematical procedures correctly',
      levels: [
        { id: 'level-2-1', title: 'Exemplary', points: 4, descriptor: 'All calculations are accurate with proper notation and units' },
        { id: 'level-2-2', title: 'Proficient', points: 3, descriptor: 'Minor calculation errors that do not affect the final answer' },
        { id: 'level-2-3', title: 'Developing', points: 2, descriptor: 'Several calculation errors affecting partial results' },
        { id: 'level-2-4', title: 'Beginning', points: 1, descriptor: 'Significant calculation errors throughout' },
      ],
    },
    {
      id: 'crit-3',
      title: 'Problem Interpretation',
      weight: 25,
      linkedOutcome: 'Interpret and analyze mathematical problems',
      levels: [
        { id: 'level-3-1', title: 'Exemplary', points: 4, descriptor: 'Correctly identifies all variables and relationships in the problem' },
        { id: 'level-3-2', title: 'Proficient', points: 3, descriptor: 'Identifies most variables and key relationships' },
        { id: 'level-3-3', title: 'Developing', points: 2, descriptor: 'Identifies some variables but misses key relationships' },
        { id: 'level-3-4', title: 'Beginning', points: 1, descriptor: 'Struggles to identify variables and relationships' },
      ],
    },
    {
      id: 'crit-4',
      title: 'Communication',
      weight: 20,
      linkedOutcome: 'Communicate mathematical ideas clearly',
      levels: [
        { id: 'level-4-1', title: 'Exemplary', points: 4, descriptor: 'Work is exceptionally organized with clear explanations' },
        { id: 'level-4-2', title: 'Proficient', points: 3, descriptor: 'Work is organized and explanations are adequate' },
        { id: 'level-4-3', title: 'Developing', points: 2, descriptor: 'Some organization but explanations need improvement' },
        { id: 'level-4-4', title: 'Beginning', points: 1, descriptor: 'Disorganized with minimal or no explanations' },
      ],
    },
  ],
  createdAt: '2024-01-10',
  updatedAt: '2024-01-15',
};

export const mockRubrics: Rubric[] = [
  mockRubric,
  {
    id: 'rubric-2',
    title: 'Essay Writing Rubric',
    board: 'ICSE',
    grade: 9,
    subject: 'English',
    criteria: [
      {
        id: 'crit-e1',
        title: 'Thesis & Argument',
        weight: 30,
        levels: [
          { id: 'level-e1-1', title: 'Exemplary', points: 4, descriptor: 'Clear, compelling thesis with strong supporting arguments' },
          { id: 'level-e1-2', title: 'Proficient', points: 3, descriptor: 'Clear thesis with adequate support' },
          { id: 'level-e1-3', title: 'Developing', points: 2, descriptor: 'Thesis present but weak argumentation' },
          { id: 'level-e1-4', title: 'Beginning', points: 1, descriptor: 'Unclear or missing thesis' },
        ],
      },
    ],
    createdAt: '2024-01-12',
    updatedAt: '2024-01-12',
  },
];

// Shared assignment store - simulates published assignments visible to students
let publishedAssignments: Assignment[] = [
  {
    id: 'assignment-1',
    classId: 'class-1',
    topicId: 'topic-1',
    title: 'Linear Equations Practice Set',
    instructions: 'Solve the following 10 linear equations. Show all your working steps clearly.',
    dueDate: '2024-02-15',
    points: 100,
    rubricId: 'rubric-1',
    attachments: [{ id: 'att-1', name: 'Problem Set.pdf', url: '/files/problem-set.pdf', type: 'file' }],
    status: 'published',
    createdAt: '2024-02-01',
  },
  {
    id: 'assignment-2',
    classId: 'class-1',
    topicId: 'topic-2',
    title: 'Quadratic Equations: Word Problems',
    instructions: 'Solve 5 word problems involving quadratic equations.',
    dueDate: '2024-02-20',
    points: 80,
    rubricId: 'rubric-1',
    attachments: [],
    status: 'published',
    createdAt: '2024-02-10',
  },
];

export const mockAssignments = publishedAssignments;

export const addPublishedAssignment = (assignment: Assignment) => {
  publishedAssignments.push(assignment);
};

export const getPublishedAssignments = () => publishedAssignments.filter(a => a.status === 'published');

// Mock Submissions
export const mockSubmissions: Submission[] = [
  {
    id: 'sub-1',
    assignmentId: 'assignment-1',
    studentId: 'student-4',
    studentName: 'Meera Iyer',
    studentAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=meera',
    submittedAt: '2024-02-14T10:30:00',
    status: 'graded',
    files: [{ id: 'file-1', name: 'meera_linear_equations.pdf', url: '/submissions/meera.pdf', type: 'file' }],
    textResponse: 'I have attached my solutions. I found question 7 challenging but worked through it step by step.',
    grade: {
      totalScore: 85,
      maxScore: 100,
      criterionScores: [
        { criterionId: 'crit-1', selectedLevelId: 'level-1-2', points: 3, comment: 'Good reasoning, but could be more detailed' },
        { criterionId: 'crit-2', selectedLevelId: 'level-2-1', points: 4, comment: 'Excellent accuracy!' },
        { criterionId: 'crit-3', selectedLevelId: 'level-3-2', points: 3, comment: 'Well interpreted' },
        { criterionId: 'crit-4', selectedLevelId: 'level-4-2', points: 3, comment: 'Clear presentation' },
      ],
      overallComment: 'Great work, Meera! Focus on explaining your reasoning more thoroughly.',
      xpAwarded: 85,
      remediationPlan: [
        { id: 'rem-1', criterionTitle: 'Mathematical Reasoning', recommendation: 'Practice explaining each step', resources: ['Khan Academy'] },
      ],
    },
  },
  {
    id: 'sub-2',
    assignmentId: 'assignment-1',
    studentId: 'student-5',
    studentName: 'Arjun Menon',
    studentAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=arjun',
    submittedAt: '2024-02-13T15:45:00',
    status: 'submitted',
    files: [{ id: 'file-2', name: 'arjun_solutions.pdf', url: '/submissions/arjun.pdf', type: 'file' }],
  },
  {
    id: 'sub-3',
    assignmentId: 'assignment-1',
    studentId: 'student-6',
    studentName: 'Kavya Reddy',
    studentAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=kavya',
    submittedAt: '2024-02-15T23:55:00',
    status: 'late',
    files: [{ id: 'file-3', name: 'kavya_hw.pdf', url: '/submissions/kavya.pdf', type: 'file' }],
  },
];

// Mock Announcements
export const mockAnnouncements: Announcement[] = [
  {
    id: 'ann-1',
    classId: 'class-1',
    authorId: 'teacher-1',
    authorName: 'Priya Sharma',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya',
    content: 'Welcome to our Algebra class! Remember, the first assignment is due next Friday.',
    allowComments: true,
    comments: [
      { id: 'com-1', authorId: 'student-4', authorName: 'Meera Iyer', authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=meera', content: 'Thank you, Ms. Sharma!', createdAt: '2024-02-01T10:00:00' },
    ],
    createdAt: '2024-02-01T09:00:00',
  },
];

// Mock Lesson Plans
export const mockLessonPlans: LessonPlan[] = [
  {
    id: 'lp-1',
    classId: 'class-1',
    title: 'Strengthening Mathematical Reasoning',
    objectives: ['Improve step-by-step problem solving', 'Practice explaining reasoning', 'Connect to real-world applications'],
    timeEstimate: 45,
    steps: [
      { id: 'step-1', title: 'Warm-up Discussion', duration: 5, description: 'Review previous concepts' },
      { id: 'step-2', title: 'Concept Explanation', duration: 15, description: 'Introduce reasoning frameworks' },
      { id: 'step-3', title: 'Guided Practice', duration: 15, description: 'Work through problems together' },
      { id: 'step-4', title: 'Independent Practice', duration: 10, description: 'Students solve and explain' },
    ],
    practiceTasks: ['Solve 3 problems explaining each step', 'Create a problem for a classmate'],
    formativeCheck: 'Exit ticket: Explain the reasoning for solving a given equation',
    homework: 'Complete worksheet problems 1-5 with full reasoning explanations',
    differentiation: { easy: 'Step-by-step templates', standard: 'Standard problems', advanced: 'Challenge problems' },
    createdAt: '2024-02-05',
    status: 'published',
  },
];

// Mock Insights
export const mockClassInsights: ClassInsight[] = [
  { criterionId: 'crit-1', criterionTitle: 'Mathematical Reasoning', averageScore: 2.8, maxScore: 4, studentCount: 32 },
  { criterionId: 'crit-2', criterionTitle: 'Procedural Accuracy', averageScore: 3.5, maxScore: 4, studentCount: 32 },
  { criterionId: 'crit-3', criterionTitle: 'Problem Interpretation', averageScore: 3.1, maxScore: 4, studentCount: 32 },
  { criterionId: 'crit-4', criterionTitle: 'Communication', averageScore: 2.6, maxScore: 4, studentCount: 32 },
];

export const mockStudentProgress: StudentProgress[] = [
  { outcomeId: 'out-1', outcomeTitle: 'Mathematical Reasoning', masteryLevel: 70, trend: 'improving' },
  { outcomeId: 'out-2', outcomeTitle: 'Procedural Accuracy', masteryLevel: 88, trend: 'stable' },
  { outcomeId: 'out-3', outcomeTitle: 'Problem Interpretation', masteryLevel: 75, trend: 'improving' },
  { outcomeId: 'out-4', outcomeTitle: 'Communication', masteryLevel: 65, trend: 'improving' },
];

export const mockInsights = {
  criterionAverages: [
    { name: 'Mathematical Reasoning', average: 70 },
    { name: 'Procedural Accuracy', average: 88 },
    { name: 'Problem Interpretation', average: 78 },
    { name: 'Communication', average: 65 },
  ],
  weakOutcomes: [
    { criterion: 'Communication', description: 'Students struggle to explain their reasoning clearly', average: 65 },
    { criterion: 'Mathematical Reasoning', description: 'Step-by-step logical progression needs improvement', average: 70 },
  ],
  recommendations: [
    { title: 'Focus on Communication', description: 'Dedicate 10 minutes per class to students explaining solutions' },
    { title: 'Reasoning Frameworks', description: 'Introduce structured problem-solving templates' },
  ],
};
