// Hand geometry for sign recognition: turns MediaPipe's 21 hand points into
// the parts HamNoSys describes (handshape, finger direction, palm direction,
// contact points). Pure functions, no browser APIs, so they run in tests.
// See docs/sign-recognition-plan.md.

export type Vec = [number, number, number];

/** 21 points of one hand in the signer's frame: x = signer's right, y = up, z = out (away from the body). */
export type HandPoints = Vec[];

// MediaPipe hand landmark indices.
export const WRIST = 0;
export const THUMB = [1, 2, 3, 4] as const; // CMC, MCP, IP, TIP
export const FINGERS = {
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
} as const; // MCP, PIP, DIP, TIP
export type FingerName = keyof typeof FINGERS;
export const FINGER_NAMES: FingerName[] = ["index", "middle", "ring", "pinky"];

// ---- vectors ----
export const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const norm = (a: Vec) => Math.hypot(a[0], a[1], a[2]);
export const dist = (a: Vec, b: Vec) => norm(sub(a, b));
export const unit = (a: Vec): Vec => {
  const n = norm(a);
  return n > 1e-9 ? scale(a, 1 / n) : [0, 0, 0];
};
export const mean = (ps: Vec[]): Vec => scale(ps.reduce(add, [0, 0, 0] as Vec), 1 / Math.max(ps.length, 1));
const angle = (a: Vec, b: Vec) => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b)))));
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Converts MediaPipe image landmarks (x right, y down, z toward the camera
 * smaller; x and z in image-width units, y in image-height units) of an
 * un-mirrored front camera into the signer's frame. aspect = width / height.
 */
export function toSignerFrame(points: { x: number; y: number; z: number }[], aspect: number): HandPoints {
  // Un-mirrored front camera: the signer's right is the image's left.
  return points.map((p) => [-p.x * aspect, -p.y, -p.z * aspect]);
}

/** Mirrors a left-handed signer's points so templates written for the right hand apply. */
export const mirror = (h: HandPoints): HandPoints => h.map(([x, y, z]) => [-x, y, z]);

/** Hand size: wrist to middle-finger base. Distances are measured in these units. */
export const handSize = (h: HandPoints) => Math.max(dist(h[WRIST], h[FINGERS.middle[0]]), 1e-6);

// ---- directions ----

/** HamNoSys direction letters (u, d, l, r, o, i and combinations) as a unit vector in the signer's frame. */
export function dirVector(code: string): Vec | null {
  const axes: Record<string, Vec> = { u: [0, 1, 0], d: [0, -1, 0], l: [-1, 0, 0], r: [1, 0, 0], o: [0, 0, 1], i: [0, 0, -1] };
  let v: Vec = [0, 0, 0];
  for (const c of code) {
    const a = axes[c];
    if (!a) return null;
    v = add(v, a);
  }
  return norm(v) > 0 ? unit(v) : null;
}

/**
 * The direction a HamNoSys palm code means, in the signer's frame. HamNoSys
 * writes palm orientation relative to the finger direction: the eight palm
 * codes (u, d, l, r and their combinations) describe the palm as if the
 * fingers pointed forward, away from the body. So the code is rotated by the
 * turn that takes "forward" to the actual finger direction. For example,
 * fingers left with palm code "l" is a palm facing the signer (a hand laid on
 * the forehead, as in জ্বর, fever).
 */
export function palmVector(extCode: string | undefined, palmCode: string | undefined): Vec | null {
  const p = palmCode ? dirVector(palmCode) : null;
  if (!p) return null;
  const e = extCode ? dirVector(extCode) : null;
  if (!e) return p;
  const forward: Vec = [0, 0, 1];
  const c = dot(forward, e);
  if (c > 0.9999) return p;
  if (c < -0.9999) return [-p[0], p[1], -p[2]]; // fingers toward the body: half a turn about the vertical
  // Rodrigues' rotation of p about forward × e by the angle between them.
  const k = unit(cross(forward, e));
  const s = Math.sqrt(1 - c * c);
  const kxp = cross(k, p);
  const kdp = dot(k, p);
  return unit(add(add(scale(p, c), scale(kxp, s)), scale(k, kdp * (1 - c))));
}

/** Direction the fingers point (wrist → middle-finger base), as for HamNoSys "extended finger direction". */
export const fingerDirection = (h: HandPoints): Vec => unit(sub(h[FINGERS.middle[0]], h[WRIST]));

/**
 * Direction the palm faces. side is the hand's anatomical side ("right" or
 * "left"); a right hand held up, palm facing out, has its thumb toward the
 * signer's left.
 */
