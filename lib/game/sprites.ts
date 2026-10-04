import { P } from '../palette';

// Hand-drawn pixel art. One character per pixel; '.' is transparent.
const KEY: Record<string, string> = {
  k: P.black,
  w: P.white,
  s: P.silver,
  g: P.slate,
  b: P.blue,
  n: P.navy,
  r: P.red,
  p: P.plum,
  y: P.yellow,
  o: P.orange,
  l: P.lavender,
  B: P.brown,
  G: P.green,
  L: P.lime,
  K: P.pink,
  e: P.peach,
};

// The hero is a run-and-gun commando facing right. Rows 0-16 are shared; legs change per pose.
const TOP = [
  '......kkkkk.....',
  '.....kkkkkkkk...',
  '.rr.krrrrrrrrk..',
  'rr..kkeeeekeek..',
  'r....keeeeeeeek.',
  '.....keeeeeBBk..',
  '......keeeek....',
  '.....kBeeeeBk...',
  '...kkeeeeeeeekk.',
  '..keeeBeeeeBeeek',
  '..keeeeBBBBeeek.',
  '..kBeeeeeeeeeBk.',
  '...kBeeBeeBeeBk.',
  '....keeBeeBeek..',
  '....kkkkkkkkk...',
  '....kbbbybbbk...',
  '....kbbbbbbnk...',
];

const LEGS = {
  stand: ['....kbbnkbbnk...', '....kbbk.kbbk...', '....kbnk.kbnk...', '....kbbk.kbbk...', '....kBBk.kBBk...', '...kBBBk.kBBBk..', '...kkkkk.kkkkk..'],
  run1: ['....kbbnkbbnk...', '...kbbk..kbbk...', '..kbnk....kbnk..', '.kbbk......kbbk.', '.kBBk......kBBk.', 'kBBk........kBBk', 'kkkk........kkkk'],
  run2: ['....kbbnkbbnk...', '.....kbbkbbk....', '.....kbnkbnk....', '......kbbbk.....', '......kBBk......', '......kBBBk.....', '......kkkkk.....'],
  run3: ['....kbbnkbbnk...', '....kbbkkbbk....', '...kbnk..kbnk...', '..kbbk....kbbk..', '..kBBk....kBBk..', '.kBBBk....kBBBk.', '.kkkkk....kkkkk.'],
  air: ['....kbbnkbbnk...', '....kbbk.kbbk...', '.....kbnkbnk....', '.....kbbkbbk....', '.....kBBkBBk....', '....kBBBkBBBk...', '....kkkkkkkkk...'],
};

/** The somersault jump: the commando curls into a spinning ball. */
const BALL = [
  '....kkkkkk....',
  '..kkeeeerrkk..',
  '.keeeeekkrrrk.',
  '.keBeeekeeerk.',
  'kbbkeeeeeeeeek',
  'kbbbkkeeBBeeek',
  'kbbbbbkeeeeeek',
  'kbnbbbbkkeeeek',
  'kbnnbbbbbkkeek',
  'kkbBBbbbbbbkek',
  '.kBBBkbbnbbbk.',
  '.kkkkkbnnbbk..',
  '..kkkkkkkkk...',
  '....kkkk......',
];

// Enemy soldiers: helmet, red goggles, grey fatigues. Legs reuse the hero's with a uniform palette.
const SOLDIER_TOP = [
  '......kkkkk.....',
  '.....kgggggk....',
  '....kggggggsk...',
  '....kkkkkkkkkk..',
  '.....keeerrek...',
  '.....keeeeek....',
  '......kBeek.....',
  '....kkllllkk....',
  '...kllllllllk...',
  '...klglllglllk..',
  '...kllllllllk...',
  '...kglllllllk...',
  '...kllkkkkllk...',
  '...kllkyykllk...',
  '....kgggggggk...',
  '....kggggggggk..',
  '....kggkkkggk...',
];
const soldierLegs = (rows: string[]) => rows.map((r) => r.replace(/b/g, 'g').replace(/n/g, 'l').replace(/B/g, 'k'));

