import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { SimplifyPanel } from "@/features/simplify/SimplifyPanel";

export const metadata: Metadata = { title: "Simplify" };

export default function SimplifyPage() {
  return (
    <>
      <PageHeader
        title="Simplify"
        lead="Turn hard lesson text into short, plain sentences. Every simple version is checked against the original for missing or changed facts."
        audience={["Intellectual disability", "Autism", "Slow readers"]}
      />
      <SimplifyPanel />
    </>
  );
}
