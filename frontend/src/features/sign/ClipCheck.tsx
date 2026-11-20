"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { AiMagicIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { getWordTemplates, signMediaUrl, type SignVideo } from "@/lib/api";
import { dirVector, fingerDirection, mean, palmDirection, palmVector, shapeFeatures, shapeScore, dot } from "@/lib/handsign/hand.ts";
import type { WordTemplate } from "@/lib/handsign/motion.ts";
import { trackClip } from "@/lib/handsign/mediapipe.ts";
import { scoreWords, smoothFrames, WORD_PART_LABELS, type SignFrame, type WordPart } from "@/lib/handsign/words.ts";
import { PartBars } from "../fingerspell/HandView";

type Result =
  | { kind: "none"; reason: string }
  | { kind: "full"; word: string; score: number; parts: Record<WordPart, number> }
  | { kind: "hands"; word: string; score: number; parts: Record<"handshape" | "direction", number> };

const HAND_ONLY_LABELS = { handshape: "Handshape", direction: "Hand direction" };

/**
 * When the clip shows only the hands (no shoulders), compare just the
 * handshape and direction of the middle of the clip with the description.
 */
function handsOnly(frames: SignFrame[], t: WordTemplate): { score: number; parts: Record<"handshape" | "direction", number> } {
  const mid = frames.filter((f) => f.dominant).slice(Math.floor(frames.length * 0.25), Math.ceil(frames.length * 0.75));
  const pose = t.signs[0].dominant;
  const shape = mean(mid.map((f) => [shapeScore(shapeFeatures(f.dominant!), pose.shape ?? "", pose.thumb, pose.bend), 0, 0]))[0];
  const ext = pose.ext ? dirVector(pose.ext) : null;
  const palm = palmVector(pose.ext, pose.palm);
  const dirs = mid.map((f) => {
    const e = ext ? Math.max(0, dot(fingerDirection(f.dominant!), ext)) ** 2 : 0.6;
    const p = palm ? Math.max(0, dot(palmDirection(f.dominant!, "right"), palm)) ** 2 : 0.6;
    return Math.sqrt(e * p);
  });
  const direction = dirs.reduce((a, b) => a + b, 0) / Math.max(dirs.length, 1);
  return { score: Math.sqrt(shape * direction), parts: { handshape: shape, direction } };
}

/**
 * The review assistant: tracks a recorded sign clip and compares it with the
 * documented sign for the term (IsharaKotha), part by part. It only advises;
 * the deaf reviewer decides.
 */
export function ClipCheck({ video }: { video: SignVideo }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const labels = Object.values(video.term_labels ?? {}).filter((x): x is string => !!x);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const templates = labels.length ? await getWordTemplates(labels) : [];
      if (templates.length === 0) {
        setResult({ kind: "none", reason: "No documented sign for this term, so there is nothing to compare with. This may be a new sign." });
        return;
      }
      const tracked = await trackClip(signMediaUrl(video.file), { withBody: true, onProgress: setProgress });
      const frames: SignFrame[] = tracked.map((f) => ({ dominant: f.dominant, other: f.other, body: f.body ?? null }));
      const withHand = frames.filter((f) => f.dominant).length;
      if (withHand < 3) {
        setResult({ kind: "none", reason: "No signing hand was found in the clip. It may be too dark, too fast or out of frame." });
        return;
      }
      const ranked = scoreWords(frames, templates);
      if (ranked.length) {
        setResult({ kind: "full", word: ranked[0].word, score: ranked[0].score, parts: ranked[0].parts });
      } else {
        // The body is not in view: judge the hands alone, against each documented variant.
        const smooth = smoothFrames(frames);
        const best = templates.map((t) => ({ t, ...handsOnly(smooth, t) })).sort((a, b) => b.score - a.score)[0];
        setResult({ kind: "hands", word: best.t.bn, score: best.score, parts: best.parts });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={1.5}>
      <Button variant="outlined" onClick={run} disabled={busy} startIcon={<Icon icon={AiMagicIcon} size={18} />} sx={{ alignSelf: "flex-start" }}>
        {busy ? "Checking the clip…" : "Compare with the documented sign"}
      </Button>
      {busy && <LinearProgress variant="determinate" value={progress * 100} aria-label="Checking the clip" />}
      {error && <Alert severity="error">{error}</Alert>}
      {result?.kind === "none" && <Alert severity="info">{result.reason}</Alert>}
      {result && result.kind !== "none" && (
        <Stack spacing={1}>
          <Alert severity={result.score >= 0.5 ? "success" : "warning"}>
            {result.score >= 0.5 ? "Looks like the documented sign" : "Differs from the documented sign"} for{" "}
            <span lang="bn">{result.word}</span> ({Math.round(result.score * 100)}% match
            {result.kind === "hands" ? ", hands only: the body was not in view" : ""}). The parts below show where it
            differs. A regional variant or a better sign can differ on purpose.
          </Alert>
          {result.kind === "full" ? (
            <PartBars score={result} labels={WORD_PART_LABELS} />
          ) : (
            <PartBars score={result} labels={HAND_ONLY_LABELS} />
          )}
          <Typography variant="caption" color="text.secondary">
            AI check from hand and body points, compared with the IsharaKotha description. You decide.
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}
