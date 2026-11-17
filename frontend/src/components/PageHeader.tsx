import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";

export function PageHeader({ title, lead, audience }: { title: string; lead: string; audience?: string[] }) {
  return (
    <Stack spacing={1.5} sx={{ mb: 4 }}>
      <Typography variant="h3" component="h1">
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: "65ch", fontSize: "1.1rem" }}>
        {lead}
      </Typography>
      {audience && (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }} aria-label="Made for">
          {audience.map((a) => (
            <Chip key={a} label={a} size="small" variant="outlined" />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
