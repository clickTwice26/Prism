"use client";

import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Cancel01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { useAnnounce } from "@/components/Announcer";
import { LANGUAGES, approveReview, listReviews, rejectReview, type ReviewItem } from "@/lib/api";

const langLabel = (code: string) => LANGUAGES.find((l) => l.code === code)?.label ?? code;

// Teachers see only what the fidelity gate could not verify (N2). Approving
// stores the (edited) text as the version every learner gets from then on.
export function ReviewQueue() {
  const announce = useAnnounce();
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listReviews("pending")
      .then(setItems)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => refresh(), [refresh]);

  const done = (id: number, msg: string) => {
    setItems((xs) => xs?.filter((x) => x.id !== id) ?? null);
    announce(msg);
    window.dispatchEvent(new Event("prism:review-changed"));
  };

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!items) return <LinearProgress aria-label="Loading the review queue" />;
  if (items.length === 0)
    return (
      <Alert severity="success">
        <AlertTitle>Nothing to check</AlertTitle>
        Every AI output so far passed the automatic checks, or a teacher has already checked it.
      </Alert>
    );

  return (
    <Stack spacing={3}>
      <Typography color="text.secondary">
        {items.length} {items.length === 1 ? "item needs" : "items need"} a teacher. Learners see only the safe version
        until you decide.
      </Typography>
      {items.map((item) => (
        <ReviewCard key={item.id} item={item} onDone={done} />
      ))}
    </Stack>
  );
}

function ReviewCard({ item, onDone }: { item: ReviewItem; onDone: (id: number, msg: string) => void }) {
  const [text, setText] = useState(item.ai_output);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isText = item.kind === "simplify";

  const act = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (approve) {
        await approveReview(item.id, text);
        onDone(item.id, "Approved. Learners will get this version.");
      } else {
        await rejectReview(item.id);
        onDone(item.id, "Rejected. Learners keep the safe version.");
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2.5}>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
          <Typography variant="h4" component="h2" sx={{ mr: 1 }}>
            {isText ? "Simplified text" : "Image description"}
          </Typography>
          <Chip size="small" label={langLabel(item.lang)} />
          {item.variant && <Chip size="small" variant="outlined" label={item.variant} />}
          <Typography variant="caption" color="text.secondary">
            {new Date(item.created_at).toLocaleString()}
          </Typography>
        </Stack>

        <Alert severity="warning">
          <AlertTitle>{isText ? "The fact check found" : "The descriptions disagreed about"}</AlertTitle>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {item.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </Box>
        </Alert>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={1}>
              <Typography variant="overline" color="text.secondary">
                {isText ? "Original" : "Image"}
              </Typography>
              {isText ? (
                <Typography variant="reading" lang={item.lang}>
                  {item.input_text}
                </Typography>
              ) : (
                <Box
                  component="img"
                  src={item.input_image}
                  alt="The image being described"
                  sx={{ maxWidth: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 2 }}
                />
              )}
              {!isText && (
                <>
                  <Typography variant="overline" color="text.secondary" sx={{ pt: 1 }}>
                    What learners hear now
                  </Typography>
                  <Typography lang={item.lang}>{item.safe_output}</Typography>
                </>
              )}
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label={isText ? "AI's simple version: fix it, then approve" : "AI description: fix it, then approve"}
              multiline
              minRows={6}
              fullWidth
              value={text}
              onChange={(e) => setText(e.target.value)}
              slotProps={{ htmlInput: { lang: item.lang } }}
            />
          </Grid>
        </Grid>

        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="contained"
            onClick={() => act(true)}
            disabled={busy || !text.trim()}
            startIcon={<Icon icon={CheckmarkCircle02Icon} />}
          >
            Approve for learners
          </Button>
          <Button variant="outlined" color="error" onClick={() => act(false)} disabled={busy} startIcon={<Icon icon={Cancel01Icon} />}>
            Reject
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
