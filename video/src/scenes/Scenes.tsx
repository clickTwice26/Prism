import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, FONT, FONT_BN } from "../theme";
import { COPY, SECTIONS } from "../script";
import { BnLine, Chip, FeatureRow, Headline, IconTile, Kicker, Laptop, Phone, cue, fade, lerp, prog, rise } from "../components/ui";
import { Icon } from "../components/Icons";
import { Classroom, MITU } from "../illus/Classroom";
import { HomeScene } from "../illus/People";
import { DictionaryScreen, FingerspellScreen, HomeScreen, LessonScreen, LiveScreen, MobileLesson, SignWordsScreen } from "../mocks/Screens";

type P = { T: number }; // absolute time in seconds

const section = (id: string) => SECTIONS.find((s) => s.id === id)!;
const scene = (id: string) => SECTIONS.flatMap((s) => s.scenes).find((s) => s.id === id)!;

const TopShade: React.FC = () => (
  <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 170, background: "linear-gradient(rgba(15,18,24,0.85), rgba(15,18,24,0))" }} />
);

// ---- 1. Problem ---------------------------------------------------------------------

export const ClassroomScene: React.FC<P> = ({ T }) => {
  const push = prog(T, 0.3, 7.6);
  const s = lerp(1, 1.55, push);
  const deaf = cue("deaf");
  const bub = prog(T, cue("class").start - 0.3, deaf.end - cue("class").start + 0.6);
  const name = cue("mitu");
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={{ width: 1920, height: 1080, transform: `scale(${s})`, transformOrigin: `${MITU.x}px ${MITU.y - 120}px` }}>
        <Classroom t={T} bubbles={bub} mituGlow={prog(T, deaf.start, 0.8)} />
        <div
          style={{
            position: "absolute",
            left: MITU.x + 48,
            top: MITU.y - 118,
            ...rise(T, name.start, 14),
            fontFamily: FONT,
            fontSize: 24,
            fontWeight: 700,
            color: "#0f1218",
            background: C.orange,
            padding: "6px 14px",
            borderRadius: 10,
          }}
        >
          Mitu · <span lang="bn" style={{ fontFamily: FONT_BN }}>মিতু</span>
        </div>
      </div>
      <TopShade />
    </AbsoluteFill>
  );
};

// Newspaper montage: real articles from Bangladesh's national press, captured unedited by
// tools/press.mjs (the orange highlight is a background colour added on the page before capture).
const pressEnd = () => cue("few").end + 0.35;

