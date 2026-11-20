"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Logout01Icon, SignLanguageCIcon, StopIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { useAnnounce } from "@/components/Announcer";
import { logUsage, wsUrl } from "@/lib/api";
import { Captions, nowHM, type Line } from "./Transcript";
import { MsePlayer, splitFrame } from "./msePlayer";

type Status = "idle" | "joining" | "joined";

// A Bangla Sign Language interpreter, who can be in another city, joins the
// class: they see and hear the teacher's stream and the captions, and their
// camera goes to students as the interpreter window. Their video is silent.
export function InterpreterView() {
  const announce = useAnnounce();
  const [room, setRoom] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [signing, setSigning] = useState(false);
  const [classOn, setClassOn] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [interim, setInterim] = useState("");
  const [warning, setWarning] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const classRef = useRef<HTMLVideoElement>(null);
  const selfRef = useRef<HTMLVideoElement>(null);
  const [player] = useState(() => new MsePlayer(classRef));
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const lineId = useRef(0);

  const stopSigning = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "video_stop" }));
    setSigning(false);
  }, []);

  const leave = useCallback(() => {
    stopSigning();
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
    player.stop();
    setClassOn(false);
    setStatus("idle");
  }, [stopSigning, player]);

  useEffect(() => leave, [leave]);

  const join = () => {
    const code = room.trim().toUpperCase();
    if (!code) return;
    setStatus("joining");
    const ws = new WebSocket(wsUrl(code));
    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "hello", role: "interpreter", name: name.trim() || "Interpreter" }));
      setStatus("joined");
      announce("Joined as the sign interpreter.");
      logUsage("sign", "interpreter_join");
    };
    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        const { stream, chunk } = splitFrame(e.data);
        if (stream === "class") player.push(chunk);
        return;
      }
      const m = JSON.parse(e.data as string) as { type: string; final?: boolean; text?: string; mime?: string; stream?: string };
      if (m.type === "caption" && m.text) {
        if (m.final) {
          const text = m.text;
          setLines((ls) => [...ls, { id: ++lineId.current, time: nowHM(), text }]);
          setInterim("");
        } else setInterim(m.text);
      } else if (m.type === "clear") setInterim("");
      else if (m.type === "video_start" && m.mime && m.stream !== "sign") setClassOn(player.start(m.mime));
      else if (m.type === "video_stop" && m.stream !== "sign") {
        player.stop();
        setClassOn(false);
      }
    };
    ws.onerror = () => announce("Could not join. Check the class code and try again.");
    ws.onclose = () => {
      announce("You left the class.");
      leave();
    };
    wsRef.current = ws;
  };

  const startSigning = async () => {
    setWarning(null);
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return;
    try {
      // Camera only: signing is silent, and the teacher's audio is the class audio.
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      streamRef.current = stream;
      if (selfRef.current) selfRef.current.srcObject = stream;
      const mime = ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
      if (!mime) {
        setWarning("This browser cannot stream video. Try Chrome or Edge.");
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      ws.send(JSON.stringify({ type: "video_start", mime }));
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 600_000 });
      recorder.ondataavailable = (e) => e.data.size > 0 && ws.readyState === WebSocket.OPEN && ws.send(e.data);
      recorder.start(500);
      recorderRef.current = recorder;
      setSigning(true);
      announce("Students can now see you signing.");
      logUsage("sign", "interpreter_start");
    } catch {
      setWarning("Camera permission is needed to sign for the class.");
    }
  };

  if (status !== "joined") {
    return (
      <Paper sx={{ p: { xs: 2, md: 4 }, maxWidth: 520 }}>
        <Stack spacing={2.5} component="form" onSubmit={(e) => (e.preventDefault(), join())}>
          <Typography variant="h4" component="h2">
            Interpret a class
          </Typography>
          <Typography color="text.secondary">
            You will see and hear the teacher. Students see your signing in a small window they can move and resize.
          </Typography>
          <TextField
            label="Class code"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="CLASS-AB12"
            required
            slotProps={{ htmlInput: { autoCapitalize: "characters", spellCheck: false } }}
          />
          <TextField label="Your name (shown to students)" value={name} onChange={(e) => setName(e.target.value)} />
          <Box>
            <Button type="submit" variant="contained" size="large" disabled={!room.trim() || status === "joining"}>
              {status === "joining" ? "Joining…" : "Join as interpreter"}
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
            <Typography variant="h4" component="h2">
              The class
            </Typography>
            <Box
              component="video"
              ref={classRef}
              controls
              playsInline
              aria-label="Teacher's video, with sound"
              sx={{ width: "100%", aspectRatio: "16 / 9", bgcolor: "common.black", borderRadius: 2 }}
            />
            {!classOn && <Typography color="text.secondary">Waiting for the teacher to start video…</Typography>}
            <Captions interim={interim} lines={lines} room={room.trim().toUpperCase()} />
          </Stack>
        </Paper>
      </Grid>
      <Grid size={{ xs: 12, md: 5 }}>
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h4" component="h2">
              Your signing
            </Typography>
            <Box
              component="video"
              ref={selfRef}
              autoPlay
              muted
              playsInline
              aria-label="Your camera preview"
              sx={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", bgcolor: "common.black", borderRadius: 2, transform: "scaleX(-1)" }}
            />
            {warning && <Alert severity="warning">{warning}</Alert>}
            <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
              {signing ? (
                <Button variant="contained" color="error" size="large" onClick={stopSigning} startIcon={<Icon icon={StopIcon} />}>
                  Stop signing
                </Button>
              ) : (
                <Button variant="contained" size="large" onClick={startSigning} startIcon={<Icon icon={SignLanguageCIcon} />}>
                  Start signing
                </Button>
              )}
              <Button variant="outlined" size="large" onClick={leave} startIcon={<Icon icon={Logout01Icon} />}>
                Leave
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Grid>
    </Grid>
  );
}
