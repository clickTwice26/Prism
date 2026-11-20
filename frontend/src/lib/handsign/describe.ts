// Plain-language descriptions of a letter's parts, for the practice coach.
// "Signing hand" is the dominant hand; "other hand" is the one it touches.

import { palmVector, type Vec } from "./hand.ts";
import type { LetterTemplate, PartName, PoseTemplate } from "./letters.ts";
import type { ActionT, WordTemplate } from "./motion.ts";
import type { WordPart } from "./words.ts";

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
  o: "away from you",
  i: "toward you",
};

/** The nearest direction code for a vector in the signer's frame, e.g. [0, 0, -1] → "i". */
function codeFor(v: Vec): string {
  const parts: [number, string, string][] = [
    [v[1], "u", "d"],
    [v[0], "r", "l"],
    [v[2], "o", "i"],
  ];
  return parts
    .filter(([x]) => Math.abs(x) > 0.38)
    .sort((a, b) => Math.abs(b[0]) - Math.abs(a[0]))
    .map(([x, pos, neg]) => (x > 0 ? pos : neg))
    .join("");
}

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
  // HamNoSys palm codes are relative to the fingers: say where the palm really faces.
  const palm = p?.palm ? palmVector(p.ext, p.palm) : null;
  const parts = [p?.ext && `fingers point ${directionWords(p.ext)}`, palm && `palm faces ${directionWords(codeFor(palm))}`];
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

// ---- words ----

const SITE_WORDS: Record<string, string> = {
  head: "the top of your head",
  headtop: "the top of your head",
  forehead: "your forehead",
  eyebrows: "your eyebrows",
  eyes: "your eyes",
  nose: "your nose",
  nostrils: "your nose",
  ear: "your ear",
  earlobe: "your ear",
  cheek: "your cheek",
  lips: "your mouth",
  teeth: "your mouth",
  tongue: "your mouth",
  chin: "your chin",
  underchin: "under your chin",
  neck: "your neck",
  shouldertop: "the top of your shoulder",
  shoulders: "shoulder height, in front of you",
  chest: "your chest",
  stomach: "your stomach",
  belowstomach: "below your stomach",
  neutralspace: "the space in front of you",
};

export function siteWords(site?: string, side?: string): string {
  const base = SITE_WORDS[site ?? ""] ?? "shoulder height, in front of you";
  return side === "at" || side === "beside" ? `${base}, on your signing-hand side` : base;
}

function actionWords(a: ActionT): string | null {
  const size = a.size === "large" ? " a long way" : a.size === "small" ? " a little" : "";
  switch (a.kind) {
    case "move":
      return a.target?.site ? `move to ${siteWords(a.target.site)}` : `move ${directionWords(a.dir)}${size}`;
    case "arc":
      return `move in an arc ${directionWords(a.dir)}`;
    case "circle":
    case "ellipse":
      return "make a small circle";
    case "change":
      return a.to?.shape ? `change your hand to ${shapeWords(a.to)}` : "turn your hand";
    case "fingerplay":
      return "wiggle your fingers";
    case "swinging":
    case "wavy":
    case "zigzag":
      return "swing your hand side to side";
    case "nodding":
      return "bend your wrist up and down";
    case "twisting":
      return "twist your wrist";
    case "stir":
      return "make a stirring movement";
    default:
      return null; // hold
  }
}

/** Step-by-step instructions for a word, one entry per sign. */
export function describeWord(t: WordTemplate): { label: string; text: string }[] {
  return t.signs.flatMap((s, i) => {
    const n = t.signs.length > 1 ? ` (part ${i + 1})` : "";
    const steps = s.actions.map(actionWords).filter((x): x is string => !!x);
    const repeat = s.repeat === "again" ? " Do it twice." : s.repeat === "several" ? " Repeat it a few times." : "";
    const out = [
      { label: `Signing hand${n}`, text: `${shapeWords(s.dominant)}; ${orientationWords(s.dominant)}.` },
      { label: `Start${n}`, text: `At ${siteWords(s.location.site, s.location.side)}.` },
    ];
    if (s.hands !== "one" && s.hands !== "nondominant") {
      const how = s.hands === "two_mirror" ? " It mirrors your signing hand." : s.hands === "two_parallel" ? " It moves with your signing hand." : "";
      out.push({ label: `Other hand${n}`, text: `${shapeWords(s.nondominant ?? s.dominant)}.${how}` });
    }
    out.push({ label: `Movement${n}`, text: steps.length ? `${steps.join(", then ")}.${repeat}` : `Hold still.${repeat}` });
    return out;
  });
}

/** One sentence telling the learner how to fix a part of a word. */
export function wordFeedback(t: WordTemplate, part: WordPart): string {
  const s = t.signs[0];
  switch (part) {
    case "handshape":
      return `Make your signing hand ${shapeWords(s.dominant)}.`;
    case "location":
      return `Start at ${siteWords(s.location.site, s.location.side)}.`;
    case "movement": {
      const steps = s.actions.map(actionWords).filter((x): x is string => !!x);
      return steps.length ? `Then ${steps.join(", then ")}.` : "Keep your hand still in place.";
    }
    case "direction":
      return `Turn your signing hand: ${orientationWords(s.dominant)}.`;
    case "otherHand":
      return s.hands === "one" ? "Keep your other hand down." : `Use your other hand too: ${shapeWords(s.nondominant ?? s.dominant)}.`;
  }
}
