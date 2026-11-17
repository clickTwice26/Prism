import type { CSSProperties } from "react";
import { createTheme, type Theme } from "@mui/material/styles";
import type { ColorMode } from "./settings";

// Type scale — see docs/design.md. Every size is in rem so the learner's text
// size setting (applied to the root font size) scales all text together.

declare module "@mui/material/styles" {
  interface TypographyVariants {
    display: CSSProperties;
    lead: CSSProperties;
    reading: CSSProperties;
    liveCaption: CSSProperties;
  }
  interface TypographyVariantsOptions {
    display?: CSSProperties;
    lead?: CSSProperties;
    reading?: CSSProperties;
    liveCaption?: CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    display: true;
    lead: true;
    reading: true;
    liveCaption: true;
  }
}

export const FONT_SANS = "var(--font-onest), var(--font-bengali), system-ui, -apple-system, 'Segoe UI', sans-serif";

export const SIDEBAR_WIDTH = 264;
export const SIDEBAR_MINI_WIDTH = 80;

const typography = {
  fontFamily: FONT_SANS,
  htmlFontSize: 16,
  fontSize: 16,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 700,
  // Hero headline on the home page only.
  display: {
    fontFamily: FONT_SANS,
    fontSize: "clamp(2.25rem, 1.5rem + 3vw, 3.5rem)",
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: "-0.025em",
  },
  // Page title: one per page.
  h1: { fontSize: "clamp(1.875rem, 1.5rem + 1.5vw, 2.5rem)", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.02em" },
  h2: { fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.015em" },
  h3: { fontSize: "1.5rem", fontWeight: 650, lineHeight: 1.25, letterSpacing: "-0.01em" },
  // Panel and card titles.
  h4: { fontSize: "1.25rem", fontWeight: 650, lineHeight: 1.3, letterSpacing: "-0.005em" },
  // Sub-sections inside a panel.
  h5: { fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.35 },
  h6: { fontSize: "1rem", fontWeight: 600, lineHeight: 1.4 },
  // Intro sentence under a page title.
  lead: { fontFamily: FONT_SANS, fontSize: "1.1875rem", fontWeight: 400, lineHeight: 1.6 },
  // Lesson text learners read: larger, airy, short lines.
  reading: { fontFamily: FONT_SANS, fontSize: "1.25rem", fontWeight: 400, lineHeight: 1.8 },
  // On-video live captions: big and bold enough to read at a glance.
  liveCaption: { fontFamily: FONT_SANS, fontSize: "1.625rem", fontWeight: 500, lineHeight: 1.45 },
  subtitle1: { fontSize: "1rem", fontWeight: 600, lineHeight: 1.5 },
  subtitle2: { fontSize: "0.875rem", fontWeight: 600, lineHeight: 1.5 },
  body1: { fontSize: "1rem", lineHeight: 1.6 },
  body2: { fontSize: "0.875rem", lineHeight: 1.55 },
  button: { fontSize: "0.9375rem", fontWeight: 600, lineHeight: 1.5, textTransform: "none" as const, letterSpacing: 0 },
  caption: { fontSize: "0.8125rem", lineHeight: 1.45 },
  overline: { fontSize: "0.75rem", fontWeight: 600, lineHeight: 1.5, letterSpacing: "0.08em" },
};

// Builds the MUI theme. "contrast" is a black-and-yellow scheme for low-vision learners.
export function buildTheme(mode: ColorMode): Theme {
  const contrast = mode === "contrast";
  return createTheme({
    palette: contrast
      ? {
          mode: "dark",
          primary: { main: "#ffe600", contrastText: "#000" },
          secondary: { main: "#00e5ff", contrastText: "#000" },
          background: { default: "#000", paper: "#000" },
          text: { primary: "#fff", secondary: "#ffe600" },
          divider: "#fff",
          action: { selected: "rgba(255, 230, 0, 0.2)" },
        }
      : mode === "dark"
        ? {
            mode: "dark",
            primary: { main: "#8ab4ff" },
            secondary: { main: "#ffb46b" },
            background: { default: "#0f1218", paper: "#171b23" },
          }
        : {
            mode: "light",
            primary: { main: "#3346d3" },
            secondary: { main: "#c2410c" },
            background: { default: "#f6f7fb", paper: "#ffffff" },
            text: { primary: "#14161f", secondary: "#535a6b" },
          },
    shape: { borderRadius: 14 },
    typography,
    components: {
      MuiTypography: {
        defaultProps: {
          variantMapping: { display: "h1", lead: "p", reading: "div", liveCaption: "p" },
        },
      },
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            border: `${contrast ? 2 : 1}px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiDrawer: { styleOverrides: { paper: { borderRadius: 0 } } },
      MuiAppBar: { styleOverrides: { root: { border: 0 } } },
      // A strong, always-visible focus ring for keyboard and switch users.
      MuiButtonBase: {
        styleOverrides: {
          root: ({ theme }) => ({
            "&.Mui-focusVisible": {
              outline: `3px solid ${contrast ? "#00e5ff" : theme.palette.primary.main}`,
              outlineOffset: 2,
            },
          }),
        },
      },
    },
  });
}
