// Minimal typing for the browser SpeechRecognition API (Chrome and Edge).

export interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}

export function createRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, (new () => Recognition) | undefined>;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function newClassCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = crypto.getRandomValues(new Uint32Array(4));
  return `CLASS-${Array.from(pick, (n) => chars[n % chars.length]).join("")}`;
}
