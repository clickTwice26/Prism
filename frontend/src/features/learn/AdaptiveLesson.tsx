"use client";

import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  ArrowRight01Icon,
  Image01Icon,
  PlayIcon,
  StopIcon,
  TextIcon,
  UserAdd01Icon,
  VolumeHighIcon,
} from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { ReadableText } from "@/components/ReadableText";
import { VerificationNote } from "@/components/VerificationNote";
import { useAnnounce } from "@/components/Announcer";
import {
  LANGUAGES,
  PROFILES,
  addLearner,
  answerChunk,
  illustrate,
  listLearners,
  listLessons,
  logUsage,
  nextChunk,
  profileLabel,
  type AnswerResult,
  type ChunkView,
  type Lang,
  type Learner,
  type Lesson,
} from "@/lib/api";
import { useReadAloud } from "@/lib/useReadAloud";
import { LearnerInsights } from "./LearnerInsights";

type Phase = "setup" | "chunk" | "done";

// One lesson, one short part at a time. Each part ends with a question, and
// the answer decides which supports the learner gets next (N1).
export function AdaptiveLesson() {
  const announce = useAnnounce();
  const reader = useReadAloud();
  const [learners, setLearners] = useState<Learner[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [learnerId, setLearnerId] = useState<number | "">("");
  const [lessonId, setLessonId] = useState<number | "">("");
  const [newLearner, setNewLearner] = useState<{ code: string; profile: string; lang: Lang } | null>(null);

  const [phase, setPhase] = useState<Phase>("setup");
  const [view, setView] = useState<ChunkView | null>(null);
  const [picture, setPicture] = useState<string | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listLearners(), listLessons()])
      .then(([ls, lessonsList]) => {
        setLearners(ls);
        setLessons(lessonsList);
        if (lessonsList[0]) setLessonId(lessonsList[0].id);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const learner = learners.find((l) => l.id === learnerId);

  const saveLearner = async () => {
    if (!newLearner) return;
    setError(null);
    try {
      const created = await addLearner(newLearner);
      setLearners((ls) => [...ls, created].sort((a, b) => a.code.localeCompare(b.code)));
      setLearnerId(created.id);
      setNewLearner(null);
      announce(`Added ${created.code}.`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const load = useCallback(
    async (chunk: number) => {
      if (learnerId === "" || lessonId === "") return;
      reader.stop();
      setBusy(true);
      setError(null);
      setChoice(null);
      setResult(null);
      setPicture(null);
      try {
        const v = await nextChunk(learnerId, lessonId, chunk);
        setView(v);
        setPhase("chunk");
        announce(`Part ${v.chunk + 1} of ${v.total_chunks}.`);
        if (v.mix.audio) void reader.speak(v.text, v.lang);
        if (v.mix.picture) {
          illustrate(v.text)
            .then(setPicture)
            .catch(() => setPicture(null));
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [learnerId, lessonId, reader, announce],
  );

  const start = () => {
    setScore({ correct: 0, total: 0 });
    logUsage("learn", "start", { profile: learner?.profile });
    void load(0);
  };

  const check = async () => {
    if (!view || choice === null) return;
    setBusy(true);
    try {
      const r = await answerChunk(view.attempt_id, choice);
      setResult(r);
      setScore((s) => ({ correct: s.correct + (r.correct ? 1 : 0), total: s.total + 1 }));
      announce(r.correct ? "Correct!" : `Good try. The answer is: ${r.answer_text}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (!view || !result) return;
    if (result.done) {
      reader.stop();
      setPhase("done");
      announce("Lesson finished.");
      logUsage("learn", "finish", { correct: score.correct, total: score.total });
    } else void load(view.chunk + 1);
  };

  // ---- setup ----
  if (phase === "setup") {
    return (
      <Paper sx={{ p: { xs: 2, md: 4 } }}>
        <Stack spacing={3}>
          <Typography variant="h4" component="h2">
            Who is learning?
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel id="learner-label">Learner</InputLabel>
                <Select
                  labelId="learner-label"
                  label="Learner"
                  value={learnerId}
                  onChange={(e) => setLearnerId(e.target.value as number)}
                >
                  {learners.map((l) => (
                    <MenuItem key={l.id} value={l.id}>
                      {l.code} · {profileLabel(l.profile)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel id="lesson-pick-label">Lesson</InputLabel>
                <Select
                  labelId="lesson-pick-label"
                  label="Lesson"
                  value={lessonId}
                  onChange={(e) => setLessonId(e.target.value as number)}
                >
                  {lessons.map((l) => (
                    <MenuItem key={l.id} value={l.id}>
                      {l.subject ? `${l.subject}: ` : ""}
                      {l.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {newLearner ? (
            <Paper variant="outlined" sx={{ p: 2.5, bgcolor: "background.default" }}>
              <Stack spacing={2}>
                <Typography variant="h5" component="h3">
                  New learner
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      label="Code (no real names)"
                      placeholder="L01"
                      value={newLearner.code}
                      onChange={(e) => setNewLearner({ ...newLearner, code: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControl fullWidth>
                      <InputLabel id="profile-start-label">Starting profile</InputLabel>
                      <Select
                        labelId="profile-start-label"
                        label="Starting profile"
                        value={newLearner.profile}
                        onChange={(e) => setNewLearner({ ...newLearner, profile: e.target.value })}
                      >
                        {PROFILES.map((p) => (
                          <MenuItem key={p.value} value={p.value}>
                            {p.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControl fullWidth>
                      <InputLabel id="learner-lang-label">Language</InputLabel>
                      <Select
                        labelId="learner-lang-label"
                        label="Language"
                        value={newLearner.lang}
                        onChange={(e) => setNewLearner({ ...newLearner, lang: e.target.value as Lang })}
                      >
                        {LANGUAGES.map((l) => (
                          <MenuItem key={l.code} value={l.code}>
                            {l.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
                <Typography variant="body2" color="text.secondary">
                  The profile only sets where Prism starts. After each question it keeps the supports that help this
                  learner most.
                </Typography>
                <Stack direction="row" spacing={1.5}>
                  <Button variant="contained" onClick={saveLearner} disabled={!newLearner.code.trim()}>
                    Add learner
                  </Button>
                  <Button onClick={() => setNewLearner(null)}>Cancel</Button>
                </Stack>
              </Stack>
            </Paper>
          ) : (
            <Box>
              <Button
                startIcon={<Icon icon={UserAdd01Icon} size={20} />}
                onClick={() => setNewLearner({ code: "", profile: "dyslexia", lang: "en" })}
              >
                Add a learner
              </Button>
            </Box>
          )}

          {error && <Alert severity="error">{error}</Alert>}
          {busy && <LinearProgress aria-label="Preparing the lesson" />}
          <Box>
            <Button
              variant="contained"
              size="large"
              onClick={start}
              disabled={learnerId === "" || lessonId === "" || busy}
              endIcon={<Icon icon={ArrowRight01Icon} />}
            >
              {busy ? "Preparing the lesson…" : "Start lesson"}
            </Button>
          </Box>
        </Stack>
      </Paper>
    );
  }

  // ---- finished ----
  if (phase === "done") {
    return (
      <Stack spacing={3}>
        <Paper sx={{ p: { xs: 2, md: 4 } }}>
          <Stack spacing={2}>
            <Typography variant="h4" component="h2">
              Well done!
            </Typography>
            <Typography variant="lead">
              You understood {score.correct} of {score.total} parts.
            </Typography>
            <Box>
              <Button variant="outlined" onClick={() => setPhase("setup")}>
                Choose another lesson
              </Button>
            </Box>
          </Stack>
        </Paper>
        {learnerId !== "" && (
          <Paper sx={{ p: { xs: 2, md: 4 } }}>
            <Typography variant="h4" component="h2" gutterBottom>
              What works for this learner
            </Typography>
            <LearnerInsights learnerId={learnerId} refreshKey={score.total} />
          </Paper>
        )}
      </Stack>
    );
  }

  // ---- one chunk ----
  if (!view) return null;
  const progress = ((view.chunk + (result ? 1 : 0)) / view.total_chunks) * 100;

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2, md: 4 } }}>
        <Stack spacing={2.5}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <Typography variant="h4" component="h2">
              Part {view.chunk + 1} of {view.total_chunks}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {learner?.code}
            </Typography>
          </Stack>
          <LinearProgress variant="determinate" value={progress} aria-label="Lesson progress" />

          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }} aria-label="Supports for this part">
            <Chip icon={<Icon icon={TextIcon} size={16} />} label={view.mix.simple ? "Simple text" : "Original text"} />
            {view.mix.audio && <Chip icon={<Icon icon={VolumeHighIcon} size={16} />} label="Read aloud" />}
            {view.mix.picture && <Chip icon={<Icon icon={Image01Icon} size={16} />} label="Picture" />}
            <Typography variant="caption" color="text.secondary">
              Prism chose this: {view.reason}
            </Typography>
          </Stack>

          {view.mix.simple && <VerificationNote verification={view.verification} kind="simplify" />}

          <ReadableText text={view.text} lang={view.lang} word={reader.word} />

          {view.mix.audio && (
            <Box>
              <Button
                variant="outlined"
                onClick={() => (reader.speaking ? reader.stop() : reader.speak(view.text, view.lang))}
                startIcon={<Icon icon={reader.speaking ? StopIcon : PlayIcon} />}
              >
                {reader.speaking ? "Stop reading" : "Read aloud again"}
              </Button>
            </Box>
          )}

          {view.mix.picture &&
            (picture ? (
              <Box
                component="img"
                src={picture}
                alt="A simple picture of this part of the lesson"
                sx={{ width: "100%", maxWidth: 360, borderRadius: 3 }}
              />
            ) : (
              <Typography variant="caption" color="text.secondary">
                Drawing a picture…
              </Typography>
            ))}
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 4 } }}>
        <Stack spacing={2}>
          <FormControl>
            <FormLabel id="chunk-q" sx={{ typography: "h5", color: "text.primary", mb: 1 }}>
              {view.question.question}
            </FormLabel>
            <RadioGroup aria-labelledby="chunk-q" value={choice ?? ""} onChange={(_, v) => setChoice(Number(v))}>
              {view.question.options.map((o, i) => (
                <FormControlLabel key={o} value={i} control={<Radio />} label={o} disabled={!!result} />
              ))}
            </RadioGroup>
          </FormControl>
          {result && (
            <Alert severity={result.correct ? "success" : "info"}>
              {result.correct ? "Correct!" : `Good try. The answer is: ${result.answer_text}`}
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          <Box>
            {result ? (
              <Button variant="contained" size="large" onClick={next} disabled={busy} endIcon={<Icon icon={ArrowRight01Icon} />}>
                {result.done ? "Finish" : busy ? "Loading…" : "Next part"}
              </Button>
            ) : (
              <Button variant="contained" size="large" onClick={check} disabled={choice === null || busy}>
                Check my answer
              </Button>
            )}
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}
