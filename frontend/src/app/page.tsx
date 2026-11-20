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
import { BookOpen01Icon, SignLanguageCIcon, Video01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { ServerStatus } from "@/features/ServerStatus";

const TOOLS = [
  {
    href: "/lessons",
    title: "Lessons",
    text: "Read the lesson in Bangla, English or Malay. Key words show their Bangla Sign Language sign, and a recorded interpreter can sign the whole lesson.",
    who: ["Deaf", "Hard of hearing"],
    icon: BookOpen01Icon,
  },
  {
    href: "/live",
    title: "Live class",
    text: "Follow the teacher live with captions and a saved transcript, with a sign interpreter who can join from anywhere.",
    who: ["Deaf & hard of hearing", "Sign interpreters"],
    icon: Video01Icon,
  },
  {
    href: "/sign",
    title: "Sign glossary",
    text: "AI finds each lesson's key terms, people record the signs, and deaf reviewers approve every sign before learners see it.",
    who: ["Teachers", "Sign interpreters", "Deaf reviewers"],
    icon: SignLanguageCIcon,
  },
];

export default function Home() {
  return (
    <Stack spacing={6}>
      <Box sx={{ maxWidth: 760 }}>
        <Typography variant="display">The same lesson, in Bangla Sign Language.</Typography>
        <Typography variant="lead" color="text.secondary" sx={{ mt: 2, maxWidth: "60ch" }}>
          Prism Sign gives deaf learners in Bangladesh the class lesson with the key science words signed, captions that
          stay on, and a sign interpreter they can move, resize or hide. People do the signing. Deaf reviewers approve
          every sign.
        </Typography>
        <Stack direction="row" spacing={2} useFlexGap sx={{ mt: 3, flexWrap: "wrap" }}>
          <Button component={Link} href="/lessons" variant="contained" size="large">
            Open a lesson
          </Button>
          <Button component={Link} href="/live" variant="outlined" size="large">
            Join a live class
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={3} component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
        {TOOLS.map((t) => (
          <Grid key={t.href} size={{ xs: 12, md: 4 }} component="li">
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
