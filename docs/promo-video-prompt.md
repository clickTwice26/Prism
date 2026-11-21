# Prompt: make the Prism Sign promo video with Claude

Copy everything below the line into a new Claude Code session opened in this repository (`Prism/`).
It asks Claude to build and render the 3-minute submission video for the International AI Builders
Congress, following the Congress's "Vibe to Production in 180 Seconds" guidance. It tells one
story, Mitu's, with real-looking people and real screenshots of the news reports and research behind
the problem, cut together like a professional documentary-style product film. The ElevenLabs
voiceover is in [promo-voiceover.txt](promo-voiceover.txt); this version keeps it word for word, so
the recorded audio in `video/audio/` still fits.

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

The Remotion project already exists in `video/` (scenes in `video/src/scenes/Scenes.tsx`, the
illustrated people in `video/src/illus/`, UI mocks in `video/src/mocks/`, copy and timings in
`video/src/script.ts`, the ElevenLabs track in `video/audio/`). Update it; don't start over. Replace
the illustrated classroom and people with the real footage and photos described below, add the
report screenshots, and keep the UI demo, diagrams, captions and timings. Do not touch `frontend/`,
`backend/` or `ml/`.

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
- **Real people, cinematic look:** the story scenes are photographs and short video clips of real
  or real-looking people (see "Real people, real reports, one story" below), not illustrations.
  Shoot or choose everything to look like one film: natural window light, warm skin tones, shallow
  depth of field, eye-level or slightly low camera, a consistent soft teal-and-warm grade (lift the
  shadows slightly, keep skin natural), and a very light film grain. Animate stills with slow
  push-ins and parallax (2–4% scale over the shot), never fast zooms. Cut on motion; hold each story
  shot 2–4 s.
- **Report screenshots:** real headlines and key lines from the news reports and research behind
  each claim, shown as clean browser or paper "cards" floating over a blurred background, with the
  key sentence highlighted in orange as the voice reaches it, and the source and date in a small
  line under the card.
- **Lower thirds:** when a character first appears, a thin lower third: name and role in white
  Onest 600, the Bangla line under it, e.g. "Mitu, 11 · Class 6 · deaf from birth" /
  "মিতু, ১১ · ষষ্ঠ শ্রেণি". On dramatised shots add the small corner tag described below.
- **Diagrams:** the system flow and AI approach are clean animated diagrams (boxes, arrows, icons)
  in the same palette, drawn in SVG, not screenshots of code.
- **Captions:** bottom centre, white on a dark rounded pill, 1–2 lines, 40 characters per line
  maximum.
- **Motion:** smooth ease-out, 300–600 ms. Headlines rise and fade in; rows stagger in 150 ms apart.
  Never flash or strobe (some viewers have photosensitive epilepsy).

## Real people, real reports, one story

### The story

One continuous story runs under the narration, so the judges follow a person, not a feature list.
Mitu is a **composite character**: her situation is drawn from the reports below, and the video says
so on screen. The Congress lists "imaginary users" as a mistake, so every part of Mitu's story must
be backed by a real report shown in the same section, and the user definition (who, where, how many)
comes from those reports, not from Mitu.

| Section | Mitu's story beat |
| --- | --- |
| Problem | Morning, a government school classroom in a district town. The teacher explains photosynthesis; the class nods along. Mitu copies the word from the board but her notebook margin is full of question marks. After school she sits on the veranda with her mother, Rahima, who signs only a few home signs. |
| Solution | Evening. Rahima opens Prism on the family laptop (or a phone); Mitu leans in. The first real smile. |
| Demo | The screen is the hero: real Prism screens, with short cutaways to Mitu tapping a word, Rahima practising `জ্বর` with her, and the interpreter, Nusrat, recording a sign in a small studio. |
| AI approach | Cutaways to Rafiq, a deaf reviewer, comparing a recorded sign with the documented one and approving it. |
| Impact | A few weeks later: the same classroom, the word on the board is underlined on Mitu's tablet, she raises her hand to answer. Final shot: Mitu and Rahima signing together, laughing, at home. |

### Characters (keep them identical in every shot)

