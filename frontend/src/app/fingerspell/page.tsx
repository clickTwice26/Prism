import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { Fingerspell } from "@/features/fingerspell/Fingerspell";

export const metadata: Metadata = { title: "Fingerspell" };

export default function FingerspellPage() {
  return (
    <>
      <PageHeader
        title="Fingerspell"
        lead="Spell a word with the Bangla two-hand alphabet and Prism types it. Prism checks each part of a letter (both handshapes, where the hands touch and which way they point) and tells you which part to fix."
        audience={["Deaf learners", "Families learning to sign", "Signers recording samples"]}
      />
      <Fingerspell />
    </>
  );
}
