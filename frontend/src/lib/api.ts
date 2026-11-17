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

// How far an AI output can be trusted (the fidelity gate, N2).
export type Verification = "teacher_verified" | "auto_verified" | "pending_review" | "rules" | "original";

export interface SimplifyResult {
  original: string;
  simplified: string;
  verification: Verification;
  repaired: boolean;
  review_id?: number;
  grade_before: number | null;
  grade_after: number | null;
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

export interface DescribeResult {
  description: string;
  verification: Verification;
  disputed: number;
  review_id?: number;
}
export const describeImage = (imageDataUrl: string, lang: Lang, detail: "short" | "detailed") =>
  post<DescribeResult>("/api/describe-image", {
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

// ---- Review queue (N2) ----
export interface ReviewItem {
  id: number;
  kind: "simplify" | "describe";
  lang: Lang;
  variant: string;
  input_text: string;
  input_image: string;
  ai_output: string;
  safe_output: string;
  issues: string[];
  status: "pending" | "approved" | "rejected";
  final_output: string | null;
  created_at: string;
}
export const listReviews = (status: "pending" | "approved" | "rejected" = "pending") =>
  request<ReviewItem[]>(`/api/review?status=${status}`);
export const reviewCount = () => request<{ pending: number }>("/api/review/count").then((r) => r.pending);
export const approveReview = (id: number, output: string) => post<ReviewItem>(`/api/review/${id}/approve`, { output });
export const rejectReview = (id: number) => request<ReviewItem>(`/api/review/${id}/reject`, { method: "POST" });

// ---- Adaptive lessons (N1) ----
export const PROFILES: { value: string; label: string }[] = [
  { value: "blind", label: "Blind" },
  { value: "low_vision", label: "Low vision" },
  { value: "deaf", label: "Deaf" },
  { value: "hard_of_hearing", label: "Hard of hearing" },
  { value: "dyslexia", label: "Dyslexia" },
  { value: "autism", label: "Autism" },
  { value: "intellectual_disability", label: "Intellectual disability" },
  { value: "adhd", label: "ADHD" },
  { value: "none", label: "No disability" },
];
export const profileLabel = (p: string) => PROFILES.find((x) => x.value === p)?.label ?? p;

export interface Learner {
  id: number;
  code: string;
  profile: string;
  lang: Lang;
  created_at: string;
}
export const listLearners = () => request<Learner[]>("/api/learners");
export const addLearner = (l: { code: string; profile: string; lang: Lang }) => post<Learner>("/api/learners", l);

export interface Mix {
  simple: boolean;
  audio: boolean;
  picture: boolean;
}
export interface Arm {
  mix: Mix;
  key: string;
  tries: number;
  correct: number;
  estimate: number;
  default: boolean;
}
export interface Insights {
  learner: Learner;
  answered: number;
  default_mix: string;
  best_mix: string;
  confident: boolean;
  differs_from_default: boolean;
  arms: Arm[];
}
export const getInsights = (learnerId: number) => request<Insights>(`/api/learners/${learnerId}/insights`);

export interface ChunkView {
  attempt_id: number;
  chunk: number;
  total_chunks: number;
  mix: Mix;
  mix_key: string;
  reason: string;
  text: string;
  original_text: string;
  verification: Verification;
  lang: Lang;
  question: { question: string; options: string[] };
}
export const nextChunk = (learnerId: number, lessonId: number, chunk: number) =>
  post<ChunkView>("/api/learn/next", { learner_id: learnerId, lesson_id: lessonId, chunk });

export interface AnswerResult {
  correct: boolean;
  answer: number;
  answer_text: string;
  done: boolean;
}
export const answerChunk = (attemptId: number, choice: number) =>
  post<AnswerResult>("/api/learn/answer", { attempt_id: attemptId, choice });

export function mixLabel(key: string): string {
  const parts = key.split("+");
  const names: string[] = [parts[0] === "simple" ? "Simple text" : "Original text"];
  if (parts.includes("audio")) names.push("read aloud");
  if (parts.includes("picture")) names.push("picture");
  return names.join(" + ");
}
