# Prism design guide: type and layout

Prism is used by children with low vision, dyslexia and intellectual disability. Type is the main
way they reach a lesson, so these rules lean towards larger text, generous line height and few
variations. The source of truth is `frontend/src/lib/theme.ts`; this page explains how to use it.

## Fonts

| Role | Font | Why |
| --- | --- | --- |
| All Latin and Cyrillic text | **Onest** (variable, `--font-onest`) | Open, round letterforms with distinct `I l 1` and `O 0`; reads well at small sizes |
| Bangla | **Noto Sans Bengali** (`--font-bengali`) | Onest has no Bengali glyphs; Noto matches its weight and x-height |
| Fallback | `system-ui, -apple-system, 'Segoe UI', sans-serif` | If web fonts fail to load |

Both fonts load through `next/font/google` in `src/app/layout.tsx`, which self-hosts them, so
there are no external requests and no layout shift. The theme's font stack lists Onest first and
Noto Sans Bengali second, so the browser switches to Noto for each Bangla character automatically.

Do not add other fonts. In particular, do not add a "dyslexia font": a meta-analysis of 15 studies
found no effect on reading speed or accuracy (Azzarello et al., 2026). Word spacing helps more, and
it is a learner setting.

## Type scale

Every size is in `rem`. The learner's **Text size** setting changes the root font size (90–180%), so
all text, and spacing set in `rem`, grows together, the same way browser zoom works. Never set font
sizes in `px`.

| Variant | Size (at 100%) | Weight | Line height | Use for |
| --- | --- | --- | --- | --- |
| `display` | 36–56px, fluid | 700 | 1.1 | Home page headline only |
| `h1` | 30–40px, fluid | 700 | 1.15 | Page title, one per page (`PageHeader`) |
| `h2` | 28px | 700 | 1.2 | Rare: large section on a long page |
| `h3` | 24px | 650 | 1.25 | Rare: grouped sections |
| `h4` | 20px | 650 | 1.3 | **Panel and card titles** |
| `h5` | 18px | 600 | 1.35 | Sub-sections inside a panel, quiz questions |
| `h6` | 16px | 600 | 1.4 | Small labels that need weight |
| `lead` | 19px | 400 | 1.6 | The intro sentence under a page title |
| `reading` | 20px | 400 | 1.8 | **Lesson text learners read**, simplified text, image descriptions |
| `liveCaption` | 26px | 500 | 1.45 | Captions over live video |
| `subtitle1` | 16px | 600 | 1.5 | Sidebar item labels |
| `body1` | 16px | 400 | 1.6 | Default UI text |
| `body2` | 14px | 400 | 1.55 | Secondary UI text, table cells |
| `button` | 15px | 600 | 1.5 | Buttons, sentence case |
| `caption` | 13px | 400 | 1.45 | Hints, timestamps, AI-written notes |
| `overline` | 12px | 600 | 1.5, 0.08em tracking | Sidebar section labels (LEARN, TEACH) |

### Rules

1. **Use a variant, never a one-off size.** Write `<Typography variant="h4" component="h2">` or
   `sx={{ typography: "reading" }}`. If no variant fits, add one to the theme and to this table.
2. **Separate look from meaning.** `variant` sets the look and `component` sets the HTML heading
   level. Heading levels must follow the page outline (h1 → h2 → h3) so screen readers can jump
   through it. For example, a panel title looks like `h4` but is an `<h2>`.
3. **One `h1` per page,** always through `PageHeader` (or `display` on the home page).
4. **Learner-facing text uses `reading`.** It is larger, has 1.8 line height and is capped at about
   70 characters per line (`maxWidth: "70ch"`). It also follows the learner's word-spacing setting.
5. **Bangla gets extra line height.** Its vowel signs sit above and below the line, so `:lang(bn)`
   sets `line-height: 1.9` in `globals.css`. Put `lang="bn"` on any element showing Bangla text.
   `ReadableText` does this for you. The page's `<html lang>` follows the learner's language.
6. **Sentence case everywhere,** including buttons and titles. No all-caps except `overline`.
7. **Weights:** 400 for reading, 500 for captions, 600 for labels and buttons, 650–700 for headings.
   Do not use 300 or lighter: thin strokes vanish for low-vision readers.
8. **Colour:** body text uses `text.primary`; supporting text uses `text.secondary`. Both pass WCAG
   AA on every colour mode, and the high-contrast mode is black and yellow. Do not put text in
   lighter greys.

## Layout

```
┌──────────────┬─────────────────────────────────────────┐
│ Prism        │  Page title (h1)                         │
│              │  Lead sentence                           │
│ Home         │  [audience chips]                        │
│ LEARN        │                                          │
│ Read & images│  ┌ Panel ─────────────────────────────┐  │
│ Simplify     │  │ Panel title (h4 as h2)             │  │
│ Live class   │  │ …                                  │  │
│ TEACH        │  └────────────────────────────────────┘  │
│ Study        │                                          │
│ ──────────── │                                          │
│ Reading set. │                                          │
│ Collapse     │                                          │
└──────────────┴─────────────────────────────────────────┘
```

- **Sidebar** (`src/components/Sidebar.tsx`): 264px wide, or 80px when collapsed to icons. Each
  learner's collapse state is saved with their reading settings. Items show a label and a short hint;
  collapsed items show a tooltip instead. The current page gets `aria-current="page"` and a tinted
  background.
- **Below 900px (`md`):** the sidebar is hidden. A slim top bar has a menu button, which opens the
  same sidebar as a drawer, and a reading-settings button.
- **Adding a page:** add it to `NAV_SECTIONS` in `Sidebar.tsx` under the right section, with a hint
  of three or four words.
- **Content:** `Container maxWidth="lg"` with 16–40px side padding. Pages are a stack of `Paper`
  panels with 16–32px inner padding and 14px corner radius.
- **Touch targets:** at least 44×44px. Sidebar rows are 48px tall, and main actions use
  `size="large"`.
- **Focus:** every interactive element shows a 3px focus ring set in the theme. Do not remove it.

## Icons

Use Hugeicons from `@hugeicons/core-free-icons` through `src/components/Icon.tsx`. Use 22px in
navigation and buttons and 32px on home cards, with a 1.8 stroke width. Icons are decorative
(`aria-hidden`); the control around them always carries a text label or an `aria-label`.
