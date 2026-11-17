import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { StudyDashboard } from "@/features/study/StudyDashboard";

export const metadata: Metadata = { title: "Study" };

export default function StudyPage() {
  return (
    <>
      <PageHeader
        title="Study"
        lead="Give each participant the same task with and without Prism, then compare comprehension, completion, time and usability."
        audience={["Teachers", "Researchers"]}
      />
      <StudyDashboard />
    </>
  );
}
