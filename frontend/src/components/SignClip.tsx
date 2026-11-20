"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { PauseIcon, PlayIcon, SignLanguageCIcon } from "@hugeicons/core-free-icons";
import { signMediaUrl, termLabel, logUsage, type Lang, type SignTerm, type SignVideo } from "@/lib/api";
import { Icon } from "./Icon";

// A short, silent, looping sign clip with play/pause and a slow-motion
// option. Clips are recorded by people and approved by deaf reviewers.
export function SignClipPlayer({ clip, label, maxWidth = 320 }: { clip: SignVideo; label: string; maxWidth?: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = slow ? 0.5 : 1;
  }, [slow, clip.file]);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  return (
    <Stack spacing={1} sx={{ maxWidth }}>
      <Box
        component="video"
        ref={ref}
        key={clip.file}
        src={signMediaUrl(clip.file)}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        aria-label={`Bangla Sign Language sign for ${label}`}
        sx={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", bgcolor: "common.black", borderRadius: 2 }}
      />
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="outlined" onClick={toggle} startIcon={<Icon icon={playing ? PauseIcon : PlayIcon} size={18} />}>
          {playing ? "Pause" : "Play"}
        </Button>
        <Button size="small" variant={slow ? "contained" : "outlined"} aria-pressed={slow} onClick={() => setSlow((s) => !s)}>
          Slow
        </Button>
      </Stack>
    </Stack>
  );
}

// Who made and approved a clip: signers and deaf reviewers are named.
export function SignCredit({ clip }: { clip: SignVideo }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
      Signed by {clip.signer}
      {clip.region ? ` (${clip.region})` : ""}
      {clip.reviewer ? `. Approved by deaf reviewer ${clip.reviewer}.` : "."}
    </Typography>
  );
}

// All approved signs for a term, with a picker when there are regional variants.
export function SignTermCard({ term, lang }: { term: SignTerm; lang: Lang }) {
  const [i, setI] = useState(0);
  const clip = term.clips[Math.min(i, term.clips.length - 1)];
  const label = termLabel(term, lang);
  if (!clip) return null;
  return (
    <Stack spacing={1.25}>
      <Typography variant="h5" component="p" lang={term.labels[lang] ? lang : undefined}>
        {label}
      </Typography>
      {term.clips.length > 1 && (
        <ToggleButtonGroup
          exclusive
          size="small"
          value={i}
          onChange={(_, v: number | null) => v !== null && setI(v)}
          aria-label="Regional variant"
          sx={{ flexWrap: "wrap" }}
        >
          {term.clips.map((c, n) => (
            <ToggleButton key={c.id} value={n}>
              {c.region || `Variant ${n + 1}`}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}
      <SignClipPlayer clip={clip} label={label} />
      <SignCredit clip={clip} />
    </Stack>
  );
}

// An underlined key term: tap or press Enter to see its sign.
export function SignWord({ term, lang, children }: { term: SignTerm; lang: Lang; children: ReactNode }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const id = useId();
  const label = termLabel(term, lang);
  return (
    <>
      <ButtonBase
        component="span"
        onClick={(e) => {
          setAnchor(e.currentTarget);
          logUsage("sign", "glossary_open", { term: term.id });
        }}
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        aria-controls={anchor ? id : undefined}
        aria-label={`${label}: show the sign`}
        sx={(theme) => ({
          font: "inherit",
          color: "inherit",
          verticalAlign: "baseline",
          textDecoration: "underline",
          textDecorationStyle: "dotted",
          textDecorationThickness: "0.12em",
          textUnderlineOffset: "0.22em",
          textDecorationColor: theme.palette.primary.main,
          borderRadius: 1,
          px: 0.25,
          mx: -0.25,
          "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.1) },
          "&.Mui-focusVisible": { outline: `3px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
        })}
      >
        {children}
        <Box component="span" aria-hidden sx={{ display: "inline-flex", ml: 0.25, color: "primary.main", verticalAlign: "super" }}>
          <Icon icon={SignLanguageCIcon} size={14} />
        </Box>
      </ButtonBase>
      <Popover
        id={id}
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { role: "dialog", "aria-label": `Sign for ${label}`, sx: { p: 2, width: 340, maxWidth: "calc(100vw - 32px)" } } }}
      >
        <SignTermCard term={term} lang={lang} />
      </Popover>
    </>
  );
}
