import Alert from "@mui/material/Alert";
import type { SignReference } from "@/lib/api";

// Tells signers that a dictionary already lists a sign for this word, so the
// community's existing sign is used instead of a new one being coined.
export function ReferenceNote({ entries }: { entries: SignReference[] }) {
  if (!entries.length) return null;
  const words = entries.map((e) => `${e.bn} (${e.en}${e.section ? `, ${e.section}` : ""})`).join("; ");
  return (
    <Alert severity="info" variant="outlined" sx={{ py: 0 }}>
      {entries[0].source} already lists a sign for {words}. Record the sign the deaf community already uses before
      proposing a new one.
    </Alert>
  );
}
