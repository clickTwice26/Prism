// Recognises single signed words by aligning a recorded signing against each
// word's expected path (motion.ts) with dynamic time warping, so fast and slow
// signers both fit. Each part (handshape, starting place, movement, direction,
// other hand) is scored separately, so the result can be explained and a
// learner told what to fix. See docs/sign-recognition-plan.md.

import {
  contactPoint,
  dirVector,
  dot,
  featureVector,
  fingerDirection,
  mean,
  palmDirection,
  palmVector,
  shapeFeatures,
  shapeScore,
  type HandPoints,
  type ShapeFeatures,
  type Vec,
} from "./hand.ts";
import { toBody, type Body, type Vec2 } from "./body.ts";
import { wordKeyframes, type Keyframe, type PoseT, type WordTemplate } from "./motion.ts";

/** The demo vocabulary: everyday, school and health words present in the corpus (Bangla in Unicode NFC). */
export const DEMO_WORDS: { bn: string; en: string; group: string }[] = ([
  ...[["জ্বর", "fever"], ["ডাক্তার", "doctor"], ["ঔষধ", "medicine"], ["ব্যথা", "pain"], ["হাসপাতাল", "hospital"],
    ["কাশি", "cough"], ["মাথা ব্যাথা", "headache"], ["অসুস্থ", "sick"], ["রক্ত", "blood"], ["ইনজেকশন", "injection"]]
    .map(([bn, en]) => ({ bn, en, group: "Health" })),
  ...[["বই", "book"], ["শিক্ষক", "teacher"], ["স্কুল", "school"], ["পড়া", "read"], ["লেখা", "write"], ["কলম", "pen"],
    ["শ্রেণি", "class"], ["কাগজ", "paper"], ["প্রশ্ন", "question"], ["উত্তর", "answer"], ["জানা", "know"], ["বুঝতেপারা", "understand"]]
    .map(([bn, en]) => ({ bn, en, group: "School" })),
  ...[["পানি", "water"], ["খাওয়া", "eat"], ["খাবার", "food"], ["ভাত", "rice"], ["ঘুম", "sleep"], ["সাহায্যকরা", "help"],
    ["ভাল", "good"], ["খারাপ", "bad"], ["আসো", "come"], ["ঘর", "house"]]
    .map(([bn, en]) => ({ bn, en, group: "Daily life" })),
  ...[["বাবা", "father"], ["নানা", "grandfather"], ["বন্ধু", "friend"], ["শিশু", "child"], ["ভালোবাসা", "love"],
    ["ধন্যবাদ", "thank you"], ["দুঃখিত", "sorry"], ["অনুগ্রহকরা", "please"]]
    .map(([bn, en]) => ({ bn, en, group: "People and feelings" })),
  ...[["কী", "what"], ["কোথায়", "where"], ["কখন", "when"]].map(([bn, en]) => ({ bn, en, group: "Questions" })),
] as { bn: string; en: string; group: string }[]).map((w) => ({ ...w, bn: w.bn.normalize("NFC") }));

/** One video frame: both hands and the body, in the signer's frame (left-handed signers mirrored). */
export interface SignFrame {
  dominant: HandPoints | null;
  other: HandPoints | null;
  body: Body | null;
  /** The 33 pose points the body came from, when known (recordings, synthetic signers). */
  bodyPoints?: Vec[];
}

export type WordPart = "handshape" | "location" | "movement" | "direction" | "otherHand";
export const WORD_PART_LABELS: Record<WordPart, string> = {
  handshape: "Handshape",
  location: "Where it starts",
  movement: "Movement",
  direction: "Hand direction",
  otherHand: "Other hand",
};
const WEIGHTS = { pos: 0.4, shape: 0.25, dir: 0.15, other: 0.2 };

export interface WordScore {
  word: string; // Bangla
  id: string; // template id (a word can have several variants)
  score: number; // 0 to 1
  parts: Record<WordPart, number>;
  /** Other words written with exactly the same sign: form alone cannot tell them apart. */
  alsoMeans: string[];
}

