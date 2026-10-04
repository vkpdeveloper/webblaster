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

// The hero faces right. Rows 0-16 are shared; legs change per pose.
const TOP = [
  '......kkkkk.....',
  '.....kwwwwwk....',
  '....kwwwwwwwk...',
  '....kwwkkkkkkk..',
  '....kwkbbbbwbbk.',
  '....kwkbbbwbbbk.',
  '....kwkbnbbbbbk.',
  '....kwwkkkkkkk..',
  '.....kwwwwwwk...',
  '..kkk.kkrrkk....',
  '.kgsgkrrrrrrk...',
  '.kgsgkrrrrrrrk..',
  '.kgsgkrryyrrrk..',
  '.kgsgkrrrrrrrk..',
  '.kgggkprrrrrpk..',
  '..kokkpppppppk..',
  '..kyk.kkkkkkk...',
];

const LEGS = {
  stand: [
    '......kggkkggk..',
    '......kgk..kgk..',
    '......kgk..kgk..',
    '......kgk..kgk..',
    '.....kkgk..kgkk.',
    '.....kwwwk.kwwwk',
    '.....kkkkk.kkkkk',
  ],
  run1: [
    '......kggkkggk..',
    '.....kgk...kgk..',
    '....kgk.....kgk.',
    '...kgk......kgk.',
    '..kwwk......kgkk',
    '..kkkk......kwwk',
    '............kkkk',
  ],
  run2: [
    '......kggkkggk..',
    '.......kgkkgk...',
    '.......kgkgk....',
    '........kggk....',
    '........kgk.....',
    '.......kwwwk....',
    '.......kkkkk....',
  ],
  air: [
    '......kggkkggk..',
    '.....kgk...kgk..',
    '....kgk....kgk..',
    '...kwwk...kwwk..',
    '...kkkk...kkkk..',
    '................',
    '................',
  ],
};

export type Pose = keyof typeof LEGS;

/** Hero sprite size in sprite pixels (one sprite pixel = one cell). */
export const SPRITE_W = 16;
export const SPRITE_H = 24;

export type WeaponId = 'blaster' | 'smg' | 'shotgun' | 'rocket' | 'laser';

export interface WeaponArt {
  rows: string[];
  /** Where the hand holds it. */
  pivot: [number, number];
  /** Where shots come out. */
  muzzle: [number, number];
}

export const WEAPON_ART: Record<WeaponId, WeaponArt> = {
  blaster: {
    rows: [
      '...kkkkk......',
      '..krrrrrkkkkk.',
      '.krrwrrrsssskk',
      '.krrrrrrkkkkbk',
      '..kkksskk.....',
      '....kssk......',
      '....kssk......',
      '.....kk.......',
    ],
    pivot: [5, 5],
    muzzle: [14, 3],
  },
  smg: {
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
  shotgun: {
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

export const ICONS = { grenade: GRENADE, flame: FLAME };

export class Sprites {
  readonly hero: Record<Pose, { right: HTMLCanvasElement; left: HTMLCanvasElement }>;
  /** Weapons pointing right, plus a vertically flipped copy used when aiming left. */
  readonly weapons: Record<WeaponId, { up: HTMLCanvasElement; down: HTMLCanvasElement }>;
  readonly grenade = paint(GRENADE);
  readonly rocket = paint(ROCKET);

  constructor() {
    const make = (legs: string[]) => {
      const right = paint([...TOP, ...legs]);
      return { right, left: mirror(right) };
    };
    this.hero = { stand: make(LEGS.stand), run1: make(LEGS.run1), run2: make(LEGS.run2), air: make(LEGS.air) };
    const gun = (id: WeaponId) => {
      const up = paint(WEAPON_ART[id].rows);
      return { up, down: mirror(up, true) };
    };
    this.weapons = { blaster: gun('blaster'), smg: gun('smg'), shotgun: gun('shotgun'), rocket: gun('rocket'), laser: gun('laser') };
  }
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
