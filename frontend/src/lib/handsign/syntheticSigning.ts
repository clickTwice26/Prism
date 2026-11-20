// Synthetic signers for word recognition: moves computer-made hands through a
// word's keyframes at an uneven speed, with noise, in front of a synthetic
// body. Used by tests and the page's "simulate" mode. It checks that the
// recogniser is consistent with the descriptions; it says nothing about
// accuracy on real people.

import { add, contactPoint, mean, scale, sub, type HandPoints, type Vec } from "./hand.ts";
import { bodyFrom, syntheticBody, type Body } from "./body.ts";
import { wordKeyframes, type Keyframe, type WordTemplate } from "./motion.ts";
import { makeHand, noisy } from "./synthetic.ts";
import type { SignFrame } from "./words.ts";

const palmCentre = (h: HandPoints) => mean([0, 5, 9, 13, 17].map((i) => h[i]));

/** A hand posed as a keyframe says, with its reference point at a body position. */
function placeHand(k: Keyframe, which: "dom" | "other", body: Body, sizeScale: number): HandPoints | null {
  const pose = which === "dom" ? k.pose : k.otherPose;
  const at = which === "dom" ? k.dom : k.other;
  if (!pose || !at) return null;
  const hand = makeHand(pose, which === "dom" ? "right" : "left").map((p) => scale(p, sizeScale * 0.42 * body.width));
  const ref = which === "dom" && k.point.length ? (contactPoint(hand, k.point) ?? palmCentre(hand)) : palmCentre(hand);
  const target: Vec = [body.center[0] + at[0] * body.width, body.center[1] + at[1] * body.width, 0.3 * body.width];
  const shift = sub(target, ref);
  return hand.map((p) => add(p, shift));
}

const lerp = (a: HandPoints, b: HandPoints, t: number): HandPoints => a.map((p, i) => add(scale(p, 1 - t), scale(b[i], t)));

/** Frames of one synthetic signing of a word. seed varies speed, noise, body size and position. */
export function signWord(word: WordTemplate, seed = 1, opts: { noise?: number } = {}): SignFrame[] {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const bodyPts = syntheticBody([rnd() * 0.6 - 0.3, rnd() * 0.4 - 0.2, 0], 0.85 + rnd() * 0.3);
  const body = bodyFrom(bodyPts)!;
  const keys = wordKeyframes(word, body);
  const handSize = 0.9 + rnd() * 0.2;
  const frames: SignFrame[] = [];
  const noise = opts.noise ?? 0.02;
  let prev: Keyframe | null = null;
  for (const k of keys) {
    const steps = prev ? 3 + Math.floor(rnd() * 6) : 4 + Math.floor(rnd() * 4); // uneven speed; hold the start a little
    const fromDom = prev ? placeHand(prev, "dom", body, handSize) : null;
    const toDom = placeHand(k, "dom", body, handSize)!;
    const fromOther = prev ? placeHand(prev, "other", body, handSize) : null;
    const toOther = placeHand(k, "other", body, handSize);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const n = frames.length + seed * 1000;
      const dom = fromDom ? lerp(fromDom, toDom, t) : toDom;
      const other = toOther ? (fromOther ? lerp(fromOther, toOther, t) : toOther) : null;
      frames.push({
        dominant: noisy(dom, noise * body.width, n),
        other: other ? noisy(other, noise * body.width, n + 7) : null,
        body,
        bodyPoints: bodyPts,
      });
    }
    prev = k;
  }
  // Signers hold the end of a sign for a moment before dropping their hands.
  const last = frames[frames.length - 1];
  const hold = 6 + Math.floor(rnd() * 5);
  for (let i = 0; i < hold && last; i++) {
    const n = frames.length + seed * 1000;
    frames.push({
      dominant: last.dominant ? noisy(last.dominant, noise * body.width * 0.5, n) : null,
      other: last.other ? noisy(last.other, noise * body.width * 0.5, n + 7) : null,
      body,
      bodyPoints: bodyPts,
    });
  }
  return frames;
}

export { bodyFrom, syntheticBody };
