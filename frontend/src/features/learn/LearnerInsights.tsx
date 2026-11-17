"use client";

import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { getInsights, mixLabel, profileLabel, type Insights } from "@/lib/api";

// Which support mix works for one learner, measured by their own answers (N1).
export function LearnerInsights({ learnerId, refreshKey = 0 }: { learnerId: number; refreshKey?: number }) {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getInsights(learnerId)
      .then((d) => live && setData(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [learnerId, refreshKey]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <LinearProgress aria-label="Loading results" />;

  return (
    <Stack spacing={2}>
      <Typography color="text.secondary">
        {data.learner.code} · {profileLabel(data.learner.profile)} · {data.answered} answered{" "}
        {data.answered === 1 ? "question" : "questions"}
      </Typography>
      {!data.confident && (
        <Alert severity="info">
          Prism needs a few more answers before it can say which mix works best. It is still trying nearby mixes.
        </Alert>
      )}
      {data.differs_from_default && (
        <Alert severity="success">
          What works for {data.learner.code} ({mixLabel(data.best_mix)}) is different from the usual starting point for{" "}
          {profileLabel(data.learner.profile).toLowerCase()} ({mixLabel(data.default_mix)}).
        </Alert>
      )}
      <TableContainer>
        <Table size="small" aria-label={`Support mixes for ${data.learner.code}`}>
          <TableHead>
            <TableRow>
              <TableCell>Support mix</TableCell>
              <TableCell align="right">Tried</TableCell>
              <TableCell align="right">Correct</TableCell>
              <TableCell align="right">Estimated chance of understanding</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.arms.map((a, i) => (
              <TableRow key={a.key}>
                <TableCell component="th" scope="row">
                  <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                    <span>{mixLabel(a.key)}</span>
                    {i === 0 && data.confident && <Chip size="small" color="success" label="Works best" />}
                    {a.default && <Chip size="small" variant="outlined" label="Profile start" />}
                  </Stack>
                </TableCell>
                <TableCell align="right">{a.tries}</TableCell>
                <TableCell align="right">{a.correct}</TableCell>
                <TableCell align="right">{Math.round(a.estimate * 100)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
