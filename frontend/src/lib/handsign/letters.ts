// Matches a two-hand frame against the Bangla two-hand alphabet. Every letter
// is a dominant hand touching a named point of the other hand, so a letter is
// checked part by part: each handshape, each hand's direction, and the
// contact point. See docs/sign-recognition-plan.md.

import {
  contactPoint,
  dirVector,
  dist,
  dot,
  fingerDirection,
  handSize,
  palmDirection,
  shapeFeatures,
  shapeScore,
  type HandPoints,
} from "./hand.ts";

// The parts of a sign template this matcher reads (see /api/sign/templates).
export interface PoseTemplate {
  shape?: string;
  thumb?: string;
  bend?: string;
  ext?: string;
  palm?: string;
}
export interface LetterTemplate {
  id: string;
  bn: string;
  signs: {
    hands: string;
    dominant: PoseTemplate;
    nondominant?: PoseTemplate;
    location: { dominant?: string[]; nondominant?: string[] };
  }[];
}

export type PartName = "shape" | "otherShape" | "contact" | "direction" | "otherDirection";

export const PART_LABELS: Record<PartName, string> = {
  shape: "Handshape",
  otherShape: "Other hand's shape",
  contact: "Where the hands touch",
  direction: "Hand direction",
  otherDirection: "Other hand's direction",
};

// Contact matters most: many letters share handshapes and differ only in where they touch.
const WEIGHTS: Record<PartName, number> = { shape: 0.22, otherShape: 0.13, contact: 0.35, direction: 0.18, otherDirection: 0.12 };

export interface LetterScore {
  letter: string;
  score: number; // 0 to 1
  parts: Record<PartName, number>;
}

/** 0 to 1: how closely an observed direction matches a HamNoSys direction code. */
function directionScore(observed: [number, number, number], code: string | undefined): number {
  const want = code ? dirVector(code) : null;
  if (!want) return 0.5;
  const c = dot(observed, want); // -1 … 1
  return Math.max(0, c) ** 2; // 45° off scores 0.5, 90° scores 0
}

function orientation(h: HandPoints, side: "right" | "left", p: PoseTemplate): number {
  const ext = directionScore(fingerDirection(h), p.ext);
  const palm = directionScore(palmDirection(h, side), p.palm);
  return Math.sqrt(ext * palm);
}

export interface TwoHands {
  dominant: HandPoints;
  other: HandPoints;
  /** Anatomical side of the dominant hand. Left-handed signers' points are mirrored, so this is usually "right". */
  dominantSide?: "right" | "left";
}

/** Scores every letter for one frame, best first. */
export function scoreLetters(hands: TwoHands, letters: LetterTemplate[]): LetterScore[] {
  const side = hands.dominantSide ?? "right";
  const otherSide = side === "right" ? "left" : "right";
  const fd = shapeFeatures(hands.dominant);
  const fo = shapeFeatures(hands.other);
  const size = handSize(hands.dominant);
  const out: LetterScore[] = [];
  for (const t of letters) {
    const sign = t.signs[0];
    if (!sign) continue;
    const parts: Record<PartName, number> = {
      shape: shapeScore(fd, sign.dominant.shape ?? "", sign.dominant.thumb, sign.dominant.bend),
      otherShape: sign.nondominant?.shape ? shapeScore(fo, sign.nondominant.shape, sign.nondominant.thumb, sign.nondominant.bend) : 0.5,
      contact: 0.5,
      direction: orientation(hands.dominant, side, sign.dominant),
      otherDirection: sign.nondominant ? orientation(hands.other, otherSide, sign.nondominant) : 0.5,
    };
    const a = contactPoint(hands.dominant, sign.location.dominant ?? []);
    const b = contactPoint(hands.other, sign.location.nondominant ?? []);
    if (a && b) parts.contact = Math.exp(-((dist(a, b) / size / 0.35) ** 2));
    // Weighted geometric mean: one badly wrong part pulls the letter down.
    let logSum = 0;
    for (const k of Object.keys(WEIGHTS) as PartName[]) logSum += WEIGHTS[k] * Math.log(Math.max(parts[k], 1e-4));
    out.push({ letter: t.bn, score: Math.exp(logSum), parts });
  }
  return out.sort((x, y) => y.score - x.score);
}

/** The part that most needs fixing for a target letter, for coach feedback. */
export function weakestPart(s: LetterScore): PartName {
  return (Object.keys(s.parts) as PartName[]).reduce((w, k) => (s.parts[k] < s.parts[w] ? k : w), "contact" as PartName);
}

/**
 * Turns per-frame best guesses into typed letters: a letter is accepted once
 * it has been the confident best guess for most of the recent frames, and the
 * same letter is accepted again only after the hands change.
 */
export class LetterStabilizer {
  private recent: (string | null)[] = [];
  private lastAccepted: string | null = null;
  private readonly window: number;
  private readonly need: number;
  private readonly minScore: number;

  constructor(window = 12, need = 9, minScore = 0.55) {
    this.window = window;
    this.need = need;
    this.minScore = minScore;
  }

  /** Feed one frame's best guess (or null if no hands). Returns a letter when one is accepted. */
  push(best: LetterScore | null): string | null {
    const guess = best && best.score >= this.minScore ? best.letter : null;
    this.recent.push(guess);
    if (this.recent.length > this.window) this.recent.shift();
    const count = this.recent.filter((g) => g === guess).length;
    if (guess === null) {
      if (count >= Math.ceil(this.window / 2)) this.lastAccepted = null; // hands dropped: the same letter may come again
      return null;
    }
    if (count >= this.need && guess !== this.lastAccepted) {
      this.lastAccepted = guess;
      return guess;
    }
    return null;
  }

  reset() {
    this.recent = [];
    this.lastAccepted = null;
  }
}
