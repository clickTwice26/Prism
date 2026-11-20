import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

from prism_ml.samples import FEATURE_LENGTH, from_file, frames_dataset
from prism_ml.train_letters import evaluate, fit


def fake_samples(n_letters=3, per_letter=4, signers=("A", "B", "C"), frames=20, seed=0):
    rng = np.random.default_rng(seed)
    centres = rng.normal(size=(n_letters, FEATURE_LENGTH))
    rows, i = [], 0
    for s in signers:
        for k in range(n_letters):
            for _ in range(per_letter):
                f = centres[k] + rng.normal(scale=0.3, size=(frames, FEATURE_LENGTH))
                f[:, 0] = 1  # both hands present
                f[:, 26] = 1
                rows.append({"id": i, "label": f"L{k}", "signer": s, "deaf": False, "feature_version": 1, "features": f.tolist()})
                i += 1
    return rows


class TrainLettersTest(unittest.TestCase):
    def load(self, rows):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "s.json"
            p.write_text(json.dumps(rows))
            return from_file(p)

    def test_skips_other_feature_versions_and_bad_shapes(self):
        rows = fake_samples(n_letters=2, per_letter=1, signers=("A",))
        rows.append({"id": 99, "label": "L0", "signer": "A", "feature_version": 2, "features": rows[0]["features"]})
        rows.append({"id": 98, "label": "L0", "signer": "A", "feature_version": 1, "features": [[1, 2, 3]]})
        self.assertEqual(len(self.load(rows)), 2)

    def test_trims_the_start_and_end_and_drops_one_hand_frames(self):
        rows = fake_samples(n_letters=1, per_letter=1, signers=("A",), frames=10)
        rows[0]["features"][5][26] = 0  # other hand missing in one frame
        X, y, groups, _ = frames_dataset(self.load(rows))
        self.assertEqual(len(X), 5)  # frames 2..7, minus the one-hand frame
        self.assertTrue((groups == 0).all())

    def test_held_out_evaluation_never_shares_a_signer(self):
        X, y, groups, signers = frames_dataset(self.load(fake_samples()))
        report = evaluate(X, y, groups, signers, c=1.0)
        self.assertEqual(report["held_out_by"], "signer")
        self.assertGreater(report["recording_accuracy"], 0.9)

    def test_fit_gives_a_browser_ready_scale(self):
        X, y, _, _ = frames_dataset(self.load(fake_samples(signers=("A",))))
        X[:, 5] = 3.0  # a constant column must not divide by zero in the browser
        mean, scale, clf = fit(X, y, c=1.0)
        self.assertTrue((scale > 0).all())
        self.assertEqual(clf.coef_.shape, (3, FEATURE_LENGTH))


if __name__ == "__main__":
    unittest.main()
