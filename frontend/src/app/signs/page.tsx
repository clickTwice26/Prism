import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { SignWords } from "@/features/signwords/SignWords";

export const metadata: Metadata = { title: "Sign words" };

export default function SignWordsPage() {
  return (
    <>
      <PageHeader
        title="Sign words"
        lead="Sign an everyday, school or health word in Bangla Sign Language. Prism checks your handshape, where the sign starts, how your hand moves and which way it points, and tells you which part to fix."
        audience={["Deaf learners", "Families learning to sign", "Signers recording samples"]}
      />
      <SignWords />
    </>
  );
}
