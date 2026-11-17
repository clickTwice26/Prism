import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { ReviewQueue } from "@/features/review/ReviewQueue";

export const metadata: Metadata = { title: "Review" };

export default function ReviewPage() {
  return (
    <>
      <PageHeader
        title="Review"
        lead="Prism checks every AI output before a learner sees it. Anything it could not verify waits here. Fix it if needed, then approve it once for every learner."
        audience={["Teachers"]}
      />
      <ReviewQueue />
    </>
  );
}
