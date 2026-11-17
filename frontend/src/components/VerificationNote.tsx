import Alert from "@mui/material/Alert";
import type { Verification } from "@/lib/api";

// Tells the learner, in calm words, how far the content was checked (N2).
// Wording avoids blame and never shows the AI's rejected version to a child.
export function VerificationNote({
  verification,
  kind,
  disputed = 0,
}: {
  verification: Verification;
  kind: "simplify" | "describe";
  disputed?: number;
}) {
  switch (verification) {
    case "teacher_verified":
      return <Alert severity="success">Checked by your teacher.</Alert>;
    case "auto_verified":
      return (
        <Alert severity="success">
          {kind === "simplify" ? "Checked: it keeps all the facts of the original." : "Checked: every description agreed."}
        </Alert>
      );
    case "pending_review":
      return (
        <Alert severity="info">
          {kind === "simplify"
            ? "Your teacher is checking the simple version. Here is the original text for now."
            : `Your teacher is checking ${disputed === 1 ? "one detail" : `${disputed} details`}. You get only the parts Prism is sure about.`}
        </Alert>
      );
    case "rules":
      return (
        <Alert severity="info">Made with offline rules, which only shorten English sentences. A teacher should read it first.</Alert>
      );
    default:
      return null;
  }
}
