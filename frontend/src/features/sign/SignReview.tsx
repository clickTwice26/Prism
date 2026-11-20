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
import { SignClipPlayer } from "@/components/SignClip";
import { LANGUAGES, approveSignVideo, listSignVideos, rejectSignVideo, signMediaUrl, type SignVideo } from "@/lib/api";
import { SIGNS_CHANGED, signsChanged } from "@/lib/signs";
import { ClipCheck } from "./ClipCheck";

const REVIEWER_KEY = "prism.sign.reviewer";

// Deaf reviewers have the final say on every sign (the fidelity gate applied
// to sign). Nothing reaches learners until one of them approves it.
export function SignReview() {
  const announce = useAnnounce();
  const [items, setItems] = useState<SignVideo[] | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listSignVideos("pending")
      .then(setItems)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from storage
    setReviewer(localStorage.getItem(REVIEWER_KEY) ?? "");
    load();
    window.addEventListener(SIGNS_CHANGED, load);
    return () => window.removeEventListener(SIGNS_CHANGED, load);
  }, [load]);

  const saveReviewer = (name: string) => {
    setReviewer(name);
    localStorage.setItem(REVIEWER_KEY, name);
  };

  const done = (id: number, msg: string) => {
    setItems((xs) => xs?.filter((x) => x.id !== id) ?? null);
    announce(msg);
    signsChanged();
  };

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!items) return <LinearProgress aria-label="Loading signs to review" />;

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={1.5}>
          <Typography variant="h4" component="h2">
            Deaf reviewer
          </Typography>
          <Typography color="text.secondary">
            Deaf reviewers decide which signs learners see. Your name is shown with every sign you approve.
          </Typography>
          <TextField
            label="Your name"
            value={reviewer}
            onChange={(e) => saveReviewer(e.target.value)}
            sx={{ maxWidth: 360 }}
            required
          />
        </Stack>
      </Paper>

      {items.length === 0 ? (
        <Alert severity="success">
          <AlertTitle>No signs to review</AlertTitle>
          Every recorded sign has been checked.
        </Alert>
      ) : (
        items.map((v) => <ReviewCard key={v.id} video={v} reviewer={reviewer.trim()} onDone={done} />)
      )}
    </Stack>
  );
}

function ReviewCard({
  video,
  reviewer,
  onDone,
}: {
  video: SignVideo;
  reviewer: string;
  onDone: (id: number, msg: string) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const term = video.kind === "term";
  const labels = LANGUAGES.filter((l) => video.term_labels?.[l.code]).map((l) => `${l.label}: ${video.term_labels?.[l.code]}`);
  const title = term ? (video.term_labels?.bn ?? video.term_labels?.en ?? "this term") : video.lesson_title || "this lesson";

  const act = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (approve) {
        await approveSignVideo(video.id, reviewer, note);
        onDone(video.id, "Approved. Learners will see this sign.");
      } else {
        await rejectSignVideo(video.id, reviewer, note);
        onDone(video.id, "Rejected. The video was deleted.");
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          {term ? (
            <SignClipPlayer clip={video} label={title} />
          ) : (
            <Box
              component="video"
              src={signMediaUrl(video.file)}
              controls
              muted
              playsInline
              preload="metadata"
              aria-label={`Interpreter video for ${title}`}
              sx={{ width: "100%", borderRadius: 2, bgcolor: "common.black" }}
            />
          )}
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
              <Typography variant="h4" component="h3" sx={{ mr: 1 }}>
                {title}
              </Typography>
              <Chip size="small" label={term ? "Key-term sign" : "Interpreter video"} />
            </Stack>
            {labels.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                {labels.join(" · ")}
              </Typography>
            )}
            <Typography variant="body2">
              Signed by {video.signer}
              {video.region ? `, ${video.region}` : ""}. Sent {new Date(video.created_at).toLocaleString()}.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Check: is this the sign deaf people already use? Is it clear, and does it mean this word in this subject?
            </Typography>
            {term && <ClipCheck video={video} />}
            <TextField
              label="Note for the signer (optional)"
              multiline
              minRows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {!reviewer && <Alert severity="info">Write your name above to approve or reject.</Alert>}
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="contained"
                onClick={() => act(true)}
                disabled={busy || !reviewer}
                startIcon={<Icon icon={CheckmarkCircle02Icon} />}
              >
                Approve for learners
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() => act(false)}
                disabled={busy || !reviewer}
                startIcon={<Icon icon={Cancel01Icon} />}
              >
                Reject
              </Button>
            </Stack>
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );
}
