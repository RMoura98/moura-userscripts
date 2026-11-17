# Moura's Userscripts


| State | Userscript | Description | Download link | Last update |
|-------|------------|-------------|---------------|-------------|
| ✅ | [![Allianz Care](https://www.google.com/s2/favicons?sz=12&domain=allianzcare.com) Allianz Care timeout redirect](#allianz-care-timeout-redirect) | Skips the MyHealth session-timeout login page and goes back to the home page | [⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/allianz-timeout-redirect.user.js) | 2026-11-17 |
| ✅ | [![W2G](https://www.google.com/s2/favicons?sz=12&domain=w2g.tv) W2G Watchdog](#w2g-watchdog) | Live memory/lag/connection stats for Watch2Gether rooms, plus safe auto-reload | [⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/w2g-watchdog.user.js) | 2026-11-17 |
| ✅ | [![Telegram](https://www.google.com/s2/favicons?sz=12&domain=telegram.org) Telegram auto-close chat](#telegram-auto-close-chat) | Closes the open chat and returns to the chat list when you leave the tab | [⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/telegram-auto-close-chat.user.js) | 2026-11-17 |
| ✅ | [![ultimate-guitar](https://www.google.com/s2/favicons?sz=12&domain=ultimate-guitar.com) Ultimate Guitar inline chords](#ultimate-guitar-inline-chords) | Replaces the chord labels with inline chords | [⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/ultimate-guitar-inline-chords.user.js) | 2026-10-07 |
| ✅ | [![Trakt](https://www.google.com/s2/favicons?sz=12&domain=trakt.tv) Trakt dashboard multiple rows](#trakt-dashboard-multiple-rows) | Allows to have multiple rows of tvshows on the trakt dashboard | [⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/trakt-dashboard-multiple-rows.user.js) | 2025-10-04 |

## W2G Watchdog

Long-running Watch2Gether rooms get heavy and sluggish over time. This keeps an eye on the room and reloads it for you at a safe moment, without losing your place in the chat.

- **Live stats badge** – memory (JS heap), main-thread lag and connection state, with a details panel. Turns yellow as memory climbs.
- **Safe auto-reload** – reloads when memory passes ~800 MB, lag stays high for a couple of minutes, or the room has been open for 4 hours. It waits until you're idle and not typing, then shows a 15-second countdown you can cancel or snooze ("Not now").
- **Keeps your chat draft** – whatever you were typing is restored after the reload.
- **Disconnect recovery** – if the room is stuck on W2G's "not connected" spinner, it reloads after a short countdown, backing off on repeated failures.
- **Tampermonkey menu** – show/hide the badge, move it to another corner, reload now, or snooze/resume auto-reload.

Only runs inside rooms (`w2g.tv/*/room/...`). Thresholds live in the `CFG` block at the top of the script.

[⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/w2g-watchdog.user.js)

## Ultimate Guitar inline chords

Replaces the chord labels with inline chords.

[⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/ultimate-guitar-inline-chords.user.js)


| Before | After |
|--------|-------|
| ![image](https://github.com/RMoura98/moura-userscripts/assets/27810563/efbad576-5767-4415-9273-d8a0670233a9) | ![image](https://github.com/RMoura98/moura-userscripts/assets/27810563/49bbfcb1-44f3-44c9-a055-8d487f9c0a96) | 
 

## Trakt dashboard multiple rows

Allows to have multiple rows of tvshows on the trakt dashboard

[⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/trakt-dashboard-multiple-rows.user.js)


| Before | After |
|--------|-------|
| ![image](https://github.com/RMoura98/moura-userscripts/assets/27810563/ad88e36f-5dd8-4da4-bdf5-3f0beaa77ef8) | ![image](https://github.com/RMoura98/moura-userscripts/assets/27810563/fe792372-30be-4def-be56-ce0abf9059f3) |

## Telegram auto-close chat

Presses Escape to close the open chat and return to the chat list whenever the Telegram Web tab is hidden.

[⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/telegram-auto-close-chat.user.js)

## Allianz Care timeout redirect

When your MyHealth session expires, Allianz Care drops you on a login page with `timeOut=true`. This sends you straight back to the Allianz Care home page instead.

[⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/allianz-timeout-redirect.user.js)
