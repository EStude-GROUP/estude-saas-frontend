import { ExamPrintPage } from "@/components/assessment/exam-print-page";
import { RoleGate } from "@/components/auth/role-gate";

export default function SetPrintPageRoute() {
  return <RoleGate allowedRole="TEACHER"><ExamPrintPage /></RoleGate>;
}
