"use client";

import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import { getHealth, type Health } from "@/lib/api";

// Tells teachers up front which features will work on this server.
export function ServerStatus() {
  const [health, setHealth] = useState<Health | null | "down">(null);
  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth("down"));
  }, []);

  if (health === null) return null;
  if (health === "down")
    return <Alert severity="error">The Prism server is not reachable. Start the backend to use the tools.</Alert>;
  if (!health.ai)
    return (
      <Alert severity="warning">
        AI is not configured on this server. Read-aloud, captions and offline simplification still work; image
        descriptions, translation and pictures need an OpenAI key.
      </Alert>
    );
  return null;
}
