"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { speakOnServer, speechLocale, type Lang } from "./api";
import { useSettings } from "./settings";

export interface WordRange {
  start: number;
  end: number;
}

// Read-aloud with two engines:
//  - read-along on: the browser voice, which reports word boundaries so the
//    spoken word can be highlighted (Wood et al., 2017: listen while reading);
//  - read-along off: the server voice (offline Piper or OpenAI), falling back
//    to the browser voice if the server cannot speak this language.
export function useReadAloud() {
  const { settings } = useSettings();
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [word, setWord] = useState<WordRange | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setSpeaking(false);
    setPaused(false);
    setWord(null);
  }, [cleanup]);

  useEffect(() => stop, [stop]);

  const speakInBrowser = useCallback(
    (text: string, lang: Lang) => {
      if (!("speechSynthesis" in window)) {
        stop();
        return false;
      }
      const u = new SpeechSynthesisUtterance(text);
      const locale = speechLocale(lang);
      u.lang = locale;
      u.rate = settings.speechRate;
      const voice = window.speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").startsWith(locale.slice(0, 2)));
      if (voice) u.voice = voice;
      u.onboundary = (e) => {
        if (e.name !== "word") return;
        const len = e.charLength || (text.slice(e.charIndex).match(/^\S+/)?.[0].length ?? 0);
        setWord({ start: e.charIndex, end: e.charIndex + len });
      };
      u.onend = () => stop();
      u.onerror = () => stop();
      window.speechSynthesis.speak(u);
      return true;
    },
    [settings.speechRate, stop],
  );

  const speak = useCallback(
    async (text: string, lang: Lang = settings.lang) => {
      const clean = text.trim();
      if (!clean) return;
      cleanup();
      setWord(null);
      setPaused(false);
      setSpeaking(true);
      if (!settings.readAlong) {
        try {
          const url = await speakOnServer(clean, lang);
          urlRef.current = url;
          const audio = new Audio(url);
          audio.playbackRate = settings.speechRate;
          audio.onended = () => stop();
          audioRef.current = audio;
          await audio.play();
          return;
        } catch {
          /* fall through to the browser voice */
        }
      }
      speakInBrowser(clean, lang);
    },
    [settings.lang, settings.readAlong, settings.speechRate, cleanup, speakInBrowser, stop],
  );

  const togglePause = useCallback(() => {
    if (audioRef.current) {
      if (audioRef.current.paused) void audioRef.current.play();
      else audioRef.current.pause();
    } else if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    else window.speechSynthesis.pause();
    setPaused((p) => !p);
  }, []);

  return { speak, stop, togglePause, speaking, paused, word };
}
