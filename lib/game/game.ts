import type { PageCapture } from '../capture';
import { FIRE, P, SMOKE } from '../palette';
import type { Settings } from '../settings';
import { Sfx } from './audio';
import { HUD_CSS, Hud, type MenuAction, type MenuItem } from './hud';
import { BEDROCK_ROWS, CELL, Level, type DebrisSink } from './level';
import { Kind, Particles } from './particles';
import { EH, EW, Enemies, type Enemy } from './enemies';
import { SPRITE_H, SPRITE_W, Sprites, WEAPON_ART, brickTile, voidTile, type Pose } from './sprites';
import { GRENADE, WEAPONS, type ShotKind } from './weapons';

// Physics runs at a fixed step; units are cells and seconds.
const STEP = 1 / 120;
// Hitbox in cells; the 16x24 sprite is drawn 3 cells left and 1 cell above it.
const PW = 10;
const PH = 23;
const RUN = 125;
const ACCEL_GROUND = 1100;
const ACCEL_AIR = 650;
const GRAVITY = 620;
const MAX_FALL = 420;
const JUMP = 255;
const FLIP_JUMP = 230;
const JET_ACCEL = 1350;
const JET_MAX_UP = 210;
const FUEL_MAX = 1.6;
const FLY_DELAY = 0.16;
const STEP_UP = 6;
const WIN_AT = 0.85;
const LIVES = 3;
const INVULN = 2.5;
const KILL_SCORE = { runner: 500, sniper: 1500 };

const MILESTONES: [number, string, string][] = [
  [0.25, '25% WRECKED', 'KEEP BLASTING'],
  [0.5, 'HALF GONE!', 'THE PAGE IS CRUMBLING'],
  [0.75, 'CARNAGE!', '75% DESTROYED'],
];

interface Projectile {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  kind: ShotKind;
  life: number;
  radius: number;
  color: string;
}

