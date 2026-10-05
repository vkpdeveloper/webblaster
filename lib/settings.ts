import { storage } from '#imports';

export interface Settings {
  sound: boolean;
  crt: boolean;
  /** How many viewport-heights of the page are captured into the level. */
  maxScreens: number;
  /** Enemy soldiers storm the page while you play. */
  enemies: boolean;
  /** On x.com, the commando shoots Like, Bookmark, Repost and Post for you. */
  xSidekick: boolean;
}

export const DEFAULT_SETTINGS: Settings = { sound: true, crt: true, maxScreens: 3, enemies: true, xSidekick: true };

export interface Stats {
  hiScore?: number;
  pagesDestroyed: number;
  shotsFired: number;
  pixelsBlasted: number;
}

export const settingsItem = storage.defineItem<Partial<Settings>>('local:settings', {
  fallback: DEFAULT_SETTINGS,
});

/** Saved settings over the defaults, so settings added in later versions get sensible values. */
export async function loadSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await settingsItem.getValue()) };
}

export const statsItem = storage.defineItem<Stats>('local:stats', {
  fallback: { pagesDestroyed: 0, shotsFired: 0, pixelsBlasted: 0 },
});

export async function addStats(delta: Partial<Stats>): Promise<void> {
  const s = await statsItem.getValue();
  await statsItem.setValue({
    pagesDestroyed: s.pagesDestroyed + (delta.pagesDestroyed ?? 0),
    shotsFired: s.shotsFired + (delta.shotsFired ?? 0),
    pixelsBlasted: s.pixelsBlasted + (delta.pixelsBlasted ?? 0),
    hiScore: Math.max(s.hiScore ?? 0, delta.hiScore ?? 0),
  });
}
