"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { Eraser01Icon, Camera01Icon, Delete02Icon, StopIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { useAnnounce } from "@/components/Announcer";
import { getLetterTemplates, logUsage } from "@/lib/api";
import { featureVector } from "@/lib/handsign/hand.ts";
import { LetterStabilizer, scoreLetters, weakestPart, type LetterScore, type LetterTemplate } from "@/lib/handsign/letters.ts";
import { isLetterModel, predict, type LetterModel } from "@/lib/handsign/model.ts";
import { makeLetter, noisy, translate } from "@/lib/handsign/synthetic.ts";
import { describeLetter, feedback } from "@/lib/handsign/describe.ts";
import { HandView, PartBars, type HandViewHandle } from "./HandView";
import { RecordPanel, type Recorder } from "./RecordPanel";
import { useHandTracker, type TrackedHands } from "./useHandTracker";

type Mode = "spell" | "practice" | "record";
const SETTINGS_KEY = "prism.fingerspell.v1";
// A learned model trained in Python from recorded samples (ml/). Optional.
const MODEL_URL = "/models/letters.json";
const SIM_WORD = ["ক", "ল", "ম"];

/** Blends template scores with a learned model's probabilities, when there is one. */
function rank(hands: TrackedHands, letters: LetterTemplate[], model: LetterModel | null): LetterScore[] {
  if (!hands.dominant || !hands.other) return [];
  const ranked = scoreLetters({ dominant: hands.dominant, other: hands.other }, letters);
  if (!model) return ranked;
  const p = predict(model, featureVector(hands.dominant, hands.other));
  return ranked
    .map((r) => ({ ...r, score: 0.5 * r.score + 0.5 * (p.get(r.letter) ?? 0) }))
    .sort((a, b) => b.score - a.score);
}

