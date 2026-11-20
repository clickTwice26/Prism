// Typed client for the Prism Go API.

import type { LetterTemplate } from "./handsign/letters.ts";
import type { WordTemplate } from "./handsign/motion.ts";

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

// Multipart upload: the browser sets the Content-Type boundary itself.
async function upload<T>(path: string, form: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, { method: "POST", body: form });
  } catch {
    throw new ApiError("Could not reach the Prism server. Check that the backend is running.", 0);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `Upload failed (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

export interface Health {
  status: string;
  postgres: boolean;
  redis: boolean;
  ai: boolean;
  sign_reference_words: number;
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
export const addLesson = (l: { subject: string; title: string; body: string; language: Lang }) =>
  post<Lesson>("/api/lessons", l);

export const translate = (text: string, targetLang: Lang) =>
  post<{ translated: string }>("/api/translate", { text, target_lang: targetLang }).then((r) => r.translated);

// Fire-and-forget analytics; never throws into the UI.
export function logUsage(feature: string, action: string, meta?: Record<string, unknown>): void {
  void post("/api/usage", { feature, action, meta: meta ?? null }).catch(() => undefined);
}

// ---- Prism Sign: Bangla Sign Language ----
export interface SignVideo {
  id: number;
  kind: "term" | "lesson";
  term_id: number | null;
  lesson_id: number | null;
  file: string;
  mime: string;
  bytes: number;
  signer: string;
  region: string;
  consent_at: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  reviewer: string | null;
  review_note: string;
  created_at: string;
  reviewed_at: string | null;
  term_labels?: Partial<Record<Lang, string>>;
  lesson_title?: string;
}

export interface SignTerm {
  id: number;
  labels: Partial<Record<Lang, string>>;
  clips: SignVideo[]; // approved signs; more than one = regional variants
  pending: number;
  source?: "ai" | "teacher";
  lessons?: string[];
}

export interface SignReference {
  bn: string;
  en: string;
  section: string;
  source: string;
}

export interface LessonSigns {
  lesson_id: number;
  terms: SignTerm[];
  signed: number;
  interpreter: SignVideo | null;
  pending_interpreter: SignVideo[];
  ai: boolean;
  reference: Record<string, SignReference[]>;
}

export interface MissingSign extends SignTerm {
  reference: SignReference[];
}

export const signMediaUrl = (file: string) => `${apiBase()}/api/sign/media/${file}`;

// The label to show for a term: the learner's language first.
export function termLabel(t: { labels: Partial<Record<Lang, string>> }, lang: Lang): string {
  return t.labels[lang] ?? t.labels.en ?? t.labels.bn ?? t.labels.ms ?? "";
}

export const getLessonSigns = (lessonId: number) => request<LessonSigns>(`/api/sign/lessons/${lessonId}`);
export const extractLessonTerms = (lessonId: number) => post<LessonSigns>(`/api/sign/lessons/${lessonId}/terms/extract`, {});
export const addLessonTerm = (lessonId: number, labels: Partial<Record<Lang, string>>) =>
  post<LessonSigns>(`/api/sign/lessons/${lessonId}/terms`, { labels });
export const removeLessonTerm = (lessonId: number, termId: number) =>
  request<void>(`/api/sign/lessons/${lessonId}/terms/${termId}`, { method: "DELETE" });
export const getSignLexicon = () => request<SignTerm[]>("/api/sign/lexicon");
export const getMissingSigns = () => request<MissingSign[]>("/api/sign/missing");
export const listSignVideos = (status: "pending" | "approved" | "rejected" = "pending") =>
  request<SignVideo[]>(`/api/sign/videos?status=${status}`);
export const signVideoCount = () => request<{ pending: number }>("/api/sign/videos/count").then((r) => r.pending);
export const approveSignVideo = (id: number, reviewer: string, note: string) =>
  post<SignVideo>(`/api/sign/videos/${id}/approve`, { reviewer, note });
export const rejectSignVideo = (id: number, reviewer: string, note: string) =>
  post<SignVideo>(`/api/sign/videos/${id}/reject`, { reviewer, note });
export const withdrawSignVideo = (id: number) => post<SignVideo>(`/api/sign/videos/${id}/withdraw`, {});

export interface SignUpload {
  kind: "term" | "lesson";
  termId?: number;
  lessonId?: number;
  signer: string;
  region: string;
  consent: boolean;
  video: Blob;
}
export function uploadSignVideo(u: SignUpload): Promise<SignVideo> {
  const form = new FormData();
  form.set("kind", u.kind);
  if (u.termId) form.set("term_id", String(u.termId));
  if (u.lessonId) form.set("lesson_id", String(u.lessonId));
  form.set("signer", u.signer);
  form.set("region", u.region);
  form.set("consent", u.consent ? "yes" : "no");
  const ext = u.video.type.includes("mp4") ? "mp4" : "webm";
  form.set("video", u.video, `sign.${ext}`);
  return upload<SignVideo>("/api/sign/videos", form);
}

// ---- Sign recognition (docs/sign-recognition-plan.md) ----

export const getLetterTemplates = () => request<LetterTemplate[]>("/api/sign/templates?section=Letters");
export const getWordTemplates = (words: string[]) =>
  request<WordTemplate[]>(`/api/sign/templates?words=${encodeURIComponent(words.join(","))}`);

export interface SampleFrame {
  t: number;
  hands: { side: "right" | "left"; points: [number, number, number][] }[];
  body?: [number, number, number][];
}
export interface NewSignSample {
  kind: "letter" | "word";
  label: string;
  signer: string;
  dominant: "right" | "left";
  deaf: boolean;
  consent: boolean;
  frames: SampleFrame[];
  features: number[][];
  feature_version: number;
}
export interface SignSampleInfo {
  id: number;
  kind: string;
  label: string;
  signer: string;
  dominant: "right" | "left";
  deaf: boolean;
  created_at: string;
}
export const saveSignSample = (s: NewSignSample) => post<SignSampleInfo>("/api/sign/samples", s);
export const listSignSamples = (kind = "letter") => request<SignSampleInfo[]>(`/api/sign/samples?kind=${kind}`);
export const deleteSignSample = (id: number) => request<void>(`/api/sign/samples/${id}`, { method: "DELETE" });
