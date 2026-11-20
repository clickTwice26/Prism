// Writes a sign down from a recorded signing: the parts a sign description
// has (handshape, starting place, direction, movement, other hand), in the
// same template form as the corpus. Used when a deaf reviewer approves a
// community-recorded sign the corpus does not have, so Prism can recognise
// it with the same matcher, and so the reviewer can read what Prism learned.
// It stores a description, not anyone's recording.

import { dot, fingerDirection, mean, palmDirection, palmVector, rankShapes, shapeFeatures, type HandPoints, type Vec } from "./hand.ts";
import { sitePosition, toBody, type Body, type Vec2 } from "./body.ts";
import type { ActionT, PoseT, SignT, WordTemplate } from "./motion.ts";
import { smoothFrames, type SignFrame } from "./words.ts";

const SITES = ["forehead", "eyes", "nose", "lips", "chin", "neck", "shoulders", "chest", "stomach", "belowstomach"];
const PALM_CODES = ["u", "d", "l", "r", "ul", "ur", "dl", "dr"];

const palmCentre = (h: HandPoints) => mean([0, 5, 9, 13, 17].map((i) => h[i]));

/** The nearest one- or two-letter direction code for a vector (u, d, l, r, o, i). */
export function nearestDir(v: Vec, allowDepth = true): string {
  const parts: [number, string, string][] = [
    [v[1], "u", "d"],
    [v[0], "r", "l"],
    ...(allowDepth ? ([[v[2], "o", "i"]] as [number, string, string][]) : []),
  ];
  const strong = parts.filter(([x]) => Math.abs(x) > 0.38).sort((a, b) => Math.abs(b[0]) - Math.abs(a[0]));
  const code = strong
    .slice(0, 2)
    .map(([x, pos, neg]) => (x > 0 ? pos : neg))
    .join("");
  // HamNoSys writes the vertical part first (ul, not lu) and "o"/"i" before l/r (ol, not lo).
  const order = (c: string) => "udoilr".indexOf(c);
  return [...code].sort((a, b) => order(a) - order(b)).join("");
}

/** The HamNoSys palm code (relative to the fingers) that best describes an observed palm direction. */
export function relativePalmCode(extCode: string, palm: Vec): string {
  let best = { code: "d", score: -2 };
  for (const code of PALM_CODES) {
    const v = palmVector(extCode, code);
    const sc = v ? dot(v, palm) : -2;
    if (sc > best.score) best = { code, score: sc };
  }
  return best.code;
}

function mode<T>(xs: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** The handshape (with thumb and base-bend modifiers) seen most over some frames of one hand. */
function poseOf(hands: HandPoints[], side: "right" | "left"): PoseT {
  const feats = hands.map(shapeFeatures);
  const shape = mode(feats.map((f) => rankShapes(f)[0].shape)) ?? "flathand";
  const pose: PoseT = { shape };
  if (!/pinch|cee/.test(shape)) {
    const side0 = mean(feats.map((f) => [f.thumbSide, 0, 0] as Vec))[0];
    pose.thumb = side0 < -0.05 ? "across" : side0 > 0.42 ? "out" : "open";
  }
  if (["flathand", "finger2345", "finger2", "finger23", "finger23spread"].includes(shape)) {
    const bend = mean(feats.map((f) => [f.baseBend[0], 0, 0] as Vec))[0];
    if (bend > 0.4) pose.bend = "bent";
  }
  const ext = nearestDir(mean(hands.map(fingerDirection)));
  pose.ext = ext || "u";
  pose.palm = relativePalmCode(pose.ext, mean(hands.map((h) => palmDirection(h, side))));
  return pose;
}

function nearestSite(body: Body, at: Vec2): { site: string; side?: string } {
  let best = { site: "shoulders", d: Infinity, x: 0 };
  for (const site of SITES) {
    const p = sitePosition(body, site);
    const d = Math.hypot(p[0] - at[0], p[1] - at[1]);
    if (d < best.d) best = { site, d, x: at[0] - p[0] };
  }
  // Off to the signing-hand side of the site: HamNoSys "at" or "beside".
  const side = best.x > 0.48 ? "beside" : best.x > 0.15 ? "at" : undefined;
  return side ? { site: best.site, side } : { site: best.site };
}

/** Keeps the turning points of a path (Ramer-Douglas-Peucker). */
export function simplifyPath(pts: Vec2[], eps: number): Vec2[] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
  let far = { i: 0, d: -1 };
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const d = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len;
    if (d > far.d) far = { i, d };
  }
  if (far.d <= eps) return [a, b];
  return [...simplifyPath(pts.slice(0, far.i + 1), eps).slice(0, -1), ...simplifyPath(pts.slice(far.i), eps)];
}

