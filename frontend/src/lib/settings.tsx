"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Lang } from "./api";

export type ColorMode = "light" | "dark" | "contrast";

// Per-learner reading preferences, kept in this browser only.
export interface Settings {
  lang: Lang;
  mode: ColorMode;
  textScale: number; // 1 = 100%
  wordSpacing: number; // extra em between words (Galliussi et al., 2020)
  readAlong: boolean; // highlight each word while reading aloud
  speechRate: number;
}

const DEFAULTS: Settings = {
  lang: "en",
  mode: "light",
  textScale: 1,
  wordSpacing: 0,
  readAlong: true,
  speechRate: 1,
};

const KEY = "prism.settings.v1";

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  // Load after mount so server and first client render match.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from storage
      if (raw) setSettings({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) });
    } catch {
      /* storage blocked: keep defaults */
    }
  }, []);

  const persist = useCallback((next: Settings) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const update = useCallback(
    (patch: Partial<Settings>) =>
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        persist(next);
        return next;
      }),
    [persist],
  );

  const reset = useCallback(() => {
    setSettings(DEFAULTS);
    persist(DEFAULTS);
  }, [persist]);

  const value = useMemo(() => ({ settings, update, reset }), [settings, update, reset]);
  return <SettingsContext value={value}>{children}</SettingsContext>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
