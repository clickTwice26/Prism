"""Build the learned word model from recorded word samples and export it.

    uv run python -m prism_ml.train_words --api http://localhost:8080

Each recording becomes a sequence: frames with the signing hand, resampled to
a fixed number of steps and standardised. The model keeps a few prototype
recordings per word; the browser compares a new signing with each by dynamic
time warping (frontend/src/lib/handsign/wordModel.ts, same distance as here).
Accuracy is measured on recordings left out: whole signers when there are
three or more, otherwise whole recordings.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

from .samples import FEATURE_VERSION, Sample, from_api, from_file

DEFAULT_OUT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "models" / "words.json"


def sequence(s: Sample, steps: int) -> np.ndarray | None:
    rows = s.features[s.features[:, 0] == 1]  # frames with the signing hand
    if len(rows) < 3:
        return None
    idx = np.round(np.linspace(0, len(rows) - 1, steps)).astype(int)
    return rows[idx]


def dtw(a: np.ndarray, b: np.ndarray, band: int = 4) -> float:
    """Mean per-step distance after alignment; matches wordModel.ts."""
    n, m = len(a), len(b)
    D = np.full((n + 1, m + 1), np.inf)
    D[0, 0] = 0.0
    for i in range(1, n + 1):
        for j in range(max(1, i - band), min(m, i + band) + 1):
            d = np.sqrt(np.mean((a[i - 1] - b[j - 1]) ** 2))
            D[i, j] = d + min(D[i - 1, j], D[i, j - 1], D[i - 1, j - 1])
    return float(D[n, m] / max(n, m))


def standardiser(seqs: list[np.ndarray]):
    X = np.concatenate(seqs)
    mean = X.mean(axis=0)
    scale = X.std(axis=0)
    scale = np.where(scale > 1e-9, scale, 1.0)
    return mean, scale


def pick_prototypes(seqs: list[np.ndarray], k: int) -> list[np.ndarray]:
    """Up to k recordings that are most typical (smallest total distance to the others)."""
    if len(seqs) <= k:
        return seqs
    total = [sum(dtw(a, b) for b in seqs) for a in seqs]
    return [seqs[i] for i in np.argsort(total)[:k]]


def nearest(x: np.ndarray, protos: dict[str, list[np.ndarray]]) -> str:
    return min(protos, key=lambda w: min(dtw(x, p) for p in protos[w]))


def evaluate(items: list[tuple[Sample, np.ndarray]], k: int) -> dict:
    signers = {s.signer for s, _ in items}
    by_signer = len(signers) >= 3
    folds = sorted(signers) if by_signer else [s.id for s, _ in items]
    hits, confusions = [], Counter()
    for held in folds:
        test = [(s, q) for s, q in items if (s.signer if by_signer else s.id) == held]
        train = [(s, q) for s, q in items if (s.signer if by_signer else s.id) != held]
        if not test or len({s.label for s, _ in train}) < 2:
            continue
        mean, scale = standardiser([q for _, q in train])
        protos: dict[str, list[np.ndarray]] = defaultdict(list)
        for s, q in train:
            protos[s.label].append((q - mean) / scale)
        protos = {w: pick_prototypes(ps, k) for w, ps in protos.items()}
        for s, q in test:
            guess = nearest((q - mean) / scale, protos)
            hits.append(guess == s.label)
            if guess != s.label:
                confusions[(s.label, guess)] += 1
    return {
        "held_out_by": "signer" if by_signer else "recording",
        "accuracy": float(np.mean(hits)) if hits else None,
        "recordings": len(hits),
        "top_confusions": [f"{t} → {p}: {n}" for (t, p), n in confusions.most_common(8)],
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--api", help="Prism API base URL, e.g. http://localhost:8080")
    src.add_argument("--file", help="JSON file of word samples (as returned by /api/sign/samples?kind=word&full=1)")
    ap.add_argument("--out", default=str(DEFAULT_OUT), help="where to write the model JSON")
    ap.add_argument("--steps", type=int, default=16, help="steps each recording is resampled to")
    ap.add_argument("--prototypes", type=int, default=5, help="prototype recordings kept per word")
    ap.add_argument("--min-per-word", type=int, default=2, help="words with fewer recordings are left out")
    args = ap.parse_args()

    samples = from_api(args.api, "word") if args.api else from_file(args.file, "word")
    items = [(s, q) for s in samples if (q := sequence(s, args.steps)) is not None]
    per_word = Counter(s.label for s, _ in items)
    keep = {w for w, n in per_word.items() if n >= args.min_per_word}
    items = [(s, q) for s, q in items if s.label in keep]
    if len(keep) < 2:
        raise SystemExit(f"Need at least 2 words with {args.min_per_word}+ recordings; have {dict(per_word)}")

    report = evaluate(items, args.prototypes)
    mean, scale = standardiser([q for _, q in items])
    protos: dict[str, list[np.ndarray]] = defaultdict(list)
    for s, q in items:
        protos[s.label].append((q - mean) / scale)
    protos = {w: pick_prototypes(ps, args.prototypes) for w, ps in protos.items()}
    # Temperature: typical distance between a recording and its own word's nearest prototype.
    own = [min(dtw(p, o) for o in ps if o is not p) for ps in protos.values() for p in ps if len(ps) > 1]
    temperature = float(np.median(own) * 0.5) if own else 0.3

    r = lambda a: [[round(float(v), 5) for v in row] for row in a]  # noqa: E731
    model = {
        "kind": "dtw-prototypes",
        "feature_version": FEATURE_VERSION,
        "steps": args.steps,
        "mean": [round(float(v), 6) for v in mean],
        "scale": [round(float(v), 6) for v in scale],
        "temperature": round(max(temperature, 0.05), 4),
        "words": {w: [r(p) for p in ps] for w, ps in sorted(protos.items())},
        "trained_on": {
            "samples": len(items),
            "signers": len({s.signer for s, _ in items}),
            "deaf_signers": len({s.signer for s, _ in items if s.deaf}),
            "accuracy": report.get("accuracy"),
        },
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(model, ensure_ascii=False), encoding="utf-8")
    print(f"{len(items)} recordings of {len(keep)} words from {model['trained_on']['signers']} signers")
    dropped = sorted(set(per_word) - keep)
    if dropped:
        print(f"left out (fewer than {args.min_per_word} recordings): {' '.join(dropped)}")
    for k, v in report.items():
        print(f"{k}: {v}")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
