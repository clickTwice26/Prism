"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { mirror, toSignerFrame, type HandPoints } from "@/lib/handsign/hand.ts";

// The hand model is Google's published MediaPipe hand landmarker. Only
// skeleton points leave this hook; video frames never leave the device.
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const WASM_PATH = "/mediapipe/wasm";

export interface TrackedHands {
  /** Points in the signer's frame. For left-handed signers both hands are mirrored, so "dominant" is always written as a right hand. */
  dominant: HandPoints | null;
  other: HandPoints | null;
  /** Raw image points (0-1) for drawing the skeleton over the video. */
  image: { points: { x: number; y: number }[]; dominant: boolean }[];
  t: number;
}

export type TrackerStatus = "idle" | "loading" | "running" | "error";

interface Options {
  /** The signer's dominant hand. */
  dominant: "right" | "left";
  onFrame: (hands: TrackedHands) => void;
}

/**
 * Opens the camera, runs MediaPipe hand tracking on each video frame and
 * reports both hands in the signer's frame. MediaPipe is given the
 * un-mirrored camera image, so its Left/Right labels are the signer's own
 * hands; only the preview on screen is mirrored.
 */
export function useHandTracker(videoRef: RefObject<HTMLVideoElement | null>, { dominant, onFrame }: Options) {
  const [status, setStatus] = useState<TrackerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const landmarker = useRef<HandLandmarker | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef<number | null>(null);
  const lastTime = useRef(-1);
  const opts = useRef({ dominant, onFrame });

  useEffect(() => {
    opts.current = { dominant, onFrame };
  }, [dominant, onFrame]);

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
        const res = lm.detectForVideo(v, performance.now());
        const aspect = v.videoWidth / Math.max(v.videoHeight, 1);
        const { dominant: dom } = opts.current;
        const hands = res.landmarks.map((points, i) => ({
          points,
          side: (res.handedness[i]?.[0]?.categoryName ?? "").toLowerCase() as "left" | "right" | "",
        }));
        // When both hands get the same label (it happens when they touch), split them by position:
        // the signer's right hand is on the image's left.
        if (hands.length === 2 && hands[0].side === hands[1].side) {
          const [a, b] = hands;
          const aRight = a.points[0].x < b.points[0].x;
          a.side = aRight ? "right" : "left";
          b.side = aRight ? "left" : "right";
        }
        const domHand = hands.find((h) => h.side === dom) ?? null;
        const otherHand = hands.find((h) => h !== domHand) ?? null;
        const conv = (h: typeof domHand) => {
          if (!h) return null;
          const pts = toSignerFrame(h.points, aspect);
          return dom === "left" ? mirror(pts) : pts;
        };
        opts.current.onFrame({
          dominant: conv(domHand),
          other: conv(otherHand),
          image: hands.map((h) => ({ points: h.points, dominant: h === domHand })),
          t: performance.now(),
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
  }, [stop, videoRef]);

  useEffect(
    () => () => {
      stop();
      landmarker.current?.close();
      landmarker.current = null;
    },
    [stop],
  );

  return { status, error, start, stop };
}
