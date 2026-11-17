"use client";

import { useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { Upload04Icon, VolumeHighIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { useAnnounce } from "@/components/Announcer";
import { describeImage, logUsage } from "@/lib/api";
import { useReadAloud } from "@/lib/useReadAloud";
import { useSettings } from "@/lib/settings";

const MAX_BYTES = 8 * 1024 * 1024;

export function ImageDescriber() {
  const { settings } = useSettings();
  const announce = useAnnounce();
  const reader = useReadAloud();
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [detail, setDetail] = useState<"short" | "detailed">("short");
  const [description, setDescription] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (dataUrl: string, level: "short" | "detailed") => {
    setBusy(true);
    setError(null);
    setDescription(null);
    announce("Looking at the image…");
    try {
      const res = await describeImage(dataUrl, settings.lang, level);
      setDescription(res.description);
      announce("Description ready.");
      logUsage("image", "describe", { lang: settings.lang, detail: level });
      void reader.speak(res.description, settings.lang);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Please choose an image file.");
    if (file.size > MAX_BYTES) return setError("That image is too large. Please use one under 8 MB.");
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setImage(url);
      void run(url, detail);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Paper sx={{ p: { xs: 2, md: 4 } }}>
      <Stack spacing={3}>
        <Typography variant="h5" component="h2">
          Describe a picture or diagram
        </Typography>

        <Box>
          <Typography id="detail-label" gutterBottom>
            How much detail?
          </Typography>
          <ToggleButtonGroup
            exclusive
            aria-labelledby="detail-label"
            value={detail}
            onChange={(_, v: "short" | "detailed" | null) => {
              if (!v) return;
              setDetail(v);
              if (image) void run(image, v);
            }}
          >
            <ToggleButton value="short">Short</ToggleButton>
            <ToggleButton value="detailed">Detailed</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
          aria-label="Choose an image"
        />
        <Box>
          <Button
            variant="contained"
            size="large"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            startIcon={<Icon icon={Upload04Icon} />}
          >
            {busy ? "Looking at the image…" : image ? "Choose another image" : "Choose an image"}
          </Button>
        </Box>

        {image && (
          <Box
            component="img"
            src={image}
            alt={description ?? "The image you chose"}
            sx={{ maxWidth: "100%", maxHeight: 360, objectFit: "contain", borderRadius: 2, alignSelf: "flex-start" }}
          />
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {description && (
          <Stack spacing={1.5}>
            <Typography sx={{ fontSize: "1.15rem", lineHeight: 1.7, wordSpacing: `${settings.wordSpacing}em` }}>
              {description}
            </Typography>
            {/* AI descriptions can sound right while being wrong (Aljedaani et al., 2026). */}
            <Alert severity="info" variant="outlined">
              Written by AI. It can make mistakes, so ask your teacher if something seems wrong.
            </Alert>
            <Box>
              <Button
                variant="outlined"
                onClick={() => reader.speak(description, settings.lang)}
                startIcon={<Icon icon={VolumeHighIcon} />}
              >
                Read again
              </Button>
            </Box>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
