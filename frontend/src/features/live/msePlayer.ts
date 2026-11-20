// Plays a live WebM stream, received as chunks over the class WebSocket, in a
// <video> element through Media Source Extensions. A class can carry two
// streams (the teacher's video and the sign interpreter), each with a player.

import type { RefObject } from "react";

export class MsePlayer {
  private ms: MediaSource | null = null;
  private sb: SourceBuffer | null = null;
  private queue: ArrayBuffer[] = [];

  constructor(private ref: RefObject<HTMLVideoElement | null>) {}

  private video(): HTMLVideoElement | null {
    return this.ref.current;
  }

  static supported(mime: string): boolean {
    return typeof MediaSource !== "undefined" && MediaSource.isTypeSupported(mime);
  }

  /** Returns false when this browser cannot play the stream. */
  start(mime: string): boolean {
    this.stop();
    if (!MsePlayer.supported(mime)) return false;
    const ms = new MediaSource();
    this.ms = ms;
    const v = this.video();
    if (v) {
      v.src = URL.createObjectURL(ms);
      void v.play().catch(() => undefined);
    }
    ms.addEventListener(
      "sourceopen",
      () => {
        if (this.ms !== ms) return;
        const sb = ms.addSourceBuffer(mime);
        sb.mode = "sequence";
        sb.addEventListener("updateend", this.flush);
        this.sb = sb;
        this.flush();
      },
      { once: true },
    );
    return true;
  }

  push(chunk: ArrayBuffer): void {
    if (!this.ms) return;
    this.queue.push(chunk);
    this.flush();
  }

  private flush = () => {
    const sb = this.sb;
    if (!sb || sb.updating) return;
    const next = this.queue.shift();
    if (!next) return;
    try {
      sb.appendBuffer(next);
      // Stay close to live: jump ahead if playback falls behind.
      const v = this.video();
      if (v && v.buffered.length && v.buffered.end(v.buffered.length - 1) - v.currentTime > 3) {
        v.currentTime = v.buffered.end(v.buffered.length - 1) - 0.5;
      }
    } catch {
      /* drop a bad chunk and continue */
    }
  };

  stop(): void {
    this.queue = [];
    this.sb = null;
    const ms = this.ms;
    this.ms = null;
    try {
      if (ms?.readyState === "open") ms.endOfStream();
    } catch {
      /* ignore */
    }
    const v = this.video();
    if (v) {
      v.removeAttribute("src");
      v.load();
    }
  }
}

/** Server → client video frames start with a stream byte: 0 class, 1 sign. */
export function splitFrame(data: ArrayBuffer): { stream: "class" | "sign"; chunk: ArrayBuffer } {
  const stream = new Uint8Array(data, 0, 1)[0] === 1 ? "sign" : "class";
  return { stream, chunk: data.slice(1) };
}
