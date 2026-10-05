# Chrome Web Store submission answers

Copy these into the item's **Privacy practices** tab.

## Single purpose

> Web Blaster turns the web page you are viewing into a playable retro arcade game: you run, jump and shoot to
> blast the page apart. On x.com, an optional sidekick character animates your own Like, Bookmark, Repost and Post clicks
> in the same game style.

## Permission justifications

**activeTab**

> Used only after the user starts the game from the toolbar button, keyboard shortcut or right-click menu. It
> grants temporary access to that one tab so the extension can capture what is visible (captureVisibleTab) and
> inject the game into it. No other tabs are accessed.

**scripting**

> Used to inject the game's content script into the current tab with chrome.scripting.executeScript when the user
> starts the game. The game is not injected anywhere until the user asks for it.

**storage**

> Saves the user's settings (sound, CRT effect, level size, enemies, x.com sidekick on/off) and local game stats
> (high score, pages destroyed, shots fired) with chrome.storage.local. Nothing is synced or sent off the device.

**contextMenus**

> Adds a single "Blast this page" item to the right-click menu, so the user can start the game on the current page
> without opening the popup.

**Host permissions (x.com, twitter.com)**

> Needed only for the optional x.com sidekick. A content script on x.com and twitter.com listens for the user's own
> clicks on the Like, Bookmark, Repost, Quote and Post buttons, plays a short animation of the game character shooting the button,
> then passes the original click through unchanged. It does not read posts, messages, timelines or account data,
> never clicks anything on its own, and can be turned off in the popup. No other sites get a persistent content
> script.

## Remote code

Select **"No, I am not using remote code."**

> All JavaScript, fonts and images are bundled in the extension package. There is no eval, no remote script
> loading, and the only fetch reads the bundled font from the extension itself (chrome.runtime.getURL).

## Data usage

Leave every data-type box **unchecked**: the extension does not collect or transmit personally identifiable
information, health, financial, authentication, personal communications, location, web history, user activity or
website content.

Tick all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** https://github.com/vkpdeveloper/webblaster/blob/main/PRIVACY.md

## Account settings (Settings page, not per item)

- Add a publisher contact email, then click the verification link Google emails you.
