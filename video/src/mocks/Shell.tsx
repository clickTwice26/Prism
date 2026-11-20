import React from "react";
import { C, FONT, FONT_BN } from "../theme";
import { Icon } from "../components/Icons";

// Faithful mocks of Prism's UI (dark mode), rebuilt from the real components.
// The screen is 1440×900; DeviceMockup scales it.

const NAV = [
  { title: null, items: [{ id: "home", label: "Home", hint: "Start here", icon: "home" }] },
  {
    title: "LEARN",
    items: [
      { id: "lessons", label: "Lessons", hint: "Text with signs", icon: "book" },
      { id: "live", label: "Live class", hint: "Captions and interpreter", icon: "video" },
      { id: "fingerspell", label: "Fingerspell", hint: "Spell with your hands", icon: "hand" },
      { id: "dictionary", label: "Sign dictionary", hint: "Watch a 3D signer", icon: "doc" },
      { id: "signs", label: "Sign words", hint: "Sign and get feedback", icon: "people" },
    ],
  },
  { title: "TEACH", items: [{ id: "sign", label: "Sign glossary", hint: "Terms, review, lexicon", icon: "people" }] },
];

export const Shell: React.FC<{ active: string; children: React.ReactNode; contrast?: boolean }> = ({ active, children, contrast }) => {
  const fg = contrast ? C.hcYellow : C.lightBlue;
  return (
    <div style={{ width: 1440, height: 900, display: "flex", background: contrast ? "#000" : C.ink, fontFamily: FONT, color: "#fff" }}>
      <div style={{ width: 264, flex: "none", borderRight: `1px solid ${C.line}`, background: contrast ? "#000" : "#12151c", padding: "22px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 12px 22px", fontSize: 22, fontWeight: 700 }}>
          <span style={{ color: fg }}>
            <Icon name="prism" size={26} />
          </span>
          Prism
        </div>
        {NAV.map((sec, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            {sec.title && <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", color: C.text3, padding: "14px 14px 6px" }}>{sec.title}</div>}
            {sec.items.map((it) => {
              const on = it.id === active;
              return (
                <div
                  key={it.id}
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                    padding: "8px 12px",
                    minHeight: 48,
                    borderRadius: 10,
                    background: on ? (contrast ? "#ffe60022" : "rgba(138,180,255,0.14)") : "transparent",
                    color: on ? fg : "#fff",
                  }}
                >
                  <Icon name={it.icon} size={22} />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{it.label}</div>
                    <div style={{ fontSize: 12.5, color: on ? fg : C.text3, opacity: on ? 0.85 : 1 }}>{it.hint}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12, display: "flex", gap: 14, alignItems: "center", padding: "14px 12px", color: C.text2, fontSize: 15 }}>
          <Icon name="settings" size={22} /> Reading settings
        </div>
      </div>
      <div style={{ flex: 1, padding: "34px 44px", overflow: "hidden", position: "relative" }}>{children}</div>
    </div>
  );
};

export const PageHeader: React.FC<{ title: string; lead?: string }> = ({ title, lead }) => (
  <div style={{ marginBottom: 22 }}>
    <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.02em" }}>{title}</div>
    {lead && <div style={{ fontSize: 18, color: C.text2, marginTop: 8, maxWidth: 820, lineHeight: 1.55 }}>{lead}</div>}
  </div>
);

export const Panel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 24, ...style }}>{children}</div>
);

export const MChip: React.FC<{ children: React.ReactNode; on?: boolean; style?: React.CSSProperties }> = ({ children, on, style }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontSize: 14,
      fontWeight: 500,
      padding: "5px 12px",
      borderRadius: 999,
      background: on ? "rgba(138,180,255,0.18)" : "rgba(255,255,255,0.08)",
      color: on ? C.lightBlue : "#fff",
      border: on ? "1px solid rgba(138,180,255,0.5)" : "1px solid transparent",
      ...style,
    }}
  >
    {children}
  </span>
);

