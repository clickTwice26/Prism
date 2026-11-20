"""Train the letter model from recorded samples and export it for the browser.

    uv run python -m prism_ml.train_letters --api http://localhost:8080
    uv run python -m prism_ml.train_letters --file samples.json --out model.json

The model is standardisation + multinomial logistic regression, small enough
to run on every video frame in the browser (frontend/src/lib/handsign/model.ts).
Accuracy is always measured on recordings the model was not trained on: whole
signers left out when there are several, otherwise whole recordings.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import StandardScaler

from .samples import FEATURE_VERSION, from_api, from_file, frames_dataset

DEFAULT_OUT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "models" / "letters.json"


def fit(X: np.ndarray, y: np.ndarray, c: float):
    scaler = StandardScaler().fit(X)
    scale = np.where(scaler.scale_ > 1e-9, scaler.scale_, 1.0)
    clf = LogisticRegression(C=c, max_iter=3000)
    clf.fit((X - scaler.mean_) / scale, y)
    return scaler.mean_, scale, clf


def evaluate(X, y, groups, signers, c: float) -> dict:
    """Held-out accuracy per frame and per recording (majority vote)."""
    by = signers if len(set(signers)) >= 3 else groups
    n_splits = min(5, len(set(by)))
    if n_splits < 2 or len(set(y)) < 2:
        return {"note": "not enough recordings or letters to evaluate"}
    frame_hits, rec_votes = [], {}
    confusions: Counter[tuple[str, str]] = Counter()
    for train, test in GroupKFold(n_splits=n_splits).split(X, y, by):
        if len(set(y[train])) < 2:
            continue
        mean, scale, clf = fit(X[train], y[train], c)
        pred = clf.predict((X[test] - mean) / scale)
        frame_hits.extend(pred == y[test])
        for g, p, t in zip(groups[test], pred, y[test]):
            rec_votes.setdefault(g, (t, Counter()))[1][p] += 1
            if p != t:
                confusions[(t, p)] += 1
    rec_hits = [votes.most_common(1)[0][0] == t for t, votes in rec_votes.values()]
    return {
        "held_out_by": "signer" if by is signers else "recording",
        "frame_accuracy": float(np.mean(frame_hits)) if frame_hits else None,
        "recording_accuracy": float(np.mean(rec_hits)) if rec_hits else None,
        "recordings": len(rec_hits),
        "top_confusions": [f"{t} → {p}: {n}" for (t, p), n in confusions.most_common(8)],
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--api", help="Prism API base URL, e.g. http://localhost:8080")
    src.add_argument("--file", help="JSON file of samples (as returned by /api/sign/samples?full=1)")
    ap.add_argument("--out", default=str(DEFAULT_OUT), help="where to write the model JSON")
    ap.add_argument("--c", type=float, default=1.0, help="inverse regularisation strength")
    ap.add_argument("--min-per-letter", type=int, default=3, help="letters with fewer recordings are left out")
    args = ap.parse_args()

    samples = from_api(args.api) if args.api else from_file(args.file)
    per_letter = Counter(s.label for s in samples)
    keep = {l for l, n in per_letter.items() if n >= args.min_per_letter}
    dropped = sorted(set(per_letter) - keep)
    samples = [s for s in samples if s.label in keep]
    if len(keep) < 2:
        raise SystemExit(f"Need at least 2 letters with {args.min_per_letter}+ recordings; have {dict(per_letter)}")

    X, y, groups, signers = frames_dataset(samples)
    report = evaluate(X, y, groups, signers, args.c)
    mean, scale, clf = fit(X, y, args.c)

    model = {
        "kind": "logistic",
        "feature_version": FEATURE_VERSION,
        "classes": [str(c) for c in clf.classes_],
        "mean": [round(float(v), 6) for v in mean],
        "scale": [round(float(v), 6) for v in scale],
        "coef": [[round(float(v), 6) for v in row] for row in clf.coef_],
        "intercept": [round(float(v), 6) for v in clf.intercept_],
        "trained_on": {
            "samples": len(samples),
            "frames": int(len(X)),
            "signers": len(set(s.signer for s in samples)),
            "deaf_signers": len(set(s.signer for s in samples if s.deaf)),
            "accuracy": report.get("recording_accuracy"),
        },
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(model, ensure_ascii=False), encoding="utf-8")

    print(f"{len(samples)} recordings, {len(X)} frames, {len(keep)} letters, {model['trained_on']['signers']} signers")
    if dropped:
        print(f"left out (fewer than {args.min_per_letter} recordings): {' '.join(dropped)}")
    for k, v in report.items():
        print(f"{k}: {v}")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
