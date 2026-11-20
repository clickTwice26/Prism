// Run with: npm test  (Node's built-in test runner; no browser or camera needed)
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  BASE_SHAPES,
  dirVector,
  dot,
  featureVector,
  fingerDirection,
  palmDirection,
  rankShapes,
  shapeFeatures,
  toSignerFrame,
} from "./hand.ts";
import { LetterStabilizer, scoreLetters, weakestPart, type LetterScore, type LetterTemplate } from "./letters.ts";
import { isLetterModel, predict, type LetterModel } from "./model.ts";
import { makeHand, makeLetter, noisy } from "./synthetic.ts";

test("camera points become the signer's frame", () => {
  // Un-mirrored front camera: a point on the image's left is on the signer's right.
  const [p] = toSignerFrame([{ x: 0.2, y: 0.3, z: -0.1 }], 16 / 9);
  assert.ok(p.every(Number.isFinite));
  const [left, right] = toSignerFrame([{ x: 0.2, y: 0.5, z: 0 }, { x: 0.8, y: 0.5, z: 0 }], 1);
  assert.ok(left[0] > right[0], "image-left point is further to the signer's right");
  const [up, down] = toSignerFrame([{ x: 0.5, y: 0.1, z: 0 }, { x: 0.5, y: 0.9, z: 0 }], 1);
  assert.ok(up[1] > down[1], "image-top point is higher");
  const [near] = toSignerFrame([{ x: 0.5, y: 0.5, z: -0.2 }], 1);
  assert.ok(near[2] > 0, "closer to the camera is 'out', away from the body");
});

test("finger and palm directions come back as written", () => {
  const cases: [string, string, "right" | "left"][] = [
    ["u", "o", "right"],
    ["o", "d", "right"],
    ["l", "d", "right"],
    ["u", "r", "left"],
    ["o", "u", "left"],
  ];
  for (const [ext, palm, side] of cases) {
    const h = makeHand({ shape: "flathand", ext, palm }, side);
    assert.ok(dot(fingerDirection(h), dirVector(ext)!) > 0.9, `fingers ${ext} (${side})`);
    assert.ok(dot(palmDirection(h, side), dirVector(palm)!) > 0.9, `palm ${palm} (${side})`);
  }
});

test("each base handshape is recognised from its own pose", () => {
  const confusions: string[] = [];
  for (const shape of BASE_SHAPES) {
    for (const [ext, palm] of [["u", "o"], ["o", "d"], ["l", "u"]]) {
      const ranked = rankShapes(shapeFeatures(noisy(makeHand({ shape, ext, palm }), 0.02, shape.length)));
      if (ranked[0].shape !== shape) confusions.push(`${shape} (${ext}/${palm}) → ${ranked[0].shape}`);
      assert.ok(ranked.slice(0, 3).some((r) => r.shape === shape), `${shape} should be in the top 3`);
    }
  }
  // Allow a few look-alikes (e.g. a C shape and a pinch), but not many.
  assert.ok(confusions.length <= 4, `too many confusions:\n${confusions.join("\n")}`);
});

test("the feature vector has a fixed length, with or without the other hand", () => {
  const h = makeHand({ shape: "fist", ext: "u", palm: "o" });
  assert.equal(featureVector(h, h).length, 151);
  assert.equal(featureVector(h, null).length, 151);
  assert.equal(featureVector(null, null).length, 151);
  assert.ok(featureVector(h, h).every(Number.isFinite));
});

// The 37 letter templates come from the IsharaKotha corpus in data/ (not committed).
const TEMPLATES = new URL("../../../../data/isharakotha/templates.json", import.meta.url);

test("letters are recognised from synthetic two-hand poses", { skip: !existsSync(TEMPLATES) && "no data/isharakotha/templates.json" }, () => {
  const all = JSON.parse(readFileSync(TEMPLATES, "utf8")) as (LetterTemplate & { section: string })[];
  const letters = all.filter((t) => t.section === "Letters");
  assert.equal(letters.length, 37);
  let top1 = 0;
  let top3 = 0;
  const misses: string[] = [];
  for (const [i, t] of letters.entries()) {
    const pose = makeLetter(t);
    const ranked = scoreLetters({ dominant: noisy(pose.dominant, 0.02, i + 1), other: noisy(pose.other, 0.02, i + 99) }, letters);
    if (ranked[0].letter === t.bn) top1++;
    else misses.push(`${t.bn} → ${ranked[0].letter} (${ranked[0].score.toFixed(2)} vs ${ranked.find((r) => r.letter === t.bn)?.score.toFixed(2)})`);
    if (ranked.slice(0, 3).some((r) => r.letter === t.bn)) top3++;
  }
  console.log(`letters: top-1 ${top1}/37, top-3 ${top3}/37${misses.length ? `\n  ${misses.join("\n  ")}` : ""}`);
  // Some letters are written identically in the corpus (e.g. ও and ঔ differ only in a thumb bend),
  // so perfect top-1 is impossible from the templates alone.
  assert.ok(top1 >= 30, `top-1 ${top1}/37`);
  assert.ok(top3 >= 35, `top-3 ${top3}/37`);
});

test("a wrong contact point is reported as the part to fix", { skip: !existsSync(TEMPLATES) && "no templates" }, () => {
  const all = JSON.parse(readFileSync(TEMPLATES, "utf8")) as (LetterTemplate & { section: string })[];
  const ka = all.find((t) => t.section === "Letters" && t.bn === "ক")!;
  const pose = makeLetter(ka);
  const apart = { dominant: pose.dominant.map(([x, y, z]) => [x + 1.5, y, z] as [number, number, number]), other: pose.other };
  const score = scoreLetters(apart, [ka])[0];
  assert.equal(weakestPart(score), "contact");
});

test("the stabiliser types a letter once it is steady, and again only after a change", () => {
  const s = new LetterStabilizer(6, 4, 0.5);
  const guess = (letter: string, score = 0.9): LetterScore => ({ letter, score, parts: {} as LetterScore["parts"] });
  const typed: string[] = [];
  const feed = (g: LetterScore | null, n: number) => {
    for (let i = 0; i < n; i++) {
      const out = s.push(g);
      if (out) typed.push(out);
    }
  };
  feed(guess("ক"), 3);
  assert.deepEqual(typed, []);
  feed(guess("ক"), 5);
  assert.deepEqual(typed, ["ক"]);
  feed(guess("খ", 0.3), 6); // not confident: nothing typed
  feed(guess("খ"), 6);
  feed(null, 6); // hands down
  feed(guess("খ"), 6);
  assert.deepEqual(typed, ["ক", "খ", "খ"]);
});

test("a learned model gives probabilities that sum to 1", () => {
  const m: LetterModel = {
    kind: "logistic",
    feature_version: 1,
    classes: ["ক", "খ"],
    mean: [0, 0],
    scale: [1, 1],
    coef: [
      [2, 0],
      [-2, 0],
    ],
    intercept: [0, 0],
  };
  assert.ok(isLetterModel(m));
  assert.ok(!isLetterModel({ kind: "logistic", classes: ["a"], coef: [], mean: [], scale: [] }));
  const p = predict(m, [1, 5]);
  assert.ok(Math.abs(p.get("ক")! + p.get("খ")! - 1) < 1e-9);
  assert.ok(p.get("ক")! > 0.95);
});
