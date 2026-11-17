"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { LANGUAGES, type Lang } from "@/lib/api";
import { useSettings, type ColorMode } from "@/lib/settings";

export function AccessibilityPanel() {
  const { settings, update, reset } = useSettings();
  return (
    <Stack spacing={3} sx={{ p: 3, width: { xs: "100vw", sm: 380 } }}>
      <Typography variant="h5" component="h2">
        Reading settings
      </Typography>

      <FormControl fullWidth>
        <InputLabel id="lang-label">My language</InputLabel>
        <Select
          labelId="lang-label"
          label="My language"
          value={settings.lang}
          onChange={(e) => update({ lang: e.target.value as Lang })}
        >
          {LANGUAGES.map((l) => (
            <MenuItem key={l.code} value={l.code}>
              {l.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box>
        <Typography id="mode-label" gutterBottom>
          Colours
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          aria-labelledby="mode-label"
          value={settings.mode}
          onChange={(_, v: ColorMode | null) => v && update({ mode: v })}
        >
          <ToggleButton value="light">Light</ToggleButton>
          <ToggleButton value="dark">Dark</ToggleButton>
          <ToggleButton value="contrast">High contrast</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box>
        <Typography id="scale-label" gutterBottom>
          Text size: {Math.round(settings.textScale * 100)}%
        </Typography>
        <Slider
          aria-labelledby="scale-label"
          min={0.9}
          max={1.8}
          step={0.1}
          value={settings.textScale}
          onChange={(_, v) => update({ textScale: v as number })}
        />
      </Box>

      <Box>
        <Typography id="spacing-label" gutterBottom>
          Space between words
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          aria-labelledby="spacing-label"
          value={settings.wordSpacing}
          onChange={(_, v: number | null) => v !== null && update({ wordSpacing: v })}
        >
          <ToggleButton value={0}>Normal</ToggleButton>
          <ToggleButton value={0.16}>Wide</ToggleButton>
          <ToggleButton value={0.32}>Wider</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box>
        <Typography id="rate-label" gutterBottom>
          Reading speed: {settings.speechRate.toFixed(1)}×
        </Typography>
        <Slider
          aria-labelledby="rate-label"
          min={0.5}
          max={1.5}
          step={0.1}
          value={settings.speechRate}
          onChange={(_, v) => update({ speechRate: v as number })}
        />
      </Box>

      <FormControlLabel
        control={<Switch checked={settings.readAlong} onChange={(e) => update({ readAlong: e.target.checked })} />}
        label="Highlight each word while reading aloud"
      />

      <Divider />
      <Button variant="outlined" onClick={reset}>
        Reset to defaults
      </Button>
    </Stack>
  );
}
