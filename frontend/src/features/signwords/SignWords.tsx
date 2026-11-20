"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { getWordTemplates, logUsage } from "@/lib/api";
import { describeWord, wordFeedback } from "@/lib/handsign/describe.ts";
import type { WordTemplate } from "@/lib/handsign/motion.ts";
import { signWord } from "@/lib/handsign/syntheticSigning.ts";
import { isWordModel, wordModelScores, type WordModel } from "@/lib/handsign/wordModel.ts";
import {
  DEMO_WORDS,
  SignSegmenter,
  WORD_FEATURE_VERSION,
  WORD_PART_LABELS,
  scoreWords,
  weakestWordPart,
  wordFeatureVector,
  type SignFrame,
  type WordScore,
} from "@/lib/handsign/words.ts";
import { HandView, PartBars, type HandViewHandle } from "../fingerspell/HandView";
import { RecordPanel, type RecordKind, type Recorder } from "../fingerspell/RecordPanel";
import { useHandTracker, type TrackedHands } from "../fingerspell/useHandTracker";

type Mode = "recognise" | "practise" | "record";
const SETTINGS_KEY = "prism.fingerspell.v1"; // shared with the Fingerspell page: the signing hand
const MODEL_URL = "/models/words.json"; // optional, trained in Python (ml/)
const SIM_WORDS = ["জ্বর", "বই", "পানি", "ধন্যবাদ"].map((w) => w.normalize("NFC"));
const EN = new Map(DEMO_WORDS.map((w) => [w.bn, w.en]));

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
  const [model, setModel] = useState<WordModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dominant, setDominant] = useState<"right" | "left">("right");
  const [result, setResult] = useState<WordScore[] | null>(null);
  const [signing, setSigning] = useState(false);
  const [seen, setSeen] = useState({ hand: false, body: false });
  const [target, setTarget] = useState(DEMO_WORDS[0].bn);
  const [simulate, setSimulate] = useState(false);

  const view = useRef<HandViewHandle>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const segmenter = useRef(new SignSegmenter());
  const recorder = useRef<Recorder | null>(null);
  const frameNo = useRef(0);
  const state = useRef({ vocab, model, mode, target });

  useEffect(() => {
    state.current = { vocab, model, mode, target };
  }, [vocab, model, mode, target]);

  useEffect(() => {
    getWordTemplates(DEMO_WORDS.map((w) => w.bn))
      .then(setVocab)
      .catch((e: Error) => setError(e.message));
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
        ranked = ranked.map((r) => ({ ...r, score: 0.5 * r.score + 0.5 * (learned.get(r.word) ?? 0) })).sort((a, b) => b.score - a.score);
      }
      setResult(ranked);
      if (!ranked.length) return;
      if (md === "recognise") {
        announce(`${ranked[0].word}, ${EN.get(ranked[0].word) ?? ""}`);
        logUsage("signwords", "recognised", { word: ranked[0].word });
      } else if (md === "practise") {
        const mine = ranked.find((r) => r.word === tg);
        const ok = ranked[0].word === tg && (mine?.score ?? 0) >= 0.45;
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
      }
    },
    [recognise],
  );

  const tracker = useHandTracker(videoRef, { dominant, onFrame, withBody: true });
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
        const { mode: md, target: tg } = state.current;
        const word = md === "practise" || md === "record" ? tg : SIM_WORDS[round % SIM_WORDS.length];
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
  const targetScore = result?.find((r) => r.word === target);
  const best = result?.[0];
  const live = tracker.status === "running" || simulate;

  const groups = useMemo(() => {
    const m = new Map<string, typeof DEMO_WORDS>();
    for (const w of DEMO_WORDS) m.set(w.group, [...(m.get(w.group) ?? []), w]);
    return [...m.entries()];
  }, []);

  const wordPicker = (
    <FormControl fullWidth size="small">
      <InputLabel id="word-pick">Word</InputLabel>
      <Select labelId="word-pick" label="Word" value={target} onChange={(e) => (setTarget(e.target.value), setResult(null))}>
        {groups.flatMap(([g, ws]) => [
          <ListSubheader key={g}>{g}</ListSubheader>,
          ...ws.map((w) => (
            <MenuItem key={w.bn} value={w.bn}>
              <span lang="bn">{w.bn}</span>&nbsp;· {w.en}
            </MenuItem>
          )),
        ])}
      </Select>
    </FormControl>
  );

  return (
    <Stack spacing={3}>
      <Tabs value={mode} onChange={(_, v: Mode) => (setMode(v), setResult(null))} aria-label="Sign words mode" sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tab value="recognise" label="Recognise" />
        <Tab value="practise" label="Practise a word" />
        <Tab value="record" label="Record samples" />
      </Tabs>

      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 2 }}>
            <Stack spacing={2}>
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
                    Sign one of the {DEMO_WORDS.length} words below. {simulate && "The simulation signs জ্বর, বই, পানি and ধন্যবাদ."}
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    <Typography variant="display" component="p" lang="bn" role="status">
                      {best.word}
                    </Typography>
                    <Typography variant="lead">{EN.get(best.word)}</Typography>
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
                  Words: {DEMO_WORDS.map((w) => w.bn).join(" · ")}
                </Typography>
              </Stack>
            </Paper>
          )}

          {mode === "practise" && (
            <Paper sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Typography variant="h4" component="h2">
                  Practise <span lang="bn">{target}</span> ({EN.get(target)})
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
                    {best?.word === target && targetScore.score >= 0.45 ? (
                      <Alert severity="success">
                        Well done! That is <span lang="bn">{target}</span>.
                      </Alert>
                    ) : (
                      <Alert severity="info">
                        {best && best.word !== target && (
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
