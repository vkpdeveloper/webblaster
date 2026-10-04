import { browser } from 'wxt/browser';
import type { CaptureResponse, ContentToBackground } from './messages';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Text is only solid where its glyphs have ink; everything else is a solid block. */
  text?: boolean;
}

export interface Shot {
  /** Top of this screenshot in level CSS px. */
  y: number;
  img: HTMLImageElement;
}

export interface PageCapture {
  shots: Shot[];
  /** Collidable material in level CSS px. */
  solids: Rect[];
  width: number;
  height: number;
  /** Top of what the user was looking at, in level CSS px. */
  viewTop: number;
  /** Screenshot pixels per CSS px. */
  imageScale: number;
  host: string;
}

interface Clip {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const MAX_NODES = 60000;
const MAX_RECTS = 40000;
// Chrome allows two captureVisibleTab calls per second.
const CAPTURE_GAP_MS = 520;

const SKIP = new Set(['script', 'style', 'head', 'meta', 'link', 'title', 'template', 'noscript', 'br', 'wbr', 'option', 'optgroup', 'datalist', 'map', 'area', 'track', 'source', 'param']);
const MEDIA = new Set(['img', 'svg', 'video', 'canvas', 'iframe', 'embed', 'object', 'picture']);
const CONTROLS = new Set(['input', 'textarea', 'select', 'button']);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));

export async function capturePage(maxScreens: number, ignore: Element | null): Promise<PageCapture> {
  const root = document.documentElement;
  const savedX = scrollX;
  const savedY = scrollY;
  const vh = innerHeight;
  const width = root.clientWidth;
  const docH = Math.max(document.scrollingElement?.scrollHeight ?? 0, document.body?.scrollHeight ?? 0, vh);
  const height = Math.min(docH, Math.max(1, maxScreens) * vh);
  // Keep the user's current view inside the level, with a screen of context above it.
  const startY = Math.max(0, Math.min(savedY - vh, docH - height));

  const hidden: { el: HTMLElement; value: string; priority: string }[] = [];
  let lastCapture = 0;
  try {
    await scrollToY(startY);
    const base = scrollY;
    const fixed: HTMLElement[] = [];
    const solids = extract(base, height, width, vh, fixed, ignore);

    const shots: Shot[] = [];
    let imageScale = devicePixelRatio;
    const screens = Math.max(1, Math.ceil(height / vh));
    for (let i = 0; i < screens; i++) {
      const target = Math.min(base + i * vh, base + height - vh);
      if (i > 0) await scrollToY(target);
      const wait = CAPTURE_GAP_MS - (performance.now() - lastCapture);
      if (wait > 0) await sleep(wait);
      lastCapture = performance.now();
      const img = await screenshot();
      imageScale = img.naturalWidth / innerWidth;
      shots.push({ y: scrollY - base, img });
      if (i === 0) {
        // Fixed and sticky elements already appear in the first shot; hide them so they don't repeat.
        for (const el of fixed) {
          hidden.push({ el, value: el.style.getPropertyValue('visibility'), priority: el.style.getPropertyPriority('visibility') });
          el.style.setProperty('visibility', 'hidden', 'important');
        }
      }
    }

    return {
      shots,
      solids,
      width,
      height,
      viewTop: savedY - base,
      imageScale,
      host: location.hostname || location.href.slice(0, 40),
    };
  } finally {
    for (const h of hidden) h.el.style.setProperty('visibility', h.value, h.priority);
    window.scrollTo({ left: savedX, top: savedY, behavior: 'instant' });
  }
}

async function scrollToY(y: number): Promise<void> {
  window.scrollTo({ left: 0, top: y, behavior: 'instant' });
  await frame();
  await frame();
  await sleep(60);
}

async function screenshot(): Promise<HTMLImageElement> {
  const res: CaptureResponse = await browser.runtime.sendMessage({ type: 'capture' } satisfies ContentToBackground);
  if (!res?.ok) throw new Error(res?.error ?? 'Screenshot failed');
  const img = new Image();
  img.src = res.dataUrl;
  await img.decode();
  return img;
}

// ---- DOM -> collision geometry ----

type RGBA = [number, number, number, number];
const colorCache = new Map<string, RGBA | null>();
let probe: CanvasRenderingContext2D | null = null;

function parseColor(css: string): RGBA | null {
  const cached = colorCache.get(css);
  if (cached !== undefined) return cached;
  let out: RGBA | null = null;
  const m = css.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    out = [+m[1], +m[2], +m[3], a];
  } else if (css && css !== 'transparent') {
    // Modern color spaces (oklch, color(...)): let canvas convert them.
    probe ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (probe) {
      probe.clearRect(0, 0, 1, 1);
      probe.fillStyle = '#0000';
      probe.fillStyle = css;
      probe.fillRect(0, 0, 1, 1);
      const d = probe.getImageData(0, 0, 1, 1).data;
      out = [d[0], d[1], d[2], d[3] / 255];
    }
  }
  if (out && out[3] < 0.02) out = null;
  colorCache.set(css, out);
  return out;
}

