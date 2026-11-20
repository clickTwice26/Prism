"""Aligns one full ElevenLabs take to the script's caption lines.

Input:  audio/elevenlabs-words.json (Whisper output with word timestamps, e.g.
        `whisper audio/elevenlabs-full.mp3 --model base.en --word_timestamps True --output_format json`)
Output: audio/elevenlabs-chunks.json  {chunk id: {start, end}} in seconds of the take.
"""
import difflib, json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NUM = {"four": "4", "five": "5", "seventy": "70", "ninety": "90"}

def norm(w):
    w = w.lower().replace(",", "").replace("%", "")
    w = re.sub(r"[^a-z0-9']", "", w)
    return NUM.get(w, w)

# Read the chunks from script.ts through node (keeps one source of truth).
chunks = json.loads(subprocess.check_output(
    ["node", "-e", "import('./src/script.ts').then(m=>console.log(JSON.stringify(m.SECTIONS.flatMap(s=>s.scenes.flatMap(c=>c.vo)))))"],
    cwd=ROOT))
ref, owner = [], []
for c in chunks:
    for w in c["text"].replace("-", " ").split():
        n = norm(w)
        if n:
            ref.append(n); owner.append(c["id"])

words = [w for s in json.load(open(ROOT / "audio/elevenlabs-words.json"))["segments"] for w in s["words"]]
hyp = []
for w in words:
    for part in w["word"].replace("-", " ").split():
        hyp.append((norm(part), w["start"], w["end"]))

sm = difflib.SequenceMatcher(a=ref, b=[h[0] for h in hyp], autojunk=False)
idx = {}  # chunk id -> [first, last] matched hyp index
first_ok, last_ok = {}, {}  # was the chunk's first / last script word matched?
for a, b, n in sm.get_matching_blocks():
    for k in range(n):
        cid = owner[a + k]
        lo, hi = idx.get(cid, (b + k, b + k))
        idx[cid] = (min(lo, b + k), max(hi, b + k))
        if a + k == 0 or owner[a + k - 1] != cid:
            first_ok[cid] = True
        if a + k == len(ref) - 1 or owner[a + k + 1] != cid:
            last_ok[cid] = True

# Spoken words the matcher could not place (e.g. "Finger spell" for
# "Fingerspell") go to the line that is missing its first or last word.
ids = [c["id"] for c in chunks]
for i in range(len(ids) - 1):
    p, q = ids[i], ids[i + 1]
    if p not in idx or q not in idx:
        continue
    gap = range(idx[p][1] + 1, idx[q][0])
    if not len(gap):
        continue
    if not last_ok.get(p):
        idx[p] = (idx[p][0], gap[-1])
    elif not first_ok.get(q):
        idx[q] = (gap[0], idx[q][1])
if ids[0] in idx and not first_ok.get(ids[0]):
    idx[ids[0]] = (0, idx[ids[0]][1])
if ids[-1] in idx and not last_ok.get(ids[-1]):
    idx[ids[-1]] = (idx[ids[-1]][0], len(hyp) - 1)
span = {cid: (hyp[lo][1], hyp[hi][2]) for cid, (lo, hi) in idx.items()}

missing = [c["id"] for c in chunks if c["id"] not in span]
if missing:
    sys.exit(f"Could not align: {missing}")
out = {c["id"]: {"start": round(span[c["id"]][0], 3), "end": round(span[c["id"]][1], 3)} for c in chunks}
json.dump(out, open(ROOT / "audio/elevenlabs-chunks.json", "w"), indent=2)
matched = sum(n for *_, n in sm.get_matching_blocks())
print(f"Aligned {len(out)} lines ({matched}/{len(ref)} words matched).")
for c in chunks:
    print(f"  {c['id']:12} {out[c['id']]['start']:7.2f} {out[c['id']]['end']:7.2f}  {c['text'][:50]}")
