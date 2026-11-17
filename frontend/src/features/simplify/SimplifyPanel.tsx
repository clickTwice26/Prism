"use client";

import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Image01Icon, MagicWand01Icon, Quiz02Icon, VolumeHighIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { VerificationNote } from "@/components/VerificationNote";
import { ReadableText } from "@/components/ReadableText";
import { useAnnounce } from "@/components/Announcer";
import { illustrate, listLessons, logUsage, makeQuiz, simplify, type QuizQuestion, type SimplifyResult } from "@/lib/api";
import { useReadAloud } from "@/lib/useReadAloud";
import { useSettings } from "@/lib/settings";
import { Quiz } from "./Quiz";

export function SimplifyPanel() {
  const { settings } = useSettings();
  const announce = useAnnounce();
  const reader = useReadAloud();
  const [text, setText] = useState("");
  const [result, setResult] = useState<SimplifyResult | null>(null);
  const [picture, setPicture] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [busy, setBusy] = useState<"simplify" | "picture" | "quiz" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sideBySide, setSideBySide] = useState(false);

  useEffect(() => {
    listLessons()
      .then((ls) => setText((t) => t || ls[0]?.body || ""))
      .catch(() => undefined);
  }, []);

  const run = async () => {
    setBusy("simplify");
    setError(null);
    setResult(null);
    setPicture(null);
    setQuiz(null);
    try {
      const r = await simplify(text, settings.lang);
      setResult(r);
      announce("Simplified text ready.");
      logUsage("simplify", "simplify", { lang: settings.lang, verification: r.verification });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const drawPicture = async () => {
    if (!result) return;
    setBusy("picture");
    setError(null);
    try {
      setPicture(await illustrate(result.simplified));
      announce("Picture ready.");
      logUsage("simplify", "illustrate");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const startQuiz = async () => {
    if (!result) return;
    setBusy("quiz");
    setError(null);
    try {
      setQuiz(await makeQuiz(result.original, settings.lang, 3));
      announce("Questions ready.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Stack spacing={4}>
      <Paper sx={{ p: { xs: 2, md: 4 } }}>
        <Stack spacing={2.5}>
          <TextField
            label="Text to simplify"
            multiline
            minRows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Box>
            <Button
              variant="contained"
              size="large"
              onClick={run}
              disabled={!text.trim() || busy !== null}
              startIcon={<Icon icon={MagicWand01Icon} />}
            >
              {busy === "simplify" ? "Simplifying…" : "Simplify this"}
            </Button>
          </Box>
          {busy && <LinearProgress aria-label="Working" />}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </Paper>

      {result && (
        <Paper sx={{ p: { xs: 2, md: 4 } }}>
          <Stack spacing={3}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
              <Typography variant="h4" component="h2" sx={{ mr: 1 }}>
                Simple version
              </Typography>
              {result.grade_before !== null && result.grade_after !== null && (
                <Chip
                  size="small"
                  color="primary"
                  variant="outlined"
                  label={`Reading level: grade ${result.grade_before} → ${result.grade_after}`}
                />
              )}
            </Stack>

            {/* The fidelity gate (N2): only fact-checked text reaches the learner. */}
            <VerificationNote verification={result.verification} kind="simplify" />

            {/* Easy-read text helps most when an adult explains it alongside (Buell et al., 2019). */}
            <FormControlLabel
              control={<Switch checked={sideBySide} onChange={(e) => setSideBySide(e.target.checked)} />}
              label="Show the original next to it (for a parent or teacher)"
            />
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: sideBySide ? 6 : 12 }}>
                <ReadableText text={result.simplified} lang={settings.lang} word={reader.word} />
              </Grid>
              {sideBySide && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="overline" color="text.secondary">
                    Original
                  </Typography>
                  <Typography variant="reading">{result.original}</Typography>
                </Grid>
              )}
            </Grid>

            <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
              <Button
                variant="outlined"
                size="large"
                onClick={() => (reader.speaking ? reader.stop() : reader.speak(result.simplified, settings.lang))}
                startIcon={<Icon icon={VolumeHighIcon} />}
              >
                {reader.speaking ? "Stop reading" : "Read aloud"}
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={drawPicture}
                disabled={busy !== null}
                startIcon={<Icon icon={Image01Icon} />}
              >
                {busy === "picture" ? "Drawing…" : "Show me a picture"}
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={startQuiz}
                disabled={busy !== null}
                startIcon={<Icon icon={Quiz02Icon} />}
              >
                {busy === "quiz" ? "Writing questions…" : "Check my understanding"}
              </Button>
            </Stack>

            {picture && (
              <Box
                component="img"
                src={picture}
                alt="A simple picture of the idea in the text"
                sx={{ width: "100%", maxWidth: 420, borderRadius: 3 }}
              />
            )}
          </Stack>
        </Paper>
      )}

      {quiz && <Quiz questions={quiz} />}
    </Stack>
  );
}
