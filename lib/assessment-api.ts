import type {
  AiQuestionDraft,
  AiQuestionJob,
  AiQuestionDraftInput,
  ApprovedAiQuestion,
  QuestionFolder,
} from "@/types/assessment";
import type {
  BaselineSelection,
  StudentEvidenceResult,
  StudyPracticeMode,
} from "@/types/assessment";
import {
  authenticatedBlobRequest,
  authenticatedRequest,
  authenticatedUploadRequest,
  type UploadProgressPhase,
} from "@/lib/auth-api";
import { courseResourceContentType } from "@/lib/course-resource-file";
import type {
  Exam,
  ExamAttempt,
  ExamClassAnalysisState,
  SubjectSupportReport,
  LearningSupportOverview,
  ExamClassReport,
  ExamClassReportReview,
  ExamInsightActionInput,
  ExamInsightActionResult,
  ExamListAiAnalysis,
  ExamInput,
  ExamAnswer,
  ExamAnswerFile,
  AcademicYear,
  ClassRoster,
  AvailableStudentsPage,
  GradeComponent,
  SchoolClass,
  Question,
  QuestionFilters,
  QuestionInput,
  BulkMoveQuestionsInput,
  BulkMoveQuestionsResult,
  Subject,
  SubjectImportResult,
  SubjectTeacherAssignment,
  StudentCourse,
  StudentCourseDetail,
  TeacherAssignedClass,
  TeacherManagedStudent,
  ClassTopic,
  ClassTopicInput,
  LearningMaterial,
  MaterialAssignmentTarget,
  BulkMaterialAssignmentResult,
  Term,
  Topic,
  GeneratedQuestion,
  GenerateAiQuestionsInput,
  UpdateGeneratedQuestionInput,
  DifficultyLevelDefinition,
  SystemDifficultySettings,
  StudyAnalysis,
  StudyActivityDashboard,
  StudyActivityReview,
  StudyPracticeSet,
  TeacherPracticePreview,
  StudyPracticeAttempt,
  StudyEvidenceBundle,
  BaselineSelectionRecord,
  LearningObjectiveEvidence,
  TeacherDifficultySettings,
  TeacherExamDefaults,
  TeacherExamDefaultSettings,
  TeacherStudyAnalysis,
  StudyAiReview,
  StudyAiFeedback,
  LearningPlan,
  LearningPlanScopeItem,
  LearningPlanDraftInput,
  LearningTask,
  LearningImprovementProfile,
  ClassImprovementReport,
  LearningReassessment,
  ImprovementComparison,
} from "@/types/assessment";
import type { StudentOverview } from "@/types/student-overview";

