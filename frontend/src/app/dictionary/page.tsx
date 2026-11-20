import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { SignDictionary } from "@/features/dictionary/SignDictionary";

export const metadata: Metadata = { title: "Sign dictionary" };

export default function SignDictionaryPage() {
  return (
    <>
      <PageHeader
        title="Sign dictionary"
        lead="Look up any of about 3,500 documented Bangla Sign Language words. A 3D signer performs the sign from its written description, and Prism spells out each part: handshape, where it starts and how it moves."
        audience={["Deaf learners", "Families learning to sign", "Teachers"]}
      />
      <SignDictionary />
    </>
  );
}
