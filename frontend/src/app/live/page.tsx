import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { LiveClass } from "@/features/live/LiveClass";

export const metadata: Metadata = { title: "Live class" };

export default function LivePage() {
  return (
    <>
      <PageHeader
        title="Live class"
        lead="The teacher shares their camera or slides. Every student gets the video, live captions, a saved transcript, and a spoken description of the screen on request."
        audience={["Deaf & hard of hearing", "Blind & low vision"]}
      />
      <LiveClass />
    </>
  );
}