/** Whether a result names a word, directly or as a word with the same sign. */
export const resultMeans = (s: WordScore, word: string) => s.word === word || s.alsoMeans.includes(word);

// ---- per-frame measurements, computed once per frame ----

interface Measured {
  dom: HandPoints;
  domShape: ShapeFeatures;
  domExt: Vec;
  domPalm: Vec;
  other: HandPoints | null;
  otherShape: ShapeFeatures | null;
  body: Body;
}

const palmCentre = (h: HandPoints) => mean([0, 5, 9, 13, 17].map((i) => h[i]));

function measure(f: SignFrame): Measured | null {
  if (!f.dominant || !f.body) return null;
  return {
    dom: f.dominant,
    domShape: shapeFeatures(f.dominant),
    domExt: fingerDirection(f.dominant),
    domPalm: palmDirection(f.dominant, "right"),
    other: f.other,
    otherShape: f.other ? shapeFeatures(f.other) : null,
    body: f.body,
  };
}

const near2 = (a: Vec2, b: Vec2, tol: number) => Math.exp(-((Math.hypot(a[0] - b[0], a[1] - b[1]) / tol) ** 2));

function dirScore(observed: Vec, want: Vec | null): number {
  if (!want) return 0.6;
  return Math.max(0, dot(observed, want)) ** 2;
}

interface Cost {
  total: number;
  pos: number;
  shape: number;
  dir: number;
  other: number;
}

function frameCost(m: Measured, k: Keyframe): Cost {
  const ref = (k.point.length ? contactPoint(m.dom, k.point) : null) ?? palmCentre(m.dom);
  const pos = near2(toBody(m.body, ref), k.dom, 0.4);
  const shape = shapeScore(m.domShape, k.pose.shape ?? "", k.pose.thumb, k.pose.bend);
  const dir = Math.sqrt(dirScore(m.domExt, k.pose.ext ? dirVector(k.pose.ext) : null) * dirScore(m.domPalm, palmVector(k.pose.ext, k.pose.palm)));
  let other = 0.8; // one-handed sign: the other hand is not judged
  if (k.other && k.otherPose) {
    if (!m.other || !m.otherShape) other = 0.15;
    else other = Math.sqrt(near2(toBody(m.body, palmCentre(m.other)), k.other, 0.5) * shapeScore(m.otherShape, k.otherPose.shape ?? "", k.otherPose.thumb, k.otherPose.bend));
  }
  const L = (x: number) => -Math.log(Math.max(x, 1e-3));
  return { total: WEIGHTS.pos * L(pos) + WEIGHTS.shape * L(shape) + WEIGHTS.dir * L(dir) + WEIGHTS.other * L(other), pos, shape, dir, other };
}

/**
 * Averages each hand's points with its neighbours in time (radius frames on
 * each side, only across frames where that hand is seen), to take out camera
 * jitter before handshapes are judged.
 */
export function smoothFrames(frames: SignFrame[], radius = 2): SignFrame[] {
  const avgHand = (i: number, key: "dominant" | "other"): HandPoints | null => {
    const h = frames[i][key];
    if (!h) return null;
    const near: HandPoints[] = [];
    for (let j = Math.max(0, i - radius); j <= Math.min(frames.length - 1, i + radius); j++) {
      const x = frames[j][key];
      if (x) near.push(x);
    }
    return h.map((_, k) => mean(near.map((x) => x[k])));
  };
  return frames.map((f, i) => ({ ...f, dominant: avgHand(i, "dominant"), other: avgHand(i, "other") }));
}

/** Evenly picks at most n items. */
function resample<T>(xs: T[], n: number): T[] {
  if (xs.length <= n) return xs;
  return Array.from({ length: n }, (_, i) => xs[Math.round((i * (xs.length - 1)) / (n - 1))]);
}

