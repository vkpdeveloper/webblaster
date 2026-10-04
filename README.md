# Web Blaster

Chrome extension (WXT, MV3) that turns the page you're on into a destructible retro pixel-art level.

## Develop

```sh
pnpm install
pnpm dev        # opens Chrome with the extension loaded and hot reload
pnpm build      # production build in .output/chrome-mv3
pnpm zip        # store-ready zip
pnpm compile    # typecheck
pnpm icons      # regenerate public/icon/*.png (also runs on install)
```

Load manually: `chrome://extensions` → Developer mode → Load unpacked → `.output/chrome-mv3`.

## Play

Start with the toolbar popup, `Alt+Shift+D`, or right-click → **Blast this page**. Trigger again to exit.

`A`/`D` run · `Space` jump, tap again to flip, hold to fly · `S` drop · click shoot · right-click / `G` grenade ·
`1-5` / wheel / `Q` `E` weapons · `Esc` pause · `M` mute

## How it works

1. **Capture** (`lib/capture.ts`): scrolls the page and stitches `captureVisibleTab` screenshots (up to N screens,
   throttled to Chrome's 2/sec limit). Fixed/sticky elements are hidden after the first shot so they don't repeat.
2. **Extract**: walks the live DOM with `getComputedStyle`/`getBoundingClientRect` for solids: one rect per word,
   media, form controls, boxes with a distinct background, and borders. Overflow clipping is respected.
3. **Level** (`lib/game/level.ts`): a 2px cell grid. Words are solid only where the screenshot has ink. Each cell
   remembers its element; once an element loses enough cells, the rest crumbles. Craters are erased from the
   picture with `destination-out`, revealing the void.
4. **Game** (`lib/game/game.ts`): fixed-step physics, five weapons plus grenades, particles, and a canvas overlay in a
   closed shadow root. Sound effects are synthesized (`lib/game/audio.ts`).

Permissions: `activeTab`, `scripting`, `storage`, `contextMenus`. There are no host permissions and no server; nothing
leaves the browser.

Font: Press Start 2P (SIL OFL, `public/fonts/OFL.txt`). Palette: PICO-8.
