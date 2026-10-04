import { P } from '../palette';
import type { Level } from './level';
import type { Pose, Sprites } from './sprites';

/** Enemy hitbox in cells: same body as the hero. */
export const EW = 10;
export const EH = 23;

const GRAVITY = 620;
const MAX_FALL = 420;
const RUN = 72;
const JUMP = 235;
const STEP_UP = 6;
const SHOT_SPEED = 175;
const MAX_ALIVE = 7;

export type EnemyKind = 'runner' | 'sniper';

export interface Enemy {
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  grounded: boolean;
  hp: number;
  fireT: number;
  burst: number;
  pauseT: number;
  hitT: number;
  /** Seconds since spawn; used for the spawn-in shimmer and animation. */
  age: number;
  offscreenT: number;
}

export interface EnemyShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface EnemyWorld {
  level: Level;
  /** Player center in cells, or null while respawning. */
  target: { x: number; y: number } | null;
  /** Camera view in cells. */
  view: { x0: number; y0: number; x1: number; y1: number };
  /** 0..1, ramps spawn rate and aggression. */
  heat: number;
}

export interface EnemyEvents {
  shoot(x: number, y: number): void;
  spawn(e: Enemy): void;
  shotBlocked(x: number, y: number): void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Enemies {
  list: Enemy[] = [];
  shots: EnemyShot[] = [];
  private spawnT = 5;

  constructor(private readonly events: EnemyEvents) {}

  clear(): void {
    this.list = [];
    this.shots = [];
    this.spawnT = 5;
  }

  update(dt: number, w: EnemyWorld): void {
    this.spawnT -= dt;
    const cap = Math.round(3 + w.heat * (MAX_ALIVE - 3));
    if (this.spawnT <= 0 && w.target) {
      this.spawnT = rand(2.6, 4) - w.heat * 1.6;
      if (this.list.length < cap) this.spawn(w);
    }
    for (const e of this.list) this.think(e, dt, w);
    this.list = this.list.filter((e) => e.hp > 0 && e.offscreenT < 6 && e.y < w.level.h);
    this.updateShots(dt, w);
  }

  /** The enemy whose body contains this point, if any. */
  at(x: number, y: number): Enemy | null {
    for (const e of this.list) if (x >= e.x && x <= e.x + EW && y >= e.y && y <= e.y + EH) return e;
    return null;
  }

  within(x: number, y: number, r: number): Enemy[] {
    return this.list.filter((e) => Math.hypot(e.x + EW / 2 - x, e.y + EH / 2 - y) < r + EW / 2);
  }

  /** Enemy shots that touch a box are consumed and reported. */
  hits(x: number, y: number, w: number, h: number): boolean {
    let hit = false;
    this.shots = this.shots.filter((s) => {
      const inside = s.x >= x && s.x <= x + w && s.y >= y && s.y <= y + h;
      hit ||= inside;
      return !inside;
    });
    return hit;
  }

  private spawn(w: EnemyWorld): void {
    const { level: L, view, target } = w;
    const t = target!;
    const sniper = Math.random() < 0.25 + w.heat * 0.15;
    if (sniper) {
      // Pop up on something solid in view, a fair distance from the player.
      for (let tries = 0; tries < 30; tries++) {
        const x = Math.floor(rand(Math.max(0, view.x0 + 10), Math.min(L.w - EW, view.x1 - EW - 10)));
        if (Math.abs(x - t.x) < 100) continue;
        const y = this.groundBelow(L, x, Math.max(0, Math.floor(view.y0 + 20)), Math.floor(view.y1 - EH));
        if (y !== null) return this.add('sniper', x, y, t);
      }
    }
    // Runners charge in from a side of the screen, at about the player's height.
    const left = Math.random() < 0.5;
    const x = left ? Math.max(0, Math.floor(view.x0) - EW) : Math.min(L.w - EW, Math.floor(view.x1) + 1);
    const y = this.groundBelow(L, x, Math.floor(t.y - 50), Math.floor(t.y + 60));
    // Nowhere to stand at that height: drop in from the top of the screen instead.
    this.add('runner', y === null ? Math.floor(rand(view.x0 + 20, view.x1 - EW - 20)) : x, y ?? Math.floor(view.y0) - EH, t);
  }

  private groundBelow(L: Level, x: number, y0: number, y1: number): number | null {
    for (let y = y0; y <= y1; y++) if (!L.boxHits(x, y, EW, EH) && L.boxHits(x, y + 1, EW, EH)) return y;
    return null;
  }

  private add(kind: EnemyKind, x: number, y: number, t: { x: number; y: number }): void {
    const e: Enemy = {
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      facing: t.x > x ? 1 : -1,
      grounded: false,
      hp: kind === 'sniper' ? 3 : 1,
      fireT: kind === 'sniper' ? 1.6 : rand(1.6, 2.6),
      burst: 0,
      pauseT: 0,
      hitT: 0,
      age: 0,
      offscreenT: 0,
    };
    this.list.push(e);
    this.events.spawn(e);
  }

  private think(e: Enemy, dt: number, w: EnemyWorld): void {
    const L = w.level;
    e.age += dt;
    e.hitT = Math.max(0, e.hitT - dt);
    e.pauseT -= dt;
    e.fireT -= dt;
    const t = w.target;
    if (t) e.facing = t.x > e.x + EW / 2 ? 1 : -1;

    const inView = e.x + EW > w.view.x0 && e.x < w.view.x1 && e.y + EH > w.view.y0 && e.y < w.view.y1;
    e.offscreenT = inView ? 0 : e.offscreenT + dt;

    if (e.kind === 'runner') {
      const target = e.pauseT > 0 || !t ? 0 : e.facing * RUN * (1 + w.heat * 0.3);
      e.vx += Math.sign(target - e.vx) * Math.min(Math.abs(target - e.vx), 900 * dt);
      if (t && e.fireT <= 0 && inView && Math.abs(t.y - (e.y + EH / 2)) < 30 && Math.abs(t.x - e.x) < 300) {
        this.fire(e, t, 0.15);
        e.fireT = rand(2.2, 3.6) - w.heat * 0.8;
        e.pauseT = 0.35;
      }
    } else if (t && e.fireT <= 0 && inView) {
      // Snipers fire short bursts that grow to three rounds as the page heats up.
      const rounds = w.heat < 0.35 ? 2 : 3;
      this.fire(e, t, 0.05);
      e.burst++;
      e.fireT = e.burst % rounds === 0 ? 2.8 - w.heat * 0.8 : 0.18;
    }

    e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
    const blocked = this.moveX(e, e.vx * dt, L);
    if (blocked && e.grounded && e.kind === 'runner') e.vy = -JUMP;
    this.moveY(e, e.vy * dt, L);
    e.grounded = e.vy >= 0 && L.boxHits(e.x, e.y + 1, EW, EH);
  }

  private fire(e: Enemy, t: { x: number; y: number }, wobble: number): void {
    const ox = e.x + EW / 2 + e.facing * 9;
    const oy = e.y + 11;
    const a = Math.atan2(t.y - oy, t.x - ox) + rand(-wobble, wobble);
    this.shots.push({ x: ox, y: oy, vx: Math.cos(a) * SHOT_SPEED, vy: Math.sin(a) * SHOT_SPEED, life: 4 });
    this.events.shoot(ox, oy);
  }

  private moveX(e: Enemy, dx: number, L: Level): boolean {
    let rem = dx;
    while (Math.abs(rem) > 1e-6) {
      const step = Math.max(-1, Math.min(1, rem));
      rem -= step;
      const nx = Math.max(0, Math.min(L.w - EW, e.x + step));
      if (!L.boxHits(nx, e.y, EW, EH)) {
        e.x = nx;
        continue;
      }
      let climbed = false;
      for (let up = 1; up <= STEP_UP && e.vy >= 0; up++) {
        if (!L.boxHits(nx, e.y - up, EW, EH)) {
          e.x = nx;
          e.y -= up;
          climbed = true;
          break;
        }
      }
      if (!climbed) {
        e.vx = 0;
        return true;
      }
    }
    return false;
  }

  private moveY(e: Enemy, dy: number, L: Level): void {
    let rem = dy;
    while (Math.abs(rem) > 1e-6) {
      const step = Math.max(-1, Math.min(1, rem));
      rem -= step;
      if (L.boxHits(e.x, e.y + step, EW, EH)) {
        e.vy = 0;
        return;
      }
      e.y += step;
    }
  }

  private updateShots(dt: number, w: EnemyWorld): void {
    this.shots = this.shots.filter((s) => {
      s.life -= dt;
      const nx = s.x + s.vx * dt;
      const ny = s.y + s.vy * dt;
      if (w.level.solidAt(Math.floor(nx), Math.floor(ny))) {
        this.events.shotBlocked(s.x, s.y);
        return false;
      }
      s.x = nx;
      s.y = ny;
      return s.life > 0;
    });
  }

  draw(ctx: CanvasRenderingContext2D, sprites: Sprites, cell: number, camX: number, camY: number, time: number): void {
    for (const e of this.list) {
      const moving = Math.abs(e.vx) > 8;
      const runCycle: Pose[] = ['run1', 'run2', 'run3', 'run2'];
      const pose: Pose = !e.grounded ? 'air' : moving ? runCycle[Math.floor(e.age * 10) % 4] : 'stand';
      const img = sprites.soldier[pose][e.facing > 0 ? 'right' : 'left'];
      const x = Math.round((e.x - 3) * cell - camX);
      const y = Math.round((e.y - 1) * cell - camY);
      ctx.save();
      // Spawn shimmer, then a white flash whenever they take a hit.
      if (e.age < 0.35) ctx.globalAlpha = Math.floor(e.age * 30) % 2 ? 0.3 : 1;
      if (e.hitT > 0) ctx.filter = 'brightness(4)';
      ctx.drawImage(img, x, y, img.width * cell, img.height * cell);
      const gun = sprites.weapons.rifle.up;
      ctx.translate(Math.round((e.x + EW / 2) * cell - camX), Math.round((e.y + 11) * cell - camY));
      if (e.facing < 0) ctx.scale(-1, 1);
      ctx.drawImage(gun, -6 * cell, -3 * cell, gun.width * cell * 0.75, gun.height * cell * 0.75);
      ctx.restore();
    }
    // Enemy bullets: blinking red/white pellets.
    const blink = Math.floor(time * 16) % 2;
    for (const s of this.shots) {
      const x = Math.round(s.x * cell - camX);
      const y = Math.round(s.y * cell - camY);
      ctx.fillStyle = P.black;
      ctx.fillRect(x - cell * 2, y - cell * 2, cell * 4, cell * 4);
      ctx.fillStyle = blink ? P.red : P.white;
      ctx.fillRect(x - cell * 1.5, y - cell * 1.5, cell * 3, cell * 3);
      ctx.fillStyle = blink ? P.white : P.red;
      ctx.fillRect(x - cell * 0.5, y - cell * 0.5, cell, cell);
    }
  }
}
