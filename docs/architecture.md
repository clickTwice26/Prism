# Prism architecture

Prism is a Next.js web app talking to a stateless Go API. PostgreSQL stores lessons, logs and study
data. Redis caches AI results, rate-limits AI calls and links live classes across API instances.

```
 Browser (Next.js + MUI)
   │  REST /api/*            WebSocket /ws/class/{code}
   ▼                         ▼
 Go API (any number of instances)
   ├── PostgreSQL  lessons, verified layers, review queue, learners, chunks, attempts, study
   ├── Redis       AI cache (7 days) · rate limit · live-class pub/sub, roster, video header
   ├── Gemini      simplify, fact check, quiz, translate, vision, image, speech (or OpenAI)
   └── Piper       optional offline speech (en, bn)
```

## Backend (`backend/`)

| Package | Role |
| --- | --- |
| `cmd/api` | Loads config, connects Postgres and Redis, runs migrations, seeds the sample lesson, serves HTTP and shuts down cleanly |
| `internal/config` | Environment variables with local defaults (see `backend/.env.example`) |
| `internal/store` | `pgx` pool, embedded SQL migrations under an advisory lock, all queries |
| `internal/cache` | `Remember` JSON cache keyed by SHA-256 of the inputs; per-IP fixed-window rate limit. Redis errors never fail a request |
| `internal/ai` | Research-informed prompts (`ai.go`) on a pluggable `Backend`: Google Gemini (`gemini.go`, the default) or OpenAI (`openai.go`), chosen by `AI_PROVIDER` |
| `internal/gate` | **Fidelity gate (N2).** Checks every simplification and image description before a learner sees it; see below |
| `internal/adapt` | **Adaptive lessons (N1).** Chooses each learner's support mix from their own answers; see below |
| `internal/textkit` | Offline English simplifier, Flesch-Kincaid grade (null for non-English) and lesson chunking (handles the Bangla "।") |
| `internal/tts` | Runs the Piper CLI when `PIPER_BIN` and a voice model are present |
| `internal/live` | Live-class hub: WebSocket clients ↔ Redis pub/sub |
| `internal/httpapi` | Routes, JSON helpers, CORS (configured origins plus localhost and private LAN), logging, panic recovery |

### REST API

All endpoints are under `/api`. Errors return `{"error": "..."}` with a fitting status: 422 for bad
input, 429 when rate-limited, 503 when AI is not configured, 502 when the AI provider fails.

| Method | Path | Body → response |
| --- | --- | --- |
| GET | `/health` | → `{status, postgres, redis, ai, ai_provider, piper_languages}` |
| GET | `/lessons` · `/lessons/{id}` | → lessons |
| POST | `/lessons` | `{subject, title, body, language}` → lesson |
| POST | `/simplify` | `{text, lang}` → `{original, simplified, verification, repaired, review_id?, grade_before, grade_after}` |
| POST | `/quiz` | `{text, lang, count}` → `{questions: [{question, options[3], answer}]}` |
| POST | `/translate` | `{text, target_lang}` → `{original, translated, target_lang}` |
| POST | `/describe-image` | `{image_data_url, lang, detail: short\|detailed}` → `{description, verification, disputed, review_id?}` |
| POST | `/illustrate` | `{text}` → `{image_data_url}` |
| GET | `/tts/languages` | → `{piper: [...], ai, ai_provider}` |
| POST | `/tts` | `{text, lang, engine: auto\|piper\|ai}` → audio (WAV from Piper or Gemini, MP3 from OpenAI) |
| POST | `/usage` | `{feature, action, meta}` → 204 |
| GET | `/usage/summary` | → `{total_events, by_feature}` |
| POST/GET | `/study/participants` | `{code, profile, notes}` |
| POST/GET | `/study/results` | `{participant_id, feature, condition: with_tool\|without_tool, comprehension_score, task_completed, time_seconds, sus_score, satisfaction}` |
| GET | `/study/summary` | → `{participants, by_condition: {with_tool, without_tool}}` |
| GET | `/review?status=pending\|approved\|rejected` | → review items |
| GET | `/review/count` | → `{pending}` |
| POST | `/review/{id}/approve` | `{output}` → item; the output becomes the teacher-verified layer |
| POST | `/review/{id}/reject` | → item; learners keep the safe version and the next request regenerates |
| POST/GET | `/learners` | `{code, profile, lang}`; profiles: blind, low_vision, deaf, hard_of_hearing, dyslexia, autism, intellectual_disability, adhd, none |
| GET | `/learners/{id}/insights` | → `{learner, answered, default_mix, best_mix, confident, differs_from_default, arms[]}` |
| POST | `/learn/next` | `{learner_id, lesson_id, chunk}` → `{attempt_id, chunk, total_chunks, mix, mix_key, reason, text, verification, question: {question, options}}` |
| POST | `/learn/answer` | `{attempt_id, choice}` → `{correct, answer, answer_text, done}` |

