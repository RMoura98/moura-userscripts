# Moura's Userscripts


| State | Userscript | Description | Download link | Last update |
|-------|------------|-------------|---------------|-------------|
| ✅ | [![Rails](https://www.google.com/s2/favicons?sz=12&domain=rubyonrails.org) Mini Profiler fade](#mini-profiler-fade) | Dims the rack-mini-profiler badge on localhost:3000 | [⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/mini-profiler-fade.user.js) | 2026-11-17 |
| ✅ | [![Google Flights](https://www.google.com/s2/favicons?sz=12&domain=flights.google.com) Google Flights price per person](#google-flights-price-per-person) | Hover a total price to see it split per passenger | [⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/google-flights-price-per-person.user.js) | 2026-11-17 |
| ✅ | [![MyAnimeList](https://www.google.com/s2/favicons?sz=12&domain=myanimelist.net) MAL Seasonal Tab Opener](#mal-seasonal-tab-opener) | Opens every anime in the home page seasonal widget in background tabs | [⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/mal-seasonal-tab-opener.user.js) | 2026-11-17 |
| ✅ | [![Trakt](https://www.google.com/s2/favicons?sz=12&domain=trakt.tv) Trakt → Sonarr / Radarr / Jellyfin](#trakt--sonarr--radarr--jellyfin) | Follow, monitor and search in Sonarr/Radarr from Trakt, plus a Jellyfin tile in "Where to Watch" | [⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/trakt-arr-jellyfin.user.js) | 2026-11-17 |
| ✅ | [![Claude](https://www.google.com/s2/favicons?sz=12&domain=claude.ai) Claude.ai login email autofill](#claudeai-login-email-autofill) | Prefills your email on the Claude.ai login page (email set from the Tampermonkey menu) | [⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/claude-login-email-autofill.user.js) | 2026-11-17 |
| ✅ | [![Allianz Care](https://www.google.com/s2/favicons?sz=12&domain=allianzcare.com) Allianz Care timeout redirect](#allianz-care-timeout-redirect) | Skips the MyHealth session-timeout login page and goes back to the home page | [⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/allianz-timeout-redirect.user.js) | 2026-11-17 |
| ✅ | [![W2G](https://www.google.com/s2/favicons?sz=12&domain=w2g.tv) W2G Watchdog](#w2g-watchdog) | Live memory/lag/connection stats for Watch2Gether rooms, plus safe auto-reload | [⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/w2g-watchdog.user.js) | 2026-11-17 |
| ✅ | [![Telegram](https://www.google.com/s2/favicons?sz=12&domain=telegram.org) Telegram auto-close chat](#telegram-auto-close-chat) | Closes the open chat and returns to the chat list when you leave the tab | [⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/telegram-auto-close-chat.user.js) | 2026-11-17 |
| ✅ | [![ultimate-guitar](https://www.google.com/s2/favicons?sz=12&domain=ultimate-guitar.com) Ultimate Guitar inline chords](#ultimate-guitar-inline-chords) | Replaces the chord labels with inline chords | [⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/ultimate-guitar-inline-chords.user.js) | 2026-10-07 |
| ✅ | [![Trakt](https://www.google.com/s2/favicons?sz=12&domain=trakt.tv) Trakt dashboard multiple rows](#trakt-dashboard-multiple-rows) | Allows to have multiple rows of tvshows on the trakt dashboard | [⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/trakt-dashboard-multiple-rows.user.js) | 2025-10-04 |

## W2G Watchdog

Long-running Watch2Gether rooms get heavy and sluggish over time. This keeps an eye on the room and reloads it for you at a safe moment, without losing your place in the chat.

- **Live stats badge** – memory (JS heap), main-thread lag and connection state, with a details panel. Turns yellow as memory climbs.
- **Safe auto-reload** – reloads when memory passes ~800 MB or lag stays high for a couple of minutes (no fixed time limit; optional via `maxUptimeHours`). It waits until you're idle and not typing, then shows a 15-second countdown you can cancel or snooze ("Not now").
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

## Claude.ai login email autofill

Prefills the email field on the Claude.ai login and signup pages. It never overwrites something you've already typed.

The email isn't stored in the script: set it once from the Tampermonkey menu → **Set login email** (leave it empty to turn the autofill off).

[⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/claude-login-email-autofill.user.js)

## Trakt → Sonarr / Radarr / Jellyfin

Connects Trakt show and movie pages (`app.trakt.tv`) to your own media stack. No Trakt API key needed.

- **Action button** in Trakt's action bar, with a status dot (following / paused / error) and a dropdown styled like Trakt's own menus.
- **Sonarr / Radarr** – see episode or file status and size, follow or unfollow, monitor the current season, start a search, or add the title (with your chosen quality profile and root folder).
- **Jellyfin** – if the title (or season) is in your library, a Jellyfin tile shows up in "Where to Watch" and opens it directly.

Nothing personal is stored in the script: set the Sonarr, Radarr and Jellyfin URLs and API keys from the Tampermonkey menu (or the **Settings…** item in the dropdown). Failed requests are logged to the console under `[Trakt-arr]`, with keys masked.

[⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/trakt-arr-jellyfin.user.js)

## MAL Seasonal Tab Opener

Adds an **Open All Tabs** link next to "View More" in the seasonal anime widget on the MyAnimeList home page. One click opens every anime in that widget in background tabs.

[⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/mal-seasonal-tab-opener.user.js)

## Google Flights price per person

Google Flights shows the total for all passengers. When you search for more than one passenger, hover any price to see what it comes to per person (for example "€153 per person (2 passengers)"). Works with prices shown in euros.

[⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/google-flights-price-per-person.user.js)

## Mini Profiler fade

Makes the [rack-mini-profiler](https://github.com/MiniProfiler/rack-mini-profiler) timing badge 10% opaque on local Rails apps (`http://localhost:3000`), so it stays out of the way.

[⬇️ Download](https://github.com/RMoura98/moura-userscripts/raw/main/mini-profiler-fade.user.js)
