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
`S` drop · click shoot · right-click / `G` grenade · `1-5` / wheel / `Q` `E` weapons · `F` rage · `Esc` pause · `M` mute

Arcade run-and-gun rules: you have three lives, enemy soldiers storm the page (runners from the edges and
paratroopers from above, snipers on page elements), and one hit costs a life. Weapons are rifle, machine gun,
spread gun, rocket launcher and laser. Enemies can be switched off in the popup or the pause menu.

Everything you wreck feeds a **combo**: each word, image or soldier that goes down adds to the chain, as long as
you keep hitting things within about two seconds. Longer chains multiply your score (up to x8) and climb a musical
scale. The combo also fills the **rage** bar; when it's full, press `F` for ten seconds of double fire rate,
bigger blasts and invulnerability.

### Game feel

The game is tuned to feel good to blast things with, using the usual tricks from Vlambeer's "The Art of
Screenshake" and Squirrel Eiserloh's GDC talk on camera shake:

- Trauma-based screen shake (shake grows with trauma squared, smooth noise, a little roll on the biggest hits) plus
  a camera kick against your aim on every shot.
- Hitstop: the action freezes for a few frames on kills and big collapses, and drops into slow motion for multi
  kills and huge collapses.
- White impact frames, sparks that kick back toward you, scorch marks around craters, debris that piles up, and
  shell casings that clink around the floor.
- Enemies get knocked back, flash and go flying off the page. The crosshair spreads as you fire and shows a hit
  marker when you connect.
- Layered, slightly randomized sounds through a limiter, so a pile of explosions hits hard instead of clipping.

Screen shake and flashes are toned down when the OS "reduce motion" setting is on.

### x.com sidekick

On x.com the commando waits at the bottom of the screen. Click **Like**, **Bookmark**, **Post**, or **Repost** /
**Quote** in the repost menu, and he shoots the button from where he stands, then your click goes through. Hover
over him and he breaks into a Bollywood routine: light bulb, shoulder shimmy, pat-the-dog, bhangra and a spin, with
notes and marigolds, to Raj's "My Heart, My Universe" from _The Big Bang Theory_ (see [Credits](#credits)). The steps
are locked to the song's beat. Shots in quick succession build a streak: the counter over the button grows and the
hit sound climbs the scale. Toggle it with **X.COM SIDEKICK** in the popup.

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

## Credits

Font: Press Start 2P (SIL OFL, `public/fonts/OFL.txt`). Palette: PICO-8.

Music: the sidekick dances to "My Heart, My Universe" from _The Big Bang Theory_ (season 4, "The Thespian Catalyst"),
trimmed and re-encoded in `public/music/dance.mp3`. The song and the show belong to their owners (Chuck Lorre
Productions and Warner Bros. Television). It is included here as a fan tribute, not licensed, and is not covered by
this project's terms; see `public/music/CREDITS.txt`.
