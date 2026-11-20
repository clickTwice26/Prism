"use client";

import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { getAllTemplates } from "@/lib/api";
import type { WordTemplate } from "@/lib/handsign/motion.ts";
import { describeWord } from "@/lib/handsign/describe.ts";
import { SignAvatar } from "@/components/SignAvatar";
import { useAnnounce } from "@/components/Announcer";

// Every sign the IsharaKotha corpus documents, searchable in Bangla or English
// and by topic. The chosen sign is performed by a 3D signer and written out
// part by part (handshape, place, movement), so a learner can watch and read it.

type Entry = WordTemplate & { section?: string };

const START = "বই";
const label = (e: Entry) => (e.en ? `${e.bn} (${e.en})` : e.bn);

export function SignDictionary() {
  const announce = useAnnounce();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState("");
  const [section, setSection] = useState("");
  const [chosen, setChosen] = useState<Entry | null>(null);

  useEffect(() => {
    getAllTemplates()
      .then((all) => {
        const usable = all.filter((t) => t.signs.length > 0).sort((a, b) => a.bn.localeCompare(b.bn, "bn"));
        setEntries(usable);
        setChosen(usable.find((t) => t.bn === START) ?? usable[0] ?? null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const sections = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries ?? []) if (e.section) counts.set(e.section, (counts.get(e.section) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries]);

  const inSection = useMemo(() => (entries ?? []).filter((e) => !section || e.section === section), [entries, section]);

  const choose = (e: Entry | null) => {
    if (!e) return;
    setChosen(e);
    announce(`Showing the sign for ${e.bn}${e.en ? `, ${e.en}` : ""}`);
  };

  if (error) return <Alert severity="error">Could not load the dictionary: {error}</Alert>;
  if (!entries) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rounded" height={56} />
        <Skeleton variant="rounded" height={420} />
      </Stack>
    );
  }
  if (!entries.length) {
    return <Alert severity="info">No sign descriptions are installed on this server (the IsharaKotha corpus is missing).</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Autocomplete
            sx={{ flex: 2 }}
            options={inSection}
            value={chosen}
            onChange={(_, v) => choose(v)}
            getOptionLabel={label}
            getOptionKey={(o) => o.id}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={(opts, { inputValue }) => {
              const q = inputValue.normalize("NFC").trim().toLowerCase();
              if (!q) return opts.slice(0, 200);
              return opts.filter((o) => o.bn.normalize("NFC").includes(q) || o.en?.toLowerCase().includes(q)).slice(0, 200);
            }}
            renderInput={(params) => <TextField {...params} label="Find a word, in Bangla or English" />}
          />
          <FormControl sx={{ flex: 1, minWidth: 200 }}>
            <InputLabel id="dict-topic" shrink>
              Topic
            </InputLabel>
            <Select
              labelId="dict-topic"
              label="Topic"
              displayEmpty
              notched
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              <MenuItem value="">All topics ({entries.length.toLocaleString()})</MenuItem>
              {sections.map(([s, n]) => (
                <MenuItem key={s} value={s}>
                  {s} ({n})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {chosen && (
        <Paper sx={{ p: 3 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={4} sx={{ alignItems: { md: "flex-start" } }}>
            <SignAvatar key={chosen.id} id={chosen.id} word={chosen.bn} />
            <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
              <Box>
                <Typography variant="h3" component="h2" lang="bn">
                  {chosen.bn}
                </Typography>
                {chosen.en && (
                  <Typography variant="lead" component="p" color="text.secondary">
                    {chosen.en}
                  </Typography>
                )}
                {chosen.section && <Chip size="small" label={chosen.section} sx={{ mt: 1 }} />}
              </Box>
              <Box component="dl" sx={{ m: 0 }}>
                {describeWord(chosen).map((d, i) => (
                  <Box key={`${d.label}-${i}`} sx={{ mb: 1.25 }}>
                    <Typography component="dt" variant="subtitle1">
                      {d.label}
                    </Typography>
                    <Typography component="dd" sx={{ m: 0 }}>
                      {d.text}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary">
                Signs vary by region. Where a deaf signer has recorded this word, their sign comes first in lessons.
              </Typography>
            </Stack>
          </Stack>
        </Paper>
      )}

      {section && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" component="h2" sx={{ mb: 1.5 }}>
            {section}
          </Typography>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
            {inSection.slice(0, 120).map((e) => (
              <Chip
                key={e.id}
                label={label(e)}
                lang="bn"
                color={chosen?.id === e.id ? "primary" : "default"}
                onClick={() => choose(e)}
                aria-pressed={chosen?.id === e.id}
              />
            ))}
          </Stack>
          {inSection.length > 120 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              Showing 120 of {inSection.length}. Search to find the rest.
            </Typography>
          )}
        </Paper>
      )}
    </Stack>
  );
}
