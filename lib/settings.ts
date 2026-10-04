import { storage } from '#imports';

export interface Settings {
  sound: boolean;
  crt: boolean;
  /** How many viewport-heights of the page are captured into the level. */
  maxScreens: number;
}

export interface Stats {
  pagesDestroyed: number;
  shotsFired: number;
  pixelsBlasted: number;
}

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: { sound: true, crt: true, maxScreens: 3 },
});

export const statsItem = storage.defineItem<Stats>('local:stats', {
  fallback: { pagesDestroyed: 0, shotsFired: 0, pixelsBlasted: 0 },
});

export async function addStats(delta: Partial<Stats>): Promise<void> {
  const s = await statsItem.getValue();
  await statsItem.setValue({
    pagesDestroyed: s.pagesDestroyed + (delta.pagesDestroyed ?? 0),
    shotsFired: s.shotsFired + (delta.shotsFired ?? 0),
    pixelsBlasted: s.pixelsBlasted + (delta.pixelsBlasted ?? 0),
  });
}