function colorDistance(a: RGBA, b: RGBA | null): number {
  if (!b) return 999;
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

function extract(top: number, height: number, width: number, vh: number, fixed: HTMLElement[], ignore: Element | null): Rect[] {
  const out: Rect[] = [];
  const sx = scrollX;
  const range = document.createRange();
  const bigArea = width * vh * 0.3;
  let nodes = 0;

  const add = (x: number, y: number, w: number, h: number, clip: Clip | null, text = false) => {
    let x0 = x + sx;
    let y0 = y + scrollY - top;
    let x1 = x0 + w;
    let y1 = y0 + h;
    if (clip) {
      x0 = Math.max(x0, clip.x0);
      y0 = Math.max(y0, clip.y0);
      x1 = Math.min(x1, clip.x1);
      y1 = Math.min(y1, clip.y1);
    }
    x0 = Math.max(0, x0);
    y0 = Math.max(0, y0);
    x1 = Math.min(width, x1);
    y1 = Math.min(height, y1);
    if (x1 - x0 >= 1 && y1 - y0 >= 1 && out.length < MAX_RECTS) out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, text });
  };

  const walk = (el: Element, parentBg: RGBA | null, clip: Clip | null) => {
    if (el === ignore || ++nodes > MAX_NODES) return;
    const tag = el.localName;
    if (SKIP.has(tag)) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || parseFloat(cs.opacity) < 0.05) return;
    if ((cs.position === 'fixed' || cs.position === 'sticky') && el instanceof HTMLElement) fixed.push(el);

    const r = el.getBoundingClientRect();
    const visible = cs.visibility !== 'hidden' && cs.visibility !== 'collapse';
    const hasBox = r.width >= 2 && r.height >= 2;
    if (visible && hasBox && (MEDIA.has(tag) || CONTROLS.has(tag))) {
      add(r.left, r.top, r.width, r.height, clip);
      return;
    }
    if (MEDIA.has(tag)) return;

    let bg = parentBg;
    if (visible && hasBox) {
      const own = parseColor(cs.backgroundColor);
      const hasImage = cs.backgroundImage.includes('url(') || cs.backgroundImage.includes('gradient(');
      const standsOut = (own && own[3] > 0.5 && colorDistance(own, parentBg) > 24) || hasImage;
      const small = r.width * r.height < bigArea && r.height < vh * 0.6;
      if (standsOut && small && tag !== 'html' && tag !== 'body') add(r.left, r.top, r.width, r.height, clip);
      if (own && own[3] > 0.5) bg = own;

      addBorder(cs.borderTopWidth, cs.borderTopStyle, cs.borderTopColor, (t) => add(r.left, r.top, r.width, t, clip));
      addBorder(cs.borderBottomWidth, cs.borderBottomStyle, cs.borderBottomColor, (t) => add(r.left, r.bottom - t, r.width, t, clip));
      addBorder(cs.borderLeftWidth, cs.borderLeftStyle, cs.borderLeftColor, (t) => add(r.left, r.top, t, r.height, clip));
      addBorder(cs.borderRightWidth, cs.borderRightStyle, cs.borderRightColor, (t) => add(r.right - t, r.top, t, r.height, clip));
    }

    let childClip = clip;
    if ((cs.overflowX !== 'visible' || cs.overflowY !== 'visible') && tag !== 'html' && tag !== 'body') {
      const c = { x0: r.left + sx, y0: r.top + scrollY - top, x1: r.right + sx, y1: r.bottom + scrollY - top };
      childClip = clip ? { x0: Math.max(c.x0, clip.x0), y0: Math.max(c.y0, clip.y0), x1: Math.min(c.x1, clip.x1), y1: Math.min(c.y1, clip.y1) } : c;
    }

    const textVisible = visible && (parseColor(cs.color)?.[3] ?? 0) > 0.1;
    const children = el.shadowRoot ? [...el.shadowRoot.childNodes, ...el.childNodes] : el.childNodes;
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? '';
        if (!textVisible || !text.trim()) continue;
        // One solid per word, so words can be shot off the page individually.
        for (const m of text.matchAll(/\S+/g)) {
          range.setStart(child, m.index);
          range.setEnd(child, m.index + m[0].length);
          for (const tr of range.getClientRects()) add(tr.left, tr.top, tr.width, tr.height, childClip, true);
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child as Element, bg, childClip);
      }
    }
  };

  walk(document.documentElement, null, null);
  return out;
}

function addBorder(width: string, style: string, color: string, push: (thickness: number) => void): void {
  const w = parseFloat(width);
  if (w < 1 || style === 'none' || style === 'hidden') return;
  const c = parseColor(color);
  if (!c || c[3] < 0.3) return;
  push(Math.max(2, w));
}