const MEDAL = ['.kr.rk.', '.krkrk.', '..krk..', '.kyyyk.', 'kyywyyk', 'kyyyyok', 'kyyyook', '.kyook.', '..kkk..'];
const HEART = ['.KK.KK.', 'KKKKKKK', 'KKwKKKK', '.KKKKK.', '..KKK..', '...K...'];
const ARROWS = ['..L....', '.LLL...', 'L.L..L.', '..L..L.', '..L.LLL', '.....L.'];

export type Pose = keyof typeof LEGS;

/** Hero sprite size in sprite pixels (one sprite pixel = one cell). */
export const SPRITE_W = 16;
export const SPRITE_H = 24;

export type WeaponId = 'rifle' | 'machine' | 'spread' | 'rocket' | 'laser';

export interface WeaponArt {
  rows: string[];
  /** Where the hand holds it. */
  pivot: [number, number];
  /** Where shots come out. */
  muzzle: [number, number];
}

export const WEAPON_ART: Record<WeaponId, WeaponArt> = {
  rifle: {
    rows: [
      '......kkkkkkkk....',
      'kkkk.kggggggggkkkk',
      'kBBBkkgssssgggggsk',
      'kBBBBkkkkgkkkkkkk.',
      '.kkBBk.kgk.kgk....',
      '...kk..kgk.kgk....',
      '.......kkk.kkk....',
    ],
    pivot: [8, 4],
    muzzle: [18, 2],
  },
  machine: {
    rows: [
      '..kkkkkkkkk.....',
      '.kgggggggggkkkkk',
      '.kgssssgggggssgk',
      '.kkkkgkkkgkkkkk.',
      '....kgk..kgk....',
      '....kgk..kgk....',
      '....kkk..kgk....',
      '.........kkk....',
    ],
    pivot: [5, 4],
    muzzle: [16, 2],
  },
  spread: {
    rows: [
      '......kkkkkkkkkkkkkk',
      '.kkkkkgssssssssssssk',
      'kBBBBkgkkkkkkkkkkkkk',
      'kBBBBBkgsk.kBBBBk...',
      '.kkBBBkgsk.kkkkkk...',
      '...kkBkkk...........',
      '.....kk.............',
    ],
    pivot: [7, 4],
    muzzle: [20, 1],
  },
  rocket: {
    rows: [
      '...kkkkkkkkkkkkkkkkk..',
      '..kGGGGGGGGGGGGGGGGGkk',
      'kkkGGyGGGGGGGGGGGGGGrk',
      'kgkGGGGGGGGGGGGGGGGGrk',
      'kkkGGGGGGGGGGGGGGGGGkk',
      '...kkkkkkkgkkkkkkkkk..',
      '.........kgk..........',
      '.........kkk..........',
    ],
    pivot: [10, 6],
    muzzle: [22, 3],
  },
  laser: {
    rows: [
      '...kkkkkkkkkk.......',
      '..kllllllllllkkkkk..',
      '.klwwwwwwwwwlKpKpKkk',
      '.kllllkkkklllkkkkkwk',
      '..kkklk..kkkk...kk..',
      '....klk.............',
      '....kkk.............',
    ],
    pivot: [5, 5],
    muzzle: [20, 2],
  },
};

const GRENADE = ['...kk...', '..kssk..', '.kkkkkk.', 'kGGGGlGk', 'kGkGkGGk', 'kGGGGGGk', 'kGkGkGGk', '.kGGGGk.', '..kkkk..'];
const ROCKET = ['kk..kkkkkk..', 'kokkwwwwwwrk', 'kyowwwwwwwrr', 'kokkwwwwwwrk', 'kk..kkkkkk..'];
const FLAME = ['..k...', '.kyk..', '.kyyk.', 'kyywyk', 'kowyok', 'korrok', '.krrk.', '..kk..'];

export function paint(rows: string[], scale = 1): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(...rows.map((r) => r.length)) * scale;
  c.height = rows.length * scale;
  const ctx = c.getContext('2d')!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = KEY[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  });
  return c;
}

function mirror(src: HTMLCanvasElement, vertical = false): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  if (vertical) {
    ctx.translate(0, src.height);
    ctx.scale(1, -1);
  } else {
    ctx.translate(src.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src, 0, 0);
  return c;
}

/** Data URL of a sprite blown up for the HUD. */
export function iconUrl(rows: string[], scale: number): string {
  return paint(rows, scale).toDataURL();
}