export function palmDirection(h: HandPoints, side: "right" | "left"): Vec {
  const n = cross(sub(h[FINGERS.index[0]], h[WRIST]), sub(h[FINGERS.pinky[0]], h[WRIST]));
  return unit(side === "right" ? scale(n, -1) : n);
}

// ---- handshape features ----

export interface ShapeFeatures {
  /** Straightness per finger, 0 (curled) to 1 (straight): thumb, index, middle, ring, pinky. */
  straight: [number, number, number, number, number];
  /** Bend at the finger base (MCP) per finger, 0 (none) to 1 (90°): index … pinky. */
  baseBend: [number, number, number, number];
  /** Angle in radians between neighbouring fingers: index–middle, middle–ring, ring–pinky. */
  spread: [number, number, number];
  /** Thumb tip distance to each fingertip, in hand sizes: index … pinky. */
  thumbTo: [number, number, number, number];
  /** Thumb tip distance to the pinky base, in hand sizes: small when the thumb lies across the palm. */
  thumbAcross: number;
  /** Thumb tip distance from the index base, in hand sizes: large when the thumb sticks out. */
  thumbOut: number;
  /**
   * How far the thumb tip lies beyond the index base, sideways toward the
   * thumb, in hand sizes: negative when across the palm, about 0.3 when open,
   * 0.5 or more when stuck out.
   */
  thumbSide: number;
}

function straightness(h: HandPoints, chain: readonly number[]): number {
  let len = 0;
  for (let i = 0; i + 1 < chain.length; i++) len += dist(h[chain[i]], h[chain[i + 1]]);
  // Fully curled fingers fold to about 40% of their length; map that to 0.
  return clamp01((dist(h[chain[0]], h[chain[chain.length - 1]]) / Math.max(len, 1e-9) - 0.4) / 0.6);
}

/**
 * Finger straightness from how much it curls after the base knuckle: the
 * angle between the first segment (base → middle knuckle) and the line from
 * the middle knuckle to the tip. Straight is 1, a C-shaped curve about 0.5, a
 * fist 0 (about 150°). Measuring over the longer middle-knuckle-to-tip line
 * keeps camera jitter from looking like a bent finger. Bending at the base
 * knuckle is measured separately (baseBend), as HamNoSys does.
 */
function fingerStraightness(h: HandPoints, f: FingerName): number {
  const [mcp, pip, , tip] = FINGERS[f];
  const bend = angle(sub(h[pip], h[mcp]), sub(h[tip], h[pip]));
  return clamp01(1 - bend / ((150 * Math.PI) / 180));
}

export function shapeFeatures(h: HandPoints): ShapeFeatures {
  const s = handSize(h);
  const tips = FINGER_NAMES.map((f) => h[FINGERS[f][3]]);
  const dirs = FINGER_NAMES.map((f) => sub(h[FINGERS[f][3]], h[FINGERS[f][0]]));
  return {
    straight: [straightness(h, THUMB), ...FINGER_NAMES.map((f) => fingerStraightness(h, f))] as ShapeFeatures["straight"],
    baseBend: FINGER_NAMES.map((f) =>
      clamp01(angle(sub(h[FINGERS[f][0]], h[WRIST]), sub(h[FINGERS[f][1]], h[FINGERS[f][0]])) / (Math.PI / 2)),
    ) as ShapeFeatures["baseBend"],
    spread: [angle(dirs[0], dirs[1]), angle(dirs[1], dirs[2]), angle(dirs[2], dirs[3])],
    thumbTo: tips.map((t) => dist(h[THUMB[3]], t) / s) as ShapeFeatures["thumbTo"],
    thumbAcross: dist(h[THUMB[3]], h[FINGERS.pinky[0]]) / s,
    thumbOut: dist(h[THUMB[3]], h[FINGERS.index[0]]) / s,
    thumbSide: dot(sub(h[THUMB[3]], h[FINGERS.index[0]]), unit(sub(h[FINGERS.index[0]], h[FINGERS.pinky[0]]))) / s,
  };
}

// ---- handshape scoring ----

/** The 12 HamNoSys base handshapes used in the corpus. */
export const BASE_SHAPES = [
  "fist", "flathand", "finger2345", "finger2", "finger23", "finger23spread",
  "pinch12", "pinch12open", "pinchall", "cee12", "ceeall", "ceeopen",
] as const;
export type BaseShape = (typeof BASE_SHAPES)[number];

