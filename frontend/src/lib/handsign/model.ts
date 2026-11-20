// A small learned letter model, trained in Python (ml/) from recorded samples
// and exported as JSON: standardise the feature vector, then multinomial
// logistic regression. The template matcher works without it; once enough
// samples exist, its probabilities are blended in.

export interface LetterModel {
  kind: "logistic";
  feature_version: number;
  classes: string[];
  mean: number[];
  scale: number[];
  coef: number[][]; // classes × features
  intercept: number[];
  trained_on?: { samples: number; signers: number; accuracy?: number };
}

export function isLetterModel(x: unknown): x is LetterModel {
  const m = x as LetterModel;
  return (
    !!m &&
    m.kind === "logistic" &&
    Array.isArray(m.classes) &&
    Array.isArray(m.coef) &&
    m.coef.length === m.classes.length &&
    m.mean?.length === m.scale?.length &&
    m.coef.every((row) => row.length === m.mean.length)
  );
}

/** Class probabilities for one feature vector. */
export function predict(m: LetterModel, features: number[]): Map<string, number> {
  const z = m.coef.map((row, k) => {
    let s = m.intercept[k];
    for (let i = 0; i < row.length; i++) s += row[i] * (((features[i] ?? 0) - m.mean[i]) / (m.scale[i] || 1));
    return s;
  });
  const top = Math.max(...z);
  const e = z.map((v) => Math.exp(v - top));
  const sum = e.reduce((a, b) => a + b, 0);
  return new Map(m.classes.map((c, k) => [c, e[k] / sum]));
}
