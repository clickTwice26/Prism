// Re-runs the recogniser on recorded samples and reports, per letter or word,
// how often it is right and which part fails. Use it after people record
// samples on the Fingerspell or Sign words pages.
//
//   node scripts/analyze-samples.ts --api http://localhost:8080
//   node scripts/analyze-samples.ts --file samples.json --kind word
//
// It uses the same recogniser code as the browser (src/lib/handsign).

import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { mean, rankShapes, shapeFeatures, type HandPoints, type Vec } from "../src/lib/handsign/hand.ts";
import { bodyFrom, sitePosition, toBody } from "../src/lib/handsign/body.ts";
import { scoreLetters, type LetterTemplate } from "../src/lib/handsign/letters.ts";
import type { WordTemplate } from "../src/lib/handsign/motion.ts";
import { resultMeans, scoreWords, type SignFrame, type WordScore } from "../src/lib/handsign/words.ts";

interface Sample {
  id: number;
  kind: "letter" | "word";
  label: string;
  signer: string;
  deaf?: boolean;
  frames: { t: number; hands: { side: string; points: Vec[] }[]; body?: Vec[] }[];
}

const { values } = parseArgs({
  options: {
    api: { type: "string", default: "http://localhost:8080" },
    file: { type: "string" },
    templates: { type: "string", help: "templates JSON (default: fetched from the API)" },
    kind: { type: "string", default: "both" },
    json: { type: "string" },
  },
});

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${values.api}${path}`);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return (await r.json()) as T;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (x: number) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : "–");
const palm = (h: HandPoints) => mean([0, 5, 9, 13, 17].map((i) => h[i]));
const SITES = ["forehead", "eyes", "nose", "lips", "chin", "neck", "shoulders", "chest", "stomach"];

function framesOf(s: Sample): SignFrame[] {
  return s.frames.map((f) => {
    const dominant = f.hands.find((h) => h.side === "right")?.points ?? null;
    const other = f.hands.find((h) => h.side === "left")?.points ?? null;
    return { dominant, other, body: f.body ? bodyFrom(f.body) : null, bodyPoints: f.body };
  });
}

/** What the camera saw at the start of a signing: the hand's nearest body site and its handshape. */
function seen(frames: SignFrame[]): { site: string; shape: string } {
  const first = frames.filter((f) => f.dominant).slice(0, Math.max(3, Math.floor(frames.length / 3)));
  const shapes = new Map<string, number>();
  const sites = new Map<string, number>();
  for (const f of first) {
    const top = rankShapes(shapeFeatures(f.dominant!))[0].shape;
    shapes.set(top, (shapes.get(top) ?? 0) + 1);
    if (f.body) {
      const at = toBody(f.body, palm(f.dominant!));
      const site = SITES.reduce((b, x) => {
        const p = sitePosition(f.body!, x);
        const d = Math.hypot(p[0] - at[0], p[1] - at[1]);
        return d < b.d ? { x, d } : b;
      }, { x: "", d: Infinity }).x;
      sites.set(site, (sites.get(site) ?? 0) + 1);
    }
  }
  const most = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "–";
  return { site: most(sites), shape: most(shapes) };
}

interface Row {
  label: string;
  n: number;
  correct: number;
  top3: number;
  parts: Record<string, number[]>;
  wrong: Map<string, number>;
  seen: Map<string, number>;
}

function addRow(rows: Map<string, Row>, label: string): Row {
  let r = rows.get(label);
  if (!r) rows.set(label, (r = { label, n: 0, correct: 0, top3: 0, parts: {}, wrong: new Map(), seen: new Map() }));
  return r;
}

function report(title: string, rows: Map<string, Row>) {
  const all = [...rows.values()];
  const n = all.reduce((a, r) => a + r.n, 0);
  if (!n) return console.log(`\n${title}: no samples`);
  const correct = all.reduce((a, r) => a + r.correct, 0);
  const top3 = all.reduce((a, r) => a + r.top3, 0);
  console.log(`\n${title}: ${n} samples, top-1 ${pct(correct / n)}, top-3 ${pct(top3 / n)}`);
  const partNames = Object.keys(all[0].parts);
  console.log(["label", "n", "top-1", ...partNames.map((p) => p.slice(0, 9)), "confused with", "seen at start"].join("\t"));
  for (const r of all.sort((a, b) => a.correct / a.n - b.correct / b.n)) {
    const wrong = [...r.wrong.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w, k]) => `${w}×${k}`).join(" ");
    const seenAt = [...r.seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w, k]) => `${w}×${k}`).join(" ");
    console.log([r.label, r.n, pct(r.correct / r.n), ...partNames.map((p) => pct(avg(r.parts[p]))), wrong || "–", seenAt].join("\t"));
  }
  // Which part is weakest overall: where to look first.
  const overall = partNames.map((p) => [p, avg(all.flatMap((r) => r.parts[p]))] as const).sort((a, b) => a[1] - b[1]);
  console.log(`weakest parts overall (true answer's score): ${overall.map(([p, v]) => `${p} ${pct(v)}`).join(", ")}`);
}

