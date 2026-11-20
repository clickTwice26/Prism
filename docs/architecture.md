# Prism architecture

Prism Sign is a Next.js web app talking to a stateless Go API. PostgreSQL stores lessons, the sign
lexicon and usage events. Sign videos are files on disk. Redis caches translations, rate-limits AI
calls and links live classes across API instances. The plan it implements is
[sign-language-plan.md](sign-language-plan.md).

```
 Browser (Next.js + MUI)
   │  REST /api/*            WebSocket /ws/class/{code}
   ▼                         ▼
 Go API (any number of instances)
   ├── PostgreSQL  lessons, sign terms and labels, lesson key terms, sign videos, usage
   ├── Disk        sign videos (SIGN_MEDIA_DIR)
   ├── Redis       translation cache (7 days) · rate limit · live-class pub/sub, roster, video headers
   └── Gemini      key-term extraction and translation (or OpenAI)
```

## Backend (`backend/`)

| Package | Role |
| --- | --- |
| `cmd/api` | Loads config, connects Postgres and Redis, runs migrations, seeds the sample lesson, serves HTTP and shuts down cleanly |
| `internal/config` | Environment variables with local defaults (see `backend/.env.example`) |
| `internal/store` | `pgx` pool, embedded SQL migrations under an advisory lock, all queries |
| `internal/cache` | `Remember` JSON cache keyed by SHA-256 of the inputs; per-IP fixed-window rate limit. Redis errors never fail a request |
| `internal/ai` | Key-term extraction and translation prompts on a pluggable `Backend`: Google Gemini (`gemini.go`, the default) or OpenAI (`openai.go`), chosen by `AI_PROVIDER` |
| `internal/signref` | Reads an existing Bangla Sign Language corpus (IsharaKotha): its word list, so reviewers see when a term already has a documented sign, and its HamNoSys descriptions, parsed into sign templates for recognition. `cmd/signtemplates` exports the templates and a coverage report |
| `internal/live` | Live-class hub: WebSocket clients ↔ Redis pub/sub, with a second stream for the sign interpreter |
| `internal/httpapi` | Routes, JSON helpers, sign uploads and media, CORS (configured origins plus localhost and private LAN), logging, panic recovery |

Migrations `0001` and `0002` also create tables for features that were removed (simplify logs,
study results, the text review queue and adaptive lessons). Applied migrations are never edited, so
those tables stay but nothing uses them.

### REST API

All endpoints are under `/api`. Errors return `{"error": "..."}` with a fitting status: 422 for bad
input, 429 when rate-limited, 503 when AI is not configured, 502 when the AI provider fails.

| Method | Path | Body → response |
| --- | --- | --- |
| GET | `/health` | → `{status, postgres, redis, ai, ai_provider, sign_reference_words}` |
| GET | `/lessons` · `/lessons/{id}` | → lessons |
| POST | `/lessons` | `{subject, title, body, language}` → lesson |
| POST | `/translate` | `{text, target_lang}` → `{original, translated, target_lang}` |
| POST | `/usage` | `{feature, action, meta}` → 204; anonymous use such as sign taps and the interpreter window |
| GET | `/usage/summary` | → `{total_events, by_feature}` |
| GET | `/sign/lessons/{id}` | → `{terms[], signed, interpreter, pending_interpreter[], ai, reference}`: a lesson's key terms, their approved signs and coverage |
| POST | `/sign/lessons/{id}/terms/extract` | → the same; AI finds 5-10 key terms with labels in en, bn and ms |
| POST | `/sign/lessons/{id}/terms` | `{labels: {en, bn, ms}}` → the same; adds a term by hand (reuses an existing term with the same label) |
| DELETE | `/sign/lessons/{id}/terms/{term}` | → 204 |
| GET | `/sign/lexicon` | → every term with an approved sign, with its clips (regional variants) |
| GET | `/sign/missing` | → lesson terms with no approved sign, the lessons that need them and any `reference` dictionary entries |
| GET | `/sign/reference?q=` | → `{size, matches}` from the reference word list |
| GET | `/sign/sigml?id=` · `?word=` | → a documented sign's raw SiGML (HamNoSys) description, for the 3D preview; 404 if not documented |
| GET | `/sign/templates?section=` · `?words=` · `?all=1` | → documented signs broken into parts (handshape, orientation, location, actions) for recognition; gzip-compressed when accepted. See [sign-recognition-plan.md](sign-recognition-plan.md) |
| PUT | `/sign/videos/{id}/derived` | `{template}` → 204; the sign template the browser wrote down from an approved key-term clip (removed if the clip is rejected or withdrawn). Terms return these as `derived` |
| POST | `/sign/samples` | `{kind: letter\|word, label, signer, dominant, deaf, consent: true, frames: [{t, hands: [{side, points: 21×[x,y,z]}], body?: 33×[x,y,z]}], features, feature_version}` → sample; skeleton points only, never video; the label must be a documented letter or word |
| GET | `/sign/samples?kind=letter[&full=1]` | → samples, with frames and features when `full=1` (for the Python tools) |
| DELETE | `/sign/samples/{id}` | → 204; the signer withdraws a sample |
| POST | `/sign/videos` | multipart `kind=term\|lesson, term_id\|lesson_id, signer, region, consent=yes, video` (WebM or MP4; term clips up to 15 MB) → video, status `pending` |
| GET | `/sign/videos?status=pending\|approved\|rejected` · `/sign/videos/count` | → videos with `term_labels` or `lesson_title` · `{pending}` |
| POST | `/sign/videos/{id}/approve` · `/reject` | `{reviewer, note}` → video; rejecting deletes the file |
| POST | `/sign/videos/{id}/withdraw` | → video; a signer takes a clip back and the file is deleted |
| GET | `/sign/media/{file}` | → the video, with range requests and a one-year immutable cache |

