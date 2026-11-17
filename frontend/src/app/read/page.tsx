import type { Metadata } from "next";
import Stack from "@mui/material/Stack";
import { PageHeader } from "@/components/PageHeader";
import { LessonReader } from "@/features/read/LessonReader";
import { ImageDescriber } from "@/features/read/ImageDescriber";

export const metadata: Metadata = { title: "Read & images" };

export default function ReadPage() {
  return (
    <>
      <PageHeader
        title="Read & images"
        lead="Listen to the lesson in your language while each word lights up, and hear what pictures and diagrams show."
        audience={["Blind & low vision", "Dyslexia", "Reading difficulties"]}
      />
      <Stack spacing={4}>
        <LessonReader />
        <ImageDescriber />
      </Stack>
    </>
  );
}
