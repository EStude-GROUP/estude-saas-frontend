import { RoleGate } from "@/components/auth/role-gate";
import { QuestionTrashPage } from "@/components/assessment/question-trash-page";

export default function QuestionTrashRoute() {
  return <RoleGate allowedRole="TEACHER"><QuestionTrashPage /></RoleGate>;
}
