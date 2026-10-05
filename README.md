# Web Blaster

Chrome extension (WXT, MV3) that turns the page you're on into a destructible retro pixel-art level.

## Install

Download the latest build from [Releases](https://github.com/vkpdeveloper/webblaster/releases/latest):

1. Download `webblaster-<version>-chrome.zip` and unzip it.
2. Open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unzipped folder.

A signed `.crx` is attached too. Chrome on Windows and macOS only installs `.crx` files from the Chrome Web Store
(or through enterprise policy), so the zip is the easiest way to install it yourself.

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

`A`/`D` run · `Space` jump (somersault), tap again in the air for a second jump, hold to fly on rocket boots ·
`S` drop · click shoot · right-click / `G` grenade · `1-5` / wheel / `Q` `E` weapons · `Esc` pause · `M` mute

Arcade run-and-gun rules: you have three lives, enemy soldiers storm the page (runners from the edges and
paratroopers from above, snipers on page elements), and one hit costs a life. Weapons are rifle, machine gun,
spread gun, rocket launcher and laser. Enemies can be switched off in the popup or the pause menu.

### x.com sidekick

On x.com the commando waits at the bottom of the screen. Click **Like**, **Bookmark**, **Post**, or **Repost** /
**Quote** in the repost menu, and he shoots the button from where he stands, then your click goes through. Toggle it with **X.COM SIDEKICK** in the popup.

## How it works

1. **Capture** (`lib/capture.ts`): scrolls the page and stitches `captureVisibleTab` screenshots (up to N screens,
   throttled to Chrome's 2/sec limit). Fixed/sticky elements are hidden after the first shot so they don't repeat.
2. **Extract**: walks the live DOM with `getComputedStyle`/`getBoundingClientRect` for solids: one rect per word,
   media, form controls, boxes with a distinct background, and borders. Overflow clipping is respected.
3. **Level** (`lib/game/level.ts`): a 2px cell grid. Words are solid only where the screenshot has ink. Each cell
   remembers its element; once an element loses enough cells, the rest crumbles. Craters are erased from the
   picture with `destination-out`, revealing the void.
4. **Game** (`lib/game/game.ts`): fixed-step physics, five weapons plus grenades, enemies (`lib/game/enemies.ts`),
   particles, and a canvas overlay in a closed shadow root. Sound effects are synthesized (`lib/game/audio.ts`).
5. **Sidekick** (`lib/sidekick.ts`, `entrypoints/x.content.ts`): holds trusted clicks on x.com's like, bookmark, repost,
   quote and post buttons, plays the shot, then replays the click.

Permissions: `activeTab`, `scripting`, `storage`, `contextMenus`, plus a content script on x.com / twitter.com for the
sidekick. There is no server; nothing leaves the browser.

Font: Press Start 2P (SIL OFL, `public/fonts/OFL.txt`). Palette: PICO-8.
