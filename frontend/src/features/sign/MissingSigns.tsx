"use client";

import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { RecordIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { LANGUAGES, getMissingSigns, termLabel, type MissingSign } from "@/lib/api";
import { SIGNS_CHANGED } from "@/lib/signs";
import { useSettings } from "@/lib/settings";
import { ReferenceNote } from "./ReferenceNote";
import { SignRecorder, type RecordTarget } from "./SignRecorder";

// The community's to-do list: key terms in Prism lessons that have no
// approved sign yet. Interpreters and deaf signers propose one; deaf
// reviewers pick the sign every lesson then reuses.
export function MissingSigns() {
  const { settings } = useSettings();
  const [items, setItems] = useState<MissingSign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<RecordTarget | null>(null);

  const load = useCallback(() => {
    getMissingSigns()
      .then(setItems)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(SIGNS_CHANGED, load);
    return () => window.removeEventListener(SIGNS_CHANGED, load);
  }, [load]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!items) return <LinearProgress aria-label="Loading missing signs" />;
  if (items.length === 0)
    return (
      <Alert severity="success">
        <AlertTitle>No missing signs</AlertTitle>
        Every key term in every lesson has an approved sign.
      </Alert>
    );

  return (
    <Stack spacing={2}>
      <Typography color="text.secondary">
        {items.length} key {items.length === 1 ? "term needs" : "terms need"} a sign. If you sign Bangla Sign Language,
        record the sign you use. Deaf reviewers choose the one learners see.
      </Typography>
      {items.map((t) => (
        <Paper key={t.id} sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
              <Typography variant="h4" component="h2" sx={{ mr: 1 }}>
                {termLabel(t, settings.lang)}
              </Typography>
              {t.pending > 0 && (
                <Chip size="small" color="warning" label={`${t.pending} proposed, waiting for deaf review`} />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {LANGUAGES.filter((l) => t.labels[l.code])
                .map((l) => `${l.label}: ${t.labels[l.code]}`)
                .join(" · ")}
            </Typography>
            <Typography variant="body2">Needed in: {t.lessons?.join(", ")}</Typography>
            <ReferenceNote entries={t.reference} />
            <Stack direction="row">
              <Button
                variant="contained"
                size="small"
                onClick={() => setRecording({ kind: "term", id: t.id, label: termLabel(t, settings.lang) })}
                startIcon={<Icon icon={RecordIcon} size={18} />}
              >
                {t.pending > 0 ? "Propose another sign" : "Propose a sign"}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      ))}
      <SignRecorder target={recording} onClose={() => setRecording(null)} />
    </Stack>
  );
}
