"use client";

import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { InterpreterWindow } from "@/components/InterpreterWindow";
import { ReadableText } from "@/components/ReadableText";
import { useAnnounce } from "@/components/Announcer";
import {
  LANGUAGES,
  getLessonSigns,
  listLessons,
  logUsage,
  signMediaUrl,
  translate,
  type Lang,
  type Lesson,
  type LessonSigns,
} from "@/lib/api";
import { useSettings } from "@/lib/settings";

// A deaf learner reads a lesson in their language. Key terms with an approved
// Bangla Sign Language sign are underlined, and the lesson's recorded sign
// interpreter plays in a window they can move, resize or hide.
export function LessonView() {
  const { settings } = useSettings();
  const announce = useAnnounce();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonId, setLessonId] = useState<number | "">("");
  const [signs, setSigns] = useState<LessonSigns | null>(null);
  const [shown, setShown] = useState<{ text: string; lang: Lang } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listLessons()
      .then((ls) => {
        setLessons(ls);
        if (ls[0]) setLessonId(ls[0].id);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const lesson = lessons.find((l) => l.id === lessonId);

  // Show the lesson in the learner's language, translating when needed.
  useEffect(() => {
    if (!lesson) return;
    let live = true;
    /* eslint-disable react-hooks/set-state-in-effect -- reload for a new lesson or language */
    setError(null);
    setSigns(null);
    getLessonSigns(lesson.id)
      .then((s) => live && setSigns(s))
      .catch(() => undefined);
    if (lesson.language === settings.lang) {
      setShown({ text: lesson.body, lang: lesson.language });
    } else {
      setBusy(true);
      setShown(null);
      translate(lesson.body, settings.lang)
        .then((t) => live && setShown({ text: t, lang: settings.lang }))
        .catch((e: Error) => {
          if (!live) return;
          setShown({ text: lesson.body, lang: lesson.language });
          const name = LANGUAGES.find((l) => l.code === lesson.language)?.label ?? lesson.language;
          setError(`${e.message} Showing the lesson in ${name}.`);
        })
        .finally(() => live && setBusy(false));
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    logUsage("lesson", "open", { lesson: lesson.id, lang: settings.lang });
    return () => {
      live = false;
    };
  }, [lesson, settings.lang]);

  const pick = (id: number) => {
    setLessonId(id);
    const l = lessons.find((x) => x.id === id);
    if (l) announce(`Opened ${l.title}.`);
  };

  const signed = signs?.terms.filter((t) => t.clips.length > 0).length ?? 0;

  return (
    <Paper sx={{ p: { xs: 2, md: 4 } }}>
      <Stack spacing={3}>
        <FormControl sx={{ maxWidth: 420 }}>
          <InputLabel id="lesson-label">Lesson</InputLabel>
          <Select labelId="lesson-label" label="Lesson" value={lessonId} onChange={(e) => pick(e.target.value as number)}>
            {lessons.map((l) => (
              <MenuItem key={l.id} value={l.id}>
                {l.subject ? `${l.subject}: ` : ""}
                {l.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {signs?.interpreter && (
          <InterpreterWindow src={signMediaUrl(signs.interpreter.file)} signer={signs.interpreter.signer} />
        )}

        {busy && <LinearProgress aria-label="Translating the lesson" />}
        {error && <Alert severity="warning">{error}</Alert>}

        {shown && lesson && (
          <Stack spacing={2}>
            <Typography variant="h4" component="h2" lang={lesson.language}>
              {lesson.title}
            </Typography>
            <ReadableText text={shown.text} lang={shown.lang} />
            {signed > 0 && settings.signGlossary && (
              <Typography variant="caption" color="text.secondary">
                Tap an underlined word to see it in Bangla Sign Language. Signs are recorded by people and approved by
                deaf reviewers.
              </Typography>
            )}
            {shown.lang !== lesson.language && (
              <Typography variant="caption" color="text.secondary">
                Translated by AI from the original lesson.
              </Typography>
            )}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
