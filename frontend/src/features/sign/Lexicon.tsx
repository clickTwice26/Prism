"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useAnnounce } from "@/components/Announcer";
import { SignTermCard } from "@/components/SignClip";
import { termLabel, withdrawSignVideo, type SignVideo } from "@/lib/api";
import { signsChanged, useSignLexicon } from "@/lib/signs";
import { useSettings } from "@/lib/settings";

// Every approved sign, reused by every lesson. Regional variants are kept
// side by side. A signer can withdraw their clip at any time.
export function Lexicon() {
  const { settings } = useSettings();
  const { terms } = useSignLexicon();
  const announce = useAnnounce();
  const [withdraw, setWithdraw] = useState<{ clip: SignVideo; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirmWithdraw = async () => {
    if (!withdraw) return;
    try {
      await withdrawSignVideo(withdraw.clip.id);
      announce("Withdrawn. The video was deleted.");
      signsChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWithdraw(null);
    }
  };

  if (terms.length === 0)
    return (
      <Alert severity="info">
        <AlertTitle>The lexicon is empty</AlertTitle>
        Approved signs appear here and in every lesson that uses the word.
      </Alert>
    );

  const sorted = [...terms].sort((a, b) => termLabel(a, settings.lang).localeCompare(termLabel(b, settings.lang)));

  return (
    <Stack spacing={2}>
      <Typography color="text.secondary">
        {terms.length} approved {terms.length === 1 ? "sign" : "signs"}. Learners see them wherever the word appears.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Grid container spacing={2}>
        {sorted.map((t) => (
          <Grid key={t.id} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Paper sx={{ p: 2, height: "100%" }}>
              <Stack spacing={1.5}>
                <SignTermCard term={t} lang={settings.lang} />
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                  {t.clips.map((c) => (
                    <Button
                      key={c.id}
                      size="small"
                      color="error"
                      onClick={() => setWithdraw({ clip: c, label: termLabel(t, settings.lang) })}
                    >
                      Withdraw {t.clips.length > 1 ? `${c.signer}'s clip` : "clip"}
                    </Button>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Dialog open={!!withdraw} onClose={() => setWithdraw(null)}>
        <DialogTitle>Withdraw this sign?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {withdraw?.clip.signer}&apos;s clip for &ldquo;{withdraw?.label}&rdquo; will be removed from every lesson and
            the video file deleted. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWithdraw(null)}>Keep it</Button>
          <Button color="error" variant="contained" onClick={confirmWithdraw}>
            Withdraw and delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
