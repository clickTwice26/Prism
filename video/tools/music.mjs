// A soft, warm instrumental bed written for this video (no third-party audio):
// marimba-like plucks over a string-like pad, 90 BPM, I–V–vi–IV in C major.
// Writes public/audio/music.wav (48 kHz stereo, 180 s).
import { writeFileSync } from "node:fs";

const SR = 48000;
const SECONDS = 180;
const BPM = 90;
const BEAT = 60 / BPM;
const N = SR * SECONDS;
const L = new Float32Array(N);
const R = new Float32Array(N);

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
// C, G/B, Am, F: two bars (8 beats) each.
const CHORDS = [
  { bass: 36, notes: [60, 64, 67, 72] },
  { bass: 35, notes: [59, 62, 67, 71] },
  { bass: 33, notes: [57, 60, 64, 69] },
  { bass: 29, notes: [57, 60, 65, 69] },
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 1]; // eighth-note pattern per beat pair

function add(buf, start, len, fn, gain) {
  const s0 = Math.floor(start * SR);
  for (let i = 0; i < len * SR && s0 + i < N; i++) buf[s0 + i] += fn(i / SR) * gain;
}

// Marimba-ish pluck: fundamental plus the 4th partial, fast decay.
function pluck(t0, f, gain, pan) {
  const fn = (t) => {
    const env = Math.min(1, t / 0.004) * Math.exp(-t * 5.5);
    return env * (Math.sin(2 * Math.PI * f * t) + 0.18 * Math.sin(2 * Math.PI * f * 3.93 * t) * Math.exp(-t * 14));
  };
  add(L, t0, 1.2, fn, gain * (1 - pan));
  add(R, t0, 1.2, fn, gain * (1 + pan));
}

// Pad: detuned sines with slow attack and release, like soft strings.
function pad(t0, dur, f, gain) {
  const fn = (t) => {
    const env = Math.min(1, t / 1.2) * Math.min(1, (dur - t) / 1.2);
    const v = Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.003 * t) + 0.3 * Math.sin(2 * Math.PI * f * 2 * t);
    return Math.max(0, env) * v * (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.2 * t));
  };
  add(L, t0, dur, fn, gain);
  add(R, t0, dur, (t) => fn(t + 0.011), gain);
}

const barLen = BEAT * 8;
for (let k = 0; k * barLen < SECONDS; k++) {
  const chord = CHORDS[k % CHORDS.length];
  const t0 = k * barLen;
  pad(t0, barLen + 0.6, hz(chord.bass + 12), 0.05);
  chord.notes.slice(0, 3).forEach((n) => pad(t0, barLen + 0.6, hz(n), 0.022));
  add(L, t0, barLen, (t) => Math.sin(2 * Math.PI * hz(chord.bass) * t) * Math.exp(-t * 0.6), 0.06);
  add(R, t0, barLen, (t) => Math.sin(2 * Math.PI * hz(chord.bass) * t) * Math.exp(-t * 0.6), 0.06);
  for (let e = 0; e < 16; e++) {
    const note = chord.notes[ARP[e % 8]] + (e >= 8 && e % 4 === 0 ? 12 : 0);
    pluck(t0 + e * (BEAT / 2), hz(note), e % 2 === 0 ? 0.07 : 0.045, ((e % 4) - 1.5) * 0.25);
  }
}

// Fade in and out, normalise to -6 dBFS peak.
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 3) * Math.min(1, (SECONDS - t) / 5);
  L[i] *= fade;
  R[i] *= fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.5 / peak;

const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm)) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm)) * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);
writeFileSync(new URL("../public/audio/music.wav", import.meta.url), Buffer.concat([header, data]));
console.log("Wrote public/audio/music.wav");
