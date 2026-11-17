"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { Refresh01Icon, StopIcon, UserGroupIcon, Video01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { useAnnounce } from "@/components/Announcer";
import { logUsage, speechLocale, wsUrl } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { Captions, nowHM, type Line } from "./Transcript";
import { createRecognition, newClassCode, type Recognition } from "./speech";

type Source = "camera" | "screen";

export function TeacherView() {
  const { settings } = useSettings();
  const announce = useAnnounce();
  const [room, setRoom] = useState("");
  const [source, setSource] = useState<Source>("camera");
  const [live, setLive] = useState(false);
  const [students, setStudents] = useState<string[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [interim, setInterim] = useState("");
  const [warning, setWarning] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const liveRef = useRef(false);
  const selfViewRef = useRef<HTMLVideoElement>(null);
  const lineId = useRef(0);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- code must be generated on the client
  useEffect(() => setRoom(newClassCode()), []);

  const send = (msg: object | Blob) => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return;
    ws.send(msg instanceof Blob ? msg : JSON.stringify(msg));
  };

  const stop = useCallback(() => {
    liveRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onend = null;
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "video_stop" }));
    wsRef.current?.close();
    wsRef.current = null;
    setLive(false);
    setInterim("");
    setStudents([]);
  }, []);

  useEffect(() => stop, [stop]);

  const connect = () =>
    new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(wsUrl(room));
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "hello", role: "teacher", name: "Teacher" }));
        resolve(ws);
      };
      ws.onerror = () => reject(new Error("socket"));
      ws.onmessage = (e) => {
        if (typeof e.data !== "string") return;
        const m = JSON.parse(e.data) as { type: string; students?: string[] };
        if (m.type === "roster") setStudents(m.students ?? []);
      };
      ws.onclose = () => {
        if (liveRef.current) {
          announce("Connection to the class was lost.");
          stop();
        }
      };
    });

  const getStream = async (): Promise<MediaStream> => {
    if (source === "screen") {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        mic.getAudioTracks().forEach((t) => screen.addTrack(t));
      } catch {
        /* screen only */
      }
      return screen;
    }
    return navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
  };

  const startCaptions = () => {
    const rec = createRecognition();
    if (!rec) {
      setWarning("This browser cannot make captions. Use Chrome or Edge to caption your class.");
      return;
    }
    rec.lang = speechLocale(settings.lang);
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0].transcript.trim();
        if (!t) continue;
        if (r.isFinal) {
          setLines((ls) => [...ls, { id: ++lineId.current, time: nowHM(), text: t }]);
          send({ type: "caption", final: true, text: t });
        } else partial += `${t} `;
      }
      setInterim(partial.trim());
      if (partial) send({ type: "caption", final: false, text: partial.trim() });
    };
    // Recognition stops on silence; keep it running while the class is live.
    rec.onend = () => {
      if (liveRef.current && recRef.current === rec) {
        try {
          rec.start();
        } catch {
          /* ignore */
        }
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") setWarning("Microphone permission is needed for captions.");
    };
    recRef.current = rec;
    rec.start();
  };

  const start = async () => {
    setWarning(null);
    let ws: WebSocket;
    try {
      ws = await connect();
    } catch {
      announce("Could not connect to the class server.");
      return;
    }
    wsRef.current = ws;
    liveRef.current = true;
    setLive(true);

    try {
      const stream = await getStream();
      streamRef.current = stream;
      if (selfViewRef.current) selfViewRef.current.srcObject = stream;
      const mime = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"].find((m) =>
        MediaRecorder.isTypeSupported(m),
      );
      if (mime) {
        send({ type: "video_start", mime });
        const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 900_000 });
        recorder.ondataavailable = (e) => e.data.size > 0 && send(e.data);
        recorder.start(500);
        recorderRef.current = recorder;
      } else {
        setWarning("This browser cannot stream video. Captions will still be sent.");
      }
    } catch {
      setWarning("Camera or screen was not shared. Only captions will be sent.");
    }

    startCaptions();
    announce(`Class ${room} is live.`);
    logUsage("live", "broadcast_start", { source, lang: settings.lang });
  };

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 7 }}>
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
              <Typography variant="h4" component="h2">
                Class code
              </Typography>
              <Chip label={room || "…"} color="primary" sx={{ typography: "h5", letterSpacing: "0.08em" }} />
              {!live && (
                <Button size="small" onClick={() => setRoom(newClassCode())} startIcon={<Icon icon={Refresh01Icon} size={18} />}>
                  New code
                </Button>
              )}
            </Stack>
            <Typography color="text.secondary">Students enter this code on the Live class page to join.</Typography>

            {!live && (
              <Box>
                <Typography id="source-label" gutterBottom>
                  Share
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  aria-labelledby="source-label"
                  value={source}
                  onChange={(_, v: Source | null) => v && setSource(v)}
                >
                  <ToggleButton value="camera">My camera</ToggleButton>
                  <ToggleButton value="screen">My screen or slides</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            )}

            <Box
              component="video"
              ref={selfViewRef}
              autoPlay
              muted
              playsInline
              aria-label="Your broadcast preview"
              sx={{ width: "100%", aspectRatio: "16 / 9", bgcolor: "common.black", borderRadius: 2, display: live ? "block" : "none" }}
            />

            {warning && <Alert severity="warning">{warning}</Alert>}

            <Box>
              {live ? (
                <Button variant="contained" color="error" size="large" onClick={stop} startIcon={<Icon icon={StopIcon} />}>
                  End class
                </Button>
              ) : (
                <Button
                  variant="contained"
                  size="large"
                  onClick={start}
                  disabled={!room}
                  startIcon={<Icon icon={Video01Icon} />}
                >
                  Start class
                </Button>
              )}
            </Box>
          </Stack>
        </Paper>
      </Grid>
      <Grid size={{ xs: 12, md: 5 }}>
        <Stack spacing={3}>
          <Paper sx={{ p: 3 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
              <Icon icon={UserGroupIcon} />
              <Typography variant="h4" component="h2">
                Students ({students.length})
              </Typography>
            </Stack>
            {students.length === 0 ? (
              <Typography color="text.secondary">{live ? "Waiting for students to join…" : "Start the class first."}</Typography>
            ) : (
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                {students.map((s, i) => (
                  <Chip key={`${s}-${i}`} label={s} />
                ))}
              </Stack>
            )}
          </Paper>
          <Paper sx={{ p: 3 }}>
            <Captions interim={interim} lines={lines} room={room} />
          </Paper>
        </Stack>
      </Grid>
    </Grid>
  );
}
