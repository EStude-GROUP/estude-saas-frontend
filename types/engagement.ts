export type AttendanceStatus =
  | "NOT_MARKED"
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "EXCUSED"
  | "LEAVE";
export type AttendanceSessionStatus = "DRAFT" | "OPEN" | "FINALIZED";

export interface AttendanceVersion {
  expectedUpdatedAt: string;
  expectedReopenedCount: number;
}

export interface AttendanceRecord {
  id: string;
  sessionId?: string | null;
  classId: string;
  subjectId: string;
  teacherId?: string;
  studentId: string;
  termId?: string | null;
  sessionDate: string;
  status: AttendanceStatus;
  note?: string;
  startTime?: string | null;
  endTime?: string | null;
  period?: string | null;
  label?: string | null;
  legacy?: boolean;
  markedAt: string | null;
  class?: { id: string; code: string; name: string } | null;
  subject?: { id: string; name: string } | null;
  term?: { id: string; name: string } | null;
}

export interface AttendanceSession {
  id: string;
  classId: string;
  subjectId: string;
  termId: string;
  sessionDate: string;
  slotKey: string;
  startTime: string | null;
  endTime: string | null;
  period: string | null;
  label: string | null;
  status: AttendanceSessionStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  reopenedCount: number;
  _count?: { recipients: number; records: number };
}
export type AttendanceHistoryRecord = Omit<AttendanceRecord, "status"> & {
  status: AttendanceStatus | "UNDER_REVIEW";
};

export interface AttendanceSessionDetail {
  session: AttendanceSession;
  students: Array<{
    id: string;
    fullName: string;
    accountName: string;
    assignedAt: string;
    status: AttendanceStatus;
    attendance: (AttendanceRecord & { note: string }) | null;
  }>;
  summary: Record<AttendanceStatus, number>;
}

export interface AttendanceAudit {
  id: string;
  sessionId: string;
  studentId: string | null;
  action:
    | "MARK_CREATED"
    | "MARK_UPDATED"
    | "SESSION_OPENED"
    | "SESSION_FINALIZED"
    | "SESSION_REOPENED";
  oldStatus: AttendanceStatus | null;
  newStatus: AttendanceStatus | null;
  oldNote: string | null;
  newNote: string | null;
  actorId: string;
  reason: string;
  createdAt: string;
}

export interface AttendanceRoster {
  date: string;
  class: { id: string; code: string; name: string } | null;
  subject: { id: string; name: string } | null;
  students: Array<{
    id: string;
    fullName: string;
    accountName: string;
    avatarUrl: string | null;
    status: string;
    attendance: AttendanceRecord | null;
  }>;
}

export interface PortalNotification {
  id: string;
  senderId: string;
  senderName: string;
  kind: "CLASS_STUDENTS" | "CLASS_PARENTS" | "SYSTEM";
  classId: string | null;
  studentId?: string | null;
  subjectId: string | null;
  examId: string | null;
  actionUrl: string | null;
  targetRole: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT" | null;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}

export interface ParentOverview {
  studentReports?: import("@/types/student-overview").StudentOverview[];
  children: Array<{
    id: string;
    fullName: string;
    accountName: string;
    avatarUrl: string | null;
  }>;
  attendance: Array<AttendanceHistoryRecord & { studentName: string }>;
  upcomingExams: Array<{
    id: string;
    title: string;
    subjectName: string;
    classId: string;
    className: string;
    studentId?: string;
    startsAt: string;
    endsAt: string;
  }>;
  notifications: PortalNotification[];
  learningAlerts?: PortalNotification[];
}
