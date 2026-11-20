# Prompt: make the Prism Sign promo video with Claude

Copy everything below the line into a new Claude Code session opened in this repository (`Prism/`).
It asks Claude to build and render a 3-minute promo video in the same style as the Chasha Bhai promo:
an illustrated problem scene, then a phone or laptop mockup on the left with numbered feature
chapters on the right, bilingual English and Bangla text, and captions burned in.

---

## Your task

Build and render a **3-minute promo video, `Prism_Sign_Promo_Final.mp4`**, for Prism Sign, our entry
to the International AI Builders Congress 2026 (LearnSphere AI → AI Teacher track, Congress Day
2026-12-26). The video must explain the idea and walk through the whole product so that a judge who
has never seen Prism understands, in 3 minutes, what problem it solves, who it is for, what every
part of the app does, and why people can trust it.

Before you write any code, read these files so every claim in the video matches the real product:
`README.md`, `docs/sign-language-plan.md`, `docs/demo-script.md`, `docs/architecture.md`,
`docs/design.md`, `frontend/src/lib/theme.ts`, `frontend/src/components/Sidebar.tsx` and the pages
under `frontend/src/app/`. If anything in this prompt disagrees with the code or docs, the code and
docs win; tell me what you changed.

Work in a new folder, `video/`, at the repository root. Do not touch `frontend/`, `backend/` or `ml/`.

## The one idea the video must land

> **The same lesson, in Bangla Sign Language.** Deaf children in Bangladesh sit in classes they
> cannot hear. Prism Sign puts real, deaf-approved signs right where they read, and AI does the
> routine work so scarce interpreters reach far more children.

Three messages, repeated visually throughout:

1. **Sign where the child reads.** Key terms are underlined; tap one and the sign plays.
2. **Made by people, checked by deaf reviewers.** AI finds key terms and translates. Humans sign.
   Deaf reviewers approve every sign before a learner sees it.
3. **Private and honest.** No video leaves the device for recognition, only hand and body points.
   Anything computer-made (the 3D signer) is clearly labelled as a preview.

## Audience and tone

- **Primary viewers:** Congress judges (technical and education experts), then NGOs, deaf schools
  and funders.
- **Tone:** warm, dignified, hopeful, precise. Deaf people are shown as capable experts and
  learners, never as objects of pity. No sad piano, no "silent world" clichés, no "voiceless".
- **Language:** English headlines with a Bangla line under each (as in the Chasha Bhai video, for
  example `THE PROBLEM · সমস্যা`). Put `lang="bn"` on Bangla text and use Noto Sans Bengali.
- **Works with the sound off.** This is a video about deaf access, so it must make complete sense
  muted: burned-in captions on every spoken line, all key facts as on-screen text, and no
  information carried by sound alone. Open with a small badge: "Captions on · Designed to be watched
  without sound". Also export a `.srt` and `.vtt` so Google Drive and YouTube can show captions
  and Gemini can summarise the video (Drive could not generate captions for the Chasha Bhai video).

## Visual style

Match the structure and polish of the Chasha Bhai promo, in Prism's own colours:

- **Canvas:** 1920×1080, 30 fps, H.264 MP4, AAC audio, about 3:00 long.
- **Palette (from `theme.ts`):** deep ink background `#0f1218`, panels `#171b23`, Prism blue
  `#3346d3` and light blue `#8ab4ff` as the main accent, warm orange `#ffb46b` / `#c2410c` as the
  second accent, white text. Use the high-contrast black-and-yellow (`#000` / `#ffe600` /
  `#00e5ff`) only in the scene about accessibility settings.
- **Background motif:** a subtle, slowly drifting pattern of soft prism light refractions and faint
  hand-shape outlines, at about 6% opacity, the way the Chasha Bhai video uses faint leaves.
