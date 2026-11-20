import React from "react";
import { AbsoluteFill } from "remotion";
import { C, FONT, FONT_BN, easeOut } from "../theme";
import { SECTIONS } from "../script";
import timings from "../timings.json";
import { Icon } from "./Icons";

// ---- Timing helpers ---------------------------------------------------------

type Span = { start: number; end: number };
const T = timings.chunks as Record<string, Span>;

/** Absolute start/end (seconds) of a voiceover chunk. */
export const cue = (id: string): Span => {
  const c = T[id];
  if (!c) throw new Error(`No timing for chunk "${id}". Run npm run vo.`);
  return c;
};

/** 0→1 progress of an entrance that starts at `at` and lasts `dur` seconds. */
export const prog = (t: number, at: number, dur = 0.5) => easeOut((t - at) / dur);

/** Rise-and-fade entrance style. */
export const rise = (t: number, at: number, dist = 28, dur = 0.55): React.CSSProperties => {
  const p = prog(t, at, dur);
  return { opacity: p, transform: `translateY(${(1 - p) * dist}px)` };
};

export const fade = (t: number, at: number, dur = 0.45) => ({ opacity: prog(t, at, dur) });

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

// ---- Background ---------------------------------------------------------------

const HandOutline: React.FC<{ x: number; y: number; s: number; r: number }> = ({ x, y, s, r }) => (
  <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M0 40 V8 a6 6 0 0 1 12 0 V34 M12 30 V0 a6 6 0 0 1 12 0 V30 M24 30 V4 a6 6 0 0 1 12 0 V34 M36 34 V14 a6 6 0 0 1 12 0 V52 a30 30 0 0 1 -30 30 h-2 a26 26 0 0 1 -21 -11 L-14 58 a6.5 6.5 0 0 1 10 -8 L0 56" />
  </g>
);

export const Background: React.FC<{ t: number; dim?: number }> = ({ t, dim = 0 }) => {
  const d = (k: number) => Math.sin(t * 0.09 + k) * 40;
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: "hidden" }}>
      {/* Soft prism light. */}
      <div style={{ position: "absolute", left: 1150 + d(1), top: -260 + d(2), width: 900, height: 900, borderRadius: "50%", background: "radial-gradient(circle, rgba(51,70,211,0.30), transparent 65%)" }} />
      <div style={{ position: "absolute", left: -300 + d(3), top: 560 + d(4), width: 900, height: 900, borderRadius: "50%", background: "radial-gradient(circle, rgba(194,65,12,0.16), transparent 65%)" }} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: 0.06 }}>
        {[0, 1, 2, 3, 4].map((k) => (
          <polygon
            key={k}
            points={`${-200 + k * 120 + d(k) * 2},1080 ${900 + k * 160},${-100 + k * 30} ${1000 + k * 180},${-100 + k * 30}`}
            fill={["#8ab4ff", "#a78bfa", "#6ee7a8", "#ffe08a", "#ffb46b"][k]}
          />
        ))}
        <HandOutline x={1650 + d(5)} y={760} s={2.4} r={-14 + d(6) * 0.1} />
        <HandOutline x={180} y={120 + d(7)} s={1.8} r={18} />
        <HandOutline x={980 + d(8)} y={930} s={1.5} r={-30} />
      </svg>
      {dim > 0 && <AbsoluteFill style={{ background: `rgba(15,18,24,${dim})` }} />}
    </AbsoluteFill>
  );
};

// ---- Section progress bar ---------------------------------------------------

