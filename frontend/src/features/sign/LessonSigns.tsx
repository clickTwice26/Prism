"use client";

import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Add01Icon, AiMagicIcon, Delete02Icon, RecordIcon, Video02Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { useAnnounce } from "@/components/Announcer";
import { SignClipPlayer, SignCredit } from "@/components/SignClip";
import {
  LANGUAGES,
  addLessonTerm,
  extractLessonTerms,
  getLessonSigns,
  listLessons,
  removeLessonTerm,
  signMediaUrl,
  termLabel,
  type Lang,
  type Lesson,
  type LessonSigns as LessonSignsData,
  type SignTerm,
} from "@/lib/api";
import { SIGNS_CHANGED, signsChanged } from "@/lib/signs";
import { useSettings } from "@/lib/settings";
import { SignRecorder, type RecordTarget } from "./SignRecorder";
import { ReferenceNote } from "./ReferenceNote";

const EMPTY_LABELS: Record<Lang, string> = { en: "", bn: "", ms: "" };

// A teacher picks a lesson; Prism lists its key terms (AI or by hand) and shows
// which have an approved sign. Terms without one go to signers.
export function LessonSigns() {
  const { settings } = useSettings();
  const announce = useAnnounce();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonId, setLessonId] = useState<number | "">("");
  const [data, setData] = useState<LessonSignsData | null>(null);
  const [labels, setLabels] = useState(EMPTY_LABELS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<RecordTarget | null>(null);

  useEffect(() => {
    listLessons()
      .then((ls) => {
        setLessons(ls);
        if (ls[0]) setLessonId(ls[0].id);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const load = useCallback(() => {
    if (lessonId === "") return;
    getLessonSigns(lessonId)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [lessonId]);

  useEffect(() => {
    load();
    window.addEventListener(SIGNS_CHANGED, load);
    return () => window.removeEventListener(SIGNS_CHANGED, load);
  }, [load]);

  const lesson = lessons.find((l) => l.id === lessonId);

  const run = async (fn: () => Promise<LessonSignsData>, done: string) => {
    setBusy(true);
    setError(null);
    try {
      setData(await fn());
      announce(done);
      signsChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const extract = () => lessonId !== "" && run(() => extractLessonTerms(lessonId), "Key terms found.");
  const add = async () => {
    if (lessonId === "") return;
    await run(() => addLessonTerm(lessonId, labels), "Term added.");
    setLabels(EMPTY_LABELS);
  };
  const remove = async (t: SignTerm) => {
    if (lessonId === "") return;
    try {
      await removeLessonTerm(lessonId, t.id);
      announce(`Removed ${termLabel(t, settings.lang)} from this lesson.`);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const total = data?.terms.length ?? 0;
  const coverage = total ? Math.round(((data?.signed ?? 0) / total) * 100) : 0;

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2, md: 4 } }}>
        <Stack spacing={3}>
          <FormControl sx={{ maxWidth: 420 }}>
            <InputLabel id="sign-lesson-label">Lesson</InputLabel>
            <Select
              labelId="sign-lesson-label"
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

          {data && (
            <Stack spacing={1}>
              <Typography variant="h4" component="h2">
                {data.signed} of {total} key terms have an approved sign
              </Typography>
              <LinearProgress
                variant="determinate"
                value={coverage}
                aria-label="Key terms with an approved sign"
                color={coverage >= 90 ? "success" : "primary"}
                sx={{ height: 10, borderRadius: 5 }}
              />
              <Typography variant="caption" color="text.secondary">
                Pilot target: 90% of each lesson&apos;s key terms.
              </Typography>
            </Stack>
          )}

          <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
            <Button
              variant="contained"
              onClick={extract}
              disabled={busy || lessonId === "" || !data?.ai}
              startIcon={<Icon icon={AiMagicIcon} />}
            >
              {busy ? "Working…" : "Find key terms with AI"}
            </Button>
            {data && !data.ai && (
              <Typography variant="body2" color="text.secondary">
                AI is off on this server. Add the terms by hand below.
              </Typography>
            )}
          </Stack>

          <Box component="form" onSubmit={(e) => (e.preventDefault(), void add())}>
            <Typography variant="h5" component="h3" gutterBottom>
              Add a key term
            </Typography>
            <Grid container spacing={2} sx={{ alignItems: "flex-start" }}>
              {LANGUAGES.map((l) => (
                <Grid key={l.code} size={{ xs: 12, sm: 4, md: 3 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label={l.label}
                    value={labels[l.code]}
                    onChange={(e) => setLabels({ ...labels, [l.code]: e.target.value })}
                    slotProps={{ htmlInput: { lang: l.code } }}
                  />
                </Grid>
              ))}
              <Grid size={{ xs: 12, md: 3 }}>
                <Button
                  type="submit"
                  variant="outlined"
                  disabled={busy || !Object.values(labels).some((v) => v.trim())}
                  startIcon={<Icon icon={Add01Icon} />}
                >
                  Add term
                </Button>
              </Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              Write it in each language the lesson is read in, so the sign is found in every version.
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </Paper>

      {data && total === 0 && (
        <Alert severity="info">This lesson has no key terms yet. Find them with AI or add them by hand.</Alert>
      )}

      {data && total > 0 && (
        <Stack spacing={2} component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
          {data.terms.map((t) => (
            <Paper component="li" key={t.id} sx={{ p: { xs: 2, md: 3 } }}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: t.clips.length ? 7 : 12 }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                      <Typography variant="h4" component="h3" sx={{ mr: 1 }}>
                        {termLabel(t, settings.lang)}
                      </Typography>
                      {t.clips.length > 0 ? (
                        <Chip size="small" color="success" label={t.clips.length > 1 ? `${t.clips.length} approved signs` : "Approved sign"} />
                      ) : t.pending > 0 ? (
                        <Chip size="small" color="warning" label="Waiting for deaf review" />
                      ) : (
                        <Chip size="small" variant="outlined" label="No sign yet" />
                      )}
                      {t.source === "ai" && <Chip size="small" variant="outlined" label="Found by AI" />}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {LANGUAGES.filter((l) => t.labels[l.code])
                        .map((l) => `${l.label}: ${t.labels[l.code]}`)
                        .join(" · ")}
                    </Typography>
                    {!t.clips.length && <ReferenceNote entries={data.reference[String(t.id)] ?? []} />}
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant={t.clips.length ? "outlined" : "contained"}
                        size="small"
                        onClick={() => setRecording({ kind: "term", id: t.id, label: termLabel(t, settings.lang) })}
                        startIcon={<Icon icon={RecordIcon} size={18} />}
                      >
                        {t.clips.length ? "Add a regional variant" : "Record the sign"}
                      </Button>
                      <Tooltip title="Remove from this lesson">
                        <IconButton size="small" onClick={() => remove(t)} aria-label={`Remove ${termLabel(t, settings.lang)} from this lesson`}>
                          <Icon icon={Delete02Icon} size={18} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Grid>
                {t.clips[0] && (
                  <Grid size={{ xs: 12, md: 5 }}>
                    <SignClipPlayer clip={t.clips[0]} label={termLabel(t, settings.lang)} maxWidth={260} />
                    <SignCredit clip={t.clips[0]} />
                  </Grid>
                )}
              </Grid>
            </Paper>
          ))}
        </Stack>
      )}

      {data && lesson && (
        <Paper sx={{ p: { xs: 2, md: 4 } }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Icon icon={Video02Icon} />
              <Typography variant="h4" component="h2">
                Interpreter video
              </Typography>
            </Stack>
            <Typography color="text.secondary">
              An interpreter signs the whole lesson once. Learners see it in a small window they can move, resize or hide.
              Best for step-by-step content such as experiments.
            </Typography>
            <Divider />
            {data.interpreter ? (
              <Stack spacing={1} sx={{ maxWidth: 420 }}>
                <Box
                  component="video"
                  src={signMediaUrl(data.interpreter.file)}
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  aria-label="Approved interpreter video"
                  sx={{ width: "100%", borderRadius: 2, bgcolor: "common.black" }}
                />
                <SignCredit clip={data.interpreter} />
              </Stack>
            ) : (
              <Typography>No approved interpreter video for this lesson yet.</Typography>
            )}
            {data.pending_interpreter.length > 0 && (
              <Alert severity="warning">
                {data.pending_interpreter.length} interpreter {data.pending_interpreter.length === 1 ? "video waits" : "videos wait"} for
                deaf review.
              </Alert>
            )}
            <Box>
              <Button
                variant="outlined"
                onClick={() => setRecording({ kind: "lesson", id: lesson.id, label: lesson.title })}
                startIcon={<Icon icon={RecordIcon} />}
              >
                Record or upload an interpreter video
              </Button>
            </Box>
          </Stack>
        </Paper>
      )}

      <SignRecorder target={recording} onClose={() => setRecording(null)} />
    </Stack>
  );
}
