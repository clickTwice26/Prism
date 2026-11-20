"use client";

import type { Ref } from "react";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Cancel01Icon, Move01Icon, SignLanguageCIcon } from "@hugeicons/core-free-icons";
import { logUsage } from "@/lib/api";
import { useSettings, type InterpreterCorner, type InterpreterSize } from "@/lib/settings";
import { useAnnounce } from "./Announcer";
import { Icon } from "./Icon";

const WIDTH: Record<InterpreterSize, number> = { small: 200, medium: 300, large: 440 };
const CORNERS: InterpreterCorner[] = ["bottom-right", "bottom-left", "top-left", "top-right"];
const cornerName = (c: InterpreterCorner) => c.replace("-", " ");

// A sign interpreter as a small video window over the lesson or class.
// Learners switch it on and off, resize it and move it to any corner, and the
// choice is remembered (Boudreault et al., 2024). Captions stay on underneath:
// sign plus captions beats either alone (Debevc et al., 2015).
//
// Pass src for a recorded interpreter video, or videoRef for a live stream
// (the video element stays mounted while hidden so the stream keeps playing).
export function InterpreterWindow({
  src,
  videoRef,
  live = false,
  streaming = true,
  signer,
}: {
  src?: string;
  videoRef?: Ref<HTMLVideoElement>;
  live?: boolean;
  streaming?: boolean;
  signer?: string;
}) {
  const { settings, update } = useSettings();
  const announce = useAnnounce();
  const on = settings.interpreterOn;
  const corner = settings.interpreterCorner;
  const [v, h] = corner.split("-") as ["top" | "bottom", "left" | "right"];

  const setOn = (next: boolean) => {
    update({ interpreterOn: next });
    announce(next ? "Sign interpreter shown." : "Sign interpreter hidden.");
    logUsage("sign", next ? "interpreter_on" : "interpreter_off", { live });
  };
  const move = () => {
    const next = CORNERS[(CORNERS.indexOf(corner) + 1) % CORNERS.length];
    update({ interpreterCorner: next });
    announce(`Interpreter moved to the ${cornerName(next)}.`);
  };

  return (
    <>
      <FormControlLabel
        control={<Switch checked={on} onChange={(e) => setOn(e.target.checked)} />}
        label={
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Icon icon={SignLanguageCIcon} size={20} />
            <span>Sign interpreter{live && !streaming ? " (waiting for the interpreter)" : ""}</span>
          </Stack>
        }
      />
      <Paper
        role="region"
        aria-label="Sign interpreter"
        elevation={8}
        sx={{
          display: on ? "block" : "none",
          position: "fixed",
          zIndex: 1200, // above the app bar, below dialogs and popovers
          [v]: 16,
          [h]: 16,
          width: `min(${WIDTH[settings.interpreterSize]}px, calc(100vw - 32px))`,
          p: 1,
          borderRadius: 3,
        }}
      >
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mb: 0.75 }}>
          <Typography variant="caption" sx={{ flex: 1, fontWeight: 600, pl: 0.5 }} noWrap>
            Sign interpreter{signer ? `: ${signer}` : ""}
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={settings.interpreterSize}
            onChange={(_, s: InterpreterSize | null) => s && update({ interpreterSize: s })}
            aria-label="Interpreter size"
          >
            <ToggleButton value="small" aria-label="Small" sx={{ px: 1, py: 0.25 }}>
              S
            </ToggleButton>
            <ToggleButton value="medium" aria-label="Medium" sx={{ px: 1, py: 0.25 }}>
              M
            </ToggleButton>
            <ToggleButton value="large" aria-label="Large" sx={{ px: 1, py: 0.25 }}>
              L
            </ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title="Move to the next corner">
            <IconButton size="small" onClick={move} aria-label={`Move interpreter (now ${cornerName(corner)})`}>
              <Icon icon={Move01Icon} size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Hide interpreter">
            <IconButton size="small" onClick={() => setOn(false)} aria-label="Hide interpreter">
              <Icon icon={Cancel01Icon} size={18} />
            </IconButton>
          </Tooltip>
        </Stack>
        <Box sx={{ position: "relative" }}>
          <Box
            component="video"
            ref={videoRef}
            src={src}
            autoPlay={live}
            controls={!live}
            muted
            playsInline
            preload="metadata"
            aria-label="Sign interpreter video"
            sx={{ display: "block", width: "100%", aspectRatio: "4 / 3", objectFit: "cover", bgcolor: "common.black", borderRadius: 2 }}
          />
          {live && !streaming && (
            <Typography
              variant="caption"
              sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "common.white", textAlign: "center", p: 2 }}
            >
              Waiting for the interpreter to start signing…
            </Typography>
          )}
        </Box>
      </Paper>
    </>
  );
}
