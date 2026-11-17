"use client";

import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { LanguageSkillIcon, PauseIcon, PlayIcon, StopIcon, VolumeHighIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { ReadableText } from "@/components/ReadableText";
import { useAnnounce } from "@/components/Announcer";
import { listLessons, logUsage, translate, type Lesson } from "@/lib/api";
import { useReadAloud } from "@/lib/useReadAloud";
import { useSettings } from "@/lib/settings";

export function LessonReader() {
  const { settings } = useSettings();
  const announce = useAnnounce();
  const reader = useReadAloud();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonId, setLessonId] = useState<number | "custom">("custom");
  const [text, setText] = useState("");
  const [shown, setShown] = useState<{ text: string; lang: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listLessons()
      .then((ls) => {
        setLessons(ls);
        if (ls[0]) {
          setLessonId(ls[0].id);
          setText(ls[0].body);
        }
      })
      .catch(() => undefined);
  }, []);

  const pickLesson = (id: number | "custom") => {
    reader.stop();
    setShown(null);
    setLessonId(id);
    setText(id === "custom" ? "" : (lessons.find((l) => l.id === id)?.body ?? ""));
  };

  // Show the text in the learner's language, translating when needed.
  const readAloud = async () => {
    setError(null);
    const lesson = lessons.find((l) => l.id === lessonId);
    const sourceLang = lesson?.language ?? "en";
    let out = text;
    if (sourceLang !== settings.lang) {
      setBusy(true);
      try {
        out = await translate(text, settings.lang);
      } catch (e) {
        setError(`${(e as Error).message} Reading the original text instead.`);
      } finally {
        setBusy(false);
      }
    }
    setShown({ text: out, lang: settings.lang });
    announce("Reading aloud.");
    logUsage("read", "read_aloud", { lang: settings.lang });
    void reader.speak(out, settings.lang);
  };

  return (
    <Paper sx={{ p: { xs: 2, md: 4 } }}>
      <Stack spacing={3}>
        <Typography variant="h4" component="h2">
          Read the lesson aloud
        </Typography>
        <FormControl sx={{ maxWidth: 360 }}>
          <InputLabel id="lesson-label">Lesson</InputLabel>
          <Select
            labelId="lesson-label"
            label="Lesson"
            value={lessonId}
            onChange={(e) => pickLesson(e.target.value as number | "custom")}
          >
            {lessons.map((l) => (
              <MenuItem key={l.id} value={l.id}>
                {l.subject ? `${l.subject}: ` : ""}
                {l.title}
              </MenuItem>
            ))}
            <MenuItem value="custom">Paste my own text</MenuItem>
          </Select>
        </FormControl>

        <TextField
          label="Lesson text"
          multiline
          minRows={4}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setShown(null);
          }}
        />

        <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Button
            variant="contained"
            size="large"
            onClick={readAloud}
            disabled={!text.trim() || busy}
            startIcon={<Icon icon={settings.lang === "en" ? VolumeHighIcon : LanguageSkillIcon} />}
          >
            {busy ? "Translating…" : "Read aloud"}
          </Button>
          {reader.speaking && (
            <>
              <Button
                size="large"
                variant="outlined"
                onClick={reader.togglePause}
                startIcon={<Icon icon={reader.paused ? PlayIcon : PauseIcon} />}
              >
                {reader.paused ? "Resume" : "Pause"}
              </Button>
              <Button size="large" variant="outlined" onClick={reader.stop} startIcon={<Icon icon={StopIcon} />}>
                Stop
              </Button>
            </>
          )}
        </Stack>

        {error && <Alert severity="warning">{error}</Alert>}

        {shown && (
          <Paper variant="outlined" sx={{ p: 3, bgcolor: "background.default" }} aria-label="Text being read">
            <ReadableText text={shown.text} lang={shown.lang} word={reader.word} />
          </Paper>
        )}
      </Stack>
    </Paper>
  );
}