- **Type:** Onest for Latin text and Noto Sans Bengali for Bangla. Small spaced-out orange kicker
  (`01 · LESSONS IN SIGN`), big bold white headline (2 lines maximum), a Bangla line in light blue
  under it, then 3 feature rows, each with a rounded square icon, a bold title and one grey line of
  detail.
- **Chapter progress:** a row of 5 short bars at the top of the feature section; the current one
  fills orange, as in the Chasha Bhai video.
- **Device mockups:** a laptop (Prism is a web app for classrooms) showing real screenshots of
  Prism, with a phone mockup for the mobile layout in one or two scenes. Gently float and tilt
  them; zoom into the part being described (an underlined term, the coach message, a bar).
- **Illustrated scenes:** flat, painterly 2D illustration in the Chasha Bhai style for the opening
  and problem scenes: a Bangladeshi school classroom, a teacher at the board, a deaf girl in school
  uniform in the second row, a hearing parent at home. Draw these yourself as SVG; no stock photos
  and no AI-generated faces of real people.
- **Captions:** bottom centre, white on a dark rounded pill, 1–2 lines, 40 characters per line
  maximum, as in the Chasha Bhai video.
- **Motion:** smooth ease-out, 300–600 ms. Headlines rise and fade in; feature rows stagger in
  150 ms apart. Never flash or strobe (some viewers have photosensitive epilepsy).

## How to build it

