import { P } from '../palette';
import { ICONS, WEAPON_ART, iconUrl } from './sprites';
import { WEAPONS } from './weapons';

export type MenuAction = 'resume' | 'restart' | 'sound' | 'crt' | 'quit' | 'keep';

export interface MenuItem {
  act: MenuAction;
  label: string;
}

const px = (c: string, n = 4) =>
  `${n}px 0 ${c}, -${n}px 0 ${c}, 0 ${n}px ${c}, 0 -${n}px ${c}`;

export const HUD_CSS = /* css */ `
:host { all: initial; }
* { box-sizing: border-box; margin: 0; padding: 0; }
.root {
  position: fixed; inset: 0; overflow: hidden;
  font-family: 'WBPixel', ui-monospace, monospace; color: ${P.white};
  font-size: 10px; line-height: 1.6; letter-spacing: 0.5px;
  -webkit-font-smoothing: none; user-select: none;
}
canvas.game { position: absolute; inset: 0; width: 100%; height: 100%; cursor: none; image-rendering: pixelated; }
.root.menu-open canvas.game { cursor: default; }
.crt { position: absolute; inset: 0; pointer-events: none;
  background:
    repeating-linear-gradient(to bottom, rgba(0,0,0,0.09) 0 1px, transparent 1px 3px),
    radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.38) 100%);
  animation: flicker 5s steps(1) infinite; }
.root:not(.crt-on) .crt { display: none; }
@keyframes flicker { 0%, 100% { opacity: 1; } 47% { opacity: 0.85; } 48% { opacity: 1; } 91% { opacity: 0.9; } }

.panel { background: ${P.black}; padding: 6px 10px;
  box-shadow: ${px(P.white, 2)}, 4px 4px 0 2px rgba(0,0,0,0.6); }
.label { color: ${P.lavender}; }
.hud { position: absolute; inset: 0; pointer-events: none; }
.top { position: absolute; top: 14px; left: 14px; right: 14px; display: flex; gap: 18px; align-items: flex-start; }
.title { display: flex; flex-direction: column; gap: 2px; max-width: 30%; }
.logo { color: ${P.yellow}; text-shadow: 2px 2px 0 ${P.red}; }
.logo b { color: ${P.blue}; font-weight: normal; text-shadow: 2px 2px 0 ${P.navy}; }
.host { color: ${P.silver}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 8px; }
.meter { flex: 1; display: flex; align-items: center; gap: 10px; max-width: 520px; margin: 0 auto; }
.bar { flex: 1; height: 12px; background: ${P.navy}; position: relative; box-shadow: ${px(P.black, 2)}; }
.bar i { position: absolute; left: 0; top: 0; bottom: 0; width: 0%;
  background: repeating-linear-gradient(90deg, var(--fill, ${P.lime}) 0 6px, transparent 6px 8px); transition: width 0.15s steps(4); }
.pct { color: ${P.yellow}; min-width: 4.5em; text-align: right; }
.time { display: flex; gap: 8px; }
.bottom { position: absolute; left: 14px; right: 14px; bottom: 14px; display: flex; gap: 18px; align-items: flex-end; }
.weapons { display: flex; gap: 10px; }
.slot { background: ${P.black}; height: 56px; min-width: 64px; padding: 0 10px; display: grid; place-items: center;
  box-shadow: ${px(P.slate, 2)}; transition: transform 0.08s steps(2); }
.slot img { display: block; image-rendering: pixelated; opacity: 0.45; filter: saturate(0.4); }
.slot.on { background: ${P.navy}; box-shadow: ${px(P.yellow, 3)}, 0 0 0 3px ${P.black}, 0 0 18px 2px rgba(255,236,39,0.35);
  transform: translateY(-6px) scale(1.08); }
.slot.on img { opacity: 1; filter: none; animation: bob 0.5s steps(2) infinite; }
@keyframes bob { 50% { transform: translateY(-2px); } }
.slot.nade { min-width: 44px; margin-left: 8px; }
.slot.nade.ready { box-shadow: ${px(P.lime, 2)}; }
.slot.nade.ready img { opacity: 1; filter: none; }
.fuel img { image-rendering: pixelated; display: block; }
.fuel { width: 180px; display: flex; gap: 8px; align-items: center; }
.fuel .bar i { --fill: ${P.orange}; transition: none; }
.hint { position: absolute; left: 50%; bottom: 64px; transform: translateX(-50%); white-space: nowrap; font-size: 8px;
  color: ${P.white}; background: rgba(0,0,0,0.8); padding: 8px 12px; box-shadow: ${px(P.lavender, 2)};
  transition: opacity 1s; }
.hint kbd { color: ${P.yellow}; font-family: inherit; }
.hint.gone { opacity: 0; }
.banner { position: absolute; left: 0; right: 0; top: 34%; text-align: center; font-size: 34px; color: ${P.yellow};
  text-shadow: 4px 4px 0 ${P.red}, 8px 8px 0 ${P.black}; opacity: 0; transform: scale(0.6); }
.banner.show { animation: pop 1.6s steps(12) forwards; }
.banner small { display: block; font-size: 12px; color: ${P.white}; text-shadow: 2px 2px 0 ${P.black}; margin-top: 14px; }
@keyframes pop { 0% { opacity: 0; transform: scale(0.4); } 15% { opacity: 1; transform: scale(1.1); } 25% { transform: scale(1); }
  80% { opacity: 1; } 100% { opacity: 0; transform: scale(1); } }

.menu { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(5,6,15,0.72); pointer-events: auto; }
.menu.hidden { display: none; }
.window { background: ${P.black}; min-width: 340px; box-shadow: ${px(P.white, 4)}, 0 0 0 4px ${P.black}, 10px 10px 0 4px rgba(0,0,0,0.7); }
.window h2 { font-size: 18px; font-weight: normal; padding: 14px 18px 12px; background: ${P.plum}; color: ${P.yellow}; text-shadow: 3px 3px 0 ${P.black}; text-align: center; }
.window .body { padding: 18px; display: flex; flex-direction: column; gap: 10px; }
.stats { display: grid; grid-template-columns: 1fr auto; gap: 6px 18px; padding: 4px 4px 12px; color: ${P.silver}; }
.stats b { color: ${P.yellow}; font-weight: normal; text-align: right; }
.window button { all: unset; font-family: inherit; font-size: 11px; padding: 8px 12px 8px 28px; position: relative; color: ${P.white}; cursor: pointer; }
.window button::before { content: '>'; position: absolute; left: 10px; color: ${P.red}; opacity: 0; }
.window button.sel { background: ${P.navy}; color: ${P.yellow}; }
.window button.sel::before { opacity: 1; animation: blink 0.6s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }
.footer { font-size: 8px; color: ${P.slate}; text-align: center; padding: 0 18px 14px; }

.toast { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); background: ${P.black}; color: ${P.red};
  padding: 10px 14px; box-shadow: ${px(P.red, 2)}; font-size: 10px; pointer-events: none; }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export class Hud {
  readonly root: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  onAction: (a: MenuAction) => void = () => {};

  private pctEl: HTMLElement;
  private meterFill: HTMLElement;
  private clock: HTMLElement;
  private fuelFill: HTMLElement;
  private slots: HTMLElement[] = [];
  private nade: HTMLElement;
  private nadeReady = true;
  private hint: HTMLElement;
  private banner: HTMLElement;
  private menu: HTMLElement;
  private buttons: HTMLButtonElement[] = [];
  private sel = 0;
  private lastPct = -1;

  constructor(host: string) {
    this.root = el('div', 'root');
    this.canvas = el('canvas', 'game');
    const hud = el('div', 'hud');

    const top = el('div', 'top');
    const title = el('div', 'panel title');
    title.append(el('span', 'logo', 'WEB<b>BLASTER</b>'));
    const hostEl = el('span', 'host');
    hostEl.textContent = host;
    title.append(hostEl);
    const meter = el('div', 'panel meter');
    meter.append(el('span', 'label', 'WRECKED'));
    const bar = el('div', 'bar');
    this.meterFill = el('i');
    bar.append(this.meterFill);
    this.pctEl = el('span', 'pct', '0%');
    meter.append(bar, this.pctEl);
    const time = el('div', 'panel time');
    this.clock = el('span', '', '00:00');
    time.append(el('span', 'label', 'TIME'), this.clock);
    top.append(title, meter, time);

    const bottom = el('div', 'bottom');
    const weapons = el('div', 'weapons');
    for (const w of WEAPONS) {
      const s = el('div', 'slot');
      const img = el('img');
      img.src = iconUrl(WEAPON_ART[w.id].rows, 3);
      img.alt = w.id;
      s.append(img);
      this.slots.push(s);
      weapons.append(s);
    }
    this.nade = el('div', 'slot nade ready');
    const nadeImg = el('img');
    nadeImg.src = iconUrl(ICONS.grenade, 3);
    nadeImg.alt = 'grenade';
    this.nade.append(nadeImg);
    weapons.append(this.nade);
    const fuel = el('div', 'panel fuel');
    const fbar = el('div', 'bar');
    this.fuelFill = el('i');
    fbar.append(this.fuelFill);
    const flame = el('img');
    flame.src = iconUrl(ICONS.flame, 3);
    flame.alt = 'jetpack';
    fuel.append(flame, fbar);
    bottom.append(weapons, fuel);

    this.hint = el(
      'div',
      'hint',
      '<kbd>A D</kbd> RUN &nbsp; <kbd>SPACE</kbd> JUMP &middot; HOLD TO FLY &nbsp; <kbd>S</kbd> DROP &nbsp; <kbd>CLICK</kbd> SHOOT &nbsp; <kbd>R-CLICK</kbd> GRENADE &nbsp; <kbd>1-5</kbd> WEAPON &nbsp; <kbd>ESC</kbd> PAUSE',
    );
    this.banner = el('div', 'banner');
    this.menu = el('div', 'menu hidden');
    this.menu.addEventListener('mousedown', (e) => e.stopPropagation());

    hud.append(top, bottom, this.hint, this.banner);
    this.root.append(this.canvas, hud, this.menu, el('div', 'crt'));
  }

  setCrt(on: boolean): void {
    this.root.classList.toggle('crt-on', on);
  }

  setProgress(p: number): void {
    // Tenths of a percent below 10% so early progress is visible.
    const tenths = Math.floor(p * 1000);
    if (tenths === this.lastPct) return;
    this.lastPct = tenths;
    this.meterFill.style.width = `${tenths / 10}%`;
    this.meterFill.style.setProperty('--fill', p < 0.5 ? P.lime : p < 0.75 ? P.yellow : p < 0.9 ? P.orange : P.red);
    this.pctEl.textContent = p < 0.1 ? `${(tenths / 10).toFixed(1)}%` : `${Math.floor(p * 100)}%`;
  }

  setTime(sec: number): void {
    const s = Math.floor(sec);
    this.clock.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  setWeapon(i: number): void {
    this.slots.forEach((s, j) => s.classList.toggle('on', i === j));
  }

  setGrenadeReady(ready: boolean): void {
    if (ready === this.nadeReady) return;
    this.nadeReady = ready;
    this.nade.classList.toggle('ready', ready);
  }

  setFuel(f: number): void {
    this.fuelFill.style.width = `${Math.round(f * 100)}%`;
  }

  hideHint(): void {
    this.hint.classList.add('gone');
  }

  showBanner(text: string, sub = ''): void {
    this.banner.innerHTML = '';
    this.banner.append(text);
    if (sub) {
      const s = el('small');
      s.textContent = sub;
      this.banner.append(s);
    }
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
  }

  get menuOpen(): boolean {
    return !this.menu.classList.contains('hidden');
  }

  openMenu(title: string, items: MenuItem[], stats?: [string, string][], footer?: string): void {
    this.menu.innerHTML = '';
    const win = el('div', 'window');
    const h = el('h2');
    h.textContent = title;
    const body = el('div', 'body');
    if (stats) {
      const grid = el('div', 'stats');
      for (const [k, v] of stats) {
        const key = el('span');
        key.textContent = k;
        const val = el('b');
        val.textContent = v;
        grid.append(key, val);
      }
      body.append(grid);
    }
    this.buttons = items.map((item, i) => {
      const b = el('button');
      b.textContent = item.label;
      b.addEventListener('mouseenter', () => this.select(i));
      b.addEventListener('click', () => this.onAction(item.act));
      body.append(b);
      return b;
    });
    win.append(h, body);
    if (footer) win.append(el('div', 'footer', footer));
    this.menu.append(win);
    this.menu.classList.remove('hidden');
    this.root.classList.add('menu-open');
    this.select(0);
  }

  relabel(act: MenuAction, label: string, items: MenuItem[]): void {
    const i = items.findIndex((m) => m.act === act);
    if (i >= 0 && this.buttons[i]) this.buttons[i].textContent = label;
  }

  closeMenu(): void {
    this.menu.classList.add('hidden');
    this.root.classList.remove('menu-open');
  }

  /** Arrow / enter navigation for the open menu. Returns true if the key was used. */
  menuKey(code: string, items: MenuItem[]): boolean {
    if (!this.menuOpen) return false;
    if (code === 'ArrowDown' || code === 'KeyS') this.select((this.sel + 1) % this.buttons.length);
    else if (code === 'ArrowUp' || code === 'KeyW') this.select((this.sel - 1 + this.buttons.length) % this.buttons.length);
    else if (code === 'Enter' || code === 'Space') this.onAction(items[this.sel].act);
    else return false;
    return true;
  }

  toast(text: string, ms = 3000): void {
    const t = el('div', 'toast');
    t.textContent = text;
    this.root.append(t);
    setTimeout(() => t.remove(), ms);
  }

  private select(i: number): void {
    this.sel = i;
    this.buttons.forEach((b, j) => b.classList.toggle('sel', i === j));
  }
}