AI endpoints (`simplify`, `quiz`, `translate`, `describe-image`, `illustrate`, `tts`, `learn/next`)
are limited to `AI_RATE_LIMIT_PER_MIN` requests per IP. Simplifications and descriptions are stored
as verified layers in Postgres. Quiz, translation and illustration results are cached in Redis.

`verification` is one of `auto_verified` (passed the automatic checks), `teacher_verified`,
`pending_review` (a teacher must decide; the learner gets the safe version), `rules` (offline rules,
no AI) or `original` (an adaptive chunk shown without simplification).

### Fidelity gate (N2)

No AI-written fact reaches a learner unchecked (`internal/gate`).

- **Simplify.** The rewrite is fact-checked against the original. If the check fails, the rewrite is
  repeated once with the problems named. If it fails again, the item joins the review queue and the
  learner sees the **original** text until a teacher decides.
- **Describe.** The image is described 3 times in one request (`n = 3`), and a consensus step keeps
  only the details all three agree on. Disputed details go to the review queue. The learner hears
  only the agreed description, and the screen says some details are being checked.
- **Reuse.** Outputs that pass, automatically or by teacher approval, are stored in
  `verified_layers` and served to every learner without new AI calls. A teacher approval always
  overrides an automatic one. While an item is pending, requests return the safe version without
  calling the AI.

### Adaptive lessons (N1)

Each learner's supports are chosen from their own comprehension, not fixed by a profile
(`internal/adapt`).

- A lesson is cut into chunks of one or two sentences (up to about 40 words), translated into the
  learner's language when needed. Each chunk gets one multiple-choice question. Chunks are stored in
  `lesson_chunks` and reused.
- A **mix** combines simple text (via the gate), read-aloud and a picture. The profile sets the
  starting mix: for example, read-aloud for dyslexia or blindness, and simple text + read-aloud +
  picture for intellectual disability. Supports a learner cannot perceive are never offered:
  pictures for blind learners, read-aloud for deaf learners.
- Candidates are the starting mix, the mixes one change away, and any mix already tried. After each
  answer, Thompson sampling over a Beta posterior per mix (the starting mix gets a Beta(2,1) head
  start) picks the next mix, so mixes that led to correct answers win while nearby ones are still
  tried. Every pick returns its reason in plain words.
- Insights claim a best mix only after it has been tried at least 3 times. `differs_from_default`
  flags learners whose best mix is not the one their profile suggests: the "layer fit" measure in the
  validation plan.

### AI providers

`AI_PROVIDER=gemini` (the default) uses Google's **Interactions API** (`POST /v1beta/interactions`,
header `Api-Revision: 2026-05-20`), which Google recommends over the legacy `generateContent`.

