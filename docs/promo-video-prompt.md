# Prompt: make the Prism Sign promo video with Claude

Copy everything below the line into a new Claude Code session opened in this repository (`Prism/`).
It asks Claude to build and render the 3-minute submission video for the International AI Builders
Congress, following the Congress's "Vibe to Production in 180 Seconds" guidance, in the same visual
style as the Chasha Bhai promo. The ElevenLabs-ready voiceover is in
[promo-voiceover.txt](promo-voiceover.txt).

---

## Your task

Build and render a **3-minute video, `Prism_Sign_Promo_Final.mp4`**, for Prism Sign, our entry to the
International AI Builders Congress 2026 (LearnSphere AI → AI Teacher track, Congress Day
2026-12-26). It is our preliminary submission, so it must prove execution, not pitch an idea: show
that the problem is real, that our AI approach is sound, and that we have built a working system.

Before you write any code, read these files so every claim in the video matches the real product:
`README.md`, `docs/sign-language-plan.md`, `docs/sign-recognition-plan.md`, `docs/demo-script.md`,
`docs/architecture.md`, `docs/design.md`, `frontend/src/lib/theme.ts`,
`frontend/src/components/Sidebar.tsx` and the pages under `frontend/src/app/`. If anything in this
prompt disagrees with the code or docs, the code and docs win; tell me what you changed.

Work in a new folder, `video/`, at the repository root. Do not touch `frontend/`, `backend/` or `ml/`.

## The Congress's required structure

The judges score against this exact 180-second breakdown, so the video follows it to the second and
shows its five sections as a progress bar at the top of the frame.

| Time | Section | What we must show | Key message | Judges look for |
| --- | --- | --- | --- | --- |
| 0:00–0:30 | Problem | Problem, target users, urgency (Bangladesh and global) | "This problem matters" | Clarity, relevance |
| 0:30–1:00 | Solution | Our AI-driven solution and what makes it different | "This is how we solve it" | Simplicity, uniqueness |
| 1:00–2:00 | Demo | The working prototype, screen by screen | "This is how it works" | Feasibility, logic |
| 2:00–2:30 | AI approach | Models, data, personalisation, tools | "This is real AI thinking" | Depth, structure |
| 2:30–3:00 | Impact and next step | Value, potential users, KPIs, what comes next | "We can build and scale this" | Vision, potential |

Every mandatory requirement must be visible on screen, not only spoken:

- A structured 3-minute (180 s) video.
- A clear problem and user definition (who, where, how many).
- An AI-native approach: name the models and what each one does.
- A basic system flow, drawn as **input → AI → output**.
- A real demo of the working prototype.
- Bangla localisation: Bangla UI, Bangla Sign Language, Bangla lines on every title card.
- Defined impact: the pilot KPIs with their targets.

Avoid the listed mistakes: no idea without a system, no vague AI, no overcomplicated detail, no
missing demo, no imaginary users.

## The one idea the video must land

> **The same lesson, in Bangla Sign Language.** Deaf children in Bangladesh sit in classes they
> cannot hear. Prism Sign puts real, deaf-approved signs right where they read, and AI does the
> routine work so scarce interpreters reach far more children.

Three messages, repeated visually throughout:

1. **Sign where the child reads.** Key terms are underlined; tap one and the sign plays.
2. **AI for the routine work, people for the signing.** AI finds key terms, captions speech and
   coaches signing. Humans sign. Deaf reviewers approve every sign before a learner sees it.
3. **Private and honest.** Recognition runs in the browser on hand and body points only; no video
   leaves the device. Anything computer-made (the 3D signer) is clearly labelled as a preview.

## Audience and tone

- **Viewers:** Congress judges (technical and education experts), then NGOs, deaf schools and
  funders.
- **Tone:** warm, dignified, confident, precise. Deaf people are shown as capable experts and
  learners, never as objects of pity. No sad piano, no "silent world" clichés, no "voiceless".
- **Language:** English headlines with a Bangla line under each, for example
  `THE PROBLEM · সমস্যা`. Put `lang="bn"` on Bangla text and use Noto Sans Bengali.
