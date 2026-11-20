"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import { mirror, PointSmoother, toSignerFrame, type HandPoints, type Vec } from "@/lib/handsign/hand.ts";
import { bodyFrom, mirrorBody, type Body } from "@/lib/handsign/body.ts";

// The hand model is Google's published MediaPipe hand landmarker. Only
// skeleton points leave this hook; video frames never leave the device.
const MODEL_URL =
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

export type TrackerStatus = "idle" | "loading" | "running" | "error";

interface Options {
  /** The signer's dominant hand. */
  dominant: "right" | "left";
  onFrame: (hands: TrackedHands) => void;
  /** Also track the body (face and shoulders), for where signs are made. */
  withBody?: boolean;
  /** Swap which hand is which, if the tracker gets them the wrong way round. */
  swapHands?: boolean;
}

/**
 * Opens the camera, runs MediaPipe hand tracking on each video frame and
 * reports both hands in the signer's frame. MediaPipe is given the
 * un-mirrored camera image, so its Left/Right labels are the signer's own
 * hands; only the preview on screen is mirrored.
 */
export function useHandTracker(videoRef: RefObject<HTMLVideoElement | null>, { dominant, onFrame, withBody = false, swapHands = false }: Options) {
  const [status, setStatus] = useState<TrackerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const landmarker = useRef<HandLandmarker | null>(null);
  const poser = useRef<PoseLandmarker | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef<number | null>(null);
  const lastTime = useRef(-1);
  // Smooths each hand over time, so jitter does not read as a bending finger.
  const smoothers = useRef({ dominant: new PointSmoother(0.5), other: new PointSmoother(0.5) });
  const opts = useRef({ dominant, onFrame, swapHands });

  useEffect(() => {
    opts.current = { dominant, onFrame, swapHands };
  }, [dominant, onFrame, swapHands]);

  const stop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
    setStatus("idle");
  }, [videoRef]);

  const start = useCallback(async () => {
    setError(null);
    setStatus("loading");
    const tick = () => {
      const v = videoRef.current;
      const lm = landmarker.current;
      if (v && lm && v.readyState >= 2 && v.currentTime !== lastTime.current) {
        lastTime.current = v.currentTime;
        const now = performance.now();
        const res = lm.detectForVideo(v, now);
        const aspect = v.videoWidth / Math.max(v.videoHeight, 1);
        const { dominant: dom, swapHands: swap } = opts.current;
        const pose = poser.current?.detectForVideo(v, now).landmarks[0] ?? null;
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
        if (swap) for (const h of hands) h.side = h.side === "left" ? "right" : h.side === "right" ? "left" : "";
        const domHand = hands.find((h) => h.side === dom) ?? null;
        const otherHand = hands.find((h) => h !== domHand) ?? null;
        const conv = (h: typeof domHand) => {
          if (!h) return null;
          const pts = toSignerFrame(h.points, aspect);
          return dom === "left" ? mirror(pts) : pts;
        };
        let bodyPoints: Vec[] | null = null;
        if (pose) {
          const pts = toSignerFrame(pose, aspect);
          bodyPoints = dom === "left" ? mirrorBody(pts) : pts;
        }
        opts.current.onFrame({
          dominant: smoothers.current.dominant.push(conv(domHand)),
          other: smoothers.current.other.push(conv(otherHand)),
          body: bodyPoints ? bodyFrom(bodyPoints) : null,
          bodyPoints,
          image: hands.map((h) => ({ points: h.points, dominant: h === domHand })),
          imageBody: pose,
          sides: hands.filter((h) => h.side).map((h) => ({ side: h.side as "left" | "right", label: h.label, by: h.by })),
          t: now,
        });
      }
      raf.current = requestAnimationFrame(tick);
    };

    try {
      if (!landmarker.current) {
        const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
        landmarker.current = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      }
      if (withBody && !poser.current) {
        const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
        poser.current = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      }
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 960, height: 540, facingMode: "user" }, audio: false });
      stream.current = s;
      const v = videoRef.current;
      if (!v) throw new Error("no video element");
      v.srcObject = s;
      await v.play();
      setStatus("running");
      raf.current = requestAnimationFrame(tick);
    } catch (e) {
      stop();
      setStatus("error");
      const msg = (e as Error).message || String(e);
      setError(
        /permission|denied|notallowed/i.test(msg)
          ? "Camera permission is needed to see your hands."
          : /device|notfound|requested/i.test(msg)
            ? "No camera was found on this device."
            : `Hand tracking could not start: ${msg}`,
      );
    }
  }, [stop, videoRef, withBody]);

  useEffect(
    () => () => {
      stop();
      landmarker.current?.close();
      landmarker.current = null;
      poser.current?.close();
      poser.current = null;
    },
    [stop],
  );

  return { status, error, start, stop };
}