/** Aligns frames to keyframes (each keyframe gets at least one frame, in order) and scores the result. */
function align(ms: Measured[], keys: Keyframe[]): Omit<WordScore, "word" | "id" | "alsoMeans"> {
  const N = ms.length;
  const K = keys.length;
  const costs = ms.map((m) => keys.map((k) => frameCost(m, k)));
  const D = Array.from({ length: N }, () => new Array<number>(K).fill(Infinity));
  const back = Array.from({ length: N }, () => new Array<number>(K).fill(0));
  D[0][0] = costs[0][0].total;
  for (let i = 1; i < N; i++) {
    for (let k = 0; k < Math.min(K, i + 1); k++) {
      const stay = D[i - 1][k];
      const next = k > 0 ? D[i - 1][k - 1] : Infinity;
      D[i][k] = costs[i][k].total + Math.min(stay, next);
      back[i][k] = next < stay ? k - 1 : k;
    }
  }
  // Walk back along the best path, collecting per-part scores.
  const path: [number, number][] = [];
  for (let i = N - 1, k = K - 1; i >= 0; i--) {
    path.push([i, k]);
    k = back[i][k];
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 1);
  const at = (pick: (c: Cost) => number, filter: (k: number) => boolean) => avg(path.filter(([, k]) => filter(k)).map(([i, k]) => pick(costs[i][k])));
  const moves = keys.some((k) => k.kind !== "start");
  return {
    score: Math.exp(-D[N - 1][K - 1] / N),
    parts: {
      handshape: at((c) => c.shape, () => true),
      location: at((c) => c.pos, (k) => keys[k].kind === "start"),
      movement: moves ? at((c) => c.pos, (k) => keys[k].kind !== "start") : at((c) => c.pos, () => true),
      direction: at((c) => c.dir, () => true),
      otherHand: at((c) => c.other, () => true),
    },
  };
}

// ---- vocabularies: words that share a sign are scored once ----

interface SignGroup {
  rep: WordTemplate;
  words: string[]; // every word written with this sign, in vocabulary order
}

const signKey = (w: WordTemplate) =>
  JSON.stringify(w.signs.map((s) => ({ ...s, gaps: undefined })));

const groupCache = new WeakMap<WordTemplate[], SignGroup[]>();

/** Groups a vocabulary by identical sign description. Cached per vocabulary array. */
function groupsOf(words: WordTemplate[]): SignGroup[] {
  const hit = groupCache.get(words);
  if (hit) return hit;
  const byKey = new Map<string, SignGroup>();
  for (const w of words) {
    const k = signKey(w);
    const g = byKey.get(k);
    if (!g) byKey.set(k, { rep: w, words: [w.bn] });
    else if (!g.words.includes(w.bn)) g.words.push(w.bn);
  }
  const out = [...byKey.values()];
  groupCache.set(words, out);
  return out;
}

/** Cheap first pass: how well the start and end of the signing fit a sign's first and last keyframes. Lower is better. */
function quickCost(ms: Measured[], keys: Keyframe[]): number {
  const third = Math.max(1, Math.floor(ms.length / 3));
  const head = ms.slice(0, third);
  const tail = ms.slice(-third);
  const avgCost = (xs: Measured[], k: Keyframe) => xs.reduce((a, m) => a + frameCost(m, k).total, 0) / xs.length;
  return avgCost(head, keys[0]) + avgCost(tail, keys[keys.length - 1]);
}

/**
 * Scores the signs of a vocabulary for a recorded signing, best first. Words
 * written with an identical sign are scored once and reported together
 * (alsoMeans); a word with several variants keeps its best one. Large
 * vocabularies are first narrowed with a cheap start-and-end check, then the
 * best `shortlist` signs are aligned in full. Frames without the signing hand
 * or the body are skipped.
 */
