import React from "react";

// Flat 2D characters, drawn as simple shapes (no real people).

export type Look = {
  skin: string;
  hair: string;
  top: string; // shirt or kameez
  accent?: string; // belt, sash, dupatta
  girl?: boolean;
  braids?: boolean;
  bun?: boolean;
};

/** A seated student behind a desk, seen from the front, head turned slightly left. */
export const Student: React.FC<{ x: number; y: number; s?: number; look: Look; raise?: number; glow?: number }> = ({
  x,
  y,
  s = 1,
  look,
  raise = 0,
  glow = 0,
}) => {
  const armAngle = -150 * raise; // raise the right arm
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {glow > 0 && <ellipse cx={0} cy={-40} rx={120} ry={140} fill="#ffb46b" opacity={0.18 * glow} />}
      {/* Body */}
      <path d="M-52 60 C-52 0 -34 -18 0 -18 C34 -18 52 0 52 60 Z" fill={look.top} />
      {look.accent && <path d="M-40 4 L40 44 L40 56 L-40 16 Z" fill={look.accent} opacity={0.95} />}
      {/* Collar */}
      <path d="M-14 -16 L0 4 L14 -16 Z" fill="#ffffff" opacity={0.9} />
      {/* Raised arm (behind head when up) */}
      <g transform={`translate(40 6) rotate(${armAngle})`}>
        <rect x={-10} y={0} width={20} height={62} rx={10} fill={look.top} />
        <circle cx={0} cy={66} r={11} fill={look.skin} />
      </g>
      {/* Neck and head */}
      <rect x={-9} y={-34} width={18} height={20} fill={look.skin} />
      <g transform="rotate(-6 0 -62)">
        {look.braids && (
          <>
            <path d="M-34 -62 C-46 -20 -40 10 -32 22" stroke={look.hair} strokeWidth={13} strokeLinecap="round" fill="none" />
            <path d="M34 -62 C46 -20 40 10 32 22" stroke={look.hair} strokeWidth={13} strokeLinecap="round" fill="none" />
            <circle cx={-32} cy={24} r={7} fill="#3346d3" />
            <circle cx={32} cy={24} r={7} fill="#3346d3" />
          </>
        )}
        <ellipse cx={0} cy={-62} rx={31} ry={34} fill={look.skin} />
        {/* Hair */}
        {look.girl ? (
          <path d="M-33 -60 C-36 -98 36 -104 34 -60 C26 -80 -2 -86 -33 -60 Z" fill={look.hair} />
        ) : (
          <path d="M-32 -64 C-34 -100 34 -102 32 -66 C20 -80 -10 -84 -32 -64 Z" fill={look.hair} />
        )}
        {look.bun && <circle cx={0} cy={-100} r={14} fill={look.hair} />}
        {/* Face, looking towards the board on the left */}
        <circle cx={-13} cy={-62} r={3.4} fill="#1d1a1a" />
        <circle cx={9} cy={-62} r={3.4} fill="#1d1a1a" />
        <path d="M-10 -46 Q-3 -42 4 -46" stroke="#7a3b2e" strokeWidth={2.6} fill="none" strokeLinecap="round" />
        <ellipse cx={-22} cy={-52} rx={6} ry={4} fill="#e58a7a" opacity={0.35} />
      </g>
    </g>
  );
};

export const Desk: React.FC<{ x: number; y: number; w: number; s?: number }> = ({ x, y, w, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x={-w / 2} y={0} width={w} height={22} rx={6} fill="#a8653a" />
    <rect x={-w / 2} y={18} width={w} height={70} fill="#8a5130" />
    <rect x={-w / 2 + 14} y={88} width={14} height={60} fill="#6d3f25" />
    <rect x={w / 2 - 28} y={88} width={14} height={60} fill="#6d3f25" />
    {/* Exercise books */}
    <rect x={-60} y={-8} width={70} height={10} rx={2} fill="#f3efe6" transform="rotate(-4)" />
    <rect x={10} y={-8} width={56} height={10} rx={2} fill="#e8d9b5" transform="rotate(3)" />
  </g>
);

/** A teacher standing, pointing at the board on the left. */
export const Teacher: React.FC<{ x: number; y: number; s?: number; t: number }> = ({ x, y, s = 1, t }) => {
  const talk = (Math.sin(t * 9) + 1) / 2;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {/* Sari: long body with a draped pallu */}
      <path d="M-60 40 C-62 -40 -40 -70 0 -70 C40 -70 62 -40 60 40 L78 330 L-78 330 Z" fill="#1f7a6d" />
      <path d="M-30 -66 C10 -40 50 40 70 140 L40 150 C30 60 0 0 -44 -40 Z" fill="#e2a33a" />
      <path d="M-78 300 L78 300 L78 330 L-78 330 Z" fill="#e2a33a" />
      {/* Pointing arm */}
      <g transform={`translate(-46 -40) rotate(${70 + Math.sin(t * 1.3) * 4})`}>
        <rect x={-11} y={0} width={22} height={110} rx={11} fill="#1f7a6d" />
        <circle cx={0} cy={116} r={13} fill="#a56a45" />
      </g>
      {/* Other arm holding chalk */}
      <rect x={40} y={-40} width={22} height={120} rx={11} fill="#1f7a6d" transform="rotate(-8 50 -40)" />
      <circle cx={58} cy={84} r={13} fill="#a56a45" />
      {/* Head */}
      <rect x={-11} y={-92} width={22} height={26} fill="#a56a45" />
      <ellipse cx={0} cy={-122} rx={36} ry={40} fill="#a56a45" />
      <path d="M-38 -118 C-44 -172 44 -172 38 -118 C28 -150 -20 -152 -38 -118 Z" fill="#1d1513" />
      <circle cx={34} cy={-150} r={18} fill="#1d1513" />
      <circle cx={-14} cy={-124} r={3.6} fill="#1d1a1a" />
      <circle cx={-34} cy={-124} r={3.2} fill="#1d1a1a" opacity={0.9} />
      <circle cx={-24} cy={-138} r={2.6} fill="#c2410c" />
      {/* Mouth, moving while she talks */}
      <ellipse cx={-22} cy={-104} rx={7} ry={2 + talk * 4} fill="#7a3b2e" />
    </g>
  );
};

