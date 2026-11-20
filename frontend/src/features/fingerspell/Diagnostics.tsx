"use client";

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { fingerDirection, mean, palmDirection, rankShapes, shapeFeatures, type HandPoints } from "@/lib/handsign/hand.ts";
import { sitePosition, toBody, type Body } from "@/lib/handsign/body.ts";
import { codeFor, directionWords, siteWords } from "@/lib/handsign/describe.ts";
import type { TrackedHands } from "./useHandTracker";

const SITES = ["forehead", "eyes", "nose", "lips", "chin", "neck", "shoulders", "chest", "stomach", "belowstomach"];
const SHAPE_NAMES: Record<string, string> = {
  fist: "fist",
  flathand: "flat hand",
  finger2345: "open hand",
  finger2: "index finger",
  finger23: "two fingers",
  finger23spread: "V",
  pinch12: "pinch",
  pinch12open: "pinch, others open",
  pinchall: "all fingertips pinched",
  cee12: "C (thumb and index)",
  ceeall: "C",
  ceeopen: "wide C",
};

const palmCentre = (h: HandPoints) => mean([0, 5, 9, 13, 17].map((i) => h[i]));

function nearestSite(body: Body, h: HandPoints): { site: string; dist: number; at: [number, number] } {
  const at = toBody(body, palmCentre(h));
  let best = { site: "", dist: Infinity };
  for (const site of SITES) {
    const p = sitePosition(body, site);
    const d = Math.hypot(p[0] - at[0], p[1] - at[1]);
    if (d < best.dist) best = { site, dist: d };
  }
  return { ...best, at };
}

function handLine(h: HandPoints, side: "right" | "left") {
  const shapes = rankShapes(shapeFeatures(h)).slice(0, 3);
  return {
    shapes: shapes.map((s) => `${SHAPE_NAMES[s.shape] ?? s.shape} ${Math.round(s.score * 100)}%`).join(", "),
    fingers: directionWords(codeFor(fingerDirection(h))),
    palm: directionWords(codeFor(palmDirection(h, side))),
  };
}

/**
 * Shows, in plain words, what the recogniser reads from the camera right now:
 * which hand it treats as the signing hand, its shape, direction and place on
 * the body. Used to find out why a sign is not recognised.
 */
export function Diagnostics({ frame }: { frame: TrackedHands | null }) {
  const rows: [string, string][] = [];
  if (!frame) rows.push(["Status", "No frame yet."]);
  else {
    const sides = frame.sides ?? [];
    rows.push([
      "Hands seen",
      !frame.sides
        ? `simulated (${[frame.dominant && "signing hand", frame.other && "other hand"].filter(Boolean).join(", ") || "none"})`
        : sides.length
        ? sides.map((s) => `${s.side} (decided by ${s.by === "body" ? "body position" : s.by === "model" ? `hand model: "${s.label}"` : "image position"})`).join("; ")
        : "none",
    ]);
    rows.push(["Signing hand", frame.dominant ? "found" : "not found: show your signing hand, or try Swap hands"]);
    if (frame.dominant) {
      const d = handLine(frame.dominant, "right");
      rows.push(["Handshape (best 3)", d.shapes]);
      rows.push(["Fingers point", d.fingers || "unclear"]);
      rows.push(["Palm faces", d.palm || "unclear"]);
      if (frame.body) {
        const n = nearestSite(frame.body, frame.dominant);
        rows.push([
          "Hand is near",
          `${siteWords(n.site)} (${n.dist.toFixed(2)} shoulder widths away; position ${n.at[0].toFixed(2)}, ${n.at[1].toFixed(2)})`,
        ]);
      }
    }
    if (frame.other) {
      const o = handLine(frame.other, "left");
      rows.push(["Other hand", `${o.shapes}; fingers ${o.fingers || "unclear"}, palm ${o.palm || "unclear"}`]);
    }
    if (frame.body !== undefined) {
      rows.push(["Body", frame.body ? `seen (shoulders ${(frame.body.width * 100).toFixed(0)}% of the frame height wide)` : "not seen: step back so your head and shoulders are in view"]);
    }
  }
  return (
    <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.default" }} role="region" aria-label="What Prism sees">
      <Typography variant="subtitle1" component="h3" gutterBottom>
        What Prism sees
      </Typography>
      <Box component="dl" sx={{ m: 0, display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: 2, rowGap: 0.5 }}>
        {rows.map(([k, v]) => (
          <Box key={k} sx={{ display: "contents" }}>
            <Typography component="dt" variant="body2" sx={{ fontWeight: 600 }}>
              {k}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0 }}>
              {v}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