export const Tabs: React.FC<{ items: string[]; on: number }> = ({ items, on }) => (
  <div style={{ display: "flex", gap: 6, borderBottom: `1px solid ${C.line}`, marginBottom: 20 }}>
    {items.map((it, i) => (
      <div key={it} style={{ padding: "12px 18px", fontSize: 15.5, fontWeight: 600, color: i === on ? C.lightBlue : C.text2, borderBottom: i === on ? `3px solid ${C.lightBlue}` : "3px solid transparent" }}>
        {it}
      </div>
    ))}
  </div>
);

export const Switch: React.FC<{ on: boolean; label: string; contrast?: boolean }> = ({ on, label, contrast }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 15.5 }}>
    <div style={{ width: 42, height: 24, borderRadius: 12, background: on ? (contrast ? C.hcYellow : "rgba(138,180,255,0.55)") : "rgba(255,255,255,0.25)", position: "relative" }}>
      <div style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 20, height: 20, borderRadius: 10, background: on ? C.lightBlue : "#ddd", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }} />
    </div>
    {label}
  </div>
);

export const Bn: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <span lang="bn" style={{ fontFamily: FONT_BN, lineHeight: 1.9, ...style }}>
    {children}
  </span>
);

export const Btn: React.FC<{ children: React.ReactNode; primary?: boolean; style?: React.CSSProperties }> = ({ children, primary, style }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "11px 22px",
      borderRadius: 10,
      fontSize: 15.5,
      fontWeight: 600,
      background: primary ? C.lightBlue : "transparent",
      color: primary ? "#0f1218" : C.lightBlue,
      border: primary ? "none" : "1px solid rgba(138,180,255,0.5)",
      ...style,
    }}
  >
    {children}
  </span>
);

/** Illustrated stand-in for a human signer's clip. Never a real person. */
export const SignerPlaceholder: React.FC<{ t: number; w: number; h: number; label?: string; skin?: string; top?: string }> = ({
  t,
  w,
  h,
  label = "Sign clip · placeholder",
  skin = "#a56a45",
  top = "#2c3550",
}) => (
  <div style={{ width: w, height: h, borderRadius: 12, background: "linear-gradient(#232a3b, #1a1f2b)", position: "relative", overflow: "hidden" }}>
    <svg viewBox="0 0 200 160" width={w} height={h} preserveAspectRatio="xMidYMax meet" style={{ position: "absolute", inset: 0 }}>
      <path d="M50 160 C50 112 72 96 100 96 C128 96 150 112 150 160 Z" fill={top} />
      <rect x={93} y={78} width={14} height={20} fill={skin} />
      <ellipse cx={100} cy={62} rx={22} ry={25} fill={skin} />
      <path d="M77 60 C74 30 126 28 123 60 C114 44 88 42 77 60 Z" fill="#1d1513" />
      <circle cx={92} cy={62} r={2.2} fill="#111" />
      <circle cx={108} cy={62} r={2.2} fill="#111" />
      {/* Arms: forearms move in front of the chest, hands below the chin */}
      <g transform={`rotate(${-35 + Math.sin(t * 3.2) * 18} 128 124)`}>
        <rect x={122} y={84} width={13} height={42} rx={6.5} fill={top} />
        <circle cx={128} cy={84} r={9} fill={skin} />
      </g>
      <g transform={`rotate(${35 + Math.sin(t * 3.2 + 1.4) * 14} 72 124)`}>
        <rect x={65} y={86} width={13} height={40} rx={6.5} fill={top} />
        <circle cx={71} cy={86} r={9} fill={skin} />
      </g>
    </svg>
    <div style={{ position: "absolute", left: 8, top: 8, fontSize: 12, fontWeight: 700, color: "#0f1218", background: C.orange, padding: "3px 9px", borderRadius: 6 }}>{label}</div>
  </div>
);
