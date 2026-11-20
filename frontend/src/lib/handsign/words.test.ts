// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { bodyFrom, mirrorBody, POSE, sitePosition, syntheticBody } from "./body.ts";
import { wordKeyframes, type WordTemplate } from "./motion.ts";
import { signWord } from "./syntheticSigning.ts";
import { DEMO_WORDS, SignSegmenter, resultMeans, scoreWords, weakestWordPart, wordFeatureVector, type SignFrame } from "./words.ts";

const body = bodyFrom(syntheticBody())!;

test("body sites run from the head down to the stomach", () => {
  const order = ["headtop", "forehead", "eyes", "nose", "lips", "chin", "neck", "shoulders", "chest", "stomach", "belowstomach"];
  const ys = order.map((s) => sitePosition(body, s)[1]);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] < ys[i - 1], `${order[i]} should be below ${order[i - 1]}`);
  assert.ok(sitePosition(body, "chest", "at")[0] > sitePosition(body, "chest")[0], "'at' moves toward the signing side");
  assert.ok(sitePosition(body, "ear")[0] > 0, "the ear is on the signing (right) side");
});

test("mirroring a body swaps its sides", () => {
  const m = mirrorBody(syntheticBody());
  assert.ok(m[POSE.rightShoulder][0] > 0 && m[POSE.leftShoulder][0] < 0);
  assert.equal(m[POSE.nose][0], -0);
});

test("keyframes follow the description", () => {
  // Static, one-handed, at the forehead.
  const fever: WordTemplate = {
    id: "t/fever",
    bn: "জ্বর",
    signs: [{ hands: "one", dominant: { shape: "flathand", ext: "l", palm: "l" }, location: { site: "forehead" }, actions: [] }],
  };
  const k = wordKeyframes(fever, body);
  assert.equal(k.length, 1);
  assert.ok(Math.abs(k[0].dom[1] - sitePosition(body, "forehead")[1]) < 1e-9);
  // A downward move adds a lower keyframe; a mirrored two-hand sign moves the other hand the other way.
  const sign: WordTemplate = {
    id: "t/x",
    bn: "x",
    signs: [{
      hands: "two_mirror",
      dominant: { shape: "flathand" },
      nondominant: { shape: "flathand" },
      location: { site: "chest", side: "at" },
      actions: [{ kind: "move", dir: "r" }, { kind: "move", dir: "d", size: "large" }],
    }],
  };
  const m = wordKeyframes(sign, body);
  assert.equal(m.length, 3);
  assert.ok(m[1].dom[0] > m[0].dom[0] && m[1].other![0] < m[0].other![0], "mirror: hands move apart");
  assert.ok(m[2].dom[1] < m[1].dom[1] - 0.5, "large move down");
});

test("the segmenter cuts out a raised-hand signing", () => {
  const word: WordTemplate = {
    id: "t/bad",
    bn: "খারাপ",
    signs: [{ hands: "one", dominant: { shape: "flathand", ext: "u", palm: "l" }, location: { site: "neck" }, actions: [{ kind: "move", dir: "d" }] }],
  };
  const signing = signWord(word, 3);
  const rest: SignFrame = { dominant: null, other: null, body };
  const seg = new SignSegmenter();
  const out: SignFrame[][] = [];
  for (const f of [...Array(10).fill(rest), ...signing, ...Array(12).fill(rest)]) {
    const s = seg.push(f);
    if (s) out.push(s);
  }
  assert.equal(out.length, 1);
  assert.ok(Math.abs(out[0].length - signing.length) <= 3, `segment ${out[0].length} vs signing ${signing.length}`);
});

test("the word feature vector has a fixed length", () => {
  const word: WordTemplate = { id: "t", bn: "t", signs: [{ hands: "one", dominant: { shape: "fist" }, location: { site: "chest" }, actions: [] }] };
  const [f] = signWord(word, 1);
  assert.equal(wordFeatureVector(f).length, 157);
  assert.equal(wordFeatureVector({ dominant: null, other: null, body: null }).length, 157);
});

const TEMPLATES = new URL("../../../../data/isharakotha/templates.json", import.meta.url);

