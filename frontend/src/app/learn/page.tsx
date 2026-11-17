import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { AdaptiveLesson } from "@/features/learn/AdaptiveLesson";

export const metadata: Metadata = { title: "Adaptive lesson" };

export default function LearnPage() {
  return (
    <>
      <PageHeader
        title="Adaptive lesson"
        lead="The lesson comes one short part at a time, each with a quick question. Prism keeps the supports that help this learner understand, not just the ones their profile suggests."
        audience={["Every learner"]}
      />
      <AdaptiveLesson />
    </>
  );
}
