/** Family name the pixel font is registered under. */
export const FONT = 'WBPixel';

/** Register the bundled pixel font with the page, once. Falls back to monospace if it fails. */
export async function loadFont(): Promise<void> {
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