export function Fingerspell() {
  const announce = useAnnounce();
  const [mode, setMode] = useState<Mode>("spell");
  const [letters, setLetters] = useState<LetterTemplate[]>([]);
  const [model, setModel] = useState<LetterModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dominant, setDominant] = useState<"right" | "left">("right");
  const [top, setTop] = useState<LetterScore[]>([]);
  const [handsSeen, setHandsSeen] = useState(0);
  const [text, setText] = useState("");
  const [target, setTarget] = useState("ক");
  const [simulate, setSimulate] = useState(false);
  const [simLetter, setSimLetter] = useState("ক");

  const view = useRef<HandViewHandle>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stabilizer = useRef(new LetterStabilizer());
  const recorder = useRef<Recorder | null>(null);
  const frameNo = useRef(0);
  const state = useRef({ letters, model, mode });

  useEffect(() => {
    state.current = { letters, model, mode };
  }, [letters, model, mode]);

  useEffect(() => {
    getLetterTemplates()
      .then(setLetters)
      .catch((e: Error) => setError(e.message));
    fetch(MODEL_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((m: unknown) => setModel(isLetterModel(m) ? m : null))
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
    stabilizer.current.reset();
  };

  // Every frame, from the camera or the simulation.
  const onFrame = useCallback(
    (hands: TrackedHands) => {
      view.current?.draw(hands);
      recorder.current?.push(hands);
      const { letters: ls, model: m, mode: md } = state.current;
      const ranked = ls.length ? rank(hands, ls, m) : [];
      if (md === "spell") {
        const typed = stabilizer.current.push(ranked[0] ?? null);
        if (typed) {
          setText((t) => t + typed);
          announce(typed);
          logUsage("fingerspell", "letter", { letter: typed });
        }
      }
      // Update the screen at about 10 times a second.
      if (frameNo.current++ % 3 === 0) {
        setTop(ranked);
        setHandsSeen((hands.dominant ? 1 : 0) + (hands.other ? 1 : 0));
      }
    },
    [announce],
  );

  const tracker = useHandTracker(videoRef, { dominant, onFrame });
  const setRecorder = useCallback((r: Recorder | null) => {
    recorder.current = r;
  }, []);

  useEffect(() => {
    videoRef.current = view.current?.video ?? null;
  });

  // Simulation: computer-made hands for when there is no camera (and for demos).
  useEffect(() => {
    if (!simulate || letters.length === 0) return;
    tracker.stop();
    let tick = 0;
    const id = window.setInterval(() => {
      tick++;
      const { mode: md } = state.current;
      // In spell mode, sign a short word: hold each letter, then drop the hands briefly.
      const cycle = 24;
      const word = md === "spell" ? SIM_WORD : [md === "practice" ? target : simLetter];
      const slot = Math.floor(tick / cycle) % word.length;
      const resting = md === "spell" && tick % cycle >= cycle - 6;
      const t = letters.find((l) => l.bn === word[slot]);
      if (!t || resting) {
        onFrame({ dominant: null, other: null, image: [], t: performance.now() });
        return;
      }
      const pose = makeLetter(t);
      const wobble: [number, number, number] = [Math.sin(tick / 5) * 0.05, Math.cos(tick / 7) * 0.05, 0];
      const dom = noisy(translate(pose.dominant, wobble), 0.03, tick);
      const other = noisy(translate(pose.other, wobble), 0.03, tick + 500);
      // Seen slightly from above, so hands pointing at the camera are still readable.
      const toImage = (h: typeof dom) => h.map(([x, y, z]) => ({ x: 0.5 - x * 0.16, y: 0.5 - y * 0.16 - z * 0.09 }));
      onFrame({
        dominant: dom,
        other,
        image: [
          { points: toImage(dom), dominant: true },
          { points: toImage(other), dominant: false },
        ],
        t: performance.now(),
      });
    }, 66);
    return () => window.clearInterval(id);
    // tracker.stop is stable; restart only when these change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulate, letters, target, simLetter, onFrame]);

  const startCamera = () => {
    setSimulate(false);
    stabilizer.current.reset();
    void tracker.start();
    logUsage("fingerspell", "camera_start", { dominant });
  };

  const targetTemplate = letters.find((l) => l.bn === target);
  const targetScore = top.find((s) => s.letter === target);
  const best = top[0];
  const live = tracker.status === "running" || simulate;

  // Celebrate a held practice letter once.
  const [practiceDone, setPracticeDone] = useState(false);
  const goodFrames = useRef(0);
  useEffect(() => {
    if (mode !== "practice") return;
    goodFrames.current = targetScore && targetScore.score >= 0.6 && best?.letter === target ? goodFrames.current + 1 : 0;
    if (goodFrames.current === 5 && !practiceDone) {
      setPracticeDone(true);
      announce(`Well done: that is ${target}.`);
      logUsage("fingerspell", "practice_success", { letter: target });
    }
  }, [top, mode, target, targetScore, best, practiceDone, announce]);

  const letterButtons = useMemo(
    () =>
      letters.map((l) => (
        <ToggleButton key={l.id} value={l.bn} aria-label={`Letter ${l.bn}`} sx={{ minWidth: 48, typography: "h5", py: 0.5 }} lang="bn">
          {l.bn}
        </ToggleButton>
      )),
    [letters],
  );

  return (
    <Stack spacing={3}>
      <Tabs value={mode} onChange={(_, v: Mode) => setMode(v)} aria-label="Fingerspelling mode" sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tab value="spell" label="Spell" />
        <Tab value="practice" label="Practise a letter" />
        <Tab value="record" label="Record samples" />
      </Tabs>

      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 2 }}>
            <Stack spacing={2}>
              <HandView ref={view} label="Your hands, mirrored" simulated={simulate} />
              <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                {tracker.status === "running" ? (
                  <Button variant="outlined" color="error" onClick={tracker.stop} startIcon={<Icon icon={StopIcon} />}>
                    Stop camera
                  </Button>
                ) : (
                  <Button variant="contained" onClick={startCamera} disabled={tracker.status === "loading" || !letters.length} startIcon={<Icon icon={Camera01Icon} />}>
                    {tracker.status === "loading" ? "Loading hand tracking…" : "Start camera"}
                  </Button>
                )}
                <FormControlLabel
                  control={<Switch checked={simulate} onChange={(e) => setSimulate(e.target.checked)} disabled={!letters.length} />}
                  label="Simulate (no camera)"
                />
                <Box sx={{ flex: 1 }} />
                <Typography id="dominant-label" variant="body2">
                  Signing hand
                </Typography>
                <ToggleButtonGroup size="small" exclusive value={dominant} onChange={(_, v) => v && chooseDominant(v)} aria-labelledby="dominant-label">
                  <ToggleButton value="right">Right</ToggleButton>
                  <ToggleButton value="left">Left</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              {tracker.error && <Alert severity="warning">{tracker.error}</Alert>}
              {live && (
                <Typography variant="body2" color="text.secondary" role="status">
                  {handsSeen === 2 ? "Both hands seen." : handsSeen === 1 ? "One hand seen. Show both hands." : "No hands seen yet."}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                Only the positions of your hand joints are used. Video stays on this device.
                {model ? ` A learned model trained on ${model.trained_on?.samples ?? "recorded"} samples is helping.` : ""}
              </Typography>
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          {mode === "spell" && (
            <Paper sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Typography variant="h4" component="h2">
                  Your word
                </Typography>
                <Box
                  role="status"
                  aria-live="polite"
                  aria-label="Spelled text"
                  lang="bn"
                  sx={{ typography: "liveCaption", minHeight: 64, p: 2, borderRadius: 2, bgcolor: "background.default", wordBreak: "break-all" }}
                >
                  {text || <Typography color="text.secondary">Hold each letter steady to type it.</Typography>}
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button onClick={() => setText((t) => t + " ")}>Space</Button>
                  <Button onClick={() => setText((t) => [...t].slice(0, -1).join(""))} startIcon={<Icon icon={Eraser01Icon} size={18} />}>
                    Delete
                  </Button>
                  <Button color="error" onClick={() => setText("")} startIcon={<Icon icon={Delete02Icon} size={18} />}>
                    Clear
                  </Button>
                </Stack>
                {simulate && (
                  <Typography variant="caption" color="text.secondary">
                    The simulation signs ক, ল, ম in turn.
                  </Typography>
                )}
                <Typography variant="h5" component="h3">
                  Best guesses
                </Typography>
                {top.length === 0 ? (
                  <Typography color="text.secondary">Show both hands to start.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {top.slice(0, 3).map((s) => (
                      <Stack key={s.letter} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                        <Typography variant="h4" component="span" lang="bn" sx={{ width: 40 }}>
                          {s.letter}
                        </Typography>
                        <LinearProgress variant="determinate" value={s.score * 100} sx={{ flex: 1, height: 8, borderRadius: 4 }} aria-label={`${s.letter}: ${Math.round(s.score * 100)}%`} />
                        <Typography variant="body2" sx={{ width: 40, fontVariantNumeric: "tabular-nums" }}>
                          {Math.round(s.score * 100)}%
                        </Typography>
                      </Stack>
                    ))}
                    <Typography variant="body2" color="text.secondary">
                      Why <span lang="bn">{best.letter}</span>:
                    </Typography>
                    <PartBars score={best} />
                  </Stack>
                )}
              </Stack>
            </Paper>
          )}

          {mode === "practice" && (
            <Paper sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Typography variant="h4" component="h2">
                  Practise <span lang="bn">{target}</span>
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={target}
                  onChange={(_, v) => {
                    if (v) {
                      setTarget(v);
                      setPracticeDone(false);
                    }
                  }}
                  aria-label="Letter to practise"
                  sx={{ flexWrap: "wrap" }}
                >
                  {letterButtons}
                </ToggleButtonGroup>
                {targetTemplate && (
                  <Box component="dl" sx={{ m: 0 }}>
                    {describeLetter(targetTemplate).map((d) => (
                      <Box key={d.label} sx={{ mb: 1 }}>
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
                  From the IsharaKotha sign descriptions. Check with a deaf signer or the Bangla sign alphabet chart.
                </Typography>
                {targetScore && targetTemplate ? (
                  <Stack spacing={1.5}>
                    <PartBars score={targetScore} />
                    {practiceDone ? (
                      <Alert severity="success">Well done! That is <span lang="bn">{target}</span>.</Alert>
                    ) : (
                      <Alert severity="info">{feedback(targetTemplate, weakestPart(targetScore))}</Alert>
                    )}
                  </Stack>
                ) : (
                  <Typography color="text.secondary">{live ? "Show both hands." : "Start the camera or the simulation."}</Typography>
                )}
              </Stack>
            </Paper>
          )}

          {mode === "record" && (
            <RecordPanel
              letters={letters}
              dominant={dominant}
              live={live && !simulate}
              letterButtons={letterButtons}
              simLetter={simLetter}
              onSimLetter={setSimLetter}
              setRecorder={setRecorder}
            />
          )}
        </Grid>
      </Grid>
    </Stack>
  );
}
