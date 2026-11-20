"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Delete02Icon, RecordIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { useAnnounce } from "@/components/Announcer";
import { deleteSignSample, listSignSamples, saveSignSample, type SampleFrame, type SignSampleInfo } from "@/lib/api";
import { FEATURE_VERSION, featureVector } from "@/lib/handsign/hand.ts";
import type { TrackedHands } from "./useHandTracker";

const SIGNER_KEY = "prism.sign.signer";

/** Collects frames while recording. Only frames with both hands are kept. */
export interface Recorder {
  push: (hands: TrackedHands) => void;
}

const round = (x: number) => Math.round(x * 1e4) / 1e4;
const pts = (h: [number, number, number][]) => h.map((p) => p.map(round) as [number, number, number]);

/** What to record: letters (both hands, 2 s) by default; words pass their own settings. */
export interface RecordKind {
  kind: "letter" | "word";
  noun: string; // "letter" | "word"
  seconds: number;
  featureVersion: number;
  /** Whether a frame is usable. */
  keep: (h: TrackedHands) => boolean;
  features: (h: TrackedHands) => number[];
  withBody?: boolean;
}

export const LETTER_RECORDING: RecordKind = {
  kind: "letter",
  noun: "letter",
  seconds: 2,
  featureVersion: FEATURE_VERSION,
  keep: (h) => !!h.dominant && !!h.other,
  features: (h) => featureVector(h.dominant, h.other),
};

/**
 * Records labelled practice samples of each letter from the real camera:
 * skeleton points and feature vectors, never video. These test the
 * recogniser and train the learned model (Python, ml/).
 */
