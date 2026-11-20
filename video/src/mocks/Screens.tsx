import React from "react";
import { C, FONT, FONT_BN } from "../theme";
import { Icon } from "../components/Icons";
import { Bn, Btn, MChip, PageHeader, Panel, Shell, SignerPlaceholder, Switch, Tabs } from "./Shell";

// ---- Home ---------------------------------------------------------------------

const TOOLS = [
  {
    title: "Lessons",
    icon: "book",
    text: "Read the lesson in Bangla, English or Malay. Key words show their Bangla Sign Language sign, and a recorded interpreter can sign the whole lesson.",
    who: ["Deaf", "Hard of hearing"],
  },
  {
    title: "Live class",
    icon: "video",
    text: "Follow the teacher live with captions and a saved transcript, with a sign interpreter who can join from anywhere.",
    who: ["Deaf & hard of hearing", "Sign interpreters"],
  },
  {
    title: "Sign glossary",
    icon: "people",
    text: "AI finds each lesson's key terms, people record the signs, and deaf reviewers approve every sign before learners see it.",
    who: ["Teachers", "Sign interpreters", "Deaf reviewers"],
  },
];

export const HomeScreen: React.FC = () => (
  <Shell active="home">
    <div style={{ maxWidth: 820, marginTop: 30 }}>
      <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em" }}>The same lesson, in Bangla Sign Language.</div>
      <div style={{ fontSize: 19, color: C.text2, lineHeight: 1.6, marginTop: 18, maxWidth: 760 }}>
        Prism Sign gives deaf learners in Bangladesh the class lesson with the key science words signed, captions that stay on, and a sign interpreter they can
        move, resize or hide. People do the signing. Deaf reviewers approve every sign.
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 26 }}>
        <Btn primary>Open a lesson</Btn>
        <Btn>Join a live class</Btn>
      </div>
    </div>
    <div style={{ display: "flex", gap: 24, marginTop: 50 }}>
      {TOOLS.map((t) => (
        <Panel key={t.title} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ color: C.lightBlue }}>
            <Icon name={t.icon} size={32} />
          </span>
          <div style={{ fontSize: 20, fontWeight: 650 }}>{t.title}</div>
          <div style={{ fontSize: 15.5, color: C.text2, lineHeight: 1.6 }}>{t.text}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {t.who.map((w) => (
              <MChip key={w} style={{ fontSize: 13 }}>
                {w}
              </MChip>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  </Shell>
);

// ---- Lessons --------------------------------------------------------------------

type Lang = "bn" | "en" | "ms";
// [text, isSignedTerm]
const LESSON: Record<Lang, [string, boolean][]> = {
  en: [
    ["Photosynthesis", true],
    [" is the process plants use to turn sunlight, ", false],
    ["water", true],
    [", and carbon dioxide into glucose and oxygen. The green pigment ", false],
    ["chlorophyll", true],
    [" absorbs light energy, which powers a series of chemical reactions inside the chloroplasts of plant cells.", false],
  ],
  bn: [
    ["সালোকসংশ্লেষণ", true],
    [" হলো সেই প্রক্রিয়া, যার মাধ্যমে উদ্ভিদ সূর্যের আলো, ", false],
    ["পানি", true],
    [" ও কার্বন ডাই-অক্সাইডকে গ্লুকোজ ও অক্সিজেনে পরিণত করে। সবুজ রঞ্জক ", false],
    ["ক্লোরোফিল", true],
    [" আলোক শক্তি শোষণ করে, যা উদ্ভিদকোষের ক্লোরোপ্লাস্টে একের পর এক রাসায়নিক বিক্রিয়া চালায়।", false],
  ],
  ms: [
    ["Fotosintesis ialah proses yang digunakan oleh tumbuhan untuk menukar cahaya matahari, air dan karbon dioksida kepada glukosa dan oksigen. Pigmen hijau ", false],
    ["klorofil", true],
    [" menyerap tenaga cahaya, yang menggerakkan beberapa tindak balas kimia di dalam kloroplas sel tumbuhan.", false],
  ],
};

export const LessonScreen: React.FC<{
  t: number;
  lang: Lang;
  highlight?: number; // 0→1 glow on signed terms
  card?: number; // 0→1 sign card for "chlorophyll"
  interp?: { on: number; x: number; y: number; w: number }; // interpreter window
  cursor?: { x: number; y: number; down: boolean; on: number };
}> = ({ t, lang, highlight = 0, card = 0, interp, cursor }) => {
  const title = lang === "bn" ? "সালোকসংশ্লেষণ" : lang === "ms" ? "Fotosintesis" : "Photosynthesis";
  return (
    <Shell active="lessons">
      <PageHeader title="Lessons" lead="Key words with an approved sign are underlined. Tap one to see the sign." />
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        {(["bn", "en", "ms"] as Lang[]).map((l) => (
          <MChip key={l} on={l === lang} style={{ fontSize: 15, padding: "7px 16px" }}>
            {l === "bn" ? <Bn>বাংলা</Bn> : l === "en" ? "English" : "Bahasa Melayu"}
          </MChip>
        ))}
        <div style={{ flex: 1 }} />
        <Switch on={!!interp && interp.on > 0.5} label="Interpreter window" />
      </div>
      <Panel style={{ padding: 34, minHeight: 520 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <MChip>Biology</MChip>
          <MChip on>3 signed terms</MChip>
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, marginBottom: 14, fontFamily: lang === "bn" ? FONT_BN : undefined }} lang={lang}>
          {title}
        </div>
        <div lang={lang} style={{ fontSize: 23, lineHeight: lang === "bn" ? 2.0 : 1.8, maxWidth: 820, fontFamily: lang === "bn" ? FONT_BN : undefined }}>
          {LESSON[lang].map(([txt, signed], i) =>
            signed ? (
              <span
                key={i}
                style={{
                  color: C.lightBlue,
                  textDecoration: "underline",
                  textDecorationThickness: 3,
                  textUnderlineOffset: 6,
                  background: `rgba(138,180,255,${0.22 * highlight})`,
                  borderRadius: 6,
                  padding: "0 3px",
                }}
              >
                {txt}
              </span>
            ) : (
              <span key={i}>{txt}</span>
            ),
          )}
        </div>
        <div style={{ marginTop: 26, display: "flex", gap: 10, alignItems: "center", color: C.text2, fontSize: 15 }}>
          <Icon name="cc" size={20} color={C.lightBlue} /> Captions stay on
        </div>
      </Panel>

      {/* Sign card for the tapped term */}
      {card > 0 && (
        <div style={{ position: "absolute", left: 70, top: 300, width: 400, opacity: card, transform: `translateY(${(1 - card) * 20}px)` }}>
          <Panel style={{ padding: 16, boxShadow: "0 24px 60px rgba(0,0,0,0.55)", border: "1px solid rgba(138,180,255,0.45)" }}>
            <SignerPlaceholder t={t} w={366} h={220} />
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 12 }}>
              <Bn style={{ fontSize: 24, fontWeight: 650 }}>সালোকসংশ্লেষণ</Bn>
              <div style={{ fontSize: 15, color: C.text2 }}>Photosynthesis</div>
            </div>
            <div style={{ fontSize: 13.5, color: C.text2, marginTop: 4 }}>2–4 s, silent, looping · Slow · Signer and deaf reviewer named</div>
          </Panel>
        </div>
      )}

      {/* Interpreter window */}
      {interp && interp.on > 0 && (
        <div style={{ position: "absolute", left: interp.x, top: interp.y, width: interp.w, opacity: interp.on }}>
          <div style={{ background: C.panel2, border: "1px solid rgba(138,180,255,0.4)", borderRadius: 14, padding: 10, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: C.text2, padding: "0 4px 8px" }}>
              <Icon name="window" size={16} color={C.lightBlue} /> Interpreter
              <div style={{ flex: 1 }} />
              <span style={{ letterSpacing: 2 }}>⋮⋮</span>
            </div>
            <SignerPlaceholder t={t + 0.7} w={interp.w - 20} h={(interp.w - 20) * 0.66} label="Interpreter · placeholder" top="#3346d3" skin="#8d5a3b" />
          </div>
        </div>
      )}
      {cursor && cursor.on > 0 && <Cursor {...cursor} />}
    </Shell>
  );
};

export const Cursor: React.FC<{ x: number; y: number; down: boolean; on: number }> = ({ x, y, down, on }) => (
  <div style={{ position: "absolute", left: x - 264 - 44, top: y - 34, opacity: on, pointerEvents: "none" }}>
    {down && <div style={{ position: "absolute", left: -22, top: -22, width: 44, height: 44, borderRadius: 22, background: "rgba(255,180,107,0.45)" }} />}
    <svg width={30} height={30} viewBox="0 0 24 24" style={{ position: "absolute", left: -4, top: -2 }}>
      <path d="M4 2 L4 20 L9 15 L12.5 22 L15.5 20.5 L12 13.8 L19 13.8 Z" fill="#fff" stroke="#0f1218" strokeWidth={1.4} />
    </svg>
  </div>
);

// ---- Sign dictionary -------------------------------------------------------------

/** The 3D signer stand-in: a shaded, clearly computer-made character. */
const Avatar3D: React.FC<{ t: number; slow: boolean }> = ({ t, slow }) => {
  const k = slow ? 0.5 : 1;
  const a = Math.sin(t * 2.4 * k);
  return (
    <svg viewBox="0 0 300 300" width="100%" height="100%">
      <defs>
        <radialGradient id="avSkin" cx="0.4" cy="0.35">
          <stop offset="0" stopColor="#e9c3a3" />
          <stop offset="1" stopColor="#b98667" />
        </radialGradient>
        <linearGradient id="avTop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6c7a99" />
          <stop offset="1" stopColor="#3b4560" />
        </linearGradient>
      </defs>
      <ellipse cx={150} cy={292} rx={110} ry={10} fill="#000" opacity={0.3} />
      <path d="M60 300 C60 214 98 190 150 190 C202 190 240 214 240 300 Z" fill="url(#avTop)" />
      <rect x={138} y={160} width={24} height={34} rx={8} fill="url(#avSkin)" />
      <ellipse cx={150} cy={128} rx={38} ry={44} fill="url(#avSkin)" />
      <path d="M112 120 C108 74 192 72 188 120 C178 96 124 94 112 120 Z" fill="#5b4636" />
      <circle cx={137} cy={130} r={3.5} fill="#2a2a2a" />
      <circle cx={163} cy={130} r={3.5} fill="#2a2a2a" />
      {/* Right arm: from shoulder towards the temple and out (DOCTOR-like tapping motion) */}
      <g transform={`rotate(${-120 + a * 18} 210 214)`}>
        <rect x={200} y={214} width={22} height={70} rx={11} fill="url(#avTop)" />
        <g transform="translate(211 290)">
          <ellipse cx={0} cy={0} rx={13} ry={16} fill="url(#avSkin)" />
        </g>
      </g>
      <g transform={`rotate(${30 + a * 6} 92 214)`}>
        <rect x={80} y={214} width={22} height={70} rx={11} fill="url(#avTop)" />
        <ellipse cx={91} cy={290} rx={13} ry={16} fill="url(#avSkin)" />
      </g>
    </svg>
  );
};

export const DictionaryScreen: React.FC<{ t: number; typed: string; slow: boolean; results: number }> = ({ t, typed, slow, results }) => (
  <Shell active="dictionary">
    <PageHeader title="Sign dictionary" lead="Search about 3,500 documented signs. A 3D signer shows each one until a deaf signer records it." />
    <div style={{ display: "flex", gap: 24 }}>
      <div style={{ width: 400 }}>
        <div style={{ border: "1px solid rgba(255,255,255,0.35)", borderRadius: 10, padding: "14px 16px", fontSize: 18, display: "flex", gap: 10, alignItems: "center" }}>
          <Icon name="search" size={20} color={C.text2} />
          {typed ? <span>{typed}</span> : <span style={{ color: C.text3 }}>Find a word, in Bangla or English</span>}
          <span style={{ width: 2, height: 22, background: C.lightBlue, opacity: Math.sin(t * 6) > 0 ? 1 : 0 }} />
        </div>
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            ["Doctor", "ডাক্তার", "Health"],
            ["Doctor's chamber", "ডাক্তারের চেম্বার", "Health"],
          ]
            .slice(0, results)
            .map(([en, bn, sec], i) => (
              <div key={en} style={{ padding: "12px 16px", borderRadius: 10, background: i === 0 ? "rgba(138,180,255,0.14)" : C.panel, border: `1px solid ${C.line}` }}>
                <div style={{ fontSize: 17, fontWeight: 600 }}>
                  {en} · <Bn>{bn}</Bn>
                </div>
                <div style={{ fontSize: 13.5, color: C.text2 }}>{sec} · documented in IsharaKotha</div>
              </div>
            ))}
        </div>
      </div>
      <Panel style={{ flex: 1, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 650 }}>
            Doctor · <Bn>ডাক্তার</Bn>
          </div>
          <div style={{ flex: 1 }} />
          {["Anna", "Marc", "Françoise"].map((n, i) => (
            <MChip key={n} on={i === 0}>
              {n}
            </MChip>
          ))}
        </div>
        <div style={{ height: 420, borderRadius: 12, background: "radial-gradient(circle at 50% 40%, #2a3247, #161a24)", position: "relative" }}>
          {results > 0 && <Avatar3D t={t} slow={slow} />}
          <div style={{ position: "absolute", left: 12, top: 12, fontSize: 14, fontWeight: 700, color: "#0f1218", background: C.orange, padding: "5px 12px", borderRadius: 8 }}>
            Preview · computer-made from the written description
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 14, alignItems: "center" }}>
          <Switch on={slow} label="Slow" />
          <div style={{ fontSize: 13.5, color: C.text2, lineHeight: 1.5 }}>
            3D preview made by software from the sign's written description (IsharaKotha). It is not a deaf signer and has not been checked by a deaf
            reviewer.
          </div>
        </div>
      </Panel>
    </div>
  </Shell>
);

