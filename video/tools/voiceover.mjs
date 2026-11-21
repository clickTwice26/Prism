// Builds the voice track and the caption timings.
//
// For each section, if an ElevenLabs file exists in video/audio/
// (vo-1-problem.mp3 … vo-5-impact.mp3, or .wav), it is used and the section's
// captions are spread over it by length. Otherwise a temporary track is made
// per caption chunk with macOS `say`.
//
// If audio/elevenlabs-full.mp3 and audio/elevenlabs-chunks.json exist (one
// take of the whole script, aligned by tools/align.py), each caption line is
// cut from that take and placed on its scene's timeline instead.
//
// Writes public/audio/voice.wav and src/timings.json.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SECTIONS, TOTAL_SECONDS } from "../src/script.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const TMP = join(ROOT, "out", "vo-tmp");
const VOICE = process.env.VO_VOICE ?? "Samantha";
const RATE = process.env.VO_RATE ?? "170";
const LEAD = 0.4; // silence before the first line of a scene
const GAP = 0.3; // between lines
const SENTENCE_GAP = 0.5; // after a full stop or colon
const JOIN_GAP = 0.12; // when a line continues the same sentence

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const duration = (f) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());

const toWav = (src, dst) =>
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", src, "-ar", "48000", "-ac", "1", dst]);

const FULL = join(ROOT, "audio", "elevenlabs-full.mp3");
const ALIGN = join(ROOT, "audio", "elevenlabs-chunks.json");
const take = existsSync(FULL) && existsSync(ALIGN) ? JSON.parse(readFileSync(ALIGN, "utf8")) : null;
const order = SECTIONS.flatMap((s) => s.scenes.flatMap((sc) => sc.vo.map((c) => c.id)));
if (take) console.log("Using the ElevenLabs take (audio/elevenlabs-full.mp3).");

/** Cuts one line out of the full take, with a little air on each side. */
function cutFromTake(id, wav) {
  const k = order.indexOf(id);
  const prev = k > 0 ? take[order[k - 1]] : null;
  const next = k < order.length - 1 ? take[order[k + 1]] : null;
  const a = Math.max(prev ? (prev.end + take[id].start) / 2 : 0, take[id].start - 0.08);
  const b = Math.min(next ? (take[id].end + next.start) / 2 : take[id].end + 0.4, take[id].end + 0.18);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", String(a), "-to", String(b), "-i", FULL, "-af", "afade=t=in:d=0.02,areverse,afade=t=in:d=0.04,areverse", "-ar", "48000", "-ac", "1", wav]);
}

const chunks = {};
const clips = []; // { file, start }
const warnings = [];

SECTIONS.forEach((section, i) => {
  const base = join(ROOT, "audio", `vo-${i + 1}-${section.id}`);
  const human = take ? undefined : [".wav", ".mp3", ".m4a"].map((e) => base + e).find(existsSync);
  const all = section.scenes.flatMap((s) => s.vo);

  if (human) {
    // One recording for the whole section: spread captions by text length.
    const wav = join(TMP, `section-${i + 1}.wav`);
    toWav(human, wav);
    const d = duration(wav);
    const start = section.start + 0.3;
    if (start + d > section.end) warnings.push(`${section.id}: recording is ${(start + d - section.end).toFixed(1)} s longer than its section`);
    const weight = all.map((c) => (c.say ?? c.text).length + 12);
    const sum = weight.reduce((a, b) => a + b, 0);
    let t = start;
    all.forEach((c, k) => {
      const len = (weight[k] / sum) * d;
      chunks[c.id] = { start: +t.toFixed(3), end: +(t + len - 0.1).toFixed(3) };
      t += len;
    });
    clips.push({ file: wav, start });
    console.log(`${section.id}: using ${human} (${d.toFixed(1)} s)`);
    return;
  }

  for (const scene of section.scenes) {
    let t = scene.start + LEAD;
    for (const c of scene.vo) {
      const wav = join(TMP, `${c.id}.wav`);
      if (take) cutFromTake(c.id, wav);
      else {
        const aiff = join(TMP, `${c.id}.aiff`);
        execFileSync("say", ["-v", VOICE, "-r", RATE, "-o", aiff, c.say ?? c.text]);
        toWav(aiff, wav);
      }
      const d = duration(wav);
      chunks[c.id] = { start: +t.toFixed(3), end: +(t + d).toFixed(3) };
      clips.push({ file: wav, start: t });
      t += d + (/[.:?]$/.test(c.text) ? SENTENCE_GAP : /,$/.test(c.text) ? GAP : JOIN_GAP);
    }
    const over = t - SENTENCE_GAP - scene.end;
    if (over > 0) warnings.push(`${scene.id}: voice runs ${over.toFixed(1)} s past the scene end (${scene.end} s)`);
    console.log(`${scene.id.padEnd(12)} ${scene.start}-${scene.end}s  voice ends ${(t - GAP).toFixed(1)}s`);
  }
});

// Mix every clip onto one silent 180 s track.
const args = ["-y", "-v", "error", "-f", "lavfi", "-t", String(TOTAL_SECONDS), "-i", "anullsrc=r=48000:cl=mono"];
clips.forEach((c) => args.push("-i", c.file));
const filters = clips.map((c, k) => `[${k + 1}]adelay=${Math.round(c.start * 1000)}[d${k}]`);
const inputs = ["[0]", ...clips.map((_, k) => `[d${k}]`)].join("");
filters.push(`${inputs}amix=inputs=${clips.length + 1}:normalize=0,atrim=0:${TOTAL_SECONDS}[out]`);
const RAW = join(TMP, "voice-raw.wav");
args.push("-filter_complex", filters.join(";"), "-map", "[out]", "-ar", "48000", "-ac", "2", RAW);
execFileSync("ffmpeg", args);

// Bring the speech to about -16 LUFS (takes from TTS tools are often far quieter), with a limiter
// so no peak goes above -1 dBFS. Integrated loudness is gated, so the gaps between lines don't count.
const TARGET_LUFS = -16;
const measured = (() => {
  const out = execFileSync("sh", ["-c", `ffmpeg -hide_banner -i "${RAW}" -af ebur128 -f null - 2>&1 | grep -E "^\\s+I:" | tail -1`]).toString();
  return Number(out.match(/-?[\d.]+/)[0]);
})();
const gain = (TARGET_LUFS - measured).toFixed(1);
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", RAW, "-af", `volume=${gain}dB,alimiter=limit=0.89:attack=5:release=50:level=false`, "-ar", "48000", "-ac", "2", join(ROOT, "public", "audio", "voice.wav")]);
console.log(`Voice measured ${measured} LUFS; applied ${gain} dB.`);

writeFileSync(join(ROOT, "src", "timings.json"), JSON.stringify({ chunks, warnings }, null, 2) + "\n");
warnings.forEach((w) => console.warn("WARNING:", w));
console.log(`Wrote public/audio/voice.wav and src/timings.json (${Object.keys(chunks).length} lines).`);
