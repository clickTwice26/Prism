import React from "react";
import { FONT, FONT_BN } from "../theme";
import { Desk, Student, Teacher, type Look } from "./People";

// The illustrated Bangladeshi classroom used in the opening and the close.
// `light` 0→1 warms the room; `underline`, `card` and `raise` play the ending.

export const MITU = { x: 1350, y: 700 };

const W = "#ffffff";
const B = "#3346d3";
const KIDS: { x: number; y: number; s: number; look: Look; mitu?: boolean }[] = [
  // Back row (furthest, smaller)
  { x: 1190, y: 520, s: 0.74, look: { skin: "#8d5a3b", hair: "#1d1513", top: W, accent: B } },
  { x: 1400, y: 520, s: 0.74, look: { skin: "#a56a45", hair: "#1d1513", top: W, accent: B, girl: true, bun: true } },
  { x: 1610, y: 520, s: 0.74, look: { skin: "#7e4f33", hair: "#1d1513", top: W, accent: B } },
  { x: 1820, y: 520, s: 0.74, look: { skin: "#9a6242", hair: "#241a17", top: W, accent: B, girl: true, braids: true } },
  // Second row: Mitu
  { x: 1120, y: 700, s: 0.98, look: { skin: "#9a6242", hair: "#1d1513", top: W, accent: B } },
  { x: MITU.x, y: MITU.y, s: 0.98, look: { skin: "#a8704c", hair: "#1a1210", top: W, accent: B, girl: true, braids: true }, mitu: true },
  { x: 1580, y: 700, s: 0.98, look: { skin: "#86543a", hair: "#1d1513", top: W, accent: B } },
  { x: 1810, y: 700, s: 0.98, look: { skin: "#a56a45", hair: "#1d1513", top: W, accent: B, girl: true, bun: true } },
  // Front row (closest, cropped by the frame)
  { x: 1240, y: 920, s: 1.25, look: { skin: "#7e4f33", hair: "#1d1513", top: W, accent: B, girl: true, braids: true } },
  { x: 1530, y: 920, s: 1.25, look: { skin: "#9a6242", hair: "#1d1513", top: W, accent: B } },
  { x: 1820, y: 920, s: 1.25, look: { skin: "#a56a45", hair: "#241a17", top: W, accent: B } },
];

const Bubble: React.FC<{ x: number; y: number; w: number; op: number; blank: boolean }> = ({ x, y, w, op, blank }) => (
  <g transform={`translate(${x} ${y})`} opacity={op}>
    <rect x={-w / 2} y={-34} width={w} height={68} rx={34} fill={blank ? "#ffffff" : "#fffaf0"} opacity={blank ? 0.35 : 0.95} stroke={blank ? "#ffffff" : "none"} strokeDasharray={blank ? "6 8" : undefined} strokeWidth={2} />
    {!blank && (
      <>
        <rect x={-w / 2 + 22} y={-10} width={w * 0.45} height={7} rx={3.5} fill="#7a6a5a" />
        <rect x={-w / 2 + 22} y={5} width={w * 0.62} height={7} rx={3.5} fill="#b3a28d" />
      </>
    )}
  </g>
);

