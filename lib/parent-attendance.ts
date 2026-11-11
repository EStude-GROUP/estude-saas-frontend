import { getVietnameseSubjectName } from "@/lib/subject-localization";
import type { ParentOverview } from "@/types/engagement";

export const parentAttendanceStatuses: Record<string, string> = {
  PRESENT: "Có mặt",
  ABSENT: "Vắng",
  LATE: "Đi muộn",
  EXCUSED: "Vắng có phép",
  LEAVE: "Nghỉ phép",
  NOT_MARKED: "Chưa điểm danh",
  UNDER_REVIEW: "Đang rà soát",
};

export function parentAttendanceRows(overview: ParentOverview) {
  return overview.attendance.map((item) => {
    // Resolve the session's term for this child; never infer it from today's date
    // or from the child's current class/enrollment.
    const termId = item.termId || item.term?.id || "";
    const report = overview.studentReports?.find((entry) => entry.student.id === item.studentId);
    const term = termId ? report?.semesterResults.find((entry) => entry.id === termId) : undefined;
    return {
      ...item,
      termId,
      subjectId: item.subjectId || item.subject?.id || "",
      classId: item.classId || item.class?.id || "",
      subjectName: item.subject ? getVietnameseSubjectName(item.subject) : "—",
      className: item.class?.code || item.class?.name || "—",
      termName: item.term?.name || term?.name || "—",
      academicYearName: term?.academicYearName || "",
      statusName: parentAttendanceStatuses[item.status] ?? item.status,
    };
  });
}

export type ParentAttendanceRow = ReturnType<typeof parentAttendanceRows>[number];