- **Works with the sound off.** This is a video about deaf access, so it must make complete sense
  muted: burned-in captions on every spoken line, all key facts as on-screen text, and no
  information carried by sound alone. Open with a small badge: "Captions on · Designed to be watched
  without sound". Also export a `.srt` and `.vtt` so Google Drive and YouTube can show captions.

## Visual style

Match the structure and polish of the Chasha Bhai promo, in Prism's own colours:

- **Canvas:** 1920×1080, 30 fps, H.264 MP4, AAC audio, 3:00 long (2:55–3:00; never over 3:00).
- **Palette (from `theme.ts`):** deep ink background `#0f1218`, panels `#171b23`, Prism blue
  `#3346d3` and light blue `#8ab4ff` as the main accent, warm orange `#ffb46b` / `#c2410c` as the
  second accent, white text. Use the high-contrast black-and-yellow (`#000` / `#ffe600` /
  `#00e5ff`) only where the demo shows accessibility settings.
- **Background motif:** a subtle, slowly drifting pattern of soft prism light refractions and faint
  hand-shape outlines, at about 6% opacity.
- **Type:** Onest for Latin text and Noto Sans Bengali for Bangla. Small spaced-out orange kicker
  (`DEMO · 01 · LESSONS IN SIGN`), big bold white headline (2 lines maximum), a Bangla line in light
  blue under it, then up to 3 rows, each with a rounded square icon, a bold title and one grey line
  of detail.
- **Section progress bar:** across the top, five labelled segments matching the Congress structure:
  `Problem · Solution · Demo · AI approach · Impact`. The current one fills orange; past ones stay
  light blue. Inside the Demo section, a second row of 4 short bars tracks demo chapters 01–04.
- **Device mockups:** a laptop (Prism is a web app for classrooms) showing real screenshots of
  Prism, with a phone mockup for the mobile layout in one or two shots. Gently float and tilt them;
  zoom into the part being described (an underlined term, the coach message, a bar).
- **Illustrated scenes:** flat, painterly 2D illustration for the opening and closing: a
  Bangladeshi school classroom, a teacher at the board, a deaf girl in school uniform in the second
  row, a hearing parent at home. Draw these yourself as SVG; no stock photos and no AI-generated
  faces of real people.
- **Diagrams:** the system flow and AI approach are clean animated diagrams (boxes, arrows, icons)
  in the same palette, drawn in SVG, not screenshots of code.
- **Captions:** bottom centre, white on a dark rounded pill, 1–2 lines, 40 characters per line
  maximum.
- **Motion:** smooth ease-out, 300–600 ms. Headlines rise and fade in; rows stagger in 150 ms apart.
  Never flash or strobe (some viewers have photosensitive epilepsy).

## How to build it

