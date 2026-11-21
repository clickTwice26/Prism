import React from "react";
import { AbsoluteFill, Audio, Composition, staticFile, useCurrentFrame } from "remotion";
import { BADGE, FPS, SECTIONS, TOTAL_SECONDS } from "./script";
import { Background, Badge, BnLine, Captions, SectionBar, prog } from "./components/ui";
import { SCENES } from "./scenes/Scenes";
import { Classroom } from "./illus/Classroom";
import { C, FONT } from "./theme";
import timings from "./timings.json";

const ALL = SECTIONS.flatMap((s) => s.scenes);
const X = 0.3; // crossfade half-length, seconds

const spans = Object.values(timings.chunks as Record<string, { start: number; end: number }>);

/** Music volume: -6 dB with no voice, ducked to -14 dB under the voice (music track is at about -15 LUFS, voice at -16). */
const musicVolume = (f: number) => {
  const t = f / FPS;
  const near = spans.some((s) => t > s.start - 0.4 && t < s.end + 0.6);
  const base = near ? 0.2 : 0.5;
  const fadeOut = Math.min(1, (TOTAL_SECONDS - t) / 3);
  return base * Math.max(0, fadeOut);
};

const Promo: React.FC = () => {
  const T = useCurrentFrame() / FPS;
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Background t={T} />
      {SCENES.map(({ id, C: Scene }) => {
        const sc = ALL.find((s) => s.id === id)!;
        if (T < sc.start - X || T > sc.end + X) return null;
        const first = sc.start === 0;
        const last = sc.end >= TOTAL_SECONDS;
        const op = Math.min(first ? 1 : prog(T, sc.start - X, X * 2), last ? 1 : 1 - prog(T, sc.end - X, X * 2));
        return (
          <AbsoluteFill key={id} style={{ opacity: op }}>
            <Scene T={T} />
          </AbsoluteFill>
        );
      })}
      <SectionBar T={T} />
      <Badge T={T} text={BADGE} />
      <Captions T={T} />
      <Audio src={staticFile("audio/voice.wav")} />
      <Audio src={staticFile("audio/music.wav")} volume={musicVolume} />
    </AbsoluteFill>
  );
};

const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: C.ink }}>
    <div style={{ width: 1920, height: 1080, transform: "scale(0.6667)", transformOrigin: "0 0" }}>
      <Classroom t={1} light={1} underline={1} card={1} raise={1} mituGlow={0.6} />
    </div>
    <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(15,18,24,0.94) 0%, rgba(15,18,24,0.85) 48%, rgba(15,18,24,0) 75%)" }} />
    <div style={{ position: "absolute", left: 64, top: 150, width: 640, fontFamily: FONT }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "0.2em", color: C.orange }}>PRISM SIGN</div>
      <div style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.025em", color: "#fff", marginTop: 14 }}>
        The same lesson, in Bangla Sign Language
      </div>
      <BnLine text="একই পাঠ, বাংলা ইশারা ভাষায়।" size={32} style={{ marginTop: 14 }} />
    </div>
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Promo" component={Promo} durationInFrames={TOTAL_SECONDS * FPS} fps={FPS} width={1920} height={1080} />
    <Composition id="Thumbnail" component={Thumbnail} durationInFrames={1} fps={FPS} width={1280} height={720} />
  </>
);