export const ICONS = { grenade: GRENADE, flame: FLAME, medal: MEDAL, heart: HEART, arrows: ARROWS };

type Facing = { right: HTMLCanvasElement; left: HTMLCanvasElement };

export class Sprites {
  readonly hero: Record<Pose, Facing>;
  readonly ball = paint(BALL);
  readonly soldier: Record<Pose, Facing>;
  /** Weapons pointing right, plus a vertically flipped copy used when aiming left. */
  readonly weapons: Record<WeaponId, { up: HTMLCanvasElement; down: HTMLCanvasElement }>;
  readonly grenade = paint(GRENADE);
  readonly rocket = paint(ROCKET);
  readonly heart = paint(HEART);
  readonly arrows = paint(ARROWS);
  readonly medal = paint(MEDAL);
  /** NES-style explosion animation frames. */
  readonly boom = explosionFrames();

  constructor() {
    const make = (top: string[], legs: string[]): Facing => {
      const right = paint([...top, ...legs]);
      return { right, left: mirror(right) };
    };
    const poses = Object.keys(LEGS) as Pose[];
    this.hero = Object.fromEntries(poses.map((p) => [p, make(TOP, LEGS[p])])) as Record<Pose, Facing>;
    this.soldier = Object.fromEntries(poses.map((p) => [p, make(SOLDIER_TOP, soldierLegs(LEGS[p]))])) as Record<Pose, Facing>;
    const gun = (id: WeaponId) => {
      const up = paint(WEAPON_ART[id].rows);
      return { up, down: mirror(up, true) };
    };
    this.weapons = { rifle: gun('rifle'), machine: gun('machine'), spread: gun('spread'), rocket: gun('rocket'), laser: gun('laser') };
  }
}

/**
 * Six frames of a chunky NES-style blast: a white-hot core that swells into
 * yellow, orange and red rings, then breaks up into a ragged smoke ring.
 */
function explosionFrames(): HTMLCanvasElement[] {
  const size = 32;
  const c = size / 2;
  const frames: HTMLCanvasElement[] = [];
  const colors = [P.white, P.yellow, P.orange, P.red, P.plum];
  for (let f = 0; f < 6; f++) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const outer = 5 + f * 2.2;
    const hole = f < 3 ? 0 : (f - 2) * 3.2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Lumpy edge so it reads as fire, not a circle.
        const a = Math.atan2(y - c, x - c);
        const d = Math.hypot(x - c + 0.5, y - c + 0.5) * (1 + 0.14 * Math.sin(a * 5 + f * 1.7));
        if (d > outer || d < hole) continue;
        if (f >= 4 && (x * 7 + y * 13 + f) % 5 === 0) continue;
        const band = Math.min(colors.length - 1, Math.floor(((d - hole) / Math.max(1, outer - hole)) * 3) + Math.max(0, f - 2));
        ctx.fillStyle = f >= 5 ? P.slate : colors[band];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    frames.push(canvas);
  }
  return frames;
}

/** A retro tile used for the indestructible floor under the page. */
export function brickTile(cell: number): HTMLCanvasElement {
  const rows = [
    'bbbbbbbkbbbbbbbk',
    'pbbbbbbkpbbbbbbk',
    'ppppppppkppppppp',
    'kkkkkkkkkkkkkkkk',
    'bbbkbbbbbbbkbbbb',
    'bbbkpbbbbbbkpbbb',
    'pppkpppppppkpppp',
    'kkkkkkkkkkkkkkkk',
  ].map((r) => r.replace(/b/g, 'X'));
  const c = document.createElement('canvas');
  c.width = rows[0].length * cell;
  c.height = rows.length * cell;
  const ctx = c.getContext('2d')!;
  const map: Record<string, string> = { X: P.brown, p: P.plum, k: P.black };
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      ctx.fillStyle = map[row[x]];
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  });
  return c;
}

/** Dark arcade backdrop revealed wherever the page has been blasted away. */
export function voidTile(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0b1030';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = P.navy;
  ctx.fillRect(0, 0, 32, 2);
  ctx.fillRect(0, 0, 2, 32);
  ctx.fillStyle = P.plum;
  ctx.fillRect(16, 16, 2, 2);
  return c;
}