1. **Screenshots.** Start the app with the `run` skill or the commands in `README.md` (Postgres,
   Redis, API, then the web app on http://localhost:3100). Use the built-in browser to capture
   clean 1920×1080 screenshots, and short screen recordings where motion matters, of each screen in
   the storyboard. If a screen needs data, use the app's own seed data or the Simulate switch on
   Sign words and Fingerspell. Hide any server warning. If a screen can't be captured, rebuild it as
   a faithful HTML mock from the real components and tell me which ones you rebuilt.
2. **Animation.** Use **Remotion** in `video/`: one composition per section, shared components for
   `SectionBar`, `Kicker`, `Headline`, `FeatureRow`, `DeviceMockup`, `FlowDiagram`, `KpiCard`,
   `Caption` and `IllustratedScene`. Keep all copy and timings in one `video/src/script.ts` so text
   can be edited without touching animation code.
3. **Voiceover.** The narration is in `docs/promo-voiceover.txt`. Copy it to `video/voiceover.txt`
   without the `[audio tags]` and `…` pauses; that clean text is also the caption text. I will
   generate the final voice in ElevenLabs as one file per section, `video/audio/vo-1-problem.mp3`
   to `vo-5-impact.mp3`. Until those exist, generate a temporary track per section with macOS `say`
   (voice "Samantha", rate about 160) so timing is real. Each section's audio starts at its section
   time (0:00, 0:30, 1:00, 2:00, 2:30); if a clip is longer than its section, tell me by how much
   instead of overlapping. Ask me before calling any paid TTS service.
4. **Music.** A soft, warm, royalty-free instrumental (light marimba or piano and strings, about
   90 BPM), ducked to -18 dB under the voice. Only use a track whose licence allows this; note
   the source and licence in `video/CREDITS.md`. If you can't find one, render without music and
   tell me.
5. **Captions.** Generate `video/out/Prism_Sign_Promo_Final.srt` and `.vtt` from the same script
   timings (re-time them to the real audio once the ElevenLabs files exist), and burn the same
   captions into the video.
6. **Chapters.** Write these YouTube chapter markers into `video/out/chapters.txt` and embed them
   as MP4 chapter metadata with ffmpeg:
   `0:00 Problem` · `0:30 Solution` · `1:00 Demo` · `2:00 AI approach` · `2:30 Impact and next steps`.
7. **Render** to `video/out/Prism_Sign_Promo_Final.mp4`, plus a 6-frame contact sheet PNG and a
   1280×720 thumbnail (headline "The same lesson, in Bangla Sign Language" over the classroom
   illustration).
8. **Check your work.** Watch it through frame grabs every 5 seconds: no text overflow, nothing
   cut off by the caption pill, Bangla renders correctly (no broken conjuncts such as `জ্বর`,
   `সমস্যা`), each section starts on its required second, every on-screen claim appears in the docs
   or in the sources listed below, and the total length is 2:55–3:00.

Add `video/node_modules` and `video/out` to `.gitignore`. Do not commit rendered video, audio,
API keys or anything from `data/`.

## Storyboard and script (180 s)

Each part lists what is on screen and the voiceover (VO). The VO is also the caption text.

### 0:00–0:30 · PROBLEM · সমস্যা — "This problem matters"

**0:00–0:10 · Mitu's classroom**

- **Screen:** the illustrated classroom in morning light. A teacher writes `সালোকসংশ্লেষণ`
  (photosynthesis) on the board and speaks; soft speech bubbles fill the room. The camera pushes in
  on a deaf girl in the second row; the bubbles reach her as blank, faded shapes. Badge top-left:
  "Captions on · Designed to be watched without sound".
- **VO:** "This is Mitu. Her class is learning photosynthesis. Mitu is deaf, and the lesson isn't
  reaching her."

**0:10–0:30 · Why it matters**

- **Screen:** the classroom dims. Kicker `THE PROBLEM · সমস্যা`. Headline: **"The lesson is spoken.
  Her language is signed."** Three cards, staggered:
  - ⏱ **Too few interpreters** · "Most classes have none; nobody even counts them"
  - 📖 **No signs for subject words** · "Science terms are missing from BdSL"
  - 🔎 **Signs are hard to find** · "No tool puts them where the child is reading"
  - **Who:** a row of chips: "Deaf learners · Hearing parents · Teachers · Sign interpreters".
  - **Urgency** strip, two stats side by side, sources in tiny text:
    - Bangladesh: "Disabling hearing loss: 9.6% of people surveyed (2013 national survey)" ·
      "BdSL official since 2009"
    - World: "About 70 million deaf people use sign languages (World Federation of the Deaf)"
- **VO:** "Bangla Sign Language has been official since two thousand nine, yet most deaf children
  still learn from spoken lessons. There are too few interpreters, and many science words have no
  sign at all. And it isn't only Bangladesh: about seventy million deaf people worldwide use sign
  languages, and most classrooms aren't built for them."

### 0:30–1:00 · SOLUTION · সমাধান — "This is how we solve it"

**0:30–0:42 · Meet Prism Sign**

- **Screen:** the Prism logo resolves from a beam of light split into colours. Headline:
  **"The same lesson, in Bangla Sign Language."** Bangla line: **"একই পাঠ, বাংলা ইশারা ভাষায়।"**
  Laptop mockup flies in showing the Prism Home page.
- **VO:** "Prism Sign brings the same lesson to deaf learners, in Bangla Sign Language, for the
  children, their families, their teachers and interpreters."

**0:42–1:00 · How it works, and what makes it different**

- **Screen:** an animated **system flow** (input → AI → output), three columns:
  - **Input:** lesson text · the teacher's voice · a learner's camera
  - **AI:** Gemini finds key terms and translates · speech recognition makes captions · on-device
    hand and body tracking reads signing
  - **Output:** signed key terms in the lesson · live captions linked to signs · coaching on each
    part of a sign
  - Under the AI column, a human gate drawn in orange: "Signer records → deaf reviewer approves".
  - Then three **"Why it's different"** rows: **Human signs, deaf-approved** · "Not an avatar
    translator" / **Built from written sign descriptions** · "No huge video dataset needed" /
    **Private by design** · "Only hand and body points; no video leaves the device".
- **VO:** "What makes it different? AI does the routine work. Real people do the signing, and deaf
  reviewers approve every sign. Recognition runs in the browser, so no video ever leaves the
  device."

### 1:00–2:00 · DEMO · ডেমো — "This is how it works"

The Demo segment of the top bar fills; a second row of 4 bars tracks chapters 01–04. Laptop
mockup on the left, rows on the right, real screenshots throughout.

**1:00–1:20 · 01 · Lessons in sign · পাঠে ইশারা**

- **Screen:** the Lessons page. Zoom into an underlined key term; tap it; a 2–4 s silent looping
  sign clip (placeholder marked "Sign clip") plays in a card. Then the interpreter window: drag it
  to a corner, resize it, hide it. Captions stay visible. Language switch: Bangla → English → Malay.
  Then the Sign dictionary: type "doctor"; the 3D signer performs it with the orange label
  **"Preview · computer-made from the written description"** always visible.
  Rows: **Tap a word, see the sign** · **An interpreter you can move** · **Previews, clearly
  labelled**.
- **VO:** "In Lessons, every key word with an approved sign is underlined. Tap it, and the sign
  plays. An interpreter window can be moved, resized or hidden, and captions stay on. For about
  three thousand five hundred documented words no one has recorded yet, a 3D signer shows a
  labelled preview."

**1:20–1:38 · 02 · Sign words, with a coach · ইশারা শিখুন**

- **Screen:** a hearing mother at home (illustration) beside her daughter, then Sign words →
  Practise with `জ্বর` (fever). First try: the coach says **"Start at your forehead"**. Second try:
  **"Well done"**. Turn on "Show what Prism sees": the camera image becomes a skeleton of hand and
  body points.
  Rows: **43 everyday words** · "Home, school and health" / **Coached part by part** · "Handshape,
  place, movement, direction" / **Only points, never video**.
- **VO:** "Most deaf children have hearing parents. In Sign words, a parent signs, and Prism checks
  the handshape, place, movement and direction, then says exactly what to fix."

**1:38–1:46 · 03 · Fingerspell · আঙুলে বানান**

- **Screen:** Fingerspell → Practise the letter `ক`. Part-by-part bars fill; the letter types
  itself into a text box.
- **VO:** "Fingerspell teaches the Bangla two-hand alphabet the same way, letter by letter."

**1:46–2:00 · 04 · Live class · লাইভ ক্লাস**

- **Screen:** Live class: the teacher's camera, big live captions, a transcript where key terms link
  to their signs, and a BdSL interpreter joining from another city as a second video tile.
- **VO:** "And in a live class, captions appear as the teacher speaks, key terms link to their
  signs, and an interpreter can join from anywhere."

### 2:00–2:30 · AI APPROACH · এআই পদ্ধতি — "This is real AI thinking"

- **Screen:** a layered diagram that builds up in three rows, each with a model name chip, then a
  data strip and a human-in-the-loop strip:
  1. **Language model** · Google Gemini (`gemini-4-hydrogen`) · "Finds 5–10 key terms per lesson,
     labelled in Bangla, English and Malay; translates lessons. Structured JSON output, cached in
     Redis, rate-limited."
  2. **Speech recognition** · browser speech API · "Teacher's voice → live captions and a
     transcript; signed terms linked automatically."
  3. **Sign recognition** · MediaPipe hand (21 points per hand) and pose tracking, in the browser ·
     "Documented signs compiled into part templates: handshape, place, palm direction, movement. A
     small handshape classifier and time-aligned matching score each part."
  - **Data:** "IsharaKotha corpus: written (HamNoSys) descriptions of about 3,600 signs · consented
    skeleton-only samples improve the models · the largest public word-level BdSL video dataset has
    only 60 words, so we start from descriptions instead."
  - **Personalisation:** "Coaching names the one part to fix · each learner's language, colours,
    text size, word spacing and interpreter window are remembered."
  - **Human in the loop:** "AI suggests → teacher edits → signer records with consent → deaf
    reviewer compares with the documented sign and approves."
- **VO:** "Prism uses three kinds of AI. A Gemini language model finds each lesson's key terms in
  Bangla, English and Malay. Speech recognition turns the teacher's voice into captions. And
  MediaPipe tracks hand and body points in the browser, which Prism compares, part by part, with
  about three thousand six hundred documented signs. So it's built from written sign descriptions,
  not a huge video dataset."

### 2:30–3:00 · IMPACT AND NEXT STEP · প্রভাব ও পরবর্তী ধাপ — "We can build and scale this"

**2:30–2:45 · Impact and KPIs**

- **Screen:** kicker `IMPACT · প্রভাব`. Four KPI cards, each marked **"Pilot target"**:
  - **90%** · "of each pilot lesson's key terms have an approved sign"
  - **Comprehension gain** · "above zero for most pilot learners, sign vs captions only"
  - **4 / 5** · "satisfaction, rated by deaf learners in BdSL"
  - **Time to a new sign** · "days from request to approved clip, measured"
  - Value row: "Interpreters record each sign once; it's reused in every lesson" · "Signers paid for
    every approved sign".
- **VO:** "In our pilot, we'll measure what matters: ninety percent of each lesson's key terms
  signed, a comprehension gain for most children, and a rating of four out of five from deaf
  learners themselves."

**2:45–3:00 · Next steps and close**

- **Screen:** a short roadmap line: "Dec 26 · Congress demo" → "Jan–Jun 2027 · pilot in deaf
  schools" → "Lexicon grown by the deaf community". Then back to the illustrated classroom in full
  warm light: the word on the board is underlined, a small sign card plays beside Mitu's desk, and
  she raises her hand. End card on the ink background:
  - **Prism Sign**
  - **The same lesson, in Bangla Sign Language.** / **একই পাঠ, বাংলা ইশারা ভাষায়।**
  - "International AI Builders Congress 2026 · LearnSphere AI → AI Teacher"
  - Small: "Signs from the IsharaKotha corpus and the community. Every sign approved by deaf
    reviewers."
- **VO:** "From January, we pilot in deaf schools. Prism Sign. The same lesson, in Bangla Sign
  Language. Made with deaf people, for deaf children."

## Honesty rules (do not break these)

- Only claim what the docs say Prism does today. Show the KPIs as **pilot targets**, never as
  results. No accuracy percentages for real signers (we don't have them yet), no user counts, no
  school names, no testimonials, no partner logos.
- Never show the 3D signer without its "Preview" label, and never suggest it translates free text
  into sign or replaces interpreters.
- Any person shown signing must be illustrated or a placeholder marked "Sign clip"; there are no
  real approved clips yet.
- Don't call the system RAG or claim models we don't use. The models are: Gemini (or OpenAI) for
  key terms and translation, the browser's speech recognition for captions, MediaPipe hand and pose
  tracking, a small handshape classifier and template matching for recognition.
- Keep the numbers exactly as given: 43 demo words, about 3,500 unrecorded documented words, about
  3,600 documented signs, 9.6% (2013 survey), BdSL official since 2009, the largest public BdSL
  word dataset 60 words, pilot January to June 2027, pilot targets 90% coverage and 4 of 5
  satisfaction.
- The global figure (about 70 million deaf people use sign languages, World Federation of the
  Deaf) is the only number from outside the docs. Cite it on screen.

## What to give me at the end

- `video/out/Prism_Sign_Promo_Final.mp4`, `.srt`, `.vtt`, `chapters.txt`, the thumbnail and the
  contact sheet.
- A short list of every screenshot you captured versus rebuilt, anything you changed from this
  prompt and why, the measured length of each section, and the exact command to re-render after I
  edit `video/src/script.ts` or drop new ElevenLabs files into `video/audio/`.
