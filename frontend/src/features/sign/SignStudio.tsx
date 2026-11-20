"use client";

import { useEffect, useState } from "react";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { signVideoCount } from "@/lib/api";
import { SIGNS_CHANGED } from "@/lib/signs";
import { Lexicon } from "./Lexicon";
import { LessonSigns } from "./LessonSigns";
import { MissingSigns } from "./MissingSigns";
import { SignReview } from "./SignReview";

const TABS = [
  { key: "lessons", label: "Lesson terms" },
  { key: "review", label: "Deaf review" },
  { key: "missing", label: "Missing signs" },
  { key: "lexicon", label: "Lexicon" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function SignStudio() {
  const [tab, setTab] = useState<TabKey>("lessons");
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const load = () =>
      signVideoCount()
        .then(setPending)
        .catch(() => setPending(0));
    load();
    window.addEventListener(SIGNS_CHANGED, load);
    return () => window.removeEventListener(SIGNS_CHANGED, load);
  }, []);

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_, v: TabKey) => setTab(v)}
        aria-label="Sign glossary sections"
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
      >
        {TABS.map((t) => (
          <Tab
            key={t.key}
            value={t.key}
            id={`sign-tab-${t.key}`}
            aria-controls={`sign-panel-${t.key}`}
            label={
              t.key === "review" && pending > 0 ? (
                <Badge color="error" badgeContent={pending} sx={{ pr: 1.5 }} slotProps={{ badge: { "aria-label": `${pending} waiting` } }}>
                  {t.label}
                </Badge>
              ) : (
                t.label
              )
            }
          />
        ))}
      </Tabs>
      <Box role="tabpanel" id={`sign-panel-${tab}`} aria-labelledby={`sign-tab-${tab}`}>
        {tab === "lessons" && <LessonSigns />}
        {tab === "review" && <SignReview />}
        {tab === "missing" && <MissingSigns />}
        {tab === "lexicon" && <Lexicon />}
      </Box>
    </Box>
  );
}