// ---- Camera views (illustrated person, or the skeleton Prism sees) -----------------

type Pt = [number, number];
const handPoints = (wx: number, wy: number, ang: number, spread: number, curl: number): Pt[] => {
  const pts: Pt[] = [[wx, wy]];
  const fingers = [-0.9, -0.35, 0, 0.32, 0.62];
  const lens = [[18, 16, 13, 11], [30, 18, 14, 11], [32, 20, 15, 12], [30, 18, 14, 11], [24, 14, 11, 9]];
  fingers.forEach((f, i) => {
    let x = wx;
    let y = wy;
    let a = ang + f * spread;
    lens[i].forEach((l, j) => {
      a += j > 0 ? curl * (i === 0 ? 0.2 : 0.55) : 0;
      x += Math.sin(a) * l;
      y -= Math.cos(a) * l;
      pts.push([x, y]);
    });
  });
  return pts;
};

const HAND_LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

export const CameraView: React.FC<{ t: number; skeleton: number; hand: { x: number; y: number }; curl?: number; twoHands?: boolean; label: string }> = ({
  t,
  skeleton,
  hand,
  curl = 0.1,
  twoHands,
  label,
}) => {
  const body = { neck: [300, 250] as Pt, ls: [235, 285] as Pt, rs: [365, 285] as Pt, head: [300, 175] as Pt };
  const elbowR: Pt = [hand.x + 40, hand.y + 110];
  const hp = handPoints(hand.x, hand.y, -0.25, 1, curl);
  const lHand = { x: 600 - hand.x + 40, y: hand.y + 20 };
  const hpL = twoHands ? handPoints(lHand.x, lHand.y, 0.25, 1, curl) : [];
  return (
    <div style={{ position: "relative", width: 600, height: 440, borderRadius: 12, overflow: "hidden", background: "#2a2622" }}>
      <svg viewBox="0 0 600 440" width={600} height={440} style={{ position: "absolute", inset: 0 }}>
        <g opacity={1 - skeleton * 0.85}>
          <rect width={600} height={440} fill="#d9c2a3" />
          <rect x={420} y={40} width={140} height={120} rx={8} fill="#bfe0ef" />
          <rect y={360} width={600} height={80} fill="#b48256" />
          <path d="M160 440 C160 320 220 280 300 280 C380 280 440 320 440 440 Z" fill="#8c3b6b" />
          <path d="M240 290 C280 320 330 380 350 440 L320 440 C300 390 270 340 228 310 Z" fill="#f0b45a" />
          <rect x={285} y={220} width={30} height={40} fill="#9c6440" />
          <ellipse cx={300} cy={175} rx={52} ry={60} fill="#9c6440" />
          <path d="M246 180 C236 100 364 100 354 180 C340 140 268 136 246 180 Z" fill="#1d1513" />
          <circle cx={282} cy={178} r={4.5} fill="#1d1a1a" />
          <circle cx={318} cy={178} r={4.5} fill="#1d1a1a" />
          <path d="M288 206 Q300 214 312 206" stroke="#6b2f22" strokeWidth={3} fill="none" strokeLinecap="round" />
          <path d={`M365 290 L${elbowR[0]} ${elbowR[1]} L${hand.x} ${hand.y + 6}`} stroke="#8c3b6b" strokeWidth={34} strokeLinecap="round" fill="none" />
          <ellipse cx={hand.x + 4} cy={hand.y - 18} rx={24} ry={34} fill="#9c6440" />
          {twoHands && (
            <>
              <path d={`M235 290 L${600 - elbowR[0] + 40} ${elbowR[1]} L${lHand.x} ${lHand.y + 6}`} stroke="#8c3b6b" strokeWidth={34} strokeLinecap="round" fill="none" />
              <ellipse cx={lHand.x - 4} cy={lHand.y - 18} rx={24} ry={34} fill="#9c6440" />
            </>
          )}
        </g>
        {skeleton > 0 && (
          <g opacity={skeleton}>
            <rect width={600} height={440} fill="#0f1218" opacity={0.75} />
            {/* Body (pose) */}
            {[
              [body.ls, body.rs],
              [body.rs, elbowR],
              [elbowR, [hand.x, hand.y]],
              [body.ls, [235, 440]],
              [body.rs, [365, 440]],
              ...(twoHands ? [[body.ls, [600 - elbowR[0] + 40, elbowR[1]]], [[600 - elbowR[0] + 40, elbowR[1]], [lHand.x, lHand.y]]] : []),
            ].map(([a, b], i) => (
              <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={C.orange} strokeWidth={4} strokeLinecap="round" />
            ))}
            <ellipse cx={body.head[0]} cy={body.head[1]} rx={50} ry={58} fill="none" stroke={C.orange} strokeWidth={3} strokeDasharray="6 6" />
            {[body.ls, body.rs, elbowR, body.head].map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={7} fill={C.orange} />
            ))}
            {[hp, hpL].map((pts, h) =>
              pts.length ? (
                <g key={h}>
                  {HAND_LINKS.map(([a, b], i) => (
                    <line key={i} x1={pts[a][0]} y1={pts[a][1]} x2={pts[b][0]} y2={pts[b][1]} stroke={C.lightBlue} strokeWidth={3} />
                  ))}
                  {pts.map((p, i) => (
                    <circle key={i} cx={p[0]} cy={p[1]} r={4.5} fill="#fff" stroke={C.blue} strokeWidth={2} />
                  ))}
                </g>
              ) : null,
            )}
          </g>
        )}
      </svg>
      <div style={{ position: "absolute", left: 12, top: 12, fontSize: 14, fontWeight: 600, background: "rgba(0,0,0,0.6)", padding: "4px 10px", borderRadius: 6 }}>{label}</div>
      {skeleton > 0.5 && (
        <div style={{ position: "absolute", right: 12, top: 12, fontSize: 13, fontWeight: 700, background: "rgba(0,0,0,0.65)", color: C.lightBlue, padding: "4px 10px", borderRadius: 6, display: "flex", gap: 6, alignItems: "center" }}>
          <Icon name="lock" size={14} /> Points only · no video leaves the device
        </div>
      )}
    </div>
  );
};

