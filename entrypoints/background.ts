import type { CaptureResponse, ContentToBackground } from '@/lib/messages';
import { blastTab } from '@/lib/inject';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: 'blast-page',
      title: 'Blast this page',
      contexts: ['page', 'selection', 'link', 'image'],
    });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'blast-page' && tab?.id) void triggered(tab.id);
  });

  browser.commands.onCommand.addListener((command, tab) => {
    if (command === 'destroy-page' && tab?.id) void triggered(tab.id);
  });

  browser.runtime.onMessage.addListener((msg: ContentToBackground, sender, sendResponse) => {
    if (msg?.type !== 'capture' || !sender.tab) return;
    browser.tabs
      .captureVisibleTab(sender.tab.windowId, { format: 'png' })
      .then((dataUrl) => sendResponse({ ok: true, dataUrl } satisfies CaptureResponse))
      .catch((e: unknown) => sendResponse({ ok: false, error: String(e) } satisfies CaptureResponse));
    return true;
  });
});

async function triggered(tabId: number): Promise<void> {
  const err = await blastTab(tabId);
  if (!err) return;
  await browser.action.setBadgeBackgroundColor({ color: '#ff004d', tabId });
  await browser.action.setBadgeText({ text: 'NO', tabId });
  setTimeout(() => void browser.action.setBadgeText({ text: '', tabId }), 2500);
}
