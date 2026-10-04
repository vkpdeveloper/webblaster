import type { PageCapture } from '../capture';

/** CSS px per world cell. Everything destructible snaps to this grid. */
export const CELL = 2;
/** Rows of indestructible floor under the page. */
export const BEDROCK_ROWS = 16;

const EMPTY = 0;
const SOLID = 1;
const BEDROCK = 2;
/** Upper bound on level picture pixels, to keep memory sane on long pages. */
const MAX_IMAGE_PX = 26e6;
/** How far (sum of RGB differences) a cell must be from the text background to count as ink. */
const INK = 70;

function colorDistance(a: number, b: number): number {
  return Math.abs((a & 255) - (b & 255)) + Math.abs(((a >>> 8) & 255) - ((b >>> 8) & 255)) + Math.abs(((a >>> 16) & 255) - ((b >>> 16) & 255));
}

export type DebrisSink = (x: number, y: number, color: string) => void;

export class Level {
  /** Size in cells, including bedrock. */
  readonly w: number;
  readonly h: number;
  /** Rows that belong to the page (bedrock starts here). */
  readonly pageRows: number;
  readonly cssW: number;
  readonly cssH: number;
  readonly cells: Uint8Array;
  readonly colors: Uint32Array;
  /** Index of the page element each page cell belongs to, or -1. */
  private readonly owner: Int32Array;
  /** Cell bounding box per element: x0, y0, x1, y1 (exclusive). */
  private readonly box: Int32Array;
  /** Solid cells left per element. */
  private readonly left: Int32Array;
  /** An element crumbles once it has fewer cells left than this. */
  private readonly crumbleBelow: Int32Array;
  /** Elements that crumbled during the last carve(). */
  crumbled = 0;
  /** Center (cells) and size of each element that crumbled during the last carve(). */
  readonly collapses: { x: number; y: number; cells: number }[] = [];
  readonly image: HTMLCanvasElement;
  /** Level picture pixels per CSS px. */
  readonly scale: number;
  readonly total: number;
  remaining: number;
  private readonly ictx: CanvasRenderingContext2D;
  private readonly colorNames = new Map<number, string>();

  constructor(cap: PageCapture) {
    this.cssW = cap.width;
    this.cssH = cap.height;
    this.w = Math.ceil(cap.width / CELL);
    this.pageRows = Math.ceil(cap.height / CELL);
    this.h = this.pageRows + BEDROCK_ROWS;

    let scale = Math.min(cap.imageScale, 2);
    if (cap.width * cap.height * scale * scale > MAX_IMAGE_PX) scale = Math.sqrt(MAX_IMAGE_PX / (cap.width * cap.height));
    this.scale = scale;

    this.image = document.createElement('canvas');
    this.image.width = Math.ceil(cap.width * scale);
    this.image.height = Math.ceil(cap.height * scale);
    this.ictx = this.image.getContext('2d')!;
    this.ictx.imageSmoothingQuality = 'high';
    for (const shot of cap.shots) {
      const sw = Math.min(shot.img.naturalWidth, cap.width * cap.imageScale);
      const sh = shot.img.naturalHeight;
      this.ictx.drawImage(shot.img, 0, 0, sw, sh, 0, shot.y * scale, sw * (scale / cap.imageScale), sh * (scale / cap.imageScale));
    }

    // One averaged color per cell, used to tint debris.
    const small = document.createElement('canvas');
    small.width = this.w;
    small.height = this.pageRows;
    const sctx = small.getContext('2d', { willReadFrequently: true })!;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(this.image, 0, 0, this.w, this.pageRows);
    this.colors = new Uint32Array(sctx.getImageData(0, 0, this.w, this.pageRows).data.buffer);

    // Rasterize solids. Each cell remembers which page element it belongs to, so an element
    // that has lost most of its cells can crumble away as a whole.
    const n = cap.solids.length;
    this.cells = new Uint8Array(this.w * this.h);
    this.owner = new Int32Array(this.w * this.pageRows).fill(-1);
    this.box = new Int32Array(n * 4);
    cap.solids.forEach((r, i) => {
      const x0 = Math.max(0, Math.floor(r.x / CELL));
      const x1 = Math.min(this.w, Math.ceil((r.x + r.w) / CELL));
      const y0 = Math.max(0, Math.floor(r.y / CELL));
      const y1 = Math.min(this.pageRows, Math.ceil((r.y + r.h) / CELL));
      this.box.set([x0, y0, x1, y1], i * 4);
      const bg = r.text ? this.dominantColor(x0, y0, x1, y1) : 0;
      for (let y = y0; y < y1; y++) {
        const base = y * this.w;
        this.owner.fill(i, base + x0, base + x1);
        if (!r.text) {
          this.cells.fill(SOLID, base + x0, base + x1);
          continue;
        }
        for (let x = x0; x < x1; x++) if (colorDistance(this.colors[base + x], bg) > INK) this.cells[base + x] = SOLID;
      }
    });
    this.left = new Int32Array(n);
    let total = 0;
    for (let i = 0; i < this.pageRows * this.w; i++) {
      if (this.cells[i] !== SOLID) continue;
      total++;
      if (this.owner[i] >= 0) this.left[this.owner[i]]++;
    }
    this.crumbleBelow = new Int32Array(n);
    cap.solids.forEach((r, i) => {
      // Big things (images, cards) give way sooner, so they collapse in one satisfying go.
      const n = this.left[i];
      const keep = r.text ? 0.6 : n > 20000 ? 0.92 : n > 4000 ? 0.75 : 0.5;
      this.crumbleBelow[i] = Math.floor(this.left[i] * keep);
    });
    this.cells.fill(BEDROCK, this.pageRows * this.w);
    this.total = total;
    this.remaining = total;
  }

