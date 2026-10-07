import { P } from '../palette';
import type { ShotSound } from './audio';
import type { WeaponId } from './sprites';

export type ShotKind = 'bullet' | 'rocket' | 'grenade';

export interface Weapon {
  id: WeaponId;
  /** Seconds between shots. */
  cooldown: number;
  kind: ShotKind | 'laser';
  pellets: number;
  /** Spread in radians: random per shot, or an even fan when `fan` is set. */
  spread: number;
  fan?: boolean;
  /** Cells per second. */
  speed: number;
  /** Carve radius in cells. */
  radius: number;
  /** Seconds a projectile lives. */
  life: number;
  color: string;
  /** How the projectile is drawn. */
  look?: 'dot' | 'ball';
  recoil: number;
  shake: number;
  /** Camera kick against the aim, in CSS px. */
  kick: number;
  sound?: ShotSound;
}

// The classic run-and-gun arsenal: rifle, machine gun, spread, plus rockets and a laser for wrecking pages.
export const WEAPONS: Weapon[] = [
  { id: 'rifle', cooldown: 0.13, kind: 'bullet', pellets: 1, spread: 0.01, speed: 820, radius: 4.5, life: 1, color: P.white, look: 'dot', recoil: 0, shake: 1.5, kick: 2, sound: 'blaster' },
  { id: 'machine', cooldown: 0.06, kind: 'bullet', pellets: 1, spread: 0.06, speed: 880, radius: 3.4, life: 1, color: P.white, look: 'dot', recoil: 0, shake: 1, kick: 1.2, sound: 'smg' },
  { id: 'spread', cooldown: 0.3, kind: 'bullet', pellets: 7, spread: 0.38, fan: true, speed: 600, radius: 3.8, life: 0.9, color: P.red, look: 'ball', recoil: 30, shake: 4, kick: 5, sound: 'shotgun' },
  { id: 'rocket', cooldown: 0.65, kind: 'rocket', pellets: 1, spread: 0, speed: 320, radius: 24, life: 3, color: P.red, recoil: 45, shake: 4, kick: 7, sound: 'rocket' },
  { id: 'laser', cooldown: 1 / 60, kind: 'laser', pellets: 1, spread: 0, speed: 0, radius: 3.2, life: 0, color: P.pink, recoil: 0, shake: 0.8, kick: 0.25 },
];

export const GRENADE = { cooldown: 0.45, speed: 300, fuse: 1.3, radius: 28 };