export function scoreWords(frames: SignFrame[], words: WordTemplate[], opts: { maxFrames?: number; shortlist?: number } = {}): WordScore[] {
  const ms = resample(smoothFrames(frames).map(measure).filter((m): m is Measured => m !== null), opts.maxFrames ?? 40);
  if (ms.length < 3) return [];
  const body = ms[Math.floor(ms.length / 2)].body;
  let candidates = groupsOf(words)
    .map((g) => ({ g, keys: wordKeyframes(g.rep, body) }))
    .filter((c) => c.keys.length > 0);
  const shortlist = opts.shortlist ?? 120;
  if (candidates.length > shortlist) {
    candidates = candidates
      .map((c) => ({ ...c, quick: quickCost(ms, c.keys) }))
      .sort((a, b) => a.quick - b.quick)
      .slice(0, shortlist);
  }
  const scored = candidates.map(({ g, keys }) => {
    // More keyframes than frames: thin the keyframes so every one can be matched.
    const k = keys.length > ms.length ? resample(keys, ms.length) : keys;
    return { g, ...align(ms, k) };
  });
  scored.sort((a, b) => b.score - a.score);
  // One entry per sign; a word already named by a better sign is not repeated.
  const named = new Set<string>();
  const out: WordScore[] = [];
  for (const s of scored) {
    const fresh = s.g.words.filter((w) => !named.has(w));
    if (fresh.length === 0) continue;
    for (const w of fresh) named.add(w);
    out.push({ word: fresh[0], id: s.g.rep.id, score: s.score, parts: s.parts, alsoMeans: fresh.slice(1) });
  }
  return out;
}

export function weakestWordPart(s: WordScore): WordPart {
  return (Object.keys(s.parts) as WordPart[]).reduce((w, k) => (s.parts[k] < s.parts[w] ? k : w), "movement" as WordPart);
}

// ---- finding where a sign starts and ends ----

/**
 * Cuts a stream of frames into signs: a sign starts when the signing hand is
 * raised above the waist and ends when it drops or disappears for a moment.
 */
export class SignSegmenter {
  private active = false;
  private frames: SignFrame[] = [];
  private quiet = 0;
  private pending: SignFrame[] = []; // raised frames before the sign is confirmed
  private readonly maxFrames: number;

  constructor(maxFrames = 150) {
    this.maxFrames = maxFrames;
  }

  static raised(f: SignFrame): boolean {
    if (!f.dominant || !f.body) return false;
    return toBody(f.body, palmCentre(f.dominant))[1] > -1.1;
  }

  /** Feed a frame. Returns the frames of a finished sign, or null. */
  push(f: SignFrame): SignFrame[] | null {
    const up = SignSegmenter.raised(f);
    if (!this.active) {
      this.pending = up ? [...this.pending, f] : [];
      if (this.pending.length < 3) return null;
      // Three raised frames in a row: a sign has started, including those frames.
      this.active = true;
      this.frames = this.pending;
      this.pending = [];
      this.quiet = 0;
      return null;
    }
    this.frames.push(f);
    this.quiet = up ? 0 : this.quiet + 1;
    if (this.quiet >= 8 || this.frames.length >= this.maxFrames) {
      const sign = this.frames.slice(0, this.frames.length - this.quiet);
      this.reset();
      return sign.length >= 10 ? sign : null;
    }
    return null;
  }

  get recording() {
    return this.active;
  }

  reset() {
    this.active = false;
    this.frames = [];
    this.quiet = 0;
    this.pending = [];
  }
}

// ---- feature vector for learned word models (Python, ml/) ----

export const WORD_FEATURE_VERSION = 1;

/** featureVector (151) plus the signing hand's palm and index tip and the other hand's palm, in body coordinates: 157 numbers. */
export function wordFeatureVector(f: SignFrame): number[] {
  const base = featureVector(f.dominant, f.other);
  const pos = (h: HandPoints | null, p: (h: HandPoints) => Vec): number[] => (h && f.body ? toBody(f.body, p(h)) : [0, 0]);
  return [...base, ...pos(f.dominant, palmCentre), ...pos(f.dominant, (h) => h[8]), ...pos(f.other, palmCentre)];
}

export type { PoseT, WordTemplate };