export const academicDataService = {
  getAcademicYears(includeInactive = false): Promise<AcademicYear[]> {
    return authenticatedRequest<AcademicYear[]>(
      `/academic-years${includeInactive ? "?includeInactive=true" : ""}`,
    );
  },
  getTerms(academicYearId?: string, includeInactive = false): Promise<Term[]> {
    const params = new URLSearchParams();
    if (academicYearId) params.set("academicYearId", academicYearId);
    if (includeInactive) params.set("includeInactive", "true");
    const query = params.toString();
    return authenticatedRequest<Term[]>(`/terms${query ? `?${query}` : ""}`);
  },
  getSubjects(
    includeInactive = false,
    search?: string,
    limit?: number,
  ): Promise<Subject[]> {
    const params = new URLSearchParams();
    if (includeInactive) params.set("includeInactive", "true");
    if (search?.trim()) params.set("search", search.trim());
    if (limit) params.set("limit", String(limit));
    const query = params.toString();
    return authenticatedRequest<Subject[]>(
      `/subjects${query ? `?${query}` : ""}`,
    );
  },
  downloadSubjectImportTemplate(): Promise<Blob> {
    return authenticatedBlobRequest("/subjects/import-template");
  },
  importSubjects(
    file: File,
    onProgress: (percent: number, phase: UploadProgressPhase) => void,
  ): Promise<SubjectImportResult> {
    const formData = new FormData();
    formData.append("file", file);
    return authenticatedUploadRequest<SubjectImportResult>(
      "/subjects/import",
      formData,
      onProgress,
    );
  },
  getClasses(
    academicYearId?: string,
    includeInactive = false,
    search?: string,
    limit?: number,
  ): Promise<SchoolClass[]> {
    const params = new URLSearchParams();
    if (academicYearId) params.set("academicYearId", academicYearId);
    if (includeInactive) params.set("includeInactive", "true");
    if (search?.trim()) params.set("search", search.trim());
    if (limit) params.set("limit", String(limit));
    const query = params.toString();
    return authenticatedRequest<SchoolClass[]>(
      `/classes${query ? `?${query}` : ""}`,
    );
  },
  getTopics(subjectId?: string): Promise<Topic[]> {
    const query = subjectId
      ? `?subjectId=${encodeURIComponent(subjectId)}`
      : "";
    return authenticatedRequest<Topic[]>(`/topics${query}`);
  },
  createAcademicYear(
    payload: Pick<AcademicYear, "name" | "startsAt" | "endsAt" | "status"> & { terms: Array<{ startsAt: string; endsAt: string }> },
  ): Promise<AcademicYear> {
    return authenticatedRequest<AcademicYear>("/academic-years", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateAcademicYear(
    id: string,
    payload: Partial<
      Pick<AcademicYear, "name" | "startsAt" | "endsAt" | "status">
    >,
  ): Promise<AcademicYear> {
    return authenticatedRequest<AcademicYear>(
      `/academic-years/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
  },
  deleteAcademicYear(id: string): Promise<Record<string, never>> {
    return authenticatedRequest<Record<string, never>>(
      `/academic-years/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },
  createTerm(
    payload: Pick<
      Term,
      | "academicYearId"
      | "name"
      | "startsAt"
      | "endsAt"
      | "displayOrder"
      | "status"
    >,
  ): Promise<Term> {
    return authenticatedRequest<Term>("/terms", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateTerm(
    id: string,
    payload: Partial<
      Pick<
        Term,
        | "academicYearId"
        | "name"
        | "startsAt"
        | "endsAt"
        | "displayOrder"
        | "status"
      >
    >,
  ): Promise<Term> {
    return authenticatedRequest<Term>(`/terms/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  termClosureChecklist(id: string, target: 'COMPLETED' | 'LOCKED') {
    return authenticatedRequest<{ canProceed: boolean; issues: Array<{ code: string; message: string; count: number; sources: Array<{ id: string; title: string; type: string }> }> }>(`/terms/${encodeURIComponent(id)}/closure-checklist?target=${target}`);
  },
  deleteTerm(id: string): Promise<Record<string, never>> {
    return authenticatedRequest<Record<string, never>>(
      `/terms/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },
  createSubject(
    payload: Pick<Subject, "code" | "name"> & {
      vietnameseName: string;
      description?: string;
    },
  ): Promise<Subject> {
    return authenticatedRequest<Subject>("/subjects", {
      method: "POST",
      body: JSON.stringify({ code: payload.code, name: payload.name, vietnameseName: payload.vietnameseName, description: payload.description }),
    });
  },
  updateSubject(
    id: string,
    payload: Partial<
      Pick<
        Subject,
        "code" | "name" | "vietnameseName" | "description" | "isActive"
      >
    >,
  ): Promise<Subject> {
    return authenticatedRequest<Subject>(
      `/subjects/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
  },
  deleteSubject(id: string): Promise<Record<string, never>> {
    return authenticatedRequest<Record<string, never>>(
      `/subjects/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },
  getGradeComponents(
    filters: { subjectId?: string; includeInactive?: boolean } = {},
  ): Promise<GradeComponent[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, String(value));
    });
    const query = params.toString();
    return authenticatedRequest<GradeComponent[]>(
      `/grade-components${query ? `?${query}` : ""}`,
    );
  },
  createGradeComponent(
    payload: Omit<GradeComponent, "id" | "isActive" | "deletedAt"> & {
      isActive?: boolean;
    },
  ): Promise<GradeComponent> {
    return authenticatedRequest<GradeComponent>("/grade-components", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateGradeComponent(
    id: string,
    payload: Partial<
      Pick<
        GradeComponent,
        | "code"
        | "name"
        | "requiredColumns"
        | "weight"
        | "teacherCanConfigureCalculation"
        | "sortOrder"
        | "isActive"
      >
    >,
  ): Promise<GradeComponent> {
    return authenticatedRequest<GradeComponent>(
      `/grade-components/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
  },
  deleteGradeComponent(id: string): Promise<Record<string, never>> {
    return authenticatedRequest<Record<string, never>>(
      `/grade-components/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },
  validateGradeConfiguration(
    subjectId: string,
  ): Promise<{ subjectId: string; totalWeight: number; valid: true }> {
    return authenticatedRequest<{
      subjectId: string;
      totalWeight: number;
      valid: true;
    }>("/grade-components/validate", {
      method: "POST",
      body: JSON.stringify({ subjectId }),
    });
  },
  createClass(
    payload: Pick<SchoolClass, "academicYearId" | "code" | "name" | "isActive">,
  ): Promise<SchoolClass> {
    return authenticatedRequest<SchoolClass>("/classes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateClass(
    id: string,
    payload: Partial<
      Pick<SchoolClass, "academicYearId" | "code" | "name" | "isActive">
    >,
  ): Promise<SchoolClass> {
    return authenticatedRequest<SchoolClass>(
      `/classes/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
  },
  deleteClass(id: string): Promise<Record<string, never>> {
    return authenticatedRequest<Record<string, never>>(
      `/classes/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },
  getClassRoster(classId: string): Promise<ClassRoster> {
    return authenticatedRequest<ClassRoster>(
      `/classes/${encodeURIComponent(classId)}/roster`,
    );
  },
  getAvailableStudents(
    classId: string,
    filters: { offset?: number; limit?: number; search?: string } = {},
  ): Promise<AvailableStudentsPage> {
    const params = new URLSearchParams({
      offset: String(filters.offset ?? 0),
      limit: String(filters.limit ?? 20),
    });
    if (filters.search?.trim()) params.set("search", filters.search.trim());
    return authenticatedRequest<AvailableStudentsPage>(
      `/classes/${encodeURIComponent(classId)}/available-students?${params.toString()}`,
    );
  },
  assignClassStudent(
    classId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    return authenticatedRequest<Record<string, unknown>>(
      `/classes/${encodeURIComponent(classId)}/students`,
      { method: "POST", body: JSON.stringify({ userId }) },
    );
  },
  removeClassStudent(
    classId: string,
    studentId: string,
  ): Promise<Record<string, unknown>> {
    return authenticatedRequest<Record<string, unknown>>(
      `/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}`,
      { method: "DELETE" },
    );
  },
  getSubjectTeacherAssignments(
    filters: {
      classId?: string;
      subjectId?: string;
      teacherId?: string;
      search?: string;
    } = {},
  ): Promise<SubjectTeacherAssignment[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const query = params.toString();
    return authenticatedRequest<SubjectTeacherAssignment[]>(
      `/subject-teacher-assignments${query ? `?${query}` : ""}`,
    );
  },
  getTeacherAssignedClasses(): Promise<TeacherAssignedClass[]> {
    return authenticatedRequest<TeacherAssignedClass[]>(
      "/teacher/assigned-classes",
    );
  },
  getTeacherManagedStudents(): Promise<TeacherManagedStudent[]> {
    return authenticatedRequest<TeacherManagedStudent[]>("/teacher/students");
  },
  getStudentCourses(): Promise<StudentCourse[]> {
    return authenticatedRequest<StudentCourse[]>("/student/courses");
  },
  getStudentCourse(
    classId: string,
    subjectId: string,
  ): Promise<StudentCourseDetail> {
    return authenticatedRequest<StudentCourseDetail>(
      `/student/courses/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}`,
    );
  },
  getStudentMaterialDownloadUrl(
    materialId: string,
  ): Promise<{ url: string; expiresIn: number }> {
    return authenticatedRequest<{ url: string; expiresIn: number }>(
      `/student/materials/${encodeURIComponent(materialId)}/download-url`,
    );
  },
  getStudentMaterialPreviewUrl(
    materialId: string,
  ): Promise<{ url: string; expiresIn: number }> {
    return authenticatedRequest<{ url: string; expiresIn: number }>(
      `/student/materials/${encodeURIComponent(materialId)}/preview-url`,
    );
  },
  getTeacherAssignedClass(classId: string): Promise<TeacherAssignedClass> {
    return authenticatedRequest<TeacherAssignedClass>(
      `/teacher/assigned-classes/${encodeURIComponent(classId)}`,
    );
  },
  getClassTopics(classId: string, courseOfferingId?: string): Promise<ClassTopic[]> {
    return authenticatedRequest<ClassTopic[]>(
      `/teacher/assigned-classes/${encodeURIComponent(classId)}/topics`,
      courseOfferingId ? { headers: { "X-Course-Offering-ID": courseOfferingId } } : undefined,
    );
  },
  createClassTopic(
    classId: string,
    payload: ClassTopicInput,
  ): Promise<ClassTopic> {
    return authenticatedRequest<ClassTopic>(
      `/teacher/assigned-classes/${encodeURIComponent(classId)}/topics`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },
  updateClassTopic(
    topicId: string,
    payload: Partial<Omit<ClassTopicInput, "subjectId">>,
  ): Promise<ClassTopic> {
    return authenticatedRequest<ClassTopic>(
      `/teacher/class-topics/${encodeURIComponent(topicId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
  },
  deleteClassTopic(topicId: string): Promise<ClassTopic> {
    return authenticatedRequest<ClassTopic>(
      `/teacher/class-topics/${encodeURIComponent(topicId)}`,
      { method: "DELETE" },
    );
  },
  async uploadClassMaterial(topicId: string, file: File): Promise<LearningMaterial> {
    const contentType = courseResourceContentType(file);
    const session = await authenticatedRequest<{
      material: LearningMaterial;
      uploadUrl: string;
      method: "PUT";
      expiresIn: number;
    }>(
      `/teacher/class-topics/${encodeURIComponent(topicId)}/materials/upload-url`,
      {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          contentType,
          fileSize: file.size,
        }),
      },
    );
    const uploadResponse = await fetch(session.uploadUrl, {
      method: session.method,
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!uploadResponse.ok) throw new Error("Không thể tải tài liệu lên S3");
    return authenticatedRequest<LearningMaterial>(
      `/teacher/materials/${encodeURIComponent(session.material.id)}/confirm`,
      { method: "POST" },
    );
  },
  getMaterialLibrary(): Promise<LearningMaterial[]> {
    return authenticatedRequest<LearningMaterial[]>(
      "/teacher/material-library",
    );
  },
  async uploadLibraryMaterial(file: File): Promise<LearningMaterial> {
    const contentType = courseResourceContentType(file);
    const session = await authenticatedRequest<{
      material: LearningMaterial;
      uploadUrl: string;
      method: "PUT";
      expiresIn: number;
    }>("/teacher/material-library/upload-url", {
      method: "POST",
      body: JSON.stringify({
        fileName: file.name,
        contentType,
        fileSize: file.size,
      }),
    });
    const uploadResponse = await fetch(session.uploadUrl, {
      method: session.method,
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!uploadResponse.ok) throw new Error("Không thể tải tài liệu lên S3");
    return authenticatedRequest<LearningMaterial>(
      `/teacher/materials/${encodeURIComponent(session.material.id)}/confirm`,
      { method: "POST" },
    );
  },
  bulkAssignMaterials(
    materialIds: string[],
    targets: MaterialAssignmentTarget[],
  ): Promise<BulkMaterialAssignmentResult> {
    return authenticatedRequest<BulkMaterialAssignmentResult>(
      "/teacher/material-library/assign",
      {
        method: "POST",
        body: JSON.stringify({ materialIds, targets }),
      },
    );
  },
  removeMaterialFromTopic(
    topicId: string,
    materialId: string,
  ): Promise<{ topicId: string; materialId: string }> {
    return authenticatedRequest<{ topicId: string; materialId: string }>(
      `/teacher/class-topics/${encodeURIComponent(topicId)}/materials/${encodeURIComponent(materialId)}`,
      { method: "DELETE" },
    );
  },
  getMaterialDownloadUrl(
    materialId: string,
  ): Promise<{ url: string; expiresIn: number }> {
    return authenticatedRequest<{ url: string; expiresIn: number }>(
      `/teacher/materials/${encodeURIComponent(materialId)}/download-url`,
    );
  },
  getMaterialPreviewUrl(
    materialId: string,
  ): Promise<{ url: string; expiresIn: number }> {
    return authenticatedRequest<{ url: string; expiresIn: number }>(
      `/teacher/materials/${encodeURIComponent(materialId)}/preview-url`,
    );
  },
  deleteLearningMaterial(materialId: string): Promise<LearningMaterial> {
    return authenticatedRequest<LearningMaterial>(
      `/teacher/materials/${encodeURIComponent(materialId)}`,
      { method: "DELETE" },
    );
  },
  getTeacherAssignedClassRoster(classId: string): Promise<ClassRoster> {
    return authenticatedRequest<ClassRoster>(
      `/teacher/assigned-classes/${encodeURIComponent(classId)}/roster`,
    );
  },
  assignClassHomeroomTeacher(
    classId: string,
    teacherId: string,
  ): Promise<Record<string, unknown>> {
    return authenticatedRequest<Record<string, unknown>>(
      `/classes/${encodeURIComponent(classId)}/teachers`,
      { method: "POST", body: JSON.stringify({ userId: teacherId }) },
    );
  },
  removeClassHomeroomTeacher(
    classId: string,
    teacherId: string,
  ): Promise<Record<string, unknown>> {
    return authenticatedRequest<Record<string, unknown>>(
      `/classes/${encodeURIComponent(classId)}/teachers/${encodeURIComponent(teacherId)}`,
      { method: "DELETE" },
    );
  },
  createSubjectTeacherAssignment(
    payload: Pick<
      SubjectTeacherAssignment,
      "classId" | "subjectId" | "teacherId"
    >,
  ): Promise<SubjectTeacherAssignment> {
    return authenticatedRequest<SubjectTeacherAssignment>(
      "/subject-teacher-assignments",
      { method: "POST", body: JSON.stringify(payload) },
    );
  },
  updateSubjectTeacherAssignment(
    id: string,
    payload: Partial<
      Pick<
        SubjectTeacherAssignment,
        "classId" | "subjectId" | "teacherId" | "isActive"
      >
    >,
  ): Promise<SubjectTeacherAssignment> {
    return authenticatedRequest<SubjectTeacherAssignment>(
      `/subject-teacher-assignments/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
  },
  deleteSubjectTeacherAssignment(
    id: string,
  ): Promise<SubjectTeacherAssignment> {
    return authenticatedRequest<SubjectTeacherAssignment>(
      `/subject-teacher-assignments/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },
  createTopic(
    payload: Pick<Topic, "subjectId" | "name"> & { description?: string },
  ): Promise<Topic> {
    return authenticatedRequest<Topic>("/topics", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};

export const questionBankService = {
  getFolders(): Promise<QuestionFolder[]> {
    return authenticatedRequest<QuestionFolder[]>("/question-bank/folders");
  },
  createFolder(payload: {
    name: string;
    parentId?: string;
  }): Promise<QuestionFolder> {
    return authenticatedRequest<QuestionFolder>("/question-bank/folders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  renameFolder(id: string, name: string): Promise<QuestionFolder> {
    return authenticatedRequest<QuestionFolder>(
      `/question-bank/folders/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ name }) },
    );
  },
  deleteFolder(id: string): Promise<Record<string, never>> {
    return authenticatedRequest<Record<string, never>>(
      `/question-bank/folders/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },
  moveQuestionsToFolder(payload: {
    questionIds: string[];
    folderId: string | null;
  }): Promise<{ movedCount: number; folderId: string | null }> {
    return authenticatedRequest<{
      movedCount: number;
      folderId: string | null;
    }>("/question-bank/move-folder", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getQuestions(filters: QuestionFilters = {}): Promise<Question[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    const query = params.toString();
    return authenticatedRequest<Question[]>(
      `/question-bank${query ? `?${query}` : ""}`,
    );
  },
  getQuestionById(id: string): Promise<Question> {
    return authenticatedRequest<Question>(
      `/question-bank/${encodeURIComponent(id)}`,
    );
  },
  createQuestion(payload: QuestionInput): Promise<Question> {
    return authenticatedRequest<Question>("/question-bank", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateQuestion(
    id: string,
    payload: Partial<QuestionInput>,
  ): Promise<Question> {
    return authenticatedRequest<Question>(
      `/question-bank/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
  },
  deleteQuestion(id: string): Promise<Record<string, never>> {
    return authenticatedRequest<Record<string, never>>(
      `/question-bank/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },
  uploadQuestionImage(id: string, file: Blob): Promise<Question> {
    const formData = new FormData();
    formData.append("file", file, `question-${id}.png`);
    return authenticatedUploadRequest<Question>(
      `/question-bank/${encodeURIComponent(id)}/image`,
      formData,
      () => undefined,
    );
  },
  getQuestionImage(id: string): Promise<{ url: string }> {
    return authenticatedRequest<{ url: string }>(
      `/question-bank/${encodeURIComponent(id)}/image`,
    );
  },
  removeQuestionImage(id: string): Promise<Record<string, never>> {
    return authenticatedRequest<Record<string, never>>(
      `/question-bank/${encodeURIComponent(id)}/image`,
      { method: "DELETE" },
    );
  },
  moveQuestionsToTopic(
    payload: BulkMoveQuestionsInput,
  ): Promise<BulkMoveQuestionsResult> {
    return authenticatedRequest<BulkMoveQuestionsResult>(
      "/question-bank/move-topic",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },
};

export const aiQuestionService = {
  listJobs(): Promise<AiQuestionJob[]> {
    return authenticatedRequest<AiQuestionJob[]>("/ai-questions/jobs");
  },
  getJob(id: string): Promise<AiQuestionJob> {
    return authenticatedRequest<AiQuestionJob>(`/ai-questions/jobs/${encodeURIComponent(id)}`);
  },
  createJob(payload: GenerateAiQuestionsInput, key: string): Promise<AiQuestionJob> {
    return authenticatedRequest<AiQuestionJob>("/ai-questions/jobs", {
      method: "POST", body: JSON.stringify(payload), headers: { "Idempotency-Key": key },
    });
  },
  retryJob(id: string): Promise<AiQuestionJob> {
    return authenticatedRequest<AiQuestionJob>(`/ai-questions/jobs/${encodeURIComponent(id)}/retry`, { method: "POST" });
  },
  getDraft(): Promise<AiQuestionDraft | null> {
    return authenticatedRequest<AiQuestionDraft | null>("/ai-questions/draft");
  },
  saveDraft(payload: AiQuestionDraftInput): Promise<{ version: number; savedAt: string }> {
    return authenticatedRequest<{ version: number; savedAt: string }>("/ai-questions/draft", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  generate(
    payload: GenerateAiQuestionsInput,
  ): Promise<GeneratedQuestion[]> {
    return authenticatedRequest<GeneratedQuestion[]>(
      "/ai-questions/generate",
      {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Idempotency-Key": crypto.randomUUID() },
      },
    );
  },
  update(
    id: string,
    payload: UpdateGeneratedQuestionInput,
  ): Promise<GeneratedQuestion> {
    return authenticatedRequest<GeneratedQuestion>(
      `/ai-questions/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
  },
  regenerate(id: string): Promise<GeneratedQuestion> {
    return authenticatedRequest<GeneratedQuestion>(
      `/ai-questions/${encodeURIComponent(id)}/regenerate`,
      {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      },
    );
  },
  approve(
    id: string,
    folderId?: string,
  ): Promise<{ generatedQuestion: GeneratedQuestion; question: Question }> {
    return authenticatedRequest<{
      generatedQuestion: GeneratedQuestion;
      question: Question;
    }>(`/ai-questions/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      body: JSON.stringify(folderId ? { folderId } : {}),
    });
  },
  approveMany(questionIds: string[], folderId?: string): Promise<ApprovedAiQuestion[]> {
    return authenticatedRequest<ApprovedAiQuestion[]>(
      "/ai-questions/approve-bulk",
      {
        method: "POST",
        body: JSON.stringify({ questionIds, ...(folderId ? { folderId } : {}) }),
      },
    );
  },
  reject(id: string): Promise<GeneratedQuestion> {
    return authenticatedRequest<GeneratedQuestion>(
      `/ai-questions/${encodeURIComponent(id)}/reject`,
      {
        method: "POST",
      },
    );
  },
};

export const aiQuestionSettingsService = {
  getSystem(): Promise<SystemDifficultySettings> {
    return authenticatedRequest<SystemDifficultySettings>(
      "/ai-question-settings/system",
    );
  },
  updateSystem(
    levels: DifficultyLevelDefinition[],
    maxQuestionsPerGeneration: number,
  ): Promise<SystemDifficultySettings> {
    return authenticatedRequest<SystemDifficultySettings>(
      "/ai-question-settings/system",
      {
        method: "PUT",
        body: JSON.stringify({ levels, maxQuestionsPerGeneration }),
      },
    );
  },
  getMine(): Promise<TeacherDifficultySettings> {
    return authenticatedRequest<TeacherDifficultySettings>(
      "/ai-question-settings/me",
    );
  },
  updateMine(settings: {
    levels?: DifficultyLevelDefinition[];
    defaultQuantity?: number;
  }): Promise<TeacherDifficultySettings> {
    return authenticatedRequest<TeacherDifficultySettings>(
      "/ai-question-settings/me",
      {
        method: "PUT",
        body: JSON.stringify(settings),
      },
    );
  },
};

export const studentOverviewService = {
  getMyOverview(): Promise<StudentOverview> {
    return authenticatedRequest<StudentOverview>("/users/me/student-overview");
  },
};

export const teacherSettingsService = {
  getExamDefaults(): Promise<TeacherExamDefaultSettings> {
    return authenticatedRequest<TeacherExamDefaultSettings>(
      "/teacher-settings/exam-defaults",
    );
  },
  updateExamDefaults(
    examDefaults: TeacherExamDefaults,
  ): Promise<TeacherExamDefaultSettings> {
    return authenticatedRequest<TeacherExamDefaultSettings>(
      "/teacher-settings/exam-defaults",
      {
        method: "PUT",
        body: JSON.stringify(examDefaults),
      },
    );
  },
};

async function sha256Hex(file: Blob): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) return "";
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Go resolves definition and taxonomy from the owned bank; submitted snapshots
// from the editor are display data and must never be accepted as authority.
function examWriteInput<T extends ExamInput>(payload: T): T {
  return {
    ...payload,
    questions: payload.questions.map(({ questionId, points, order, answerMode }) => ({
      questionId, points, order,
      // Omitted means "type on screen"; only photo options are sent.
      ...(answerMode === "PHOTO" || answerMode === "BOTH" ? { answerMode } : {}),
    })),
  };
}

export const examService = {
  getLearningSupportOverview(
    options: boolean | { fresh?: boolean; from?: string; to?: string } = false,
  ): Promise<LearningSupportOverview> {
    const normalized =
      typeof options === "boolean" ? { fresh: options } : options;
    const query = new URLSearchParams();
    if (normalized.fresh) query.set("fresh", "true");
    if (normalized.from) query.set("from", normalized.from);
    if (normalized.to) query.set("to", normalized.to);
    const suffix = query.size ? `?${query.toString()}` : "";
    return authenticatedRequest<LearningSupportOverview>(
      `/exams/support/overview${suffix}`,
    );
  },
  getStudentEvidence(
    examId: string,
    studentId: string,
  ): Promise<StudentEvidenceResult> {
    return authenticatedRequest(
      `/exams/${encodeURIComponent(examId)}/students/${encodeURIComponent(studentId)}/evidence`,
    );
  },
  selectStudentBaseline(
    examId: string,
    studentId: string,
    input: { evidenceId: string; reason: string; expectedVersion: number },
  ): Promise<BaselineSelection> {
    return authenticatedRequest(
      `/exams/${encodeURIComponent(examId)}/students/${encodeURIComponent(studentId)}/baseline`,
      { method: "POST", body: JSON.stringify(input) },
    );
  },
  getExams(): Promise<Exam[]> {
    return authenticatedRequest<Exam[]>("/exams");
  },
  getExamById(id: string): Promise<Exam> {
    return authenticatedRequest<Exam>(`/exams/${encodeURIComponent(id)}`);
  },
  createExam(payload: ExamInput): Promise<Exam> {
    return authenticatedRequest<Exam>("/exams", {
      method: "POST",
      body: JSON.stringify(examWriteInput(payload)),
    });
  },
  updateExam(id: string, payload: ExamInput): Promise<Exam> {
    return authenticatedRequest<Exam>(`/exams/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(examWriteInput(payload)),
    });
  },
  publishExam(id: string): Promise<Exam> {
    return authenticatedRequest<Exam>(
      `/exams/${encodeURIComponent(id)}/publish`,
      { method: "POST" },
    );
  },
  publishExamResults(id: string): Promise<{ publishedStudents: number; resultStatus: "PUBLISHED" }> {
    return authenticatedRequest(`/exams/${encodeURIComponent(id)}/results/publish`, { method: "POST" });
  },
  regradeAnswerKey(id: string, payload: { questionId: string; correctOptionIds: string[]; reason: string }): Promise<{ regradedAttempts: number; changedGrades: number }> {
    return authenticatedRequest(`/exams/${encodeURIComponent(id)}/regrade-answer-key`, {
      method: "POST", body: JSON.stringify(payload),
    });
  },
  createMakeup(id: string, payload: ExamInput & { studentIds: string[]; reason: string; requestKey: string }): Promise<Exam> {
    return authenticatedRequest<Exam>(`/exams/${encodeURIComponent(id)}/makeup`, { method: 'POST', body: JSON.stringify(examWriteInput(payload)) });
  },
  resolveQuestion(id: string, payload: { questionId: string; mode: 'CORRECT_KEY' | 'FULL_CREDIT' | 'EXCLUDE';
    correctOptionIds?: string[]; expectedUpdatedAt: string; reason: string }): Promise<{ regradedAttempts: number; changedGrades: number }> {
    return authenticatedRequest(`/exams/${encodeURIComponent(id)}/question-resolution`, { method: 'POST', body: JSON.stringify(payload) });
  },
  deleteExam(id: string): Promise<Record<string, never>> {
    return authenticatedRequest<Record<string, never>>(
      `/exams/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },
  archiveExam(id: string): Promise<Exam> {
    return authenticatedRequest<Exam>(`/exams/${encodeURIComponent(id)}/archive`, { method: "POST" });
  },
  getSubmissions(id: string): Promise<ExamAttempt[]> {
    return authenticatedRequest<ExamAttempt[]>(
      `/exams/${encodeURIComponent(id)}/submissions`,
    );
  },
  getStudentEvidenceBundle(
    examId: string,
    studentId: string,
  ): Promise<StudyEvidenceBundle> {
    return authenticatedRequest<StudyEvidenceBundle>(
      `/exams/${encodeURIComponent(examId)}/students/${encodeURIComponent(studentId)}/evidence`,
    );
  },
  getTeacherStudyAnalysis(
    examId: string,
    studentId: string,
    attemptId: string,
  ): Promise<TeacherStudyAnalysis> {
    return authenticatedRequest(
      `/exams/${examId}/students/${studentId}/attempts/${attemptId}/study-analysis`,
    );
  },
  getTeacherStudyActivity(
    examId: string,
    studentId: string,
    attemptId: string,
  ): Promise<StudyActivityDashboard> {
    return authenticatedRequest<StudyActivityDashboard>(
      `/exams/${encodeURIComponent(examId)}/students/${encodeURIComponent(studentId)}/attempts/${encodeURIComponent(attemptId)}/study-activity`,
      { cache: "no-store" },
    );
  },
  regenerateTeacherStudyActivityReview(
    examId: string,
    studentId: string,
    attemptId: string,
  ): Promise<StudyActivityReview> {
    return authenticatedRequest<StudyActivityReview>(
      `/exams/${encodeURIComponent(examId)}/students/${encodeURIComponent(studentId)}/attempts/${encodeURIComponent(attemptId)}/study-activity/review`,
      { method: "POST" },
    );
  },
  getTeacherStudyPracticeAttempt(
    examId: string,
    studentId: string,
    attemptId: string,
    practiceAttemptId: string,
  ): Promise<StudyPracticeAttempt> {
    return authenticatedRequest<StudyPracticeAttempt>(
      `/exams/${encodeURIComponent(examId)}/students/${encodeURIComponent(studentId)}/attempts/${encodeURIComponent(attemptId)}/study-practice-attempts/${encodeURIComponent(practiceAttemptId)}`,
      { cache: "no-store" },
    );
  },
  createTeacherStudyAnalysis(
    examId: string,
    studentId: string,
    attemptId: string,
    refresh = false,
  ): Promise<TeacherStudyAnalysis> {
    return authenticatedRequest(
      `/exams/${examId}/students/${studentId}/attempts/${attemptId}/study-analysis${refresh ? "?refresh=true" : ""}`,
      { method: "POST" },
    );
  },
  suggestStudyTopics(
    examId: string,
    studentId: string,
    attemptId: string,
  ): Promise<TeacherStudyAnalysis> {
    return authenticatedRequest(
      `/exams/${examId}/students/${studentId}/attempts/${attemptId}/study-analysis/topic-suggestions`,
      { method: "POST" },
    );
  },
  submitTeacherAiFeedback(
    examId: string,
    studentId: string,
    attemptId: string,
    input: {
      targetKey: string;
      expectedAnalysisVersion: number;
      reason: StudyAiFeedback["reason"];
      comment?: string;
    },
  ): Promise<StudyAiFeedback> {
    return authenticatedRequest(
      `/exams/${examId}/students/${studentId}/attempts/${attemptId}/study-analysis/feedback`,
      { method: "POST", body: JSON.stringify(input) },
    );
  },
  reviewStudyAi(
    examId: string,
    studentId: string,
    attemptId: string,
    input: {
      targetKey: string;
      expectedAnalysisVersion: number;
      decision: StudyAiReview["decision"];
      effectiveText?: string;
      reason: string;
      expectedVersion: number;
    },
  ): Promise<StudyAiReview> {
    return authenticatedRequest(
      `/exams/${examId}/students/${studentId}/attempts/${attemptId}/study-analysis/review`,
      { method: "PATCH", body: JSON.stringify(input) },
    );
  },
  selectStudentBaselineRecord(
    examId: string,
    studentId: string,
    input: { evidenceId: string; reason: string; expectedVersion: number },
  ): Promise<BaselineSelectionRecord> {
    return authenticatedRequest<BaselineSelectionRecord>(
      `/exams/${encodeURIComponent(examId)}/students/${encodeURIComponent(studentId)}/baseline`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },
  getClassReport(id: string): Promise<ExamClassReport> {
    return authenticatedRequest<ExamClassReport>(
      `/exams/${encodeURIComponent(id)}/class-report`,
    );
  },
  getClassAnalysis(id: string, fresh = false): Promise<ExamClassAnalysisState> {
    return authenticatedRequest<ExamClassAnalysisState>(
      `/exams/${encodeURIComponent(id)}/class-report/ai-analysis${fresh ? "?fresh=true" : ""}`,
    );
  },
  getSubjectSupport(id: string, fresh = false): Promise<SubjectSupportReport> {
    return authenticatedRequest<SubjectSupportReport>(
      `/exams/${encodeURIComponent(id)}/subject-support${fresh ? "?fresh=true" : ""}`,
    );
  },
  sendSupportAlert(
    id: string,
    payload: {
      studentId: string;
      audience: "STUDENT" | "PARENTS";
      version: string;
      message: string;
    },
  ): Promise<{ id: string; recipientCount: number; alreadySent: boolean }> {
    return authenticatedRequest(
      `/exams/${encodeURIComponent(id)}/subject-support/alerts`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  },
  analyzeClassReport(
    id: string,
    refresh = false,
  ): Promise<ExamClassAnalysisState> {
    return authenticatedRequest<ExamClassAnalysisState>(
      `/exams/${encodeURIComponent(id)}/class-report/ai-analysis`,
      { method: "POST", body: JSON.stringify({ refresh }) },
    );
  },
  analyzeExamList(payload: {
    classId: string;
    examIds: string[];
  }): Promise<ExamListAiAnalysis> {
    return authenticatedRequest<ExamListAiAnalysis>("/exams/list/ai-analysis", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateStudentReview(
    examId: string,
    studentId: string,
    payload: { comment: string; status: "DRAFT" | "PUBLISHED" },
  ): Promise<ExamClassReportReview> {
    return authenticatedRequest<ExamClassReportReview>(
      `/exams/${encodeURIComponent(examId)}/students/${encodeURIComponent(studentId)}/review`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
  },
  createInsightAction(
    examId: string,
    payload: ExamInsightActionInput,
  ): Promise<ExamInsightActionResult> {
    return authenticatedRequest<ExamInsightActionResult>(
      `/exams/${encodeURIComponent(examId)}/class-report/actions`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },
};

export const examAttemptService = {
  startStudyPractice(
    id: string,
    attemptId: string,
    mode: StudyPracticeMode,
  ): Promise<StudyPracticeSet> {
    return authenticatedRequest(
      `/study-practice-sets/${encodeURIComponent(id)}/start`,
      { method: "POST", body: JSON.stringify({ attemptId, mode }) },
    );
  },
  getStudyPracticeAttempt(
    id: string,
    attemptId: string,
  ): Promise<StudyPracticeAttempt> {
    return authenticatedRequest(
      `/study-practice-sets/${encodeURIComponent(id)}/attempts/${encodeURIComponent(attemptId)}`,
    );
  },
  getStudyPracticeAttemptById(
    attemptId: string,
  ): Promise<StudyPracticeAttempt> {
    return authenticatedRequest(
      `/study-practice-attempts/${encodeURIComponent(attemptId)}`,
    );
  },
  startExam(examId: string, accessCode?: string): Promise<ExamAttempt> {
    return authenticatedRequest<ExamAttempt>(
      `/exams/${encodeURIComponent(examId)}/attempts`,
      {
        method: "POST",
        body: JSON.stringify(accessCode ? { accessCode } : {}),
      },
    );
  },
  getAttempt(id: string): Promise<ExamAttempt & { exam: Exam }> {
    return authenticatedRequest<ExamAttempt & { exam: Exam }>(
      `/exam-attempts/${encodeURIComponent(id)}`,
    );
  },
  saveAnswer(id: string, answer: ExamAnswer): Promise<ExamAttempt> {
    return authenticatedRequest<ExamAttempt>(
      `/exam-attempts/${encodeURIComponent(id)}/answer`,
      {
        method: "PATCH",
        body: JSON.stringify(answer),
      },
    );
  },
  /** Pre-signed upload of one photographed page, then server-side verification. */
  async uploadAnswerPhoto(attemptId: string, questionId: string, file: File): Promise<ExamAnswerFile> {
    const session = await authenticatedRequest<{ file: ExamAnswerFile; uploadUrl: string }>(
      `/exam-attempts/${encodeURIComponent(attemptId)}/questions/${encodeURIComponent(questionId)}/files/upload-url`,
      { method: "POST", body: JSON.stringify({ fileName: file.name, contentType: file.type, fileSize: file.size, sha256: await sha256Hex(file) }) },
    );
    const response = await fetch(session.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    if (!response.ok) throw new Error("Không tải được ảnh lên. Hãy kiểm tra mạng và thử lại.");
    return authenticatedRequest<ExamAnswerFile>(`/student/exam-answer-files/${encodeURIComponent(session.file.id)}/confirm`, { method: "POST" });
  },
  deleteAnswerPhoto(fileId: string): Promise<{ deleted: boolean }> {
    return authenticatedRequest<{ deleted: boolean }>(`/student/exam-answer-files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
  },
  /** A one-minute URL to view a photo (the student's own, or a teacher's class). */
  answerPhotoUrl(fileId: string): Promise<{ url: string; expiresIn: number }> {
    return authenticatedRequest<{ url: string; expiresIn: number }>(`/exam-answer-files/${encodeURIComponent(fileId)}/access`);
  },
  submitExam(id: string, answers: ExamAnswer[]): Promise<ExamAttempt> {
    return authenticatedRequest<ExamAttempt>(
      `/exam-attempts/${encodeURIComponent(id)}/submit`,
      {
        method: "POST",
        body: JSON.stringify({ answers }),
      },
    );
  },
  gradeEssay(id: string, questionId: string, payload: { score: number; feedback?: string; reason: string }): Promise<ExamAttempt & { exam: Exam }> {
    return authenticatedRequest<ExamAttempt & { exam: Exam }>(`/exam-attempts/${encodeURIComponent(id)}/essay-grades/${encodeURIComponent(questionId)}`, {
      method: "PATCH", body: JSON.stringify(payload),
    });
  },
  finalizeManual(id: string, reason: string): Promise<ExamAttempt & { exam: Exam }> {
    return authenticatedRequest<ExamAttempt & { exam: Exam }>(`/exam-attempts/${encodeURIComponent(id)}/finalize`, {
      method: "POST", body: JSON.stringify({ reason }),
    });
  },
  createStudyAnalysis(id: string): Promise<StudyAnalysis> {
    return authenticatedRequest<StudyAnalysis>(
      `/exam-attempts/${encodeURIComponent(id)}/study-analysis`,
      { method: "POST" },
    );
  },
  retryStudyAnalysis(id: string): Promise<StudyAnalysis> {
    return authenticatedRequest<StudyAnalysis>(
      `/exam-attempts/${encodeURIComponent(id)}/study-analysis/retry`,
      { method: "POST" },
    );
  },
  getStudyAnalysis(id: string): Promise<StudyAnalysis> {
    return authenticatedRequest<StudyAnalysis>(
      `/exam-attempts/${encodeURIComponent(id)}/study-analysis`,
    );
  },
  getStudyActivity(id: string): Promise<StudyActivityDashboard> {
    return authenticatedRequest<StudyActivityDashboard>(
      `/exam-attempts/${encodeURIComponent(id)}/study-activity`,
    );
  },
  openStudyMaterial(id: string, materialId: string): Promise<{ id: string; url: string; expiresIn: number }> {
    return authenticatedRequest(
      `/exam-attempts/${encodeURIComponent(id)}/study-activity/materials/${encodeURIComponent(materialId)}/open`,
      { method: "POST" },
    );
  },
  updateStudyMaterialView(id: string, viewId: string, close = false, visible = true): Promise<{ activeSeconds: number; closedAt: string | null }> {
    return authenticatedRequest(
      `/exam-attempts/${encodeURIComponent(id)}/study-activity/views/${encodeURIComponent(viewId)}/${close ? "close" : "ping"}`,
      { method: "POST", body: JSON.stringify({ visible }) },
    );
  },
  submitStudyAiFeedback(
    id: string,
    input: {
      targetKey: string;
      expectedAnalysisVersion: number;
      reason: StudyAiFeedback["reason"];
      comment?: string;
    },
  ): Promise<StudyAiFeedback> {
    return authenticatedRequest(
      `/exam-attempts/${id}/study-analysis/feedback`,
      { method: "POST", body: JSON.stringify(input) },
    );
  },
  submitStudyPractice(
    id: string,
    attemptId: string,
    answers: Array<{ questionId: string; selectedOptionIds: string[]; falseOptionIds?: string[]; essayText?: string }>,
  ): Promise<StudyPracticeSet> {
    return authenticatedRequest<StudyPracticeSet>(
      `/study-practice-sets/${encodeURIComponent(id)}/submit`,
      { method: "POST", body: JSON.stringify({ attemptId, answers }) },
    );
  },
  retryStudyPractice(
    id: string,
    attemptId: string,
    practiceType: "WRONG_QUESTIONS" | "SOURCE_REGION" = "SOURCE_REGION",
  ): Promise<StudyPracticeSet> {
    return authenticatedRequest<StudyPracticeSet>(
      `/study-practice-sets/${encodeURIComponent(id)}/retry`,
      { method: "POST", body: JSON.stringify({ attemptId, practiceType }) },
    );
  },
  getStudyPracticeHint(
    practiceSetId: string,
    questionId: string,
    attemptId: string,
  ): Promise<{ questionId: string; message: string }> {
    return authenticatedRequest<{ questionId: string; message: string }>(
      `/study-practice-sets/${encodeURIComponent(practiceSetId)}/questions/${encodeURIComponent(questionId)}/hint`,
      {
        method: "POST",
        body: JSON.stringify({ attemptId }),
      },
    );
  },
};

export const learningPlanService = {
  prepareMaterial(
    examId: string,
    studentId: string,
    materialId: string,
  ): Promise<import("@/types/assessment").MaterialPlanProposal> {
    return authenticatedRequest(
      `/study-material-plans/teacher/exams/${encodeURIComponent(examId)}/prepare`,
      { method: "POST", body: JSON.stringify({ studentId, materialId }) },
    );
  },
  getPracticeSet(id: string): Promise<StudyPracticeSet> {
    return authenticatedRequest(`/study-practice-sets/${encodeURIComponent(id)}`);
  },
  cohortProgress(cohortId: string): Promise<import("@/types/assessment").LearningCohortProgress> {
    return authenticatedRequest(`/learning-plans/teacher/cohorts/${encodeURIComponent(cohortId)}/progress`);
  },
  upgradeMaterial(planId: string): Promise<LearningPlan> {
    return authenticatedRequest(`/learning-plans/teacher/${encodeURIComponent(planId)}/upgrade-material`, { method: "POST" });
  },
  listObjectives(examId: string): Promise<LearningObjectiveEvidence[]> {
    return authenticatedRequest(
      `/learning-plans/teacher/exams/${encodeURIComponent(examId)}/objectives`,
    );
  },
  suggest(
    examId: string,
    studentId: string,
    objectiveId: string,
  ): Promise<
    LearningPlanDraftInput & { source: string; evidence: string | null }
  > {
    return authenticatedRequest(
      `/learning-plans/teacher/exams/${examId}/suggestions`,
      { method: "POST", body: JSON.stringify({ studentId, objectiveId }) },
    );
  },
  createDrafts(
    examId: string,
    input: LearningPlanDraftInput,
  ): Promise<{ cohortId: string; plans: LearningPlan[] }> {
    return authenticatedRequest(`/learning-plans/teacher/exams/${examId}`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  publishCohort(
    cohortId: string,
  ): Promise<{
    cohortId: string;
    published: string[];
    failed: Array<{ planId: string; studentId: string; reason: string }>;
  }> {
    return authenticatedRequest(
      `/learning-plans/teacher/cohorts/${encodeURIComponent(cohortId)}/publish`,
      { method: "POST" },
    );
  },
  listTeacher(examId: string): Promise<LearningPlan[]> {
    return authenticatedRequest(`/learning-plans/teacher/exams/${examId}`);
  },
  listForScope(
    classId: string,
    subjectId: string,
    courseOfferingId?: string | null,
  ): Promise<LearningPlanScopeItem[]> {
    return authenticatedRequest(
      `/learning-plans/teacher/scopes/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}`,
      courseOfferingId ? { headers: { "X-Course-Offering-ID": courseOfferingId } } : undefined,
    );
  },
  getTeacher(planId: string): Promise<LearningPlan> {
    return authenticatedRequest(`/learning-plans/teacher/${planId}`);
  },
  getTeacherPracticePreview(planId: string): Promise<TeacherPracticePreview> {
    return authenticatedRequest(
      `/learning-plans/teacher/${encodeURIComponent(planId)}/practice-preview`,
    );
  },
  updatePlan(
    planId: string,
    input: {
      expectedVersion: number;
      reason: string;
      title?: string;
      summary?: string;
      successCriteria?: string;
      targetAccuracyPercent?: number;
      dueAt?: string;
    },
  ): Promise<LearningPlan> {
    return authenticatedRequest(`/learning-plans/teacher/${planId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  publish(planId: string, expectedVersion: number): Promise<LearningPlan> {
    return authenticatedRequest(`/learning-plans/teacher/${planId}/publish`, {
      method: "POST",
      body: JSON.stringify({ expectedVersion }),
    });
  },
  cancel(
    planId: string,
    expectedVersion: number,
    reason: string,
  ): Promise<LearningPlan> {
    return authenticatedRequest(`/learning-plans/teacher/${planId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ expectedVersion, reason }),
    });
  },
  updateTask(
    taskId: string,
    input: {
      expectedVersion: number;
      reason: string;
      title?: string;
      description?: string;
      dueAt?: string;
      status?: "ASSIGNED" | "CANCELLED";
    },
  ): Promise<LearningTask> {
    return authenticatedRequest(`/learning-plans/teacher/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  listMine(): Promise<LearningPlan[]> {
    return authenticatedRequest("/learning-plans/me");
  },
  getMine(planId: string): Promise<LearningPlan> {
    return authenticatedRequest(`/learning-plans/${planId}`);
  },
  startTask(
    planId: string,
    taskId: string,
  ): Promise<{ actionUrl: string | null; taskId: string }> {
    return authenticatedRequest(
      `/learning-plans/${planId}/tasks/${taskId}/start`,
      { method: "POST" },
    );
  },
  completeMaterial(
    planId: string,
    taskId: string,
  ): Promise<LearningTask["progress"]> {
    return authenticatedRequest(
      `/learning-plans/${planId}/tasks/${taskId}/complete`,
      { method: "POST" },
    );
  },
  reportDifficulty(
    planId: string,
    taskId: string,
    note: string,
  ): Promise<import("@/types/assessment").LearningSupportRequest> {
    return authenticatedRequest(
      `/learning-plans/${planId}/tasks/${taskId}/difficulty`,
      { method: "POST", body: JSON.stringify({ note }) },
    );
  },
  getTeacherImprovement(planId: string): Promise<LearningImprovementProfile> {
    return authenticatedRequest(
      `/learning-plans/teacher/${planId}/improvement`,
    );
  },
  getMyImprovement(planId: string): Promise<LearningImprovementProfile> {
    return authenticatedRequest(`/learning-plans/${planId}/improvement`);
  },
  assignReassessment(
    planId: string,
    phase: "AFTER" | "RETENTION",
    input: {
      examId: string;
      minimumQuestions: number;
      equivalenceRationale: string;
      scheduledFor?: string;
      dueAt?: string;
      expectedPlanVersion: number;
      expectedVersion?: number;
    },
  ): Promise<LearningReassessment> {
    return authenticatedRequest(
      `/learning-plans/teacher/${planId}/reassessments/${phase}`,
      { method: "POST", body: JSON.stringify(input) },
    );
  },
  reviewReassessment(
    planId: string,
    phase: "AFTER" | "RETENTION",
    input: {
      evidenceId: string;
      equivalenceConfirmed: boolean;
      decision: "CONFIRMED" | "NEEDS_ADJUSTMENT";
      reason: string;
      expectedVersion: number;
    },
  ): Promise<{
    comparison: ImprovementComparison;
    planStatus: LearningPlan["status"];
    commentary: string | null;
  }> {
    return authenticatedRequest(
      `/learning-plans/teacher/${planId}/reassessments/${phase}/review`,
      { method: "POST", body: JSON.stringify(input) },
    );
  },
  classImprovementReport(filters: {
    classId: string;
    subjectId: string;
    from?: string;
    to?: string;
    objectiveId?: string;
    cohortId?: string;
  }): Promise<ClassImprovementReport> {
    const query = new URLSearchParams(
      Object.entries(filters).filter((entry): entry is [string, string] =>
        Boolean(entry[1]),
      ),
    );
    return authenticatedRequest(
      `/learning-plans/teacher/report?${query.toString()}`,
    );
  },
};
