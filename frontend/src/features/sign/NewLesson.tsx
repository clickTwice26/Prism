"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { LANGUAGES, addLesson, type Lang, type Lesson } from "@/lib/api";

const EMPTY = { subject: "", title: "", body: "", language: "en" as Lang };

// A teacher adds the lesson their class is learning, so its key terms can be
// found and signed.
export function NewLesson({ onCreated }: { onCreated: (l: Lesson) => void }) {
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!form)
    return (
      <Box>
        <Button onClick={() => setForm(EMPTY)} startIcon={<Icon icon={Add01Icon} size={20} />}>
          Add a lesson
        </Button>
      </Box>
    );

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const l = await addLesson({ ...form, title: form.title.trim(), subject: form.subject.trim() });
      setForm(null);
      onCreated(l);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5, bgcolor: "background.default" }}>
      <Stack spacing={2} component="form" onSubmit={(e) => (e.preventDefault(), void save())}>
        <Typography variant="h5" component="h3">
          New lesson
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField fullWidth label="Subject" placeholder="Biology" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 12, sm: 5 }}>
            <TextField fullWidth required label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth>
              <InputLabel id="new-lesson-lang">Language</InputLabel>
              <Select
                labelId="new-lesson-lang"
                label="Language"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value as Lang })}
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
        <TextField
          label="Lesson text"
          required
          multiline
          minRows={5}
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          slotProps={{ htmlInput: { lang: form.language } }}
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Stack direction="row" spacing={1.5}>
          <Button type="submit" variant="contained" disabled={busy || !form.title.trim() || !form.body.trim()}>
            {busy ? "Saving…" : "Add lesson"}
          </Button>
          <Button onClick={() => setForm(null)} disabled={busy}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
