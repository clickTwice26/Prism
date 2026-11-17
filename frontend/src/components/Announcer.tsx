"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import Snackbar from "@mui/material/Snackbar";

// Status messages are both shown and spoken to screen readers via a polite
// live region, so blind learners hear the result of each action.
const AnnounceContext = createContext<(msg: string) => void>(() => undefined);

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null);
  const announce = useCallback((text: string) => setMsg({ text, key: Date.now() }), []);
  return (
    <AnnounceContext value={announce}>
      {children}
      <div aria-live="polite" role="status" className="visually-hidden">
        {msg?.text}
      </div>
      <Snackbar
        key={msg?.key}
        open={!!msg}
        autoHideDuration={4000}
        onClose={() => setMsg(null)}
        message={msg?.text}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </AnnounceContext>
  );
}

export const useAnnounce = () => useContext(AnnounceContext);
