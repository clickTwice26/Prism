# Prism Sign: recognising signs from their description

As of 2026-11-20. A plan for recognising Bangla Sign Language (BdSL) signs without a large video
dataset. It extends [sign-language-plan.md](sign-language-plan.md), which put recognition in a later
research phase because BdSL video data is small.

## Summary

**Prism recognises a sign by checking its parts (handshape, location, palm orientation and
movement) against a written description of the sign, not by learning from thousands of videos.**

Every sign is a combination of a few parts from a small, closed set. A description such as
"flat hand at the forehead, moving down" can be checked against a live signer's hand and body
skeleton, even if nobody ever recorded that sign on video. Only the handshape step needs training
data, and the set of handshapes is small.

Prism already has written descriptions of about 3,850 BdSL words (the IsharaKotha corpus), and two
drawn references to check them against. That turns BdSL's biggest weakness, too little video, into
the project's technical edge.

The same part-by-part check gives feedback a learner can act on: *"Your handshape is right; move
your hand down to your chest."* This makes it the engine for a parent sign coach as well as for
recognition.

## What we have

| Source | What it is | Size | Use |
| --- | --- | --- | --- |
| IsharaKotha corpus (`data/isharakotha`, not committed) | Machine-readable sign descriptions in HamNoSys notation (SiGML files), grouped in 31 topic sections | 3,990 files, about 3,850 unique words, 37 letters, a few full sentences; 83 files fail to parse | **Main description source** |
| Bengali Sign Language Dictionary, 1994 (Bangladesh Sign Language Committee, with deaf members) | Scanned line drawings with movement arrows, Bangla and English labels, 26 topic sections, one-hand and two-hand alphabets | 175 pages, about 900 signs (estimate) | Checks the descriptions; adds signs; reference for reviewers |
| Grameenphone "বাংলা ইশারা বর্ণ পরিচয়" (2026) | Clean drawings of the two-hand Bangla alphabet | About 40 letter cards | Checks the alphabet is current; reference only (Grameenphone owns the artwork) |
| Prism's approved sign clips | Real signers, approved by deaf reviewers, with consent | Grows with use | **Test set**, and later fine-tuning |

### What the descriptions contain

Counted across the IsharaKotha files:

- **Handshapes:** 16 base shapes (flat hand, fist, index finger, two fingers, pinch, "C" shape and
  others), plus thumb modifiers.
- **Palm and finger direction:** about 27 symbols (palm up, down, left, right; fingers up, out…).
- **Locations:** about 44 symbols (forehead, nose, lips, chin, neck, shoulders, chest, stomach,
  parts of the other hand, and neutral space in front of the body).
- **Movements:** about 50 symbols (straight moves in each direction, arcs, circles, finger play,
  repeats, "replace" for a change of handshape, and "no motion").
- **Two hands:** about 63% of files describe two-handed symmetric signs.
- **Not covered:** facial expressions and mouth patterns appear in only 158 files, and speed and
  rhythm are barely described.

### Coverage

Everyday and health words are well covered (water, sun, fire, tree, food, fever, doctor, hospital,
medicine, love, eat, sleep, teacher, school, book). Lesson-specific science words are mostly
missing (air, leaf, plant, heat, energy, oxygen). Those still come from the community lexicon in
the existing plan. Each new approved clip can also get a description, so the recogniser grows with
the lexicon.

## How it works

```mermaid
flowchart LR
    cam["Camera<br/>in the browser"] --> pose["Skeleton tracking<br/>hands, face, body<br/>(MediaPipe)"]
    pose --> parts["Part detectors<br/>handshape · location<br/>palm direction · movement"]
    desc["Sign descriptions<br/>IsharaKotha + checked<br/>against 1994 drawings"] --> compile["Compiled into<br/>part templates"]
    parts --> match["Matcher<br/>scores every part,<br/>aligns movement over time"]
    compile --> match
    match --> out["Top answers with<br/>confidence and<br/>which parts matched"]
    out --> uses["Uses: fingerspelling,<br/>sign coach feedback,<br/>review assistant"]
```

1. **Skeleton tracking.** MediaPipe runs in the browser and gives 21 points per hand plus face and
   body points, many times a second. Video never leaves the device; only these points are used.