const PartBar: React.FC<{ label: string; v: number; bad?: boolean }> = ({ label, v, bad }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 15.5 }}>
    <div style={{ width: 110 }}>{label}</div>
    <div style={{ flex: 1, height: 9, borderRadius: 5, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
      <div style={{ width: `${v * 100}%`, height: "100%", background: bad ? C.orange : C.green, borderRadius: 5 }} />
    </div>
    <div style={{ width: 44, textAlign: "right", color: C.text2 }}>{Math.round(v * 100)}%</div>
  </div>
);

// ---- Sign words ----------------------------------------------------------------------

export const SignWordsScreen: React.FC<{ t: number; attempt: 0 | 1 | 2; skeleton: number; handY: number }> = ({ t, attempt, skeleton, handY }) => {
  const second = attempt === 2;
  const parts = second
    ? [0.92, 0.9, 0.88, 0.9]
    : attempt === 1
      ? [0.86, 0.34, 0.7, 0.81]
      : [0, 0, 0, 0];
  return (
    <Shell active="signs">
      <PageHeader title="Sign words" lead="Sign one of 43 everyday, school and health words. Prism checks each part and coaches the one to fix." />
      <Tabs items={["Recognise", "Practise a word", "Record samples"]} on={1} />
      <div style={{ display: "flex", gap: 24 }}>
        <div>
          <CameraView t={t} skeleton={skeleton} hand={{ x: 380, y: handY }} label="You, mirrored" />
          <div style={{ display: "flex", gap: 26, marginTop: 14 }}>
            <Switch on={false} label="Simulate (no camera)" />
            <Switch on={skeleton > 0.5} label="Show what Prism sees" />
          </div>
        </div>
        <Panel style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 14, color: C.text2 }}>Word (43)</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <Bn style={{ fontSize: 40, fontWeight: 700 }}>জ্বর</Bn>
            <span style={{ fontSize: 22, color: C.text2 }}>fever · Health</span>
          </div>
          <PartBar label="Handshape" v={parts[0]} />
          <PartBar label="Place" v={parts[1]} bad={attempt === 1} />
          <PartBar label="Movement" v={parts[2]} />
          <PartBar label="Direction" v={parts[3]} />
          {attempt === 1 && (
            <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 16px", borderRadius: 12, background: "rgba(194,65,12,0.18)", border: "1px solid rgba(255,180,107,0.5)", fontSize: 21, fontWeight: 650, color: C.orange }}>
              <Icon name="target" size={26} /> Start at your forehead
            </div>
          )}
          {second && (
            <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 16px", borderRadius: 12, background: "rgba(110,231,168,0.14)", border: "1px solid rgba(110,231,168,0.5)", fontSize: 21, fontWeight: 650, color: C.green }}>
              <Icon name="check" size={26} /> Well done! That is <Bn>জ্বর</Bn> (fever).
            </div>
          )}
          {attempt === 0 && <div style={{ fontSize: 17, color: C.text2 }}>Raise your hand and sign the word.</div>}
        </Panel>
      </div>
    </Shell>
  );
};

