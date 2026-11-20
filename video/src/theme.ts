import { loadFont as loadOnest } from "@remotion/google-fonts/Onest";
import { loadFont as loadBengali } from "@remotion/google-fonts/NotoSansBengali";

const onest = loadOnest("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] });
const bengali = loadBengali("normal", { weights: ["400", "500", "600", "700"], subsets: ["bengali"] });

export const FONT = `${onest.fontFamily}, ${bengali.fontFamily}, system-ui, sans-serif`;
export const FONT_BN = `${bengali.fontFamily}, ${onest.fontFamily}, sans-serif`;

// Prism's dark theme (frontend/src/lib/theme.ts).
export const C = {
  ink: "#0f1218",
  panel: "#171b23",
  panel2: "#1e2330",
  line: "rgba(255,255,255,0.10)",
  blue: "#3346d3",
  lightBlue: "#8ab4ff",
  orange: "#ffb46b",
  deepOrange: "#c2410c",
  white: "#ffffff",
  text2: "rgba(255,255,255,0.70)",
  text3: "rgba(255,255,255,0.50)",
  green: "#6ee7a8",
  hcBlack: "#000000",
  hcYellow: "#ffe600",
  hcCyan: "#00e5ff",
};

// Cubic ease-out used for every entrance.
export const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
