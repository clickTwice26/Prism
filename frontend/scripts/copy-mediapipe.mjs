// Copies MediaPipe's WebAssembly runtime into public/ so the app serves it
// itself instead of loading it from a CDN. Runs before dev and build.
import { cpSync, existsSync, mkdirSync } from "node:fs";

const from = "node_modules/@mediapipe/tasks-vision/wasm";
const to = "public/mediapipe/wasm";
if (!existsSync(from)) {
  console.warn("copy-mediapipe: @mediapipe/tasks-vision is not installed; skipping");
  process.exit(0);
}
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
console.log(`copy-mediapipe: ${from} -> ${to}`);