// ---- Fingerspell ---------------------------------------------------------------------

export const FingerspellScreen: React.FC<{ t: number; p: number; typed: string }> = ({ t, p, typed }) => (
  <Shell active="fingerspell">
    <PageHeader title="Fingerspell" lead="Spell with the Bangla two-hand alphabet. Hold each letter steady to type it." />
    <Tabs items={["Spell", "Practise a letter", "Record samples"]} on={1} />
    <div style={{ display: "flex", gap: 24 }}>
      <CameraView t={t} skeleton={0.9} hand={{ x: 360, y: 250 }} curl={0.6 - p * 0.4} twoHands label="Your hands, mirrored" />
      <Panel style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 14, color: C.text2 }}>Letter to practise</div>
        <Bn style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.3 }}>ক</Bn>
        <PartBar label="Handshape" v={0.35 + p * 0.58} bad={p < 0.6} />
        <PartBar label="Palm" v={0.5 + p * 0.42} />
        <PartBar label="Contact" v={0.3 + p * 0.62} bad={p < 0.5} />
        <div style={{ fontSize: 14, color: C.text2, marginTop: 4 }}>Spelled text</div>
        <div style={{ border: "1px solid rgba(255,255,255,0.35)", borderRadius: 10, padding: "10px 14px", fontSize: 30, minHeight: 58 }}>
          <Bn>{typed}</Bn>
          <span style={{ display: "inline-block", width: 2, height: 30, background: C.lightBlue, marginLeft: 3, verticalAlign: "middle", opacity: Math.sin(t * 6) > 0 ? 1 : 0 }} />
        </div>
      </Panel>
    </div>
  </Shell>
);

