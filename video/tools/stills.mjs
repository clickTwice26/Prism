// Renders check frames at the given seconds (default: every 5 s) to out/frames/.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const secs = process.argv.slice(2).map(Number);
const times = secs.length ? secs : Array.from({ length: 36 }, (_, i) => i * 5 + 2.5);
mkdirSync(`${root}out/frames`, { recursive: true });
const serveUrl = await bundle({ entryPoint: `${root}src/index.ts` });
const composition = await selectComposition({ serveUrl, id: "Promo" });
for (const s of times) {
  const output = `${root}out/frames/t${String(s.toFixed(1)).padStart(5, "0")}.jpg`;
  await renderStill({ serveUrl, composition, frame: Math.round(s * 30), output, imageFormat: "jpeg", jpegQuality: 80 });
  console.log(output);
}