export const SectionBar: React.FC<{ T: number }> = ({ T: now }) => {
  const demo = SECTIONS.find((s) => s.id === "demo")!;
  const inDemo = now >= demo.start && now < demo.end;
  return (
    <div style={{ position: "absolute", top: 34, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, fontFamily: FONT }}>
      <div style={{ display: "flex", gap: 10 }}>
        {SECTIONS.map((s) => {
          const p = Math.min(1, Math.max(0, (now - s.start) / (s.end - s.start)));
          const current = now >= s.start && now < s.end;
          const past = now >= s.end;
          return (
            <div key={s.id} style={{ width: 196, display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: current ? C.orange : past ? C.lightBlue : C.text3 }}>
                {s.label}
              </div>
              <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(past ? 1 : current ? p : 0) * 100}%`, background: past ? C.lightBlue : C.orange, borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>
      {inDemo && (
        <div style={{ display: "flex", gap: 8, alignSelf: "center" }}>
          {demo.scenes.map((sc) => {
            const p = Math.min(1, Math.max(0, (now - sc.start) / (sc.end - sc.start)));
            return (
              <div key={sc.id} style={{ width: 42, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.14)", overflow: "hidden" }}>
                <div style={{ width: `${p * 100}%`, height: "100%", background: now >= sc.end ? C.lightBlue : C.orange }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---- Type ------------------------------------------------------------------

export const Kicker: React.FC<{ text: string; bn?: string; style?: React.CSSProperties }> = ({ text, bn, style }) => (
  <div style={{ fontFamily: FONT, fontSize: 21, fontWeight: 700, letterSpacing: "0.2em", color: C.orange, ...style }}>
    {text}
    {bn && (
      <>
        {"  ·  "}
        <span lang="bn" style={{ fontFamily: FONT_BN, letterSpacing: "0.02em", fontWeight: 600 }}>
          {bn}
        </span>
      </>
    )}
  </div>
);

export const Headline: React.FC<{ text: string; size?: number; style?: React.CSSProperties }> = ({ text, size = 68, style }) => (
  <div style={{ fontFamily: FONT, fontSize: size, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.025em", color: C.white, whiteSpace: "pre-line", ...style }}>
    {text}
  </div>
);

export const BnLine: React.FC<{ text: string; size?: number; style?: React.CSSProperties }> = ({ text, size = 32, style }) => (
  <div lang="bn" style={{ fontFamily: FONT_BN, fontSize: size, fontWeight: 600, lineHeight: 1.5, color: C.lightBlue, ...style }}>
    {text}
  </div>
);

export const IconTile: React.FC<{ name: string; size?: number; tone?: "blue" | "orange" }> = ({ name, size = 64, tone = "blue" }) => (
  <div
    style={{
      width: size,
      height: size,
      flex: "none",
      borderRadius: size * 0.28,
      display: "grid",
      placeItems: "center",
      background: tone === "blue" ? "rgba(51,70,211,0.28)" : "rgba(194,65,12,0.24)",
      border: `1px solid ${tone === "blue" ? "rgba(138,180,255,0.35)" : "rgba(255,180,107,0.35)"}`,
      color: tone === "blue" ? C.lightBlue : C.orange,
    }}
  >
    <Icon name={name} size={size * 0.5} />
  </div>
);

export const FeatureRow: React.FC<{ icon: string; title: string; text: string; style?: React.CSSProperties; active?: boolean }> = ({
  icon,
  title,
  text,
  style,
  active,
}) => (
  <div style={{ display: "flex", gap: 22, alignItems: "center", fontFamily: FONT, ...style }}>
    <IconTile name={icon} tone={active ? "orange" : "blue"} />
    <div>
      <div style={{ fontSize: 28, fontWeight: 700, color: C.white, lineHeight: 1.25 }}>{title}</div>
      <div style={{ fontSize: 22, color: C.text2, lineHeight: 1.4, marginTop: 4 }}>{text}</div>
    </div>
  </div>
);

export const Chip: React.FC<{ children: React.ReactNode; tone?: "blue" | "orange" | "plain"; size?: number; style?: React.CSSProperties }> = ({
  children,
  tone = "plain",
  size = 20,
  style,
}) => (
  <div
    style={{
      fontFamily: FONT,
      fontSize: size,
      fontWeight: 600,
      padding: `${size * 0.4}px ${size * 0.85}px`,
      borderRadius: 999,
      color: tone === "orange" ? C.orange : tone === "blue" ? C.lightBlue : C.white,
      background: tone === "orange" ? "rgba(194,65,12,0.20)" : tone === "blue" ? "rgba(51,70,211,0.25)" : "rgba(255,255,255,0.08)",
      border: `1px solid ${tone === "orange" ? "rgba(255,180,107,0.4)" : tone === "blue" ? "rgba(138,180,255,0.35)" : C.line}`,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </div>
);

// ---- Captions ---------------------------------------------------------------

/** Splits text into at most two balanced lines of up to 40 characters. */
export const wrapCaption = (text: string, max = 40): string[] => {
  if (text.length <= max) return [text];
  const words = text.split(" ");
  let best: string[] = [text];
  let bestScore = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    if (a.length > max || b.length > max) continue;
    const score = Math.abs(a.length - b.length);
    if (score < bestScore) {
      bestScore = score;
      best = [a, b];
    }
  }
  return best;
};

export const Captions: React.FC<{ T: number }> = ({ T: now }) => {
  const all = SECTIONS.flatMap((s) => s.scenes.flatMap((sc) => sc.vo));
  const current = all.find((c) => {
    const s = T[c.id];
    return s && now >= s.start - 0.05 && now <= s.end + 0.25;
  });
  if (!current) return null;
  const s = T[current.id];
  const op = Math.min(prog(now, s.start - 0.05, 0.15), 1 - prog(now, s.end + 0.1, 0.15));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 48, display: "flex", justifyContent: "center", opacity: op }}>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 34,
          fontWeight: 600,
          lineHeight: 1.35,
          color: "#fff",
          textAlign: "center",
          background: "rgba(8,10,14,0.86)",
          border: "1px solid rgba(255,255,255,0.10)",
          padding: "12px 30px",
          borderRadius: 22,
          maxWidth: 1000,
        }}
      >
        {wrapCaption(current.text).map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
};

export const Badge: React.FC<{ T: number; text: string }> = ({ T: now, text }) => {
  const op = Math.min(prog(now, 0.4, 0.5), 1 - prog(now, 7.6, 0.5));
  if (op <= 0) return null;
  return (
    <div style={{ position: "absolute", top: 118, left: 60, opacity: op, display: "flex", alignItems: "center", gap: 12, fontFamily: FONT, fontSize: 20, fontWeight: 600, color: C.white, background: "rgba(8,10,14,0.75)", border: `1px solid ${C.line}`, padding: "10px 18px", borderRadius: 14 }}>
      <Icon name="cc" size={26} color={C.orange} />
      {text}
    </div>
  );
};

// ---- Devices ------------------------------------------------------------------

/** A laptop showing a 1440×900 screen, scaled to `width`. */
export const Laptop: React.FC<{
  width: number;
  t: number;
  children: React.ReactNode;
  zoom?: { scale: number; x: number; y: number }; // x, y: focus point in screen pixels
  style?: React.CSSProperties;
}> = ({ width, t, children, zoom, style }) => {
  const SW = 1440;
  const SH = 900;
  const bezel = width * 0.022;
  const inner = width - bezel * 2;
  const k = inner / SW;
  const z = zoom ?? { scale: 1, x: SW / 2, y: SH / 2 };
  const tx = SW / 2 - z.x;
  const ty = SH / 2 - z.y;
  const m = Math.min(1, Math.max(0, (z.scale - 1) / 0.8));
  return (
    <div style={{ width, transform: `translateY(${Math.sin(t * 0.8) * 6}px) perspective(2400px) rotateY(${4 + Math.sin(t * 0.5) * 1.2}deg) rotateX(${2}deg)`, transformOrigin: "50% 60%", ...style }}>
      <div style={{ background: "#0b0d12", borderRadius: width * 0.03, padding: bezel, boxShadow: "0 40px 90px rgba(0,0,0,0.55), 0 0 0 2px #2a2f3b inset" }}>
        <div style={{ width: inner, height: SH * k, overflow: "hidden", borderRadius: width * 0.008, position: "relative", background: C.ink }}>
          <div style={{ width: SW, height: SH, transform: `scale(${k})`, transformOrigin: "0 0", position: "absolute" }}>
            <div style={{ width: SW, height: SH, transform: `translate(${tx * m}px, ${ty * m}px) scale(${z.scale})`, transformOrigin: `${z.x}px ${z.y}px` }}>
              {children}
            </div>
          </div>
        </div>
      </div>
      <div style={{ height: width * 0.03, margin: `0 ${-width * 0.06}px`, background: "linear-gradient(#3a404d, #1c2028)", borderRadius: `0 0 ${width * 0.04}px ${width * 0.04}px`, position: "relative" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, width: width * 0.16, height: width * 0.01, transform: "translateX(-50%)", background: "#15181f", borderRadius: `0 0 ${width * 0.01}px ${width * 0.01}px` }} />
      </div>
    </div>
  );
};

/** A phone showing a 390×844 screen, scaled to `width`. */
export const Phone: React.FC<{ width: number; t: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ width, t, children, style }) => {
  const SW = 390;
  const SH = 844;
  const bezel = width * 0.04;
  const inner = width - bezel * 2;
  const k = inner / SW;
  return (
    <div style={{ width, transform: `translateY(${Math.sin(t * 0.9 + 1) * 8}px) rotate(${-3 + Math.sin(t * 0.6) * 0.8}deg)`, ...style }}>
      <div style={{ background: "#0b0d12", borderRadius: width * 0.16, padding: bezel, boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 0 2px #2a2f3b inset" }}>
        <div style={{ width: inner, height: SH * k, overflow: "hidden", borderRadius: width * 0.12, position: "relative", background: C.ink }}>
          <div style={{ width: SW, height: SH, transform: `scale(${k})`, transformOrigin: "0 0", position: "absolute" }}>{children}</div>
        </div>
      </div>
    </div>
  );
};
