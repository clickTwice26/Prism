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
        AI is not configured on this server. Signs, captions and the interpreter window still work. Finding key terms
        automatically and translating lessons and captions need a Gemini API key.
      </Alert>
    );
  return null;
}
