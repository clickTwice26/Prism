"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSignLexicon, type Lang, type SignTerm } from "./api";

// The approved Bangla Sign Language lexicon, loaded once and shared, so any
// text (lessons, simplified text, captions, transcripts) can link its key
// terms to their signs. Fires and listens for "prism:signs-changed".

interface Ctx {
  terms: SignTerm[];
  refresh: () => void;
}

const SignContext = createContext<Ctx>({ terms: [], refresh: () => undefined });

export const SIGNS_CHANGED = "prism:signs-changed";
export const signsChanged = () => window.dispatchEvent(new Event(SIGNS_CHANGED));

export function SignLexiconProvider({ children }: { children: ReactNode }) {
  const [terms, setTerms] = useState<SignTerm[]>([]);
  const refresh = useCallback(() => {
    getSignLexicon()
      .then(setTerms)
      .catch(() => undefined); // signs are an extra layer: text still works without them
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener(SIGNS_CHANGED, refresh);
    return () => window.removeEventListener(SIGNS_CHANGED, refresh);
  }, [refresh]);
  const value = useMemo(() => ({ terms, refresh }), [terms, refresh]);
  return <SignContext value={value}>{children}</SignContext>;
}

export const useSignLexicon = () => useContext(SignContext);

export interface TermMatch {
  start: number;
  end: number;
  term: SignTerm;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Where each signed term appears in a text. English and Malay match whole
// words (plus a plural ending); Bangla also matches with case endings, as in
// ক্লোরোফিলের. Longer terms win where matches overlap.
export function findSignTerms(text: string, lang: string | undefined, terms: SignTerm[]): TermMatch[] {
  if (!text || terms.length === 0) return [];
  const found: TermMatch[] = [];
  for (const term of terms) {
    const labels = lang && term.labels[lang as Lang] ? [term.labels[lang as Lang]!] : Object.values(term.labels);
    for (const label of labels) {
      if (!label) continue;
      const bangla = /[ঀ-৿]/.test(label);
      const tail = bangla ? "[\\p{L}\\p{M}]*" : "(?:e?s)?(?![\\p{L}\\p{M}])";
      const re = new RegExp(`(?<![\\p{L}\\p{M}])${escape(label).replace(/\s+/g, "\\s+")}${tail}`, "giu");
      for (const m of text.matchAll(re)) found.push({ start: m.index, end: m.index + m[0].length, term });
    }
  }
  found.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const out: TermMatch[] = [];
  let at = 0;
  for (const m of found) {
    if (m.start >= at) {
      out.push(m);
      at = m.end;
    }
  }
  return out;
}