// ---- Live class -------------------------------------------------------------------------

const TRANSCRIPT: [string, boolean][][] = [
  [["Good morning. Today we start a new topic.", false]],
  [["Plants make their own food. This is called ", false], ["photosynthesis", true], [".", false]],
  [["They need sunlight, ", false], ["water", true], [" and carbon dioxide.", false]],
  [["The green pigment ", false], ["chlorophyll", true], [" absorbs the light.", false]],
];

export const LiveScreen: React.FC<{ t: number; lines: number; interp: number; tap: number }> = ({ t, lines, interp, tap }) => {
  const shown = Math.floor(lines);
  const cur = TRANSCRIPT[Math.max(0, Math.min(TRANSCRIPT.length - 1, shown - 1))];
  return (
    <Shell active="live">
      <PageHeader title="Live class" />
      <div style={{ display: "flex", gap: 22 }}>
        <div style={{ width: 720 }}>
          <div style={{ position: "relative", height: 405, borderRadius: 14, overflow: "hidden", background: "#d9c2a3" }}>
            <svg viewBox="0 0 720 405" width={720} height={405}>
              <rect x={30} y={40} width={420} height={230} rx={10} fill="#2f5d4a" stroke="#7a4a2c" strokeWidth={10} />
              <text x={240} y={170} textAnchor="middle" fontFamily={FONT_BN} fontSize={46} fill="#f4f1e8" fontWeight={600}>
                সালোকসংশ্লেষণ
              </text>
              <path d="M450 405 C450 300 490 270 560 270 C630 270 670 300 670 405 Z" fill="#1f7a6d" />
              <path d="M510 278 C540 300 600 360 620 405 L590 405 C570 360 530 310 498 290 Z" fill="#e2a33a" />
              <rect x={546} y={226} width={28} height={50} fill="#a56a45" />
              <ellipse cx={560} cy={196} rx={44} ry={50} fill="#a56a45" />
              <path d="M514 196 C506 132 614 132 606 196 C594 164 530 160 514 196 Z" fill="#1d1513" />
              <circle cx={600} cy={156} r={20} fill="#1d1513" />
              <circle cx={545} cy={198} r={4} fill="#1d1a1a" />
              <circle cx={575} cy={198} r={4} fill="#1d1a1a" />
              <ellipse cx={560} cy={224} rx={8} ry={3 + ((Math.sin(t * 9) + 1) / 2) * 4} fill="#7a3b2e" />
            </svg>
            <div style={{ position: "absolute", left: 12, top: 12, fontSize: 14, fontWeight: 600, background: "rgba(0,0,0,0.6)", padding: "4px 10px", borderRadius: 6, display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ width: 9, height: 9, borderRadius: 5, background: "#ff5a5a" }} /> Teacher's video
            </div>
            {/* Interpreter tile */}
            {interp > 0 && (
              <div style={{ position: "absolute", left: 14, bottom: 14, width: 210, opacity: interp, transform: `scale(${0.9 + interp * 0.1})`, transformOrigin: "0% 100%" }}>
                <div style={{ background: C.panel2, border: "1px solid rgba(138,180,255,0.5)", borderRadius: 12, padding: 7 }}>
                  <SignerPlaceholder t={t} w={196} h={150} label="BdSL interpreter · placeholder" top="#3346d3" skin="#8d5a3b" />
                  <div style={{ fontSize: 12.5, color: C.text2, padding: "6px 4px 0" }}>Joined from another city</div>
                </div>
              </div>
            )}
          </div>
          {/* Big live caption */}
          <div style={{ marginTop: 14, minHeight: 92, background: "#000", borderRadius: 12, padding: "14px 20px", fontSize: 26, fontWeight: 500, lineHeight: 1.45 }}>
            {shown > 0 &&
              cur.map(([txt, signed], i) => (
                <span key={i} style={signed ? { color: C.lightBlue, textDecoration: "underline", textUnderlineOffset: 5 } : undefined}>
                  {txt}
                </span>
              ))}
          </div>
        </div>
        <Panel style={{ flex: 1, padding: 20, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 650 }}>Transcript</div>
            <div style={{ flex: 1 }} />
            <Switch on={false} label="Translate" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 17, lineHeight: 1.55 }}>
            {TRANSCRIPT.slice(0, shown).map((l, k) => (
              <div key={k} style={{ color: k === shown - 1 ? "#fff" : C.text2 }}>
                {l.map(([txt, signed], i) => (
                  <span key={i} style={signed ? { color: C.lightBlue, textDecoration: "underline", textUnderlineOffset: 4, fontWeight: 600 } : undefined}>
                    {txt}
                  </span>
                ))}
              </div>
            ))}
          </div>
          {tap > 0 && (
            <div style={{ position: "absolute", left: 20, right: 20, bottom: 20, opacity: tap }}>
              <div style={{ background: C.panel2, border: "1px solid rgba(138,180,255,0.45)", borderRadius: 12, padding: 10, display: "flex", gap: 12, alignItems: "center" }}>
                <SignerPlaceholder t={t} w={150} h={100} label="Sign clip" />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 650 }}>chlorophyll</div>
                  <Bn style={{ fontSize: 16, color: C.text2 }}>ক্লোরোফিল</Bn>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </Shell>
  );
};