  get destroyed(): number {
    return this.total === 0 ? 0 : 1 - this.remaining / this.total;
  }

  /** Walls on the sides, open sky above, bedrock below. */
  solidAt(x: number, y: number): boolean {
    if (x < 0 || x >= this.w || y >= this.h) return true;
    if (y < 0) return false;
    return this.cells[y * this.w + x] !== EMPTY;
  }

  isBedrock(y: number): boolean {
    return y >= this.pageRows;
  }

  boxHits(x: number, y: number, w: number, h: number): boolean {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.ceil(x + w) - 1;
    const y1 = Math.ceil(y + h) - 1;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (this.solidAt(cx, cy)) return true;
    return false;
  }

  /**
   * Blast a pixelated disc out of the page, then crumble any element that lost too much.
   * Returns how many solid cells were destroyed. `debrisChance` is the probability that a
   * destroyed cell is reported to `sink`.
   */
  carve(cx: number, cy: number, r: number, sink?: DebrisSink, debrisChance = 1): number {
    const k = CELL * this.scale;
    const ri = Math.ceil(r);
    const ctx = this.ictx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    let removed = 0;
    const doomed: number[] = [];
    const row0 = Math.floor(cy);
    for (let dy = -ri; dy <= ri; dy++) {
      const y = row0 + dy;
      if (y < 0 || y >= this.pageRows) continue;
      const half = Math.sqrt(r * r - dy * dy);
      if (Number.isNaN(half)) continue;
      const x0 = Math.max(0, Math.round(cx - half));
      const x1 = Math.min(this.w - 1, Math.round(cx + half));
      if (x1 < x0) continue;
      const base = y * this.w;
      for (let x = x0; x <= x1; x++) {
        if (this.cells[base + x] !== SOLID) continue;
        this.cells[base + x] = EMPTY;
        removed++;
        const o = this.owner[base + x];
        if (o >= 0 && --this.left[o] < this.crumbleBelow[o] && this.left[o] >= 0) {
          this.crumbleBelow[o] = -1;
          doomed.push(o);
        }
        if (sink && Math.random() < debrisChance) sink(x + 0.5, y + 0.5, this.colorName(this.colors[base + x]));
      }
      this.pathRun(x0, x1, y, k);
    }

    this.crumbled = doomed.length;
    this.collapses.length = 0;
    for (const o of doomed) {
      const cells = this.crumble(o, k, sink);
      removed += cells;
      const b = this.box.subarray(o * 4, o * 4 + 4);
      this.collapses.push({ x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2, cells });
    }
    ctx.fill();
    ctx.restore();
    this.remaining -= removed;
    return removed;
  }

  /** Remove what is left of one element. Adds its cells to the current erase path. */
  private crumble(o: number, k: number, sink?: DebrisSink): number {
    const [x0, y0, x1, y1] = this.box.subarray(o * 4, o * 4 + 4);
    const chance = Math.min(1, 260 / Math.max(1, this.left[o]));
    let removed = 0;
    for (let y = y0; y < y1; y++) {
      const base = y * this.w;
      let run = -1;
      for (let x = x0; x <= x1; x++) {
        const mine = x < x1 && this.owner[base + x] === o;
        if (mine && this.cells[base + x] === SOLID) {
          this.cells[base + x] = EMPTY;
          removed++;
          if (sink && Math.random() < chance) sink(x + 0.5, y + 0.5, this.colorName(this.colors[base + x]));
        }
        if (mine && run < 0) run = x;
        if (!mine && run >= 0) {
          this.pathRun(run, x - 1, y, k);
          run = -1;
        }
      }
    }
    this.left[o] = 0;
    return removed;
  }

  /** Most common (quantized) color in a box: the background behind a word. */
  private dominantColor(x0: number, y0: number, x1: number, y1: number): number {
    const counts = new Map<number, number>();
    let best = 0;
    let bestN = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const c = this.colors[y * this.w + x];
        const q = c & 0xf0f0f0;
        const n = (counts.get(q) ?? 0) + 1;
        counts.set(q, n);
        if (n > bestN) {
          bestN = n;
          best = c;
        }
      }
    }
    return best;
  }

  private pathRun(x0: number, x1: number, y: number, k: number): void {
    const px0 = Math.floor(x0 * k);
    const py0 = Math.floor(y * k);
    this.ictx.rect(px0, py0, Math.ceil((x1 + 1) * k) - px0, Math.ceil((y + 1) * k) - py0);
  }

  /** March a ray until it hits something solid. Returns the hit point, or null. */
  raycast(x: number, y: number, dx: number, dy: number, maxDist: number): { x: number; y: number } | null {
    const step = 0.5;
    for (let d = 0; d < maxDist; d += step) {
      const px = x + dx * d;
      const py = y + dy * d;
      if (this.solidAt(Math.floor(px), Math.floor(py))) return { x: px, y: py };
    }
    return null;
  }

  colorAt(x: number, y: number): string {
    if (x < 0 || x >= this.w || y < 0 || y >= this.pageRows) return '#ab5236';
    return this.colorName(this.colors[y * this.w + x]);
  }

  private colorName(c: number): string {
    let name = this.colorNames.get(c);
    if (!name) {
      name = `rgb(${c & 255},${(c >>> 8) & 255},${(c >>> 16) & 255})`;
      if (this.colorNames.size < 4096) this.colorNames.set(c, name);
    }
    return name;
  }
}