export function RecordPanel({
  what = LETTER_RECORDING,
  ready: haveLabels,
  dominant,
  live,
  letterButtons,
  simLetter,
  onSimLetter,
  setRecorder,
}: {
  what?: RecordKind;
  /** Whether the labels (letters or words) have loaded. */
  ready: boolean;
  dominant: "right" | "left";
  live: boolean;
  letterButtons: ReactNode;
  simLetter: string;
  onSimLetter: (l: string) => void;
  /** Hands the active recorder to the page, which feeds it every frame. */
  setRecorder: (r: Recorder | null) => void;
}) {
  const announce = useAnnounce();
  const [signer, setSigner] = useState("");
  const [deaf, setDeaf] = useState(false);
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<"idle" | "countdown" | "recording" | "saving">("idle");
  const [count, setCount] = useState(3);
  const [samples, setSamples] = useState<SignSampleInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const frames = useRef<SampleFrame[]>([]);
  const features = useRef<number[][]>([]);
  const started = useRef(0);
  const label = simLetter;

  const load = useCallback(() => {
    listSignSamples(what.kind)
      .then(setSamples)
      .catch(() => undefined);
  }, [what.kind]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from storage
    setSigner(localStorage.getItem(SIGNER_KEY) ?? "");
    load();
  }, [load]);

  useEffect(() => () => setRecorder(null), [setRecorder]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of samples) m.set(s.label, (m.get(s.label) ?? 0) + 1);
    return m;
  }, [samples]);
  const mine = samples.filter((s) => s.signer === signer.trim()).slice(-8).reverse();

  const finish = useCallback(async () => {
    setRecorder(null);
    if (frames.current.length < 10) {
      setPhase("idle");
      setError(
        what.kind === "letter"
          ? "Both hands were not seen long enough. Keep both hands in view and try again."
          : "Your signing hand and body were not seen long enough. Step back so your head and hands are in view.",
      );
      return;
    }
    setPhase("saving");
    try {
      await saveSignSample({
        kind: what.kind,
        label,
        signer: signer.trim(),
        dominant,
        deaf,
        consent,
        frames: frames.current,
        features: features.current,
        feature_version: what.featureVersion,
      });
      localStorage.setItem(SIGNER_KEY, signer.trim());
      announce(`Saved a sample of ${label}.`);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPhase("idle");
    }
  }, [announce, consent, deaf, dominant, label, load, setRecorder, signer, what]);

  const record = () => {
    setError(null);
    setPhase("countdown");
    setCount(3);
    let n = 3;
    const id = window.setInterval(() => {
      n -= 1;
      setCount(n);
      if (n > 0) return;
      window.clearInterval(id);
      frames.current = [];
      features.current = [];
      started.current = performance.now();
      setPhase("recording");
      setRecorder({
        push(h) {
          const t = h.t - started.current;
          if (t > what.seconds * 1000) {
            setRecorder(null);
            void finish();
            return;
          }
          if (!what.keep(h)) return;
          // Points are in the signer's frame; a left-handed signer's are mirrored, so the
          // signing hand is always stored as "right" (the dominant field says which it really is).
          const hands: SampleFrame["hands"] = [];
          if (h.dominant) hands.push({ side: "right", points: pts(h.dominant) });
          if (h.other) hands.push({ side: "left", points: pts(h.other) });
          frames.current.push({
            t: Math.round(t),
            hands,
            ...(what.withBody && h.bodyPoints ? { body: pts(h.bodyPoints) } : {}),
          });
          features.current.push(what.features(h).map(round));
        },
      });
    }, 1000);
  };

  const remove = async (s: SignSampleInfo) => {
    try {
      await deleteSignSample(s.id);
      announce("Sample deleted.");
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const ready = live && signer.trim() && consent && phase === "idle" && haveLabels;

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h4" component="h2">
          Record samples
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Samples show how real people sign each {what.noun}. They test the recogniser and train it. Only the
          positions of your {what.withBody ? "hand and body joints" : "hand joints"} are saved, never video. Aim for at
          least 5 samples of each {what.noun} from several people, ideally deaf signers.
        </Typography>
        <TextField label="Your name" required value={signer} onChange={(e) => setSigner(e.target.value)} size="small" />
        <FormControlLabel control={<Checkbox checked={deaf} onChange={(e) => setDeaf(e.target.checked)} />} label="I am deaf and sign Bangla Sign Language" />
        <FormControlLabel
          control={<Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} />}
          label={`I agree that my ${what.withBody ? "hand and body" : "hand"} positions are stored to test and train Prism's sign recognition, and I can delete them at any time.`}
        />
        <Typography id="record-letter" variant="subtitle1">
          {what.noun === "letter" ? "Letter" : "Word"}: <span lang="bn">{label}</span> ({counts.get(label) ?? 0} samples so far)
        </Typography>
        {letterButtons && (
          <ToggleButtonGroup exclusive size="small" value={label} onChange={(_, v) => v && onSimLetter(v)} aria-labelledby="record-letter" sx={{ flexWrap: "wrap" }}>
            {letterButtons}
          </ToggleButtonGroup>
        )}
        {phase === "countdown" && (
          <Typography variant="h3" component="p" role="status">
            Get ready… {count}
          </Typography>
        )}
        {phase === "recording" && <LinearProgress aria-label="Recording" />}
        {!live && <Alert severity="info">Start the camera to record. Simulated hands are not saved.</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        <Button variant="contained" onClick={record} disabled={!ready} startIcon={<Icon icon={RecordIcon} />}>
          {phase === "saving" ? "Saving…" : `Record ${what.seconds} seconds of ${label}`}
        </Button>
        {mine.length > 0 && (
          <Stack spacing={0.5}>
            <Typography variant="subtitle1">Your recent samples</Typography>
            {mine.map((s) => (
              <Stack key={s.id} direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="body2">
                  <span lang="bn">{s.label}</span> · {new Date(s.created_at).toLocaleTimeString()}
                </Typography>
                <Tooltip title="Delete this sample">
                  <IconButton size="small" onClick={() => remove(s)} aria-label={`Delete sample of ${s.label}`}>
                    <Icon icon={Delete02Icon} size={18} />
                  </IconButton>
                </Tooltip>
              </Stack>
            ))}
          </Stack>
        )}
        <Typography variant="caption" color="text.secondary">
          {samples.length} samples from {new Set(samples.map((s) => s.signer)).size} people so far.
        </Typography>
      </Stack>
    </Paper>
  );
}
