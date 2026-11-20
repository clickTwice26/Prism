// Copies runtime files the app serves itself into public/, instead of loading
// them from a CDN. Runs before dev and build.
//   - MediaPipe's WebAssembly runtime (hand and body tracking)
//   - the XSLT polyfill the 3D sign preview needs, since Chrome removed XSLT
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const copies = [
  ["node_modules/@mediapipe/tasks-vision/wasm", "public/mediapipe/wasm"],
  ["node_modules/xslt-polyfill/xslt-polyfill.min.js", "public/vendor/xslt-polyfill.min.js"],
];
for (const [from, to] of copies) {
  if (!existsSync(from)) {
    console.warn(`copy-assets: ${from} is not installed; skipping`);
    continue;
  }
  mkdirSync(from.endsWith(".js") ? dirname(to) : to, { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`copy-assets: ${from} -> ${to}`);
}
