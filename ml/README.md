# Prism ML tools

Python tools for Prism's Bangla Sign Language recognition. See
[docs/sign-recognition-plan.md](../docs/sign-recognition-plan.md).

The browser recognises fingerspelled letters by checking each part against the
letter's written description (`frontend/src/lib/handsign`). As people record
samples on the Fingerspell page (skeleton points only, with consent), these
tools train a small learned model that the browser blends in.

```bash
cd ml
uv run python -m prism_ml.train_letters --api http://localhost:8080
```

This reads every letter sample from the API, reports accuracy on recordings
the model never saw (whole signers left out when there are three or more),
and writes `frontend/public/models/letters.json`. Reload the Fingerspell page
to use it.

Only commit a model trained on real, consented recordings, and report its
held-out accuracy with it.