export interface GameHooks {
  /** Stage number shown on the intro banner. */
  stage: number;
  onQuit(): void;
  onStats(delta: { won: boolean; shots: number; pixels: number; hiScore: number }): void;
  onSettings(s: Settings): void;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Game {
  private readonly host: HTMLElement;
  private readonly hud: Hud;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sfx: Sfx;
  private readonly sprites = new Sprites();
  private readonly parts = new Particles();
  private readonly brick: CanvasPattern;
  private readonly voidPat: CanvasPattern;
  private level!: Level;

  private vw = 0;
  private vh = 0;
  private dpr = 1;
  private camX = 0;
  private camY = 0;
  private shake = 0;
  private flash = 0;

  // Player, in cells.
  private px = 0;
  private py = 0;
  private vx = 0;
  private vy = 0;
  private grounded = false;
  private facing = 1;
  private fuel = FUEL_MAX;
  private airJump = true;
  /** Somersaulting through the air, run-and-gun style. */
  private balled = false;
  private spin = 0;
  private dropT = 0;
  private phasing = false;
  private coyote = 0;
  private jumpBuf = 0;
  private jumpHeld = 0;
  private flying = false;
  private runT = 0;

  private keys = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private fireHeld = false;
  /** A click that hasn't fired yet, so quick taps never get lost to a cooldown. */
  private fireQueued = 0;
  private nadeQueued = false;
  private weapon = 0;
  private cooldown = 0;
  private nadeCooldown = 0;
  private laserTick = 0;
  private beam: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private shots: Projectile[] = [];
  /** Expanding shockwave outlines. */
  private rings: { x: number; y: number; r: number; max: number; life: number; color: string }[] = [];
  /** NES-style explosion animations. */
  private booms: { x: number; y: number; scale: number; t: number }[] = [];
  /** Floating score numbers. */
  private popups: { x: number; y: number; text: string; t: number; color: string }[] = [];
  private muzzleT = 0;
  private readonly stars = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), z: 0.15 + Math.random() * 0.5, tw: Math.random() * 6 }));

  private readonly enemies: Enemies;
  private lives = LIVES;
  private dead = false;
  private deathT = 0;
  private invuln = 0;
  private killScore = 0;
  private gameOver = false;

  private time = 0;
  private nextMilestone = 0;
  private won = false;
  private paused = false;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private lastWheel = 0;
  private lastFuel = -1;
  private hintHidden = false;
  private shotsFired = 0;
  private cellsBlasted = 0;
  private reported = { shots: 0, cells: 0 };
  private menuItems: MenuItem[] = [];
  private unbind: (() => void)[] = [];
  private readonly debris: DebrisSink;

  constructor(
    private readonly cap: PageCapture,
    private settings: Settings,
    private readonly hooks: GameHooks,
  ) {
    this.host = document.createElement('web-blaster');
    this.host.style.cssText =
      'position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;margin:0!important;';
    const shadow = this.host.attachShadow({ mode: 'closed' });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(HUD_CSS);
    shadow.adoptedStyleSheets = [sheet];
    this.hud = new Hud(cap.host);
    this.hud.onAction = (a) => this.onMenu(a);
    this.hud.setCrt(settings.crt);
    shadow.append(this.hud.root);
    document.documentElement.append(this.host);

    this.ctx = this.hud.canvas.getContext('2d', { alpha: false })!;
    this.brick = this.ctx.createPattern(brickTile(CELL), 'repeat')!;
    this.voidPat = this.ctx.createPattern(voidTile(), 'repeat')!;
    this.sfx = new Sfx(settings.sound);
    this.enemies = new Enemies({
      shoot: () => this.sfx.enemyShot(),
      spawn: (e) => this.parts.burst(e.x + EW / 2, e.y + EH / 2, 16, Kind.Spark, [P.red, P.white], 90, 0.4),
      shotBlocked: (x, y) => this.parts.burst(x, y, 3, Kind.Spark, [P.red, P.white], 60, 0.15),
    });
    this.debris = (x, y, color) => {
      const life = rand(0.7, 1.6);
      this.parts.add({ x, y, vx: rand(-90, 90), vy: rand(-200, -20), life, max: life, color, size: 1, kind: Kind.Debris });
    };

    (document.activeElement as HTMLElement | null)?.blur?.();
    this.bindInput();
    this.resize();
    this.reset();
    this.camY = cap.viewTop;
    this.hud.showBanner(`STAGE ${hooks.stage}`, cap.host.toUpperCase());
    if (this.level.total < 100) this.hud.toast('NOT MUCH TO HIT HERE. TRY GRENADES!', 4000);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Called when the extension is triggered again on this tab. */
  quit(): void {
    this.reportStats();
    cancelAnimationFrame(this.raf);
    for (const off of this.unbind) off();
    this.sfx.close();
    this.host.remove();
    this.hooks.onQuit();
  }

  // ---- setup ----

  private reset(): void {
    this.level = new Level(this.cap);
    this.shots = [];
    this.parts.list = [];
    this.rings = [];
    this.booms = [];
    this.popups = [];
    this.enemies.clear();
    this.lives = LIVES;
    this.dead = false;
    this.gameOver = false;
    this.invuln = INVULN;
    this.killScore = 0;
    this.balled = false;
    this.time = 0;
    this.nextMilestone = 0;
    this.won = false;
    this.fuel = FUEL_MAX;
    this.hud.setProgress(0);
    this.hud.setWeapon(this.weapon);
    this.hud.setLives(this.lives);
    this.spawn();
  }

  private spawn(viewTop = this.cap.viewTop): void {
    const L = this.level;
    const x = clamp(Math.floor(L.w / 2 - PW / 2), 0, L.w - PW);
    const y0 = Math.floor(viewTop / CELL) + 10;
    let spot: [number, number] | null = null;
    search: for (let d = 0; d < 160; d += 2) {
      for (const dx of [0, -30, 30, -60, 60]) {
        for (const y of [y0 + d, y0 - d]) {
          const sx = clamp(x + dx, 0, L.w - PW);
          if (y > 0 && y < L.pageRows - PH && !L.boxHits(sx, y, PW, PH)) {
            spot = [sx, y];
            break search;
          }
        }
      }
    }
    if (!spot) {
      spot = [x, y0];
      this.blast(x + PW / 2, y0 + PH / 2, 16, this.debris, 0.3);
    }
    [this.px, this.py] = spot;
    this.vx = this.vy = 0;
    this.parts.burst(this.px + PW / 2, this.py + PH / 2, 60, Kind.Spark, [P.blue, P.white, P.lavender], 200, 0.7);
    this.rings.push({ x: this.px + PW / 2, y: this.py + PH / 2, r: 4, max: 40, life: 0.5, color: P.blue });
  }

  private bindInput(): void {
    const on = <K extends keyof WindowEventMap>(
      target: Window | HTMLElement,
      type: K,
      fn: (e: WindowEventMap[K]) => void,
      opts: AddEventListenerOptions = {},
    ) => {
      target.addEventListener(type, fn as EventListener, opts);
      this.unbind.push(() => target.removeEventListener(type, fn as EventListener, opts));
    };
    const capture = { capture: true, passive: false };

    on(window, 'keydown', (e) => this.onKeyDown(e), capture);
    on(window, 'keyup', (e) => {
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.keys.delete(e.code);
    }, capture);
    on(window, 'keypress', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    }, capture);
    on(window, 'mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    }, capture);
    on(this.hud.canvas, 'mousedown', (e) => {
      e.preventDefault();
      this.sfx.resume();
      if (e.button === 0) {
        this.fireHeld = true;
        this.fireQueued = 0.3;
      }
      if (e.button === 2) this.nadeQueued = true;
    });
    on(window, 'mouseup', (e) => {
      if (e.button === 0) this.fireHeld = false;
    }, capture);
    on(this.hud.canvas, 'contextmenu', (e) => e.preventDefault());
    on(this.host, 'wheel', (e) => {
      e.preventDefault();
      if (this.hud.menuOpen || performance.now() - this.lastWheel < 120) return;
      this.lastWheel = performance.now();
      this.setWeapon((this.weapon + (e.deltaY > 0 ? 1 : -1) + WEAPONS.length) % WEAPONS.length);
    }, { passive: false });
    on(window, 'blur', () => this.pause());
    on(window, 'resize', () => this.resize());
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.sfx.resume();
    if (this.hud.menuOpen) {
      if (e.code === 'Escape' && !this.won && !this.gameOver) this.resume();
      else if (!e.repeat) this.hud.menuKey(e.code, this.menuItems);
      return;
    }
    this.keys.add(e.code);
    if (e.repeat) return;
    switch (e.code) {
      case 'Escape':
      case 'KeyP':
        this.pause();
        break;
      case 'Space':
      case 'KeyW':
      case 'ArrowUp':
        this.jumpBuf = 0.12;
        this.jumpHeld = 0;
        break;
      case 'KeyS':
      case 'ArrowDown':
        if (this.grounded) {
          this.dropT = 0.22;
          this.vy = 40;
        }
        break;
      case 'KeyQ':
        this.setWeapon((this.weapon - 1 + WEAPONS.length) % WEAPONS.length);
        break;
      case 'KeyE':
        this.setWeapon((this.weapon + 1) % WEAPONS.length);
        break;
      case 'KeyG':
        this.nadeQueued = true;
        break;
      case 'KeyM':
        this.toggleSound();
        break;
      default:
        if (/^Digit[1-9]$/.test(e.code)) {
          const i = Number(e.code.slice(5)) - 1;
          if (i < WEAPONS.length) this.setWeapon(i);
        }
    }
  }

  private resize(): void {
    this.dpr = devicePixelRatio || 1;
    this.vw = innerWidth;
    this.vh = innerHeight;
    this.hud.canvas.width = Math.round(this.vw * this.dpr);
    this.hud.canvas.height = Math.round(this.vh * this.dpr);
  }

  private setWeapon(i: number): void {
    if (i === this.weapon) return;
    this.weapon = i;
    this.cooldown = Math.max(this.cooldown, 0.05);
    this.hud.setWeapon(i);
    this.sfx.select();
  }

  // ---- menus ----

  private pause(): void {
    this.keys.clear();
    this.fireHeld = false;
    this.sfx.jet(false);
    this.sfx.laser(false);
    if (this.paused) return;
    this.paused = true;
    this.menuItems = [
      { act: 'resume', label: 'RESUME' },
      { act: 'restart', label: 'RESTART' },
      { act: 'sound', label: this.soundLabel() },
      { act: 'crt', label: this.crtLabel() },
      { act: 'enemies', label: this.enemiesLabel() },
      { act: 'quit', label: 'QUIT' },
    ];
    this.hud.openMenu('PAUSED', this.menuItems, undefined, 'ESC RESUME &middot; M MUTE');
  }

  private resume(): void {
    this.hud.closeMenu();
    this.paused = false;
    this.last = performance.now();
  }

  private openWin(): void {
    this.paused = true;
    this.fireHeld = false;
    this.keys.clear();
    this.sfx.jet(false);
    this.sfx.laser(false);
    this.sfx.win();
    this.reportStats(true);
    this.menuItems = [
      { act: 'keep', label: 'KEEP BLASTING' },
      { act: 'restart', label: 'PLAY AGAIN' },
      { act: 'quit', label: 'QUIT' },
    ];
    const s = Math.floor(this.time);
    this.hud.openMenu(
      'PAGE DESTROYED!',
      this.menuItems,
      [
        ['WRECKED', `${Math.floor(this.level.destroyed * 100)}%`],
        ['TIME', `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`],
        ['SCORE', this.score().toLocaleString()],
        ['SHOTS', this.shotsFired.toLocaleString()],
        ['PIXELS', (this.cellsBlasted * CELL * CELL).toLocaleString()],
      ],
      this.cap.host.toUpperCase(),
    );
  }

  private onMenu(a: MenuAction): void {
    switch (a) {
      case 'resume':
      case 'keep':
        this.resume();
        break;
      case 'restart':
        this.reportStats();
        this.shotsFired = this.cellsBlasted = 0;
        this.reported = { shots: 0, cells: 0 };
        this.reset();
        this.resume();
        this.hud.showBanner('ROUND 2', 'FRESH PAGE');
        break;
      case 'sound':
        this.toggleSound();
        this.hud.relabel('sound', this.soundLabel(), this.menuItems);
        break;
      case 'crt':
        this.settings = { ...this.settings, crt: !this.settings.crt };
        this.hud.setCrt(this.settings.crt);
        this.hud.relabel('crt', this.crtLabel(), this.menuItems);
        this.hooks.onSettings(this.settings);
        break;
      case 'enemies':
        this.settings = { ...this.settings, enemies: !this.settings.enemies };
        if (!this.settings.enemies) this.enemies.clear();
        this.hud.relabel('enemies', this.enemiesLabel(), this.menuItems);
        this.hooks.onSettings(this.settings);
        break;
      case 'continue':
        this.reportStats();
        this.gameOver = false;
        this.lives = LIVES;
        this.killScore = 0;
        this.hud.setLives(this.lives);
        this.respawn();
        this.resume();
        break;
      case 'quit':
        this.quit();
        break;
    }
  }

  private openGameOver(): void {
    this.paused = true;
    this.gameOver = true;
    this.keys.clear();
    this.fireHeld = false;
    this.sfx.jet(false);
    this.sfx.laser(false);
    this.reportStats();
    this.menuItems = [
      { act: 'continue', label: 'CONTINUE' },
      { act: 'restart', label: 'RESTART PAGE' },
      { act: 'quit', label: 'QUIT' },
    ];
    this.hud.openMenu('GAME OVER', this.menuItems, [
      ['SCORE', this.score().toLocaleString()],
      ['WRECKED', `${Math.floor(this.level.destroyed * 100)}%`],
    ]);
  }

  private score(): number {
    return this.killScore + this.cellsBlasted;
  }

  private toggleSound(): void {
    this.settings = { ...this.settings, sound: !this.settings.sound };
    this.sfx.setEnabled(this.settings.sound);
    this.hooks.onSettings(this.settings);
  }

  private soundLabel = () => `SOUND: ${this.settings.sound ? 'ON' : 'OFF'}`;
  private crtLabel = () => `CRT FX: ${this.settings.crt ? 'ON' : 'OFF'}`;
  private enemiesLabel = () => `ENEMIES: ${this.settings.enemies ? 'ON' : 'OFF'}`;

  private reportStats(won = false): void {
    const shots = this.shotsFired - this.reported.shots;
    const cells = this.cellsBlasted - this.reported.cells;
    this.reported = { shots: this.shotsFired, cells: this.cellsBlasted };
    if (shots || cells || won) this.hooks.onStats({ won, shots, pixels: cells * CELL * CELL, hiScore: this.score() });
  }

  // ---- loop ----

  private frame = (t: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    if (!this.paused) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n++ < 8) {
        this.update(STEP);
        this.acc -= STEP;
      }
      if (n >= 8) this.acc = 0;
    }
    this.render();
    // Recording builds only: expose state so a scripted player can aim (stripped from production).
    if (import.meta.env.WXT_RECORD) {
      this.host.dataset.state = JSON.stringify({
        x: (this.px + PW / 2) * CELL - this.camX,
        y: (this.py + PH / 2) * CELL - this.camY,
        g: this.grounded,
        cx: this.camX,
        cy: this.camY,
        p: this.level.destroyed,
        dead: this.dead,
        enemies: this.enemies.list.length,
        foes: this.enemies.list.map((e) => [(e.x + EW / 2) * CELL - this.camX, (e.y + EH / 2) * CELL - this.camY]),
        score: this.score(),
        lives: this.lives,
        paused: this.paused,
      });
    }
  };

  private update(dt: number): void {
    this.time += dt;
    this.cooldown -= dt;
    this.nadeCooldown -= dt;
    this.muzzleT -= dt;
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.dead) this.updateDeath(dt);
    else {
      this.updatePlayer(dt);
      this.updateWeapons(dt);
    }
    this.updateShots(dt);
    this.updateEnemies(dt);
    this.parts.update(dt, this.level);
    for (const b of this.booms) b.t += dt;
    this.booms = this.booms.filter((b) => b.t < 0.42);
    for (const pp of this.popups) {
      pp.t += dt;
      pp.y -= dt * 18;
    }
    this.popups = this.popups.filter((pp) => pp.t < 0.9);
    for (const g of this.rings) {
      g.r += (g.max - g.r) * Math.min(1, dt * 12);
      g.life -= dt;
    }
    this.rings = this.rings.filter((g) => g.life > 0);
    this.updateCamera(dt);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 2.5);

    const p = this.level.destroyed;
    this.hud.setProgress(p);
    this.hud.setTime(this.time);
    this.hud.setScore(this.score());
    this.hud.setGrenadeReady(this.nadeCooldown <= 0);
    const fuel = Math.round((this.fuel / FUEL_MAX) * 50);
    if (fuel !== this.lastFuel) {
      this.lastFuel = fuel;
      this.hud.setFuel(fuel / 50);
    }
    if (!this.hintHidden && (this.time > 7 || this.shotsFired > 25)) {
      this.hintHidden = true;
      this.hud.hideHint();
    }
    const m = MILESTONES[this.nextMilestone];
    if (m && p >= m[0]) {
      this.nextMilestone++;
      if (p < WIN_AT) {
        this.hud.showBanner(m[1], m[2]);
        this.sfx.milestone();
      }
    }
    if (!this.won && this.level.total >= 100 && p >= WIN_AT) {
      this.won = true;
      this.openWin();
    }
  }

  private held(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  private updatePlayer(dt: number): void {
    const L = this.level;
    const dir = (this.held('KeyD', 'ArrowRight') ? 1 : 0) - (this.held('KeyA', 'ArrowLeft') ? 1 : 0);
    const jumpKey = this.held('Space', 'KeyW', 'ArrowUp');

    const target = dir * RUN;
    const accel = this.grounded ? ACCEL_GROUND : ACCEL_AIR;
    this.vx = this.vx < target ? Math.min(target, this.vx + accel * dt) : Math.max(target, this.vx - accel * dt);

    this.jumpBuf -= dt;
    this.coyote = this.grounded ? 0.1 : this.coyote - dt;
    this.jumpHeld = jumpKey ? this.jumpHeld + dt : 0;
    if (this.jumpBuf > 0) {
      if (this.coyote > 0) {
        this.vy = -JUMP;
        this.jumpBuf = this.coyote = 0;
        this.grounded = false;
        this.airJump = true;
        this.balled = true;
        this.sfx.jump();
        this.parts.burst(this.px + PW / 2, this.py + PH, 6, Kind.Smoke, SMOKE, 40, 0.4, 1);
      } else if (this.airJump) {
        this.vy = -FLIP_JUMP;
        this.airJump = false;
        this.jumpBuf = 0;
        this.balled = true;
        this.sfx.flip();
      }
    }

    this.flying = jumpKey && !this.grounded && this.jumpHeld > FLY_DELAY && this.fuel > 0 && this.dropT <= 0;
    if (this.flying) {
      this.balled = false;
      this.vy = Math.max(-JET_MAX_UP, this.vy - JET_ACCEL * dt);
      this.fuel = Math.max(0, this.fuel - dt);
      // Rocket boots.
      for (const fx of [this.px + 2, this.px + PW - 3]) {
        if (Math.random() > 0.5) continue;
        const life = rand(0.12, 0.3);
        this.parts.add({ x: fx + rand(0, 1.5), y: this.py + PH, vx: rand(-15, 15), vy: rand(120, 220), life, max: life, color: FIRE[(Math.random() * 4) | 0], size: 2, kind: Kind.Fire });
      }
    }
    this.sfx.jet(this.flying);
    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
    if (this.grounded) this.fuel = Math.min(FUEL_MAX, this.fuel + dt * 1.5);
    this.spin += dt;
    this.dropT -= dt;

    this.phasing = this.dropT > 0 || (this.phasing && L.boxHits(this.px, this.py, PW, PH));
    this.moveX(this.vx * dt);
    this.moveY(this.vy * dt);

    const was = this.grounded;
    this.grounded = !this.phasing && this.vy >= 0 && L.boxHits(this.px, this.py + 1, PW, PH);
    if (this.grounded) this.balled = false;
    if (this.grounded && !was) this.parts.burst(this.px + PW / 2, this.py + PH, 4, Kind.Smoke, SMOKE, 30, 0.3, 1);

    if (!this.phasing && L.boxHits(this.px, this.py, PW, PH)) this.unstick();
    if (Math.abs(this.vx) > 10) this.runT += dt;
  }

  private die(): void {
    if (this.dead || this.invuln > 0) return;
    this.dead = true;
    this.deathT = 1.4;
    this.lives--;
    this.hud.setLives(this.lives);
    this.vx = -this.facing * 110;
    this.vy = -230;
    this.balled = true;
    this.fireHeld = false;
    this.sfx.jet(false);
    this.sfx.laser(false);
    this.sfx.playerDie();
    this.shake = Math.max(this.shake, 10);
    this.flash = Math.max(this.flash, 0.25);
    this.parts.burst(this.px + PW / 2, this.py + PH / 2, 30, Kind.Spark, [P.red, P.peach, P.white], 160, 0.6);
  }

  /** Knocked back and tumbling, then back in action (or game over). */
  private updateDeath(dt: number): void {
    this.deathT -= dt;
    this.spin += dt;
    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
    this.vx *= 0.98;
    this.moveX(this.vx * dt);
    this.moveY(this.vy * dt);
    if (this.deathT > 0) return;
    if (this.lives <= 0) this.openGameOver();
    else this.respawn();
  }

  private respawn(): void {
    this.dead = false;
    this.balled = false;
    this.invuln = INVULN;
    this.fuel = FUEL_MAX;
    this.spawn(this.camY);
    this.sfx.respawn();
  }

  private updateEnemies(dt: number): void {
    if (!this.settings.enemies) return;
    const view = { x0: this.camX / CELL, y0: this.camY / CELL, x1: (this.camX + this.vw) / CELL, y1: (this.camY + this.vh) / CELL };
    const heat = Math.min(1, this.level.destroyed * 1.4 + this.time / 240);
    this.enemies.update(dt, { level: this.level, target: this.dead ? null : { x: this.px + PW / 2, y: this.py + PH / 2 }, view, heat });
    if (this.dead || this.invuln > 0) {
      this.enemies.hits(-1e9, -1e9, 0, 0);
      return;
    }
    // Shots or body contact are both fatal, as in the arcade.
    const hb = { x: this.px + 2, y: this.py + 3, w: PW - 4, h: PH - 4 };
    const touched = this.enemies.list.some((e) => e.x < hb.x + hb.w && e.x + EW > hb.x && e.y < hb.y + hb.h && e.y + EH > hb.y);
    if (this.enemies.hits(hb.x, hb.y, hb.w, hb.h) || touched) this.die();
  }

  private damage(e: Enemy, amount: number): void {
    e.hp -= amount;
    e.hitT = 0.08;
    if (e.hp > 0) return;
    const cx = e.x + EW / 2;
    const cy = e.y + EH / 2;
    const points = KILL_SCORE[e.kind];
    this.killScore += points;
    this.booms.push({ x: cx, y: cy, scale: e.kind === 'sniper' ? 1.6 : 1.2, t: 0 });
    this.popups.push({ x: cx, y: e.y, text: String(points), t: 0, color: e.kind === 'sniper' ? P.yellow : P.white });
    this.parts.burst(cx, cy, 26, Kind.Debris, [P.slate, P.lavender, P.peach, P.red], 140, 1.2);
    this.shake = Math.max(this.shake, 4);
    this.sfx.enemyDie();
  }

  private moveX(dx: number): void {
    const L = this.level;
    let rem = dx;
    while (Math.abs(rem) > 1e-6) {
      const step = clamp(rem, -1, 1);
      rem -= step;
      const nx = clamp(this.px + step, 0, L.w - PW);
      if (this.phasing || !L.boxHits(nx, this.py, PW, PH)) {
        this.px = nx;
        continue;
      }
      let climbed = false;
      if (this.vy >= 0) {
        for (let up = 1; up <= STEP_UP; up++) {
          if (!L.boxHits(nx, this.py - up, PW, PH)) {
            this.px = nx;
            this.py -= up;
            climbed = true;
            break;
          }
        }
      }
      if (!climbed) {
        this.vx = 0;
        return;
      }
    }
  }

  private moveY(dy: number): void {
    const L = this.level;
    let rem = dy;
    while (Math.abs(rem) > 1e-6) {
      const step = clamp(rem, -1, 1);
      rem -= step;
      const ny = Math.max(-400, this.py + step);
      if (!this.phasing && L.boxHits(this.px, ny, PW, PH)) {
        this.vy = 0;
        return;
      }
      this.py = ny;
    }
  }

  private unstick(): void {
    for (let k = 1; k <= 40; k++) {
      if (!this.level.boxHits(this.px, this.py - k, PW, PH)) {
        this.py -= k;
        return;
      }
    }
    this.blast(this.px + PW / 2, this.py + PH / 2, 16, this.debris, 0.3);
  }

  // ---- weapons ----

  private aim(): { ox: number; oy: number; dx: number; dy: number } {
    const ox = this.px + PW / 2;
    const oy = this.py + 12;
    const tx = (this.mouseX + this.camX) / CELL;
    const ty = (this.mouseY + this.camY) / CELL;
    const a = Math.atan2(ty - oy, tx - ox);
    return { ox, oy, dx: Math.cos(a), dy: Math.sin(a) };
  }

  /** Muzzle position of the held weapon, following its pixel art. */
  private muzzle(ox: number, oy: number, dx: number, dy: number): { x: number; y: number } {
    const art = WEAPON_ART[WEAPONS[this.weapon].id];
    const along = art.muzzle[0] - art.pivot[0];
    // Perpendicular offset flips with the sprite when aiming left.
    const side = (art.muzzle[1] - art.pivot[1]) * (dx < 0 ? -1 : 1);
    return { x: ox + dx * along - dy * side, y: oy + dy * along + dx * side };
  }

  private updateWeapons(dt: number): void {
    const w = WEAPONS[this.weapon];
    const { ox, oy, dx, dy } = this.aim();
    if (Math.abs(dx) > 0.05) this.facing = dx > 0 ? 1 : -1;
    const { x: mx, y: my } = this.balled ? { x: this.px + PW / 2 + dx * 9, y: this.py + PH / 2 + dy * 9 } : this.muzzle(ox, oy, dx, dy);

    this.beam = null;
    if ((this.fireHeld || this.fireQueued > 0) && w.kind === 'laser') {
      this.fireQueued -= dt;
      const hit = this.level.raycast(mx, my, dx, dy, 700);
      const end = hit ?? { x: mx + dx * 700, y: my + dy * 700 };
      if (this.laserTick - dt <= 0) {
        const len = Math.hypot(end.x - mx, end.y - my);
        const struck = new Set<Enemy>();
        for (let d = 0; d < len; d += 2) {
          const e = this.enemies.at(mx + dx * d, my + dy * d);
          if (e) struck.add(e);
        }
        for (const e of struck) this.damage(e, 1);
      }
      this.beam = { x0: mx, y0: my, x1: end.x, y1: end.y };
      this.laserTick -= dt;
      if (hit && this.laserTick <= 0) {
        this.laserTick = 1 / 45;
        this.shotsFired++;
        this.impact(hit.x + dx, hit.y + dy, w.radius, w.color);
        this.shake = Math.max(this.shake, w.shake);
      }
      this.sfx.laser(true);
    } else {
      this.sfx.laser(false);
      this.fireQueued -= dt;
      if ((this.fireHeld || this.fireQueued > 0) && this.cooldown <= 0 && w.kind !== 'laser') {
        this.cooldown = w.cooldown;
        this.fireQueued = 0;
        const base = Math.atan2(dy, dx);
        for (let i = 0; i < w.pellets; i++) {
          const a = base + (w.fan && w.pellets > 1 ? -w.spread + (2 * w.spread * i) / (w.pellets - 1) : rand(-w.spread, w.spread));
          const v = w.speed * rand(0.9, 1.1);
          this.shots.push({ x: mx, y: my, px: mx, py: my, vx: Math.cos(a) * v, vy: Math.sin(a) * v, kind: w.kind, life: w.life, radius: w.radius, color: w.color });
        }
        this.shotsFired++;
        this.muzzleT = 0.05;
        this.vx -= dx * w.recoil;
        if (!this.grounded) this.vy -= dy * w.recoil * 0.8;
        this.shake = Math.max(this.shake, w.shake);
        this.parts.burst(mx, my, 5, Kind.Spark, [P.white, P.yellow, w.color], 90, 0.12);
        if (w.sound) this.sfx.shot(w.sound);
      }
    }

    if (this.nadeQueued) {
      this.nadeQueued = false;
      if (this.nadeCooldown <= 0) {
        this.nadeCooldown = GRENADE.cooldown;
        this.shots.push({
          x: mx,
          y: my,
          px: mx,
          py: my,
          vx: dx * GRENADE.speed + this.vx * 0.5,
          vy: dy * GRENADE.speed + this.vy * 0.3 - 40,
          kind: 'grenade',
          life: GRENADE.fuse,
          radius: GRENADE.radius,
          color: P.lime,
        });
        this.shotsFired++;
        this.sfx.jump();
      }
    }
  }

  private updateShots(dt: number): void {
    const L = this.level;
    const alive: Projectile[] = [];
    for (const s of this.shots) {
      s.px = s.x;
      s.py = s.y;
      if (s.kind === 'grenade') s.vy = Math.min(MAX_FALL, s.vy + GRAVITY * dt);
      const dist = Math.hypot(s.vx, s.vy) * dt;
      const steps = Math.max(1, Math.ceil(dist / 0.75));
      let dead = false;
      for (let i = 0; i < steps; i++) {
        const nx = s.x + (s.vx * dt) / steps;
        const ny = s.y + (s.vy * dt) / steps;
        const foe = s.kind === 'grenade' ? null : this.enemies.at(nx, ny);
        if (foe) {
          if (s.kind === 'rocket') this.explode(nx, ny, s.radius);
          else {
            this.damage(foe, 1);
            this.parts.burst(nx, ny, 5, Kind.Spark, [P.white, P.red], 100, 0.2);
          }
          dead = true;
          break;
        }
        if (!L.solidAt(Math.floor(nx), Math.floor(ny))) {
          s.x = nx;
          s.y = ny;
          continue;
        }
        if (s.kind === 'grenade') {
          const hitX = L.solidAt(Math.floor(nx), Math.floor(s.y));
          const hitY = L.solidAt(Math.floor(s.x), Math.floor(ny));
          if (hitX || !hitY) s.vx *= -0.45;
          if (hitY || !hitX) s.vy *= -0.45;
          s.vx *= 0.85;
          if (Math.hypot(s.vx, s.vy) > 40) this.sfx.bounce();
          break;
        }
        if (s.kind === 'rocket') this.explode(nx, ny, s.radius);
        else this.impact(nx, ny, s.radius, s.color);
        dead = true;
        break;
      }
      if (dead) continue;
      if (s.kind === 'rocket') {
        const life = rand(0.3, 0.6);
        this.parts.add({ x: s.x, y: s.y, vx: rand(-10, 10), vy: rand(-10, 10), life, max: life, color: SMOKE[(Math.random() * 3) | 0], size: 2, kind: Kind.Smoke });
      }
      s.life -= dt;
      if (s.life <= 0) {
        if (s.kind !== 'bullet') this.explode(s.x, s.y, s.radius);
        continue;
      }
      if (s.x < -50 || s.x > L.w + 50 || s.y < -600 || s.y > L.h + 50) continue;
      alive.push(s);
    }
    this.shots = alive;
  }

  private blast(x: number, y: number, r: number, debris: DebrisSink, chance: number): void {
    this.cellsBlasted += this.level.carve(x, y, r, debris, chance);
    if (!this.level.crumbled) return;
    this.sfx.crumble(this.level.crumbled);
    for (const c of this.level.collapses) {
      if (c.cells < 1500) continue;
      // A whole image or card just gave way.
      const size = Math.min(60, Math.sqrt(c.cells) / 2);
      this.rings.push({ x: c.x, y: c.y, r: size * 0.3, max: size * 2.2, life: 0.5, color: P.peach });
      this.booms.push({ x: c.x, y: c.y, scale: size / 8, t: 0 });
      this.parts.burst(c.x, c.y, 30, Kind.Smoke, SMOKE, size * 4, 1.6, 4);
      this.shake = Math.max(this.shake, 14);
      this.flash = Math.max(this.flash, 0.2);
      this.sfx.boom(size);
    }
  }

  private impact(x: number, y: number, r: number, color: string): void {
    const L = this.level;
    if (!L.isBedrock(Math.floor(y))) {
      this.blast(x, y, r, this.debris, Math.min(1, 14 / (r * r)));
    }
    this.parts.burst(x, y, 6, Kind.Spark, [color, P.white], 120, 0.25);
    this.sfx.hit();
  }

  private explode(x: number, y: number, r: number): void {
    this.blast(x, y, r, this.debris, Math.min(1, 220 / (Math.PI * r * r)));
    this.parts.burst(x, y, 50, Kind.Fire, FIRE, r * 10, 0.55, 2);
    this.parts.burst(x, y, 14, Kind.Fire, FIRE, r * 5, 0.9, 4);
    this.parts.burst(x, y, 16, Kind.Smoke, SMOKE, r * 3, 1.4, 3);
    this.parts.burst(x, y, 24, Kind.Spark, [P.yellow, P.white, P.orange], r * 16, 0.5);
    this.shake = Math.max(this.shake, Math.min(18, r * 0.7));
    this.flash = Math.max(this.flash, Math.min(0.35, r / 60));
    this.rings.push({ x, y, r: r * 0.4, max: r * 2.6, life: 0.35, color: P.white }, { x, y, r: r * 0.2, max: r * 1.7, life: 0.45, color: P.yellow });
    this.booms.push({ x, y, scale: r / 9, t: 0 });
    this.sfx.boom(r);
    for (const e of this.enemies.within(x, y, r * 1.2)) this.damage(e, 3);

    const cx = this.px + PW / 2;
    const cy = this.py + PH / 2;
    const ddx = cx - x;
    const ddy = cy - y;
    const d = Math.max(1, Math.hypot(ddx, ddy));
    const reach = r * 2.4;
    if (d < reach) {
      const f = (1 - d / reach) * 480;
      this.vx += (ddx / d) * f;
      this.vy += (ddy / d) * f - 60;
      this.grounded = false;
    }
    // Chain reaction: nearby explosives go off on the next tick.
    for (const s of this.shots) {
      if (s.kind !== 'bullet' && s.life > 0.05 && Math.hypot(s.x - x, s.y - y) < r * 1.2) s.life = 0.04;
    }
  }

  private updateCamera(dt: number): void {
    const levelW = this.level.w * CELL;
    const levelH = this.level.h * CELL;
    const ty = clamp((this.py + PH / 2) * CELL - this.vh * 0.5, Math.min(0, levelH - this.vh), Math.max(0, levelH - this.vh));
    this.camY += (ty - this.camY) * Math.min(1, dt * 7);
    if (levelW <= this.vw) this.camX = 0;
    else {
      const tx = clamp((this.px + PW / 2) * CELL - this.vw / 2, 0, levelW - this.vw);
      this.camX += (tx - this.camX) * Math.min(1, dt * 7);
    }
  }

  // ---- drawing ----

  private render(): void {
    const ctx = this.ctx;
    const L = this.level;
    const { vw, vh } = this;
    const camX = Math.round(this.camX);
    const camY = Math.round(this.camY);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const sx = Math.round(rand(-1, 1) * this.shake);
    const sy = Math.round(rand(-1, 1) * this.shake);
    ctx.translate(sx, sy);

    this.voidPat.setTransform(new DOMMatrix().translate(-camX * 0.5, -camY * 0.5));
    ctx.fillStyle = this.voidPat;
    ctx.fillRect(-20, -20, vw + 40, vh + 40);
    // Parallax starfield, visible through every hole blasted in the page.
    for (const st of this.stars) {
      const x = (((st.x * vw - camX * st.z) % vw) + vw) % vw;
      const y = (((st.y * vh * 2 - camY * st.z) % vh) + vh) % vh;
      const tw = Math.sin(this.time * 3 + st.tw) > 0.6;
      ctx.fillStyle = st.z > 0.5 ? P.white : tw ? P.pink : P.lavender;
      const size = st.z > 0.55 ? 2 : 1;
      ctx.fillRect(Math.round(x), Math.round(y), size * CELL * 0.5 + 1, size * CELL * 0.5 + 1);
    }

    const s = L.scale;
    const visW = Math.min(vw, L.cssW - camX);
    const top = Math.max(0, camY);
    const visH = Math.min(vh - (top - camY), L.cssH - top);
    if (visW > 0 && visH > 0) {
      ctx.imageSmoothingEnabled = Math.abs(s - this.dpr) > 0.01;
      ctx.drawImage(L.image, camX * s, top * s, visW * s, visH * s, 0, top - camY, visW, visH);
      ctx.imageSmoothingEnabled = false;
    }

    const bedTop = L.pageRows * CELL - camY;
    if (bedTop < vh) {
      this.brick.setTransform(new DOMMatrix().translate(-camX, bedTop));
      ctx.fillStyle = this.brick;
      ctx.fillRect(-camX, bedTop, L.w * CELL, BEDROCK_ROWS * CELL + vh);
    }

    if (this.settings.enemies) this.enemies.draw(ctx, this.sprites, CELL, camX, camY, this.time);
    for (const shot of this.shots) this.drawShot(shot, camX, camY);
    if (this.beam) this.drawBeam(camX, camY);
    this.drawPlayer(camX, camY);
    this.parts.draw(ctx, CELL, camX, camY, vw, vh);
    for (const b of this.booms) {
      const img = this.sprites.boom[Math.min(5, Math.floor(b.t / 0.07))];
      const size = img.width * CELL * b.scale;
      ctx.drawImage(img, Math.round(b.x * CELL - camX - size / 2), Math.round(b.y * CELL - camY - size / 2), size, size);
    }
    ctx.font = '10px WBPixel, monospace';
    ctx.textAlign = 'center';
    for (const pp of this.popups) {
      if (pp.t > 0.6 && Math.floor(pp.t * 20) % 2) continue;
      const x = Math.round(pp.x * CELL - camX);
      const y = Math.round(pp.y * CELL - camY);
      ctx.fillStyle = P.black;
      ctx.fillText(pp.text, x + 2, y + 2);
      ctx.fillStyle = pp.color;
      ctx.fillText(pp.text, x, y);
    }
    for (const g of this.rings) {
      ctx.globalAlpha = Math.min(1, g.life * 4);
      ctx.strokeStyle = g.color;
      ctx.lineWidth = CELL * 2;
      ctx.beginPath();
      ctx.arc(g.x * CELL - camX, g.y * CELL - camY, g.r * CELL, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,241,232,${this.flash})`;
      ctx.fillRect(0, 0, vw, vh);
    }
    if (!this.hud.menuOpen) this.drawCrosshair();
  }

  private drawShot(s: Projectile, camX: number, camY: number): void {
    const ctx = this.ctx;
    const x = Math.floor(s.x) * CELL - camX;
    const y = Math.floor(s.y) * CELL - camY;
    if (s.kind === 'bullet') {
      // Round run-and-gun pellets: white dots, or fat red balls for the spread gun.
      const big = s.color === P.red;
      const r = (big ? 3 : 1.5) * CELL;
      ctx.fillStyle = big ? P.plum : P.slate;
      ctx.fillRect(Math.round(s.px * CELL - camX) - r / 2, Math.round(s.py * CELL - camY) - r / 2, r, r);
      ctx.fillStyle = big ? P.red : P.white;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.fillStyle = big ? P.white : P.yellow;
      ctx.fillRect(x - r / 2, y - r / 2, r, r);
    } else {
      const img = s.kind === 'rocket' ? this.sprites.rocket : this.sprites.grenade;
      ctx.save();
      ctx.translate(x, y);
      if (s.kind === 'rocket') ctx.rotate(Math.round(Math.atan2(s.vy, s.vx) / (Math.PI / 4)) * (Math.PI / 4));
      else if (s.life < 0.4 && Math.floor(s.life * 20) % 2) ctx.filter = 'brightness(3)';
      ctx.drawImage(img, (-img.width * CELL) / 2, (-img.height * CELL) / 2, img.width * CELL, img.height * CELL);
      ctx.restore();
    }
  }

  private drawBeam(camX: number, camY: number): void {
    const ctx = this.ctx;
    const b = this.beam!;
    const w = CELL * (2 + Math.round(Math.random()));
    ctx.lineCap = 'square';
    ctx.strokeStyle = P.red;
    ctx.lineWidth = w + CELL * 2;
    ctx.beginPath();
    ctx.moveTo(b.x0 * CELL - camX, b.y0 * CELL - camY);
    ctx.lineTo(b.x1 * CELL - camX, b.y1 * CELL - camY);
    ctx.stroke();
    ctx.strokeStyle = P.pink;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.strokeStyle = P.white;
    ctx.lineWidth = CELL;
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  private drawPlayer(camX: number, camY: number): void {
    const ctx = this.ctx;
    // Blink while invulnerable after a respawn.
    if (this.invuln > 0 && !this.dead && Math.floor(this.invuln * 16) % 2) return;
    if (this.dead && this.deathT < 0.5 && Math.floor(this.deathT * 20) % 2) return;

    if (this.balled || this.dead) {
      // Somersault: the curled-up commando spins in 90 degree steps.
      const img = this.sprites.ball;
      const cx = Math.round((this.px + PW / 2) * CELL - camX);
      const cy = Math.round((this.py + PH / 2) * CELL - camY);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.floor(this.spin * 14) * (Math.PI / 2) * this.facing);
      ctx.drawImage(img, (-img.width * CELL) / 2, (-img.height * CELL) / 2, img.width * CELL, img.height * CELL);
      ctx.restore();
      return;
    }

    const runCycle: Pose[] = ['run1', 'run2', 'run3', 'run2'];
    const pose: Pose = !this.grounded ? 'air' : Math.abs(this.vx) > 10 ? runCycle[Math.floor(this.runT * 11) % 4] : 'stand';
    const sprite = this.sprites.hero[pose][this.facing > 0 ? 'right' : 'left'];
    const x = Math.round((this.px - 3) * CELL - camX);
    const y = Math.round((this.py - 1) * CELL - camY);
    const w = SPRITE_W * CELL;
    const h = SPRITE_H * CELL;
    ctx.drawImage(sprite, x, y, w, h);
    if (this.flying) {
      // Rocket boot flames.
      for (const bx of [x + CELL * 4, x + CELL * 10]) {
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = FIRE[Math.min(FIRE.length - 1, i + 1)];
          ctx.fillRect(bx + (i ? CELL * 0.5 : 0), y + h + i * CELL, CELL * (i ? 2 : 3), CELL);
        }
      }
    }

    // The held weapon, rotated to the aim. Flipped when aiming left so it never hangs upside down.
    const { ox, oy, dx, dy } = this.aim();
    const id = WEAPONS[this.weapon].id;
    const art = WEAPON_ART[id];
    const left = dx < 0;
    const img = left ? this.sprites.weapons[id].down : this.sprites.weapons[id].up;
    const pivotY = left ? img.height - 1 - art.pivot[1] : art.pivot[1];
    const kick = this.cooldown > 0 && WEAPONS[this.weapon].recoil > 0 ? Math.min(1, this.cooldown / WEAPONS[this.weapon].cooldown) * 2 : 0;
    ctx.save();
    ctx.translate(Math.round(ox * CELL - camX), Math.round(oy * CELL - camY));
    ctx.rotate(Math.atan2(dy, dx));
    ctx.drawImage(img, (-art.pivot[0] - kick) * CELL, -pivotY * CELL, img.width * CELL, img.height * CELL);
    if (this.muzzleT > 0) {
      // Muzzle flash: a chunky four-point star at the barrel.
      const mx = (art.muzzle[0] - art.pivot[0] + 1) * CELL;
      const my = ((left ? img.height - 1 - art.muzzle[1] : art.muzzle[1]) - pivotY) * CELL;
      ctx.fillStyle = P.yellow;
      ctx.fillRect(mx - CELL, my - CELL * 3, CELL * 2, CELL * 6);
      ctx.fillRect(mx - CELL * 3, my - CELL, CELL * 6, CELL * 2);
      ctx.fillStyle = P.white;
      ctx.fillRect(mx - CELL, my - CELL, CELL * 2, CELL * 2);
    }
    ctx.restore();
  }

  private drawCrosshair(): void {
    const ctx = this.ctx;
    const x = Math.round(this.mouseX);
    const y = Math.round(this.mouseY);
    const arms = (c: string, g: number) => {
      ctx.fillStyle = c;
      ctx.fillRect(x - 9 - g, y - 1 - g, 6 + g * 2, 2 + g * 2);
      ctx.fillRect(x + 3 - g, y - 1 - g, 6 + g * 2, 2 + g * 2);
      ctx.fillRect(x - 1 - g, y - 9 - g, 2 + g * 2, 6 + g * 2);
      ctx.fillRect(x - 1 - g, y + 3 - g, 2 + g * 2, 6 + g * 2);
    };
    arms(P.black, 1);
    arms(P.white, 0);
    ctx.fillStyle = P.red;
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
}
