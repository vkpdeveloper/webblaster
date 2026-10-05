import { P } from './palette';
import { Sfx } from './game/audio';
import { SPRITE_H, SPRITE_W, Sprites, WEAPON_ART } from './game/sprites';

// The buttons the sidekick shoots for you on x.com. The Repost button only opens a menu, so he shoots the
// Repost / Undo repost / Quote item you pick in it instead.
const QUOTE = '[data-testid="Dropdown"] a[role="menuitem"][href*="/compose/"]';
const TARGETS = [
  ...['like', 'unlike', 'bookmark', 'removeBookmark', 'retweetConfirm', 'unretweetConfirm', 'tweetButton', 'tweetButtonInline'].map(
    (id) => `[data-testid="${id}"]`,
  ),
  QUOTE,
].join(',');

type Flavor = 'like' | 'bookmark' | 'repost' | 'post';

const flavorOf = (el: Element): Flavor => {
  const id = el.getAttribute('data-testid') ?? '';
  if (id.includes('like')) return 'like';
  if (id.toLowerCase().includes('bookmark')) return 'bookmark';
  if (id.includes('retweet') || el.matches(QUOTE)) return 'repost';
  return 'post';
};

/** Sprite pixels to CSS px. */
const S = 2;
const GUN = WEAPON_ART.rifle;
/** Feet-to-gun height in CSS px. */
const GUN_Y = 24;
const BULLET_SPEED = 3200;

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  img?: HTMLCanvasElement;
}

/**
 * A little run-and-gun commando that lives at the bottom of x.com. Click Like, Bookmark, Repost, Quote or Post
 * and he shoots the button from where he stands, and only then lets your click through.
 */
export class Sidekick {
  private readonly host: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sprites = new Sprites();
  private readonly sfx: Sfx;
  private vw = innerWidth;
  private vh = innerHeight;
  private dpr = devicePixelRatio || 1;

  // Feet position in viewport px.
  private x = 0;
  private y = 0;
  private facing = -1;
  private aimT = 0;
  private queue: { el: HTMLElement; flavor: Flavor }[] = [];
  private current: { el: HTMLElement; flavor: Flavor } | null = null;
  private bullet: { x: number; y: number; px: number; py: number } | null = null;
  private sparks: Spark[] = [];
  private booms: { x: number; y: number; scale: number; t: number }[] = [];
  private rings: { x: number; y: number; r: number; max: number; life: number; color: string }[] = [];
  private muzzleT = 0;
  private raf = 0;
  private last = 0;
  private readonly onClick = (e: MouseEvent) => this.intercept(e);
  private readonly onResize = () => this.resize();

  constructor(sound: boolean) {
    this.sfx = new Sfx(sound);
    this.host = document.createElement('web-blaster-sidekick');
    this.host.style.cssText =
      'position:fixed!important;inset:0!important;z-index:2147483646!important;pointer-events:none!important;display:block!important;';
    const shadow = this.host.attachShadow({ mode: 'closed' });
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;';
    shadow.append(this.canvas);
    document.documentElement.append(this.host);
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    [this.x, this.y] = this.home();
    // Capture phase on window runs before the page's own handlers.
    window.addEventListener('click', this.onClick, true);
    window.addEventListener('resize', this.onResize);
    this.wake();
  }

  setSound(on: boolean): void {
    this.sfx.setEnabled(on);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('click', this.onClick, true);
    window.removeEventListener('resize', this.onResize);
    this.sfx.close();
    this.host.remove();
  }

  private intercept(e: MouseEvent): void {
    // Our own replayed clicks are untrusted: let them through to the page.
    if (!e.isTrusted || window.__webBlaster) return;
    const el = (e.target as Element | null)?.closest?.(TARGETS) as HTMLElement | null;
    if (!el) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.sfx.resume();
    if (this.queue.length < 4 && this.current?.el !== el && !this.queue.some((q) => q.el === el)) {
      this.queue.push({ el, flavor: flavorOf(el) });
    }
    if (!this.current) this.next();
    this.wake();
  }

