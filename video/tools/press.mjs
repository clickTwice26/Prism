// Captures the national newspaper articles shown in the Problem section.
// For each article it saves three crops from the real page, unedited:
//   <id>-head.png      the headline
//   <id>-quote.png     the paragraph that contains the quoted sentence, with that sentence
//                      highlighted in orange (a background colour only; the text is untouched)
// and writes public/press/sources.json. Run: node tools/press.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "press");
mkdirSync(OUT, { recursive: true });

export const ARTICLES = [
  {
    id: "prothomalo",
    paper: "Prothom Alo",
    date: "23 Sep 2026",
    label: "Opinion",
    url: "https://www.prothomalo.com/opinion/column/jp2tb8zn2j",
    quote: ["সেখানে অবশ্যই", "হতে পারে"],
    headlineEn: "“Do not keep sign-language people silent”",
  },
  {
    id: "bdnews24",
    paper: "bdnews24.com",
    date: "20 Feb 2022",
    label: "Opinion",
    url: "https://bangla.bdnews24.com/opinion/comment/68623",
    quote: ["২০০৯ সালের", "চালুর ঘোষণা দেন"],
    headlineEn: "Bangla Sign Language Institute: neglected deaf people's representation",
  },
  {
    id: "tbs-school",
    paper: "The Business Standard",
    date: "9 Jun 2023",
    url: "https://www.tbsnews.net/bangladesh/dhaka-government-deaf-high-school-unheard-unseen-and-forgotten-646802",
    quote: "Many parents complain that sign language is not taught in the school.",
  },
  {
    id: "tbs-interpreters",
    paper: "The Business Standard",
    date: "15 Oct 2026",
    url: "https://www.tbsnews.net/features/panorama/giving-words-depressed-deaf-1573366",
    quote: "Dip estimates that Bangladesh has only about 30 accredited sign-language interpreters nationwide.",
  },
  {
    id: "tbs-khulna",
    paper: "The Business Standard",
    date: "22 Mar 2023",
    url: "https://www.tbsnews.net/bangladesh/education/khulna-school-helps-differently-abled-kids-bloom-603746",
    quote: "there are not many words in the sign language books",
  },
];

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--lang=en-GB,bn"],
});
const results = [];
for (const a of ARTICLES) {
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  );
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  try {
    await page.goto(a.url, { waitUntil: "networkidle2", timeout: 60000 });
  } catch {
    // Some news sites never go network-idle (ads); carry on once the DOM is there.
  }
  await new Promise((r) => setTimeout(r, 2500));
  // Hide overlays that cover the article (cookie bars, sticky ads, pop-ups). Article content is untouched.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if ((cs.position === "fixed" || cs.position === "sticky") && !el.closest("header")) el.style.display = "none";
    }
    document.querySelectorAll("iframe, [id*='google_ads'], [class*='advert'], [class*='ads-']").forEach((el) => (el.style.visibility = "hidden"));
  });
  // A quote is either an exact string or [first words, last words] of the sentence to highlight.
  const [qStart, qEnd] = Array.isArray(a.quote) ? a.quote : [a.quote, null];
  const box = await page.evaluate((quote, quoteEnd) => {
    const r = (el) => {
      el.scrollIntoView({ block: "center" });
      const b = el.getBoundingClientRect();
      return { x: b.x + scrollX, y: b.y + scrollY, w: b.width, h: b.height };
    };
    const h1 = document.querySelector("h1");
    const p = [...document.querySelectorAll("p, div")].filter((e) => e.children.length < 6 && e.textContent.includes(quote)).sort((a, b) => a.textContent.length - b.textContent.length)[0];
    let marked = false;
    if (p) {
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const i = n.data.indexOf(quote);
        if (i < 0) continue;
        const j = quoteEnd ? n.data.indexOf(quoteEnd, i) : i;
        if (j < 0) continue;
        const range = document.createRange();
        range.setStart(n, i);
        range.setEnd(n, quoteEnd ? j + quoteEnd.length : i + quote.length);
        const mark = document.createElement("mark");
        mark.style.cssText = "background: rgba(255,180,107,0.6); color: inherit; padding: 0 2px; border-radius: 3px;";
        range.surroundContents(mark);
        marked = true;
        break;
      }
    }
    h1?.setAttribute("data-press", "head");
    p?.setAttribute("data-press", "quote");
    return { h1: h1 && r(h1), h1Text: h1?.textContent.trim(), quote: p && r(p), marked };
  }, qStart, qEnd);
  const shot = async (name, b, padX = 24, padTop = 20, padBottom = 20, extraH = 0) => {
    if (!b) return false;
    await page.screenshot({
      path: join(OUT, `${a.id}-${name}.png`),
      captureBeyondViewport: true,
      clip: { x: Math.max(0, b.x - padX), y: Math.max(0, b.y - padTop), width: Math.min(1280, b.w + padX * 2), height: b.h + padTop + padBottom + extraH },
    });
    return true;
  };
  // Measure again right before each shot: late-loading images can move the article.
  const measure = async (which) => {
    await page.evaluate((w) => document.querySelector(`[data-press="${w}"]`)?.scrollIntoView({ block: "center" }), which);
    await new Promise((r) => setTimeout(r, 1500));
    return page.evaluate((w) => {
      const el = document.querySelector(`[data-press="${w}"]`);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.x + scrollX, y: b.y + scrollY, w: b.width, h: b.height };
    }, which);
  };
  const head = await shot("head", await measure("head"), 24, 12, 16);
  const quote = await shot("quote", await measure("quote"), 24, 16, 16);
  results.push({ ...a, headline: box.h1Text, head, quote, highlighted: box.marked });
  console.log(`${a.id.padEnd(17)} head:${head} quote:${quote} highlighted:${box.marked}  ${box.h1Text?.slice(0, 70)}`);
  await page.close();
}
await browser.close();
writeFileSync(join(OUT, "sources.json"), JSON.stringify(results, null, 2) + "\n");