| Character | Who | Look |
| --- | --- | --- |
| **Mitu**, 11 | Class 6, deaf from birth, uses BdSL, curious and quick | Bangladeshi girl, navy-and-white government-school uniform with a white belt, two braids with white ribbons, small black hair clip, canvas school bag |
| **Rahima**, 36 | Mitu's mother, hearing, learning to sign | Bangladeshi woman, cotton saree in muted green with a simple border, hair in a low bun, a thin gold nose pin |
| **Mr Karim**, 45 | Science teacher, kind but rushed | White short-sleeved shirt, grey trousers, chalk on his fingers, reading glasses in his pocket |
| **Nusrat**, 30 | BdSL interpreter | Plain dark top against a plain mid-grey background (the interpreter convention), hair tied back, ring light reflection in her eyes |
| **Rafiq**, 45 | Deaf reviewer, community leader | Light blue panjabi, neat beard, laptop and notebook, confident |

Settings must be true to Bangladesh: a green chalkboard, wooden double benches, ceiling fans,
barred windows with afternoon light, a whitewashed wall with a small Bangla poster; a tin-roofed or
small concrete home with a veranda, a plastic chair, a steel glass of water. No poverty clichés, no
pity framing: people are shown as capable, warm and active.

### Where the people come from, best first

Use the best source available for each shot, and record which one in `video/CREDITS.md`.

1. **Our own footage with real people (best).** Ask me before planning this. Cast through a
   Bangladeshi deaf organisation, pay everyone, and ideally cast deaf actors as Mitu and Rafiq.
   Get written consent from every adult and from a parent or guardian for every child, covering use
   in this video online. Write a shot list for this to `video/people/shot-list.md` (shot, framing,
   lens, light, action, duration) so we can film it in one afternoon with a phone on a tripod.
   **Any shot that shows signing must be real signing by a real BdSL signer**, never generated.
2. **Licensed stock photos and video.** Search Pexels, Unsplash and Pixabay (free licences allow
   commercial use without attribution, but credit them anyway) for Bangladeshi or South Asian
   classrooms, schools, children, mothers at home, laptops. Only use a file whose licence page you
   have checked; save the URL, author and licence in `video/CREDITS.md`. Stock people did not agree
   to be shown as deaf: show them only in general scenes (a classroom, a teacher), never as Mitu or
   another named character, unless the licence allows sensitive use and the shot carries a small
   "Posed by models" tag.
