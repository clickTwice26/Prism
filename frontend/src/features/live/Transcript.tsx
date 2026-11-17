"use client";

import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Download04Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { useSettings } from "@/lib/settings";

export interface Line {
  id: number;
  time: string;
  text: string;
  translated?: string;
}

export const nowHM = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// Big live caption plus a scrolling, downloadable transcript.
export function Captions({ interim, lines, room }: { interim: string; lines: Line[]; room: string }) {
  const { settings } = useSettings();
  const boxRef = useRef<HTMLDivElement>(null);
  const last = lines.at(-1);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [lines.length]);

  const download = () => {
    const body = lines.map((l) => `[${l.time}] ${l.translated ?? l.text}`).join("\n");
    const url = URL.createObjectURL(new Blob([`Prism class ${room} transcript\n\n${body}\n`], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `prism-${room}-transcript.txt` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack spacing={2}>
      <Paper
        sx={{
          p: 3,
          minHeight: 110,
          bgcolor: "common.black",
          color: "common.white",
          fontSize: "1.6rem",
          lineHeight: 1.5,
          wordSpacing: `${settings.wordSpacing}em`,
        }}
        aria-hidden // the transcript below is the accessible version
      >
        {interim || last?.translated || last?.text || "Captions will appear here when the teacher speaks."}
      </Paper>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" component="h3">
          Transcript
        </Typography>
        <Button onClick={download} disabled={!lines.length} startIcon={<Icon icon={Download04Icon} size={18} />}>
          Save
        </Button>
      </Stack>
      <Box
        ref={boxRef}
        role="log"
        aria-live="polite"
        aria-label="Class transcript"
        sx={{ maxHeight: 280, overflowY: "auto", pr: 1, wordSpacing: `${settings.wordSpacing}em` }}
      >
        {lines.length === 0 && <Typography color="text.secondary">Nothing yet.</Typography>}
        {lines.map((l) => (
          <Typography key={l.id} sx={{ py: 0.75, borderBottom: 1, borderColor: "divider" }}>
            <Box component="span" sx={{ color: "text.secondary", mr: 1, fontVariantNumeric: "tabular-nums" }}>
              {l.time}
            </Box>
            {l.translated ?? l.text}
          </Typography>
        ))}
      </Box>
    </Stack>
  );
}