const samples: Sample[] = values.file
  ? (JSON.parse(readFileSync(values.file, "utf8")) as Sample[])
  : [
      ...(values.kind !== "word" ? await get<Sample[]>("/api/sign/samples?kind=letter&full=1") : []),
      ...(values.kind !== "letter" ? await get<Sample[]>("/api/sign/samples?kind=word&full=1") : []),
    ];
const letterSamples = samples.filter((s) => (s.kind ?? "letter") === "letter" && values.kind !== "word");
const wordSamples = samples.filter((s) => s.kind === "word" && values.kind !== "letter");
const fileTemplates = values.templates ? (JSON.parse(readFileSync(values.templates, "utf8")) as (WordTemplate & { section?: string })[]) : null;

const out: Record<string, unknown> = {};

if (letterSamples.length) {
  const letters = (fileTemplates?.filter((t) => t.section === "Letters") ??
    (await get<LetterTemplate[]>("/api/sign/templates?section=Letters"))) as LetterTemplate[];
  const rows = new Map<string, Row>();
  for (const s of letterSamples) {
    const frames = framesOf(s).filter((f) => f.dominant && f.other);
    const mid = frames.slice(Math.floor(frames.length * 0.2), Math.ceil(frames.length * 0.8));
    const votes = new Map<string, number>();
    const r = addRow(rows, s.label);
    for (const f of mid) {
      const ranked = scoreLetters({ dominant: f.dominant!, other: f.other! }, letters);
      votes.set(ranked[0].letter, (votes.get(ranked[0].letter) ?? 0) + 1);
      const mine = ranked.find((x) => x.letter === s.label);
      if (mine) for (const [k, v] of Object.entries(mine.parts)) (r.parts[k] ??= []).push(v);
    }
    const order = [...votes.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
    r.n++;
    if (order[0] === s.label) r.correct++;
    else if (order[0]) r.wrong.set(order[0], (r.wrong.get(order[0]) ?? 0) + 1);
    if (order.slice(0, 3).includes(s.label)) r.top3++;
    const sh = seen(frames).shape;
    r.seen.set(sh, (r.seen.get(sh) ?? 0) + 1);
  }
  report("Letters", rows);
  out.letters = [...rows.values()].map((r) => ({ ...r, wrong: Object.fromEntries(r.wrong), seen: Object.fromEntries(r.seen) }));
}

if (wordSamples.length) {
  const labels = [...new Set(wordSamples.map((s) => s.label))];
  const { DEMO_WORDS } = await import("../src/lib/handsign/words.ts");
  const vocabWords = [...new Set([...DEMO_WORDS.map((w) => w.bn), ...labels])];
  const vocab = fileTemplates
    ? fileTemplates.filter((t) => vocabWords.includes(t.bn))
    : await get<WordTemplate[]>(`/api/sign/templates?words=${encodeURIComponent(vocabWords.join(","))}`);
  const rows = new Map<string, Row>();
  for (const s of wordSamples) {
    const frames = framesOf(s);
    const ranked: WordScore[] = scoreWords(frames, vocab);
    const r = addRow(rows, s.label);
    r.n++;
    const rank = ranked.findIndex((x) => resultMeans(x, s.label));
    if (rank === 0) r.correct++;
    else if (ranked[0]) r.wrong.set(ranked[0].word, (r.wrong.get(ranked[0].word) ?? 0) + 1);
    if (rank >= 0 && rank < 3) r.top3++;
    const mine = ranked[rank];
    if (mine) for (const [k, v] of Object.entries(mine.parts)) (r.parts[k] ??= []).push(v);
    const sn = seen(frames);
    const key = `${sn.site}/${sn.shape}`;
    r.seen.set(key, (r.seen.get(key) ?? 0) + 1);
    if (!frames.some((f) => f.body)) r.seen.set("NO BODY", (r.seen.get("NO BODY") ?? 0) + 1);
  }
  report("Words", rows);
  out.words = [...rows.values()].map((r) => ({ ...r, wrong: Object.fromEntries(r.wrong), seen: Object.fromEntries(r.seen) }));
}

if (!letterSamples.length && !wordSamples.length) console.log("No samples yet. Record some on the Fingerspell or Sign words page.");
if (values.json) writeFileSync(values.json, JSON.stringify(out, null, 1));
