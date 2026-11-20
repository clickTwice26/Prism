"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { RecordIcon, StopIcon, Upload04Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { useAnnounce } from "@/components/Announcer";
import { logUsage, uploadSignVideo } from "@/lib/api";
import { signsChanged } from "@/lib/signs";

const SIGNER_KEY = "prism.sign.signer";

export interface RecordTarget {
  kind: "term" | "lesson";
  id: number;
  label: string; // what is being signed, e.g. "chlorophyll"
}

type Phase = "ready" | "countdown" | "recording" | "review";

// Records a sign from the camera (or takes a video file) and sends it for
// deaf review. Key-term clips are short and silent: up to 4 seconds. The
// signer names themselves and consents to each clip.
export function SignRecorder({ target, onClose }: { target: RecordTarget | null; onClose: () => void }) {
  const announce = useAnnounce();
  const term = target?.kind === "term";
  const maxSeconds = term ? 4 : 30 * 60;

  const [phase, setPhase] = useState<Phase>("ready");
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<Blob | null>(null);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [signer, setSigner] = useState("");
  const [region, setRegion] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const liveRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearInterval(t));
    timers.current = [];
  };

  const stopCamera = useCallback(() => {
    clearTimers();
    if (recRef.current?.state === "recording") recRef.current.stop();
    recRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Reset for each new target; remember the signer between clips.
  useEffect(() => {
    if (!target) return;
    /* eslint-disable react-hooks/set-state-in-effect -- reset the dialog for a new target */
    setPhase("ready");
    setClip(null);
    setConsent(false);
    setError(null);
    setSigner(localStorage.getItem(SIGNER_KEY) ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [target]);

  useEffect(() => {
    if (!clip) return;
    const url = URL.createObjectURL(clip);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URL follows the clip
    setClipUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [clip]);

  useEffect(() => stopCamera, [stopCamera]);

  const openCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      streamRef.current = stream;
      if (liveRef.current) liveRef.current.srcObject = stream;
      return stream;
    } catch {
      setError("Camera permission is needed to record. You can upload a video file instead.");
      return null;
    }
  };

  const record = async () => {
    const stream = streamRef.current ?? (await openCamera());
    if (!stream) return;
    const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((m) =>
      MediaRecorder.isTypeSupported(m),
    );
    if (!mime) {
      setError("This browser cannot record video. Upload a file instead.");
      return;
    }
    // A short countdown so the signer can get ready.
    setPhase("countdown");
    setCount(3);
    announce("Recording in 3 seconds.");
    let n = 3;
    const cd = window.setInterval(() => {
      n -= 1;
      setCount(n);
      if (n > 0) return;
      window.clearInterval(cd);
      const parts: Blob[] = [];
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: term ? 800_000 : 600_000 });
      rec.ondataavailable = (e) => e.data.size > 0 && parts.push(e.data);
      rec.onstop = () => {
        clearTimers();
        setClip(new Blob(parts, { type: mime.split(";")[0] }));
        setPhase("review");
        announce("Recorded. Watch it, then send it for review or record again.");
      };
      rec.start(250);
      recRef.current = rec;
      setPhase("recording");
      setElapsed(0);
      const started = Date.now();
      const tick = window.setInterval(() => {
        const s = (Date.now() - started) / 1000;
        setElapsed(s);
        if (s >= maxSeconds && rec.state === "recording") rec.stop();
      }, 100);
      timers.current.push(tick);
    }, 1000);
    timers.current.push(cd);
  };

  const stopRecording = () => {
    if (recRef.current?.state === "recording") recRef.current.stop();
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!/^video\/(webm|mp4|quicktime)$/.test(f.type) && !/\.(webm|mp4)$/i.test(f.name)) {
      setError("Choose a WebM or MP4 video.");
      return;
    }
    stopCamera();
    setError(null);
    setClip(f);
    setPhase("review");
  };

  const send = async () => {
    if (!target || !clip) return;
    setBusy(true);
    setError(null);
    try {
      await uploadSignVideo({
        kind: target.kind,
        termId: term ? target.id : undefined,
        lessonId: term ? undefined : target.id,
        signer: signer.trim(),
        region: region.trim(),
        consent,
        video: clip,
      });
      localStorage.setItem(SIGNER_KEY, signer.trim());
      logUsage("sign", "clip_sent", { kind: target.kind });
      announce("Sent. A deaf reviewer will check the sign before learners see it.");
      signsChanged();
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    stopCamera();
    onClose();
  };

  const recording = phase === "countdown" || phase === "recording";

  return (
    <Dialog open={!!target} onClose={recording ? undefined : close} fullWidth maxWidth="sm">
      <DialogTitle>
        {term ? "Record the sign for " : "Interpreter video for "}
        <Box component="span" sx={{ color: "primary.main" }}>
          {target?.label}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5}>
          <Typography color="text.secondary">
            {term
              ? "Sign the word once, clearly, in 2 to 4 seconds. Frame your hands and face. The clip is silent."
              : "Sign the whole lesson. The video is silent and plays beside the lesson text and captions."}
          </Typography>

          <Box sx={{ position: "relative" }}>
            <Box
              component="video"
              ref={liveRef}
              autoPlay
              muted
              playsInline
              aria-label="Camera preview"
              sx={{
                display: phase === "review" ? "none" : "block",
                width: "100%",
                aspectRatio: "4 / 3",
                objectFit: "cover",
                bgcolor: "common.black",
                borderRadius: 2,
                transform: "scaleX(-1)",
              }}
            />
            {phase === "countdown" && (
              <Typography
                variant="display"
                aria-hidden
                sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "common.white" }}
              >
                {count}
              </Typography>
            )}
            {phase === "review" && clipUrl && (
              <Box
                component="video"
                src={clipUrl}
                autoPlay
                loop
                muted
                playsInline
                controls={!term}
                aria-label="Your recorded sign"
                sx={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", bgcolor: "common.black", borderRadius: 2 }}
              />
            )}
          </Box>
          {phase === "recording" && (
            <Stack spacing={0.5}>
              <LinearProgress
                variant={term ? "determinate" : "indeterminate"}
                value={Math.min(100, (elapsed / maxSeconds) * 100)}
                aria-label="Recording time"
              />
              <Typography variant="caption" color="text.secondary">
                Recording… {elapsed.toFixed(1)} s{term ? ` of ${maxSeconds}` : ""}
              </Typography>
            </Stack>
          )}

          <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
            {phase === "recording" ? (
              <Button variant="contained" color="error" onClick={stopRecording} startIcon={<Icon icon={StopIcon} />}>
                Stop
              </Button>
            ) : (
              <Button variant="contained" onClick={record} disabled={phase === "countdown"} startIcon={<Icon icon={RecordIcon} />}>
                {phase === "review" ? "Record again" : "Record"}
              </Button>
            )}
            <Button component="label" variant="outlined" disabled={recording} startIcon={<Icon icon={Upload04Icon} />}>
              Upload a video
              <input hidden type="file" accept="video/webm,video/mp4" onChange={(e) => pickFile(e.target.files?.[0])} />
            </Button>
          </Stack>

          {phase === "review" && (
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Signer's name" required fullWidth value={signer} onChange={(e) => setSigner(e.target.value)} />
                <TextField
                  label="Region or school (optional)"
                  fullWidth
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  helperText="Regional variants are kept side by side"
                />
              </Stack>
              <FormControlLabel
                control={<Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} />}
                label="The signer agrees that this video, which shows their face, may be shown to learners in Prism, and knows they can withdraw it at any time."
              />
            </Stack>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={close} disabled={recording || busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={send} disabled={phase !== "review" || !signer.trim() || !consent || busy}>
          {busy ? "Sending…" : "Send for deaf review"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