// ---- Phone (mobile layout: top bar instead of the sidebar) ------------------------------

export const MobileLesson: React.FC<{ t: number }> = ({ t }) => (
  <div style={{ width: 390, height: 844, background: C.ink, color: "#fff", fontFamily: FONT, position: "relative" }}>
    <div style={{ height: 50 }} />
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${C.line}` }}>
      <span style={{ fontSize: 24, color: C.text2 }}>☰</span>
      <span style={{ color: C.lightBlue }}>
        <Icon name="prism" size={22} />
      </span>
      <span style={{ fontSize: 19, fontWeight: 700 }}>Prism</span>
      <div style={{ flex: 1 }} />
      <Icon name="settings" size={22} color={C.text2} />
    </div>
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>Lessons</div>
      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <MChip on>
          <Bn>বাংলা</Bn>
        </MChip>
        <MChip>English</MChip>
        <MChip>Melayu</MChip>
      </div>
      <Panel style={{ padding: 16 }}>
        <Bn style={{ fontSize: 22, fontWeight: 700 }}>সালোকসংশ্লেষণ</Bn>
        <div lang="bn" style={{ fontFamily: FONT_BN, fontSize: 17, lineHeight: 2.0, marginTop: 6 }}>
          <span style={{ color: C.lightBlue, textDecoration: "underline", textUnderlineOffset: 5 }}>সালোকসংশ্লেষণ</span> হলো সেই প্রক্রিয়া, যার মাধ্যমে উদ্ভিদ
          সূর্যের আলো, <span style={{ color: C.lightBlue, textDecoration: "underline", textUnderlineOffset: 5 }}>পানি</span> ও কার্বন ডাই-অক্সাইডকে গ্লুকোজ ও
          অক্সিজেনে পরিণত করে। সবুজ রঞ্জক <span style={{ color: C.lightBlue, textDecoration: "underline", textUnderlineOffset: 5 }}>ক্লোরোফিল</span> আলোক
          শক্তি শোষণ করে।
        </div>
      </Panel>
    </div>
    <div style={{ position: "absolute", right: 14, bottom: 30, background: C.panel2, border: "1px solid rgba(138,180,255,0.4)", borderRadius: 12, padding: 6 }}>
      <SignerPlaceholder t={t} w={170} h={120} label="Interpreter" top="#3346d3" skin="#8d5a3b" />
    </div>
  </div>
);
