// Plain-language descriptions of a letter's parts, for the practice coach.
// "Signing hand" is the dominant hand; "other hand" is the one it touches.

import type { LetterTemplate, PartName, PoseTemplate } from "./letters.ts";

const SHAPE_WORDS: Record<string, string> = {
  fist: "a fist",
  flathand: "a flat hand, fingers together",
  finger2345: "an open hand, fingers spread",
  finger2: "the index finger pointing",
  finger23: "index and middle fingers together",
  finger23spread: "index and middle fingers apart (a V)",
  pinch12: "thumb and index finger pinched",
  pinch12open: "thumb and index pinched, other fingers open",
  pinchall: "all fingertips touching the thumb",
  cee12: "thumb and index curved like a C",
  ceeall: "the whole hand curved like a C",
  ceeopen: "a wide C",
};

const THUMB_WORDS: Record<string, string> = {
  across: "thumb across the palm",
  open: "thumb open",
  out: "thumb out to the side",
};

const DIR_WORDS: Record<string, string> = {
  u: "up",
  d: "down",
  l: "to your left",
  r: "to your right",
  o: "forward",
  i: "toward you",
};

export function directionWords(code?: string): string {
  if (!code) return "";
  return code
    .split("")
    .map((c) => DIR_WORDS[c] ?? c)
    .join(" and ");
}

const PART_WORDS: Record<string, string> = {
  fingertip: "tip",
  fingernail: "nail",
  fingerpad: "pad",
  fingermidjoint: "middle joint",
  fingerbase: "base",
  fingerside: "side",
  palm: "palm",
  handback: "back of the hand",
  wristback: "back of the wrist",
  thumbside: "thumb side",
  pinkyside: "little-finger side",
  thumbball: "ball of the thumb",
};
const FINGER_WORDS: Record<string, string> = {
  thumb: "thumb",
  index: "index finger",
  middle: "middle finger",
  ring: "ring finger",
  pinky: "little finger",
};

export function partWords(parts: string[] = []): string {
  if (parts.length === 0) return "";
  const [part, finger] = parts;
  if (FINGER_WORDS[part]) return `the ${FINGER_WORDS[part]} tip`;
  const p = PART_WORDS[part] ?? part;
  return finger && FINGER_WORDS[finger] ? `the ${p} of the ${FINGER_WORDS[finger]}` : `the ${p}`;
}

export function shapeWords(p?: PoseTemplate): string {
  if (!p?.shape) return "any shape";
  const base = SHAPE_WORDS[p.shape] ?? p.shape;
  const extra = [p.thumb && THUMB_WORDS[p.thumb], p.bend === "bent" && "fingers bent at the knuckles"].filter(Boolean);
  return extra.length ? `${base}, ${extra.join(", ")}` : base;
}

function orientationWords(p?: PoseTemplate): string {
  const parts = [p?.ext && `fingers point ${directionWords(p.ext)}`, p?.palm && `palm faces ${directionWords(p.palm)}`];
  return parts.filter(Boolean).join(", ");
}

/** Step-by-step instructions for a letter. */
export function describeLetter(t: LetterTemplate): { label: string; text: string }[] {
  const s = t.signs[0];
  if (!s) return [];
  return [
    { label: "Signing hand", text: `${shapeWords(s.dominant)}; ${orientationWords(s.dominant)}.` },
    { label: "Other hand", text: `${shapeWords(s.nondominant)}; ${orientationWords(s.nondominant)}.` },
    {
      label: "Touch",
      text: `Put ${partWords(s.location.dominant)} of your signing hand on ${partWords(s.location.nondominant)} of your other hand.`,
    },
  ];
}

/** One sentence telling the learner how to fix a part. */
export function feedback(t: LetterTemplate, part: PartName): string {
  const s = t.signs[0];
  switch (part) {
    case "shape":
      return `Make your signing hand ${shapeWords(s.dominant)}.`;
    case "otherShape":
      return `Make your other hand ${shapeWords(s.nondominant)}.`;
    case "contact":
      return `Touch ${partWords(s.location.dominant)} of your signing hand to ${partWords(s.location.nondominant)} of your other hand.`;
    case "direction":
      return `Turn your signing hand: ${orientationWords(s.dominant)}.`;
    case "otherDirection":
      return `Turn your other hand: ${orientationWords(s.nondominant)}.`;
  }
}
