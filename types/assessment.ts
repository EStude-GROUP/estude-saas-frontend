import type { AssessmentPurpose } from '@/lib/internal-results';
export type QuestionType =
  "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "ESSAY";
export type Difficulty = "EASY" | "MEDIUM" | "HARD" | "VERY_HARD";

export interface QuestionOption {
  id: string;
  label: string;
  text: string;
}

export interface Question {
  id: string;
  folderId?: string | null;
  subjectId: string;
  subjectName: string;
  topicId: string | null;
  topicName: string;
  content: string;
  imageEnabled?: boolean;
  imageUrl?: string | null;
  keyword?: string | null;
  type: QuestionType;
  difficulty: Difficulty;
  options: QuestionOption[];
  correctOptionIds: string[];
  defaultPoints: number;
  explanation: string;
  disabled: boolean;
  generatedByAi?: boolean;
  sourceMaterialId?: string | null;
  source?: QuestionSource | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionFolder {
  id: string;
  parentId: string | null;
  name: string;
  depth: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionSource {
  documentName: string;
  page: number;
  excerpt?: string;
  learningObjective?: string;
  verification?: "AI_REVIEWED" | "TEACHER_EDITED";
}

export type GeneratedQuestionStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface GeneratedQuestion extends Omit<
  Question,
  "createdAt" | "updatedAt"
> {
  teacherId: string;
  materialId: string;
  source: QuestionSource;
  status: GeneratedQuestionStatus;
  generatedByAi: true;
  sourceFocus?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovedAiQuestion {
  generatedQuestion: GeneratedQuestion;
  question: Question;
}

export interface GenerateAiQuestionsInput {
  materialId: string;
  subjectId?: string;
  topicId?: string;
  sourceFocus?: string;
  learningObjective?: string;
  questionType: Extract<QuestionType, "SINGLE_CHOICE" | "TRUE_FALSE">;
  difficulty: Difficulty;
  quantity: number;
  includeExplanation: boolean;
}

export interface AiQuestionJob {
  id: string;
  input: GenerateAiQuestionsInput;
  status: "QUEUED" | "PROCESSING" | "READY" | "FAILED";
  quantity: number;
  completed: number;
  attempts: number;
  errorCode: string | null;
  questions: GeneratedQuestion[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiQuestionEditDraft {
  questionId: string;
  content: string;
  difficulty: Difficulty;
  options: QuestionOption[];
  correctOptionIds: string[];
  explanation: string;
}
export interface AiQuestionDraftInput {
  form: GenerateAiQuestionsInput;
  questionIds: string[];
  edits: AiQuestionEditDraft[];
  expectedVersion: number;
}
export interface AiQuestionDraft extends Omit<
  AiQuestionDraftInput,
  "expectedVersion"
> {
  questions: GeneratedQuestion[];
  version: number;
  savedAt: string;
  missingQuestionIds: string[];
}

export interface DifficultyLevelDefinition {
  code: Difficulty;
  label: string;
  description: string;
}

export interface SystemDifficultySettings {
  levels: DifficultyLevelDefinition[];
  maxQuestionsPerGeneration: number;
  configured: boolean;
}

export interface TeacherDifficultySettings {
  systemLevels: DifficultyLevelDefinition[];
  customLevels: DifficultyLevelDefinition[] | null;
  effectiveLevels: DifficultyLevelDefinition[];
  maxQuestionsPerGeneration: number;
  defaultQuantity: number;
  usingSystemDefaults: boolean;
}

export interface UpdateGeneratedQuestionInput {
  content?: string;
  difficulty?: Difficulty;
  options?: QuestionOption[];
  correctOptionIds?: string[];
  explanation?: string;
}

export interface QuestionFilters {
  search?: string;
  subjectId?: string;
  topicId?: string;
  difficulty?: Difficulty;
  type?: QuestionType;
  page?: number;
  limit?: number;
}

export interface QuestionInput {
  defaultPoints?: number;
  folderId?: string | null;
  subjectId: string;
  subjectName: string;
  topicId: string | null;
  topicName: string;
  content: string;
  type: QuestionType;
  difficulty: Difficulty;
  options: QuestionOption[];
  correctOptionIds: string[];
  explanation: string;
  disabled: boolean;
}

export interface BulkMoveQuestionsInput {
  questionIds: string[];
  subjectId: string;
  topicId?: string;
  newTopicName?: string;
}

export interface BulkMoveQuestionsResult {
  topic: Pick<Topic, "id" | "name"> | null;
  questions: Question[];
}

export interface AcademicYear {
  dateBoundaryMode?: string | null;
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED";
  deletedAt?: string | null;
}

export interface Term {
  dateBoundaryMode?: string | null;
  id: string;
  academicYearId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  displayOrder: number;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED" | "LOCKED";
  deletedAt?: string | null;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  vietnameseName?: string | null;
  description: string;
  keyword?: string | null;
  isActive: boolean;
  createdById?: string | null;
  deletedAt?: string | null;
}

export interface SubjectImportResult {
  totalRows: number;
  createdCount: number;
  failedCount: number;
  errors: Array<{
    row: number;
    code?: string;
    message: string;
  }>;
}

export interface GradeComponent {
  id: string;
  subjectId: string;
  code: string;
  name: string;
  requiredColumns: number;
  weight: number;
  teacherCanConfigureCalculation: boolean;
  sortOrder: number;
  isActive: boolean;
  deletedAt?: string | null;
}

export interface SchoolClass {
  id: string;
  academicYearId: string;
  code: string;
  name: string;
  keyword?: string | null;
  isActive: boolean;
  deletedAt?: string | null;
}

export interface ClassRosterMember {
  id: string;
  fullName: string;
  accountName: string;
  keyword?: string | null;
  role: "TEACHER" | "STUDENT";
  status: string;
  avatarUrl: string | null;
  assignmentId?: string;
  enrollmentId?: string;
  assignedAt?: string;
  joinedAt?: string;
}

export interface ClassRoster {
  classId: string;
  teachers: ClassRosterMember[];
  students: ClassRosterMember[];
}

export interface AvailableStudentsPage {
  items: ClassRosterMember[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface SubjectTeacherAssignment {
  courseOfferingId?: string;
  courseStatus?: string;
  term?: Term;
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  keyword?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  teacher: {
    id: string;
    fullName: string;
    accountName: string;
    email?: string | null;
    avatarUrl: string | null;
    status: string;
  };
  subject: Pick<Subject, "id" | "code" | "name" | "vietnameseName"> & {
    description?: string;
  };
  schoolClass: Pick<SchoolClass, "id" | "code" | "name" | "academicYearId">;
}

export interface TeacherAssignedClass {
  courseOfferingId?: string;
  courseTermId?: string;
  id: string;
  code: string;
  name: string;
  academicYearId: string;
  keyword?: string | null;
  studentCount: number;
  isHomeroomTeacher: boolean;
  subjects: Array<Pick<Subject, "id" | "code" | "name" | "vietnameseName">>;
}

export interface TeacherManagedStudent {
  id: string;
  fullName: string;
  accountName: string;
  email: string | null;
  avatarUrl: string | null;
  status: "PENDING" | "ACTIVE" | "INACTIVE" | "LOCKED";
  keyword?: string | null;
  classes: Array<Pick<SchoolClass, "id" | "code" | "name">>;
}

export type StudentCourse = SubjectTeacherAssignment;

export type StudentCourseMaterial = Omit<
  LearningMaterial,
  "s3Key" | "keyword" | "deletedAt"
>;

export interface StudentCourseTopic {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  materials: StudentCourseMaterial[];
  status?: ContentStatus;
  createdBy?: string;
  lessons?: Lesson[];
}

export interface StudentCourseDetail extends StudentCourse {
  enrollment: { joinedAt: string };
  academicYear: Pick<
    AcademicYear,
    "id" | "name" | "startsAt" | "endsAt" | "status"
  > | null;
  terms: Array<
    Pick<
      Term,
      | "id"
      | "name"
      | "startsAt"
      | "endsAt"
      | "displayOrder"
      | "status"
      | "isActive"
    >
  >;
  studentCount: number;
  topics: StudentCourseTopic[];
}

export interface LearningMaterial {
  id: string;
  topicId: string | null;
  teacherId: string;
  originalName: string;
  keyword?: string | null;
  s3Key: string;
  mimeType: string;
  size: number;
  status: "PENDING" | "READY";
  createdAt: string;
  updatedAt: string;
  assignments?: MaterialClassAssignment[];
}

export interface MaterialClassAssignment {
  courseOfferingId?: string;
  term?: Term;
  id: string;
  classId: string;
  subjectId: string;
  name: string;
  description: string;
  schoolClass: Pick<SchoolClass, "id" | "code" | "name">;
  subject: Pick<Subject, "id" | "code" | "name" | "vietnameseName">;
}

export interface MaterialAssignmentTarget {
  courseOfferingId?: string;
  lessonId?: string;
  classId: string;
  subjectId: string;
  topicId?: string;
  topicName?: string;
}

export interface BulkMaterialAssignmentResult {
  assignedCount: number;
  skippedCount: number;
  materialCount: number;
  topicCount: number;
}

export interface ClassTopic {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  name: string;
  description: string;
  keyword?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  subject: Pick<Subject, "id" | "code" | "name" | "vietnameseName">;
  materials: LearningMaterial[];
  status?: ContentStatus;
  publishedAt?: string | null;
  availableFrom?: string | null;
  availableUntil?: string | null;
  createdBy?: string;
  lessons?: Lesson[];
}

export type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export interface ContentWindow { availableFrom?: string | null; availableUntil?: string | null }
export interface Lesson extends ContentWindow {
  id: string; topicId: string; title: string; description: string; content: string;
  sortOrder: number; status: ContentStatus; publishedAt: string | null; createdBy: string;
  createdAt: string; updatedAt: string; legacy?: boolean; resources: LessonResource[];
  requiredForCompletion?: boolean; requirementRevision?: number;
}
export interface LessonResource extends ContentWindow {
  id: string; lessonId: string; materialId: string | null; title: string; description?: string;
  type: 'FILE' | 'PDF' | 'DOCUMENT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'LINK';
  linkUrl: string | null; sortOrder: number; status: ContentStatus; publishedAt: string | null;
  createdBy: string; createdAt: string; updatedAt: string; legacy?: boolean;
  material: StudentCourseMaterial | null;
  requiredForCompletion?: boolean;
}
export interface LessonInput extends ContentWindow { title: string; description?: string; content?: string; sortOrder?: number; requiredForCompletion?: boolean }

export interface ClassTopicInput extends ContentWindow {
  subjectId: string;
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
  description: string;
  keyword?: string | null;
  isActive: boolean;
}

export type ExamStatus = "DRAFT" | "SCHEDULED" | "ONGOING" | "ENDED" | "ARCHIVED";
export type StudentExamStatus = "UPCOMING" | "AVAILABLE" | "IN_PROGRESS" | "SUBMITTED" | "ENDED";

export interface StudentExamAttemptSummary {
  id: string;
  status: AttemptStatus;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
}

export interface ExamQuestion {
  faultPolicy?: 'FULL_CREDIT' | 'EXCLUDE';
  type?: QuestionType;
  content?: string;
  options?: QuestionOption[];
  correctOptionIds?: string[];
  questionId: string;
  points: number;
  order: number;
  subjectId?: string;
  subjectName?: string;
  topicId?: string;
  topicName?: string;
  question?: {
    id: string;
    subjectId?: string;
    subjectName?: string;
    topicId?: string;
    topicName?: string;
    content: string;
    imageUrl?: string | null;
    imageEnabled?: boolean;
    type: QuestionType;
    options: QuestionOption[];
    correctOptionIds?: string[];
    explanation?: string;
  } | null;
}

export interface ExamSettings {
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  attemptsAllowed: number;
  examVersionCount: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  showScoreImmediately: boolean;
  showCorrectAnswers: boolean;
  answerReleasePolicy?: "NEVER" | "AFTER_SUBMIT" | "AFTER_EXAM_END" | "AFTER_RESULT_PUBLISHED";
  passingScore?: number;
}

export interface TeacherExamDefaults {
  durationMinutes: number;
  attemptsAllowed: number;
  availabilityDays: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  showScoreImmediately: boolean;
  showCorrectAnswers: boolean;
}

export interface TeacherExamDefaultSettings {
  examDefaults: TeacherExamDefaults;
  configured: boolean;
  updatedAt: string | null;
}

export interface Exam {
  courseOfferingId?: string | null;
  assessmentPurpose?: AssessmentPurpose | null;
  id: string;
  makeupOfExamId?: string | null;
  makeupContext?: { studentIds: string[]; reason: string } | null;
  termId?: string | null;
  lessonId?: string | null;
  requiredForCompletion?: boolean;
  completionRule?: 'FINALIZED' | 'PASSED';
  resultStatus?: "UNPUBLISHED" | "PUBLISHED" | null;
  audienceProvenance?: "SNAPSHOT" | "LEGACY_UNKNOWN" | null;
  title: string;
  keyword?: string | null;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  topicName: string;
  description: string;
  teacherId: string;
  teacherName?: string;
  attemptedCount?: number;
  studentStatus?: StudentExamStatus;
  currentAttempt?: StudentExamAttemptSummary | null;
  attemptsUsed?: number;
  hasFinalizedAttempt?: boolean;
  attemptsRemaining?: number;
  canStart?: boolean;
  canResume?: boolean;
  historyOnly?: boolean;
  status: ExamStatus;
  published: boolean;
  requiresAccessCode: boolean;
  questions: ExamQuestion[];
  totalPoints: number;
  settings: ExamSettings;
  createdAt: string;
  archivedAt?: string | null;
  updatedAt: string;
}

export interface ExamInput {
  courseOfferingId?: string;
  assessmentPurpose?: AssessmentPurpose;
  title: string;
  lessonId?: string;
  requiredForCompletion?: boolean;
  completionRule?: 'FINALIZED' | 'PASSED';
  termId?: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  topicName: string;
  description: string;
  requiresAccessCode: boolean;
  accessCode?: string;
  questions: ExamQuestion[];
  settings: ExamSettings;
}

export type AttemptStatus = "IN_PROGRESS" | "SUBMITTED";

export interface ExamAnswer {
  questionId: string;
  selectedOptionIds: string[];
  essayText: string;
  flagged: boolean;
  clientSequence?: number;
}

export interface ExamManualGrade {
  questionId: string;
  score: number;
  feedback: string;
  gradedBy: string;
  gradedAt: string;
}

export interface ExamAttempt {
  answersReleased?: boolean;
  answerReleaseMessage?: string;
  reviewRequired?: boolean;
  canResume?: boolean;
  historyOnly?: boolean;
  maxScore?: number | null;
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  studentCode?: string | null;
  status: AttemptStatus;
  startedAt: string;
  expiresAt: string | null;
  /** Server clock when the attempt was read; used to correct local clock skew. */
  serverNow?: string;
  submittedAt: string | null;
  answers: ExamAnswer[];
  manualGrades?: ExamManualGrade[];
  gradingStatus?: "PARTIAL" | "FINALIZED" | null;
  finalizedAt?: string | null;
  finalizedBy?: string | null;
  officialResultPublished?: boolean;
  questionRecoveryApplied?: boolean;
  passed?: boolean | null;
  essayFeedback?: Array<{ questionId: string; feedback: string }>;
  score: number | null;
  autoScoredSubtotal?: number | null;
  correctCount: number | null;
  durationSeconds: number | null;
  examCode: string | null;
  teacherReview?: ExamClassReportReview | null;
}

export type ExamClassParticipationStatus =
  "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";
export type TeacherReviewStatus = "DRAFT" | "PUBLISHED";

export interface ExamClassReportAttempt {
  id: string;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  autoScoredSubtotal?: number | null;
  maxScore: number;
  percentage: number | null;
  durationSeconds: number | null;
  gradingStatus: "COMPLETE" | "PARTIAL";
  published?: boolean;
  scoredPointsPossible: number | null;
  ungradedPointsPossible: number | null;
}

export interface ExamClassReportReview {
  comment: string;
  status: TeacherReviewStatus;
  publishedAt: string | null;
  updatedAt: string;
}

export interface ExamClassReportStudent {
  id: string;
  fullName: string;
  studentCode: string;
  avatarUrl: string | null;
  participationStatus: ExamClassParticipationStatus;
  attemptCount: number;
  submittedAttemptCount: number;
  selectedAttempt: ExamClassReportAttempt | null;
  topicPerformance: Array<{
    topicId: string;
    topicName: string;
    opportunityCount: number;
    correctCount: number;
    accuracy: number;
  }>;
  needsSupport: boolean;
  supportTopicNames: string[];
  review: ExamClassReportReview | null;
}

export interface ExamClassQuestionPerformance {
  questionId: string;
  order: number;
  content: string;
  type: QuestionType | null;
  topicId: string;
  topicName: string;
  opportunityCount: number;
  answeredCount: number;
  correctCount: number | null;
  incorrectCount: number | null;
  unansweredCount: number;
  accuracy: number | null;
  supportStudentCount: number | null;
  supportStudentIds: string[];
  optionDistribution: Array<{
    optionId: string;
    label: string;
    text: string;
    selectedCount: number;
    selectedRate: number;
    isCorrect: boolean;
    functioningDistractor: boolean | null;
  }>;
  itemAnalysis: {
    sampleSize: number;
    discriminationSampleSize: number;
    discriminationMethod: "CORRECTED_ITEM_TOTAL_CORRELATION";
    evidenceLevel: "LIMITED" | "DEVELOPING" | "ESTABLISHED";
    difficultyLevel:
      | "NOT_APPLICABLE"
      | "VERY_DIFFICULT"
      | "DIFFICULT"
      | "MODERATE"
      | "EASY"
      | "VERY_EASY";
    discriminationIndex: number | null;
    discriminationLevel:
      | "INSUFFICIENT_DATA"
      | "NEGATIVE"
      | "POOR"
      | "ACCEPTABLE"
      | "GOOD"
      | "EXCELLENT";
    flags: Array<
      | "LOW_SAMPLE"
      | "TOO_DIFFICULT"
      | "TOO_EASY"
      | "NEGATIVE_DISCRIMINATION"
      | "LOW_DISCRIMINATION"
      | "NON_FUNCTIONING_DISTRACTOR"
    >;
  };
}

export interface ExamInsightActionInput {
  kind: "ASSIGNMENT" | "NOTIFICATION";
  studentIds: string[];
  title: string;
  message: string;
  groupLabel: string;
  dueAt?: string;
}

export interface ExamInsightActionResult {
  id: string;
  recipientCount: number;
  alreadySent: boolean;
}

export interface ExamClassTopicPerformance {
  topicId: string;
  topicName: string;
  questionCount: number;
  opportunityCount: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  accuracy: number | null;
  supportStudentCount: number;
  supportStudentIds: string[];
}

export interface ExamClassReport {
  generatedAt: string;
  policy: {
    enrollmentScope: "CURRENT_ACTIVE_ENROLLMENTS" | "PUBLISHED_AUDIENCE_SNAPSHOT";
    audienceProvenance?: "SNAPSHOT" | "LEGACY_UNKNOWN";
    selectedAttemptRule: "HIGHEST_FINALIZED" | "LATEST_SUBMITTED";
    activeAttemptFallback: "LATEST_IN_PROGRESS_FOR_DISPLAY_ONLY";
    supportThresholdPercent: number;
    note: string;
  };
  summary: {
    enrolledStudentCount: number;
    uniqueAttemptedStudentCount: number;
    totalAttemptCount: number;
    notStartedCount: number;
    inProgressStudentCount: number;
    submittedStudentCount: number;
    finalizedStudentCount: number;
    publishedStudentCount: number;
    selectedSubmittedAttemptCount: number;
    ungradedSubmittedAttemptCount: number;
    averageScore: number | null;
    medianScore: number | null;
    averagePercentage: number | null;
    medianPercentage: number | null;
    averageDurationSeconds: number | null;
    medianDurationSeconds: number | null;
  };
  students: ExamClassReportStudent[];
  questionPerformance: ExamClassQuestionPerformance[];
  topicPerformance: ExamClassTopicPerformance[];
}

export interface ExamClassAiAnalysis {
  knowledgeGaps?: Array<{
    knowledge: string;
    questionNumbers: number[];
    evidence: string;
    remediation: string;
  }>;
  generatedAt: string;
  source: "AI" | "FALLBACK" | "ASSESSMENT_ONLY";
  model: string | null;
  analysisScope?: "MATERIAL_GROUNDED" | "ASSESSMENT_ONLY";
  materialContext?: {
    available: boolean;
    readyMaterialCount: number;
  };
  riskSummary?: {
    basis: "EXAM_RESULTS_ONLY";
    atRiskStudentCount: number;
    evaluatedStudentCount: number;
    atRiskPercentage: number | null;
  };
  headline: string;
  summary: string;
  strengths: Array<{ title: string; evidence: string }>;
  concerns: Array<{ title: string; evidence: string }>;
  recommendations: Array<{
    priority: "HIGH" | "MEDIUM" | "LOW";
    title: string;
    action: string;
  }>;
  lessonPlan: {
    focus: string;
    objective: string;
    activities: string[];
    durationMinutes: number;
  };
}

export interface ExamClassAnalysisState {
  status: "NOT_STARTED" | "QUEUED" | "PROCESSING" | "READY" | "FAILED";
  analysis: ExamClassAiAnalysis | null;
  snapshot: {
    questions?: Array<{
      order: number;
      content?: string;
      topicName: string;
      opportunityCount: number;
      accuracy: number | null;
      incorrectCount?: number | null;
      unansweredCount: number;
    }>;
    title: string;
    className: string;
    subjectName: string;
    totalPoints: number;
    enrolledStudentCount: number;
    submittedStudentCount: number;
    averagePercentage: number | null;
    averageDurationSeconds: number | null;
  } | null;
  hasNewData: boolean;
  canAnalyze: boolean;
  currentSubmittedStudentCount: number;
  requestedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface SubjectSupportStudent {
  id: string;
  fullName: string;
  studentCode: string;
  parentCount: number;
  level: "INSUFFICIENT" | "HIGH" | "WATCH" | "STABLE";
  needsFollowUp: boolean;
  averagePercentage: number | null;
  recentAveragePercentage: number | null;
  trendPercentagePoints: number | null;
  scoredExamCount: number;
  submittedExamCount: number;
  overdueExamCount: number;
  reasons: string[];
  history: Array<{
    examId: string;
    title: string;
    endsAt: string;
    attemptId: string | null;
    status: string;
    percentage: number | null;
    awaitingGrading: boolean;
  }>;
  gaps: Array<{
    examId: string;
    examTitle: string;
    questionId: string;
    questionNumber: number;
    content: string;
    topicName: string;
  }>;
}

export interface SubjectSupportReport {
  courseOfferingId?: string | null;
  termId?: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  version: string;
  generatedAt: string;
  examCount: number;
  riskSummary?: {
    basis: "EXAM_RESULTS_ONLY";
    atRiskStudentCount: number;
    evaluatedStudentCount: number;
    atRiskPercentage: number | null;
  };
  materialContext?: {
    available: boolean;
    readyMaterialCount: number;
  };
  policy: string;
  students: SubjectSupportStudent[];
  cache?: {
    source: "CACHE" | "COMPUTED";
    stale: boolean;
    expiresAt: string;
  };
}

export interface LearningSupportOverview {
  generatedAt: string;
  scopes: Array<{
    courseOfferingId?: string | null;
    term?: { id: string; name: string } | null;
    sectionKey?: string;
    displayName?: string;
    classId: string;
    classCode: string;
    className: string;
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    studentCount: number;
    anchorExamId: string | null;
    error: string | null;
    examCount: number;
    generatedAt: string | null;
    riskSummary: SubjectSupportReport["riskSummary"] | null;
    materialContext: SubjectSupportReport["materialContext"] | null;
    levelCounts: Record<SubjectSupportStudent["level"], number>;
  }>;
  totals: {
    scopeCount: number;
    classCount: number;
    studentCount: number;
    evaluatedStudentCount: number;
    atRiskStudentCount: number;
    missingMaterialScopeCount: number;
  };
}

export interface ExamListAiAnalysis extends ExamClassAiAnalysis {
  trend: {
    direction: "IMPROVING" | "DECLINING" | "STABLE" | "INSUFFICIENT_DATA";
    evidence: string;
  };
}

export type StudySourceType =
  | "COURSE_MATERIAL"
  | "EXTERNAL_KNOWLEDGE"
  | "SOURCE_UNAVAILABLE"
  // Written by AI from the exam alone (no course material to check it against).
  | "EXAM_REVIEW"
  // The student's own wrong question, with the teacher's answer key.
  | "EXAM_MISTAKE";

export interface StudyLearningProfile {
  objectiveId?: string;
  topicName: string;
  masteryEstimate: number;
  sampleSize: number;
  previousAccuracy: number | null;
  trend: "INSUFFICIENT_DATA" | "IMPROVING" | "DECLINING" | "STABLE";
  evidenceLevel: "LIMITED" | "DEVELOPING" | "ESTABLISHED";
  recurringMistakes: number;
  recommendedDifficulty: Difficulty;
  recommendation: string;
}

export interface StudyTopicPerformance {
  objectiveId?: string;
  topicName: string;
  totalQuestions: number;
  correctCount: number;
  missedCount: number;
  pointsEarned: number;
  pointsPossible: number;
  accuracy: number;
}

export interface StudyWeakArea {
  objectiveId?: string;
  id: string;
  topicName: string;
  sourceType: StudySourceType;
  missedCount: number;
  totalQuestions: number;
  accuracy: number;
  diagnosis: string;
  reviewSummary: string;
  keyPoints: string[];
  sourceReferences: Array<{ documentName: string; page: number }>;
  /** Wrong questions of the exam this area was built from. */
  questionIds?: string[];
}

export type StudyPerformanceLevel =
  "PENDING" | "BELOW_AVERAGE" | "AVERAGE_TO_GOOD" | "STRONG";

export interface StudyLearningPathStep {
  objectiveId?: string;
  order: number;
  topicName: string;
  title: string;
  objective: string;
  activities: string[];
  durationMinutes: number;
}

export interface StudyLearningPath {
  totalDurationMinutes: number;
  steps: StudyLearningPathStep[];
}

export interface StudyAnalysisReport {
  topicSuggestions?: Array<{
    questionId: string;
    order: number;
    content: string;
    topicName: string;
    sourceReferences: Array<{ materialId: string; documentName: string; page: number; excerpt: string }>;
  }>;
  reviewStates?: Record<
    string,
    {
      decision: "CONFIRMED" | "EDITED" | "REJECTED";
      version: number;
      reason: string;
    }
  >;
  version?: number;
  learningProfile?: StudyLearningProfile[];
  historyAnalysisCount?: number;
  aiStatus: "READY" | "FALLBACK" | "SKIPPED_NO_MATERIAL";
  analysisScope?: "MATERIAL_GROUNDED" | "ASSESSMENT_ONLY" | "EXAM_GROUNDED";
  materialContext?: {
    available: boolean;
    readyMaterialCount: number;
    reason: "NO_ATTACHED_READY_MATERIAL" | null;
  };
  summary: string;
  exam: {
    id: string;
    title: string;
    classId: string;
    className: string;
    subjectId: string;
    subjectName: string;
  };
  performance: {
    score: number | null;
    totalPoints: number;
    accuracy: number;
    correctCount: number;
    totalQuestions: number;
    ungradedEssayCount: number;
    gradingStatus?: "COMPLETE" | "PARTIAL";
    snapshotOrigin?: "ORIGINAL" | "LEGACY_INCOMPLETE";
    scorePercentage: number | null;
    level: StudyPerformanceLevel;
    needsWarning: boolean;
  };
  topicPerformance: StudyTopicPerformance[];
  weakAreas: StudyWeakArea[];
  learningPath: StudyLearningPath;
}

export interface StudyPracticeQuestion {
  reviewDecision?: "CONFIRMED" | "EDITED" | "REJECTED";
  id: string;
  type?: QuestionType;
  objectiveId?: string;
  topicName: string;
  sourceType: StudySourceType;
  content: string;
  options: Array<{ id: string; label: string; text: string }>;
  correctOptionIds?: string[];
  explanation?: string;
  selectedOptionIds?: string[];
  correct?: boolean;
}

export interface TeacherPracticePreview {
  planId: string;
  taskId: string;
  practiceSetId: string | null;
  totalQuestions: number;
  questions: StudyPracticeQuestion[];
}

export type StudyPracticeMode = "EASY" | "HARD";
export type StudyPracticeContentType = "WRONG_QUESTIONS" | "SOURCE_REGION";

export interface StudyPracticeSet {
  feedback?: Array<{
    objectiveId?: string;
    topicName: string;
    accuracy: number;
    correctCount: number;
    totalQuestions: number;
    reviewAfterDays: number;
    reviewAt: string;
    recommendation: string;
  }>;
  id: string;
  analysisId: string;
  attemptId: string;
  attemptNumber: number;
  attemptHistory: StudyPracticeAttemptSummary[];
  status: "READY" | "SUBMITTED";
  score: number | null;
  correctCount: number | null;
  startedAt: string | null;
  submittedAt: string | null;
  durationSeconds: number | null;
  snapshotVersion: string;
  gradingVersion: string;
  assistance: "NO_SYSTEM_HINTS" | "SYSTEM_HINTS_USED" | "UNKNOWN";
  mode: StudyPracticeMode | "UNSPECIFIED";
  practiceType: StudyPracticeContentType;
  legacy: boolean;
  hintQuestionIds: string[];
  questions: StudyPracticeQuestion[];
  totalQuestions: number;
}

export interface StudyPracticeAttemptSummary {
  id: string;
  attemptNumber: number;
  status: "READY" | "SUBMITTED";
  score: number | null;
  correctCount: number | null;
  totalQuestions: number;
  startedAt: string | null;
  submittedAt: string | null;
  durationSeconds: number | null;
  mode: StudyPracticeMode | "UNSPECIFIED";
  practiceType: StudyPracticeContentType;
  assistance: string;
  hintQuestionIds: string[];
  legacy: boolean;
  snapshotVersion: string;
  gradingVersion: string;
}

export interface StudyPracticeAttemptResult extends StudyPracticeAttemptSummary {
  questions: StudyPracticeQuestion[];
}

export interface AssessmentEvidence {
  id: string;
  objectiveId: string;
  source: "ASSIGNED_EXAM" | "STUDY_PRACTICE";
  sourceTitle: string;
  sourceAttemptId: string;
  observedAt: string;
  gradingStatus: "COMPLETE" | "PARTIAL";
  snapshotOrigin: string;
  assistance: string;
  totalQuestions: number;
  scorableCount: number;
  correctCount: number;
  accuracy: number | null;
  baselineEligible: boolean;
  ineligibleReason: string | null;
  objective: {
    id: string;
    title: string;
    granularity: string;
    version: number;
  };
  questionSnapshot: Array<{
    questionId: string;
    order: number;
    content: string;
    type: QuestionType;
    difficulty: string;
    imageEnabled?: boolean;
    imageUrl?: string | null;
    options: Array<{ id: string; label: string; text: string }>;
    correctOptionIds: string[];
    explanation: string;
  }>;
  answers: Array<{
    questionId: string;
    selectedOptionIds: string[];
    essayText?: string;
  }>;
}

export interface BaselineSelection {
  id: string;
  studentId: string;
  objectiveId: string;
  evidenceId: string;
  reason: string;
  version: number;
  selectedAt: string;
}

export interface StudentEvidenceResult {
  items: AssessmentEvidence[];
  baselines: BaselineSelection[];
  baselineHistory: Array<{
    id: string;
    selectionId: string;
    evidenceId: string;
    reason: string;
    version: number;
    selectedAt: string;
  }>;
  missingSnapshotAttemptIds: string[];
}

export type StudyPracticeAttempt = StudyPracticeAttemptSummary & {
  questions: StudyPracticeQuestion[];
  feedback?: StudyPracticeSet["feedback"];
};

export interface LearningObjectiveEvidence {
  id: string;
  key: string;
  title: string;
  classId: string;
  subjectId: string;
  topicId: string | null;
  granularity: string;
  version: number;
  materialId?: string;
  topicNames?: string[];
}

export interface AssessmentEvidenceQuestion {
  questionId: string;
  objectiveId: string;
  topicName: string;
  content: string;
  type: string;
  difficulty: string;
  points: number;
  order: number;
  options: Array<{ id: string; label: string; text: string }>;
  correctOptionIds: string[];
  imageUrl?: string | null;
}

export interface AssessmentEvidenceRecord {
  id: string;
  objectiveId: string;
  source: "ASSIGNED_EXAM" | "STUDY_PRACTICE";
  sourceTitle: string;
  sourceAttemptId: string;
  examId: string;
  observedAt: string;
  totalQuestions: number;
  scorableCount: number;
  correctCount: number;
  accuracy: number | null;
  gradingStatus: string;
  snapshotOrigin: string;
  assistance: string;
  gradingVersion: string;
  questionSnapshot: AssessmentEvidenceQuestion[];
  answers: Array<{
    questionId: string;
    selectedOptionIds: string[];
    essayText?: string;
  }>;
  objective?: LearningObjectiveEvidence;
  baselineEligible: boolean;
  ineligibleReason: string | null;
}

export interface BaselineSelectionRecord {
  id: string;
  objectiveId: string;
  evidenceId: string;
  teacherId: string;
  reason: string;
  version: number;
  selectedAt: string;
}

export interface StudyEvidenceBundle {
  items: AssessmentEvidenceRecord[];
  baselines: BaselineSelectionRecord[];
  baselineHistory: Array<BaselineSelectionRecord & { selectionId: string }>;
  missingSnapshotAttemptIds: string[];
}

export interface StudyAnalysis {
  id: string;
  version: number;
  attemptId: string;
  examId: string;
  studentId: string;
  classId: string;
  subjectId: string;
  report: StudyAnalysisReport;
  generatedAt: string;
  updatedAt: string;
  practiceSet: StudyPracticeSet | null;
}

export interface StudyActivityReview {
  source: "AI" | "ERROR" | "EMPTY";
  comment: string | null;
  generatedAt: string | null;
  model: string | null;
}

export interface StudyActivityDashboard {
  activityReview?: StudyActivityReview;
  analysisHistory?: Array<{
    id: string;
    attemptId: string | null;
    examId: string | null;
    examTitle: string;
    generatedAt: string;
    score: number | null;
    totalPoints: number | null;
    accuracy: number | null;
    aiStatus: string;
    summary: string;
    weakAreaCount: number;
  }>;
  practice: Array<{
    id: string;
    attemptNumber: number;
    status: "READY" | "SUBMITTED";
    startedAt: string | null;
    submittedAt: string | null;
    correctCount: number;
    totalQuestions: number;
    durationSeconds: number;
    assistance: string;
  }>;
  materialViews: Array<{
    id: string;
    materialId: string;
    materialName: string;
    openedAt: string;
    lastActiveAt: string;
    closedAt: string | null;
    activeSeconds: number;
  }>;
  materials: Array<{ id: string; name: string; pages: number[] }>;
}

export type StudyAiTargetKey = string;
export interface StudyAiFeedback {
  id: string;
  analysisId: string;
  targetKey: StudyAiTargetKey;
  reporterId: string;
  reason:
    "WRONG_KNOWLEDGE" | "OUT_OF_SCOPE" | "INSUFFICIENT_EVIDENCE" | "UNCLEAR";
  comment: string;
  createdAt: string;
}
export interface StudyAiReview {
  id: string;
  targetKey: StudyAiTargetKey;
  teacherId: string;
  originalText: string;
  effectiveText: string | null;
  decision: "CONFIRMED" | "EDITED" | "REJECTED";
  reason: string;
  version: number;
  reviewedAt: string;
}
export interface TeacherStudyAnalysis extends StudyAnalysis {
  rawReport: StudyAnalysisReport;
  rawPracticeQuestions: StudyPracticeQuestion[];
  reviews: StudyAiReview[];
  reviewHistory: Array<StudyAiReview & { reviewId: string }>;
  feedback: StudyAiFeedback[];
}
export interface LearningTask {
  id: string;
  planId: string;
  order: number;
  kind: "MATERIAL" | "PRACTICE";
  title: string;
  description: string;
  materialId: string | null;
  practiceSetId: string | null;
  actionUrl: string | null;
  dueAt: string | null;
  status: "DRAFT" | "ASSIGNED" | "CANCELLED";
  version: number;
  overdue: boolean;
  progress: {
    status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    startedAt: string | null;
    completedAt: string | null;
    difficultyNote: string | null;
    sourceAttemptId: string | null;
  } | null;
}

export type LearningSupportStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export interface LearningSupportMessage {
  id: string;
  requestId: string;
  authorId: string;
  authorRole: "STUDENT" | "TEACHER";
  authorName: string;
  content: string;
  createdAt: string;
}

export interface LearningSupportRequest {
  id: string;
  planId: string;
  taskId: string;
  studentId: string;
  teacherId: string;
  status: LearningSupportStatus;
  teacherReadAt: string | null;
  studentReadAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  planTitle: string;
  classId: string | null;
  subjectId: string | null;
  taskTitle: string;
  taskOrder: number | null;
  taskKind: "MATERIAL" | "PRACTICE" | null;
  studentName: string;
  teacherName: string;
  unreadForTeacher: boolean;
  unreadForStudent: boolean;
  messages: LearningSupportMessage[];
  latestMessage: LearningSupportMessage | null;
}

export interface LearningSupportInbox {
  items: LearningSupportRequest[];
  unreadCount: number;
  counts: {
    all: number;
    open: number;
    inProgress: number;
    resolved: number;
  };
}

export interface LearningPlan {
  id: string;
  courseOfferingId?: string | null;
  cohortId: string;
  examId: string;
  studentId: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  objectiveId: string;
  title: string;
  summary: string;
  successCriteria: string;
  targetAccuracyPercent: number | null;
  dueAt: string | null;
  status:
    | "DRAFT"
    | "ASSIGNED"
    | "IN_PROGRESS"
    | "WAITING_REASSESSMENT"
    | "COMPLETED"
    | "ACHIEVED"
    | "NEEDS_ADJUSTMENT"
    | "CANCELLED";
  version: number;
  baselineEvidenceId: string | null;
  approvedAt: string | null;
  objective: LearningObjectiveEvidence | null;
  materialStudy?: {
    materialId: string;
    materialName: string;
    sourceAttemptId: string;
    sourceExamCount?: number;
    baselineExamAccuracy: number | null;
    missedCount: number;
    matchedCount: number;
    sections: Array<{
      id?: string;
      title: string;
      page: number;
      missedCount: number;
      questionIds: string[];
      mistakes?: Array<{ questionId: string; sourceAttemptId?: string; sourceExamId?: string;
        content: string; selectedAnswer: string;
        correctAnswer: string; explanation: string }>;
      diagnosis: string;
      theory: string;
      keyPoints: string[];
      citations: Array<{ documentName: string; page: number; excerpt: string }>;
    }>;
    attempts: Array<{ id: string; attemptNumber: number; score: number | null; submittedAt: string | null }>;
    latestScore: number | null;
    bestScore: number | null;
    practiceScoreChange: number | null;
    passed: boolean;
  };
  tasks: LearningTask[];
  history: Array<{
    id: string;
    version: number;
    reason: string;
    snapshot: unknown;
    changedAt: string;
  }>;
}
export interface MaterialPlanProposal {
  analysisId: string;
  practiceSetId: string;
  materialId: string;
  materialName: string;
  sourceAttemptId: string;
  sourceExamCount?: number;
  baselineExamAccuracy: number | null;
  missedCount: number;
  matchedCount: number;
  summary: string;
  sections: NonNullable<LearningPlan["materialStudy"]>["sections"];
}

export interface LearningCohortProgress {
  cohortId: string;
  title: string;
  classId: string;
  subjectId: string;
  createdAt: string;
  completed: number;
  total: number;
  rows: Array<{
    planId: string;
    studentId: string;
    studentName: string;
    studentCode: string;
    status: LearningPlan["status"];
    target: number | null;
    materialStudy: LearningPlan["materialStudy"] | null;
    completedTasks: number;
    totalTasks: number;
  }>;
}
export type LearningPlanScopeItem = Pick<
  LearningPlan,
  "id" | "cohortId" | "studentId" | "title" | "status"
> & { createdAt: string };

export interface LearningPlanDraftInput {
  studentIds: string[];
  objectiveId: string;
  materialPreparationIds?: Record<string, string>;
  title: string;
  summary: string;
  successCriteria: string;
  targetAccuracyPercent?: number;
  dueAt?: string;
  tasks: Array<{
    kind: "MATERIAL" | "PRACTICE";
    title: string;
    description: string;
    materialId?: string;
    practiceSetId?: string;
    dueAt?: string;
  }>;
}

export type ImprovementStatus =
  | "INSUFFICIENT_EVIDENCE"
  | "IMPROVED_NOT_MET"
  | "ACHIEVED_TARGET"
  | "NO_IMPROVEMENT";
export interface ImprovementComparison {
  status: ImprovementStatus;
  reasons: string[];
  baselineAccuracy: number | null;
  afterAccuracy: number | null;
  deltaPercentagePoints: number | null;
  baselineQuestions: number;
  afterQuestions: number;
  baselineDifficulty: Record<string, number>;
  afterDifficulty: Record<string, number>;
  targetAccuracyPercent: number | null;
  baselineEvidenceId: string | null;
  afterEvidenceId: string | null;
}
export interface LearningReassessment {
  id: string;
  planId: string;
  phase: "AFTER" | "RETENTION";
  examId: string;
  teacherId: string;
  minimumQuestions: number;
  equivalenceRationale: string;
  assignedAt: string;
  scheduledFor: string | null;
  dueAt: string | null;
  evidenceId: string | null;
  decision: "CONFIRMED" | "NEEDS_ADJUSTMENT" | null;
  decisionReason: string | null;
  computedStatus: ImprovementStatus | null;
  commentary: string | null;
  commentarySource: "AI" | "FALLBACK" | null;
  reviewedAt: string | null;
  version: number;
  candidates: AssessmentEvidenceRecord[];
  selectedEvidence: AssessmentEvidenceRecord | null;
  comparison: ImprovementComparison;
  history: Array<{
    id: string;
    version: number;
    reason: string;
    changedAt: string;
  }>;
}
export interface LearningImprovementProfile {
  plan: LearningPlan;
  baseline: AssessmentEvidenceRecord | null;
  reassessments: LearningReassessment[];
  timeline: Array<{
    at: string;
    kind: string;
    evidenceId: string | null;
    label: string;
  }>;
}
export interface ClassImprovementReport {
  denominator: { assignedPlans: number; pairedStudents: number };
  counts: {
    assigned: number;
    inProgress: number;
    waitingReassessment: number;
    overdue: number;
    achieved: number;
    needsAdjustment: number;
    insufficientEvidence: number;
    awaitingTeacher: number;
  };
  achievedRateAmongPaired: number | null;
  reassessmentCoverage: number | null;
  averagePairedChange: number | null;
  method: string;
  rows: Array<{
    planId: string;
    studentId: string;
    studentName: string;
    cohortId: string;
    objectiveId: string;
    objectiveTitle: string;
    title: string;
    status: LearningPlan["status"];
    taskCompleted: number;
    taskTotal: number;
    overdue: boolean;
    baselineAccuracy: number | null;
    afterAccuracy: number | null;
    deltaPercentagePoints: number | null;
    afterStatus: ImprovementStatus | null;
    retentionStatus:
      | "NOT_SCHEDULED"
      | "NOT_YET_TESTED"
      | "AWAITING_TEACHER"
      | "CONFIRMED"
      | "INSUFFICIENT_EVIDENCE"
      | "NEEDS_ADJUSTMENT";
    hasSubmittedReassessment: boolean;
    paired: boolean;
  }>;
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Một đáp án",
  MULTIPLE_CHOICE: "Nhiều đáp án",
  TRUE_FALSE: "Đúng / Sai",
  ESSAY: "Tự luận",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: "Dễ",
  MEDIUM: "Trung bình",
  HARD: "Khó",
  VERY_HARD: "Rất khó",
};

export const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  DRAFT: "Bản nháp",
  SCHEDULED: "Sắp diễn ra",
  ONGOING: "Đang diễn ra",
  ENDED: "Đã kết thúc",
  ARCHIVED: "Đã lưu trữ",
};