/**
 * A sign template written from a recorded signing, or null if the signing
 * hand and body were not seen in enough frames.
 */
export function deriveTemplate(frames: SignFrame[], meta: { id: string; bn: string }): WordTemplate | null {
  const fs = smoothFrames(frames).filter((f) => f.dominant && f.body);
  if (fs.length < 6) return null;
  const body = fs[Math.floor(fs.length / 2)].body!;
  const third = Math.max(2, Math.floor(fs.length * 0.3));
  const head = fs.slice(0, third);
  const tail = fs.slice(-third);
  const pos = fs.map((f) => toBody(f.body!, palmCentre(f.dominant!)));

  const startPos = mean(head.map((f) => [...toBody(f.body!, palmCentre(f.dominant!)), 0] as Vec));
  const dominant = poseOf(head.map((f) => f.dominant!), "right");
  const location: SignT["location"] = nearestSite(body, [startPos[0], startPos[1]]);

  // Movement: the hand's path, simplified to its turning points.
  const actions: ActionT[] = [];
  const path = simplifyPath(pos, 0.12);
  for (let i = 1; i < path.length; i++) {
    const d: Vec = [path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], 0];
    const len = Math.hypot(d[0], d[1]);
    if (len < 0.12) continue;
    const dir = nearestDir([d[0] / len, d[1] / len, 0], false);
    if (!dir) continue;
    actions.push({ kind: "move", dir, ...(len < 0.3 ? { size: "small" } : len > 0.6 ? { size: "large" } : {}) });
  }
  const endShape = poseOf(tail.map((f) => f.dominant!), "right");
  if (endShape.shape !== dominant.shape) {
    const last = actions[actions.length - 1];
    if (last) last.to = { shape: endShape.shape };
    else actions.push({ kind: "change", to: { shape: endShape.shape } });
  }

  // The other hand: used if it is up in most frames.
  const withOther = fs.filter((f) => f.other && toBody(f.body!, palmCentre(f.other))[1] > -1.1);
  const sign: SignT = { hands: "one", dominant, location, actions };
  if (withOther.length >= fs.length / 2) {
    const o = withOther.map((f) => f.other!);
    sign.nondominant = poseOf(o.slice(0, Math.max(2, Math.floor(o.length * 0.3))), "left");
    const oPos = withOther.map((f) => toBody(f.body!, palmCentre(f.other!)));
    const od: Vec2 = [oPos[oPos.length - 1][0] - oPos[0][0], oPos[oPos.length - 1][1] - oPos[0][1]];
    const dd: Vec2 = [pos[pos.length - 1][0] - pos[0][0], pos[pos.length - 1][1] - pos[0][1]];
    const still = Math.hypot(od[0], od[1]) < 0.12;
    sign.hands = still ? "two" : Math.sign(od[0]) === -Math.sign(dd[0]) && Math.abs(dd[0]) > 0.1 ? "two_mirror" : "two_parallel";
    // Hands touching at the start: record the contact; otherwise where the other hand is.
    const oStart: Vec2 = oPos[0];
    if (Math.hypot(oStart[0] - startPos[0], oStart[1] - startPos[1]) < 0.25) {
      location.dominant = ["palm"];
      location.nondominant = ["palm"];
    } else {
      location.nondominant_site = nearestSite(body, oStart).site;
    }
  }
  return { id: meta.id, bn: meta.bn, signs: [sign] };
}
