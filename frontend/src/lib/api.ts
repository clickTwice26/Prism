// Typed client for the Prism Go API.

export type Lang = "en" | "bn" | "ms";

export const LANGUAGES: { code: Lang; label: string; speech: string }[] = [
  { code: "en", label: "English", speech: "en-US" },
  { code: "bn", label: "বাংলা (Bangla)", speech: "bn-BD" },
  { code: "ms", label: "Bahasa Melayu", speech: "ms-MY" },
];

export function speechLocale(lang: Lang): string {
  return LANGUAGES.find((l) => l.code === lang)?.speech ?? "en-US";
}

// API base: NEXT_PUBLIC_API_URL, else the page's own host on port 8080 so the
// app also works when opened by LAN IP from a phone.
export function apiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") return `${window.location.protocol}//${window.location.hostname}:8080`;
  return "http://localhost:8080";
}

export function wsUrl(room: string): string {
  return `${apiBase().replace(/^http/, "ws")}/ws/class/${encodeURIComponent(room)}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("Could not reach the Prism server. Check that the backend is running.", 0);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) });

export interface Health {
  status: string;
  postgres: boolean;
  redis: boolean;
  ai: boolean;
  piper_languages: Lang[];
}
export const getHealth = () => request<Health>("/api/health");

export interface Lesson {
  id: number;
  subject: string;
  title: string;
  body: string;
  language: Lang;
  created_at: string;
}
export const listLessons = () => request<Lesson[]>("/api/lessons");

export interface FactCheck {
  faithful: boolean;
  issues: string[];
}
export interface SimplifyResult {
  original: string;
  simplified: string;
  source: "ai" | "rules";
  grade_before: number | null;
  grade_after: number | null;
  fact_check: FactCheck | null;
}
export const simplify = (text: string, lang: Lang) => post<SimplifyResult>("/api/simplify", { text, lang });

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
}
export const makeQuiz = (text: string, lang: Lang, count = 3) =>
  post<{ questions: QuizQuestion[] }>("/api/quiz", { text, lang, count }).then((r) => r.questions);

export const translate = (text: string, targetLang: Lang) =>
  post<{ translated: string }>("/api/translate", { text, target_lang: targetLang }).then((r) => r.translated);

export const describeImage = (imageDataUrl: string, lang: Lang, detail: "short" | "detailed") =>
  post<{ description: string; ai_generated: boolean }>("/api/describe-image", {
    image_data_url: imageDataUrl,
    lang,
    detail,
  });

export const illustrate = (text: string) =>
  post<{ image_data_url: string }>("/api/illustrate", { text }).then((r) => r.image_data_url);

// Returns an object URL for server-synthesized speech (Piper or OpenAI).
export async function speakOnServer(text: string, lang: Lang): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang, engine: "auto" }),
    });
  } catch {
    throw new ApiError("offline", 0);
  }
  if (!res.ok) throw new ApiError("tts unavailable", res.status);
  return URL.createObjectURL(await res.blob());
}

// Fire-and-forget analytics; never throws into the UI.
export function logUsage(feature: string, action: string, meta?: Record<string, unknown>): void {
  void post("/api/usage", { feature, action, meta: meta ?? null }).catch(() => undefined);
}

// ---- Study ----
export interface Participant {
  id: number;
  code: string;
  profile: string;
  notes: string;
  created_at: string;
}
export interface StudyResult {
  id: number;
  participant_id: number;
  feature: string;
  condition: "with_tool" | "without_tool";
  comprehension_score: number | null;
  task_completed: boolean;
  time_seconds: number | null;
  sus_score: number | null;
  satisfaction: number | null;
  created_at: string;
}
export interface ConditionSummary {
  results: number;
  avg_comprehension: number | null;
  avg_time_seconds: number | null;
  task_completion_rate: number | null;
  avg_sus_score: number | null;
  avg_satisfaction: number | null;
}
export interface StudySummary {
  participants: number;
  by_condition: Partial<Record<"with_tool" | "without_tool", ConditionSummary>>;
}
export const listParticipants = () => request<Participant[]>("/api/study/participants");
export const addParticipant = (p: { code: string; profile: string; notes: string }) =>
  post<Participant>("/api/study/participants", p);
export const listResults = () => request<StudyResult[]>("/api/study/results");
export const addResult = (r: Omit<StudyResult, "id" | "created_at">) => post<StudyResult>("/api/study/results", r);
export const getStudySummary = () => request<StudySummary>("/api/study/summary");
