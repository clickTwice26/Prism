# Congress Day demo script

For the International AI Builders Congress, 2026-12-26 (LearnSphere AI → AI Teacher). Judging
gives about 3 minutes per pitch. This script fits that, with a fallback for every live step.

## Before the pitch

- Laptop on mains power, Chrome, camera allowed for `localhost:3100`. A plain wall behind the signer,
  light in front of them, head and hands in view.
- Stack running: Postgres and Redis (`docker compose up -d postgres redis`), the API and the web app.
  The page footer on Home must not show a server warning.
- One approved key-term clip and the interpreter video in the lexicon, so Lessons shows signs.
- Open tabs, in order: Home, Lessons, Sign words (Practise), Fingerspell (Practise), Sign glossary
  (Deaf review), Live class.
- Rehearse each live sign 5 times on the day; if the room's light makes recognition unreliable, use
  the Simulate switch for that step and say so.

## The 3 minutes

| Time | Show | Say |
| --- | --- | --- |
| 0:00 | Home | "Deaf children in Bangladesh sit in classes they cannot hear, and their own language, Bangla Sign Language, is barely in their textbooks. Prism Sign brings the lesson to them in sign, made by people and checked by deaf reviewers." |
| 0:25 | Lessons | Tap an underlined key word; the signed clip plays. Show the interpreter window: move it, resize it. "Every sign here was recorded by a person and approved by a named deaf reviewer." |
| 0:45 | Sign dictionary, type "doctor" | The 3D signer performs it; switch on Slow. "For the 3,500 documented words nobody has recorded yet, a 3D signer shows the sign from its written description, labelled as a preview until a deaf signer records it." |
| 0:55 | Sign words → Practise, word জ্বর | Sign it badly first (wrong place): the coach says "Start at your forehead". Sign it right: "Well done". "Prism checks each part of a sign against its description: handshape, where it starts, movement and direction. That is how a hearing parent learns to sign with their child." |
| 1:35 | Show what Prism sees (switch) | "No video leaves the device. Only the hand and body joints are used." |
| 1:50 | Fingerspell → Practise ক | Part-by-part bars. "For words with no sign yet, the two-hand alphabet." |
| 2:10 | Sign glossary → Deaf review → Compare with the documented sign | "When a signer proposes a sign, Prism compares it with the documented BdSL description and shows the deaf reviewer where it differs. The reviewer decides." |
| 2:30 | Sign glossary → Missing signs | "Terms without a sign go to the community; signs already in the dictionary are flagged so nobody coins a new one." |
| 2:45 | Close | "Recognition built from 3,600 documented signs without a big video dataset, and it gets better with every consented recording. Next: a pilot in two deaf schools from January." |

## What to say if asked

- **Accuracy:** "On synthetic signers it recognises all 43 demo words; we are now measuring it on
  real signers with held-out testing by person, and we report that number, not the synthetic one."
  Bring the latest output of `node scripts/analyze-samples.ts` if real samples exist.
- **Why an avatar at all:** deaf communities distrust avatars that replace interpreters (Coy et al.,
  2024), so Prism uses one only as a labelled preview of documented signs, and human clips replace
  it as they are approved. It never translates free text into sign.
- **Where the signs come from:** the IsharaKotha corpus (HamNoSys descriptions of about 3,600 words),
  checked against the 1994 Bengali Sign Language Dictionary, and new signs from the community.
- **Business:** schools and NGOs pay per seat; government and donors fund rollout; signers are paid
  per approved sign.
- **Privacy:** skeleton points only, consent per clip and per sample, withdraw any time.

## Fallbacks

| If… | Do |
| --- | --- |
| The camera does not start | Use Simulate on Sign words and Fingerspell; say "this is the same recogniser with computer-made hands" |
| Recognition misreads in the room | Turn on "Show what Prism sees"; if hands are mixed up, "Swap hands"; else use Simulate |
| No internet | The app runs locally, but the hand and pose models load from Google's model storage. Open both camera pages once before the pitch so the browser caches them, and bring a phone hotspot |
| The API is down | Restart it; the Home page footer shows the server state |
