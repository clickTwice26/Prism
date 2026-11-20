# Prism Sign

**The same lesson, in Bangla Sign Language.** Prism Sign gives deaf learners in Bangladesh the class
lesson with its key science words signed, captions that stay on, and a sign interpreter they can
move, resize or hide. AI does the routine work: finding each lesson's key terms and translating.
People do the signing, and deaf reviewers approve every sign before learners see it. For the
3,500 documented words that no person has recorded yet, a 3D signer previews the sign from its
written description, clearly labelled as a preview.

Built for the International AI Builders Congress 2026, LearnSphere AI → AI Teacher track. The plan,
research and roadmap are in [docs/sign-language-plan.md](docs/sign-language-plan.md).

## What it does

| Area | For | Features |
| --- | --- | --- |
| Lessons | Deaf and hard-of-hearing learners | The lesson in Bangla, English or Malay. Key terms with an approved sign are underlined; tapping one plays a 2-4 s silent, looping clip. A recorded interpreter can sign the whole lesson in a window learners can move, resize or hide |
| Fingerspell | Deaf learners, families, signers | Spell with the Bangla two-hand alphabet and Prism types it; practise a letter with feedback on each part; record consented samples (skeleton points only) to train the recogniser |
| Sign words | Deaf learners, families, signers | Sign one of 43 everyday, school and health words; Prism recognises it from handshape, place on the body, movement and direction, explains why, and coaches the part to fix |
| Live class | Deaf and hard-of-hearing learners, sign interpreters | Teacher camera or screen with live captions and a translatable transcript whose key terms link to their signs. A Bangla Sign Language interpreter can join from anywhere and sign as a second video |
| Sign glossary | Teachers, sign interpreters, deaf reviewers | Add lessons and find their key terms (AI or by hand), record or upload signs with the signer's consent, a deaf review queue, a missing-sign list for the community, and the lexicon with regional variants |

The research behind these choices is in [docs/architecture.md](docs/architecture.md#research-behind-the-features).

## Stack

- **Frontend:** Next.js 16.4 (App Router, Turbopack), React 19.3, MUI 9.5, Hugeicons, Onest font,
  TypeScript 7
- **Backend:** Go 1.27, PostgreSQL 18, Redis 8
- **AI:** Google Gemini by default (`gemini-4-hydrogen`) for key-term extraction and translation.
  Set `AI_PROVIDER=openai` to use OpenAI instead.
- **Sign videos:** stored on disk (`SIGN_MEDIA_DIR`). An optional IsharaKotha corpus
  (`SIGN_REFERENCE_DIR`) supplies a word list of existing Bangla Sign Language signs.

## Quick start

Requirements: Docker, Go 1.27+ and Node 22+.

```bash
docker compose up -d postgres redis
```

```bash
cp backend/.env.example backend/.env   # add GEMINI_API_KEY to enable AI features
```

```bash
cd backend && set -a && . ./.env && set +a && go run ./cmd/api
```

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:3100. The API runs on http://localhost:8080; check it at `/api/health`.

Without an AI key the app still runs: signs, captions, the interpreter window and deaf review all
work. Teachers add key terms by hand, and lessons and captions stay in their original language.

To run everything in containers instead:

```bash
docker compose --profile app up --build
```

## Repository layout

```
backend/    Go API: REST + live-class WebSocket
frontend/   Next.js web app
ml/         Python tools: train and evaluate sign recognition
docs/       Sign language plan, architecture and API, design guide
CLAUDE.md   Working rules for AI-assisted development
```

## Checks

```bash
cd backend && go vet ./... && go test ./...
```

```bash
cd frontend && npm run typecheck && npm run lint && npm test && npm run build
```

```bash
cd ml && uv run python -m unittest discover -s tests
```