The AI endpoints (`translate`, `sign/lessons/{id}/terms/extract`) are limited to
`AI_RATE_LIMIT_PER_MIN` requests per IP. Translations are cached in Redis.

### Prism Sign

Deaf learners get each lesson's key terms in Bangla Sign Language (BdSL). AI does the routine work;
people sign and deaf reviewers approve.

- **Terms.** A sign belongs to a concept (`sign_terms`) with a label per language
  (`sign_term_labels`, unique per language), so one sign serves the English, Bangla and Malay
  versions of a lesson. `lesson_sign_terms` lists each lesson's key terms; AI suggests them or a
  teacher adds them. When a teacher adds a lesson and AI is on, its key terms are found at once.
- **Videos.** `sign_videos` holds key-term clips (`kind = term`, 2-4 s, silent) and interpreter
  videos for whole lessons (`kind = lesson`). Files are stored under random names in
  `SIGN_MEDIA_DIR` and checked by their first bytes (WebM or MP4 only). Each needs the signer's
  name and consent. Nothing is shown until a named deaf reviewer approves it. Several approved clips
  for one term are regional variants, kept side by side. Rejected and withdrawn clips are deleted.
- **Missing signs.** A lesson term with no approved sign is an open request on the Sign glossary
  page, where interpreters and deaf signers propose signs. When the reference word list
  (`SIGN_REFERENCE_DIR`, the IsharaKotha corpus) already has the word, the request says so, so the
  community's existing sign is recorded instead of a new one being coined.
- **3D sign preview.** The Sign dictionary page (`/dictionary`) and the Practise tab show a 3D
  character signing a documented word from its HamNoSys description. The character is the CWA
  Signing Avatars player (University of East Anglia, CC BY-SA 4.0), loaded from UEA's servers into
  its own frame (`public/avatar.html`) and driven by `postMessage`. Chrome removed built-in XSLT,
  which CWASA needs, so the frame loads the `xslt-polyfill` package first (copied into
  `public/vendor` by `scripts/copy-assets.mjs`). Every preview is labelled as made by software and
  not checked by a deaf reviewer.
- **Learners.** The frontend loads the lexicon once. Lesson text and every live transcript line
  underline terms that have a sign; tapping one plays its looping clip, with a slow mode and the
  signer and reviewer named. English and Malay match whole words with plural endings; Bangla also
  matches with case endings. The interpreter window can be switched on and off, resized and moved
  to any corner. These choices are kept in the learner's settings, and captions always stay on.

### AI providers

`AI_PROVIDER=gemini` (the default) uses Google's **Interactions API** (`POST /v1beta/interactions`,
header `Api-Revision: 2026-05-20`) with `gemini-4-hydrogen` at `thinking_level: low`. Key-term
replies use `response_format` with `mime_type: application/json`. `AI_PROVIDER=openai` uses Chat
Completions instead. Model names can be changed with environment variables.

### Live class protocol (`/ws/class/{code}`)

Class codes match `[A-Za-z0-9-]{1,40}`. JSON text frames:

- **Client → server:** `hello {role: teacher|student|interpreter, name}`. Then teachers send
  `caption {final, text}` and `clear`. Teachers and interpreters send `video_start {mime}` and
  `video_stop`.
- **Server → client:** `joined {room}`, `roster {students, count, interpreter}` (to teachers), and
  the relayed `caption`, `clear`, `video_start {mime, stream}` and `video_stop {stream}`, where
  `stream` is `class` (the teacher) or `sign` (the interpreter).

A Bangla Sign Language **interpreter** can join from anywhere. They receive what students receive,
including the teacher's video with sound, and their silent camera is a second stream that students
see in the interpreter window.