test("demo words are recognised from synthetic signers", { skip: !existsSync(TEMPLATES) && "no data/isharakotha/templates.json" }, () => {
  const all = JSON.parse(readFileSync(TEMPLATES, "utf8")) as WordTemplate[];
  const wanted = new Set(DEMO_WORDS.map((w) => w.bn));
  const vocab = all.filter((t) => wanted.has(t.bn));
  assert.equal(new Set(vocab.map((t) => t.bn)).size, DEMO_WORDS.length, "every demo word is in the corpus");
  let top1 = 0;
  let top3 = 0;
  let n = 0;
  const misses: string[] = [];
  for (const [i, w] of DEMO_WORDS.entries()) {
    // Sign each variant of the word, as a different signer might.
    for (const [j, t] of vocab.filter((v) => v.bn === w.bn).entries()) {
      const ranked = scoreWords(signWord(t, i * 10 + j + 1), vocab);
      n++;
      const rank = ranked.findIndex((r) => resultMeans(r, w.bn));
      if (rank === 0) top1++;
      else misses.push(`${w.bn} (${w.en}) → ${ranked[0].word} [${rank + 1}]`);
      if (rank >= 0 && rank < 3) top3++;
    }
  }
  console.log(`words: top-1 ${top1}/${n}, top-3 ${top3}/${n}${misses.length ? `\n  ${misses.join("\n  ")}` : ""}`);
  assert.ok(top1 / n >= 0.75, `top-1 ${top1}/${n}`);
  assert.ok(top3 / n >= 0.9, `top-3 ${top3}/${n}`);
});

test("the weakest part names what to fix", { skip: !existsSync(TEMPLATES) && "no templates" }, () => {
  const all = JSON.parse(readFileSync(TEMPLATES, "utf8")) as WordTemplate[];
  const fever = all.find((t) => t.bn === "জ্বর")!;
  // Signed at the stomach instead of the forehead.
  const moved = signWord(fever, 5).map((f) => ({ ...f, dominant: f.dominant!.map(([x, y, z]) => [x, y - 1.1 * f.body!.width, z] as [number, number, number]) }));
  const s = scoreWords(moved, [fever])[0];
  assert.ok(["location", "movement"].includes(weakestWordPart(s)), `got ${weakestWordPart(s)}`);
});

test("a learned word model prefers the word whose prototype is nearest", async () => {
  const { dtw, isWordModel, wordModelScores } = await import("./wordModel.ts");
  const row = (v: number) => [1, v, v];
  const proto = (v: number) => Array.from({ length: 8 }, () => [0, v, v]); // standardised (presence column centred)
  const m = { kind: "dtw-prototypes", feature_version: 1, steps: 8, mean: [1, 0, 0], scale: [1, 1, 1], temperature: 0.2, words: { a: [proto(0)], b: [proto(3)] } };
  assert.ok(isWordModel(m));
  assert.ok(dtw(proto(0), proto(0)) === 0);
  const p = wordModelScores(m as never, Array.from({ length: 20 }, () => row(0.2)));
  assert.ok(p.get("a")! > 0.9, `a: ${p.get("a")}`);
  assert.ok(Math.abs([...p.values()].reduce((x, y) => x + y, 0) - 1) < 1e-9);
});

test("a held static sign is long enough to be segmented", () => {
  const still: WordTemplate = { id: "t/s", bn: "s", signs: [{ hands: "one", dominant: { shape: "flathand" }, location: { site: "forehead" }, actions: [] }] };
  const signing = signWord(still, 2);
  const rest: SignFrame = { dominant: null, other: null, body };
  const seg = new SignSegmenter();
  let got: SignFrame[] | null = null;
  for (const f of [...Array(5).fill(rest), ...signing, ...Array(10).fill(rest)]) got = seg.push(f) ?? got;
  assert.ok(got && got.length >= 10, `static sign segmented: ${got?.length}`);
});

test("words written with the same sign are reported together", () => {
  const sign = { hands: "one", dominant: { shape: "fist", ext: "u", palm: "d" }, location: { site: "chest" }, actions: [{ kind: "move", dir: "d" }] };
  const vocab: WordTemplate[] = [
    { id: "a", bn: "স্কুল", signs: [sign] },
    { id: "b", bn: "বিদ্যালয়", signs: [sign] },
    { id: "c", bn: "x", signs: [{ ...sign, location: { site: "forehead" } }] },
  ];
  const ranked = scoreWords(signWord(vocab[0], 4), vocab);
  assert.equal(ranked[0].word, "স্কুল");
  assert.deepEqual(ranked[0].alsoMeans, ["বিদ্যালয়"]);
  assert.equal(ranked.length, 2, "one entry per distinct sign");
});