const PressCard: React.FC<{ card: (typeof COPY.press.cards)[number]; life: number }> = ({ card, life }) => {
  const bn = card.id === "prothomalo" || card.id === "bdnews24";
  return (
    <div
      style={{
        width: 850,
        background: "#fbfaf7",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 30px 80px rgba(0,0,0,0.55), 0 4px 14px rgba(0,0,0,0.35)",
        transform: `scale(${1 + life * 0.025})`,
        transformOrigin: "50% 40%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 26px", background: "#11151c", fontFamily: FONT }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>{card.paper}</span>
        {"bnPaper" in card && card.bnPaper ? (
          <span lang="bn" style={{ fontFamily: FONT_BN, fontSize: 21, color: C.text2 }}>
            {card.bnPaper}
          </span>
        ) : null}
        <span style={{ marginLeft: "auto", fontSize: 19, color: C.text2 }}>{card.date}</span>
        {"label" in card && card.label ? (
          <span style={{ fontSize: 15, fontWeight: 700, color: "#11151c", background: C.orange, borderRadius: 8, padding: "3px 10px", letterSpacing: "0.04em" }}>{card.label}</span>
        ) : null}
      </div>
      <div style={{ padding: "14px 4px 0" }}>
        <Img src={staticFile(`press/${card.id}-head.png`)} style={{ width: "100%", display: "block", maxHeight: 210, objectFit: "contain", objectPosition: "left top" }} />
      </div>
      {"en" in card && card.en ? (
        <div style={{ fontFamily: FONT, fontSize: 19, fontStyle: "italic", color: "#535a6b", padding: "2px 28px 4px", lineHeight: 1.35 }}>{card.en}</div>
      ) : null}
      <div style={{ height: 2, background: "rgba(20,22,31,0.08)", margin: "10px 28px 0" }} />
      <div
        style={{
          padding: "6px 4px 0",
          maxHeight: bn ? 250 : 290,
          overflow: "hidden",
          WebkitMaskImage: "linear-gradient(#000 78%, transparent)",
          maskImage: "linear-gradient(#000 78%, transparent)",
        }}
      >
        <Img src={staticFile(`press/${card.id}-quote.png`)} style={{ width: "100%", display: "block" }} />
      </div>
    </div>
  );
};

const PressMontage: React.FC<P> = ({ T }) => {
  const P = COPY.press;
  const end = pressEnd();
  const arrive = P.cards.map((c) => cue(c.at).start + c.delay);
  const out = 1 - prog(T, end - 0.25, 0.5);
  if (out <= 0) return null;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", left: 100, top: 150 }}>
        <Kicker text={P.kicker} bn={P.bn} style={rise(T, arrive[0] - 0.2, 16)} />
      </div>
      {P.cards.map((c, i) => {
        const next = P.cards.findIndex((d, j) => j > i && d.slot === c.slot);
        const leaveAt = next >= 0 ? arrive[next] - 0.1 : end;
        const pin = prog(T, arrive[i], 0.7);
        const pout = next >= 0 ? prog(T, leaveAt, 0.5) : 0;
        if (pin <= 0 || pout >= 1) return null;
        const x = c.slot === 0 ? 90 : 980;
        const rot = (c.slot === 0 ? -1.3 : 1.1) * (1 - pout);
        const life = Math.max(0, Math.min(1, (T - arrive[i]) / 6));
        return (
          <div
            key={c.id}
            style={{
              position: "absolute",
              left: x,
              top: 232,
              opacity: pin * (1 - pout),
              transform: `translateY(${(1 - pin) * 70 - pout * 40}px) rotate(${rot}deg) scale(${1 - pout * 0.06})`,
              zIndex: i,
            }}
          >
            <PressCard card={c} life={life} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const WhyScene: React.FC<P> = ({ T }) => {
  const p = COPY.problem;
  const B = pressEnd(); // the summary layout builds after the newspaper montage
  const cardAt = [B + 0.15, B + 0.45, B + 0.75];
  const statsAt = cue("global").start;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: 0.35, filter: "blur(6px)" }}>
        <Classroom t={T} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "rgba(15,18,24,0.80)" }} />
      <PressMontage T={T} />
      <div style={{ position: "absolute", left: 100, top: 150, width: 1720, opacity: prog(T, B - 0.1, 0.4) }}>
        <Kicker text={section("problem").kicker} bn={section("problem").bn} style={rise(T, B, 16)} />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 60, marginTop: 18 }}>
          <div style={rise(T, B + 0.05)}>
            <Headline text={p.headline} size={64} />
          </div>
          <BnLine text={p.headlineBn} size={30} style={{ ...rise(T, B + 0.2), marginBottom: 6 }} />
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 34 }}>
          {p.cards.map((c, i) => (
            <div key={c.title} style={{ flex: 1, ...rise(T, cardAt[i], 30), background: "rgba(23,27,35,0.92)", border: `1px solid ${C.line}`, borderRadius: 20, padding: "24px 26px", display: "flex", gap: 20, alignItems: "center" }}>
              <IconTile name={c.icon} tone="orange" size={62} />
              <div style={{ fontFamily: FONT }}>
                <div style={{ fontSize: 27, fontWeight: 700, color: "#fff" }}>{c.title}</div>
                <div style={{ fontSize: 20, color: C.text2, marginTop: 4, lineHeight: 1.35 }}>{c.text}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 26, ...rise(T, B + 1.0, 12) }}>
          <span style={{ fontFamily: FONT, fontSize: 20, fontWeight: 700, color: C.text2, letterSpacing: "0.12em", marginRight: 6 }}>WHO IT'S FOR</span>
          {p.who.map((w) => (
            <Chip key={w} tone="blue">
              {w}
            </Chip>
          ))}
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 26 }}>
          {[...p.bdStats.map((s) => ({ ...s, where: "BANGLADESH" })), { ...p.worldStat, where: "WORLD" }].map((s, i) => (
            <div
              key={s.big}
              style={{
                flex: i === 2 ? 1.25 : 1,
                ...rise(T, i < 2 ? B + 1.3 + i * 0.3 : statsAt + 0.3, 20),
                borderRadius: 18,
                padding: "16px 22px",
                background: i === 2 ? "rgba(51,70,211,0.22)" : "rgba(23,27,35,0.92)",
                border: `1px solid ${i === 2 ? "rgba(138,180,255,0.4)" : C.line}`,
                fontFamily: FONT,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.14em", color: i === 2 ? C.lightBlue : C.orange }}>{s.where}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                <div style={{ fontSize: 46, fontWeight: 800, color: "#fff", whiteSpace: "nowrap" }}>{s.big}</div>
                <div style={{ fontSize: 19, color: C.text2, lineHeight: 1.3 }}>{s.text}</div>
              </div>
              <div style={{ fontSize: 13, color: C.text3, marginTop: 2 }}>Source: {s.source}</div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---- 2. Solution ------------------------------------------------------------------------

const PrismLogo: React.FC<{ p: number; size?: number }> = ({ p, size = 120 }) => {
  const colors = ["#ff6b6b", "#ffb46b", "#ffe08a", "#6ee7a8", "#8ab4ff", "#a78bfa"];
  return (
    <svg width={size * 3.2} height={size} viewBox="0 0 320 100">
      <line x1={0} y1={58} x2={lerp(0, 132, Math.min(1, p * 2))} y2={52} stroke="#fff" strokeWidth={4} strokeLinecap="round" />
      <path d="M160 8 L204 92 L116 92 Z" fill="rgba(138,180,255,0.18)" stroke="#8ab4ff" strokeWidth={3.5} strokeLinejoin="round" />
      {colors.map((c, i) => {
        const q = Math.max(0, Math.min(1, p * 2 - 1));
        return <line key={c} x1={176} y1={54} x2={lerp(176, 320, q)} y2={lerp(54, 26 + i * 14, q)} stroke={c} strokeWidth={4} strokeLinecap="round" opacity={0.9} />;
      })}
    </svg>
  );
};

export const MeetScene: React.FC<P> = ({ T }) => {
  const sc = scene("meet");
  const s = COPY.solution;
  const fly = prog(T, sc.start + 0.8, 0.9);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 100, top: 170, width: 820 }}>
        <Kicker text={section("solution").kicker} bn={section("solution").bn} style={rise(T, sc.start + 0.1, 16)} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 26 }}>
          <PrismLogo p={prog(T, sc.start + 0.2, 1.4)} size={70} />
          <div style={{ fontFamily: FONT, fontSize: 44, fontWeight: 800, color: "#fff", ...fade(T, sc.start + 1.0) }}>Prism Sign</div>
        </div>
        <div style={{ marginTop: 26, ...rise(T, cue("brings").start) }}>
          <Headline text={s.headline} size={66} />
        </div>
        <BnLine text={s.headlineBn} size={36} style={{ marginTop: 14, ...rise(T, cue("brings").start + 0.4) }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 30 }}>
          {s.chips.map((c, i) => (
            <div key={c} style={rise(T, cue("for").start + i * 0.15, 14)}>
              <Chip tone={i === 4 ? "orange" : "blue"}>{c}</Chip>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", left: 960, top: 230, opacity: fly, transform: `translateX(${(1 - fly) * 160}px)` }}>
        <Laptop width={860} t={T}>
          <HomeScreen />
        </Laptop>
      </div>
      <div style={{ position: "absolute", left: 1600, top: 420, ...rise(T, sc.start + 1.6, 60, 0.8) }}>
        <Phone width={230} t={T}>
          <MobileLesson t={T} />
        </Phone>
      </div>
    </AbsoluteFill>
  );
};

const FlowCol: React.FC<{ title: string; items: string[]; icons: string[]; at: number; T: number; tone: "blue" | "orange" | "plain" }> = ({ title, items, icons, at, T, tone }) => (
  <div
    style={{
      width: 470,
      ...rise(T, at, 24),
      background: tone === "orange" ? "rgba(194,65,12,0.16)" : tone === "blue" ? "rgba(51,70,211,0.20)" : "rgba(23,27,35,0.9)",
      border: `1.5px solid ${tone === "orange" ? "rgba(255,180,107,0.55)" : tone === "blue" ? "rgba(138,180,255,0.5)" : C.line}`,
      borderRadius: 22,
      padding: "20px 24px",
      fontFamily: FONT,
    }}
  >
    <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "0.16em", color: tone === "orange" ? C.orange : C.lightBlue, marginBottom: 12 }}>{title.toUpperCase()}</div>
    {items.map((it, i) => (
      <div key={it} style={{ display: "flex", gap: 14, alignItems: "center", marginTop: i ? 12 : 0, ...rise(T, at + 0.2 + i * 0.15, 10) }}>
        <Icon name={icons[i]} size={28} color={tone === "orange" ? C.orange : C.lightBlue} />
        <div style={{ fontSize: 22, color: "#fff", fontWeight: 600 }}>{it}</div>
      </div>
    ))}
  </div>
);