3. **AI-generated, photorealistic characters (for named characters when we can't film).** You
   can't generate photoreal images yourself, so write `video/people/prompts.md`: one prompt per
   shot for an image model (e.g. Google Imagen, Midjourney, or ChatGPT images) and an image-to-video
   prompt for 3–5 s of subtle motion (e.g. Veo, Kling or Runway). Start with one character sheet per
   person (front, three-quarter, profile, neutral background) and reuse it as the reference image
   for every shot so faces stay consistent. Every prompt: photorealistic, documentary photography,
   35 mm or 50 mm lens, natural light, the character's exact look from the table, the setting
   details above, 16:9, no text, no logos, no watermarks. I'll run the prompts and drop the files
   into `video/people/`; until then, use clearly marked grey placeholders with the shot name so the
   cut still plays. Rules for generated shots:
   - **Never generate signing.** Image and video models get handshapes wrong and deaf viewers will
     see it at once. In generated shots, hands are at rest, holding a pen, a cup or a laptop, or out
     of frame. Real signing only comes from our own footage or the app's own sign clips.
   - No talking or lip-sync; people react, look, smile, point at a screen.
   - Reject and regenerate any image with extra or melted fingers, garbled Bangla text, wrong
     uniforms or a face that drifts from the character sheet.
   - Every generated shot carries a small, readable corner tag: "Dramatisation · AI-generated".

The first story shot also carries a lower-left line for 3 s: "Mitu is a composite character based on
the reports in this film."

### Report screenshots (proof the problem is real)

Use the built-in browser to open each source and screenshot its real headline and the sentence that
supports our claim. Never retype, edit or invent a headline or quote; if a page won't open or doesn't
say what we claim, drop it and tell me. Save the files to `video/public/reports/` with a
`sources.md` listing title, publisher, date and URL.

| Claim in the video | Source to capture (from `docs/sign-language-plan.md`) |
| --- | --- |
| 9.6% disabling hearing loss; BdSL as a first language by law | The Business Standard, "When silence has language" (tbsnews.net) |
| BdSL official since 2009; deaf adults ask for education in BdSL | Khan, 2026, FASAL proceedings (reed.edu PDF): title page plus the highlighted sentence |
| Deaf people's wellbeing and BdSL access | Monash University news article on BdSL and mental wellbeing |
| Largest public BdSL word dataset: 60 words | Rubaiyeat et al., 2025: paper title and abstract line |
| Captions plus sign raise comprehension | Debevc et al., 2015: title and result line |
| Deaf communities distrust avatar translators | Coy et al., 2024: title and finding |
| About 70 million deaf people use sign languages | World Federation of the Deaf website |

You may add one or two more reports only if they are from a reputable publisher, you read the page,
and the claim is cited on screen. Show a card for about 2–3 s each, at most two at once, with the
publisher's name and date always readable. Blur nothing that changes the meaning; crop out ads and
cookie banners.

## How to build it

1. **Screenshots.** Start the app with the `run` skill or the commands in `README.md` (Postgres,
   Redis, API, then the web app on http://localhost:3100). Use the built-in browser to capture
   clean 1920×1080 screenshots, and short screen recordings where motion matters, of each screen in
   the storyboard. If a screen needs data, use the app's own seed data or the Simulate switch on
   Sign words and Fingerspell. Hide any server warning. If a screen can't be captured, rebuild it as
   a faithful HTML mock from the real components and tell me which ones you rebuilt.
2. **People and reports.** Capture the report screenshots, then write `video/people/shot-list.md`
   and `video/people/prompts.md`, find any stock you use, and build a `StoryShot` component (photo or
   clip, slow push-in, grade, grain, optional corner tag and lower third) and a `ReportCard`
   component (screenshot card, orange highlight, source line). Stop and show me the shot list,
   prompts and report screenshots before re-rendering, so I can film or generate the people.
3. **Animation.** Use **Remotion** in `video/`: one composition per section, shared components for
   `SectionBar`, `Kicker`, `Headline`, `FeatureRow`, `DeviceMockup`, `FlowDiagram`, `KpiCard`,
   `Caption`, `StoryShot` and `ReportCard`. Keep all copy and timings in one `video/src/script.ts` so text
   can be edited without touching animation code.
4. **Voiceover.** The narration is in `docs/promo-voiceover.txt`. Copy it to `video/voiceover.txt`
   without the `[audio tags]` and `…` pauses; that clean text is also the caption text. I will
   generate the final voice in ElevenLabs as one file per section, `video/audio/vo-1-problem.mp3`
   to `vo-5-impact.mp3`. Until those exist, generate a temporary track per section with macOS `say`
   (voice "Samantha", rate about 160) so timing is real. Each section's audio starts at its section
   time (0:00, 0:30, 1:00, 2:00, 2:30); if a clip is longer than its section, tell me by how much
   instead of overlapping. Ask me before calling any paid TTS service.
5. **Music.** A soft, warm, royalty-free instrumental (light marimba or piano and strings, about
   90 BPM), ducked to -18 dB under the voice. Only use a track whose licence allows this; note
   the source and licence in `video/CREDITS.md`. If you can't find one, render without music and
   tell me.
6. **Captions.** Generate `video/out/Prism_Sign_Promo_Final.srt` and `.vtt` from the same script
   timings (re-time them to the real audio once the ElevenLabs files exist), and burn the same
   captions into the video.
7. **Chapters.** Write these YouTube chapter markers into `video/out/chapters.txt` and embed them
   as MP4 chapter metadata with ffmpeg:
   `0:00 Problem` · `0:30 Solution` · `1:00 Demo` · `2:00 AI approach` · `2:30 Impact and next steps`.
8. **Render** to `video/out/Prism_Sign_Promo_Final.mp4`, plus a 6-frame contact sheet PNG and a
   1280×720 thumbnail (headline "The same lesson, in Bangla Sign Language" over the best
   shot of Mitu and Rahima at the laptop).
9. **Check your work.** Watch it through frame grabs every 5 seconds: no text overflow, nothing
   cut off by the caption pill, Bangla renders correctly (no broken conjuncts such as `জ্বর`,
   `সমস্যা`), each section starts on its required second, every on-screen claim appears in the docs
   or in the sources listed below, the characters look the same in every shot, no generated shot
   shows signing hands or warped fingers, every dramatised shot carries its tag, every report card
   shows its source, and the total length is 2:55–3:00.

Add `video/node_modules` and `video/out` to `.gitignore`. Do not commit rendered video, audio,
API keys or anything from `data/`.

## Storyboard and script (180 s)

Each part lists what is on screen and the voiceover (VO). The VO is also the caption text.

### 0:00–0:30 · PROBLEM · সমস্যা — "This problem matters"

**0:00–0:10 · Mitu's classroom**

- **Screen:** cold open, real classroom, morning light through barred windows, fans turning.
  (1) Wide: Mr Karim writes `সালোকসংশ্লেষণ` (photosynthesis) on the green board, 30 children on
  wooden benches. (2) Close-up: his mouth moving, chalk dust in the light. (3) Slow push-in on Mitu
  in the second row, her face attentive but lost; lower third "Mitu, 11 · Class 6 · deaf from
  birth". (4) Insert: her notebook, the word copied neatly, a row of question marks in the margin.
  Under the shots, the room's sound drops away to near silence as we reach Mitu (captions stay on).
  Badge top-left: "Captions on · Designed to be watched without sound". Composite-character line
  lower-left for 3 s.
- **VO:** "This is Mitu. Her class is learning photosynthesis. Mitu is deaf, and the lesson isn't
  reaching her."

**0:10–0:30 · Why it matters**

- **Screen:** the classroom shot darkens and blurs behind the graphics. As the VO gives each fact,
  its **report card** slides in over the shot: The Business Standard ("When silence has language",
  the 9.6% line highlighted), Khan 2026 (the "official since 2009" and "not just oralist methods"
  lines), then the World Federation of the Deaf page (70 million). Between cards, a 2 s cutaway:
  Mitu on the veranda after school while Rahima talks to her and Mitu can't follow. Then kicker
  `THE PROBLEM · সমস্যা`. Headline: **"The lesson is spoken.
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
  Story cutaways: evening at home, Rahima opens the laptop on the table, Mitu leans in, the
  screen's light on her face; the laptop mockup with the real Prism Home page takes over the frame.
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

- **Screen:** a 2 s cutaway of Rahima and Mitu side by side at the laptop, Rahima concentrating,
  Mitu watching her hands with a grin (real footage only if Rahima is signing; in a generated shot,
  Rahima's hands are on the table and we cut to the app before she signs), then Sign words →
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
  to their signs, and a BdSL interpreter joining from another city as a second video tile. Cutaway:
  Nusrat in her small studio, lower third "Nusrat · BdSL interpreter"; the tile shows real signing
  only if we filmed a real signer, otherwise a placeholder marked "Sign clip".
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
  - Story cutaway over the human-in-the-loop strip: Rafiq at his laptop with the Deaf review screen,
    lower third "Rafiq · deaf reviewer", he nods and clicks Approve. Report card beside the data
    strip: Rubaiyeat et al., 2025 (the 60-word dataset line).
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
  schools" → "Lexicon grown by the deaf community". Then the story pays off, in full warm light:
  (1) the same classroom, weeks later; on Mitu's tablet `সালোকসংশ্লেষণ` is underlined and a sign card
  plays; (2) Mitu raises her hand, Mr Karim turns and smiles; (3) home at dusk, Mitu and Rahima
  together on the veranda, laughing. Slow fade to the end card. End card on the ink background:
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
- Any signing shown must be real signing by a real BdSL signer we filmed with consent, or a
  placeholder marked "Sign clip"; there are no real approved clips in Prism yet, so never label
  footage as an approved Prism sign. Never generate signing with AI.
- Mitu, Rahima, Mr Karim, Nusrat and Rafiq are characters. Say Mitu is a composite on screen, tag
  every AI-generated shot "Dramatisation · AI-generated", and tag stock people shown in a sensitive
  role "Posed by models". Never present a character as a real Prism user, a real school or a
  testimonial, and never put words in a real person's mouth.
- Never use a photo of a real, identifiable child or adult without their written consent (a
  parent's for a child), or a stock file whose licence you haven't checked.
- Report screenshots must be real, unedited and cited with publisher and date.
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
- `video/people/shot-list.md`, `video/people/prompts.md`, `video/public/reports/` with
  `sources.md`, and `video/CREDITS.md` listing every photo, clip and report with its source and
  licence, and which shots are filmed, stock, generated or still placeholders.
- A short list of every screenshot you captured versus rebuilt, anything you changed from this
  prompt and why, the measured length of each section, and the exact command to re-render after I
  edit `video/src/script.ts` or drop new ElevenLabs files into `video/audio/`.
