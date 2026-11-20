"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { Camera01Icon, StopIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { useAnnounce } from "@/components/Announcer";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { listLessons, logUsage, type Lesson } from "@/lib/api";
import { describeWord, wordFeedback } from "@/lib/handsign/describe.ts";
import type { WordTemplate } from "@/lib/handsign/motion.ts";
import { signWord } from "@/lib/handsign/syntheticSigning.ts";
import { isWordModel, wordModelScores, type WordModel } from "@/lib/handsign/wordModel.ts";
import {
  DEMO_WORDS,
  SignSegmenter,
  WORD_FEATURE_VERSION,
  WORD_PART_LABELS,
  resultMeans,
  scoreWords,
  weakestWordPart,
  wordFeatureVector,
  type SignFrame,
  type WordScore,
} from "@/lib/handsign/words.ts";
import { HandView, PartBars, type HandViewHandle } from "../fingerspell/HandView";
import { RecordPanel, type RecordKind, type Recorder } from "../fingerspell/RecordPanel";
import { Diagnostics } from "../fingerspell/Diagnostics";
import { useHandTracker, type TrackedHands } from "../fingerspell/useHandTracker";
import { loadVocabulary, type VocabSource, type Vocabulary } from "./vocabulary";

type Mode = "recognise" | "practise" | "record";
const SETTINGS_KEY = "prism.fingerspell.v1"; // shared with the Fingerspell page: the signing hand
const MODEL_URL = "/models/words.json"; // optional, trained in Python (ml/)
const SIM_WORDS = ["জ্বর", "বই", "পানি", "ধন্যবাদ"].map((w) => w.normalize("NFC"));

const WORD_RECORDING: RecordKind = {
  kind: "word",
  noun: "word",
  seconds: 3,
  featureVersion: WORD_FEATURE_VERSION,
  keep: (h) => !!h.dominant && !!h.body,
  features: (h) => wordFeatureVector({ dominant: h.dominant, other: h.other, body: h.body ?? null }),
  withBody: true,
};

const toFrame = (h: TrackedHands): SignFrame => ({ dominant: h.dominant, other: h.other, body: h.body ?? null });

