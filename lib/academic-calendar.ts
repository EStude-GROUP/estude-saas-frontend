import type { AcademicYear, Term } from "@/types/assessment";
import type { CourseOffering } from "@/lib/course-offering-api";

export function termsForYear(terms: Term[], yearId: string) {
  return terms.filter((term) => term.academicYearId === yearId && !term.deletedAt)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.startsAt.localeCompare(b.startsAt));
}

export function termAction(term: Term, year: AcademicYear, terms: Term[]) {
  if (year.status === "COMPLETED" || term.status === "LOCKED") return null;
  if (term.status === "UPCOMING") {
    const active = terms.find((other) => other.id !== term.id && other.status === "ACTIVE");
    return {
      target: "ACTIVE" as const, label: "Bắt đầu học kỳ",
      description: "Học kỳ sẽ được mở để giảng dạy, giao bài và ghi nhận kết quả học tập.",
      blocked: year.status !== "ACTIVE" ? "Cần kích hoạt năm học trước khi bắt đầu học kỳ."
        : active ? `Cần kết thúc ${active.name} trước khi bắt đầu học kỳ này.` : "",
    };
  }
  return term.status === "ACTIVE" ? {
    target: "COMPLETED" as const, label: "Kết thúc học kỳ", blocked: "",
    description: "Kết thúc giai đoạn giảng dạy. Giáo viên vẫn có thể hoàn tất chấm và công bố kết quả trước khi khóa kỳ.",
  } : {
    target: "LOCKED" as const, label: "Khóa học kỳ", blocked: "",
    description: "Chốt kết quả học kỳ. Sau khi khóa, dữ liệu học kỳ chỉ được xem và không thể chỉnh sửa.",
  };
}

export function courseSummary(courses: CourseOffering[]) {
  return {
    courses: courses.length,
    classes: new Set(courses.map((course) => course.primaryClassId)).size,
    teachers: new Set(courses.flatMap((course) => course.activeTeachers.map((teacher) => teacher.teacherId))).size,
    enrollments: courses.reduce((sum, course) => sum + course.activeStudentCount, 0),
    open: courses.filter((course) => course.status === "OPEN").length,
  };
}

export function courseCalendarFilters(search: string) {
  const params = new URLSearchParams(search);
  const status = params.get("status") ?? "";
  return {
    classId: params.get("classId") ?? "", yearId: params.get("academicYearId") ?? "",
    termId: params.get("termId") ?? "", status: ["DRAFT", "OPEN", "CLOSED", "ARCHIVED"].includes(status) ? status : "",
  };
}
