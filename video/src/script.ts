// All copy and timings for the Prism Sign promo live here, so text can be
// edited without touching animation code. Times are in seconds.
//
// The Congress's "Vibe to Production in 180 Seconds" guidance fixes the five
// sections and their start times. Each section is split into scenes, and
// each scene has voiceover chunks: `text` is the caption (and the on-screen
// wording), `say` is how the voice should read it when it differs.

export const FPS = 30;
export const TOTAL_SECONDS = 180;

export type Chunk = { id: string; text: string; say?: string };
export type Scene = { id: string; start: number; end: number; vo: Chunk[] };
export type Section = {
  id: string;
  label: string; // shown in the top progress bar
  kicker: string;
  bn: string;
  key: string; // the Congress's key message for this section
  start: number;
  end: number;
  scenes: Scene[];
};

export const BADGE = "Captions on · Designed to be watched without sound";

export const SECTIONS: Section[] = [
  {
    id: "problem",
    label: "Problem",
    kicker: "THE PROBLEM",
    bn: "সমস্যা",
    key: "This problem matters",
    start: 0,
    end: 30,
    scenes: [
      {
        id: "classroom",
        start: 0,
        end: 8.2,
        vo: [
          { id: "mitu", text: "This is Mitu." },
          { id: "class", text: "Her class is learning photosynthesis." },
          { id: "deaf", text: "Mitu is deaf, and the lesson isn't reaching her." },
        ],
      },
      {
        id: "why",
        start: 8.2,
        end: 30,
        vo: [
          {
            id: "official",
            text: "Bangla Sign Language has been official since 2009,",
            say: "Bangla Sign Language has been official since two thousand nine,",
          },
          { id: "spoken", text: "yet most deaf children still learn from spoken lessons." },
          { id: "few", text: "There are too few interpreters, and many science words have no sign at all." },
          { id: "global", text: "And it isn't only Bangladesh:" },
          {
            id: "seventy",
            text: "about 70 million deaf people worldwide use sign languages,",
            say: "about seventy million deaf people worldwide use sign languages,",
          },
          { id: "built", text: "and most classrooms aren't built for them." },
        ],
      },
    ],
  },
  {
    id: "solution",
    label: "Solution",
    kicker: "THE SOLUTION",
    bn: "সমাধান",
    key: "This is how we solve it",
    start: 30,
    end: 60,
    scenes: [
      {
        id: "meet",
        start: 30,
        end: 42,
        vo: [
          { id: "brings", text: "Prism Sign brings the same lesson to deaf learners, in Bangla Sign Language," },
          { id: "for", text: "for the children, their families, their teachers and interpreters." },
        ],
      },
      {
        id: "flow",
        start: 42,
        end: 60,
        vo: [
          { id: "different", text: "What makes it different?" },
          { id: "routine", text: "AI does the routine work. Real people do the signing," },
          { id: "approve", text: "and deaf reviewers approve every sign." },
          { id: "private", text: "Recognition runs in the browser, so no video ever leaves the device." },
        ],
      },
    ],
  },
  {
    id: "demo",
    label: "Demo",
    kicker: "DEMO",
    bn: "ডেমো",
    key: "This is how it works",
    start: 60,
    end: 120,
    scenes: [
      {
        id: "lessons",
        start: 60,
        end: 81,
        vo: [
          { id: "underlined", text: "In Lessons, every key word with an approved sign is underlined." },
          { id: "tap", text: "Tap it, and the sign plays." },
          { id: "window", text: "An interpreter window can be moved, resized or hidden, and captions stay on." },
          {
            id: "unrecorded",
            text: "For about 3,500 documented words no one has recorded yet,",
            say: "For about three thousand five hundred documented words no one has recorded yet,",
          },
          { id: "preview", text: "a 3D signer shows a labelled preview." },
        ],
      },
      {
        id: "signwords",
        start: 81,
        end: 97,
        vo: [
          { id: "parents", text: "Most deaf children have hearing parents." },
          { id: "checks", text: "In Sign words, a parent signs, and Prism checks" },
          { id: "parts", text: "the handshape, place, movement and direction," },
          { id: "fix", text: "then says exactly what to fix." },
        ],
      },
      {
        id: "fingerspell",
        start: 97,
        end: 105,
        vo: [{ id: "alphabet", text: "Fingerspell teaches the Bangla two-hand alphabet the same way, letter by letter." }],
      },
      {
        id: "live",
        start: 105,
        end: 120,
        vo: [
          { id: "captions", text: "And in a live class, captions appear as the teacher speaks," },
          { id: "join", text: "key terms link to their signs, and an interpreter can join from anywhere." },
        ],
      },
    ],
  },
  {
    id: "ai",
    label: "AI approach",
    kicker: "AI APPROACH",
    bn: "এআই পদ্ধতি",
    key: "This is real AI thinking",
    start: 120,
    end: 150,
    scenes: [
      {
        id: "layers",
        start: 120,
        end: 150,
        vo: [
          { id: "three", text: "Prism uses three kinds of AI." },
          { id: "gemini", text: "A Gemini language model finds each lesson's key terms" },
          { id: "langs", text: "in Bangla, English and Malay." },
          { id: "speech", text: "Speech recognition turns the teacher's voice into captions." },
          { id: "mediapipe", text: "And MediaPipe tracks hand and body points in the browser," },
          {
            id: "compare",
            text: "which Prism compares, part by part, with about 3,600 documented signs.",
            say: "which Prism compares, part by part, with about three thousand six hundred documented signs.",
          },
          { id: "descriptions", text: "So it's built from written sign descriptions, not a huge video dataset." },
        ],
      },
    ],
  },
  {
    id: "impact",
    label: "Impact",
    kicker: "IMPACT AND NEXT STEP",
    bn: "প্রভাব ও পরবর্তী ধাপ",
    key: "We can build and scale this",
    start: 150,
    end: 180,
    scenes: [
      {
        id: "kpis",
        start: 150,
        end: 165,
        vo: [
          { id: "measure", text: "In our pilot, we'll measure what matters:" },
          { id: "ninety", text: "90% of each lesson's key terms signed,", say: "ninety percent of each lesson's key terms signed," },
          { id: "gain", text: "a comprehension gain for most children," },
          {
            id: "rating",
            text: "and a rating of 4 out of 5 from deaf learners themselves.",
            say: "and a rating of four out of five from deaf learners themselves.",
          },
        ],
      },
      {
        id: "close",
        start: 165,
        end: 180,
        vo: [
          { id: "january", text: "From January, we pilot in deaf schools." },
          { id: "tagline", text: "Prism Sign. The same lesson, in Bangla Sign Language." },
          { id: "made", text: "Made with deaf people, for deaf children." },
        ],
      },
    ],
  },
];