export function SignWords() {
  const announce = useAnnounce();
  const [mode, setMode] = useState<Mode>("recognise");
  const [vocab, setVocab] = useState<WordTemplate[]>([]);
  const [source, setSource] = useState<VocabSource>("demo");
  const [vocabInfo, setVocabInfo] = useState<Vocabulary | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingVocab, setLoadingVocab] = useState(false);
  const [model, setModel] = useState<WordModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dominant, setDominant] = useState<"right" | "left">("right");
  const [result, setResult] = useState<WordScore[] | null>(null);
  const [signing, setSigning] = useState(false);
  const [seen, setSeen] = useState({ hand: false, body: false });
  const [target, setTarget] = useState(DEMO_WORDS[0].bn);
  const [simulate, setSimulate] = useState(false);
  const [showDiag, setShowDiag] = useState(false);
  const [swapHands, setSwapHands] = useState(false);
  const [lastFrame, setLastFrame] = useState<TrackedHands | null>(null);
  const diagRef = useRef(false);
  useEffect(() => {
    diagRef.current = showDiag;
  }, [showDiag]);

  const view = useRef<HandViewHandle>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const segmenter = useRef(new SignSegmenter());
  const recorder = useRef<Recorder | null>(null);
  const frameNo = useRef(0);
  const state = useRef({ vocab, model, mode, target, gloss: new Map<string, string>(), simWords: SIM_WORDS });

  useEffect(() => {
    const simWords = vocabInfo && source !== "demo" ? vocabInfo.words.slice(0, 4) : SIM_WORDS;
    state.current = { vocab, model, mode, target, gloss: vocabInfo?.gloss ?? new Map(), simWords };
  }, [vocab, model, mode, target, vocabInfo, source]);

  useEffect(() => {
    listLessons()
      .then(setLessons)
      .catch(() => undefined);
    fetch(MODEL_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((m: unknown) => setModel(isWordModel(m) ? m : null))
      .catch(() => setModel(null));
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as { dominant?: "right" | "left" };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from storage
      if (saved.dominant) setDominant(saved.dominant);
    } catch {
      /* ignore */
    }
  }, []);

  // The vocabulary: the demo words, every documented sign, or one lesson's key terms.
  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading state for a new vocabulary
    setLoadingVocab(true);
    loadVocabulary(source)
      .then((v) => {
        if (!live) return;
        setVocabInfo(v);
        setVocab(v.templates);
        setResult(null);
        setTarget((t) => (v.words.includes(t) ? t : (v.words[0] ?? t)));
      })
      .catch((e: Error) => live && setError(e.message))
      .finally(() => live && setLoadingVocab(false));
    return () => {
      live = false;
    };
  }, [source]);

  const gloss = (w: string) => vocabInfo?.gloss.get(w) ?? "";

  const chooseDominant = (d: "right" | "left") => {
    setDominant(d);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ dominant: d }));
    segmenter.current.reset();
  };

  // A finished signing: score every word (blending the learned model if there is one).
  const recognise = useCallback(
    (frames: SignFrame[]) => {
      const { vocab: v, model: m, mode: md, target: tg } = state.current;
      let ranked = scoreWords(frames, v);
      if (m) {
        const learned = wordModelScores(m, frames.map(wordFeatureVector));
        const p = (r: WordScore) => Math.max(learned.get(r.word) ?? 0, ...r.alsoMeans.map((w) => learned.get(w) ?? 0));
        ranked = ranked.map((r) => ({ ...r, score: 0.5 * r.score + 0.5 * p(r) })).sort((a, b) => b.score - a.score);
      }
      setResult(ranked);
      if (!ranked.length) return;
      if (md === "recognise") {
        announce(`${ranked[0].word}, ${state.current.gloss.get(ranked[0].word) ?? ""}`);
        logUsage("signwords", "recognised", { word: ranked[0].word });
      } else if (md === "practise") {
        const mine = ranked.find((r) => resultMeans(r, tg));
        const ok = resultMeans(ranked[0], tg) && (mine?.score ?? 0) >= 0.45;
        announce(ok ? `Well done: that is ${tg}.` : `Not quite. Try ${tg} again.`);
        logUsage("signwords", "practice_attempt", { word: tg, ok });
      }
    },
    [announce],
  );

  const onFrame = useCallback(
    (h: TrackedHands) => {
      view.current?.draw(h);
      recorder.current?.push(h);
      const { mode: md } = state.current;
      if (md !== "record") {
        const done = segmenter.current.push(toFrame(h));
        if (done) recognise(done);
      }
      if (frameNo.current++ % 3 === 0) {
        setSigning(segmenter.current.recording);
        setSeen({ hand: !!h.dominant, body: !!h.body });
        if (diagRef.current && frameNo.current % 6 === 1) setLastFrame(h);
      }
    },
    [recognise],
  );

  const tracker = useHandTracker(videoRef, { dominant, onFrame, withBody: true, swapHands });
  const setRecorder = useCallback((r: Recorder | null) => {
    recorder.current = r;
  }, []);

  useEffect(() => {
    videoRef.current = view.current?.video ?? null;
  });

  // Simulation: computer-made signers, resting between signs.
  useEffect(() => {
    if (!simulate || vocab.length === 0) return;
    tracker.stop();
    segmenter.current.reset();
    let queue: SignFrame[] = [];
    let round = 0;
    const id = window.setInterval(() => {
      if (queue.length === 0) {
        const { mode: md, target: tg, simWords } = state.current;
        const word = md === "practise" || md === "record" ? tg : simWords[round % Math.max(simWords.length, 1)];
        const variants = vocab.filter((t) => t.bn === word);
        const t = variants[round % Math.max(variants.length, 1)];
        round++;
        if (!t) return;
        const signing = signWord(t, round);
        const rest: SignFrame = { dominant: null, other: null, body: signing[0].body };
        queue = [...Array(12).fill(rest), ...signing, ...Array(12).fill(rest)];
      }
      const f = queue.shift()!;
      // Seen from the front, slightly from above.
      const toImage = (pts: [number, number, number][]) => pts.map(([x, y, z]) => ({ x: 0.5 - x * 0.3, y: 0.4 - y * 0.27 - z * 0.06 }));
      const image = [
        ...(f.dominant ? [{ points: toImage(f.dominant), dominant: true }] : []),
        ...(f.other ? [{ points: toImage(f.other), dominant: false }] : []),
      ];
      // A simple body outline from the anchors.
      let imageBody: { x: number; y: number }[] | null = null;
      if (f.body) {
        const b = f.body;
        const pts = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5 }));
        const put = (i: number, v: [number, number]) => (pts[i] = toImage([[v[0], v[1], 0]])[0]);
        put(0, b.nose);
        put(2, [b.eyes[0] - 0.12 * b.width, b.eyes[1]]);
        put(5, [b.eyes[0] + 0.12 * b.width, b.eyes[1]]);
        put(7, b.ear.left);
        put(8, b.ear.right);
        put(9, [b.mouth[0] - 0.07 * b.width, b.mouth[1]]);
        put(10, [b.mouth[0] + 0.07 * b.width, b.mouth[1]]);
        put(11, b.shoulder.left);
        put(12, b.shoulder.right);
        put(23, [b.hips[0] - 0.35 * b.width, b.hips[1]]);
        put(24, [b.hips[0] + 0.35 * b.width, b.hips[1]]);
        imageBody = pts;
      }
      onFrame({ dominant: f.dominant, other: f.other, body: f.body, bodyPoints: null, image, imageBody, t: performance.now() });
    }, 66);
    return () => window.clearInterval(id);
    // tracker.stop is stable; restart only when these change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulate, vocab, onFrame]);

  const startCamera = () => {
    setSimulate(false);
    segmenter.current.reset();
    void tracker.start();
    logUsage("signwords", "camera_start", { dominant });
  };

  const targetTemplate = vocab.find((t) => t.bn === target);
  const targetScore = result?.find((r) => resultMeans(r, target));
  const best = result?.[0];
  const live = tracker.status === "running" || simulate;

  const words = vocabInfo?.words ?? [];
  const wordPicker = (
    <Autocomplete
      size="small"
      options={words}
      value={words.includes(target) ? target : null}
      onChange={(_, v) => {
        if (v) {
          setTarget(v);
          setResult(null);
        }
      }}
      groupBy={source === "demo" ? (w) => vocabInfo?.group.get(w) ?? "" : undefined}
      getOptionLabel={(w) => (gloss(w) ? `${w} · ${gloss(w)}` : w)}
      renderInput={(params) => <TextField {...params} label={`Word (${words.length})`} />}
    />
  );

  const vocabPicker = (
    <FormControl fullWidth size="small">
      <InputLabel id="vocab-pick">Words to recognise</InputLabel>
      <Select labelId="vocab-pick" label="Words to recognise" value={source} onChange={(e) => setSource(e.target.value as VocabSource)}>
        <MenuItem value="demo">Demo words ({DEMO_WORDS.length})</MenuItem>
        <MenuItem value="all">All documented words (about 3,500)</MenuItem>
        <ListSubheader>A lesson&apos;s key terms</ListSubheader>
        {lessons.map((l) => (
          <MenuItem key={l.id} value={`lesson:${l.id}`}>
            {l.subject ? `${l.subject}: ` : ""}
            {l.title}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  return (
    <Stack spacing={3}>
      <Tabs value={mode} onChange={(_, v: Mode) => (setMode(v), setResult(null))} aria-label="Sign words mode" variant="scrollable" allowScrollButtonsMobile sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tab value="recognise" label="Recognise" />
        <Tab value="practise" label="Practise a word" />
        <Tab value="record" label="Record samples" />
      </Tabs>

      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 2 }}>
            <Stack spacing={2}>
              {vocabPicker}
              {loadingVocab && <LinearProgress aria-label="Loading the words" />}
              {!loadingVocab && vocabInfo && words.length === 0 && (
                <Alert severity="info">
                  None of this lesson&apos;s key terms has a sign yet. Approve signs in the Sign glossary first.
                </Alert>
              )}
              <HandView ref={view} label="You, mirrored" simulated={simulate} />
              <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                {tracker.status === "running" ? (
                  <Button variant="outlined" color="error" onClick={tracker.stop} startIcon={<Icon icon={StopIcon} />}>
                    Stop camera
                  </Button>
                ) : (
                  <Button variant="contained" onClick={startCamera} disabled={tracker.status === "loading" || !vocab.length} startIcon={<Icon icon={Camera01Icon} />}>
                    {tracker.status === "loading" ? "Loading tracking…" : "Start camera"}
                  </Button>
                )}
                <FormControlLabel
                  control={<Switch checked={simulate} onChange={(e) => setSimulate(e.target.checked)} disabled={!vocab.length} />}
                  label="Simulate (no camera)"
                />
                <Box sx={{ flex: 1 }} />
                <Typography id="dominant-label-w" variant="body2">
                  Signing hand
                </Typography>
                <ToggleButtonGroup size="small" exclusive value={dominant} onChange={(_, v) => v && chooseDominant(v)} aria-labelledby="dominant-label-w">
                  <ToggleButton value="right">Right</ToggleButton>
                  <ToggleButton value="left">Left</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              {tracker.error && <Alert severity="warning">{tracker.error}</Alert>}
              <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
                <FormControlLabel control={<Switch checked={showDiag} onChange={(e) => setShowDiag(e.target.checked)} />} label="Show what Prism sees" />
                <FormControlLabel
                  control={<Switch checked={swapHands} onChange={(e) => setSwapHands(e.target.checked)} />}
                  label="Swap hands (if Prism mixes up your hands)"
                />
              </Stack>
              {showDiag && <Diagnostics frame={lastFrame} />}
              {live && (
                <Typography variant="body2" color="text.secondary" role="status">
                  {!seen.body
                    ? "Step back so your head and shoulders are in view."
                    : signing
                      ? "Signing…"
                      : "Raise your signing hand to sign a word, then lower it."}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                Only the positions of your hand and body joints are used. Video stays on this device.
              </Typography>
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          {mode === "recognise" && (
            <Paper sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Typography variant="h4" component="h2">
                  What you signed
                </Typography>
                {!best ? (
                  <Typography color="text.secondary">
                    Sign one of the {words.length.toLocaleString()} words. {simulate && `The simulation signs ${(source === "demo" ? SIM_WORDS : words.slice(0, 4)).join(", ")}.`}
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    <Typography variant="display" component="p" lang="bn" role="status">
                      {best.word}
                    </Typography>
                    <Typography variant="lead">{gloss(best.word)}</Typography>
                    {vocabInfo?.learned.has(best.word) && (
                      <Typography variant="caption" color="text.secondary">
                        Recognised using a sign learned from an approved community clip.
                      </Typography>
                    )}
                    {best.alsoMeans.length > 0 && (
                      <Typography variant="body2" color="text.secondary">
                        The same sign also means: <span lang="bn">{best.alsoMeans.join(", ")}</span>. Context tells them apart.
                      </Typography>
                    )}
                    {result!.slice(1, 3).map((s) => (
                      <Stack key={s.word} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                        <Typography lang="bn" sx={{ width: 110 }}>
                          {s.word}
                        </Typography>
                        <LinearProgress variant="determinate" value={s.score * 100} sx={{ flex: 1, height: 6, borderRadius: 3 }} aria-label={`${s.word}: ${Math.round(s.score * 100)}%`} />
                      </Stack>
                    ))}
                    <Typography variant="body2" color="text.secondary">
                      Why <span lang="bn">{best.word}</span> ({Math.round(best.score * 100)}%):
                    </Typography>
                    <PartBars score={best} labels={WORD_PART_LABELS} />
                  </Stack>
                )}
                <Typography variant="caption" color="text.secondary">
                  {words.length <= 60 ? `Words: ${words.join(" · ")}` : `${words.length.toLocaleString()} documented words.`}
                </Typography>
              </Stack>
            </Paper>
          )}

          {mode === "practise" && (
            <Paper sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Typography variant="h4" component="h2">
                  Practise <span lang="bn">{target}</span>
                  {gloss(target) ? ` (${gloss(target)})` : ""}
                </Typography>
                {wordPicker}
                {targetTemplate && (
                  <Box component="dl" sx={{ m: 0 }}>
                    {describeWord(targetTemplate).map((d, i) => (
                      <Box key={`${d.label}-${i}`} sx={{ mb: 1 }}>
                        <Typography component="dt" variant="subtitle1">
                          {d.label}
                        </Typography>
                        <Typography component="dd" sx={{ m: 0 }}>
                          {d.text}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
                <Typography variant="caption" color="text.secondary">
                  From the IsharaKotha sign descriptions. Signs vary by region: check with a deaf signer.
                </Typography>
                {targetScore && targetTemplate ? (
                  <Stack spacing={1.5}>
                    <PartBars score={targetScore} labels={WORD_PART_LABELS} />
                    {best && resultMeans(best, target) && targetScore.score >= 0.45 ? (
                      <Alert severity="success">
                        Well done! That is <span lang="bn">{target}</span>.
                      </Alert>
                    ) : (
                      <Alert severity="info">
                        {best && !resultMeans(best, target) && (
                          <>
                            That looked more like <span lang="bn">{best.word}</span>.{" "}
                          </>
                        )}
                        {wordFeedback(targetTemplate, weakestWordPart(targetScore))}
                      </Alert>
                    )}
                  </Stack>
                ) : (
                  <Typography color="text.secondary">{live ? "Raise your hand and sign the word." : "Start the camera or the simulation."}</Typography>
                )}
              </Stack>
            </Paper>
          )}

          {mode === "record" && (
            <Stack spacing={2}>
              <Paper sx={{ p: 2 }}>{wordPicker}</Paper>
              <RecordPanel
                what={WORD_RECORDING}
                ready={vocab.length > 0}
                dominant={dominant}
                live={live && !simulate}
                letterButtons={null}
                simLetter={target}
                onSimLetter={setTarget}
                setRecorder={setRecorder}
              />
            </Stack>
          )}
        </Grid>
      </Grid>
    </Stack>
  );
}
