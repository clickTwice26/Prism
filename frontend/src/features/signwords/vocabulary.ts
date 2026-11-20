// Which words the Sign words page recognises: the demo set, every documented
// sign, or one lesson's key terms (documented signs plus signs learned from
// approved community clips).

import { getAllTemplates, getLessonSigns, getWordTemplates, termLabel } from "@/lib/api";
import type { WordTemplate } from "@/lib/handsign/motion.ts";
import { DEMO_WORDS } from "@/lib/handsign/words.ts";

export type VocabSource = "demo" | "all" | `lesson:${number}`;

export interface Vocabulary {
  templates: WordTemplate[];
  /** Unique words, in display order. */
  words: string[];
  /** English gloss per word, when known. */
  gloss: Map<string, string>;
  /** Group per word (demo set only), for the word picker. */
  group: Map<string, string>;
  /** Words learned from community clips (lesson vocabularies). */
  learned: Set<string>;
}

const unique = (xs: string[]) => [...new Set(xs)];

export async function loadVocabulary(source: VocabSource): Promise<Vocabulary> {
  if (source === "demo") {
    const templates = await getWordTemplates(DEMO_WORDS.map((w) => w.bn));
    return {
      templates,
      words: DEMO_WORDS.map((w) => w.bn),
      gloss: new Map(DEMO_WORDS.map((w) => [w.bn, w.en])),
      group: new Map(DEMO_WORDS.map((w) => [w.bn, w.group])),
      learned: new Set(),
    };
  }
  if (source === "all") {
    const all = (await getAllTemplates()).filter(
      (t) => t.complete !== false && t.section !== "Letters" && !t.id.includes("Sentence") && t.signs.length > 0,
    );
    const gloss = new Map<string, string>();
    for (const t of all) if (t.en && !gloss.has(t.bn)) gloss.set(t.bn, t.en);
    return { templates: all, words: unique(all.map((t) => t.bn)), gloss, group: new Map(), learned: new Set() };
  }
  // A lesson: each key term, with its documented signs and the signs learned from its approved clips.
  const lesson = await getLessonSigns(Number(source.slice("lesson:".length)));
  const labels = unique(lesson.terms.flatMap((t) => Object.values(t.labels).filter((x): x is string => !!x)));
  const documented = labels.length ? await getWordTemplates(labels) : [];
  const templates: WordTemplate[] = [];
  const gloss = new Map<string, string>();
  const learned = new Set<string>();
  const words: string[] = [];
  for (const term of lesson.terms) {
    const word = term.labels.bn ?? termLabel(term, "en");
    const names = new Set(Object.values(term.labels).map((x) => x?.normalize("NFC").toLowerCase()));
    const own = documented.filter((d) => names.has(d.bn.normalize("NFC").toLowerCase()) || (d.en && names.has(d.en.toLowerCase())));
    const fromClips = term.derived ?? [];
    if (own.length === 0 && fromClips.length === 0) continue; // no sign yet: nothing to recognise
    words.push(word);
    if (term.labels.en) gloss.set(word, term.labels.en);
    if (fromClips.length) learned.add(word);
    // Report every variant under the term's own label.
    for (const t of [...own, ...fromClips]) templates.push({ ...t, bn: word });
  }
  return { templates, words, gloss, group: new Map(), learned };
}
