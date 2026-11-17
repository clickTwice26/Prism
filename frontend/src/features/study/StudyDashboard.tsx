"use client";

import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useAnnounce } from "@/components/Announcer";
import {
  addParticipant,
  addResult,
  getStudySummary,
  listParticipants,
  type ConditionSummary,
  type Participant,
  type StudySummary,
} from "@/lib/api";

const PROFILES = ["Blind", "Low vision", "Deaf", "Hard of hearing", "Dyslexia", "Autism", "Intellectual disability", "ADHD", "No disability"];
const FEATURES = ["read", "image", "simplify", "live"];

const num = (s: string) => (s.trim() === "" ? null : Number(s));

// Records the same task with and without Prism for each participant, so the
// effect is measured by comprehension (Säuberli et al., 2024), not opinion.
export function StudyDashboard() {
  const announce = useAnnounce();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [summary, setSummary] = useState<StudySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [p, setP] = useState({ code: "", profile: PROFILES[0], notes: "" });
  const [r, setR] = useState({
    participant_id: 0,
    feature: "simplify",
    condition: "with_tool" as "with_tool" | "without_tool",
    comprehension_score: "",
    time_seconds: "",
    sus_score: "",
    satisfaction: "",
    task_completed: true,
  });

  const refresh = useCallback(async () => {
    try {
      const [ps, s] = await Promise.all([listParticipants(), getStudySummary()]);
      setParticipants(ps);
      setSummary(s);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
  useEffect(() => void refresh(), [refresh]);

  const saveParticipant = async () => {
    setError(null);
    try {
      const created = await addParticipant(p);
      setP({ ...p, code: "", notes: "" });
      setR((x) => ({ ...x, participant_id: created.id }));
      announce(`Added ${created.code}.`);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const saveResult = async () => {
    setError(null);
    try {
      await addResult({
        participant_id: r.participant_id,
        feature: r.feature,
        condition: r.condition,
        comprehension_score: num(r.comprehension_score),
        time_seconds: num(r.time_seconds),
        sus_score: num(r.sus_score),
        satisfaction: num(r.satisfaction),
        task_completed: r.task_completed,
      });
      setR({ ...r, comprehension_score: "", time_seconds: "", sus_score: "", satisfaction: "" });
      announce("Result saved.");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const rows: { label: string; key: keyof ConditionSummary; fmt?: (v: number) => string }[] = [
    { label: "Results", key: "results" },
    { label: "Comprehension (%)", key: "avg_comprehension" },
    { label: "Task completed", key: "task_completion_rate", fmt: (v) => `${Math.round(v * 100)}%` },
    { label: "Time (s)", key: "avg_time_seconds" },
    { label: "Usability, SUS (0–100)", key: "avg_sus_score" },
    { label: "Satisfaction (1–5)", key: "avg_satisfaction" },
  ];
  const cell = (c: ConditionSummary | undefined, key: keyof ConditionSummary, fmt?: (v: number) => string) => {
    const v = c?.[key];
    return v === null || v === undefined ? "–" : fmt ? fmt(v) : String(v);
  };

  return (
    <Stack spacing={4}>
      {error && <Alert severity="error">{error}</Alert>}

      <Paper sx={{ p: { xs: 2, md: 4 } }}>
        <Typography variant="h5" component="h2" gutterBottom>
          With Prism vs without ({summary?.participants ?? 0} participants)
        </Typography>
        <TableContainer>
          <Table aria-label="Study summary">
            <TableHead>
              <TableRow>
                <TableCell>Measure</TableCell>
                <TableCell align="right">Without Prism</TableCell>
                <TableCell align="right">With Prism</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell component="th" scope="row">
                    {row.label}
                  </TableCell>
                  <TableCell align="right">{cell(summary?.by_condition.without_tool, row.key, row.fmt)}</TableCell>
                  <TableCell align="right">{cell(summary?.by_condition.with_tool, row.key, row.fmt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h6" component="h2">
                Add a participant
              </Typography>
              <TextField label="Code (no names)" placeholder="P01" value={p.code} onChange={(e) => setP({ ...p, code: e.target.value })} />
              <FormControl>
                <InputLabel id="profile-label">Profile</InputLabel>
                <Select labelId="profile-label" label="Profile" value={p.profile} onChange={(e) => setP({ ...p, profile: e.target.value })}>
                  {PROFILES.map((x) => (
                    <MenuItem key={x} value={x}>
                      {x}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField label="Notes" multiline minRows={2} value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} />
              <Button variant="contained" onClick={saveParticipant} disabled={!p.code.trim()}>
                Add participant
              </Button>
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h6" component="h2">
                Record a result
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel id="pid-label">Participant</InputLabel>
                    <Select
                      labelId="pid-label"
                      label="Participant"
                      value={r.participant_id || ""}
                      onChange={(e) => setR({ ...r, participant_id: Number(e.target.value) })}
                    >
                      {participants.map((x) => (
                        <MenuItem key={x.id} value={x.id}>
                          {x.code} · {x.profile}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <FormControl fullWidth>
                    <InputLabel id="feat-label">Feature</InputLabel>
                    <Select labelId="feat-label" label="Feature" value={r.feature} onChange={(e) => setR({ ...r, feature: e.target.value })}>
                      {FEATURES.map((f) => (
                        <MenuItem key={f} value={f}>
                          {f}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <FormControl fullWidth>
                    <InputLabel id="cond-label">Condition</InputLabel>
                    <Select
                      labelId="cond-label"
                      label="Condition"
                      value={r.condition}
                      onChange={(e) => setR({ ...r, condition: e.target.value as typeof r.condition })}
                    >
                      <MenuItem value="without_tool">Without Prism</MenuItem>
                      <MenuItem value="with_tool">With Prism</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                {(
                  [
                    ["comprehension_score", "Comprehension %", 0, 100],
                    ["time_seconds", "Time (seconds)", 0, 36000],
                    ["sus_score", "SUS score", 0, 100],
                    ["satisfaction", "Satisfaction 1–5", 1, 5],
                  ] as const
                ).map(([key, label, min, max]) => (
                  <Grid key={key} size={{ xs: 6, sm: 3 }}>
                    <TextField
                      fullWidth
                      type="number"
                      label={label}
                      value={r[key]}
                      onChange={(e) => setR({ ...r, [key]: e.target.value })}
                      slotProps={{ htmlInput: { min, max } }}
                    />
                  </Grid>
                ))}
              </Grid>
              <FormControlLabel
                control={<Switch checked={r.task_completed} onChange={(e) => setR({ ...r, task_completed: e.target.checked })} />}
                label="Task completed"
              />
              <Button variant="contained" onClick={saveResult} disabled={!r.participant_id}>
                Save result
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}
