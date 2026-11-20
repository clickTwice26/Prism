"use client";

import { Fragment, type ReactNode } from "react";
import Box from "@mui/material/Box";
import type { Lang } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { findSignTerms, useSignLexicon } from "@/lib/signs";
import { SignWord } from "./SignClip";

// Text with its signed key terms linked to their Bangla Sign Language clips.
// signs overrides the learner's "show signs" setting.
export function SignableText({ text: raw, lang, signs }: { text: string; lang?: string; signs?: boolean }) {
  const { settings } = useSettings();
  // One Unicode form, so Bangla written either way matches the sign labels.
  const text = raw.normalize("NFC");
  const { terms } = useSignLexicon();
  const on = signs ?? settings.signGlossary;
  const matches = on ? findSignTerms(text, lang, terms) : [];
  if (!matches.length) return <>{text}</>;

  const out: ReactNode[] = [];
  let at = 0;
  for (const m of matches) {
    if (m.start > at) out.push(<Fragment key={`p${at}`}>{text.slice(at, m.start)}</Fragment>);
    out.push(
      <SignWord key={`t${m.start}`} term={m.term} lang={(lang ?? settings.lang) as Lang}>
        {text.slice(m.start, m.end)}
      </SignWord>,
    );
    at = m.end;
  }
  if (at < text.length) out.push(<Fragment key={`p${at}`}>{text.slice(at)}</Fragment>);
  return <>{out}</>;
}

// Lesson text with the learner's word spacing and signed key terms.
export function ReadableText({ text, lang, signs }: { text: string; lang?: string; signs?: boolean }) {
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
      <SignableText text={text} lang={lang} signs={signs} />
    </Box>
  );
}
