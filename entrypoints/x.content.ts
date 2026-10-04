import { DEFAULT_SETTINGS, loadSettings, settingsItem } from '@/lib/settings';
import { Sidekick } from '@/lib/sidekick';

// On x.com the commando sticks around and shoots Like, Repost and Post for you.
export default defineContentScript({
  matches: ['*://x.com/*', '*://twitter.com/*', '*://mobile.x.com/*', '*://mobile.twitter.com/*'],
  runAt: 'document_idle',
  async main(ctx) {
    const settings = await loadSettings();
    let sidekick: Sidekick | null = settings.xSidekick ? new Sidekick(settings.sound) : null;

    const unwatch = settingsItem.watch((saved) => {
      const s = { ...DEFAULT_SETTINGS, ...saved };
      if (s.xSidekick && !sidekick) sidekick = new Sidekick(s.sound);
      else if (!s.xSidekick && sidekick) {
        sidekick.destroy();
        sidekick = null;
      }
      sidekick?.setSound(s.sound);
    });

    ctx.onInvalidated(() => {
      unwatch();
      sidekick?.destroy();
    });
  },
});
