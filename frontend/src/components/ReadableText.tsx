"use client";

import Box from "@mui/material/Box";
import type { WordRange } from "@/lib/useReadAloud";
import { useSettings } from "@/lib/settings";

// Lesson text with the learner's word spacing and an optional highlighted
// word, for reading along while the text is spoken.
export function ReadableText({ text, word, lang }: { text: string; word?: WordRange | null; lang?: string }) {
  const { settings } = useSettings();
  const parts =
    word && word.end > word.start
      ? [text.slice(0, word.start), text.slice(word.start, word.end), text.slice(word.end)]
      : [text];
  return (
    <Box
      lang={lang}
      sx={{
        typography: "reading",
        wordSpacing: `${settings.wordSpacing}em`,
        whiteSpace: "pre-wrap",
        maxWidth: "70ch",
      }}
    >
      {parts.length === 3 ? (
        <>
          {parts[0]}
          <Box
            component="mark"
            sx={{ bgcolor: "primary.main", color: "primary.contrastText", borderRadius: 1, px: 0.25 }}
          >
            {parts[1]}
          </Box>
          {parts[2]}
        </>
      ) : (
        text
      )}
    </Box>
  );
}
