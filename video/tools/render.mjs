// Renders the final deliverables into out/:
//   Prism_Sign_Promo_Final.mp4 (with chapter metadata), .srt, .vtt,
//   chapters.txt, thumbnail.png and contact-sheet.png.
// Run `npm run vo` first whenever the script or the voice files change.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHAPTERS, SECTIONS, TOTAL_SECONDS } from "../src/script.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "out");
const NAME = "Prism_Sign_Promo_Final";
mkdirSync(OUT, { recursive: true });
const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit", cwd: ROOT });

// 1. Captions, from the same timings the video uses.
const { chunks } = JSON.parse(readFileSync(join(ROOT, "src", "timings.json"), "utf8"));
const wrap = (text, max = 40) => {
  if (text.length <= max) return [text];
  const w = text.split(" ");
  let best = [text];
  let score = Infinity;
  for (let i = 1; i < w.length; i++) {
    const a = w.slice(0, i).join(" ");
    const b = w.slice(i).join(" ");
    if (a.length <= max && b.length <= max && Math.abs(a.length - b.length) < score) {
      score = Math.abs(a.length - b.length);
      best = [a, b];
    }
  }
  return best;
};
const stamp = (s, sep) => {
  const ms = Math.round(s * 1000);
  const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
  const m = String(Math.floor(ms / 60000) % 60).padStart(2, "0");
  const sec = String(Math.floor(ms / 1000) % 60).padStart(2, "0");
  return `${h}:${m}:${sec}${sep}${String(ms % 1000).padStart(3, "0")}`;
};
const lines = SECTIONS.flatMap((s) => s.scenes.flatMap((sc) => sc.vo)).map((c) => ({ ...chunks[c.id], text: c.text }));
const srt = lines.map((l, i) => `${i + 1}\n${stamp(l.start, ",")} --> ${stamp(l.end + 0.25, ",")}\n${wrap(l.text).join("\n")}\n`).join("\n");
const vtt = "WEBVTT\n\n" + lines.map((l) => `${stamp(l.start, ".")} --> ${stamp(l.end + 0.25, ".")}\n${wrap(l.text).join("\n")}\n`).join("\n");
writeFileSync(join(OUT, `${NAME}.srt`), srt);
writeFileSync(join(OUT, `${NAME}.vtt`), vtt);

// 2. Chapters.
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
writeFileSync(join(OUT, "chapters.txt"), CHAPTERS.map((c) => `${mmss(c.start)} ${c.title}`).join("\n") + "\n");
const meta =
  ";FFMETADATA1\ntitle=Prism Sign · The same lesson, in Bangla Sign Language\n" +
  CHAPTERS.map((c, i) => {
    const end = i + 1 < CHAPTERS.length ? CHAPTERS[i + 1].start : TOTAL_SECONDS;
    return `\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=${c.start * 1000}\nEND=${end * 1000}\ntitle=${c.title}\n`;
  }).join("");
writeFileSync(join(OUT, "chapters.ffmeta"), meta);

// 3. Video.
const raw = join(OUT, "promo_raw.mp4");
run("npx", ["remotion", "render", "src/index.ts", "Promo", raw, "--codec=h264", "--crf=18", "--audio-codec=aac", "--audio-bitrate=192k", "--log=error"]);
const final = join(OUT, `${NAME}.mp4`);
run("ffmpeg", ["-y", "-v", "error", "-i", raw, "-i", join(OUT, "chapters.ffmeta"), "-map", "0", "-map_metadata", "1", "-map_chapters", "1", "-c", "copy", "-movflags", "+faststart", final]);
rmSync(raw);

// 4. Thumbnail and contact sheet.
run("npx", ["remotion", "still", "src/index.ts", "Thumbnail", join(OUT, "thumbnail.png"), "--log=error"]);
const sheetTimes = [4, 25, 52, 72, 136, 176];
const parts = sheetTimes.map((t, i) => {
  const f = join(OUT, `sheet-${i}.png`);
  run("ffmpeg", ["-y", "-v", "error", "-ss", String(t), "-i", final, "-frames:v", "1", "-vf", "scale=640:360", f]);
  return f;
});
run("ffmpeg", ["-y", "-v", "error", ...parts.flatMap((p) => ["-i", p]), "-filter_complex", "[0][1][2]hstack=3[a];[3][4][5]hstack=3[b];[a][b]vstack=2", join(OUT, "contact-sheet.png")]);
parts.forEach((p) => rmSync(p));

const dur = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", final]).toString().trim();
console.log(`\nDone: out/${NAME}.mp4 (${Number(dur).toFixed(2)} s), .srt, .vtt, chapters.txt, thumbnail.png, contact-sheet.png`);
