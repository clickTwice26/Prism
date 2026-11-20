// Builds synthetic 21-point hands for a handshape and orientation, and places
// two hands so a letter's contact points touch. Used by tests, and by the
// fingerspelling page's "simulate" mode where no camera is available. It is a
// simple kinematic hand, not a model of any real signer.

import {
  FINGERS,
  FINGER_NAMES,
  THUMB,
  add,
  contactPoint,
  cross,
  dirVector,
  dot,
  palmVector,
  mean,
  scale,
  sub,
  unit,
  type FingerName,
  type HandPoints,
  type Vec,
} from "./hand.ts";
import type { LetterTemplate, PoseTemplate } from "./letters.ts";

type Flex = [number, number, number]; // MCP, PIP, DIP flexion in degrees

interface ShapeSpec {
  fingers: Record<FingerName, Flex>;
  spread: number; // degrees between neighbouring fingers
  thumb: "across" | "out" | "open" | "along" | "pinch-index" | "pinch-all" | "cee";
}

const straight: Flex = [0, 0, 0];
const curled: Flex = [85, 100, 60];
const curved: Flex = [25, 45, 35];
const all = (f: Flex): Record<FingerName, Flex> => ({ index: f, middle: f, ring: f, pinky: f });

export const SHAPES: Record<string, ShapeSpec> = {
  fist: { fingers: all(curled), spread: 0, thumb: "across" },
  flathand: { fingers: all(straight), spread: 1, thumb: "along" },
  finger2345: { fingers: all(straight), spread: 14, thumb: "out" },
  finger2: { fingers: { ...all(curled), index: straight }, spread: 2, thumb: "across" },
  finger23: { fingers: { ...all(curled), index: straight, middle: straight }, spread: 1, thumb: "across" },
  finger23spread: { fingers: { ...all(curled), index: straight, middle: straight }, spread: 18, thumb: "across" },
  pinch12: { fingers: { ...all(curled), index: [35, 50, 30] }, spread: 2, thumb: "pinch-index" },
  pinch12open: { fingers: { ...all(straight), index: [35, 50, 30] }, spread: 6, thumb: "pinch-index" },
  pinchall: { fingers: all([40, 45, 25]), spread: 0, thumb: "pinch-all" },
  cee12: { fingers: { ...all(curled), index: curved }, spread: 2, thumb: "cee" },
  ceeall: { fingers: all(curved), spread: 2, thumb: "cee" },
  ceeopen: { fingers: all([15, 30, 20]), spread: 4, thumb: "cee" },
};

// Base positions (along the finger axis, toward the thumb side) and segment lengths, in hand sizes.
const BASE: Record<FingerName, [number, number]> = { index: [0.95, 0.33], middle: [1.0, 0.1], ring: [0.95, -0.12], pinky: [0.85, -0.33] };
const SEGMENTS: Record<FingerName, [number, number, number]> = {
  index: [0.42, 0.26, 0.2],
  middle: [0.47, 0.29, 0.21],
  ring: [0.44, 0.27, 0.2],
  pinky: [0.34, 0.21, 0.18],
};
const SPREAD_ORDER: Record<FingerName, number> = { index: 1.5, middle: 0.5, ring: -0.5, pinky: -1.5 };

const rad = (d: number) => (d * Math.PI) / 180;

