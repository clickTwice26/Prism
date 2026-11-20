"""Loading recorded samples: from the Prism API or from a JSON file.

A sample is one recording of a letter: a list of frames, each with the hand
skeleton points and a feature vector computed in the browser
(frontend/src/lib/handsign/hand.ts, featureVector). Only skeleton points are
stored, never video.
"""

from __future__ import annotations

import json
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import numpy as np

FEATURE_VERSION = 1
FEATURE_LENGTH = 151  # letters: frontend/src/lib/handsign/hand.ts featureVector
WORD_FEATURE_LENGTH = 157  # words: frontend/src/lib/handsign/words.ts wordFeatureVector


@dataclass
class Sample:
    id: int
    label: str
    signer: str
    deaf: bool
    features: np.ndarray  # frames × FEATURE_LENGTH


def _parse(rows: list[dict], length: int = FEATURE_LENGTH) -> list[Sample]:
    out = []
    for r in rows:
        if r.get("feature_version", FEATURE_VERSION) != FEATURE_VERSION:
            continue  # recorded with another feature layout: re-record or convert
        feats = np.asarray(r.get("features") or [], dtype=float)
        if feats.ndim != 2 or feats.shape[1] != length or len(feats) == 0:
            continue
        out.append(Sample(id=int(r["id"]), label=r["label"], signer=r["signer"], deaf=bool(r.get("deaf")), features=feats))
    return out


def _length(kind: str) -> int:
    return WORD_FEATURE_LENGTH if kind == "word" else FEATURE_LENGTH


def from_api(base: str, kind: str = "letter") -> list[Sample]:
    url = f"{base.rstrip('/')}/api/sign/samples?kind={kind}&full=1"
    with urllib.request.urlopen(url, timeout=60) as resp:  # local Prism API
        return _parse(json.load(resp), _length(kind))


def from_file(path: str | Path, kind: str = "letter") -> list[Sample]:
    return _parse(json.loads(Path(path).read_text(encoding="utf-8")), _length(kind))


def frames_dataset(samples: list[Sample], trim: float = 0.2):
    """Per-frame rows, dropping the first and last part of each recording
    (moving into and out of the letter). Returns X, y, sample ids, signers."""
    X, y, groups, signers = [], [], [], []
    for s in samples:
        n = len(s.features)
        a, b = int(n * trim), max(int(n * (1 - trim)), int(n * trim) + 1)
        for row in s.features[a:b]:
            if row[0] == 0 or row[26] == 0:  # a hand was missing in this frame
                continue
            X.append(row)
            y.append(s.label)
            groups.append(s.id)
            signers.append(s.signer)
    return np.asarray(X), np.asarray(y), np.asarray(groups), np.asarray(signers)
