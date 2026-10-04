import { browser } from 'wxt/browser';

/** Inject the game into a tab. Returns an error message, or null on success. */
export async function blastTab(tabId: number): Promise<string | null> {
  try {
    await browser.scripting.executeScript({ target: { tabId }, files: ['/content-scripts/blaster.js'] });
    return null;
  } catch (e) {
    console.warn('[web-blaster] injection failed:', e);
    return "Can't blast this page. Browser pages and the Web Store are off limits.";
  }
}
