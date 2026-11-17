"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { logUsage, type QuizQuestion } from "@/lib/api";

// Comprehension questions: the most reliable sign that a learner understood
// (Säuberli et al., 2024). Each answer gets immediate, kind feedback.
export function Quiz({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const done = Object.keys(answers).length === questions.length;
  const correct = questions.filter((q, i) => answers[i] === q.answer).length;

  const choose = (qi: number, oi: number) => {
    const next = { ...answers, [qi]: oi };
    setAnswers(next);
    if (Object.keys(next).length === questions.length) {
      logUsage("simplify", "quiz_done", {
        correct: questions.filter((q, i) => next[i] === q.answer).length,
        total: questions.length,
      });
    }
  };

  return (
    <Paper sx={{ p: { xs: 2, md: 4 } }}>
      <Stack spacing={3}>
        <Typography variant="h5" component="h2">
          Check my understanding
        </Typography>
        {questions.map((q, qi) => {
          const picked = answers[qi];
          const answered = picked !== undefined;
          return (
            <FormControl key={q.question}>
              <FormLabel id={`q${qi}`} sx={{ fontSize: "1.15rem", color: "text.primary", mb: 1 }}>
                {qi + 1}. {q.question}
              </FormLabel>
              <RadioGroup aria-labelledby={`q${qi}`} value={picked ?? ""} onChange={(_, v) => choose(qi, Number(v))}>
                {q.options.map((o, oi) => (
                  <FormControlLabel key={o} value={oi} control={<Radio />} label={o} disabled={answered} />
                ))}
              </RadioGroup>
              {answered && (
                <Alert severity={picked === q.answer ? "success" : "info"} sx={{ mt: 1 }}>
                  {picked === q.answer ? "Correct!" : `Good try. The answer is: ${q.options[q.answer]}`}
                </Alert>
              )}
            </FormControl>
          );
        })}
        {done && (
          <Alert severity="success" variant="filled" role="status">
            You got {correct} of {questions.length} right.
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