// ---- On-screen copy -------------------------------------------------------

export const COPY = {
  problem: {
    headline: "The lesson is spoken.\nHer language is signed.",
    headlineBn: "পাঠ মুখে বলা হয়, কিন্তু তার ভাষা ইশারা।",
    cards: [
      { icon: "clock", title: "Too few interpreters", text: "An estimated ~30 accredited, nationwide (TBS, 2026)" },
      { icon: "book", title: "No signs for subject words", text: "“Not many words in the sign language books” (TBS)" },
      { icon: "search", title: "Signs are hard to find", text: "No tool puts them where the child is reading" },
    ],
    who: ["Deaf learners", "Hearing parents", "Teachers", "Sign interpreters"],
    bdStats: [
      { big: "9.6%", text: "of people surveyed had disabling hearing loss", source: "2013 national survey (TBS, 2026)" },
      { big: "2009", text: "Bangla Sign Language became an official language", source: "bdnews24.com, 2022" },
    ],
    worldStat: {
      big: "~70 million",
      text: "deaf people worldwide use sign languages",
      source: "World Federation of the Deaf",
    },
  },
  press: {
    kicker: "IN THE NATIONAL PRESS",
    bn: "জাতীয় সংবাদমাধ্যমে",
    // Real articles captured by tools/press.mjs into public/press/. `at` is the voiceover line
    // the card arrives on; `slot` is 0 (left) or 1 (right).
    cards: [
      { id: "prothomalo", paper: "Prothom Alo", bnPaper: "প্রথম আলো", date: "23 Sep 2026", label: "Opinion", en: "“Do not keep sign-language people silent”", at: "official", delay: -0.3, slot: 0 },
      { id: "bdnews24", paper: "bdnews24.com", bnPaper: "বিডিনিউজ২৪", date: "20 Feb 2022", label: "Opinion", en: "Highlighted: on 1 February 2009, Bangla Sign Language was declared at state level", at: "official", delay: 1.0, slot: 1 },
      { id: "tbs-school", paper: "The Business Standard", date: "9 Jun 2023", at: "spoken", delay: 0, slot: 0 },
      { id: "tbs-interpreters", paper: "The Business Standard", date: "15 Oct 2026", at: "few", delay: -0.1, slot: 1 },
      { id: "tbs-khulna", paper: "The Business Standard", date: "22 Mar 2023", at: "few", delay: 2.1, slot: 0 },
    ],
  },
  solution: {
    headline: "The same lesson, in\nBangla Sign Language.",
    headlineBn: "একই পাঠ, বাংলা ইশারা ভাষায়।",
    chips: ["Deaf learners", "Families", "Teachers", "Sign interpreters", "Deaf reviewers"],
    flowTitle: "How it works",
    flowBn: "যেভাবে কাজ করে",
    flow: {
      input: { title: "Input", items: ["Lesson text", "The teacher's voice", "A learner's camera"] },
      ai: {
        title: "AI",
        items: ["Gemini finds key terms and translates", "Speech recognition makes captions", "On-device hand and body tracking"],
      },
      output: {
        title: "Output",
        items: ["Signed key terms in the lesson", "Live captions linked to signs", "Coaching on each part of a sign"],
      },
      human: "Signer records  →  deaf reviewer approves",
    },
    different: [
      { icon: "people", title: "Human signs, deaf-approved", text: "Not an avatar translator" },
      { icon: "doc", title: "Built from written sign descriptions", text: "No huge video dataset needed" },
      { icon: "lock", title: "Private by design", text: "Only hand and body points; no video leaves the device" },
    ],
  },
  demo: {
    chapters: [
      {
        n: "01",
        kicker: "LESSONS IN SIGN",
        bn: "পাঠে ইশারা",
        headline: "Tap a word,\nsee the sign.",
        rows: [
          { icon: "tap", title: "Tap a word, see the sign", text: "Key terms underlined, short silent clips" },
          { icon: "window", title: "An interpreter you can move", text: "Move, resize or hide; captions stay on" },
          { icon: "cube", title: "Previews, clearly labelled", text: "3D signer for about 3,500 unrecorded words" },
        ],
      },
      {
        n: "02",
        kicker: "SIGN WORDS, WITH A COACH",
        bn: "ইশারা শিখুন",
        headline: "A coach for\nevery part of a sign.",
        rows: [
          { icon: "home", title: "43 everyday words", text: "Home, school and health" },
          { icon: "target", title: "Coached part by part", text: "Handshape, place, movement, direction" },
          { icon: "lock", title: "Only points, never video", text: "Nothing leaves the device" },
        ],
      },
      {
        n: "03",
        kicker: "FINGERSPELL",
        bn: "আঙুলে বানান",
        headline: "The two-hand\nBangla alphabet.",
        rows: [
          { icon: "hand", title: "Letter by letter", text: "For names and words without a sign" },
          { icon: "bars", title: "Feedback on every part", text: "Bars fill as the handshape improves" },
          { icon: "shield", title: "Consented samples only", text: "Skeleton points train the recogniser" },
        ],
      },
      {
        n: "04",
        kicker: "LIVE CLASS",
        bn: "লাইভ ক্লাস",
        headline: "Live captions, an\ninterpreter anywhere.",
        rows: [
          { icon: "cc", title: "Captions as the teacher speaks", text: "With a saved transcript" },
          { icon: "link", title: "Key terms link to signs", text: "Tap a word in the transcript" },
          { icon: "globe", title: "Interpreter from another city", text: "Signs as a second video" },
        ],
      },
    ],
    previewLabel: "Preview · computer-made from the written description",
    signClip: "Sign clip",
  },
  ai: {
    headline: "Three kinds of AI,\none human check.",
    headlineBn: "তিন ধরনের এআই, মানুষের যাচাই।",
    layers: [
      {
        n: "1",
        name: "Language model",
        chip: "Google Gemini · gemini-4-hydrogen",
        text: "Finds 5–10 key terms per lesson, labelled in Bangla, English and Malay; translates lessons. JSON output, cached in Redis, rate-limited.",
      },
      {
        n: "2",
        name: "Speech recognition",
        chip: "Browser speech API",
        text: "The teacher's voice becomes live captions and a transcript; signed terms are linked automatically.",
      },
      {
        n: "3",
        name: "Sign recognition",
        chip: "MediaPipe hands (21 points) + pose · in the browser",
        text: "Documented signs compiled into part templates. A small handshape classifier and time-aligned matching score each part.",
      },
    ],
    data: {
      title: "Data",
      text: "IsharaKotha corpus: written (HamNoSys) descriptions of about 3,600 signs. The largest public word-level BdSL video dataset has only 60 words, so Prism starts from descriptions.",
    },
    personal: {
      title: "Personalisation",
      text: "Coaching names the one part to fix. Each learner's language, colours, text size, word spacing and interpreter window are remembered.",
    },
    loop: ["AI suggests", "Teacher edits", "Signer records, with consent", "Deaf reviewer approves"],
  },
  impact: {
    headline: "What the pilot will measure.",
    headlineBn: "পাইলটে যা মাপা হবে।",
    kpis: [
      { big: "90%", text: "of each pilot lesson's key terms have an approved sign" },
      { big: "> 0", text: "comprehension gain for most learners, sign vs captions only" },
      { big: "4 / 5", text: "satisfaction, rated by deaf learners in BdSL" },
      { big: "Days", text: "from a missing-sign request to an approved clip, measured" },
    ],
    targetLabel: "Pilot target",
    users: ["Deaf learners", "Hearing families", "Teachers", "Sign interpreters", "Deaf schools and NGOs"],
    value: ["Interpreters record each sign once; it's reused in every lesson", "Signers are paid for every approved sign"],
    roadmap: [
      { when: "26 Dec 2026", what: "Congress demo" },
      { when: "Jan–Jun 2027", what: "Pilot in deaf schools" },
      { when: "Next", what: "Lexicon grown by the deaf community" },
    ],
  },
  end: {
    title: "Prism Sign",
    tagline: "The same lesson, in Bangla Sign Language.",
    taglineBn: "একই পাঠ, বাংলা ইশারা ভাষায়।",
    event: "International AI Builders Congress 2026 · LearnSphere AI → AI Teacher",
    credit: "Signs from the IsharaKotha corpus and the community. Every sign approved by deaf reviewers.",
  },
};

// YouTube chapter markers (also embedded as MP4 chapters).
export const CHAPTERS = SECTIONS.map((s) => ({
  start: s.start,
  title: s.id === "impact" ? "Impact and next steps" : s.label,
}));
