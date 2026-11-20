"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Logout01Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { useAnnounce } from "@/components/Announcer";
import { describeImage, logUsage, translate, wsUrl } from "@/lib/api";
import { useReadAloud } from "@/lib/useReadAloud";
import { useSettings } from "@/lib/settings";
import { InterpreterWindow } from "@/components/InterpreterWindow";
import { Captions, nowHM, type Line } from "./Transcript";
import { MsePlayer, splitFrame } from "./msePlayer";

type Stream = "class" | "sign";

type Status = "idle" | "joining" | "joined";

export function StudentView() {
  const { settings } = useSettings();
  const announce = useAnnounce();
  const reader = useReadAloud();
  const [room, setRoom] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [interim, setInterim] = useState("");
  const [videoOn, setVideoOn] = useState(false);
  const [videoUnsupported, setVideoUnsupported] = useState(false);
  const [translateOn, setTranslateOn] = useState(false);
  const [screenNote, setScreenNote] = useState<string | null>(null);
  const [describing, setDescribing] = useState(false);

  const [signOn, setSignOn] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const signRef = useRef<HTMLVideoElement>(null);
  const [classPlayer] = useState(() => new MsePlayer(videoRef));
  const [signPlayer] = useState(() => new MsePlayer(signRef));
  const lineId = useRef(0);
  const translateRef = useRef(translateOn);
  const langRef = useRef(settings.lang);

  useEffect(() => {
    translateRef.current = translateOn;
    langRef.current = settings.lang;
  }, [translateOn, settings.lang]);

  // ---- video: the class stream and the sign interpreter stream ----
  const stopVideo = useCallback((stream: Stream) => {
    if (stream === "sign") {
      signPlayer.stop();
      setSignOn(false);
    } else {
      classPlayer.stop();
      setVideoOn(false);
    }
  }, [classPlayer, signPlayer]);

  const startVideo = useCallback((stream: Stream, mime: string) => {
    const player = stream === "sign" ? signPlayer : classPlayer;
    if (!player.start(mime)) {
      setVideoUnsupported(true);
      return;
    }
    if (stream === "sign") setSignOn(true);
    else setVideoOn(true);
  }, [classPlayer, signPlayer]);

  const addFinal = useCallback(async (text: string) => {
    const id = ++lineId.current;
    setLines((ls) => [...ls, { id, time: nowHM(), text }]);
    setInterim("");
    if (!translateRef.current) return;
    try {
      const tr = await translate(text, langRef.current);
      setLines((ls) => ls.map((l) => (l.id === id ? { ...l, translated: tr } : l)));
    } catch {
      /* keep the original line */
    }
  }, []);

  const leave = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
    stopVideo("class");
    stopVideo("sign");
    setStatus("idle");
  }, [stopVideo]);

  useEffect(() => leave, [leave]);

  const join = () => {
    const code = room.trim().toUpperCase();
    if (!code) return;
    setStatus("joining");
    const ws = new WebSocket(wsUrl(code));
    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "hello", role: "student", name: name.trim() || "Student" }));
      setStatus("joined");
      announce("Joined the class. Captions will appear when the teacher speaks.");
      logUsage("live", "join");
    };
    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        const { stream, chunk } = splitFrame(e.data);
        (stream === "sign" ? signPlayer : classPlayer).push(chunk);
        return;
      }
      const m = JSON.parse(e.data as string) as { type: string; final?: boolean; text?: string; mime?: string; stream?: Stream };
      const stream: Stream = m.stream === "sign" ? "sign" : "class";
      if (m.type === "caption" && m.text) {
        if (m.final) void addFinal(m.text);
        else setInterim(m.text);
      } else if (m.type === "clear") setInterim("");
      else if (m.type === "video_start" && m.mime) startVideo(stream, m.mime);
      else if (m.type === "video_stop") stopVideo(stream);
    };
    ws.onerror = () => announce("Could not join. Check the class code and try again.");
    ws.onclose = () => {
      announce("You left the class.");
      leave();
    };
    wsRef.current = ws;
  };

  // Describe the current video frame for blind and low-vision learners.
  const describeScreen = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      setScreenNote("There is no video to describe yet.");
      return;
    }
    const scale = Math.min(1, 1280 / v.videoWidth);
    const canvas = Object.assign(document.createElement("canvas"), {
      width: Math.round(v.videoWidth * scale),
      height: Math.round(v.videoHeight * scale),
    });
    canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
    setDescribing(true);
    setScreenNote(null);
    announce("Looking at the screen…");
    try {
      const res = await describeImage(canvas.toDataURL("image/jpeg", 0.85), settings.lang, "short");
      setScreenNote(
        res.verification === "pending_review"
          ? `${res.description} (Your teacher is checking some details, so only the parts Prism is sure about are shown.)`
          : res.description,
      );
      void reader.speak(res.description, settings.lang);
      logUsage("live", "describe_screen", { lang: settings.lang });
    } catch (e) {
      setScreenNote((e as Error).message);
    } finally {
      setDescribing(false);
    }
  };

  if (status !== "joined") {
    return (
      <Paper sx={{ p: { xs: 2, md: 4 }, maxWidth: 520 }}>
        <Stack spacing={2.5} component="form" onSubmit={(e) => (e.preventDefault(), join())}>
          <Typography variant="h4" component="h2">
            Join your class
          </Typography>
          <TextField
            label="Class code"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="CLASS-AB12"
            required
            slotProps={{ htmlInput: { autoCapitalize: "characters", spellCheck: false } }}
          />
          <TextField label="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <Box>
            <Button type="submit" variant="contained" size="large" disabled={!room.trim() || status === "joining"}>
              {status === "joining" ? "Joining…" : "Join"}
            </Button>
          </Box>
        </Stack>
      </Paper>
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 7 }}>
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Box
              component="video"
              ref={videoRef}
              controls
              playsInline
              aria-label="Teacher's video"
              sx={{ width: "100%", aspectRatio: "16 / 9", bgcolor: "common.black", borderRadius: 2 }}
            />
            {!videoOn && <Typography color="text.secondary">Waiting for the teacher to start video…</Typography>}
            {videoUnsupported && (
              <Alert severity="info">This browser cannot play the class video. Captions still work.</Alert>
            )}
            <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
              <Button
                variant="contained"
                size="large"
                onClick={describeScreen}
                disabled={!videoOn || describing}
                startIcon={<Icon icon={ViewIcon} />}
              >
                {describing ? "Looking…" : "What's on screen now?"}
              </Button>
              <Button variant="outlined" size="large" onClick={leave} startIcon={<Icon icon={Logout01Icon} />}>
                Leave
              </Button>
            </Stack>
            <InterpreterWindow videoRef={signRef} live streaming={signOn} />
            {screenNote && (
              <Alert severity="info" variant="outlined">
                {screenNote}
                <Typography variant="caption" sx={{ display: "block", mt: 1 }}>
                  Written by AI and checked against independent descriptions.
                </Typography>
              </Alert>
            )}
          </Stack>
        </Paper>
      </Grid>
      <Grid size={{ xs: 12, md: 5 }}>
        <Paper sx={{ p: 3 }}>
          <FormControlLabel
            control={<Switch checked={translateOn} onChange={(e) => setTranslateOn(e.target.checked)} />}
            label="Translate captions into my language"
            sx={{ mb: 1 }}
          />
          <Captions interim={interim} lines={lines} room={room.trim().toUpperCase()} />
        </Paper>
      </Grid>
    </Grid>
  );
}
