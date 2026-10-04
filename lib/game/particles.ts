import type { Level } from './level';

export enum Kind {
  Debris,
  Spark,
  Smoke,
  Fire,
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  kind: Kind;
}

const MAX = 3500;
const GRAVITY = 520;

export class Particles {
  list: Particle[] = [];

  add(p: Particle): void {
    if (this.list.length >= MAX) this.list.splice(0, 200);
    this.list.push(p);
  }

  burst(x: number, y: number, n: number, kind: Kind, colors: readonly string[], speed: number, life: number, size = 1): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      const l = life * (0.5 + Math.random() * 0.5);
      this.add({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - (kind === Kind.Debris ? speed * 0.4 : 0),
        life: l,
        max: l,
        color: colors[(Math.random() * colors.length) | 0],
        size,
        kind,
      });
    }
  }

  update(dt: number, level: Level): void {
    const list = this.list;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      switch (p.kind) {
        case Kind.Debris: {
          p.vy += GRAVITY * dt;
          const nx = p.x + p.vx * dt;
          const ny = p.y + p.vy * dt;
          if (level.solidAt(nx | 0, ny | 0)) {
            if (level.solidAt(nx | 0, p.y | 0)) p.vx *= -0.4;
            else p.x = nx;
            p.vy *= -0.3;
            p.vx *= 0.7;
          } else {
            p.x = nx;
            p.y = ny;
          }
          break;
        }
        case Kind.Spark:
          p.vy += GRAVITY * 0.5 * dt;
          p.vx *= 0.96;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          break;
        case Kind.Smoke:
          p.vy -= 25 * dt;
          p.vx *= 0.97;
          p.vy *= 0.97;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.size += dt * 3;
          break;
        case Kind.Fire:
          p.vx *= 0.9;
          p.vy = p.vy * 0.9 - 40 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          break;
      }
      list[w++] = p;
    }
    list.length = w;
  }

  draw(ctx: CanvasRenderingContext2D, cell: number, camX: number, camY: number, vw: number, vh: number): void {
    for (const p of this.list) {
      const s = Math.max(1, Math.round(p.size)) * cell;
      const x = Math.floor(p.x) * cell - camX - (s - cell) / 2;
      const y = Math.floor(p.y) * cell - camY - (s - cell) / 2;
      if (x < -s || y < -s || x > vw || y > vh) continue;
      const t = p.life / p.max;
      ctx.globalAlpha = p.kind === Kind.Smoke ? t * 0.7 : p.kind === Kind.Debris ? Math.min(1, t * 3) : 1;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(x), Math.round(y), s, s);
    }
    ctx.globalAlpha = 1;
  }
}
