"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import { SettingsProvider, useSettings } from "@/lib/settings";
import { buildTheme } from "@/lib/theme";
import { AnnouncerProvider } from "./Announcer";

function ThemedApp({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const theme = useMemo(() => buildTheme(settings.mode), [settings.mode]);
  // Screen readers pick their voice from the page language.
  useEffect(() => {
    document.documentElement.lang = settings.lang;
  }, [settings.lang]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* Text size scales the root font size, so every rem-based size follows. */}
      <GlobalStyles styles={{ html: { fontSize: `${settings.textScale * 100}%` } }} />
      <AnnouncerProvider>{children}</AnnouncerProvider>
    </ThemeProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider>
      <SettingsProvider>
        <ThemedApp>{children}</ThemedApp>
      </SettingsProvider>
    </AppRouterCacheProvider>
  );
}
