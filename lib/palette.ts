// PICO-8 palette. Every sprite, effect and UI color in the game comes from here.
export const P = {
  black: '#000000',
  navy: '#1d2b53',
  plum: '#7e2553',
  green: '#008751',
  brown: '#ab5236',
  slate: '#5f574f',
  silver: '#c2c3c7',
  white: '#fff1e8',
  red: '#ff004d',
  orange: '#ffa300',
  yellow: '#ffec27',
  lime: '#00e436',
  blue: '#29adff',
  lavender: '#83769c',
  pink: '#ff77a8',
  peach: '#ffccaa',
} as const;

export type PaletteColor = (typeof P)[keyof typeof P];

export const FIRE: PaletteColor[] = [P.white, P.yellow, P.orange, P.red, P.plum];
export const SMOKE: PaletteColor[] = [P.silver, P.lavender, P.slate];
