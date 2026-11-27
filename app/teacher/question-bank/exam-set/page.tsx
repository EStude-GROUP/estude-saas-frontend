import { RoleGate } from "@/components/auth/role-gate";
import { AiExamSetPage } from "@/components/assessment/ai-exam-set-page";

export default function AiExamSetRoute() {
  return <RoleGate allowedRole="TEACHER"><AiExamSetPage /></RoleGate>;
}
