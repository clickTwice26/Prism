// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dot, palmVector } from "./hand.ts";
import { deriveTemplate, nearestDir, relativePalmCode, simplifyPath } from "./derive.ts";
import type { WordTemplate } from "./motion.ts";
import { signWord } from "./syntheticSigning.ts";
import { DEMO_WORDS, resultMeans, scoreWords } from "./words.ts";

test("direction codes are written the HamNoSys way", () => {
  assert.equal(nearestDir([0, 1, 0]), "u");
  assert.equal(nearestDir([-0.7, 0.7, 0]), "ul");
  assert.equal(nearestDir([-0.7, 0, 0.7]), "ol");
  assert.equal(nearestDir([0.1, 0.05, 0.99], false), "");
});

test("a relative palm code round-trips through palmVector", () => {
  for (const ext of ["u", "o", "l", "ul", "ol", "d"]) {
    for (const code of ["u", "d", "l", "r"]) {
      const v = palmVector(ext, code)!;
      const back = relativePalmCode(ext, v);
      assert.ok(dot(palmVector(ext, back)!, v) > 0.99, `${ext}/${code} → ${back}`);
    }
  }
});

test("path simplification keeps the corners", () => {
  const pts: [number, number][] = [[0, 0], [0, -0.2], [0, -0.4], [0.2, -0.4], [0.4, -0.4]];
  assert.deepEqual(simplifyPath(pts, 0.05), [[0, 0], [0, -0.4], [0.4, -0.4]]);
});

test("a static sign at the forehead is written down as such", () => {
  const fever: WordTemplate = {
    id: "t/fever",
    bn: "জ্বর",
    signs: [{ hands: "one", dominant: { shape: "flathand", ext: "l", palm: "l" }, location: { site: "forehead" }, actions: [] }],
  };
  const d = deriveTemplate(signWord(fever, 3), { id: "derived/1", bn: "জ্বর" })!;
  const s = d.signs[0];
  assert.equal(s.hands, "one");
  assert.equal(s.location.site, "forehead");
  assert.equal(s.dominant.shape, "flathand");
  assert.equal(s.dominant.ext, "l");
  assert.equal(s.dominant.palm, "l");
  assert.equal(s.actions.length, 0, `no movement, got ${JSON.stringify(s.actions)}`);
});

const TEMPLATES = new URL("../../../../data/isharakotha/templates.json", import.meta.url);

test("a sign learned from one signing recognises another signer", { skip: !existsSync(TEMPLATES) && "no templates" }, () => {
  const all = JSON.parse(readFileSync(TEMPLATES, "utf8")) as WordTemplate[];
  const wanted = new Set(DEMO_WORDS.map((w) => w.bn));
  const vocab = all.filter((t) => wanted.has(t.bn));
  let top1 = 0;
  let top3 = 0;
  let n = 0;
  const misses: string[] = [];
  for (const [i, t] of vocab.entries()) {
    const learned = deriveTemplate(signWord(t, 7000 + i), { id: `derived/${i}`, bn: t.bn });
    if (!learned) continue;
    // The vocabulary as Prism would have it if this sign came from the community.
    const withLearned = [...vocab.filter((v) => v !== t), learned];
    const ranked = scoreWords(signWord(t, 9000 + i), withLearned);
    n++;
    const rank = ranked.findIndex((r) => resultMeans(r, t.bn));
    if (rank === 0) top1++;
    else misses.push(`${t.bn} → ${ranked[0]?.word} [${rank + 1}]`);
    if (rank >= 0 && rank < 3) top3++;
  }
  console.log(`learned signs: top-1 ${top1}/${n}, top-3 ${top3}/${n}${misses.length ? `\n  ${misses.slice(0, 10).join("\n  ")}` : ""}`);
  assert.ok(n >= 55, `derived ${n} of ${vocab.length}`);
  assert.ok(top3 / n >= 0.85, `top-3 ${top3}/${n}`);
});
