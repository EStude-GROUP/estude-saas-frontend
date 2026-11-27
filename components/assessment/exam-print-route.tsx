"use client";

import { ExamPrintPage } from "@/components/assessment/exam-print-page";
import { useParams } from "@/lib/portal-navigation";

export function ExamPrintRoute() {
  const params = useParams<{ id: string }>();
  return <ExamPrintPage examId={params.id} />;
}