2. **Part detectors**
   - **Handshape:** a small classifier over finger joint angles, choosing one of the 16 base
     shapes plus thumb variants. This is the only trained model.
   - **Location:** where the hand is relative to the face and body points (forehead, chin, chest…),
     scaled to the signer's body size.
   - **Palm and finger direction:** computed from the hand points, no training needed.
   - **Movement:** the path of the hand over time, simplified into strokes (down, arc, circle,
     repeat).
3. **Sign descriptions.** A parser turns each SiGML file into a template: a start pose (handshape,
   orientation, location for each hand), then a sequence of movements and handshape changes.
4. **Matcher.** Each part gets a score, and the movement sequence is aligned in time (dynamic time
   warping) because people sign at different speeds. The result is the top few signs with an
   overall confidence and a per-part breakdown.
5. **Explanation.** The answer says what matched and what did not, for example *"জ্বর (fever):
   handshape ✓, forehead ✓, downward movement ✓, 87%"*. Low confidence means "not sure", never a
   guess.

### Training the handshape classifier

The 16 handshapes are few and static, so they need little data:

- The team records each handshape from several angles (a few seconds each), turned into skeleton
  points only.
- Synthetic variants: rotate, scale and slightly bend the recorded hand skeletons.
- Later, handshapes taken from approved, consented clips in the lexicon.

## Where it shows up in Prism

- **Fingerspelling:** sign a word letter by letter (two-hand Bangla alphabet) and Prism types it.
  Useful wherever a term has no sign yet.
- **Sign coach for parents:** practise a sign and get feedback on the part that is wrong. This is
  the "Ma, I love you" idea from the planning discussion.
- **Review assistant:** when a signer uploads a clip for a term, Prism checks it against the
  documented description and tells the deaf reviewer whether it matches the established sign.
  The reviewer still decides.
- **Later:** students answering questions by signing single words in adaptive lessons.

## Phase 0 results (2026-11-20)

`backend/internal/signref` now reads every SiGML file leniently and parses its HamNoSys symbols into a
template: each hand's shape (with thumb, bends and per-finger bends), extended-finger and palm
direction, location (body site, side, contact, and the touching parts of each hand) and a list of
actions (move, arc, circle, handshape change, hold and others, with direction, size, contact, target
and simultaneous actions). `go run ./cmd/signtemplates` writes `templates.json`, `stats.json`,
`failures.json` and `report.md` to `data/isharakotha/` (not committed), and the API serves templates
at `GET /api/sign/templates?section=Letters` or `?words=জ্বর,fever`.

| Measure | Result |
| --- | --- |
| Corpus files | 3,990 |
| Parsed into templates | 3,926 (98.4%) |
| Complete (handshape, orientation and location) | 3,877 files, 3,602 unique words |
| Letters of the two-hand alphabet | 37 of 37 complete |
| Words with symbols the parser could not place | 3 |
| Files that cannot be read | 64: 39 empty, 25 placeholders with no sign |
| Words made of several signs | 1,909 |

Still open from Phase 0: mapping the 1994 dictionary pages to signs (the scan has no text layer
and no OCR tool is installed yet), and the licence check. Some words appear in more than one section
with different descriptions; both are kept as variants.

## Phase 1 status (2026-11-20)

Built, and checked with synthetic hands and in the browser; **not yet measured on real people**.

- **Fingerspell page** (`/fingerspell`): Spell (type a word letter by letter), Practise a letter
  (plain-language steps, a score for each part and feedback on the weakest part) and Record samples.
  A "Simulate" switch drives the whole page with computer-made hands when there is no camera.
- **Hand tracking:** MediaPipe Hand Landmarker in the browser. The WebAssembly runtime is served by
  the app (`scripts/copy-mediapipe.mjs`); the hand model loads from Google's model storage. Video
  stays on the device; only the 21 points per hand are used.
- **Letter matcher** (`frontend/src/lib/handsign`): no training needed. Each hand's shape is scored
  from finger bends, spread and thumb position (including the thumb and "bent" modifiers); direction
  from finger and palm vectors in the signer's frame; and the contact point from the two named
  hand parts. Parts are combined with a weighted geometric mean, contact weighted most. A stabiliser
  types a letter after it has been the confident best guess for most of the last 12 frames.
- **Recorded samples:** `POST /api/sign/samples` stores skeleton points and a 151-number feature
  vector per frame, with the signer's consent, and they can be deleted.
- **Python** (`ml/`): `prism_ml.train_letters` trains standardisation + logistic regression on the
  samples, reports accuracy on held-out signers, and writes `frontend/public/models/letters.json`,
  which the page blends 50/50 with the template matcher.

