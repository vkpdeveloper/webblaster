import { blastTab } from '@/lib/inject';
import { P } from '@/lib/palette';
import { settingsItem, statsItem, type Settings } from '@/lib/settings';
import { Sprites } from '@/lib/game/sprites';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const MIN_SCREENS = 1;
const MAX_SCREENS = 8;

let settings: Settings;

async function init(): Promise<void> {
  settings = await settingsItem.getValue();
  renderSettings();

  const stats = await statsItem.getValue();
  $('pages').textContent = stats.pagesDestroyed.toLocaleString();
  $('shots').textContent = stats.shotsFired.toLocaleString();
  $('pixels').textContent = compact(stats.pixelsBlasted);

  const commands = await browser.commands.getAll();
  const shortcut = commands.find((c) => c.name === 'destroy-page')?.shortcut;
  $('shortcut').textContent = shortcut ? readableShortcut(shortcut) : 'NOT SET';

  $('blast').addEventListener('click', blast);
  $('sound').addEventListener('click', () => save({ sound: !settings.sound }));
  $('crt').addEventListener('click', () => save({ crt: !settings.crt }));
  $('less').addEventListener('click', () => save({ maxScreens: Math.max(MIN_SCREENS, settings.maxScreens - 1) }));
  $('more').addEventListener('click', () => save({ maxScreens: Math.min(MAX_SCREENS, settings.maxScreens + 1) }));
  $('blast').focus();
  animateHero();
}

async function blast(): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const err = tab?.id ? await blastTab(tab.id) : 'No tab to blast.';
  if (!err) {
    window.close();
    return;
  }
  const el = $('err');
  el.textContent = err.toUpperCase();
  el.hidden = false;
}

async function save(patch: Partial<Settings>): Promise<void> {
  settings = { ...settings, ...patch };
  renderSettings();
  await settingsItem.setValue(settings);
}

function renderSettings(): void {
  const toggle = (id: string, on: boolean) => {
    const el = $(id);
    el.textContent = on ? 'ON' : 'OFF';
    el.classList.toggle('on', on);
    el.setAttribute('aria-pressed', String(on));
  };
  toggle('sound', settings.sound);
  toggle('crt', settings.crt);
  $('screens').textContent = `${settings.maxScreens} SCREEN${settings.maxScreens === 1 ? '' : 'S'}`;
}

/** macOS reports shortcuts as glyphs the pixel font can't draw. */
function readableShortcut(s: string): string {
  const names: Record<string, string> = { '⌘': 'CMD+', '⌥': 'ALT+', '⇧': 'SHIFT+', '⌃': 'CTRL+' };
  return s.replace(/[⌘⌥⇧⌃]/g, (c) => names[c]).toUpperCase();
}

function compact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

/** A tiny attract-mode loop: the hero runs across the marquee blasting bricks. */
function animateHero(): void {
  const W = 96;
  const H = 32;
  const FLOOR = 28;
  const canvas = $<HTMLCanvasElement>('hero');
  const ctx = canvas.getContext('2d')!;
  const sprites = new Sprites();
  const gun = sprites.weapons.smg.up;
  const bricks = Array.from({ length: W / 4 }, () => true);
  const sparks: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  let x = -16;
  let t = 0;
  const tick = () => {
    t++;
    x += 0.5;
    if (x > W) {
      x = -16;
      bricks.fill(true);
    }
    // Blast the brick just ahead of the hero.
    const i = Math.floor((x + 26) / 4);
    if (bricks[i] && t % 8 === 0) {
      bricks[i] = false;
      for (let k = 0; k < 8; k++) sparks.push({ x: i * 4 + 2, y: FLOOR, vx: Math.random() * 2 - 1, vy: -Math.random() * 2.2, life: 22 });
    }
    ctx.fillStyle = P.plum;
    ctx.fillRect(0, 0, W, H);
    bricks.forEach((on, j) => {
      if (!on) return;
      ctx.fillStyle = P.brown;
      ctx.fillRect(j * 4, FLOOR, 3, 3);
    });
    const pose = Math.floor(t / 6) % 2 ? sprites.hero.run1 : sprites.hero.run2;
    const hx = Math.round(x);
    ctx.drawImage(pose.right, hx, FLOOR - 24);
    ctx.drawImage(gun, hx + 4, FLOOR - 16);
    if (t % 8 < 2) {
      ctx.fillStyle = P.yellow;
      ctx.fillRect(hx + 20, FLOOR - 14, 3, 2);
    }
    for (const s of sparks) {
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.15;
      s.life--;
      ctx.fillStyle = s.life > 11 ? P.yellow : P.orange;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    }
    for (let k = sparks.length - 1; k >= 0; k--) if (sparks[k].life <= 0) sparks.splice(k, 1);
    requestAnimationFrame(tick);
  };
  tick();
}

void init();
