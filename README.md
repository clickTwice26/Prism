# Prism

**The same lesson, for every learner.** Prism takes the class every student sees and gives each
child the form they can use. Blind learners hear it and get diagrams described. Deaf learners get
live captions and a transcript. Learners with dyslexia read along as each word is highlighted.
Learners with intellectual disability or autism get a fact-checked simple version, a picture and
quick questions.

Built for the International AI Builders Congress 2026, LearnSphere AI → AI Teacher track.

## What it does

| Area | For | Features |
| --- | --- | --- |
| Read & images | Blind, low vision, dyslexia | Read-aloud in Bangla, English and Malay with word highlighting; AI image descriptions at short or detailed length |
| Simplify | Intellectual disability, autism, slow readers | Plain-language rewrite, automatic fact check against the original, side-by-side view for an adult, picture, comprehension quiz |
| Live class | Deaf, hard of hearing, blind | Teacher camera or screen with live captions, translatable transcript, "What's on screen now?" description |
| Study | Teachers, researchers | Same task with and without Prism; compares comprehension, completion, time, SUS and satisfaction |

The research behind these choices is in [docs/architecture.md](docs/architecture.md#research-behind-the-features).

## Stack

- **Frontend:** Next.js 16.4 (App Router, Turbopack), React 19.3, MUI 9.5, Hugeicons, Onest font,
  TypeScript 7
- **Backend:** Go 1.27, PostgreSQL 18, Redis 8
- **AI:** OpenAI for simplification, fact checks, quizzes, translation, vision and speech. Piper is
  optional for offline read-aloud.

## Quick start

Requirements: Docker, Go 1.27+ and Node 22+.

```bash
docker compose up -d postgres redis
```

```bash
cp backend/.env.example backend/.env   # add OPENAI_API_KEY to enable AI features
```

```bash
cd backend && set -a && . ./.env && set +a && go run ./cmd/api
```

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:3100. The API runs on http://localhost:8080; check it at `/api/health`.

Without an OpenAI key the app still runs. Read-aloud uses the browser voice, captions and the study
work, and Simplify falls back to offline English rules.

To run everything in containers instead:

```bash
docker compose --profile app up --build
```

## Repository layout

```
backend/    Go API: REST + live-class WebSocket
frontend/   Next.js web app
docs/       Architecture, API, design guide and research notes
CLAUDE.md   Working rules for AI-assisted development
```

## Checks

```bash
cd backend && go vet ./... && go test ./...
```

```bash
cd frontend && npm run typecheck && npm run lint && npm run build
```
