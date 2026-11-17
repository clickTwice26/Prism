"use client";

import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Analytics01Icon, BookOpen01Icon, MagicWand01Icon, Video01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { ServerStatus } from "@/features/ServerStatus";

const TOOLS = [
  {
    href: "/read",
    title: "Read & images",
    text: "Hear any lesson read aloud with each word highlighted, and get spoken descriptions of diagrams.",
    who: ["Blind & low vision", "Dyslexia"],
    icon: BookOpen01Icon,
  },
  {
    href: "/simplify",
    title: "Simplify",
    text: "Turn hard text into short, plain sentences, checked for missing facts, with a picture and quick questions.",
    who: ["Intellectual disability", "Autism", "Slow readers"],
    icon: MagicWand01Icon,
  },
  {
    href: "/live",
    title: "Live class",
    text: "Follow the teacher live with captions, a saved transcript, and on-demand descriptions of what is on screen.",
    who: ["Deaf & hard of hearing", "Blind & low vision"],
    icon: Video01Icon,
  },
  {
    href: "/study",
    title: "Study",
    text: "Record comprehension with and without Prism, so the impact is measured, not guessed.",
    who: ["Teachers", "Researchers"],
    icon: Analytics01Icon,
  },
];

export default function Home() {
  return (
    <Stack spacing={6}>
      <Box sx={{ maxWidth: 760 }}>
        <Typography variant="display">
          The same lesson, for every learner.
        </Typography>
        <Typography variant="lead" color="text.secondary" sx={{ mt: 2, maxWidth: "60ch" }}>
          Prism takes the class every student sees and gives each child the form they can use: spoken, captioned,
          described or simplified.
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button component={Link} href="/read" variant="contained" size="large">
            Open a lesson
          </Button>
          <Button component={Link} href="/live" variant="outlined" size="large">
            Join a live class
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={3} component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
        {TOOLS.map((t) => (
          <Grid key={t.href} size={{ xs: 12, sm: 6 }} component="li">
            <Card sx={{ height: "100%" }}>
              <CardActionArea component={Link} href={t.href} sx={{ height: "100%", alignItems: "flex-start" }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack spacing={1.5}>
                    <Box sx={{ color: "primary.main" }}>
                      <Icon icon={t.icon} size={32} />
                    </Box>
                    <Typography variant="h4" component="h2">
                      {t.title}
                    </Typography>
                    <Typography color="text.secondary">{t.text}</Typography>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                      {t.who.map((w) => (
                        <Chip key={w} label={w} size="small" />
                      ))}
                    </Stack>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <ServerStatus />
    </Stack>
  );
}
