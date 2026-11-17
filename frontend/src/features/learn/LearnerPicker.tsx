"use client";

import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import { listLearners, profileLabel, type Learner } from "@/lib/api";
import { LearnerInsights } from "./LearnerInsights";

// Pick a learner to see which support mix their own answers favour (N1).
export function LearnerPicker() {
  const [learners, setLearners] = useState<Learner[] | null>(null);
  const [id, setId] = useState<number | "">("");

  useEffect(() => {
    listLearners()
      .then((ls) => {
        setLearners(ls);
        if (ls[0]) setId(ls[0].id);
      })
      .catch(() => setLearners([]));
  }, []);

  if (learners && learners.length === 0)
    return <Alert severity="info">No learners yet. Add one on the Adaptive lesson page.</Alert>;

  return (
    <Stack spacing={2.5}>
      <FormControl sx={{ maxWidth: 360 }}>
        <InputLabel id="insight-learner-label">Learner</InputLabel>
        <Select
          labelId="insight-learner-label"
          label="Learner"
          value={id}
          onChange={(e) => setId(e.target.value as number)}
        >
          {(learners ?? []).map((l) => (
            <MenuItem key={l.id} value={l.id}>
              {l.code} · {profileLabel(l.profile)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {id !== "" && <LearnerInsights learnerId={id} />}
    </Stack>
  );
}
