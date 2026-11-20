// Body landmarks for sign locations: where the forehead, chin, chest and the
// other HamNoSys body sites are on a signer, from MediaPipe pose points.
// Positions are compared in 2D (the camera's view): the pose and hand models
// give reliable x and y, but their depth estimates do not share a scale.
// All distances are in shoulder widths. See docs/sign-recognition-plan.md.

import { add, scale, type Vec } from "./hand.ts";

/** MediaPipe pose landmark indices (33 points). "left" is the signer's own left. */
export const POSE = {
  nose: 0,
  leftEye: 2,
  rightEye: 5,
  leftEar: 7,
  rightEar: 8,
  mouthLeft: 9,
  mouthRight: 10,
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
} as const;

// Left/right pairs, for mirroring a left-handed signer.
const PAIRS: [number, number][] = [
  [1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18],
  [19, 20], [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32],
];

/** Mirrors pose points (in the signer's frame) so a left-handed signer looks right-handed. */
export function mirrorBody(points: Vec[]): Vec[] {
  const out = points.map(([x, y, z]) => [-x, y, z] as Vec);
  for (const [a, b] of PAIRS) [out[a], out[b]] = [out[b], out[a]];
  return out;
}

export type Vec2 = [number, number];

export interface Body {
  /** Middle of the shoulders: the origin of body coordinates. */
  center: Vec2;
  /** Shoulder width: the unit of body coordinates. */
  width: number;
  eyes: Vec2;
  nose: Vec2;
  mouth: Vec2;
  ear: { right: Vec2; left: Vec2 };
  shoulder: { right: Vec2; left: Vec2 };
  hips: Vec2;
}

const xy = (v: Vec): Vec2 => [v[0], v[1]];
const mid = (a: Vec2, b: Vec2): Vec2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** Body anchors from 33 pose points in the signer's frame (x right, y up). */
export function bodyFrom(points: Vec[]): Body | null {
  if (points.length < 25) return null;
  const p = (i: number) => xy(points[i]);
  const right = p(POSE.rightShoulder);
  const left = p(POSE.leftShoulder);
  const width = Math.hypot(right[0] - left[0], right[1] - left[1]);
  if (width < 1e-6) return null;
  return {
    center: mid(right, left),
    width,
    eyes: mid(p(POSE.rightEye), p(POSE.leftEye)),
    nose: p(POSE.nose),
    mouth: mid(p(POSE.mouthRight), p(POSE.mouthLeft)),
    ear: { right: p(POSE.rightEar), left: p(POSE.leftEar) },
    shoulder: { right, left },
    hips: mid(p(POSE.rightHip), p(POSE.leftHip)),
  };
}

/** A point in body coordinates: shoulder widths from the middle of the shoulders, x to the signer's right, y up. */
export function toBody(b: Body, v: Vec | Vec2): Vec2 {
  return [(v[0] - b.center[0]) / b.width, (v[1] - b.center[1]) / b.width];
}

/**
 * Where a HamNoSys body site is, in body coordinates. side: "at" or
 * "beside" moves it toward the signing (dominant, right after mirroring)
 * side. Sites on the face come from the face points; the torso is measured
 * down from the shoulders.
 */
export function sitePosition(b: Body, site: string | undefined, side?: string): Vec2 {
  const B = (v: Vec2) => toBody(b, v);
  const eyes = B(b.eyes);
  const mouth = B(b.mouth);
  const up: Vec2 = [eyes[0] - mouth[0], eyes[1] - mouth[1]]; // mouth → eyes
  const along = (from: Vec2, k: number): Vec2 => [from[0] + up[0] * k, from[1] + up[1] * k];
  const shoulderR = B(b.shoulder.right);
  let pos: Vec2;
  switch (site) {
    case "headtop":
    case "head":
      pos = along(eyes, site === "headtop" ? 1.8 : 1.3);
      break;
    case "forehead":
      pos = along(eyes, 0.9);
      break;
    case "eyebrows":
      pos = along(eyes, 0.35);
      break;
    case "eyes":
      pos = eyes;
      break;
    case "nose":
    case "nostrils":
      pos = B(b.nose);
      break;
    case "ear":
    case "earlobe":
      pos = B(b.ear.right);
      break;
    case "cheek":
      pos = mid(B(b.ear.right), B(b.nose));
      break;
    case "lips":
    case "teeth":
    case "tongue":
      pos = mouth;
      break;
    case "chin":
      pos = along(mouth, -0.7);
      break;
    case "underchin":
      pos = along(mouth, -1.0);
      break;
    case "neck":
      pos = [0, along(mouth, -0.7)[1] * 0.45]; // between the chin and the shoulders
      break;
    case "shouldertop":
      pos = [shoulderR[0] * 0.8, 0.12];
      break;
    case "chest":
      pos = [0, -0.45];
      break;
    case "stomach":
      pos = [0, -0.95];
      break;
    case "belowstomach":
      pos = [0, -1.3];
      break;
    case "shoulders":
    case "neutralspace":
    default:
      // Shoulder height in front of the body: also where unlocated signs are made.
      pos = [0, -0.15];
  }
  // Side on the signing hand's side: at it, or beside it.
  if (side === "at") pos = [pos[0] + 0.3, pos[1]];
  if (side === "beside") pos = [pos[0] + 0.65, pos[1]];
  return pos;
}

/** A synthetic body (signer's frame) for tests and the simulation: shoulders 1 apart, centred at origin. */
export function syntheticBody(offset: Vec = [0, 0, 0], size = 1): Vec[] {
  const pts: Vec[] = new Array(33).fill(null).map(() => [0, 0, 0] as Vec);
  const set = (i: number, x: number, y: number) => (pts[i] = add(scale([x, y, 0], size), offset));
  set(POSE.nose, 0, 0.72);
  set(POSE.leftEye, -0.12, 0.82);
  set(POSE.rightEye, 0.12, 0.82);
  set(1, -0.09, 0.82);
  set(3, -0.15, 0.82);
  set(4, 0.09, 0.82);
  set(6, 0.15, 0.82);
  set(POSE.leftEar, -0.25, 0.76);
  set(POSE.rightEar, 0.25, 0.76);
  set(POSE.mouthLeft, -0.07, 0.6);
  set(POSE.mouthRight, 0.07, 0.6);
  set(POSE.leftShoulder, -0.5, 0);
  set(POSE.rightShoulder, 0.5, 0);
  set(13, -0.62, -0.6);
  set(14, 0.62, -0.6);
  set(POSE.leftHip, -0.35, -1.5);
  set(POSE.rightHip, 0.35, -1.5);
  for (const i of [15, 16, 17, 18, 19, 20, 21, 22, 25, 26, 27, 28, 29, 30, 31, 32]) {
    const left = i % 2 === 1;
    set(i, left ? -0.4 : 0.4, i < 25 ? -1.0 : -2.5);
  }
  return pts;
}

