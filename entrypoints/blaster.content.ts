import { capturePage } from '@/lib/capture';
import { FONT, loadFont } from '@/lib/font';
import { Game } from '@/lib/game/game';
import { P } from '@/lib/palette';
import { addStats, loadSettings, settingsItem, statsItem } from '@/lib/settings';

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
      const [settings, stats] = await Promise.all([loadSettings(), statsItem.getValue(), loadFont()]);
      const capture = await capturePage(settings.maxScreens, null);
      session.game = new Game(capture, settings, {
        stage: stats.pagesDestroyed + 1,
        onQuit: () => {
          delete window.__webBlaster;
        },
        onStats: ({ won, shots, pixels, hiScore }) =>
          void addStats({ pagesDestroyed: won ? 1 : 0, shotsFired: shots, pixelsBlasted: pixels, hiScore }),
        onSettings: (s) => void settingsItem.setValue(s),
      });
    } catch (e) {
      console.warn('[web-blaster] could not start:', e);
      delete window.__webBlaster;
      toast("WEB BLASTER: CAN'T CAPTURE THIS PAGE");
    }
  },
});

function toast(text: string): void {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:2147483647;background:${P.black};color:${P.red};font:10px ${FONT},monospace;padding:10px 14px;box-shadow:2px 0 ${P.red},-2px 0 ${P.red},0 2px ${P.red},0 -2px ${P.red};`;
  document.documentElement.append(el);
  setTimeout(() => el.remove(), 3500);
}