| Check | Result |
| --- | --- |
| Base handshapes from synthetic hands, 3 orientations each | all in the top 3; at most a few look-alikes |
| Letters from synthetic two-hand poses with noise | 37 of 37 top-1 |
| End to end in the browser (simulation) | types ক ল ম correctly; practice feedback works |
| Python training on synthetic recordings, held out by signer | runs and exports a model the browser accepts |

The synthetic results only show that geometry, scoring and plumbing are consistent with the
descriptions they were generated from. **Real accuracy is unknown until people record samples**:
real hands vary, MediaPipe struggles when hands overlap (as they do in these letters), and the
corpus descriptions may differ from how deaf people sign. Next: record at least 5 samples of every
letter from several people, ideally deaf signers, then run `train_letters` and report held-out
accuracy against the 90% target.

## Phases

| Phase | Goal | Done when |
| --- | --- | --- |
| **0. Data** (Nov 21–24, mostly done Nov 20) | Parse all SiGML into part templates; list and fix the files that fail; map 1994 dictionary pages to their signs; check the description licences | Templates for at least 3,700 words, and a list of known gaps |
| **1. Fingerspelling** (Nov 25–30; built Nov 20, accuracy not yet measured) | Handshape classifier; recognise the 37 letters of the two-hand alphabet live in the browser | At least 90% letter accuracy on the team's own recordings; demo for the "Zero to Launch" submission |
| **2. Single signs** (Dec 1–20) | Location, direction and movement detectors; matcher with explanations for 30–50 chosen signs (health, family, school) | Correct sign in the top 3 at least 80% of the time on held-out recordings by people who did not build it, ideally deaf signers |
| **3. Congress demo** (Dec 26) | A parent practises signs and gets part-by-part feedback; fingerspelling; review assistant on one clip | Runs live on a laptop and a mid-range phone |
| **4. After the Congress** | Grow to hundreds of signs; tune templates with approved clips; real signers' variation; pilot with deaf partners | Accuracy reported per sign and per part on a public test set built with deaf partners |

## How success is measured

- **Letter accuracy** for fingerspelling, and **top-1 and top-3 accuracy** for signs, always on
  people who were not in the training data.
- **Accuracy per part** (handshape, location, direction, movement), to show where errors come from.
- **Calibration:** when Prism says 80% sure, it should be right about 80% of the time.
- **Coach usefulness:** do parents' signs get closer to the description after feedback? Rated by
  deaf reviewers.
- **Fairness:** accuracy across left- and right-handed signers, skin tones, lighting and cameras.

## Risks

| Risk | Mitigation |
| --- | --- |
| Descriptions miss speed, repetition, facial grammar and depth | Use them for single signs and fingerspelling first; add facial features only where a description has them; measure the gap honestly |
| IsharaKotha signs differ from what deaf people use, or from the 1994 dictionary | Check each sign in the demo set against the dictionary drawing and with a deaf reviewer; keep regional variants as separate templates |
| Similar signs differ by one small part | Report the top 3 with explanations; teach the coach to point at the differing part |
| Skeleton tracking fails with fast or overlapping hands, poor light or cheap cameras | Test on a range of phones; show "can't see your hands clearly" instead of guessing |
| Left-handed signers | Mirror the templates |
| Licence of the IsharaKotha corpus and 1994 dictionary unknown | Use them as internal references until the licences are confirmed; do not republish the drawings or files |
| Building recognition on top of an avatar corpus could be read as endorsing avatars | Prism never renders the descriptions as an animated signer; it only reads the part information |

## Ethics

- Only skeleton points are processed; video stays on the device.
- No avatars and no generated signing: the descriptions are used only to recognise and to explain.
- Deaf reviewers decide which descriptions count as correct BdSL, and their corrections become
  part of the templates.
- Test recordings by deaf signers need the same per-clip consent as the lexicon, and they are not
  used for training unless the signer agrees.

## Open questions

- [ ] What is the licence of the IsharaKotha corpus, and who maintains it?
- [ ] Can we get permission to use the 1994 dictionary drawings (Bangladesh National Federation of
      the Deaf, Department of Social Services)?
- [ ] Which 30–50 signs matter most for the demo: health, family and school words?
- [ ] Which deaf signers can record a small, consented test set before Dec 20?
