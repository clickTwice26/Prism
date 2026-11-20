import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { LessonView } from "@/features/lessons/LessonView";

export const metadata: Metadata = { title: "Lessons" };

export default function LessonsPage() {
  return (
    <>
      <PageHeader
        title="Lessons"
        lead="Read the class lesson in your language. Key words have their Bangla Sign Language sign, and a sign interpreter can sign the whole lesson beside the text."
        audience={["Deaf", "Hard of hearing"]}
      />
      <LessonView />
    </>
  );
}
