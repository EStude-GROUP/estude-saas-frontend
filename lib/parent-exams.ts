import { toVietnameseSubjectName } from "@/lib/subject-localization";
import type { ParentOverview } from "@/types/engagement";

export function parentExamRows(overview: ParentOverview) {
  return [...overview.upcomingExams].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)).map((exam) => {
    const report = overview.studentReports?.find((item) => item.student.id === exam.studentId)
      ?? (!exam.studentId && overview.studentReports?.length === 1 ? overview.studentReports[0] : undefined);
    const date = Date.parse(exam.startsAt);
    // The calendar API has no term ID. Only show a term when this child's
    // report has one unambiguous interval containing the entire exam window.
    const matchingTerms = report?.semesterResults.filter((item) => {
      const start = Date.parse(item.startsAt);
      const end = Date.parse(item.endsAt);
      const examEnd = Date.parse(exam.endsAt);
      return Number.isFinite(date) && Number.isFinite(start) && Number.isFinite(end) && Number.isFinite(examEnd) && date >= start && date < end && examEnd <= end;
    }) ?? [];
    const term = matchingTerms.length === 1 ? matchingTerms[0] : undefined;
    const matchingEnrollments = report?.enrollments.filter((item) => item.class.id === exam.classId) ?? [];
    const enrollment = matchingEnrollments.length === 1 ? matchingEnrollments[0] : undefined;
    return {
      ...exam,
      subjectName: toVietnameseSubjectName(exam.subjectName),
      termId: term?.id ?? "",
      termName: term?.name ?? "—",
      academicYearName: term?.academicYearName || enrollment?.academicYear?.name || "",
    };
  });
}

export type ParentExamRow = ReturnType<typeof parentExamRows>[number];
