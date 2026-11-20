"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { PART_LABELS, type LetterScore, type PartName } from "@/lib/handsign/letters.ts";
import type { TrackedHands } from "./useHandTracker";

// MediaPipe's hand skeleton: thumb, four fingers and the palm.
const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

export interface HandViewHandle {
  video: HTMLVideoElement | null;
  draw: (hands: TrackedHands | null) => void;
}

/** Mirrored camera preview with the tracked hand skeletons drawn over it. */
export const HandView = forwardRef<HandViewHandle, { label: string; simulated: boolean }>(function HandView({ label, simulated }, ref) {
  const theme = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useImperativeHandle(ref, () => ({
    get video() {
      return videoRef.current;
    },
    draw(hands) {
      const c = canvasRef.current;
      if (!c) return;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== w || c.height !== h) Object.assign(c, { width: w, height: h });
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      // Face and shoulders, faintly: where signs are placed.
      const body = hands?.imageBody;
      if (body) {
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 2;
        const bp = (i: number) => [(1 - body[i].x) * w, body[i].y * h] as const;
        for (const [a, b] of [[11, 12], [11, 23], [12, 24], [23, 24], [9, 10], [7, 2], [2, 5], [5, 8]] as const) {
          ctx.beginPath();
          ctx.moveTo(...bp(a));
          ctx.lineTo(...bp(b));
          ctx.stroke();
        }
        for (const i of [0, 2, 5, 7, 8, 9, 10, 11, 12]) {
          ctx.beginPath();
          ctx.arc(...bp(i), 3, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      for (const hand of hands?.image ?? []) {
        // The preview is mirrored, so mirror the skeleton too.
        const px = (i: number) => [(1 - hand.points[i].x) * w, hand.points[i].y * h] as const;
        ctx.strokeStyle = hand.dominant ? theme.palette.primary.light : theme.palette.warning.light;
        ctx.lineWidth = 3;
        for (const [a, b] of BONES) {
          ctx.beginPath();
          ctx.moveTo(...px(a));
          ctx.lineTo(...px(b));
          ctx.stroke();
        }
        ctx.fillStyle = "#fff";
        for (let i = 0; i < 21; i++) {
          ctx.beginPath();
          ctx.arc(...px(i), 3, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    },
  }));

  return (
    <Box sx={{ position: "relative", width: "100%", aspectRatio: "16 / 9", bgcolor: "common.black", borderRadius: 2, overflow: "hidden" }}>
      <Box
        component="video"
        ref={videoRef}
        muted
        playsInline
        aria-label={label}
        sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: simulated ? "none" : "block" }}
      />
      <Box component="canvas" ref={canvasRef} aria-hidden sx={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      {simulated && (
        <Typography variant="caption" sx={{ position: "absolute", left: 12, top: 8, color: "grey.400" }}>
          Simulation: computer-made hands, no camera
        </Typography>
      )}
    </Box>
  );
});

/** Per-part match bars, so a learner sees which part is right. */
export function PartBars<K extends string = PartName>({
  score,
  labels = PART_LABELS as Record<K, string>,
}: {
  score: Pick<LetterScore, "parts"> | { parts: Record<K, number> };
  labels?: Record<K, string>;
}) {
  const parts = score.parts as Record<K, number>;
  return (
    <Stack spacing={1}>
      {(Object.keys(labels) as K[]).map((k) => {
        const v = Math.round(parts[k] * 100);
        return (
          <Box key={k}>
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Typography variant="body2">{labels[k]}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {v}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={v}
              color={v >= 70 ? "success" : v >= 40 ? "warning" : "error"}
              aria-label={`${labels[k]}: ${v}% match`}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        );
      })}
    </Stack>
  );
}