// Expected straightness of index, middle, ring, pinky (1 = straight, 0 = curled, 0.6 = curved as in a C).
// Expected straightness (see fingerStraightness) of index, middle, ring, pinky: a curled finger
// reads about 0.15, a C-curve 0.6, a wide C 0.75, a straight finger 1. Spread is measured only
// between the fingers a shape extends.
const CURLED = 0.15;
const CURVED = 0.6;
const WIDE = 0.75;
const EXPECT: Record<BaseShape, { fingers: [number, number, number, number]; spread?: "together" | "apart"; pinch?: "index" | "all"; cee?: number }> = {
  fist: { fingers: [CURLED, CURLED, CURLED, CURLED] },
  flathand: { fingers: [1, 1, 1, 1], spread: "together" },
  finger2345: { fingers: [1, 1, 1, 1], spread: "apart" },
  finger2: { fingers: [1, CURLED, CURLED, CURLED] },
  finger23: { fingers: [1, 1, CURLED, CURLED], spread: "together" },
  finger23spread: { fingers: [1, 1, CURLED, CURLED], spread: "apart" },
  pinch12: { fingers: [CURVED, CURLED, CURLED, CURLED], pinch: "index" },
  pinch12open: { fingers: [CURVED, 1, 1, 1], pinch: "index" },
  pinchall: { fingers: [CURVED, CURVED, CURVED, CURVED], pinch: "all" },
  // cee: the gap between the thumb and index tips, in hand sizes.
  cee12: { fingers: [CURVED, CURLED, CURLED, CURLED], cee: 0.75 },
  ceeall: { fingers: [CURVED, CURVED, CURVED, CURVED], cee: 0.75 },
  ceeopen: { fingers: [WIDE, WIDE, WIDE, WIDE], cee: 1.0 },
};

const near = (x: number, target: number, tol: number) => Math.exp(-(((x - target) / tol) ** 2));

const THUMB_SIDE: Record<string, number> = { across: -0.35, open: 0.28, out: 0.55 };

/**
 * How well a hand matches a base handshape, 0 to 1. Optional HamNoSys
 * modifiers: thumb (across, open, out) and bend ("bent": straight fingers
 * bent at the base knuckle).
 */
export function shapeScore(f: ShapeFeatures, shape: string, thumb?: string, bend?: string): number {
  const e = EXPECT[shape as BaseShape];
  if (!e) return 0.5; // unknown or unspecified shape: neutral
  const fingers = e.fingers.reduce((acc, want, i) => acc * near(f.straight[i + 1], want, 0.2), 1) ** (1 / 4);
  let score = fingers;
  if (e.spread) {
    const twoFingers = e.fingers[2] < 0.5;
    const apart = twoFingers ? f.spread[0] : (f.spread[0] + f.spread[1] + f.spread[2]) / 3; // radians
    score *= e.spread === "apart" ? clamp01((apart - 0.08) / 0.15) * 0.8 + 0.2 : near(apart, 0.05, 0.15) * 0.8 + 0.2;
  }
  if (e.pinch === "index") score *= near(f.thumbTo[0], 0, 0.35);
  if (e.pinch === "all") score *= near((f.thumbTo[0] + f.thumbTo[1] + f.thumbTo[2] + f.thumbTo[3]) / 4, 0, 0.45);
  if (e.cee) score *= near(f.thumbTo[0], e.cee, 0.3); // a gap between thumb and fingers
  if (thumb && THUMB_SIDE[thumb] !== undefined && !e.pinch && !e.cee) {
    score *= 0.4 + 0.6 * near(f.thumbSide, THUMB_SIDE[thumb], 0.3);
  }
  // Base-knuckle bend of the straight fingers: about 0.6 when written "bent", near 0 otherwise.
  const straightOnes = e.fingers.map((w, i) => (w === 1 ? f.baseBend[i] : null)).filter((x): x is number => x !== null);
  if (straightOnes.length > 0) {
    const base = straightOnes.reduce((a, b) => a + b, 0) / straightOnes.length;
    score *= 0.4 + 0.6 * near(base, bend === "bent" ? 0.6 : 0.05, 0.3);
  }
  return score;
}

/** Best-matching base shapes, highest first. */
export function rankShapes(f: ShapeFeatures): { shape: BaseShape; score: number }[] {
  return BASE_SHAPES.map((shape) => ({ shape, score: shapeScore(f, shape) })).sort((a, b) => b.score - a.score);
}

// ---- contact points ----

const FINGER_KEYS: Record<string, FingerName | "thumb"> = {
  thumb: "thumb", index: "index", middle: "middle", ring: "ring", pinky: "pinky",
};