Clients send WebM chunks from `MediaRecorder` as binary frames every 500 ms. The server prefixes
each relayed chunk with one stream byte (`0` class, `1` sign). The first chunk after `video_start`
is the init segment. It is stored in Redis per stream, so a late-joining student can start decoding
mid-class. Students play each stream with Media Source Extensions (`features/live/msePlayer.ts`).

Every message goes through the Redis channel `live:ch:{code}`, so a teacher, interpreter and
students connected to different API instances share one class. Rosters live in
`live:{code}:students`, the interpreter's presence in `live:{code}:interpreter`, and video state in
`live:{code}:video` and `live:{code}:sign`. All expire after 12 hours.

## Python tools (`ml/`)

`uv run python -m prism_ml.train_letters --api http://localhost:8080` trains the learned letter
model from recorded samples, reports held-out accuracy and writes
`frontend/public/models/letters.json`. `prism_ml.train_words` does the same for words (prototype
recordings compared by dynamic time warping) and writes `frontend/public/models/words.json`. Tests:
`uv run python -m unittest discover -s tests`.

## Frontend (`frontend/`)

| Path | Role |
| --- | --- |
| `src/app/*` | Routes: `/`, `/lessons` (lesson text with signs and the recorded interpreter), `/live` (student, teacher and interpreter), `/fingerspell` (spell, practise and record letters with the two-hand alphabet), `/dictionary` (search about 3,500 documented signs; a 3D signer performs each), `/signs` (recognise, practise and record 43 everyday, school and health words), `/sign` (sign glossary: lesson terms, deaf review, missing signs, lexicon) |
| `src/features/*` | One folder per area; screens are client components |
| `src/components` | App shell with a collapsible sidebar (a drawer on mobile), reading-settings drawer, announcer (live region + snackbar), readable text with sign links, sign clip player, 3D sign preview (`SignAvatar`), interpreter window, icon wrapper |
| `src/lib/api.ts` | Typed API client. The API base is `NEXT_PUBLIC_API_URL`, else the page's host on port 8080 |
| `src/lib/settings.tsx` | Per-learner settings in `localStorage`: language, colours (light, dark, high contrast), text size, word spacing, sign glossary, interpreter window (on, size, corner) |
| `src/lib/signs.tsx` | The approved sign lexicon, shared app-wide, and the matcher that finds signed terms in text |
| `src/lib/handsign` | Sign recognition without a browser dependency (tested with `npm test`): hand geometry and handshape scoring (with HamNoSys palm codes read relative to the fingers), body sites, word keyframes and the time-aligned word matcher and segmenter, the letter matcher and stabiliser, the learned-model runners, plain-language descriptions, and synthetic hands and signers |
| `src/lib/handsign/mediapipe.ts` | Browser-only: runs MediaPipe hand and pose tracking on a video frame (live camera or a recorded clip) and assigns each hand to the nearer body wrist |
| `scripts/analyze-samples.ts` | Re-scores recorded samples with the browser's recogniser and reports accuracy and the weakest part per letter or word |
| `src/lib/theme.ts` | MUI theme: type scale, colour modes and a strong focus ring. See [design.md](design.md) |

## Research behind the features

The full list of sources is in [sign-language-plan.md](sign-language-plan.md#sources).

| Finding | Where it shows in Prism |
| --- | --- |
| Captions help everyone, most of all deaf viewers (Gernsbacher, 2015) | Live captions and a saved transcript |
| Captions plus a sign interpreter beat either alone (Debevc et al., 2015) | Captions stay on under the interpreter window and glossary signs |
| Captions suit factual content; sign suits step-by-step content (Almalhy, 2022) | Glossary signs for concepts; the interpreter window for whole lessons |
| A sign interpreter viewers can toggle rated well; the best size and position depend on the content (Boudreault et al., 2024) | The interpreter window can be switched on and off, resized and moved, and remembers the learner's choice |
| Deaf communities distrust signing avatars (Coy et al., 2024); co-designed signs filled BdSL gaps (Hasan et al., 2025) | Human signers first; deaf reviewers approve every clip; the 3D preview is labelled as software and only shows documented descriptions; missing signs go to the community |
| Word spacing helps more than special fonts (Azzarello 2026; Galliussi 2020) | A word-spacing setting, no special font |

## Not built yet

- Sign as an adaptive layer (plan part 4) and the per-child comparison of captions only, captions
  plus glossary, and captions plus interpreter, for the Phase 2 pilot
- A recorded interpreter synced to parts of a lesson; recognising students' signing (a research
  phase, only with deaf partners' consent to the data use)
- Accounts and authentication: the deaf review queue is open to anyone who can reach the API, so add
  teacher and deaf-reviewer sign-in before real classroom use
