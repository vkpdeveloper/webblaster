import { P } from './palette';
import { Sfx } from './game/audio';
import { BEAT, danceStep, type Arm } from './dance';
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

/** Shoulders on the dancing torso, in sprite px from the top-left of the right-facing sprite. */
const FRONT_SHOULDER = [12, 9] as const;
const BACK_SHOULDER = [5, 9] as const;
/** Tumbi riff, one note per half beat; 0 rests. */
const RIFF = [988, 0, 1175, 988, 880, 0, 784, 880, 988, 0, 1319, 1175, 988, 880, 784, 0];
/** Disco spot colors, one per beat. */
const SPOT = [P.pink, P.yellow, P.blue, P.lime];
/** How long he keeps dancing after the mouse leaves him. */
const LINGER = 1.2;

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
 * and he shoots the button from where he stands, and only then lets your click through. Hover over him and he
 * breaks into a Bollywood dance.
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
  private hovering = false;
  private linger = 0;
  private danceT = 0;
  private notes: { x: number; y: number; t: number; img: HTMLCanvasElement }[] = [];
  private raf = 0;
  private last = 0;
  private readonly onClick = (e: MouseEvent) => this.intercept(e);
  private readonly onResize = () => this.resize();
  private readonly onMove = (e: MouseEvent) => this.hover(e.clientX, e.clientY);
  private readonly onLeave = () => (this.hovering = false);

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
    // The overlay ignores the pointer, so hovering him is a hit test against mouse moves.
    window.addEventListener('mousemove', this.onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', this.onLeave);
    this.wake();
  }

  setSound(on: boolean): void {
    this.sfx.setEnabled(on);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('click', this.onClick, true);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('mousemove', this.onMove);
    document.documentElement.removeEventListener('mouseleave', this.onLeave);
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

  private hover(mx: number, my: number): void {
    const over = Math.abs(mx - this.x) < (SPRITE_W * S) / 2 + 12 && my > this.y - SPRITE_H * S - 12 && my < this.y + 8;
    if (over && !this.hovering) {
      // Works without a gesture once the user has clicked anywhere on the page.
      this.sfx.resume();
      this.wake();
    }
    this.hovering = over;
  }

  /** Dancing while hovered (and a moment after), unless there's a button to shoot. */
  private dancing(): boolean {
    return !this.current && this.linger > 0;
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
    // Sleep once he's out of targets, done dancing, and the smoke has cleared.
    const settled =
      !this.current && !this.linger && !this.sparks.length && !this.booms.length && !this.rings.length && !this.notes.length && !this.bullet;
    this.raf = settled ? 0 : requestAnimationFrame(this.frame);
  };

  private update(dt: number): void {
    this.muzzleT -= dt;
    this.linger = this.hovering ? LINGER : Math.max(0, this.linger - dt);
    if (this.dancing()) this.groove(dt);
    else this.danceT = 0;
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
    for (const n of this.notes) {
      n.t += dt;
      n.y -= 50 * dt;
    }
    this.notes = this.notes.filter((n) => n.t < 1.4);
  }

  /** Advance the dance; on every half beat play the dhol and tumbi, and on whole beats throw notes and marigolds. */
  private groove(dt: number): void {
    const halves = (t: number) => Math.floor((t / BEAT) * 2);
    const first = this.danceT === 0;
    const before = halves(this.danceT);
    this.danceT += dt;
    const n = halves(this.danceT);
    if (!first && n === before) return;
    this.sfx.dhol(n % 2 === 0);
    const note = RIFF[n % RIFF.length];
    if (note) this.sfx.tumbi(note);
    if (n % 2) return;
    const head = this.y - SPRITE_H * S;
    this.notes.push({ x: this.x + (Math.random() - 0.5) * 32, y: head, t: 0, img: this.sprites.notes[(n / 2) % this.sprites.notes.length] });
    for (let i = 0; i < 5; i++) {
      const life = 0.6 + Math.random() * 0.4;
      const color = [P.orange, P.yellow, P.pink][i % 3];
      this.sparks.push({ x: this.x, y: head, vx: (Math.random() - 0.5) * 220, vy: -180 - Math.random() * 160, life, max: life, color, size: 4 });
    }
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

    if (this.dancing()) this.drawDancer();
    else this.drawHero();

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
    for (const n of this.notes) {
      ctx.globalAlpha = Math.min(1, (1.4 - n.t) * 2);
      const x = Math.round(n.x + Math.sin(n.t * 6) * 6);
      ctx.drawImage(n.img, x, Math.round(n.y), n.img.width * S, n.img.height * S);
    }
    ctx.globalAlpha = 1;
    for (const b of this.booms) {
      const frame = this.sprites.boom[Math.min(5, Math.floor(b.t / 0.07))];
      const size = frame.width * S * b.scale;
      ctx.drawImage(frame, Math.round(b.x - size / 2), Math.round(b.y - size / 2), size, size);
    }
  }

  private drawHero(): void {
    const ctx = this.ctx;
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
  }

  private drawDancer(): void {
    const ctx = this.ctx;
    const step = danceStep(this.danceT);
    const w = SPRITE_W * S;
    const h = SPRITE_H * S;

    // A disco spot under his feet that changes color on every beat.
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = SPOT[Math.floor(this.danceT / BEAT) % SPOT.length];
    const rx = 40;
    const ry = 8;
    for (let dy = -ry; dy < ry; dy += S) {
      const hw = Math.round((rx * Math.sqrt(1 - ((dy + S / 2) / ry) ** 2)) / S) * S;
      ctx.fillRect(Math.round(this.x) - hw, Math.round(this.y - 4) + dy, hw * 2, S);
    }
    ctx.globalAlpha = 1;

    const ox = Math.round(this.x - w / 2 + step.dx * S);
    const oy = Math.round(this.y - h + step.dy * S);
    this.drawArm(ox, oy, step.face, BACK_SHOULDER, step.back);
    ctx.drawImage(this.sprites.dancer[step.legs][step.face > 0 ? 'right' : 'left'], ox, oy, w, h);
    this.drawArm(ox, oy, step.face, FRONT_SHOULDER, step.front);
  }

  /** Upper arm and forearm as chunky outlined pixels, from a shoulder given for the right-facing sprite. */
  private drawArm(ox: number, oy: number, face: number, shoulder: readonly [number, number], [upper, fore]: Arm): void {
    const cells: [number, number][] = [];
    let x = face > 0 ? shoulder[0] : SPRITE_W - shoulder[0];
    let y = shoulder[1];
    for (const [deg, len] of [
      [upper, 5.5],
      [fore, 5],
    ]) {
      const a = (deg * Math.PI) / 180;
      const dx = Math.cos(a) * face;
      const dy = Math.sin(a);
      for (let i = 0; i <= len * 2; i++) cells.push([Math.floor(x + (dx * i) / 2 - 0.5), Math.floor(y + (dy * i) / 2 - 0.5)]);
      x += dx * len;
      y += dy * len;
    }
    const ctx = this.ctx;
    ctx.fillStyle = P.black;
    for (const [cx, cy] of cells) ctx.fillRect(ox + (cx - 1) * S, oy + (cy - 1) * S, 4 * S, 4 * S);
    ctx.fillStyle = P.peach;
    for (const [cx, cy] of cells) ctx.fillRect(ox + cx * S, oy + cy * S, 2 * S, 2 * S);
  }
}
