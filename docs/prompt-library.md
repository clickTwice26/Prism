# Prompt library

Prompts behind Prism Sign: the two that run inside the product, and the ones used to build it with
Claude Code. Each lists what it was for and what came out. Edit them freely before pasting into the
Congress submission form.

## In the product

These are in `backend/internal/ai/ai.go`. AI only does routine text work; people sign and deaf
reviewers approve every sign. AI-written text is always labelled as AI-written.

### 1. Pick a lesson's key terms

> You pick the key subject terms of a school lesson, for a sign language glossary for deaf learners.
> Choose 5 to 10 terms that the lesson depends on and that a learner must know to follow it: subject
> vocabulary such as 'chlorophyll' or 'evaporation', not everyday words, names of people or whole
> phrases. The lesson is in {language}. Copy each term in the lesson's language exactly as it appears
> in the text (same spelling, singular form if both appear), and give the usual school word for it in
> the other languages. Reply with JSON only: `{"terms":[{"en":"...","bn":"...","ms":"..."}]}`

Why: deaf learners miss subject vocabulary most. Temperature 0 and JSON-only output keep it
repeatable, and the code drops any term over 60 characters or missing the lesson's own language, so
each term can be matched in the lesson text.

### 2. Translate without changing meaning

> You translate classroom lesson text into {language}. Keep every fact and the exact meaning; do not
> add, remove or explain anything. Keep it natural for a student. If it is already in that language,
> return it unchanged. Reply with only the translation.

Why: learners read the lesson in their own language, so the glossary signs are found in the words
they see. "Do not add or explain" stops the model from inventing content.

## Building Prism

### 3. Scope the project to a plan

> Go with `docs/sign-language-plan.md`. Build only what the plan needs. Remove every feature that is
> not required by it. Commit chunk by chunk and never stage everything at once.

Result: the sign glossary, deaf review queue, interpreter window and live class; unrelated features
were removed.

### 4. Recognise signs from written descriptions, not video datasets

> BdSL has almost no video data, but signs are hand movements, not an unknown thing. A 3,990-file
> HamNoSys/SiGML corpus describes each sign's handshape, palm direction, location and movement. Plan
> a recogniser that checks a live signer against those descriptions, part by part, with no video
> training set. Plan it first, in phases, with a measurable test for each phase.

Result: `docs/sign-recognition-plan.md`; templates parsed from the corpus; a MediaPipe hand and body
matcher that says which part of a sign to fix.

### 5. Find why accuracy is poor, then test it

> Recognition is very inaccurate with a real camera. Build synthetic hands and signers with
> controllable noise so I can measure accuracy without recordings. Find which parts fail first and
> fix the cause, not the symptom. Report accuracy before and after each fix.

Result: palm codes were read as relative to the fingers (41% of poses had impossible palm
directions); finger straightness is measured at the PIP→tip angle; live hands are smoothed. On
synthetic signers handshapes went from 68% to 90% at heavy noise, and words from 52/60 to 60/60.

### 6. Show what the system sees

> Add a switch that draws the tracked hand and body points over the video and shows each part's
> score, so a learner and a teacher can see why a sign was marked wrong. Only joint points are used;
> no video leaves the device.

Result: the "What Prism sees" diagnostics panel and the part-by-part score bars.

### 7. Let approved community clips teach new signs

> When a deaf reviewer approves a clip for a lesson term, track the clip and write the sign down in
> the same template form as the corpus: handshape, start place, movement, direction and other hand.
> Store only that description, never a recording; delete it if the clip is rejected or withdrawn.
> Show the reviewer in plain words what was learned.

Result: a sign learned from one signer was recognised on another 58 of 61 times (60 of 61 in the
top 3) in tests.

### 8. Add a labelled 3D preview

> Recognition is still inaccurate, so make a presentable product. Add a real 3D character that
> performs the documented signs from their HamNoSys descriptions. It must be clearly labelled as
> software, not a deaf signer, and human clips must always come first.

Result: the Sign dictionary and the Practise tab use the CWASA 3D signer, with a Slow mode, three
characters, and a label under every preview.

### 9. Accessibility review

> Review this screen as a deaf or hard-of-hearing learner would use it. Check every control for a
> visible label, keyboard access and a visible focus ring, that results are announced to screen
> readers, and that no information depends on sound or colour alone. List what fails, then fix it.

Result: part-by-part feedback in words, announced results, and a keyboard path for every control.

### 10. Check claims against research

> For each design choice, find a published study that supports or contradicts it, and tell me which.
> Where the research disagrees with the plan, change the plan.

Result: the interpreter window can be switched on and off, resized and moved; human signers come
first; and signs are co-designed with deaf reviewers.