1. **Screenshots.** Start the app with the `run` skill or the commands in `README.md` (Postgres,
   Redis, API, then the web app on http://localhost:3100). Use the built-in browser to capture
   clean 1920×1080 screenshots, and short screen recordings where motion matters, of each screen in
   the storyboard. If a screen needs data, use the app's own seed data or the Simulate switch on
   Sign words and Fingerspell. Hide any server warning. If a screen can't be captured, rebuild it as
   a faithful HTML mock from the real components and tell me which ones you rebuilt.
2. **Animation.** Use **Remotion** (React, fits our stack) in `video/`: one composition per scene,
   shared components for `Kicker`, `Headline`, `FeatureRow`, `ChapterBars`, `DeviceMockup`,
   `Caption` and `IllustratedScene`. Keep all copy and timings in one `video/src/script.ts` so text
   can be edited without touching animation code.
3. **Voiceover.** Write the narration below into `video/voiceover.txt`. For the draft, generate a
   temporary track with macOS `say` (voice "Samantha", rate about 170) so timing is real. Leave a
   clear slot to drop in a human recording or a better TTS later; ask me before calling any paid
   TTS service.
4. **Music.** A soft, warm, royalty-free instrumental (light marimba or piano and strings, about
   90 BPM), ducked to -18 dB under the voice. Only use a track whose licence allows this; note
   the source and licence in `video/CREDITS.md`. If you can't find one, render without music and
   tell me.
5. **Captions.** Generate `video/out/Prism_Sign_Promo_Final.srt` and `.vtt` from the same script
   timings, and burn the same captions into the video.
6. **Chapters.** Write YouTube-style chapter markers (`0:00 Opening`, …) into
   `video/out/chapters.txt` and embed them as MP4 chapter metadata with ffmpeg, so Drive and
   YouTube show the Chapters menu.
7. **Render** to `video/out/Prism_Sign_Promo_Final.mp4`, plus a 6-frame contact sheet PNG and a
   1280×720 thumbnail (headline "The same lesson, in Bangla Sign Language" over the classroom
   illustration).
8. **Check your work.** Watch it through frame grabs every 5 seconds: no text overflow, nothing
   cut off by the caption pill, Bangla renders correctly (no broken conjuncts such as `জ্বর`,
   `সমস্যা`), every on-screen claim appears in the docs, and total length is 2:50–3:05.

Add `video/node_modules` and `video/out` to `.gitignore`. Do not commit rendered video, audio,
API keys or anything from `data/`.

## Storyboard and script (3:00)

Each scene lists what is on screen and the voiceover (VO). The VO is also the caption text.

### 0:00–0:12 · Opening

- **Screen:** the illustrated classroom at morning light. A teacher writes `সালোকসংশ্লেষণ`
  (photosynthesis) on the board and speaks; soft speech bubbles fill the room. Camera slowly pushes
  in on a deaf girl in the second row. The bubbles reach her as blank, faded shapes. Badge in the
  top-left: "Captions on · Designed to be watched without sound".
- **VO:** "This is Mitu. Her teacher is explaining photosynthesis. Mitu is deaf, and the lesson
  isn't reaching her."

### 0:12–0:40 · The problem · সমস্যা

- **Screen:** classroom dims into the background. Kicker `THE PROBLEM · সমস্যা`. Headline:
  **"The lesson is spoken. Her language is signed."** Then three cards, staggered, like the
  Chasha Bhai problem cards:
  - ⏱ **Too few interpreters** · "Most classes have none; nobody counts them" (no published count
    exists, so don't invent a number)
  - 📖 **No signs for subject words** · "Science terms are missing from BdSL"
  - 🔎 **Signs are hard to find** · "No tool puts them where the child is reading"
  - Bottom stat line, small: "Disabling hearing loss: 9.6% of people surveyed (2013 national
    survey)" with the source in tiny text.
- **VO:** "Bangla Sign Language has been an official language since 2009. But most deaf children
  still learn from spoken lessons. There are too few interpreters, many science words have no sign
  at all, and the signs that do exist aren't where the child is reading."

### 0:40–0:55 · Meet Prism Sign

- **Screen:** the Prism logo resolves from a beam of light split into colours (a prism). Headline:
  **"The same lesson, in Bangla Sign Language."** Bangla line:
  **"একই পাঠ, বাংলা ইশারা ভাষায়।"** Laptop mockup flies in showing the Prism Home page.
  Three small chips: "Deaf learners" · "Teachers" · "Sign interpreters and deaf reviewers".
- **VO:** "Prism Sign brings the lesson to deaf learners in their own language. AI does the routine
  work. People do the signing. And deaf reviewers approve every sign."

### 0:55–1:20 · 01 · Lessons in sign · পাঠে ইশারা

- **Screen:** chapter bar 1 of 5 fills. Laptop on the left shows the Lessons page. Zoom into an
  underlined key term; tap it; a 2–4 s silent looping sign clip plays in a card. Then the
  interpreter window: drag it to the corner, resize it, hide it. Captions stay visible the whole
  time. Language switch: Bangla → English → Malay.
  Right side rows:
  - **Tap a word, see the sign** · "Key terms underlined, short silent clips"
  - **An interpreter you can move** · "Move, resize or hide the signed lesson"
  - **Captions always on** · "Sign and text together, in Bangla, English or Malay"
- **VO:** "In Lessons, every key word with an approved sign is underlined. Tap it, and the sign
  plays. A recorded interpreter signs the whole lesson in a window Mitu can move, resize or hide,
  and the captions never switch off, because sign and text together help most."

### 1:20–1:30 · Preview signs for the words nobody has recorded

- **Screen:** Sign dictionary, type "doctor". The 3D signer performs it; the **Slow** switch turns
  on. A clear orange label stays on screen: **"Preview · computer-made from the written
  description"**.
- **VO:** "For the 3,500 documented words no one has recorded yet, a 3D signer previews the sign
  from its written description, clearly labelled as a preview until a deaf signer records it."

### 1:30–1:55 · 02 · Sign words, with a coach · ইশারা শিখুন

- **Screen:** chapter bar 2. A hearing mother at home (illustration) holding a laptop beside her
  daughter, then the Sign words → Practise screen with the word `জ্বর` (fever). First try: wrong
  place; the coach says **"Start at your forehead"**. Second try: **"Well done"**. Turn on "Show
  what Prism sees": the camera image becomes a skeleton of hand and body points.
  Right side rows:
  - **43 everyday words** · "Home, school and health"
  - **Coached part by part** · "Handshape, place, movement, direction"
  - **Only points, never video** · "Nothing leaves the device"
- **VO:** "Most deaf children have hearing parents. With Sign words, a parent signs a word and Prism
  checks each part: handshape, where it starts, movement and direction, then says exactly what to
  fix. It only uses hand and body points. No video leaves the device."

### 1:55–2:10 · 03 · Fingerspell · আঙুলে বানান

- **Screen:** chapter bar 3. Fingerspell → Practise the letter `ক`. Part-by-part bars fill as the
  hand shape improves; the letter types itself into a text box. Small row: "Consented samples train
  the recogniser · skeleton points only".
- **VO:** "For names and words without a sign, Fingerspell teaches the Bangla two-hand alphabet,
  letter by letter, with feedback on every part."

### 2:10–2:25 · 04 · Live class · লাইভ ক্লাস

- **Screen:** chapter bar 4. Live class: the teacher's camera or screen, big live captions, a
  transcript on the side where key terms link to their signs, and a BdSL interpreter joining from
  another city as a second video tile.
- **VO:** "In a live class, captions appear as the teacher speaks, key terms link to their signs,
  and a sign interpreter can join from anywhere, so one interpreter can reach many schools."

### 2:25–2:45 · 05 · Made by deaf people · বধির মানুষের হাতে তৈরি

- **Screen:** chapter bar 5. Sign glossary: AI finds a lesson's key terms → a signer records a
  sign with consent → **Deaf review** queue → "Compare with the documented sign" highlights where
  it differs → the reviewer taps Approve (a named deaf reviewer's badge). Then **Missing signs**: a
  list of terms going to the community, with "Already in the dictionary" flags.
  Right side rows:
  - **AI finds the key terms** · "Teachers check and edit"
  - **Deaf reviewers decide** · "Nothing reaches learners unapproved"
  - **Community fills the gaps** · "Missing signs, regional variants, paid signers"
- **VO:** "Behind every sign is a person. AI suggests the key terms, signers record them with
  consent, and a deaf reviewer compares each one with the documented sign and decides. Words with no
  sign go to the deaf community, and signers are paid for every approved sign."

### 2:45–3:00 · Close

- **Screen:** back to the illustrated classroom, now in full warm light. The word on the board is
  underlined; a small sign card plays next to Mitu's desk; she raises her hand to answer. Then an
  end card on the ink background:
  - **Prism Sign**
  - **The same lesson, in Bangla Sign Language.** / **একই পাঠ, বাংলা ইশারা ভাষায়।**
  - "Next: a pilot in deaf schools, January–June 2027"
  - "International AI Builders Congress 2026 · LearnSphere AI → AI Teacher"
  - Small: "Signs from the IsharaKotha corpus and the community. Every sign approved by deaf
    reviewers."
- **VO:** "Prism Sign. The same lesson, in Bangla Sign Language. Made with deaf people, for deaf
  children. Next, a pilot in deaf schools from January."

## Honesty rules (do not break these)

- Only claim what the docs say Prism does today. No accuracy percentages for real signers (we don't
  have them yet), no user counts, no school names, no testimonials, no partner logos.
- Never show the 3D signer without its "Preview" label, and never suggest it translates free text
  into sign or replaces interpreters.
- Any person shown signing must be illustrated or a placeholder marked "Sign clip"; don't make it
  look like real deaf users recorded real approved clips if they haven't.
- Keep the numbers exactly as the docs give them: 43 demo words, about 3,500 unrecorded documented
  words, about 3,600 documented signs, 9.6% (2013 survey), BdSL official since 2009, pilot January
  to June 2027.

## What to give me at the end

- `video/out/Prism_Sign_Promo_Final.mp4`, `.srt`, `.vtt`, `chapters.txt`, the thumbnail and the
  contact sheet.
- A short list of every screenshot you captured versus rebuilt, anything you changed from this
  prompt and why, and the exact command to re-render after I edit `video/src/script.ts` or swap in
  a new voiceover.
