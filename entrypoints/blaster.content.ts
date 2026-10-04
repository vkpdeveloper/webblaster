import { capturePage } from '@/lib/capture';
import { Game } from '@/lib/game/game';
import { P } from '@/lib/palette';
import { addStats, settingsItem } from '@/lib/settings';

const FONT = 'WBPixel';

interface Session {
  game: Game | null;
}

declare global {
  interface Window {
    __webBlaster?: Session;
  }
}

export default defineContentScript({
  registration: 'runtime',
  async main() {
    // Triggering the extension again on the same tab exits the game.
    const existing = window.__webBlaster;
    if (existing) {
      existing.game?.quit();
      return;
    }
    const session: Session = { game: null };
    window.__webBlaster = session;

    try {
      const [settings] = await Promise.all([settingsItem.getValue(), loadFont()]);
      const capture = await capturePage(settings.maxScreens, null);
      session.game = new Game(capture, settings, {
        onQuit: () => {
          delete window.__webBlaster;
        },
        onStats: ({ won, shots, pixels }) => void addStats({ pagesDestroyed: won ? 1 : 0, shotsFired: shots, pixelsBlasted: pixels }),
        onSettings: (s) => void settingsItem.setValue(s),
      });
    } catch (e) {
      console.warn('[web-blaster] could not start:', e);
      delete window.__webBlaster;
      toast("WEB BLASTER: CAN'T CAPTURE THIS PAGE");
    }
  },
});

async function loadFont(): Promise<void> {
  if ([...document.fonts].some((f) => f.family === FONT)) return;
  try {
    const res = await fetch(browser.runtime.getURL('/fonts/PressStart2P.ttf'));
    const face = new FontFace(FONT, await res.arrayBuffer());
    await face.load();
    document.fonts.add(face);
  } catch (e) {
    console.warn('[web-blaster] font failed, using monospace:', e);
  }
}

function toast(text: string): void {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:2147483647;background:${P.black};color:${P.red};font:10px ${FONT},monospace;padding:10px 14px;box-shadow:2px 0 ${P.red},-2px 0 ${P.red},0 2px ${P.red},0 -2px ${P.red};`;
  document.documentElement.append(el);
  setTimeout(() => el.remove(), 3500);
}
