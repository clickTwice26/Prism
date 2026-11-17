import { createTheme, type Theme } from "@mui/material/styles";
import type { ColorMode } from "./settings";

const fontFamily = "var(--font-onest), var(--font-bengali), system-ui, sans-serif";

// Builds the MUI theme from the learner's settings. "contrast" is a
// black-and-yellow scheme for low-vision learners.
export function buildTheme(mode: ColorMode, textScale: number): Theme {
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
          },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily,
      htmlFontSize: 16,
      fontSize: 15 * textScale,
      h1: { fontWeight: 700, letterSpacing: "-0.02em" },
      h2: { fontWeight: 700, letterSpacing: "-0.02em" },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 650 },
      h5: { fontWeight: 650 },
      h6: { fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            border: `${contrast ? 2 : 1}px solid ${theme.palette.divider}`,
          }),
        },
      },
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
