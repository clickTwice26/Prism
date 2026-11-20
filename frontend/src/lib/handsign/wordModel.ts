// A learned word model, trained in Python (ml/prism_ml/train_words.py) from
// recorded samples: a few prototype recordings per word, resampled to a fixed
// number of steps and standardised. A new signing is compared with each
// prototype by dynamic time warping; nearer prototypes mean likelier words.
// The template matcher (words.ts) works without it.

export interface WordModel {
  kind: "dtw-prototypes";
  feature_version: number;
  steps: number;
  mean: number[];
  scale: number[];
  temperature: number;
  words: Record<string, number[][][]>; // word → prototypes → steps × features
  trained_on?: { samples: number; signers: number; accuracy?: number | null };
}

export function isWordModel(x: unknown): x is WordModel {
  const m = x as WordModel;
  return (
    !!m &&
    m.kind === "dtw-prototypes" &&
    typeof m.steps === "number" &&
    Array.isArray(m.mean) &&
    m.mean.length === m.scale?.length &&
    !!m.words &&
    Object.values(m.words).every((ps) => ps.every((p) => p.length === m.steps && p.every((row) => row.length === m.mean.length)))
  );
}

/** Keeps frames with the signing hand, resamples to n steps, standardises. */
export function prepare(m: WordModel, seq: number[][]): number[][] | null {
  const rows = seq.filter((r) => r[0] === 1);
  if (rows.length < 3) return null;
  return Array.from({ length: m.steps }, (_, i) => {
    const r = rows[Math.round((i * (rows.length - 1)) / (m.steps - 1))];
    return r.map((v, j) => (v - m.mean[j]) / (m.scale[j] || 1));
  });
}

/** Mean per-step distance after the best alignment in time (a narrow band keeps it fast and sensible). */
export function dtw(a: number[][], b: number[][], band = 4): number {
  const n = a.length;
  const m = b.length;
  const D = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(Infinity));
  D[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(1, i - band); j <= Math.min(m, i + band); j++) {
      let d = 0;
      const x = a[i - 1];
      const y = b[j - 1];
      for (let k = 0; k < x.length; k++) d += (x[k] - y[k]) ** 2;
      D[i][j] = Math.sqrt(d / x.length) + Math.min(D[i - 1][j], D[i][j - 1], D[i - 1][j - 1]);
    }
  }
  return D[n][m] / Math.max(n, m);
}

/** Probability of each word for one signing (per-frame word feature vectors). */
export function wordModelScores(m: WordModel, seq: number[][]): Map<string, number> {
  const x = prepare(m, seq);
  const out = new Map<string, number>();
  if (!x) return out;
  const dist = Object.entries(m.words).map(([w, ps]) => [w, Math.min(...ps.map((p) => dtw(x, p)))] as const);
  const best = Math.min(...dist.map(([, d]) => d));
  const e = dist.map(([w, d]) => [w, Math.exp(-(d - best) / m.temperature)] as const);
  const sum = e.reduce((a, [, v]) => a + v, 0);
  for (const [w, v] of e) out.set(w, v / sum);
  return out;
}
