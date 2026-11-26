import { ExamPrintRoute } from "@/components/assessment/exam-print-route";
import { RoleGate } from "@/components/auth/role-gate";

export default function ExamPrintPageRoute() {
  return <RoleGate allowedRole="TEACHER"><ExamPrintRoute /></RoleGate>;
}
