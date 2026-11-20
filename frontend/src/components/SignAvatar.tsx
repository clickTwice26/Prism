"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { PlayIcon, RepeatIcon, StopIcon } from "@hugeicons/core-free-icons";
import { getSignSiGML } from "@/lib/api";
import { useAnnounce } from "./Announcer";
import { Icon } from "./Icon";

// A 3D character signing a documented word from its written description
// (HamNoSys, from the IsharaKotha corpus). The character is the CWA Signing
// Avatars player from the University of East Anglia, run in its own frame
// (public/avatar.html). It is a preview made by software from a description,
// not a person's signing, and it is labelled that way everywhere it shows.

const CHARACTERS = [
  { id: "anna", label: "Anna" },
  { id: "marc", label: "Marc" },
  { id: "francoise", label: "Françoise" },
] as const;
type Character = (typeof CHARACTERS)[number]["id"];

type Status = "loading" | "ready" | "playing" | "idle" | "missing" | "failed";

interface Props {
  /** The word, used for labels and, without an id, to look the sign up. */
  word: string;
  /** Corpus ID of the exact sign to play (a word can have several documented signs). */
  id?: string;
  /** Start signing as soon as the character is ready. */
  autoPlay?: boolean;
  maxWidth?: number;
}

export function SignAvatar({ word, id, autoPlay = true, maxWidth = 360 }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const announce = useAnnounce();
  const [character, setCharacter] = useState<Character>("anna");
  const [sigml, setSigml] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [slow, setSlow] = useState(false);
  const [loop, setLoop] = useState(true);
  const opts = useRef({ loop, sigml, autoPlay });
  const avatarReady = useRef(false);
  const replay = useRef<number | undefined>(undefined);

  useEffect(() => {
    opts.current = { loop, sigml, autoPlay };
  }, [loop, sigml, autoPlay]);

  const send = useCallback((msg: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage({ prism: "avatar", ...msg }, window.location.origin);
  }, []);

  const play = useCallback(() => {
    window.clearTimeout(replay.current);
    if (opts.current.sigml && avatarReady.current) send({ play: opts.current.sigml });
  }, [send]);

  // Load the description of this sign.
  useEffect(() => {
    let live = true;
    getSignSiGML(id ? { id } : { word })
      .then((s) => {
        if (!live) return;
        setSigml(s);
        if (!s) setStatus("missing");
      })
      .catch((e: Error) => {
        if (!live) return;
        setError(e.message);
        setStatus("failed");
      });
    return () => {
      live = false;
    };
  }, [id, word]);

  // Play the new sign once it and the character are both ready.
  useEffect(() => {
    if (sigml && avatarReady.current && opts.current.autoPlay) play();
  }, [sigml, play]);

  // Messages from the character's frame.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const d = e.data as { prism?: string; event?: string; detail?: string };
      if (d?.prism !== "avatar") return;
      if (d.event === "ready") {
        avatarReady.current = true;
        setStatus("ready");
        send({ slow });
        if (opts.current.autoPlay) play();
      } else if (d.event === "playing") {
        setStatus("playing");
      } else if (d.event === "idle") {
        setStatus("idle");
        if (opts.current.loop) replay.current = window.setTimeout(play, 1200);
      } else if (d.event === "failed") {
        setError(d.detail ?? "The 3D signer could not start.");
        setStatus("failed");
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(replay.current);
    };
    // `slow` is sent separately when it changes; only the character reloads the frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character, play, send]);

  useEffect(() => {
    if (avatarReady.current) send({ slow });
  }, [slow, send]);

  const stop = () => {
    window.clearTimeout(replay.current);
    setLoop(false);
    send({ stop: true });
    announce("Stopped");
  };

  const changeCharacter = (c: Character) => {
    avatarReady.current = false;
    setStatus("loading");
    setCharacter(c);
  };

  if (status === "missing") {
    return (
      <Typography variant="body2" color="text.secondary">
        No written description of this sign yet, so there is no 3D preview.
      </Typography>
    );
  }

  const busy = status === "loading";
  return (
    <Stack spacing={1.25} sx={{ maxWidth, width: "100%" }}>
      <Box
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: "3 / 4",
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "#A9B8D3",
        }}
      >
        <Box
          component="iframe"
          key={character}
          ref={frame}
          src={`/avatar.html?av=${character}`}
          title={`3D preview of the sign for ${word}`}
          sx={{ border: 0, width: "100%", height: "100%", display: "block" }}
        />
        {busy && (
          <Stack
            role="status"
            spacing={1}
            sx={{
              position: "absolute",
              inset: 0,
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "rgba(169,184,211,0.85)",
            }}
          >
            <CircularProgress size={32} aria-hidden />
            <Typography variant="body2">Loading the 3D signer…</Typography>
          </Stack>
        )}
      </Box>

      {status === "failed" ? (
        <Alert severity="warning">{error || "The 3D signer could not start."}</Alert>
      ) : (
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
          <Button
            size="small"
            variant="contained"
            disabled={busy || !sigml}
            onClick={() => {
              play();
              announce(`Signing ${word}`);
            }}
            startIcon={<Icon icon={PlayIcon} size={18} />}
          >
            {status === "playing" ? "Signing…" : "Sign it"}
          </Button>
          <Button size="small" variant="outlined" disabled={busy} onClick={stop} startIcon={<Icon icon={StopIcon} size={18} />}>
            Stop
          </Button>
          <Button size="small" variant={slow ? "contained" : "outlined"} aria-pressed={slow} onClick={() => setSlow((s) => !s)}>
            Slow
          </Button>
          <Button
            size="small"
            variant={loop ? "contained" : "outlined"}
            aria-pressed={loop}
            onClick={() => setLoop((l) => !l)}
            startIcon={<Icon icon={RepeatIcon} size={18} />}
          >
            Repeat
          </Button>
        </Stack>
      )}

      <ToggleButtonGroup
        exclusive
        size="small"
        value={character}
        onChange={(_, v: Character | null) => v && changeCharacter(v)}
        aria-label="3D signer"
      >
        {CHARACTERS.map((c) => (
          <ToggleButton key={c.id} value={c.id}>
            {c.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Typography variant="caption" color="text.secondary">
        3D preview made by software from the sign&apos;s written description (IsharaKotha). It is not a deaf signer and has not
        been checked by a deaf reviewer. Signer: CWA Signing Avatars, University of East Anglia (CC BY-SA 4.0).
      </Typography>
    </Stack>
  );
}
