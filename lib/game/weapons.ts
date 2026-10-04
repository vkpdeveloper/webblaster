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
  /** Random spread in radians. */
  spread: number;
  /** Cells per second. */
  speed: number;
  /** Carve radius in cells. */
  radius: number;
  /** Seconds a projectile lives. */
  life: number;
  color: string;
  recoil: number;
  shake: number;
  sound?: ShotSound;
}

export const WEAPONS: Weapon[] = [
  { id: 'blaster', cooldown: 0.16, kind: 'bullet', pellets: 1, spread: 0.02, speed: 720, radius: 4, life: 1, color: P.yellow, recoil: 0, shake: 1, sound: 'blaster' },
  { id: 'smg', cooldown: 0.055, kind: 'bullet', pellets: 1, spread: 0.09, speed: 780, radius: 3, life: 1, color: P.orange, recoil: 0, shake: 0.6, sound: 'smg' },
  { id: 'shotgun', cooldown: 0.65, kind: 'bullet', pellets: 8, spread: 0.3, speed: 620, radius: 3.6, life: 0.32, color: P.peach, recoil: 70, shake: 5, sound: 'shotgun' },
  { id: 'rocket', cooldown: 0.8, kind: 'rocket', pellets: 1, spread: 0, speed: 280, radius: 24, life: 3, color: P.red, recoil: 45, shake: 3, sound: 'rocket' },
  { id: 'laser', cooldown: 1 / 60, kind: 'laser', pellets: 1, spread: 0, speed: 0, radius: 3.2, life: 0, color: P.pink, recoil: 0, shake: 0.4 },
];

export const GRENADE = { cooldown: 0.45, speed: 300, fuse: 1.3, radius: 28 };
