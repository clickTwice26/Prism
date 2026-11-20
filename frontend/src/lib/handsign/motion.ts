// Turns a sign description into an expected path: a few keyframes, each with
// where each hand should be on the body (2D, in shoulder widths) and its
// shape and direction. A live signing is then aligned against these keyframes
// in time (words.ts). See docs/sign-recognition-plan.md.

import { dirVector } from "./hand.ts";
import { sitePosition, type Body, type Vec2 } from "./body.ts";

// ---- the parts of /api/sign/templates this file reads ----
export interface PoseT {
  shape?: string;
  thumb?: string;
  bend?: string;
  ext?: string;
  palm?: string;
}
export interface LocationT {
  site?: string;
  nondominant_site?: string;
  side?: string;
  contact?: string;
  dominant?: string[];
  nondominant?: string[];
}
export interface ActionT {
  kind: string;
  dir?: string;
  size?: string;
  contact?: string;
  target?: LocationT;
  to?: PoseT;
  to_nondominant?: PoseT;
  together?: ActionT[];
}
export interface SignT {
  hands: string;
  dominant: PoseT;
  nondominant?: PoseT;
  location: LocationT;
  actions: ActionT[];
  repeat?: string;
}
export interface WordTemplate {
  id: string;
  bn: string;
  en?: string;
  section?: string;
  signs: SignT[];
}

export interface Keyframe {
  sign: number; // which sign of the word
  kind: "start" | "move" | "change" | "wiggle";
  dom: Vec2;
  other: Vec2 | null; // null: one-handed
  pose: PoseT;
  otherPose: PoseT | null;
  /** Point of the signing hand placed at the location (e.g. ["fingertip", "index"]); empty = palm centre. */
  point: string[];
  /** Whether the other hand moves with the signing hand (symmetric signs) or stays put. */
  otherFollows: "mirror" | "parallel" | "still";
}

const SIZE: Record<string, number> = { small: 0.22, large: 0.7 };
const STEP = 0.42;

const plus = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
const same = (a: Keyframe, b: Keyframe) =>
  Math.hypot(a.dom[0] - b.dom[0], a.dom[1] - b.dom[1]) < 0.05 && JSON.stringify(a.pose) === JSON.stringify(b.pose);

/** The 2D movement for a direction code, in shoulder widths. Movement toward or away from the camera barely shows. */
function displacement(dir: string | undefined, size: string | undefined): Vec2 {
  const v = dir ? dirVector(dir) : null;
  if (!v) return [0, 0];
  const k = SIZE[size ?? ""] ?? STEP;
  return [v[0] * k, v[1] * k];
}

const mergePose = (p: PoseT, to?: PoseT): PoseT => (to ? { ...p, ...Object.fromEntries(Object.entries(to).filter(([, v]) => v)) } : p);

/** Keyframes for one sign of a word, given the signer's body. */
function signKeyframes(sign: SignT, index: number, body: Body): Keyframe[] {
  const loc = sign.location;
  const twoHands = sign.hands !== "one" && sign.hands !== "nondominant";
  const follows: Keyframe["otherFollows"] = sign.hands === "two_mirror" ? "mirror" : sign.hands === "two_parallel" ? "parallel" : "still";
  const start = sitePosition(body, loc.site, loc.side);
  let other: Vec2 | null = null;
  if (twoHands) {
    if (loc.nondominant_site) other = sitePosition(body, loc.nondominant_site);
    else if ((loc.dominant?.length ?? 0) > 0 && (loc.nondominant?.length ?? 0) > 0) other = start; // the hands touch
    else if (follows === "mirror") other = [-start[0], start[1]];
    else other = [start[0] - 0.45, start[1]];
  }
  const first: Keyframe = {
    sign: index,
    kind: "start",
    dom: start,
    other,
    pose: sign.dominant,
    otherPose: twoHands ? (sign.nondominant ?? sign.dominant) : null,
    point: loc.dominant ?? [],
    otherFollows: follows,
  };

  // One pass over the actions, appending keyframes.
  const run = (from: Keyframe, actions: ActionT[]): Keyframe[] => {
    const out: Keyframe[] = [];
    let cur = from;
    const step = (d: Vec2, kind: Keyframe["kind"], pose?: PoseT, otherPose?: PoseT) => {
      const otherD: Vec2 = cur.otherFollows === "mirror" ? [-d[0], d[1]] : cur.otherFollows === "parallel" ? d : [0, 0];
      cur = {
        ...cur,
        kind,
        dom: plus(cur.dom, d),
        other: cur.other ? plus(cur.other, otherD) : null,
        pose: mergePose(cur.pose, pose),
        otherPose: cur.otherPose ? mergePose(cur.otherPose, otherPose) : null,
      };
      out.push(cur);
    };
    for (const a of actions) {
      const all = [a, ...(a.together ?? [])];
      const to = all.find((x) => x.to)?.to;
      const toOther = all.find((x) => x.to_nondominant)?.to_nondominant;
      const mover = all.find((x) => ["move", "arc"].includes(x.kind));
      const circle = all.find((x) => x.kind === "circle" || x.kind === "ellipse");
      const wiggle = all.find((x) => ["fingerplay", "swinging", "nodding", "twisting", "wavy", "zigzag", "stir"].includes(x.kind));
      if (mover) {
        let d = displacement(mover.dir, mover.size);
        if (mover.target?.site) {
          const t = sitePosition(body, mover.target.site, mover.target.side);
          d = [t[0] - cur.dom[0], t[1] - cur.dom[1]];
        }
        if (mover.kind === "arc") {
          // Bow out halfway, perpendicular to the movement.
          const bow: Vec2 = [-d[1] * 0.3, d[0] * 0.3];
          step([d[0] / 2 + bow[0], d[1] / 2 + bow[1]], "move");
          step([d[0] / 2 - bow[0], d[1] / 2 - bow[1]], "move", to, toOther);
        } else {
          step(d, "move", to, toOther);
        }
      } else if (circle) {
        const r = SIZE[circle.size ?? ""] ? SIZE[circle.size!] * 0.5 : 0.18;
        for (const [dx, dy] of [[r, r], [r, -r], [-r, -r], [-r, r]] as Vec2[]) step([dx, dy], "move", to, toOther);
      } else if (wiggle) {
        step([0.08, 0], "wiggle", to, toOther);
        step([-0.16, 0], "wiggle");
        step([0.08, 0], "wiggle");
      } else if (to || toOther) {
        step([0, 0], "change", to, toOther);
      }
      // "hold" adds nothing: the hand stays where it is.
    }
    return out;
  };

  let frames = [first, ...run(first, sign.actions)];
  const body1 = frames.slice(1);
  if (sign.repeat === "again" || sign.repeat === "several") {
    const times = sign.repeat === "several" ? 2 : 1;
    for (let i = 0; i < times; i++) frames = [...frames, first, ...body1];
  } else if (sign.repeat === "reverse" && body1.length) {
    frames = [...frames, ...[...frames].reverse().slice(1)];
  }
  // Drop keyframes that do not change anything.
  return frames.filter((k, i) => i === 0 || !same(k, frames[i - 1]));
}

/** Keyframes for every sign of a word, in order. */
export function wordKeyframes(word: WordTemplate, body: Body): Keyframe[] {
  return word.signs.flatMap((s, i) => signKeyframes(s, i, body));
}
