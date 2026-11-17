# Prism architecture

Prism is a Next.js web app talking to a stateless Go API. PostgreSQL stores lessons, logs and study
data. Redis caches AI results, rate-limits AI calls and links live classes across API instances.

```
 Browser (Next.js + MUI)
   │  REST /api/*            WebSocket /ws/class/{code}
   ▼                         ▼
 Go API (any number of instances)
   ├── PostgreSQL  lessons, simplify logs, usage, study
   ├── Redis       AI cache (7 days) · rate limit · live-class pub/sub, roster, video header
   ├── OpenAI      simplify, fact check, quiz, translate, vision, image, speech
   └── Piper       optional offline speech (en, bn)
```

## Backend (`backend/`)

| Package | Role |
| --- | --- |
| `cmd/api` | Loads config, connects Postgres and Redis, runs migrations, seeds the sample lesson, serves HTTP and shuts down cleanly |
| `internal/config` | Environment variables with local defaults (see `backend/.env.example`) |
| `internal/store` | `pgx` pool, embedded SQL migrations under an advisory lock, all queries |
| `internal/cache` | `Remember` JSON cache keyed by SHA-256 of the inputs; per-IP fixed-window rate limit. Redis errors never fail a request |
| `internal/ai` | OpenAI REST client with research-informed prompts |
| `internal/textkit` | Offline English simplifier and Flesch-Kincaid grade, which returns null for non-English |
| `internal/tts` | Runs the Piper CLI when `PIPER_BIN` and a voice model are present |
| `internal/live` | Live-class hub: WebSocket clients ↔ Redis pub/sub |
| `internal/httpapi` | Routes, JSON helpers, CORS (configured origins plus localhost and private LAN), logging, panic recovery |

### REST API

All endpoints are under `/api`. Errors return `{"error": "..."}` with a fitting status: 422 for bad
input, 429 when rate-limited, 503 when AI is not configured, 502 when the AI provider fails.

| Method | Path | Body → response |
| --- | --- | --- |
| GET | `/health` | → `{status, postgres, redis, ai, piper_languages}` |
| GET | `/lessons` · `/lessons/{id}` | → lessons |
| POST | `/lessons` | `{subject, title, body, language}` → lesson |
| POST | `/simplify` | `{text, lang}` → `{original, simplified, source: ai\|rules, grade_before, grade_after, fact_check: {faithful, issues[]}}` |
| POST | `/quiz` | `{text, lang, count}` → `{questions: [{question, options[3], answer}]}` |
| POST | `/translate` | `{text, target_lang}` → `{original, translated, target_lang}` |
| POST | `/describe-image` | `{image_data_url, lang, detail: short\|detailed}` → `{description, ai_generated}` |
| POST | `/illustrate` | `{text}` → `{image_data_url}` |
| GET | `/tts/languages` | → `{piper: [...], openai}` |
| POST | `/tts` | `{text, lang, engine: auto\|piper\|openai}` → audio (WAV from Piper, MP3 from OpenAI) |
| POST | `/usage` | `{feature, action, meta}` → 204 |
| GET | `/usage/summary` | → `{total_events, by_feature}` |
| POST/GET | `/study/participants` | `{code, profile, notes}` |
| POST/GET | `/study/results` | `{participant_id, feature, condition: with_tool\|without_tool, comprehension_score, task_completed, time_seconds, sus_score, satisfaction}` |
| GET | `/study/summary` | → `{participants, by_condition: {with_tool, without_tool}}` |

AI endpoints (`simplify`, `quiz`, `translate`, `describe-image`, `illustrate`, `tts`) are cached in
Redis and limited to `AI_RATE_LIMIT_PER_MIN` requests per IP.

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
| `src/app/*` | Routes: `/`, `/read`, `/simplify`, `/live`, `/study` |
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
| Comprehension questions are the most reliable measure (Säuberli et al., 2024) | Quiz, and comprehension as the main study measure |

## Not built yet

- Recorded lessons cut into one-step chunks (Pimenova et al., 2026)
- A Bangla Sign Language interpreter video slot
- Teacher review and approval of image descriptions (the `lesson_images` table is ready)
- Accounts and authentication