/** Mother and daughter at home with a laptop (Sign words scene). */
export const HomeScene: React.FC<{ t: number }> = ({ t }) => (
  <svg viewBox="0 0 800 560" width="100%" height="100%">
    <defs>
      <linearGradient id="homeWall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f1d9b8" />
        <stop offset="1" stopColor="#e7c39a" />
      </linearGradient>
    </defs>
    <rect width={800} height={560} rx={28} fill="url(#homeWall)" />
    <rect x={520} y={50} width={200} height={170} rx={10} fill="#bfe0ef" />
    <path d="M520 135 H720 M620 50 V220" stroke="#f6efe4" strokeWidth={10} />
    <rect x={0} y={400} width={800} height={160} fill="#c48a5a" />
    {/* Plant */}
    <rect x={60} y={300} width={56} height={60} rx={8} fill="#c2410c" />
    <path d="M88 300 C60 240 70 200 88 180 C106 200 116 240 88 300 Z" fill="#3f8f5a" />
    <path d="M88 300 C40 270 30 240 40 220 C70 230 86 260 88 300 Z" fill="#4fa86b" />
    {/* Table */}
    <rect x={180} y={380} width={480} height={22} rx={8} fill="#7a4a2c" />
    {/* Laptop */}
    <g transform="translate(330 270)">
      <rect x={0} y={0} width={180} height={112} rx={8} fill="#1b1f29" />
      <rect x={8} y={8} width={164} height={96} rx={4} fill="#0f1218" />
      <rect x={18} y={20} width={60} height={70} rx={4} fill="#26304a" />
      <path d="M38 75 l10 -30 l10 30" stroke="#8ab4ff" strokeWidth={2.5} fill="none" />
      <rect x={88} y={24} width={74} height={8} rx={4} fill="#8ab4ff" />
      <rect x={88} y={40} width={60} height={6} rx={3} fill="#ffffff55" />
      <rect x={88} y={54} width={66} height={6} rx={3} fill="#ffffff55" />
      <rect x={88} y={72} width={44} height={12} rx={6} fill="#6ee7a8" />
      <rect x={-14} y={110} width={208} height={8} rx={4} fill="#2a2f3b" />
    </g>
    {/* Mother, signing */}
    <g transform="translate(250 330) scale(1.15)">
      <path d="M-62 60 C-62 -20 -40 -44 0 -44 C40 -44 62 -20 62 60 Z" fill="#8c3b6b" />
      <path d="M-40 -40 C-10 -10 30 20 50 60 L30 60 C14 30 -10 0 -48 -24 Z" fill="#f0b45a" />
      <rect x={-10} y={-62} width={20} height={22} fill="#9c6440" />
      <ellipse cx={0} cy={-92} rx={32} ry={35} fill="#9c6440" />
      <path d="M-34 -88 C-40 -136 40 -136 34 -88 C24 -116 -20 -118 -34 -88 Z" fill="#1d1513" />
      <circle cx={10} cy={-94} r={3.2} fill="#1d1a1a" />
      <circle cx={-10} cy={-94} r={3.2} fill="#1d1a1a" />
      <path d="M-8 -76 Q0 -70 8 -76" stroke="#6b2f22" strokeWidth={2.6} fill="none" strokeLinecap="round" />
      {/* Hand at the forehead: the start of the sign for fever */}
      <g transform={`rotate(${-150 + Math.sin(t * 2) * 6} 40 -20)`}>
        <rect x={30} y={-20} width={20} height={80} rx={10} fill="#8c3b6b" />
      </g>
      <circle cx={24} cy={-112 + Math.sin(t * 2) * 4} r={12} fill="#9c6440" />
    </g>
    {/* Daughter, watching */}
    <g transform="translate(585 360)">
      <path d="M-46 50 C-46 -10 -30 -30 0 -30 C30 -30 46 -10 46 50 Z" fill="#ffffff" />
      <path d="M-36 -2 L36 34 L36 44 L-36 8 Z" fill="#3346d3" />
      <rect x={-8} y={-46} width={16} height={18} fill="#a56a45" />
      <ellipse cx={0} cy={-72} rx={27} ry={30} fill="#a56a45" />
      <path d="M-28 -70 C-32 -110 30 -112 28 -70 C20 -90 -4 -94 -28 -70 Z" fill="#1d1513" />
      <path d="M-28 -70 C-38 -36 -34 -10 -26 2" stroke="#1d1513" strokeWidth={11} strokeLinecap="round" fill="none" />
      <circle cx={-12} cy={-72} r={3} fill="#1d1a1a" />
      <circle cx={6} cy={-72} r={3} fill="#1d1a1a" />
      <path d="M-10 -58 Q-3 -53 4 -58" stroke="#6b2f22" strokeWidth={2.4} fill="none" strokeLinecap="round" />
    </g>
  </svg>
);