| Use | Default Gemini model | Notes |
| --- | --- | --- |
| Text and vision | `gemini-4-hydrogen` | `thinking_level: low` for speed and cost; JSON replies use `response_format` with `mime_type: application/json`; images are sent inline as base64 |
| Pictures | `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite) | 1:1, 1K, PNG |
| Speech | `gemini-3.8-flash-lite-tts`, voice `Kore` | Returns WAV (24 kHz mono); raw PCM is wrapped as WAV; supports Bangla and Malay |

The fidelity gate's three image descriptions are three parallel calls, which works the same on every
provider. Every model name can be changed with an environment variable (`backend/.env.example`).
`AI_PROVIDER=openai` switches back to the OpenAI Chat Completions, Images and Audio APIs.

### Live class protocol (`/ws/class/{code}`)

Class codes match `[A-Za-z0-9-]{1,40}`. JSON text frames:

- **Client → server:** `hello {role: teacher|student, name}`, then, from teachers only,
  `caption {final, text}`, `clear`, `video_start {mime}` and `video_stop`.
- **Server → client:** `joined {room}`, `roster {students, count}` (to teachers), and the relayed
  `caption`, `clear`, `video_start` and `video_stop`.

Binary frames are the teacher's WebM chunks from `MediaRecorder`, sent every 500 ms. The first
chunk after `video_start` is the init segment. It is stored in Redis so a late-joining student can
start decoding mid-class. Students play the stream with Media Source Extensions.

Every message goes through the Redis channel `live:ch:{code}`, so a teacher and students connected
to different API instances share one class. Rosters live in `live:{code}:students` and video state
in `live:{code}:video`; both expire after 12 hours.

## Frontend (`frontend/`)

| Path | Role |
| --- | --- |
| `src/app/*` | Routes: `/`, `/learn` (adaptive lesson), `/read`, `/simplify`, `/live`, `/review` (teacher queue), `/study` |
| `src/features/*` | One folder per area; screens are client components |
| `src/components` | App shell with a collapsible sidebar (a drawer on mobile), reading-settings drawer, announcer (live region + snackbar), readable text, icon wrapper |
| `src/lib/api.ts` | Typed API client. The API base is `NEXT_PUBLIC_API_URL`, else the page's host on port 8080 |
| `src/lib/settings.tsx` | Per-learner settings in `localStorage`: language, colours (light, dark, high contrast), text size, word spacing, read-along, speech rate |
| `src/lib/useReadAloud.ts` | Read-along uses the browser voice with word-boundary highlighting; otherwise server speech, falling back to the browser |
| `src/lib/theme.ts` | MUI theme: type scale, colour modes and a strong focus ring. See [design.md](design.md) |

## Research behind the features

The full evaluation, with 23 papers, is in the shared doc *InclusionAI — Research Evaluation for
Inclusive Education*.

| Finding | Where it shows in Prism |
| --- | --- |
| UDL (one lesson in several forms) gives moderate gains, g = 0.43 (King-Sears et al., 2022) | The whole product: one lesson, many forms |
| Text-to-speech improves comprehension, g = 0.35 (Wood et al., 2017) | Read-aloud with read-along highlighting |
| Dyslexia fonts have no effect; word spacing must widen with letter spacing (Azzarello 2026; Galliussi 2020) | No dyslexia font; a word-spacing setting |
| Captions help everyone, most of all deaf viewers (Gernsbacher, 2015) | Live captions and a saved transcript |
| Customisable descriptions improve video understanding for blind users (Natalie et al., 2024) | Short or detailed descriptions; "What's on screen now?" |
| AI descriptions can be fluent but invented (Aljedaani et al., 2026) | Prompts say "unclear" rather than guess; output labelled as AI |
| Automatic simplification adds or drops facts (Devaraj et al., 2022) | Fact check on every AI simplification; offline rules never swap domain terms |
| Easy-read text helps when an adult explains it (Buell et al., 2019) | Side-by-side original for a parent or teacher |
| Comprehension questions are the most reliable measure (Säuberli et al., 2024) | Quiz, chunk questions, and comprehension as the main study measure |
| Accommodation effects differ by student (Sireci et al., 2005); stacking formats can hurt (Albers et al., 2023) | Adaptive lessons choose each learner's mix from their answers (N1) |
| Showing disagreement between AI descriptions exposes errors (Chen et al., 2025) | Three descriptions per image; disputed details go to a teacher (N2) |

## Not built yet

- Recorded *video* lessons cut into one-step chunks (text lessons are already chunked)
- A Bangla readability score and easy-word list for Bangla simplification (N3)
- Spoken prompts for low-literacy parents (N4) and lesson keyword sign clips (N5)
- Accounts and authentication: the review queue and learner insights are open to anyone who can
  reach the API, so add teacher sign-in before real classroom use
