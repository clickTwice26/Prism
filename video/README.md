# Prism Sign promo video

A 3-minute submission video for the International AI Builders Congress 2026, built with Remotion
from [docs/promo-video-prompt.md](../docs/promo-video-prompt.md). It follows the Congress's
"Vibe to Production in 180 Seconds" structure: Problem (0:00), Solution (0:30), Demo (1:00),
AI approach (2:00), Impact and next steps (2:30).

Every Prism screen in the video is a hand-built mock in `src/mocks/`, rebuilt from the real
components (`frontend/src`) and theme. Nothing is captured from the running app. People signing
are illustrations marked "Sign clip", "placeholder" or "illustration", and the 3D signer always
carries its "Preview" label.

## Layout

| Path | What it holds |
| --- | --- |
| `src/script.ts` | All copy, section and scene timings, and the voiceover lines (caption text and spoken form) |
| `src/timings.json` | Generated: when each voiceover line starts and ends |
| `src/components/` | `SectionBar`, `Kicker`, `Headline`, `FeatureRow`, `Laptop`, `Phone`, `Captions`, icons |
| `src/mocks/` | Prism UI mocks: Home, Lessons, Sign dictionary, Sign words, Fingerspell, Live class, phone |
| `src/illus/` | SVG illustrations: the classroom (Mitu) and the parent at home |
| `src/scenes/` | One component per scene; animations are keyed to voiceover timings |
| `tools/voiceover.mjs` | Builds `public/audio/voice.wav` and `src/timings.json` |
| `tools/music.mjs` | Writes the music bed (`public/audio/music.wav`), composed in code |
| `tools/render.mjs` | Renders the MP4 with chapters, `.srt`, `.vtt`, `chapters.txt`, thumbnail and contact sheet |
| `tools/press.mjs` | Captures the national newspaper articles (headline and highlighted sentence) into `public/press/` |
| `tools/stills.mjs` | Renders check frames (`node tools/stills.mjs 12.5 64 140`) |
| `voiceover.txt` | The narration as plain text |

## Commands

```bash
npm install
node tools/press.mjs # newspaper screenshots for the Problem section (git-ignored; re-run after cloning)
npm run vo          # voice track + caption timings (after editing script.ts or swapping voice files)
node tools/music.mjs  # only needed once (or after deleting public/audio/)
npm run render      # out/Prism_Sign_Promo_Final.mp4 and the other deliverables
npm run studio      # preview and scrub in the browser
```

After editing `src/script.ts`, run `npm run vo && npm run render`.

## Swapping in the ElevenLabs voice

**One take of the whole script (what the current render uses).** Save it as
`audio/elevenlabs-full.mp3`, then:

```bash
whisper audio/elevenlabs-full.mp3 --model base.en --language en --word_timestamps True --output_format json --output_dir audio
mv audio/elevenlabs-full.json audio/elevenlabs-words.json
python3 -I tools/align.py   # matches every caption line to the take
npm run vo && npm run render
```

Each caption line is cut from the take and placed on its scene's timeline, so the narration stays
in sync with the visuals. `align.py` prints where each line starts and ends; spoken words it
cannot match (such as "Finger spell" for "Fingerspell") are given to the neighbouring line.

**Or one file per section.** Generate one file per section from [docs/promo-voiceover.txt](../docs/promo-voiceover.txt) and
save them as:

```
video/audio/vo-1-problem.mp3
video/audio/vo-2-solution.mp3
video/audio/vo-3-demo.mp3
video/audio/vo-4-ai.mp3
video/audio/vo-5-impact.mp3
```

Then run `npm run vo && npm run render`. Each file starts 0.3 s into its section (0:00, 0:30,
1:00, 2:00, 2:30), and the captions are spread over it by line length. If a file is longer than
its section, `npm run vo` prints a warning with the overrun. Sections without a file keep the
temporary macOS voice.