export const Classroom: React.FC<{
  t: number;
  light?: number; // 0 morning, 1 full warm light
  bubbles?: number; // 0→1 how far the speech bubbles have travelled
  underline?: number;
  card?: number;
  raise?: number;
  mituGlow?: number;
}> = ({ t, light = 0, bubbles = 0, underline = 0, card = 0, raise = 0, mituGlow = 0 }) => {
  const wall = light > 0.5 ? "#f2d8ae" : "#e9cfa6";
  return (
    <svg viewBox="0 0 1920 1080" width={1920} height={1080}>
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={wall} />
          <stop offset="1" stopColor="#d9b689" />
        </linearGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b98457" />
          <stop offset="1" stopColor="#8f5f3b" />
        </linearGradient>
        <linearGradient id="beam" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3c4" stopOpacity={0.55 + light * 0.25} />
          <stop offset="1" stopColor="#fff3c4" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect width={1920} height={1080} fill="url(#wall)" />
      <rect y={820} width={1920} height={260} fill="url(#floor)" />
      <rect y={810} width={1920} height={14} fill="#7a4a2c" opacity={0.6} />

      {/* Window with morning light */}
      <g>
        <rect x={1560} y={110} width={300} height={300} rx={14} fill="#a9d7ee" />
        <circle cx={1790} cy={190} r={44} fill="#fff1b8" />
        <path d="M1560 260 H1860 M1710 110 V410" stroke="#f6ecdc" strokeWidth={14} />
        <rect x={1560} y={110} width={300} height={300} rx={14} fill="none" stroke="#c99a68" strokeWidth={10} />
        <path d="M1560 410 L1860 410 L1300 1080 L700 1080 Z" fill="url(#beam)" opacity={0.6} />
      </g>

      {/* Ceiling fan */}
      <g transform={`translate(1000 40)`}>
        <rect x={-4} y={0} width={8} height={40} fill="#6d4a32" />
        <ellipse cx={0} cy={44} rx={150 * Math.abs(Math.cos(t * 3))} ry={10} fill="#7a5b44" opacity={0.6} />
        <circle cx={0} cy={44} r={14} fill="#5a3d2a" />
      </g>

      {/* Chalkboard */}
      <g>
        <rect x={100} y={150} width={760} height={360} rx={16} fill="#2f5d4a" stroke="#7a4a2c" strokeWidth={18} />
        <text x={480} y={320} textAnchor="middle" fontFamily={FONT_BN} fontSize={92} fontWeight={600} fill="#f4f1e8" lang="bn">
          সালোকসংশ্লেষণ
        </text>
        <text x={480} y={400} textAnchor="middle" fontFamily={FONT} fontSize={40} fill="#d9e8df" opacity={0.85}>
          Photosynthesis
        </text>
        {/* Little leaf + sun diagram */}
        <circle cx={190} cy={220} r={26} fill="none" stroke="#f4e27a" strokeWidth={4} />
        <path d="M740 440 C700 400 720 360 780 350 C790 400 780 430 740 440 Z" fill="none" stroke="#bfe6a8" strokeWidth={4} />
        <rect x={210} y={340} width={540 * underline} height={10} rx={5} fill="#ffb46b" />
        <rect x={380} y={500} width={140} height={14} rx={4} fill="#a8653a" />
      </g>

      <Teacher x={900} y={500} s={1.05} t={t} />

      {/* Rows of students, back to front */}
      {KIDS.map((k, i) => (
        <g key={i}>
          <Student x={k.x} y={k.y} s={k.s} look={k.look} raise={k.mitu ? raise : 0} glow={k.mitu ? mituGlow : 0} />
          <Desk x={k.x} y={k.y + 42 * k.s} w={190} s={k.s} />
        </g>
      ))}

      {/* Speech bubbles: clear near the teacher, blank and faded by the time they reach Mitu */}
      {bubbles > 0 &&
        [0, 1, 2, 3].map((k) => {
          const p = Math.min(1, Math.max(0, bubbles * 1.4 - k * 0.18));
          if (p <= 0) return null;
          const x = 900 + p * (MITU.x - 900) + k * 30;
          const y = 330 - k * 46 + p * 150 + Math.sin(t * 2 + k) * 6;
          return <Bubble key={k} x={x} y={y} w={140 + k * 10} op={1 - p * 0.55} blank={p > 0.55} />;
        })}

      {/* Sign card beside Mitu's desk in the ending (an illustrated placeholder, not a real clip) */}
      {card > 0 && (
        <g transform={`translate(${MITU.x - 380} ${MITU.y - 440}) scale(${0.8 + card * 0.2})`} opacity={card}>
          <rect x={0} y={0} width={230} height={250} rx={22} fill="#171b23" stroke="#8ab4ff" strokeWidth={3} />
          <rect x={14} y={14} width={202} height={170} rx={14} fill="#1e2330" />
          <circle cx={115} cy={70} r={26} fill="#a56a45" />
          <path d="M70 184 C70 130 90 110 115 110 C140 110 160 130 160 184 Z" fill="#3346d3" />
          <g transform={`rotate(${Math.sin(t * 3) * 14} 150 120)`}>
            <rect x={146} y={60} width={16} height={64} rx={8} fill="#3346d3" />
            <circle cx={154} cy={56} r={11} fill="#a56a45" />
          </g>
          <text x={115} y={215} textAnchor="middle" fontFamily={FONT_BN} fontSize={24} fontWeight={600} fill="#fff" lang="bn">
            সালোকসংশ্লেষণ
          </text>
          <text x={115} y={240} textAnchor="middle" fontFamily={FONT} fontSize={15} fill="#ffb46b" fontWeight={600}>
            Sign clip · illustration
          </text>
        </g>
      )}

      {/* Warm-light overlay for the ending */}
      <rect width={1920} height={1080} fill="#ffcf8a" opacity={0.08 * light} />
    </svg>
  );
};
