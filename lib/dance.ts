import type { Pose } from './game/sprites';

/** Seconds per beat: the 109.25 BPM of public/music/dance.mp3, which is trimmed to start on a downbeat. */
export const BEAT = 60 / 109.25;
/** Beats per move before the routine moves on. */
const BAR = 8;

/** [shoulder, elbow] angles in degrees. 0 points the way he faces, 90 points down, -90 points up. */
export type Arm = readonly [number, number];

/** One instant of the dance. Offsets are in sprite pixels. */
export interface Step {
  legs: Pose;
  dx: number;
  dy: number;
  face: 1 | -1;
  /** The arm on the viewer's side of the body. */
  front: Arm;
  /** The arm behind the body. */
  back: Arm;
}

/** n full cycles per beat. */
const wave = (b: number, n: number) => Math.sin(b * Math.PI * 2 * n);
const odd = (n: number) => Math.floor(n) % 2 === 1;

const HIPS_FRONT: Arm = [40, 160];
const HIPS_BACK: Arm = [140, 20];

// A Bollywood breakdown in the spirit of Raj's on The Big Bang Theory: all the classic filmi moves, full commitment.
const ROUTINE: ((b: number) => Step)[] = [
  // Screw in the light bulb: both hands overhead twisting, hips swaying.
  (b) => ({
    legs: odd(b) ? 'run3' : 'stand',
    dx: Math.sin(b * Math.PI) * 2,
    dy: -Math.abs(Math.sin(b * Math.PI)),
    face: odd(b / 2) ? -1 : 1,
    front: [-70, -85 + wave(b, 2) * 25],
    back: [-110, -95 - wave(b, 2) * 25],
  }),
  // Hands on hips, shoulder shimmy, a hip pop on every half beat.
  (b) => ({
    legs: odd(b) ? 'run2' : 'stand',
    dx: wave(b, 3.5) * 0.8 + (odd(b) ? 1 : -1),
    dy: odd(b * 2) ? -1 : 0,
    face: b < BAR / 2 ? 1 : -1,
    front: HIPS_FRONT,
    back: HIPS_BACK,
  }),
  // Pat the dog, screw the bulb: one hand up twisting, the other patting low. Swap sides every two beats.
  (b) => {
    const swap = odd(b / 2);
    return {
      legs: odd(b) ? 'run1' : 'stand',
      dx: swap ? -2 : 2,
      dy: 0,
      face: swap ? -1 : 1,
      front: [-80, -80 + wave(b, 2) * 35],
      back: [150, 160 + wave(b, 2) * 30],
    };
  },
  // Bhangra: arms up in a V, shoulders bouncing, a hop on every beat.
  (b) => {
    const ph = b % 1;
    const bounce = wave(b, 2) * 15;
    return {
      legs: ph < 0.5 ? 'air' : 'run1',
      dx: 0,
      dy: -Math.sin(ph * Math.PI) * 4,
      face: odd(b) ? -1 : 1,
      front: [-50 + bounce, -70 + bounce],
      back: [-130 - bounce, -110 - bounce],
    };
  },
  // Spin with arms flung wide, then hit the pose: one finger to the sky, hand on hip.
  (b) =>
    b < 5
      ? { legs: 'run2', dx: 0, dy: 0, face: odd(b * 4) ? -1 : 1, front: [0, -10], back: [180, 190] }
      : { legs: 'run1', dx: 0, dy: -1, face: 1, front: [-55, -60], back: HIPS_BACK },
];

/** Where the dancer is `t` seconds into the routine. Loops forever. */
export function danceStep(t: number): Step {
  const beats = Math.max(0, t) / BEAT;
  const move = ROUTINE[Math.floor(beats / BAR) % ROUTINE.length];
  return move(beats % BAR);
}
