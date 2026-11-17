"use client";

import { useMemo, type ReactNode } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { SettingsProvider, useSettings } from "@/lib/settings";
import { buildTheme } from "@/lib/theme";
import { AnnouncerProvider } from "./Announcer";

function ThemedApp({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const theme = useMemo(() => buildTheme(settings.mode, settings.textScale), [settings.mode, settings.textScale]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
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
