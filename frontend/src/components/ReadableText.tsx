"use client";

import { Fragment, type ReactNode } from "react";
import Box from "@mui/material/Box";
import type { Lang } from "@/lib/api";
import type { WordRange } from "@/lib/useReadAloud";
import { useSettings } from "@/lib/settings";
import { findSignTerms, useSignLexicon, type TermMatch } from "@/lib/signs";
import { SignWord } from "./SignClip";

const highlight = (key: number, text: string) => (
  <Box key={key} component="mark" sx={{ bgcolor: "primary.main", color: "primary.contrastText", borderRadius: 1, px: 0.25 }}>
    {text}
  </Box>
);

// Text with its signed key terms linked to their Bangla Sign Language clips
// and, while reading aloud, the spoken word highlighted. signs overrides the
// learner's "show signs" setting (the adaptive lesson decides it per part).
export function SignableText({
  text,
  lang,
  word,
  signs,
}: {
  text: string;
  lang?: string;
  word?: WordRange | null;
  signs?: boolean;
}) {
  const { settings } = useSettings();
  const { terms } = useSignLexicon();
  const on = signs ?? settings.signGlossary;
  const matches: TermMatch[] = on ? findSignTerms(text, lang, terms) : [];
  const w = word && word.end > word.start ? word : null;
  if (!matches.length && !w) return <>{text}</>;

  // Cut the text wherever a term or the highlighted word starts or ends.
  const cuts = new Set([0, text.length]);
  for (const m of matches) cuts.add(m.start).add(m.end);
  if (w) cuts.add(Math.min(w.start, text.length)).add(Math.min(w.end, text.length));
  const points = [...cuts].sort((a, b) => a - b);

  const out: ReactNode[] = [];
  let group: { match: TermMatch; parts: ReactNode[] } | null = null;
  const flush = () => {
    if (!group) return;
    out.push(
      <SignWord key={`t${group.match.start}`} term={group.match.term} lang={(lang ?? settings.lang) as Lang}>
        {group.parts}
      </SignWord>,
    );
    group = null;
  };
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    if (a === b) continue;
    const piece = text.slice(a, b);
    const node = w && a >= w.start && b <= w.end ? highlight(a, piece) : <Fragment key={a}>{piece}</Fragment>;
    const m = matches.find((x) => a >= x.start && b <= x.end);
    if (m) {
      if (group && group.match !== m) flush();
      group ??= { match: m, parts: [] };
      group.parts.push(node);
    } else {
      flush();
      out.push(node);
    }
  }
  flush();
  return <>{out}</>;
}

// Lesson text with the learner's word spacing, signed key terms and an
// optional highlighted word, for reading along while the text is spoken.
export function ReadableText({
  text,
  word,
  lang,
  signs,
}: {
  text: string;
  word?: WordRange | null;
  lang?: string;
  signs?: boolean;
}) {
  const { settings } = useSettings();
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
      <SignableText text={text} lang={lang} word={word} signs={signs} />
    </Box>
  );
}
