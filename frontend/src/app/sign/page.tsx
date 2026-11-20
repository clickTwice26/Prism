import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { SignStudio } from "@/features/sign/SignStudio";

export const metadata: Metadata = { title: "Sign glossary" };

export default function SignPage() {
  return (
    <>
      <PageHeader
        title="Sign glossary"
        lead="Give deaf learners each lesson's key words in Bangla Sign Language. AI finds the key terms, people record the signs, and deaf reviewers approve every sign before learners see it."
        audience={["Teachers", "Sign interpreters", "Deaf reviewers"]}
      />
      <SignStudio />
    </>
  );
}
