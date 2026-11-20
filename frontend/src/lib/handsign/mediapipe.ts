// Browser-only: runs MediaPipe hand and pose tracking on a video frame and
// turns the result into the signer's frame. Shared by the live camera
// (features/fingerspell/useHandTracker) and the clip checker (review
// assistant). Only skeleton points leave this module; frames never leave the
// device.

import type { HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import { mirror, toSignerFrame, type HandPoints, type Vec } from "./hand.ts";
import { bodyFrom, mirrorBody, type Body } from "./body.ts";

const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const WASM_PATH = "/mediapipe/wasm";

export interface TrackedHands {
  /** Points in the signer's frame. For left-handed signers both hands are mirrored, so "dominant" is always written as a right hand. */
  dominant: HandPoints | null;
  other: HandPoints | null;
  /** Body anchors (when body tracking is on), in the same frame as the hands. */
  body?: Body | null;
  /** Body points in the signer's frame, for recording samples. */
  bodyPoints?: Vec[] | null;
  /** Raw image points (0-1) for drawing the skeleton over the video. */
  image: { points: { x: number; y: number }[]; dominant: boolean }[];
  /** Raw image body points (0-1), for drawing. */
  imageBody?: { x: number; y: number }[] | null;
  /** How the signing hand was told apart from the other one, for the diagnostics panel. */
  sides?: { side: "left" | "right"; label: string; by: "body" | "model" | "position" }[];
  t: number;
}

export interface Landmarkers {
  hand: HandLandmarker;
  pose: PoseLandmarker | null;
  close: () => void;
}

/** Loads the hand model (and the pose model if asked). Each set has its own clock, so give each use its own set. */
export async function createLandmarkers(withBody: boolean): Promise<Landmarkers> {
  const { FilesetResolver, HandLandmarker, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
  const hand = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "GPU" },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  const pose = withBody
    ? await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      })
    : null;
  return {
    hand,
    pose,
    close: () => {
      hand.close();
      pose?.close();
    },
  };
}

/**
 * Tracks one video frame. timestamp must increase from call to call.
 * MediaPipe is given the un-mirrored image, so the body tracker's wrists say
 * which hand is the signer's left and right.
 */
export function readFrame(
  v: HTMLVideoElement,
  lm: Landmarkers,
  timestamp: number,
  { dominant, swapHands = false }: { dominant: "right" | "left"; swapHands?: boolean },
): TrackedHands {
  const res = lm.hand.detectForVideo(v, timestamp);
  const aspect = v.videoWidth / Math.max(v.videoHeight, 1);
  const pose = lm.pose?.detectForVideo(v, timestamp).landmarks[0] ?? null;
  const hands = res.landmarks.map((points, i) => {
    const label = res.handedness[i]?.[0]?.categoryName ?? "";
    return { points, label, side: label.toLowerCase() as "left" | "right" | "", by: "model" as "body" | "model" | "position" };
  });
  // Which hand is which. The body tracker knows the signer's left and right wrists, so when the
  // body is visible, each hand belongs to the nearer wrist; the hand model's own label is a fallback.
  if (pose) {
    const wrist = { left: pose[15], right: pose[16] };
    const d = (h: (typeof hands)[number], w: { x: number; y: number }) => Math.hypot(h.points[0].x - w.x, h.points[0].y - w.y);
    if (hands.length === 2) {
      const [a, b] = hands;
      const aLeft = d(a, wrist.left) + d(b, wrist.right) < d(a, wrist.right) + d(b, wrist.left);
      a.side = aLeft ? "left" : "right";
      b.side = aLeft ? "right" : "left";
      a.by = b.by = "body";
    } else if (hands.length === 1) {
      hands[0].side = d(hands[0], wrist.left) < d(hands[0], wrist.right) ? "left" : "right";
      hands[0].by = "body";
    }
  } else if (hands.length === 2 && hands[0].side === hands[1].side) {
    // Both hands got the same label (it happens when they touch): split them by position.
    // The signer's right hand is on the image's left.
    const [a, b] = hands;
    const aRight = a.points[0].x < b.points[0].x;
    a.side = aRight ? "right" : "left";
    b.side = aRight ? "left" : "right";
    a.by = b.by = "position";
  }
  if (swapHands) for (const h of hands) h.side = h.side === "left" ? "right" : h.side === "right" ? "left" : "";
  const domHand = hands.find((h) => h.side === dominant) ?? null;
  const otherHand = hands.find((h) => h !== domHand) ?? null;
  const conv = (h: typeof domHand) => {
    if (!h) return null;
    const pts = toSignerFrame(h.points, aspect);
    return dominant === "left" ? mirror(pts) : pts;
  };
  let bodyPoints: Vec[] | null = null;
  if (pose) {
    const pts = toSignerFrame(pose, aspect);
    bodyPoints = dominant === "left" ? mirrorBody(pts) : pts;
  }
  return {
    dominant: conv(domHand),
    other: conv(otherHand),
    body: bodyPoints ? bodyFrom(bodyPoints) : null,
    bodyPoints,
    image: hands.map((h) => ({ points: h.points, dominant: h === domHand })),
    imageBody: pose,
    sides: hands.filter((h) => h.side).map((h) => ({ side: h.side as "left" | "right", label: h.label, by: h.by })),
    t: timestamp,
  };
}

/**
 * Tracks a recorded video clip (e.g. a sign uploaded for review) at about fps
 * frames per second, by seeking through it. The clip must be served with
 * CORS so its pixels can be read.
 */
export async function trackClip(
  url: string,
  opts: { dominant?: "right" | "left"; withBody?: boolean; fps?: number; onProgress?: (done: number) => void } = {},
): Promise<TrackedHands[]> {
  const lm = await createLandmarkers(opts.withBody ?? true);
  const v = document.createElement("video");
  v.crossOrigin = "anonymous";
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  try {
    await new Promise<void>((ok, fail) => {
      v.onloadeddata = () => ok();
      v.onerror = () => fail(new Error("The video could not be loaded."));
    });
    // Some recorded WebM files report an unknown length until the end is reached.
    if (!Number.isFinite(v.duration)) {
      v.currentTime = 1e6;
      await new Promise((r) => (v.onseeked = r));
    }
    const duration = Number.isFinite(v.duration) ? v.duration : 5;
    const step = 1 / (opts.fps ?? 15);
    const frames: TrackedHands[] = [];
    let n = 0;
    for (let t = 0; t < duration; t += step) {
      v.currentTime = t;
      await new Promise((r) => (v.onseeked = r));
      frames.push(readFrame(v, lm, ++n * 40, { dominant: opts.dominant ?? "right" }));
      opts.onProgress?.(Math.min(1, t / duration));
    }
    return frames;
  } finally {
    lm.close();
    v.removeAttribute("src");
    v.load();
  }
}