/** Orthonormal hand axes from HamNoSys finger and palm directions. */
function axes(p: PoseTemplate, side: "right" | "left"): { F: Vec; N: Vec; T: Vec } {
  const F = dirVector(p.ext ?? "u") ?? [0, 1, 0];
  let N = palmVector(p.ext ?? "u", p.palm ?? "d") ?? [0, 0, 1];
  N = sub(N, scale(F, dot(N, F))); // make the palm direction perpendicular to the fingers
  if (Math.hypot(...N) < 1e-6) N = Math.abs(F[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  N = unit(sub(N, scale(F, dot(N, F))));
  // Thumb side: a right hand with fingers up and palm out has its thumb to the signer's left.
  const T = side === "right" ? scale(cross(F, N), -1) : cross(F, N);
  return { F, N, T };
}

/** A hand at the origin (wrist) with the given shape and orientation, one hand size from wrist to middle base. */
export function makeHand(p: PoseTemplate, side: "right" | "left" = "right"): HandPoints {
  const base = SHAPES[p.shape ?? "flathand"] ?? SHAPES.flathand;
  // A written thumb position (across, open, out) overrides the shape's usual one.
  const spec: ShapeSpec =
    p.thumb && ["across", "open", "out"].includes(p.thumb) && !["pinch-index", "pinch-all", "cee"].includes(base.thumb)
      ? { ...base, thumb: p.thumb as ShapeSpec["thumb"] }
      : base;
  const { F, N, T } = axes(p, side);
  const pts: Vec[] = new Array(21).fill(null).map(() => [0, 0, 0] as Vec);
  pts[0] = [0, 0, 0];
  for (const f of FINGER_NAMES) {
    const [along, across] = BASE[f];
    const mcp = add(scale(F, along), scale(T, across));
    const s = rad(spec.spread * SPREAD_ORDER[f]);
    const dir0 = unit(add(scale(F, Math.cos(s)), scale(T, Math.sin(s))));
    let cur = mcp;
    // Written "bent": straight fingers bent at the base knuckle.
    let theta = p.bend === "bent" && spec.fingers[f][1] === 0 ? rad(55) : 0;
    pts[FINGERS[f][0]] = mcp;
    spec.fingers[f].forEach((flex, k) => {
      theta += rad(flex);
      // Flexing curls the finger toward the palm side (the way the palm faces).
      const d = unit(add(scale(dir0, Math.cos(theta)), scale(N, Math.sin(theta))));
      cur = add(cur, scale(d, SEGMENTS[f][k]));
      pts[FINGERS[f][k + 1]] = cur;
    });
  }
  // Thumb: from its base near the wrist to a target tip, through two joints.
  const cmc = add(scale(F, 0.22), scale(T, 0.28));
  const tips = FINGER_NAMES.map((f) => pts[FINGERS[f][3]]);
  let tip: Vec;
  switch (spec.thumb) {
    case "pinch-index":
      tip = pts[FINGERS.index[3]];
      break;
    case "pinch-all":
      tip = mean(tips);
      break;
    case "cee":
      tip = add(pts[FINGERS.index[3]], add(scale(N, 0.55), scale(F, -0.45)));
      break;
    case "across":
      tip = add(add(scale(F, 0.75), scale(T, -0.1)), scale(N, 0.3));
      break;
    case "out":
      tip = add(scale(F, 0.55), scale(T, 0.9));
      break;
    case "open":
      tip = add(add(scale(F, 0.7), scale(T, 0.62)), scale(N, 0.1));
      break;
    default: // along the index finger
      tip = add(scale(F, 0.75), scale(T, 0.42));
  }
  const bend = scale(N, 0.06);
  pts[THUMB[0]] = cmc;
  pts[THUMB[1]] = add(add(cmc, scale(sub(tip, cmc), 0.4)), bend);
  pts[THUMB[2]] = add(add(cmc, scale(sub(tip, cmc), 0.72)), bend);
  pts[THUMB[3]] = tip;
  return pts;
}

export const translate = (h: HandPoints, by: Vec): HandPoints => h.map((p) => add(p, by));

/** Deterministic pseudo-random noise (for tests and demos). */
export function noisy(h: HandPoints, amount: number, seed = 1): HandPoints {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647 - 0.5;
  };
  return h.map(([x, y, z]) => [x + rnd() * amount, y + rnd() * amount, z + rnd() * amount]);
}

/** Two hands posed as a letter: the dominant hand's contact point placed on the other hand's. */
export function makeLetter(t: LetterTemplate, gap = 0.05): { dominant: HandPoints; other: HandPoints } {
  const sign = t.signs[0];
  const other = translate(makeHand(sign.nondominant ?? { shape: "flathand", ext: "o", palm: "u" }, "left"), [-0.6, 0, 0]);
  let dominant = translate(makeHand(sign.dominant, "right"), [0.6, 0.2, 0]);
  const a = contactPoint(dominant, sign.location.dominant ?? []);
  const b = contactPoint(other, sign.location.nondominant ?? []);
  if (a && b) dominant = translate(dominant, add(sub(b, a), [gap, 0, 0]));
  return { dominant, other };
}