  private next(): void {
    this.current = this.queue.shift() ?? null;
    this.aimT = 0;
  }

  private home(): [number, number] {
    return [this.vw - 96, this.vh - 4];
  }

  /** Center of a button in viewport px, or null once it's gone. */
  private center(el: HTMLElement): { cx: number; cy: number } | null {
    if (!el.isConnected) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }

  private resize(): void {
    this.vw = innerWidth;
    this.vh = innerHeight;
    this.dpr = devicePixelRatio || 1;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    [this.x, this.y] = this.home();
    this.wake();
  }

  private wake(): void {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (t: number): void => {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.update(dt);
    this.draw();
    // Sleep once he's out of targets and the smoke has cleared.
    const settled = !this.current && !this.sparks.length && !this.booms.length && !this.rings.length && !this.bullet;
    this.raf = settled ? 0 : requestAnimationFrame(this.frame);
  };

  private update(dt: number): void {
    this.muzzleT -= dt;
    const cur = this.current;
    const spot = cur ? this.center(cur.el) : null;
    if (cur && !spot) {
      this.bullet = null;
      this.next();
    } else if (spot) {
      this.aimT += dt;
      this.facing = spot.cx > this.x ? 1 : -1;
      if (this.aimT > 0.08 && !this.bullet) this.fire(spot.cx, spot.cy);
    }

    if (this.bullet && cur && spot) {
      const b = this.bullet;
      b.px = b.x;
      b.py = b.y;
      const dx = spot.cx - b.x;
      const dy = spot.cy - b.y;
      const d = Math.hypot(dx, dy);
      const step = BULLET_SPEED * dt;
      if (d <= step) {
        this.bullet = null;
        this.hit(cur, spot.cx, spot.cy);
      } else {
        b.x += (dx / d) * step;
        b.y += (dy / d) * step;
      }
    }

    for (const p of this.sparks) {
      p.life -= dt;
      p.vy += 500 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.sparks = this.sparks.filter((p) => p.life > 0);
    for (const b of this.booms) b.t += dt;
    this.booms = this.booms.filter((b) => b.t < 0.42);
    for (const g of this.rings) {
      g.r += (g.max - g.r) * Math.min(1, dt * 12);
      g.life -= dt;
    }
    this.rings = this.rings.filter((g) => g.life > 0);
  }

  private gunOrigin(): { x: number; y: number } {
    return { x: this.x, y: this.y - GUN_Y };
  }

  private fire(tx: number, ty: number): void {
    const o = this.gunOrigin();
    const a = Math.atan2(ty - o.y, tx - o.x);
    const reach = (GUN.muzzle[0] - GUN.pivot[0]) * S;
    this.bullet = { x: o.x + Math.cos(a) * reach, y: o.y + Math.sin(a) * reach, px: o.x, py: o.y };
    this.muzzleT = 0.06;
    this.sfx.shot('blaster');
  }

  private hit(target: { el: HTMLElement; flavor: Flavor }, x: number, y: number): void {
    const { el, flavor } = target;
    const burst = (n: number, colors: string[], speed: number, img?: HTMLCanvasElement) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.4 + Math.random() * 0.6);
        const life = 0.5 + Math.random() * 0.5;
        this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.5, life, max: life, color: colors[i % colors.length], size: 4, img });
      }
    };
    if (flavor === 'like') {
      burst(12, [P.pink], 260, this.sprites.heart);
      burst(14, [P.red, P.white, P.pink], 300);
      this.rings.push({ x, y, r: 6, max: 46, life: 0.35, color: P.pink });
      this.booms.push({ x, y, scale: 0.9, t: 0 });
      this.sfx.hit();
    } else if (flavor === 'bookmark') {
      burst(24, [P.blue, P.white, P.navy], 300);
      this.rings.push({ x, y, r: 6, max: 46, life: 0.35, color: P.blue });
      this.booms.push({ x, y, scale: 0.9, t: 0 });
      this.sfx.hit();
    } else if (flavor === 'repost') {
      burst(10, [P.lime], 260, this.sprites.arrows);
      burst(14, [P.lime, P.white, P.green], 300);
      this.rings.push({ x, y, r: 6, max: 46, life: 0.35, color: P.lime });
      this.booms.push({ x, y, scale: 0.9, t: 0 });
      this.sfx.hit();
    } else {
      burst(30, [P.yellow, P.orange, P.white, P.red], 420);
      this.rings.push({ x, y, r: 8, max: 90, life: 0.4, color: P.white }, { x, y, r: 4, max: 60, life: 0.5, color: P.yellow });
      this.booms.push({ x, y, scale: 2, t: 0 });
      this.sfx.boom(14);
    }
    el.animate(
      [{ transform: 'translate(0,0)' }, { transform: 'translate(-3px,2px)' }, { transform: 'translate(3px,-2px)' }, { transform: 'translate(-2px,-1px)' }, { transform: 'translate(0,0)' }],
      { duration: 220, easing: 'steps(4)' },
    );
    // The shot landed: now let the real click through.
    el.click();
    this.next();
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.vw, this.vh);
    ctx.imageSmoothingEnabled = false;

    for (const g of this.rings) {
      ctx.globalAlpha = Math.min(1, g.life * 4);
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const img = this.sprites.hero.stand[this.facing > 0 ? 'right' : 'left'];
    const w = SPRITE_W * S;
    const h = SPRITE_H * S;
    ctx.drawImage(img, Math.round(this.x - w / 2), Math.round(this.y - h), w, h);

    // Rifle, pointed at the target (or slung forward when idle).
    const target = this.current ? this.center(this.current.el) : null;
    const o = this.gunOrigin();
    const a = target ? Math.atan2(target.cy - o.y, target.cx - o.x) : this.facing > 0 ? 0 : Math.PI;
    const left = Math.cos(a) < 0;
    const gun = left ? this.sprites.weapons.rifle.down : this.sprites.weapons.rifle.up;
    const pivotY = left ? gun.height - 1 - GUN.pivot[1] : GUN.pivot[1];
    ctx.save();
    ctx.translate(Math.round(o.x), Math.round(o.y));
    ctx.rotate(a);
    ctx.drawImage(gun, -GUN.pivot[0] * S, -pivotY * S, gun.width * S, gun.height * S);
    if (this.muzzleT > 0) {
      const mx = (GUN.muzzle[0] - GUN.pivot[0] + 1) * S;
      const my = ((left ? gun.height - 1 - GUN.muzzle[1] : GUN.muzzle[1]) - pivotY) * S;
      ctx.fillStyle = P.yellow;
      ctx.fillRect(mx - 2, my - 6, 4, 12);
      ctx.fillRect(mx - 6, my - 2, 12, 4);
      ctx.fillStyle = P.white;
      ctx.fillRect(mx - 2, my - 2, 4, 4);
    }
    ctx.restore();

    if (this.bullet) {
      const b = this.bullet;
      ctx.fillStyle = P.slate;
      ctx.fillRect(Math.round(b.px) - 2, Math.round(b.py) - 2, 4, 4);
      ctx.fillStyle = P.white;
      ctx.fillRect(Math.round(b.x) - 3, Math.round(b.y) - 3, 6, 6);
      ctx.fillStyle = P.yellow;
      ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2);
    }

    for (const p of this.sparks) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 2);
      if (p.img) ctx.drawImage(p.img, Math.round(p.x - p.img.width), Math.round(p.y - p.img.height), p.img.width * 2, p.img.height * 2);
      else {
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
    for (const b of this.booms) {
      const frame = this.sprites.boom[Math.min(5, Math.floor(b.t / 0.07))];
      const size = frame.width * S * b.scale;
      ctx.drawImage(frame, Math.round(b.x - size / 2), Math.round(b.y - size / 2), size, size);
    }
  }
}
