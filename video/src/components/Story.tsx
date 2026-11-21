import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, FONT, FONT_BN } from "../theme";
import { lerp, prog, rise } from "./ui";

// Photorealistic story shots (AI-generated with Gemini from video/people/prompts.md).
// Every shot gets a slow push-in, a gentle grade, light film grain and the dramatisation tag.

export type Shot = "S01-classroom-wide" | "S02-teacher-board" | "S03-mitu-close" | "S06-home-laptop" | "S09-mitu-raises-hand" | "S10-together";

export const StoryShot: React.FC<{
  T: number;
  shot: Shot;
  start: number; // when the push-in begins (s)
  dur: number; // how long the push-in lasts (s)
  from?: number; // start scale
  to?: number; // end scale
  focus?: [number, number]; // transform origin, in % of the frame
  blur?: number;
  tag?: boolean;
  children?: React.ReactNode;
}> = ({ T, shot, start, dur, from = 1.04, to = 1.12, focus = [50, 45], blur = 0, tag = true, children }) => {
  const p = Math.max(0, Math.min(1, (T - start) / dur));
  const s = lerp(from, to, p);
  const seed = Math.floor(T * 12) % 6;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${s})`, transformOrigin: `${focus[0]}% ${focus[1]}%` }}>
        <Img
          src={staticFile(`people/${shot}.jpg`)}
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: `contrast(1.04) saturate(0.94)${blur ? ` blur(${blur}px)` : ""}` }}
        />
        {children}
      </AbsoluteFill>
      {/* Grade: lifted warm highlights, cool shadows, soft vignette */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(255,190,120,0.06), rgba(20,40,60,0.10))", mixBlendMode: "soft-light" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.42) 100%)" }} />
      <AbsoluteFill style={{ opacity: 0.09, mixBlendMode: "overlay" }}>
        <svg width="1920" height="1080">
          <filter id={`grain${seed}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="1920" height="1080" filter={`url(#grain${seed})`} />
        </svg>
      </AbsoluteFill>
      {tag && <DramaTag />}
    </AbsoluteFill>
  );
};

/** Small, readable disclosure on every AI-generated shot. */
export const DramaTag: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 118,
      right: 60,
      fontFamily: FONT,
      fontSize: 17,
      fontWeight: 600,
      color: "rgba(255,255,255,0.88)",
      background: "rgba(8,10,14,0.62)",
      border: "1px solid rgba(255,255,255,0.14)",
      padding: "7px 14px",
      borderRadius: 10,
      letterSpacing: "0.02em",
    }}
  >
    Dramatisation · AI-generated
  </div>
);

/** Thin lower third: name and role, with a Bangla line under it. */
export const LowerThird: React.FC<{ T: number; at: number; until: number; title: string; bn: string }> = ({ T, at, until, title, bn }) => {
  const out = prog(T, until, 0.4);
  if (T < at || out >= 1) return null;
  return (
    <div style={{ position: "absolute", left: 100, bottom: 180, ...rise(T, at, 18), opacity: prog(T, at, 0.5) * (1 - out) }}>
      <div style={{ display: "flex", gap: 18, alignItems: "stretch", background: "rgba(8,10,14,0.58)", padding: "14px 26px 14px 18px", borderRadius: 14 }}>
        <div style={{ width: 5, borderRadius: 3, background: C.orange }} />
        <div>
          <div style={{ fontFamily: FONT, fontSize: 38, fontWeight: 700, color: "#fff", textShadow: "0 2px 18px rgba(0,0,0,0.6)" }}>{title}</div>
          <div lang="bn" style={{ fontFamily: FONT_BN, fontSize: 28, color: C.lightBlue, marginTop: 4, textShadow: "0 2px 18px rgba(0,0,0,0.6)" }}>
            {bn}
          </div>
        </div>
      </div>
    </div>
  );
};

/** Lower-left honesty line shown once, on the first story shot. */
export const CompositeNote: React.FC<{ T: number; at: number; until: number }> = ({ T, at, until }) => {
  const op = prog(T, at, 0.5) * (1 - prog(T, until, 0.5));
  if (op <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 60, top: 176, opacity: op, fontFamily: FONT, fontSize: 18, color: "rgba(255,255,255,0.85)", background: "rgba(8,10,14,0.6)", padding: "8px 14px", borderRadius: 10 }}>
      Mitu is a composite character based on the reports in this film.
    </div>
  );
};

/** Crossfade helper: opacity of a shot that is on screen from a to b, with x-second fades. */
export const shotOpacity = (T: number, a: number, b: number, x = 0.35) => Math.min(prog(T, a - x, x * 2), 1 - prog(T, b - x, x * 2));