/**
 * The point on a hand that a HamNoSys location names, e.g. ["fingertip",
 * "index"] or ["palm"]. When two contact points are listed, the first is used.
 */
export function contactPoint(h: HandPoints, parts: string[]): Vec | null {
  if (parts.length === 0) return null;
  const [part, maybeFinger] = parts;
  const finger = maybeFinger ? FINGER_KEYS[maybeFinger] : undefined;
  const chain: readonly number[] | undefined = finger === "thumb" ? THUMB : finger ? FINGERS[finger] : undefined;
  const palm = mean([0, 5, 9, 13, 17].map((i) => h[i]));
  switch (part) {
    case "palm":
    case "handback":
      return palm;
    case "wristback":
      return h[WRIST];
    case "thumbside":
      return h[THUMB[2]];
    case "pinkyside":
      return mean([h[FINGERS.pinky[0]], h[WRIST]]);
    case "thumbball":
      return mean([h[THUMB[1]], h[WRIST]]);
    case "fingertip":
    case "fingernail":
      return chain ? h[chain[3]] : mean(FINGER_NAMES.map((f) => h[FINGERS[f][3]]));
    case "fingerpad":
      return chain ? add(scale(h[chain[3]], 0.7), scale(h[chain[2]], 0.3)) : mean(FINGER_NAMES.map((f) => h[FINGERS[f][3]]));
    case "fingermidjoint":
    case "fingerside":
      return chain ? h[finger === "thumb" ? THUMB[2] : chain[1]] : mean(FINGER_NAMES.map((f) => h[FINGERS[f][1]]));
    case "fingerbase":
      return chain ? h[finger === "thumb" ? THUMB[1] : chain[0]] : mean(FINGER_NAMES.map((f) => h[FINGERS[f][0]]));
    // A finger name alone means its tip.
    case "index":
    case "middle":
    case "ring":
    case "pinky":
      return h[FINGERS[part][3]];
    case "thumb":
      return h[THUMB[3]];
    default:
      return null;
  }
}

// ---- feature vector for learned models (Python training, docs/sign-recognition-plan.md) ----

export const FEATURE_VERSION = 1;

const HAND_FEATURES = 26;

function handVector(h: HandPoints | null, side: "right" | "left"): number[] {
  if (!h) return new Array(HAND_FEATURES).fill(0);
  const f = shapeFeatures(h);
  return [
    1,
    ...f.straight,
    ...f.baseBend,
    ...f.spread,
    ...f.thumbTo,
    f.thumbAcross,
    f.thumbOut,
    f.thumbSide,
    ...fingerDirection(h),
    ...palmDirection(h, side),
  ];
}

/**
 * A fixed-length description of a two-hand frame: each hand's shape and
 * orientation, plus normalised distances between the dominant hand's tips
 * and palm and the other hand's tips, joints, bases and palm. 151 numbers.
 */
export function featureVector(dom: HandPoints | null, other: HandPoints | null, domSide: "right" | "left" = "right"): number[] {
  const otherSide = domSide === "right" ? "left" : "right";
  const out = [...handVector(dom, domSide), ...handVector(other, otherSide)];
  if (dom && other) {
    const s = handSize(dom);
    const domPts = [...[4, 8, 12, 16, 20].map((i) => dom[i]), mean([0, 5, 9, 13, 17].map((i) => dom[i]))];
    const otherPts = [
      ...[4, 8, 12, 16, 20, 3, 6, 10, 14, 18, 2, 5, 9, 13, 17].map((i) => other[i]),
      mean([0, 5, 9, 13, 17].map((i) => other[i])),
    ];
    for (const a of domPts) for (const b of otherPts) out.push(Math.min(dist(a, b) / s, 5));
    out.push(...scale(sub(other[WRIST], dom[WRIST]), 1 / s));
  } else {
    out.push(...new Array(99).fill(0));
  }
  return out;
}

// ---- smoothing camera jitter ----

/**
 * Smooths one hand's points over time (an exponential moving average), so
 * tracking jitter does not look like a bending finger. Starts again whenever
 * the hand is lost, so a new hand never inherits an old position.
 */
export class PointSmoother {
  private last: HandPoints | null = null;
  private readonly alpha: number;

  /** alpha: weight of the newest frame (1 = no smoothing). */
  constructor(alpha = 0.5) {
    this.alpha = alpha;
  }

  push(h: HandPoints | null): HandPoints | null {
    if (!h) {
      this.last = null;
      return null;
    }
    const a = this.alpha;
    this.last = this.last ? h.map((p, i) => add(scale(p, a), scale(this.last![i], 1 - a))) : h;
    return this.last;
  }
}
