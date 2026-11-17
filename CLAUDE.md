# Prism — notes for Claude

Prism gives every learner the same class lesson in the form they can use: read aloud, captioned,
described or simplified. It serves blind, deaf, dyslexic, autistic and other learners with special
needs, in Bangla, English and Malay.

The old `InclusionAI-Backend` (FastAPI) and `inclusionAI-frontend` folders next to this repo are
reference only. Do not copy code from them; write fresh code here.

## Layout

- `backend/`: Go API. `cmd/api` is the entrypoint; `internal/` holds `config`, `store` (Postgres +
  embedded SQL migrations), `cache` (Redis cache and rate limit), `ai` (OpenAI REST), `textkit`
  (offline simplifier, reading level), `tts` (Piper), `live` (class relay over Redis pub/sub) and
  `httpapi` (routes, handlers, middleware).
- `frontend/`: Next.js 16 App Router. `src/app` holds routes, `src/features/<area>` the screens,
  `src/components` shared UI, `src/lib` the API client, settings, theme and read-aloud hook.
- `docs/`: architecture and API notes. Keep them in step with the code.

## Commands

```bash
docker compose up -d postgres redis          # Postgres :55432, Redis :56379
cd backend && go run ./cmd/api               # API on :8080
cd backend && go vet ./... && go test ./...
cd frontend && npm run dev                   # web on :3100
cd frontend && npm run typecheck && npm run lint && npm run build
```

## Conventions

- **Go:** standard library `net/http` routing, `pgx/v5`, `go-redis/v9`, `coder/websocket`. Add a
  new SQL file in `internal/store/migrations` for schema changes; never edit an applied migration.
  Run `gofmt` before committing.
- **Design:** follow [docs/design.md](docs/design.md) for fonts, the type scale, the sidebar and
  layout. Use theme typography variants (`display`, `h1`–`h6`, `lead`, `reading`, `liveCaption`,
  …), never one-off `fontSize` values. New pages go in `NAV_SECTIONS` in `Sidebar.tsx`.
- **Frontend:** MUI 9 only, with no Tailwind. MUI 9 removed system props on `Box`, `Stack` and
  `Typography`, and the old `inputProps`/`InputProps`, so use `sx` and `slotProps`. Icons come from
  `@hugeicons/core-free-icons` through `src/components/Icon.tsx`. Fonts are Onest, with Noto Sans
  Bengali as the fallback for Bangla.
- **TypeScript:** `tsc` is TypeScript 7 (`@typescript/native`). The `typescript` package is an alias
  of `@typescript/typescript6`, because typescript-eslint needs the TS 6 API. Do not "fix" this
  alias.
- **Accessibility is the product.** Every control needs a visible label or `aria-label`, a keyboard
  path and a visible focus ring. Announce results through `useAnnounce`. Label AI-written content as
  AI-written.
- **Secrets:** never commit `.env` files or API keys. Only `.env.example` files are tracked.

## Git workflow: commit chunk by chunk

Never commit everything at once. Split work into small commits, each one logical change that
builds on its own:

1. Stage only the files for one concern with `git add <paths>`, never `git add -A` or `git add .`.
2. Commit with a short imperative subject that names the area, such as `backend: add Redis rate
   limit` or `frontend: add read-along highlighting`.
3. Repeat for the next concern. Infrastructure, backend packages, frontend features and docs each
   get their own commits.
4. Run the checks for the part you changed before each commit.

Do not push, force-push or rewrite history unless the user asks.