const Arrow: React.FC<{ T: number; at: number }> = ({ T, at }) => {
  const p = prog(T, at, 0.5);
  return (
    <svg width={90} height={40} style={{ flex: "none", opacity: p }}>
      <line x1={8} y1={20} x2={8 + 64 * p} y2={20} stroke={C.orange} strokeWidth={4} strokeLinecap="round" />
      <path d="M66 10 L80 20 L66 30" fill="none" stroke={C.orange} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={p > 0.8 ? 1 : 0} />
    </svg>
  );
};

export const FlowScene: React.FC<P> = ({ T }) => {
  const sc = scene("flow");
  const f = COPY.solution.flow;
  const at = sc.start + 0.3;
  const diff = [cue("routine").start, cue("approve").start, cue("private").start];
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 100, top: 140, right: 100 }}>
        <Kicker text={section("solution").kicker} bn={section("solution").bn} style={rise(T, sc.start, 16)} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginTop: 10 }}>
          <Headline text={COPY.solution.flowTitle} size={58} style={rise(T, sc.start + 0.15)} />
          <BnLine text={COPY.solution.flowBn} size={30} style={rise(T, sc.start + 0.35)} />
          <div style={{ flex: 1 }} />
          <div style={{ fontFamily: FONT, fontSize: 22, color: C.text2, ...fade(T, sc.start + 0.5) }}>input → AI → output</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 26 }}>
          <FlowCol title={f.input.title} items={f.input.items} icons={["text", "mic", "camera"]} at={at} T={T} tone="plain" />
          <Arrow T={T} at={at + 0.7} />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <FlowCol title={f.ai.title} items={f.ai.items} icons={["sparkle", "cc", "hand"]} at={at + 0.9} T={T} tone="blue" />
            <div style={{ ...rise(T, at + 1.6, 12), display: "flex", gap: 10, alignItems: "center", justifyContent: "center", fontFamily: FONT, fontSize: 20, fontWeight: 700, color: C.orange, background: "rgba(194,65,12,0.16)", border: "1.5px dashed rgba(255,180,107,0.6)", borderRadius: 14, padding: "10px 14px" }}>
              <Icon name="people" size={24} /> {f.human}
            </div>
          </div>
          <Arrow T={T} at={at + 1.8} />
          <FlowCol title={f.output.title} items={f.output.items} icons={["book", "link", "target"]} at={at + 2.0} T={T} tone="orange" />
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 30 }}>
          {COPY.solution.different.map((d, i) => {
            const on = T >= diff[i] && (i === 2 || T < diff[i + 1]);
            return (
              <div key={d.title} style={{ flex: 1, ...rise(T, diff[i] - 0.1, 20), padding: "16px 20px", borderRadius: 18, background: on ? "rgba(194,65,12,0.18)" : "rgba(23,27,35,0.9)", border: `1.5px solid ${on ? "rgba(255,180,107,0.6)" : C.line}` }}>
                <FeatureRow icon={d.icon} title={d.title} text={d.text} active={on} />
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---- 3. Demo -----------------------------------------------------------------------------

const ChapterText: React.FC<{ T: number; i: number; start: number; rowsAt: number[] }> = ({ T, i, start, rowsAt }) => {
  const ch = COPY.demo.chapters[i];
  return (
    <div style={{ position: "absolute", left: 1230, top: 190, width: 640 }}>
      <Kicker text={`DEMO · ${ch.n}`} style={rise(T, start + 0.1, 14)} />
      <Kicker text={ch.kicker} bn={ch.bn} style={{ ...rise(T, start + 0.2, 14), marginTop: 6, fontSize: 19, color: C.lightBlue }} />
      <Headline text={ch.headline} size={50} style={{ marginTop: 16, ...rise(T, start + 0.3) }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 26, marginTop: 34 }}>
        {ch.rows.map((r, k) => {
          const on = T >= rowsAt[k] && (k === ch.rows.length - 1 || T < rowsAt[k + 1]);
          return <FeatureRow key={r.title} icon={r.icon} title={r.title} text={r.text} active={on} style={rise(T, Math.min(rowsAt[k], start + 0.5 + k * 0.15), 18)} />;
        })}
      </div>
    </div>
  );
};

const DemoLaptop: React.FC<{ T: number; start: number; children: React.ReactNode; zoom?: { scale: number; x: number; y: number } }> = ({ T, start, children, zoom }) => {
  const p = prog(T, start, 0.7);
  return (
    <div style={{ position: "absolute", left: 70, top: 185, opacity: p, transform: `translateX(${(1 - p) * -80}px)` }}>
      <Laptop width={1090} t={T} zoom={zoom}>
        {children}
      </Laptop>
    </div>
  );
};

/** Eases a zoom in at `a` and back out at `b`. */
const zoomBetween = (T: number, a: number, b: number, target: { scale: number; x: number; y: number }) => {
  const k = prog(T, a, 0.7) * (1 - prog(T, b, 0.7));
  return { scale: lerp(1, target.scale, k), x: target.x, y: target.y };
};

export const LessonsScene: React.FC<P> = ({ T }) => {
  const sc = scene("lessons");
  const u = cue("underlined");
  const tap = cue("tap");
  const win = cue("window");
  const unrec = cue("unrecorded");
  const prev = cue("preview");
  const lang = T < tap.end + 0.4 ? "bn" : T < win.end - 1.2 ? "en" : "ms";
  const tapAt = tap.start + 0.5;
  // Interpreter window: appear, move to the top corner, grow, then hide.
  const w0 = prog(T, win.start - 0.2, 0.5);
  const move = prog(T, win.start + 1.0, 0.8);
  const grow = prog(T, win.start + 2.2, 0.6);
  const hide = prog(T, win.end - 0.6, 0.4);
  const interp = { on: w0 * (1 - hide), x: lerp(780, 760, move), y: lerp(560, 120, move), w: lerp(300, 330, grow) };
  const dict = prog(T, unrec.start - 0.3, 0.6);
  const zoom = T < unrec.start ? zoomBetween(T, u.start + 0.2, tapAt + 1.4, { scale: 1.55, x: 520, y: 400 }) : { scale: 1, x: 720, y: 450 };
  return (
    <AbsoluteFill>
      <DemoLaptop T={T} start={sc.start} zoom={zoom}>
        <div style={{ position: "relative", width: 1440, height: 900 }}>
          <div style={{ position: "absolute", inset: 0, opacity: 1 - dict }}>
            <LessonScreen
              t={T}
              lang={lang}
              highlight={prog(T, u.start + 0.3, 0.4) * (1 - prog(T, tapAt + 2, 0.5))}
              card={prog(T, tapAt + 0.15, 0.35) * (1 - prog(T, win.start - 0.3, 0.4))}
              interp={interp}
              cursor={{ x: lerp(800, 430, prog(T, tap.start - 0.4, 0.8)), y: lerp(620, 378, prog(T, tap.start - 0.4, 0.8)), down: T > tapAt && T < tapAt + 0.35, on: prog(T, tap.start - 0.6, 0.3) * (1 - prog(T, tapAt + 1, 0.3)) }}
            />
          </div>
          {dict > 0 && (
            <div style={{ position: "absolute", inset: 0, opacity: dict }}>
              <DictionaryScreen t={T} typed={"doctor".slice(0, Math.floor(prog(T, unrec.start + 0.2, 1.2) * 6))} slow={T > prev.start + 0.6} results={T > unrec.start + 1.5 ? 2 : 0} />
            </div>
          )}
        </div>
      </DemoLaptop>
      <ChapterText T={T} i={0} start={sc.start} rowsAt={[u.start, win.start, unrec.start]} />
    </AbsoluteFill>
  );
};

export const SignWordsScene: React.FC<P> = ({ T }) => {
  const sc = scene("signwords");
  const checks = cue("checks");
  const parts = cue("parts");
  const fix = cue("fix");
  const attempt: 0 | 1 | 2 = T < parts.start ? 0 : T < fix.end + 0.2 ? 1 : 2;
  const handY = attempt === 2 ? lerp(300, 120, prog(T, fix.end - 0.3, 0.6)) : attempt === 1 ? 300 : lerp(380, 300, prog(T, checks.start, 1));
  const skeleton = prog(T, fix.end + 1.3, 0.7);
  const home = prog(T, sc.start + 0.3, 0.6) * (1 - prog(T, checks.start + 0.4, 0.5));
  return (
    <AbsoluteFill>
      <DemoLaptop T={T} start={sc.start} zoom={zoomBetween(T, parts.start + 0.2, fix.end + 0.6, { scale: 1.35, x: 1110, y: 640 })}>
        <SignWordsScreen t={T} attempt={attempt} skeleton={skeleton} handY={handY} />
      </DemoLaptop>
      {home > 0 && (
        <div style={{ position: "absolute", left: 210, top: 250, width: 800, height: 560, opacity: home, transform: `scale(${0.94 + home * 0.06})`, borderRadius: 28, boxShadow: "0 30px 80px rgba(0,0,0,0.55)", overflow: "hidden" }}>
          <HomeScene t={T} />
        </div>
      )}
      <ChapterText T={T} i={1} start={sc.start} rowsAt={[cue("parents").start, parts.start, fix.end + 1.2]} />
    </AbsoluteFill>
  );
};

export const FingerspellScene: React.FC<P> = ({ T }) => {
  const sc = scene("fingerspell");
  const p = prog(T, sc.start + 0.8, 4.2);
  return (
    <AbsoluteFill>
      <DemoLaptop T={T} start={sc.start} zoom={zoomBetween(T, sc.start + 0.6, sc.end - 1.4, { scale: 1.25, x: 1040, y: 560 })}>
        <FingerspellScreen t={T} p={p} typed={p > 0.97 ? "ক" : ""} />
      </DemoLaptop>
      <ChapterText T={T} i={2} start={sc.start} rowsAt={[sc.start + 0.4, sc.start + 2, sc.start + 4.5]} />
    </AbsoluteFill>
  );
};

export const LiveScene: React.FC<P> = ({ T }) => {
  const sc = scene("live");
  const join = cue("join");
  const lines = Math.min(4, prog(T, sc.start + 0.6, 7) * 4 + 0.999);
  return (
    <AbsoluteFill>
      <DemoLaptop T={T} start={sc.start}>
        <LiveScreen t={T} lines={lines} interp={prog(T, join.start + 1.6, 0.6)} tap={prog(T, join.start + 0.3, 0.5)} />
      </DemoLaptop>
      <ChapterText T={T} i={3} start={sc.start} rowsAt={[cue("captions").start, join.start, join.start + 1.6]} />
    </AbsoluteFill>
  );
};

// ---- 4. AI approach ------------------------------------------------------------------------

export const AIScene: React.FC<P> = ({ T }) => {
  const sc = scene("layers");
  const a = COPY.ai;
  const layerAt = [cue("gemini").start, cue("speech").start, cue("mediapipe").start];
  const active = T < layerAt[1] ? 0 : T < layerAt[2] ? 1 : T < cue("descriptions").start ? 2 : -1;
  const dataAt = cue("compare").start;
  const loopAt = cue("descriptions").start;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 100, top: 140, right: 100 }}>
        <Kicker text={section("ai").kicker} bn={section("ai").bn} style={rise(T, sc.start, 16)} />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 40, marginTop: 12 }}>
          <Headline text={a.headline} size={56} style={rise(T, sc.start + 0.15)} />
          <BnLine text={a.headlineBn} size={30} style={{ ...rise(T, sc.start + 0.4), marginBottom: 4 }} />
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 30 }}>
          {a.layers.map((l, i) => {
            const on = active === i;
            return (
              <div key={l.name} style={{ flex: 1, ...rise(T, layerAt[i] - 0.2, 26), borderRadius: 22, padding: "20px 22px", background: on ? "rgba(51,70,211,0.26)" : "rgba(23,27,35,0.92)", border: `1.5px solid ${on ? "rgba(138,180,255,0.7)" : C.line}`, fontFamily: FONT }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: on ? C.orange : "rgba(255,255,255,0.1)", color: on ? "#0f1218" : "#fff", fontSize: 22, fontWeight: 800 }}>{l.n}</div>
                  <div style={{ fontSize: 28, fontWeight: 750, color: "#fff" }}>{l.name}</div>
                </div>
                <div style={{ marginTop: 12, display: "inline-block", fontSize: 17, fontWeight: 650, color: C.lightBlue, background: "rgba(51,70,211,0.25)", border: "1px solid rgba(138,180,255,0.35)", borderRadius: 999, padding: "5px 14px" }}>{l.chip}</div>
                <div style={{ marginTop: 12, fontSize: 19.5, color: C.text2, lineHeight: 1.45 }}>{l.text}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 22 }}>
          {[a.data, a.personal].map((b, i) => (
            <div key={b.title} style={{ flex: 1, ...rise(T, dataAt + i * 0.5, 20), borderRadius: 20, padding: "16px 20px", background: "rgba(23,27,35,0.92)", border: `1px solid ${C.line}`, fontFamily: FONT }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 16, fontWeight: 800, letterSpacing: "0.14em", color: C.orange }}>
                <Icon name={i === 0 ? "database" : "user"} size={22} /> {b.title.toUpperCase()}
              </div>
              <div style={{ fontSize: 18.5, color: "#fff", lineHeight: 1.45, marginTop: 8 }}>{b.text}</div>
            </div>
          ))}
          <div style={{ flex: 1.1, ...rise(T, loopAt, 20), borderRadius: 20, padding: "16px 20px", background: "rgba(194,65,12,0.14)", border: "1.5px dashed rgba(255,180,107,0.55)", fontFamily: FONT }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 16, fontWeight: 800, letterSpacing: "0.14em", color: C.orange }}>
              <Icon name="shield" size={22} /> HUMAN IN THE LOOP
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 10 }}>
              {a.loop.map((s, i) => (
                <React.Fragment key={s}>
                  <span style={{ fontSize: 17, fontWeight: 650, color: "#fff", background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "6px 10px", ...fade(T, loopAt + 0.2 + i * 0.25) }}>{s}</span>
                  {i < a.loop.length - 1 && <span style={{ color: C.orange, fontSize: 20, ...fade(T, loopAt + 0.3 + i * 0.25) }}>→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---- 5. Impact and next step -------------------------------------------------------------

export const KpiScene: React.FC<P> = ({ T }) => {
  const sc = scene("kpis");
  const k = COPY.impact;
  const at = [cue("ninety").start, cue("gain").start, cue("rating").start, cue("rating").start + 1.2];
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 100, top: 190, right: 100 }}>
        <Kicker text={section("impact").kicker} bn={section("impact").bn} style={rise(T, sc.start, 16)} />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 40, marginTop: 12 }}>
          <Headline text={k.headline} size={60} style={rise(T, sc.start + 0.15)} />
          <BnLine text={k.headlineBn} size={30} style={{ ...rise(T, sc.start + 0.4), marginBottom: 4 }} />
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 40 }}>
          {k.kpis.map((x, i) => (
            <div key={x.text} style={{ flex: 1, ...rise(T, at[i] - 0.15, 26), borderRadius: 22, padding: "22px 24px", background: "rgba(23,27,35,0.92)", border: `1px solid ${C.line}`, fontFamily: FONT, position: "relative" }}>
              <div style={{ position: "absolute", right: 16, top: 16, fontSize: 13, fontWeight: 800, letterSpacing: "0.1em", color: C.orange, border: "1px solid rgba(255,180,107,0.5)", borderRadius: 999, padding: "3px 10px" }}>
                {k.targetLabel.toUpperCase()}
              </div>
              <div style={{ fontSize: 64, fontWeight: 800, color: C.lightBlue, marginTop: 18 }}>{x.big}</div>
              <div style={{ fontSize: 21, color: "#fff", lineHeight: 1.4, marginTop: 6 }}>{x.text}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 30 }}>
          {k.value.map((v, i) => (
            <div key={v} style={{ flex: 1, ...rise(T, cue("measure").start + 0.4 + i * 0.3, 16), display: "flex", gap: 16, alignItems: "center", padding: "14px 20px", borderRadius: 18, background: "rgba(51,70,211,0.18)", border: "1px solid rgba(138,180,255,0.3)", fontFamily: FONT, fontSize: 22, color: "#fff", fontWeight: 600 }}>
              <Icon name={i === 0 ? "check" : "people"} size={30} color={C.lightBlue} /> {v}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 30, ...rise(T, cue("gain").start, 14) }}>
          <span style={{ fontFamily: FONT, fontSize: 20, fontWeight: 700, color: C.text2, letterSpacing: "0.12em", marginRight: 6 }}>POTENTIAL USERS</span>
          {k.users.map((u) => (
            <Chip key={u} tone="blue">
              {u}
            </Chip>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const CloseScene: React.FC<P> = ({ T }) => {
  const jan = cue("january");
  const tag = cue("tagline");
  const made = cue("made");
  const r = COPY.impact.roadmap;
  const classIn = prog(T, tag.start - 0.4, 0.7);
  const endIn = prog(T, made.start + 0.6, 0.8);
  const e = COPY.end;
  return (
    <AbsoluteFill>
      {/* Roadmap */}
      <div style={{ position: "absolute", left: 160, right: 160, top: 360, opacity: 1 - classIn }}>
        <Kicker text="NEXT STEP" bn="পরবর্তী ধাপ" style={rise(T, scene("close").start, 16)} />
        <div style={{ display: "flex", alignItems: "flex-start", marginTop: 50 }}>
          {r.map((x, i) => (
            <React.Fragment key={x.what}>
              <div style={{ ...rise(T, jan.start - 0.3 + i * 0.45, 20), fontFamily: FONT, width: 420 }}>
                <div style={{ width: 26, height: 26, borderRadius: 13, background: i === 1 ? C.orange : C.lightBlue, boxShadow: `0 0 0 8px ${i === 1 ? "rgba(255,180,107,0.2)" : "rgba(138,180,255,0.2)"}` }} />
                <div style={{ fontSize: 22, fontWeight: 700, color: i === 1 ? C.orange : C.lightBlue, marginTop: 22, letterSpacing: "0.04em" }}>{x.when}</div>
                <div style={{ fontSize: 36, fontWeight: 750, color: "#fff", marginTop: 6 }}>{x.what}</div>
              </div>
              {i < r.length - 1 && <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.2)", marginTop: 11, marginLeft: -370, marginRight: 20, ...fade(T, jan.start + i * 0.45) }} />}
            </React.Fragment>
          ))}
        </div>
      </div>
      {/* Back to the classroom, in warm light */}
      {classIn > 0 && endIn < 1 && (
        <AbsoluteFill style={{ opacity: classIn * (1 - endIn) }}>
          <div style={{ width: 1920, height: 1080, transform: `scale(${lerp(1.15, 1.05, prog(T, tag.start, 4))})`, transformOrigin: `${MITU.x - 200}px ${MITU.y - 200}px` }}>
            <Classroom t={T} light={1} underline={prog(T, tag.start, 0.8)} card={prog(T, tag.start + 0.8, 0.6)} raise={prog(T, tag.start + 1.8, 0.7)} mituGlow={0.6} />
          </div>
          <TopShade />
        </AbsoluteFill>
      )}
      {/* End card */}
      {endIn > 0 && (
        <AbsoluteFill style={{ opacity: endIn, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", paddingBottom: 90 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <PrismLogo p={1} size={64} />
          </div>
          <div style={{ fontFamily: FONT, fontSize: 92, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginTop: 6 }}>{e.title}</div>
          <div style={{ fontFamily: FONT, fontSize: 46, fontWeight: 700, color: "#fff", marginTop: 14 }}>{e.tagline}</div>
          <BnLine text={e.taglineBn} size={40} style={{ marginTop: 10 }} />
          <div style={{ fontFamily: FONT, fontSize: 24, fontWeight: 600, color: C.orange, marginTop: 34 }}>Next: a pilot in deaf schools, January–June 2027</div>
          <div style={{ fontFamily: FONT, fontSize: 22, color: C.text2, marginTop: 12 }}>{e.event}</div>
          <div style={{ fontFamily: FONT, fontSize: 17, color: C.text3, marginTop: 22 }}>{e.credit}</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const SCENES: { id: string; C: React.FC<P>; own?: boolean }[] = [
  { id: "classroom", C: ClassroomScene, own: true },
  { id: "why", C: WhyScene, own: true },
  { id: "meet", C: MeetScene },
  { id: "flow", C: FlowScene },
  { id: "lessons", C: LessonsScene },
  { id: "signwords", C: SignWordsScene },
  { id: "fingerspell", C: FingerspellScene },
  { id: "live", C: LiveScene },
  { id: "layers", C: AIScene },
  { id: "kpis", C: KpiScene },
  { id: "close", C: CloseScene },
];
