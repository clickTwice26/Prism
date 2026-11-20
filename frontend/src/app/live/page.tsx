import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { LiveClass } from "@/features/live/LiveClass";

export const metadata: Metadata = { title: "Live class" };

export default function LivePage() {
  return (
    <>
      <PageHeader
        title="Live class"
        lead="The teacher shares their camera or slides. Students get the video, live captions and a saved transcript with key words linked to their signs. A Bangla Sign Language interpreter can join from anywhere and sign in a window students can move and resize."
        audience={["Deaf & hard of hearing", "Sign interpreters"]}
      />
      <LiveClass />
    </>
  );
}
