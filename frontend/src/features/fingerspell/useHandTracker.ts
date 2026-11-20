"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { PointSmoother } from "@/lib/handsign/hand.ts";
import { createLandmarkers, readFrame, type Landmarkers, type TrackedHands } from "@/lib/handsign/mediapipe.ts";

export type { TrackedHands };

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
  const models = useRef<Landmarkers | null>(null);
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
      const lm = models.current;
      if (v && lm && v.readyState >= 2 && v.currentTime !== lastTime.current) {
        lastTime.current = v.currentTime;
        const { dominant, swapHands: swap } = opts.current;
        const f = readFrame(v, lm, performance.now(), { dominant, swapHands: swap });
        opts.current.onFrame({ ...f, dominant: smoothers.current.dominant.push(f.dominant), other: smoothers.current.other.push(f.other) });
      }
      raf.current = requestAnimationFrame(tick);
    };

    try {
      // Body tracking needs a model set that includes the pose model.
      if (!models.current || (withBody && !models.current.pose)) {
        models.current?.close();
        models.current = await createLandmarkers(withBody);
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
      models.current?.close();
      models.current = null;
    },
    [stop],
  );

  return { status, error, start, stop };
}
