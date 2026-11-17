// ==UserScript==
// @name         Trakt → Sonarr / Radarr / Jellyfin – manage your library from Trakt
// @icon         https://www.google.com/s2/favicons?sz=64&domain=trakt.tv
// @namespace    https://github.com/RMoura98/moura-userscripts
// @author       @RMoura98
// @version      2026-11-17
// @description  Adds a Sonarr/Radarr action button to Trakt show and movie pages and a Jellyfin tile in "Where to Watch".
// @match        https://app.trakt.tv/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        GM_addStyle
// @connect      *
// @updateURL    https://github.com/RMoura98/moura-userscripts/raw/main/trakt-arr-jellyfin.user.js
// @downloadURL  https://github.com/RMoura98/moura-userscripts/raw/main/trakt-arr-jellyfin.user.js
// ==/UserScript==

(function () {
    'use strict';

    const VERSION = '2026-11-17';

    // One-time cleanup of storage left over from the old MyAnimeList / Trakt-API versions
    ['fribbMap', 'fribbMap2', 'traktIds', 'traktClientId'].forEach(k => {
        if (GM_getValue(k, null) !== null) GM_setValue(k, null);
    });

    // ######################################################################
    // CORE
    // ######################################################################

    // ---------------- Settings + Tampermonkey menu ----------------
    const SETTINGS = [
        { key: 'sonarrUrl',      label: 'Sonarr URL',       secret: false, hint: 'e.g. https://sonarr.example.com' },
        { key: 'sonarrApiKey',   label: 'Sonarr API key',   secret: true,  hint: 'Sonarr → Settings → General' },
        { key: 'radarrUrl',      label: 'Radarr URL',       secret: false, hint: 'e.g. https://radarr.example.com' },
        { key: 'radarrApiKey',   label: 'Radarr API key',   secret: true,  hint: 'Radarr → Settings → General' },
        { key: 'jellyfinUrl',    label: 'Jellyfin URL',     secret: false, hint: 'e.g. https://jellyfin.example.com' },
        { key: 'jellyfinApiKey', label: 'Jellyfin API key', secret: true,  hint: 'Jellyfin → Dashboard → API Keys' },
    ];
    const settingByKey = k => SETTINGS.find(s => s.key === k);

    const get = k => String(GM_getValue(k, '') ?? '').trim();
    const base = k => get(k).replace(/\/+$/, '');

    const describe = s => {
        const v = get(s.key);
        if (!v) return `✗ ${s.label}: not set`;
        if (s.secret) return `✓ ${s.label}: ••••${v.slice(-4)}`;
        return `✓ ${s.label}: ${v.replace(/^https?:\/\//, '')}`;
    };

    const editSetting = s => {
        const v = prompt(`${s.label} (${s.hint}). Leave empty to clear:`, get(s.key));
        if (v === null) return false;
        GM_setValue(s.key, v.trim());
        return true;
    };

    // Walk through a list of settings; Cancel stops
    const editSettings = keys => {
        for (const k of keys) if (!editSetting(settingByKey(k))) break;
        resetCaches();
        buildMenu();
        onSettingsChanged();
    };

    let onSettingsChanged = () => {};
    let menuIds = [];
    const buildMenu = () => {
        if (typeof GM_unregisterMenuCommand === 'function') {
            menuIds.forEach(id => { try { GM_unregisterMenuCommand(id); } catch {} });
        }
        menuIds = SETTINGS.map(s =>
            GM_registerMenuCommand(describe(s), () => {
                if (editSetting(s)) { resetCaches(); buildMenu(); onSettingsChanged(); }
            })
        );
        menuIds.push(GM_registerMenuCommand('↻ Refresh caches', () => {
            ['jfIndex_Series', 'jfIndex_Movie', 'arrLookup'].forEach(k => GM_setValue(k, null));
            resetCaches();
            onSettingsChanged();
        }));
    };

    // ---------------- HTTP + failure logging ----------------
    // Failed requests are logged to the console (F12 → Console, filter "[Trakt-arr]").
    // Secrets are masked: only the last 4 chars of keys/tokens are shown.
    const LOG = '[Trakt-arr]';
    const mask = v => (typeof v === 'string' && v.length > 4 ? `••••${v.slice(-4)}` : '••••');
    const redactHeaders = h => {
        const out = {};
        for (const [k, v] of Object.entries(h || {})) {
            if (/api-key|token/i.test(k)) out[k] = mask(v);
            else if (/^authorization$/i.test(k)) out[k] = String(v).replace(/Token="([^"]*)"/, (_, t) => `Token="${mask(t)}"`);
            else out[k] = v;
        }
        return out;
    };
    const logFailure = (kind, info) => {
        console.groupCollapsed(`${LOG} ${kind}: ${info.method} ${info.url}${info.status ? ` → ${info.status}` : ''}`);
        for (const [k, v] of Object.entries(info)) console.log(`${k}:`, v);
        console.groupEnd();
    };

    const request = (method, url, { headers = {}, body, timeout = 15000 } = {}) =>
        new Promise((resolve, reject) => {
            const allHeaders = { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) };
            const ctx = { method, url, requestHeaders: redactHeaders(allHeaders) };
            GM_xmlhttpRequest({
                method, url, timeout,
                headers: allHeaders,
                data: body ? JSON.stringify(body) : undefined,
                onload: r => {
                    let json = null;
                    try { json = r.responseText ? JSON.parse(r.responseText) : null; } catch {}
                    if (r.status >= 200 && r.status < 300) return resolve(json);
                    logFailure('HTTP error', {
                        ...ctx,
                        status: r.status,
                        statusText: r.statusText,
                        finalUrl: r.finalUrl,
                        responseHeaders: r.responseHeaders,
                        responseBody: (r.responseText || '').slice(0, 2000),
                    });
                    const msg =
                        r.status === 401 ? 'Invalid API key' :
                        Array.isArray(json) && json[0]?.errorMessage ? json.map(e => e.errorMessage).join('; ') :
                        json?.message || `HTTP ${r.status}`;
                    const err = new Error(msg); err.status = r.status; reject(err);
                },
                onerror: r => {
                    logFailure('Network error', { ...ctx, status: r?.status, statusText: r?.statusText, error: r?.error, finalUrl: r?.finalUrl });
                    reject(new Error('Could not reach server'));
                },
                ontimeout: () => {
                    logFailure('Timeout', { ...ctx, timeoutMs: timeout });
                    reject(new Error('Timed out'));
                },
            });
        });

    // ---------------- Small helpers ----------------
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
    const gb = bytes => `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    const openTab = (url, e) => GM_openInTab(url, { active: !(e && (e.ctrlKey || e.metaKey)), insert: true });
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    // Loose title compare: ignores case, accents and punctuation
    const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');

    // Bounded key/value cache stored in GM storage
    const cacheGet = (store, key, ttl) => {
        const all = GM_getValue(store, null) || {};
        const hit = all[key];
        return hit && Date.now() - hit.ts < ttl ? hit.v : undefined;
    };
    const cacheSet = (store, key, v, max = 400) => {
        const all = GM_getValue(store, null) || {};
        all[key] = { ts: Date.now(), v };
        const keys = Object.keys(all);
        if (keys.length > max) keys.sort((a, b) => all[a].ts - all[b].ts).slice(0, keys.length - max).forEach(k => delete all[k]);
        GM_setValue(store, all);
    };

    // ---------------- Sonarr / Radarr ----------------
    const APPS = {
        sonarr: { name: 'Sonarr', urlKey: 'sonarrUrl', apiKey: 'sonarrApiKey', idName: 'TVDB', res: 'series', isMovie: false },
        radarr: { name: 'Radarr', urlKey: 'radarrUrl', apiKey: 'radarrApiKey', idName: 'TMDB', res: 'movie',  isMovie: true  },
    };
    const appFor = isMovie => (isMovie ? APPS.radarr : APPS.sonarr);
    const prefKey = (app, k) => `${app.name.toLowerCase()}_${k}`;
    const arrConfigured = app => !!(base(app.urlKey) && get(app.apiKey));

    const arr = (app, method, path, body) =>
        request(method, `${base(app.urlKey)}/api/v3${path}`, {
            headers: { 'X-Api-Key': get(app.apiKey) }, body,
        });

    // Find the TVDB/TMDB id by title (+year) through Sonarr/Radarr's own lookup.
    // -> { tvdb, tmdb } | null
    const arrLookupIds = async (app, title, year) => {
        if (!title) return null;
        const path = app.isMovie ? '/movie/lookup' : '/series/lookup';
        const list = await arr(app, 'GET', `${path}?term=${encodeURIComponent(title)}`);
        const want = norm(title);
        const scored = (list || [])
            .filter(x => (app.isMovie ? x.tmdbId : x.tvdbId))
            .map((x, i) => {
                const names = [x.title, x.originalTitle, ...(x.alternateTitles || []).map(t => t.title)];
                let score = 0;
                if (norm(x.title) === want) score += 3;
                else if (names.some(n => norm(n) === want)) score += 2;
                if (year && x.year === year) score += 2;
                else if (year && x.year && Math.abs(x.year - year) <= 1) score += 1;
                return { x, score, i };
            })
            .sort((a, b) => b.score - a.score || a.i - b.i);
        const best = scored[0];
        if (!best || best.score < 2) return null; // need at least a title match (or year + close)
        return {
            tvdb: app.isMovie ? null : best.x.tvdbId,
            tmdb: best.x.tmdbId || null,
        };
    };

    // ids = { tvdb, tmdb, season }
    // -> { found:false } | { found:true, item, url, monitored, rows, season } | { error } | { noMapping }
    const getArrStatus = async (app, ids) => {
        try {
            const id = app.isMovie ? ids.tmdb : ids.tvdb;
            if (!id) return { noMapping: true };

            if (app.isMovie) {
                const list = await arr(app, 'GET', `/movie?tmdbId=${id}`);
                const mv = (list || []).find(x => x.tmdbId === id);
                if (!mv) return { found: false };
                const file = mv.hasFile
                    ? `Downloaded${mv.movieFile?.quality?.quality?.name ? ` (${mv.movieFile.quality.quality.name})` : ''}`
                    : mv.isAvailable ? 'Missing' : 'Not released yet';
                const rows = [['File', file]];
                if (mv.sizeOnDisk) rows.push(['Size', gb(mv.sizeOnDisk)]);
                return {
                    found: true, item: mv, monitored: mv.monitored,
                    url: `${base(app.urlKey)}/movie/${mv.titleSlug || mv.tmdbId}`,
                    rows, season: null,
                };
            }

            const list = await arr(app, 'GET', `/series?tvdbId=${id}`);
            const s = (list || []).find(x => x.tvdbId === id);
            if (!s) return { found: false };

            const rows = [];
            let season = null;
            const so = ids.season != null ? (s.seasons || []).find(x => x.seasonNumber === ids.season) : null;
            if (so) {
                const st = so.statistics || {};
                season = {
                    number: ids.season,
                    monitored: so.monitored,
                    have: st.episodeFileCount ?? 0,
                    want: st.episodeCount ?? st.totalEpisodeCount ?? 0,
                };
                rows.push([`Season ${ids.season}`, `${season.have} / ${season.want} eps${so.monitored ? '' : ' (unmonitored)'}`]);
            } else {
                const st = s.statistics || {};
                rows.push(['Episodes', `${st.episodeFileCount ?? 0} / ${st.episodeCount ?? 0}`]);
            }
            if (s.statistics?.sizeOnDisk) rows.push(['Size', gb(s.statistics.sizeOnDisk)]);
            if (s.status) rows.push(['Series', cap(s.status)]);

            return { found: true, item: s, monitored: s.monitored, url: `${base(app.urlKey)}/series/${s.titleSlug}`, rows, season };
        } catch (err) {
            return { error: err.message };
        }
    };

    const setMonitored = async (app, item, monitored) => {
        const full = await arr(app, 'GET', `/${app.res}/${item.id}`);
        await arr(app, 'PUT', `/${app.res}/${item.id}`, { ...full, monitored });
    };

    const setSeasonMonitored = async (app, item, seasonNumber, monitored) => {
        const full = await arr(app, 'GET', `/series/${item.id}`);
        full.seasons = (full.seasons || []).map(x => (x.seasonNumber === seasonNumber ? { ...x, monitored } : x));
        // Monitoring a season of an unmonitored series does nothing, so turn the series on too
        if (monitored) full.monitored = true;
        await arr(app, 'PUT', `/series/${item.id}`, full);
    };

    const runSearch = (app, item, seasonNumber) =>
        app.isMovie
            ? arr(app, 'POST', '/command', { name: 'MoviesSearch', movieIds: [item.id] })
            : seasonNumber != null
                ? arr(app, 'POST', '/command', { name: 'SeasonSearch', seriesId: item.id, seasonNumber })
                : arr(app, 'POST', '/command', { name: 'SeriesSearch', seriesId: item.id });

    const optionsCache = {};
    const loadAddOptions = app =>
        (optionsCache[app.name] ||= Promise.all([
            arr(app, 'GET', '/qualityprofile'),
            arr(app, 'GET', '/rootfolder'),
            app.isMovie ? Promise.resolve(null) : arr(app, 'GET', '/languageprofile').catch(() => null),
        ]).then(([profiles, roots, langs]) => ({ profiles: profiles || [], roots: roots || [], langs }))
          .catch(err => { delete optionsCache[app.name]; throw err; }));

    const addToLibrary = async (app, ids, { qualityProfileId, rootFolderPath, search }) => {
        if (app.isMovie) {
            const lookup = await arr(app, 'GET', `/movie/lookup/tmdb?tmdbId=${ids.tmdb}`);
            if (!lookup) throw new Error('Movie not found in Radarr lookup');
            await arr(app, 'POST', '/movie', {
                ...lookup, qualityProfileId, rootFolderPath,
                monitored: true, minimumAvailability: 'released',
                addOptions: { searchForMovie: search },
            });
        } else {
            const results = await arr(app, 'GET', `/series/lookup?term=${encodeURIComponent(`tvdb:${ids.tvdb}`)}`);
            const lookup = (results || [])[0];
            if (!lookup) throw new Error('Series not found in Sonarr lookup');
            const { langs } = await loadAddOptions(app);
            await arr(app, 'POST', '/series', {
                ...lookup, qualityProfileId, rootFolderPath,
                ...(Array.isArray(langs) && langs.length ? { languageProfileId: langs[0].id } : {}),
                monitored: true, seasonFolder: true, seriesType: 'standard',
                addOptions: { monitor: 'all', searchForMissingEpisodes: search, searchForCutoffUnmetEpisodes: false },
            });
        }
    };

    const addPageUrl = (app, ids, title) => {
        const id = app.isMovie ? ids.tmdb : ids.tvdb;
        const term = id ? `${app.isMovie ? 'tmdb' : 'tvdb'}:${id}` : title;
        return `${base(app.urlKey)}/add/new?term=${encodeURIComponent(term || '')}`;
    };

    // Remembered "add" choices
    const getAddPrefs = app => ({
        profile: String(GM_getValue(prefKey(app, 'profile'), '')),
        root: String(GM_getValue(prefKey(app, 'root'), '')),
        search: GM_getValue(prefKey(app, 'search'), true),
    });
    const saveAddPrefs = (app, { qualityProfileId, rootFolderPath, search }) => {
        GM_setValue(prefKey(app, 'profile'), String(qualityProfileId));
        GM_setValue(prefKey(app, 'root'), rootFolderPath);
        GM_setValue(prefKey(app, 'search'), search);
    };

    // ---------------- Jellyfin ----------------
    // Jellyfin 10.11+ only accepts the "Authorization: MediaBrowser Token=…" scheme.
    const jfConfigured = () => !!(base('jellyfinUrl') && get('jellyfinApiKey'));
    const jfAuth = () =>
        `MediaBrowser Client="Trakt Userscript", Device="Browser", DeviceId="trakt-userscript", Version="${VERSION}", Token="${get('jellyfinApiKey')}"`;

    const jf = path =>
        request('GET', `${base('jellyfinUrl')}${path}`, {
            headers: { Authorization: jfAuth() },
        }).catch(err => {
            if (err.status === 401) err.message = 'Unauthorized (401): check the API key, or a login proxy in front of Jellyfin';
            throw err;
        });

    let jfServerIdPromise;
    const jfServerId = () =>
        (jfServerIdPromise ||= jf('/System/Info/Public').then(d => d?.Id || '').catch(() => ''));

    // Matches by provider id when we have one; otherwise by exact (normalised) name + year.
    const jfFindItem = async (isMovie, ids, nameHints, year = null) => {
        const type = isMovie ? 'Movie' : 'Series';
        const provKey = isMovie ? 'Tmdb' : 'Tvdb';
        const want = String((isMovie ? ids.tmdb : ids.tvdb) || '');
        const hints = [...new Set(nameHints.filter(Boolean))];
        const q = 'Recursive=true&Fields=ProviderIds&EnableImages=false&EnableUserData=false';
        const byName = i =>
            hints.some(h => norm(h) === norm(i.Name)) &&
            (!year || !i.ProductionYear || Math.abs(i.ProductionYear - year) <= 1);
        const match = items => (items || []).find(i =>
            want ? String(i.ProviderIds?.[provKey] || '') === want : byName(i));

        // 1) quick name search
        for (const term of hints) {
            const r = await jf(`/Items?${q}&IncludeItemTypes=${type}&searchTerm=${encodeURIComponent(term)}&Limit=50`);
            const hit = match(r?.Items);
            if (hit) return hit;
        }
        // 2) full scan by provider id, cached 6h
        if (want) {
            const cacheKey = `jfIndex_${type}`;
            let idx = GM_getValue(cacheKey, null);
            if (!idx || idx.url !== base('jellyfinUrl') || Date.now() - idx.ts > 6 * 3600 * 1000) {
                const r = await jf(`/Items?${q}&IncludeItemTypes=${type}`);
                const map = {};
                for (const i of r?.Items || []) {
                    const pid = i.ProviderIds?.[provKey];
                    if (pid) map[pid] = i.Id;
                }
                idx = { ts: Date.now(), url: base('jellyfinUrl'), map };
                GM_setValue(cacheKey, idx);
            }
            if (idx.map[want]) return { Id: idx.map[want] };
        }
        return null;
    };

    // -> null (not configured) | { found:false } | { found:true, url, label, short } | { error }
    const getJellyfinStatus = async (isMovie, ids, nameHints, year = null) => {
        if (!jfConfigured()) return null;
        try {
            const item = await jfFindItem(isMovie, ids, nameHints, year);
            if (!item) return { found: false };

            const sid = await jfServerId();
            const link = id => `${base('jellyfinUrl')}/web/#/details?id=${id}${sid ? `&serverId=${sid}` : ''}`;

            if (isMovie) return { found: true, url: link(item.Id), label: 'Available', short: 'Movie' };

            if (ids.season != null) {
                const seasons = await jf(`/Shows/${item.Id}/Seasons?Fields=ChildCount&EnableImages=false`);
                const season = (seasons?.Items || []).find(x => x.IndexNumber === ids.season);
                if (season) {
                    const count = season.ChildCount ? ` · ${season.ChildCount} eps` : '';
                    return { found: true, url: link(season.Id), label: `Season ${ids.season}${count}`, short: `Season ${ids.season}` };
                }
                return { found: true, url: link(item.Id), label: `Series only (no Season ${ids.season} yet)`, short: 'Series' };
            }
            return { found: true, url: link(item.Id), label: 'Available', short: 'Series' };
        } catch (err) {
            return { error: err.message };
        }
    };

    const resetCaches = () => {
        jfServerIdPromise = null;
        for (const k of Object.keys(optionsCache)) delete optionsCache[k];
    };

    // ---------------- Icons (generic, currentColor) ----------------
    const svg = (inner, size = 24, extra = '') =>
        `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${inner}</svg>`;
    const I = {
        arr:      '<path d="M12 3v11"/><path d="m7.5 9.5 4.5 4.5 4.5-4.5"/><path d="M4 16v2.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V16"/>',
        open:     '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5.5"/>',
        plus:     '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
        minus:    '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
        eye:      '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
        eyeOff:   '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
        search:   '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
        play:     '<path d="M7 4.5v15l12-7.5z"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
    };

    // ######################################################################
    // TRAKT (app.trakt.tv — SvelteKit SPA, so we poll for route/DOM changes)
    // ######################################################################
    GM_addStyle(`
      /* --- action bar button --- */
      .trakt-summary-actions-bar.mtj-widened { width: calc(var(--ni-280, 280px) + 46px) !important; }
      .mtj-action { position: relative; display: inline-flex; }
      .mtj-action button { position: relative; }
      .mtj-action button[data-busy="1"] { opacity: .55; }
      .mtj-action .mtj-dot {
        position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 50%;
        box-shadow: 0 0 0 2px var(--color-tooltip-background, #fdfcfe); display: none;
      }
      .mtj-action[data-state="following"] .mtj-dot { display: block; background: #2e9d5b; }
      .mtj-action[data-state="paused"] .mtj-dot { display: block; background: #e8892b; }
      .mtj-action[data-state="error"] .mtj-dot { display: block; background: #d64545; }

      /* --- dropdown, modelled on Trakt's popup menu --- */
      .mtj-pop {
        position: fixed; z-index: 2147483000; width: 290px; box-sizing: border-box;
        background: var(--color-tooltip-background, #fdfcfe);
        color: var(--color-text-primary, #2b2730);
        border-radius: 16px; overflow: hidden;
        box-shadow: 0 6px 24px rgba(32, 30, 35, .4);
        font-family: inherit; font-size: 14px;
        animation: mtj-in .14s ease-out;
      }
      @keyframes mtj-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
      .mtj-pop ul { list-style: none; margin: 0; padding: 0; }
      .mtj-pop li + li { border-top: 1px solid rgba(127, 120, 135, .18); }
      .mtj-head { padding: 14px 16px 12px; }
      .mtj-head-title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; }
      .mtj-pill { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
      .mtj-pill[data-k="following"] { background: rgba(46, 157, 91, .15); color: #2e9d5b; }
      .mtj-pill[data-k="paused"]    { background: rgba(232, 137, 43, .16); color: #c46f17; }
      .mtj-pill[data-k="none"]      { background: rgba(127, 120, 135, .16); color: var(--color-text-secondary, #6b6570); }
      .mtj-pill[data-k="error"]     { background: rgba(214, 69, 69, .14); color: #d64545; }
      .mtj-sub { margin-top: 4px; font-size: 12px; color: var(--color-text-secondary, #6b6570); line-height: 1.45; }
      .mtj-item {
        display: flex; align-items: center; gap: 12px; padding: 13px 16px; cursor: pointer;
        color: inherit; text-decoration: none; font-weight: 600; text-transform: none;
        background: none; border: 0; width: 100%; text-align: left; font: inherit; font-weight: 600;
      }
      .mtj-item:hover { background: rgba(127, 120, 135, .10); }
      .mtj-item[aria-disabled="true"] { opacity: .5; pointer-events: none; }
      .mtj-item svg { flex-shrink: 0; }
      .mtj-form { padding: 12px 16px 14px; display: grid; gap: 8px; }
      .mtj-form label.mtj-field { display: grid; gap: 4px; font-size: 12px; color: var(--color-text-secondary, #6b6570); }
      .mtj-form select {
        font: inherit; font-size: 13px; color: var(--color-text-primary, #2b2730);
        background: transparent; border: 1px solid rgba(127, 120, 135, .35); border-radius: 10px; padding: 7px 10px;
      }
      .mtj-form .mtj-check { display: flex; align-items: center; gap: 8px; font-size: 13px; }
      .mtj-primary {
        justify-self: start; border: 0; cursor: pointer; font: inherit; font-weight: 700; font-size: 13px;
        padding: 9px 18px; border-radius: 999px; color: #fff;
        background: var(--color-brand-violet, #7c4ddb);
      }
      .mtj-primary:disabled { opacity: .6; cursor: default; }
      .mtj-msg { font-size: 12px; color: #d64545; }
      .mtj-msg.ok { color: #2e9d5b; }

      /* --- Where to Watch tile, modelled on Trakt's streaming tiles --- */
      .mtj-wtw { flex-shrink: 0; }
      .mtj-wtw a { color: var(--color-text-secondary, #4a4550); text-decoration: none; }
      .mtj-wtw-card {
        width: var(--width-where-to-watch-item, 96px); height: var(--height-where-to-watch-item, 96px);
        box-sizing: border-box; padding: 8px; border-radius: 12px;
        background: var(--color-card-background, #fdfcfe);
        box-shadow: var(--shadow-base, 1px 1px 4px 2px rgba(32, 30, 35, .1));
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        transition: transform .15s ease;
      }
      .mtj-wtw a:hover .mtj-wtw-card { transform: translateY(-2px); }
      .mtj-wtw-logo { width: 60px; height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
      .mtj-wtw-logo b { font-size: 12px; letter-spacing: .2px; color: var(--color-text-primary, #2b2730); }
      .mtj-wtw-card p { margin: 0; font-size: 14px; white-space: nowrap; }
      .section-list-empty-state.mtj-has-tile { justify-content: flex-start !important; }
      .section-list-empty-state.mtj-has-tile > p { display: none; }
    `);

    let ctx = null;      // { type, slug, season, key }
    let st = {};         // state for the current route
    let gen = 0;         // guards against stale async results
    let pop = null;      // open dropdown element

    // ---------- routing ----------
    const parseRoute = () => {
        const m = location.pathname.match(/^\/(shows|movies)\/([^/?#]+)(?:\/seasons\/(\d+))?/);
        if (!m) return null;
        const type = m[1] === 'movies' ? 'movie' : 'show';
        let season = null;
        if (type === 'show') {
            if (m[3] != null) season = Number(m[3]);
            else {
                const trig = document.querySelector('.trakt-select-trigger[aria-label="Seasons"]');
                const t = trig?.textContent.trim().match(/^(\d+)\s*-/);
                const q = new URLSearchParams(location.search).get('season');
                season = t ? Number(t[1]) : q != null ? Number(q) : null;
            }
        }
        return { type, slug: m[2], season, key: `${type}:${m[2]}:${season}` };
    };

    const isMovie = () => ctx?.type === 'movie';
    const app = () => appFor(isMovie());

    // ---------- title + year from the page ----------
    // Trakt puts schema.org JSON-LD in the page. After SPA navigation it can briefly be the old
    // page's, so we only accept it when its url matches the current slug; else fall back to the slug.
    const pageMeta = async c => {
        const prefix = `/${c.type === 'movie' ? 'movies' : 'shows'}/${c.slug}`;
        const fromSlug = () => {
            const m = c.slug.match(/^(.*?)(?:-(\d{4}))?$/);
            return { title: m[1].replace(/-/g, ' '), year: m[2] ? Number(m[2]) : null };
        };
        for (let i = 0; i < 16; i++) {
            for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
                try {
                    const j = JSON.parse(s.textContent);
                    for (const x of Array.isArray(j) ? j : [j]) {
                        if (!x?.name || !x.url) continue;
                        if (!new URL(x.url, location.origin).pathname.startsWith(prefix)) continue;
                        const y = parseInt(x.datePublished || x.startDate, 10);
                        return { title: x.name, year: Number.isFinite(y) ? y : fromSlug().year };
                    }
                } catch {}
            }
            await sleep(250);
        }
        return fromSlug();
    };

    // -> { title, year, tvdb, tmdb, lookupError? }
    const resolveIds = async (c, a) => {
        const meta = await pageMeta(c);
        const none = { title: meta.title, year: meta.year, tvdb: null, tmdb: null };
        if (!arrConfigured(a)) return none; // Jellyfin can still match by name + year

        const key = `${c.type}:${c.slug}`;
        const cached = cacheGet('arrLookup', key, 30 * 24 * 3600 * 1000);
        if (cached) return { ...none, ...cached };
        try {
            const hit = await arrLookupIds(a, meta.title, meta.year);
            if (!hit) return none;
            cacheSet('arrLookup', key, hit);
            return { ...none, ...hit };
        } catch (err) {
            return { ...none, lookupError: err.message };
        }
    };

    // ---------- data loading ----------
    const load = async () => {
        const my = ++gen;
        const c = ctx;
        st = { phase: 'loading' };
        render();

        const movie = c.type === 'movie';
        const a = appFor(movie);
        const info = await resolveIds(c, a);
        if (my !== gen) return;

        st = {
            phase: 'ready',
            title: info.title,
            year: info.year,
            ids: { tvdb: info.tvdb, tmdb: info.tmdb, season: c.season },
            arr: arrConfigured(a) ? (info.lookupError ? { error: info.lookupError } : 'loading') : null,
            jf: jfConfigured() ? 'loading' : null,
        };
        render();

        const ids = st.ids;
        const set = (k, v) => { if (my === gen) { st[k] = v; render(); } };

        if (st.arr === 'loading') getArrStatus(a, ids).then(v => set('arr', v));
        getJellyfinStatus(movie, ids, [info.title], info.year).then(v => set('jf', v));
    };

    const reloadArr = async () => {
        const my = gen;
        st.arr = 'loading'; render();
        const v = await getArrStatus(app(), st.ids);
        if (my === gen) { st.arr = v; render(); }
    };

    // ---------- injection: action bar button ----------
    const ensureAction = () => {
        const bar = document.querySelector('.trakt-summary-actions-bar');
        if (!bar) return null;
        let wrap = bar.querySelector('.mtj-action');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'mtj-action';
            wrap.innerHTML = `
          <button type="button" data-button-root="true" class="trakt-action-button trakt-button-link"
                  data-color="default" data-variant="primary" data-size="normal" data-style="ghost">
            ${svg(I.arr)}<span class="mtj-dot"></span>
          </button>`;
            const more = bar.querySelector('.trakt-media-actions-popup-button');
            if (more) more.before(wrap); else bar.appendChild(wrap);
            bar.classList.add('mtj-widened');
            wrap.querySelector('button').addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                pop ? closePop() : openPop(wrap);
            });
        }
        return wrap;
    };

    const arrState = () => {
        const s = st.arr;
        if (s?.error) return 'error';
        if (s && s.found) return s.monitored ? 'following' : 'paused';
        return 'none';
    };

    const renderAction = () => {
        const wrap = ensureAction();
        if (!wrap) return;
        const a = app();
        const state = arrState();
        const label =
            !base(a.urlKey) ? `Set up ${a.name}` :
            state === 'following' ? `Following in ${a.name}` :
            state === 'paused' ? `Paused in ${a.name}` :
            state === 'error' ? `${a.name}: error` :
            st.arr === 'loading' || st.phase === 'loading' ? `Checking ${a.name}…` : `Not in ${a.name}`;
        wrap.dataset.state = state;
        const btn = wrap.querySelector('button');
        btn.setAttribute('aria-label', label);
        btn.title = label;
        btn.dataset.busy = st.arr === 'loading' || st.phase === 'loading' ? '1' : '0';
    };

    // ---------- dropdown ----------
    const closePop = () => { pop?.remove(); pop = null; };

    const positionPop = anchor => {
        if (!pop) return;
        const r = anchor.getBoundingClientRect();
        pop.style.top = `${Math.round(r.bottom + 10)}px`;
        pop.style.left = `${Math.round(Math.max(12, Math.min(r.left - 120, window.innerWidth - 302)))}px`;
    };

    const openPop = anchor => {
        pop = document.createElement('div');
        pop.className = 'mtj-pop';
        pop.addEventListener('click', e => e.stopPropagation());
        document.body.appendChild(pop);
        pop._anchor = anchor;
        renderPop();
        positionPop(anchor);
    };

    document.addEventListener('click', () => closePop());
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
    window.addEventListener('scroll', () => pop && positionPop(pop._anchor), true);
    window.addEventListener('resize', () => pop && positionPop(pop._anchor));

    const item = (act, icon, text, disabled = false) =>
        `<li><button type="button" class="mtj-item" data-act="${act}" ${disabled ? 'aria-disabled="true"' : ''}>${svg(icon)}<span>${esc(text)}</span></button></li>`;

    const renderPop = () => {
        if (!pop) return;
        const a = app();
        const s = st.arr;
        const season = ctx?.season;
        const state = arrState();
        const pill = { following: 'Following', paused: 'Paused', none: 'Not following', error: 'Error' }[state];

        let head = '';
        const items = [];

        if (st.phase === 'loading') {
            head = `<div class="mtj-head-title">${a.name}</div><div class="mtj-sub">Checking…</div>`;
        } else {
            // ----- Sonarr/Radarr header -----
            const subs = [];
            if (!base(a.urlKey)) subs.push(`${a.name} isn't set up yet.`);
            else if (!get(a.apiKey)) subs.push('Add an API key to see status.');
            else if (s === 'loading') subs.push('Checking…');
            else if (s?.error) subs.push(esc(s.error));
            else if (s?.noMapping) subs.push(`Couldn't match “${esc(st.title)}” in ${a.name}.`);
            else if (s?.found) subs.push(esc(s.rows.map(([l, v]) => (l === 'Series' || l === 'Size' ? v : `${l}: ${v}`)).join(' · ')));
            else if (s && !s.found) subs.push(`Not in your ${a.name} library.`);

            // ----- Jellyfin line -----
            if (st.jf === 'loading') subs.push('Jellyfin: checking…');
            else if (st.jf?.found) subs.push(`Jellyfin: ${esc(st.jf.label)}`);
            else if (st.jf?.error) subs.push(`Jellyfin: ${esc(st.jf.error)}`);
            else if (st.jf) subs.push('Jellyfin: not in library');
            else subs.push('Jellyfin: not set up');

            head = `<div class="mtj-head-title">${a.name}${arrConfigured(a) && s !== 'loading' ? ` <span class="mtj-pill" data-k="${state}">${pill}</span>` : ''}</div>
                <div class="mtj-sub">${subs.join('<br>')}</div>`;

            if (st.jf?.found) items.push(item('jellyfin', I.play, `Play on Jellyfin${st.jf.short && st.jf.short !== 'Series' ? ` · ${st.jf.short}` : ''}`));

            if (!base(a.urlKey)) {
                items.push(item('settings', I.settings, `Set up ${a.name}…`));
            } else if (s?.found) {
                items.push(item('open', I.open, `Open in ${a.name}`));
                items.push(s.monitored
                    ? item('toggleSeries', I.minus, a.isMovie ? 'Unfollow movie' : 'Unfollow series')
                    : item('toggleSeries', I.plus, a.isMovie ? 'Follow movie' : 'Follow series'));
                if (!a.isMovie && s.season) {
                    items.push(s.season.monitored
                        ? item('toggleSeason', I.eyeOff, `Stop monitoring season ${season}`)
                        : item('toggleSeason', I.eye, `Monitor season ${season}`));
                }
                items.push(item('search', I.search,
                    a.isMovie ? 'Search for movie' : s.season ? `Search season ${season}` : 'Search all missing'));
            } else {
                items.push(item('open', I.open, s && !s.found ? `Add in ${a.name}` : `Search in ${a.name}`));
            }
            items.push(item('settings', I.settings, 'Settings…'));
        }

        const showForm = st.phase === 'ready' && s && s !== 'loading' && !s.error && !s.noMapping && !s.found;

        pop.innerHTML = `
        <div class="mtj-head">${head}</div>
        ${showForm ? '<div class="mtj-form"><div class="mtj-sub">Loading options…</div></div>' : ''}
        <ul>${items.join('')}</ul>
        <div class="mtj-msg-wrap"></div>`;

        pop.querySelectorAll('.mtj-item').forEach(b => b.addEventListener('click', e => onAction(b.dataset.act, b, e)));
        if (showForm) renderForm(pop.querySelector('.mtj-form'));
    };

    const renderForm = async el => {
        const a = app();
        let opts;
        try { opts = await loadAddOptions(a); }
        catch (err) { el.innerHTML = `<div class="mtj-msg">${esc(err.message)}</div>`; return; }
        if (!el.isConnected) return;
        if (!opts.profiles.length || !opts.roots.length) {
            el.innerHTML = `<div class="mtj-sub">Set up a quality profile and root folder in ${a.name} first.</div>`;
            return;
        }
        const prefs = getAddPrefs(a);
        el.innerHTML = `
        <label class="mtj-field">Quality profile
          <select class="mtj-profile">${opts.profiles.map(p =>
              `<option value="${p.id}" ${String(p.id) === prefs.profile ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        </label>
        <label class="mtj-field">Root folder
          <select class="mtj-root">${opts.roots.map(r =>
              `<option value="${esc(r.path)}" ${r.path === prefs.root ? 'selected' : ''}>${esc(r.path)}</option>`).join('')}</select>
        </label>
        <label class="mtj-check"><input type="checkbox" class="mtj-search" ${prefs.search ? 'checked' : ''}> Search for ${a.isMovie ? 'it' : 'episodes'} now</label>
        <button type="button" class="mtj-primary">Follow in ${a.name}</button>
        <div class="mtj-msg"></div>`;

        const btn = el.querySelector('.mtj-primary');
        const msg = el.querySelector('.mtj-msg');
        btn.addEventListener('click', async () => {
            const o = {
                qualityProfileId: Number(el.querySelector('.mtj-profile').value),
                rootFolderPath: el.querySelector('.mtj-root').value,
                search: el.querySelector('.mtj-search').checked,
            };
            saveAddPrefs(a, o);
            btn.disabled = true;
            btn.textContent = 'Adding…';
            msg.textContent = '';
            try {
                await addToLibrary(a, st.ids, o);
                await reloadArr();
            } catch (err) {
                btn.disabled = false;
                btn.textContent = `Follow in ${a.name}`;
                msg.textContent = err.message;
            }
        });
    };

    const flash = (text, ok) => {
        const w = pop?.querySelector('.mtj-msg-wrap');
        if (w) w.innerHTML = `<div class="mtj-msg ${ok ? 'ok' : ''}" style="padding:0 16px 12px">${esc(text)}</div>`;
    };

    const onAction = async (act, btn, e) => {
        const a = app();
        const s = st.arr;
        const busy = () => { btn.setAttribute('aria-disabled', 'true'); btn.querySelector('span').textContent = 'Working…'; };
        try {
            if (act === 'settings') {
                closePop();
                editSettings([a.urlKey, a.apiKey, 'jellyfinUrl', 'jellyfinApiKey']);
            } else if (act === 'jellyfin') {
                closePop(); openTab(st.jf.url, e);
            } else if (act === 'open') {
                closePop(); openTab(s?.found ? s.url : addPageUrl(a, st.ids || {}, st.title), e);
            } else if (act === 'toggleSeries') {
                busy(); await setMonitored(a, s.item, !s.monitored); await reloadArr();
            } else if (act === 'toggleSeason') {
                busy(); await setSeasonMonitored(a, s.item, ctx.season, !s.season.monitored); await reloadArr();
            } else if (act === 'search') {
                busy(); await runSearch(a, s.item, s.season ? ctx.season : null);
                renderPop(); flash(`Search started in ${a.name}.`, true);
            }
        } catch (err) {
            renderPop(); flash(err.message, false);
        }
    };

    // ---------- injection: Jellyfin tile in "Where to Watch" ----------
    const findWtwSection = () =>
        [...document.querySelectorAll('section.section-list-container')]
            .find(sec => /Where to Watch/i.test(sec.querySelector('.trakt-list-header')?.textContent || ''));

    const renderTile = () => {
        const found = st.phase === 'ready' && st.jf && st.jf !== 'loading' && st.jf.found;
        const existing = document.querySelector('.mtj-wtw');
        if (!found) {
            if (existing) {
                existing.closest('.section-list-empty-state')?.classList.remove('mtj-has-tile');
                existing.remove();
            }
            return;
        }
        const sec = findWtwSection();
        if (!sec) return;

        let tile = sec.querySelector('.mtj-wtw');
        if (!tile) {
            tile = document.createElement('div');
            tile.className = 'mtj-wtw';
            tile.innerHTML = `
          <a target="_blank" rel="noopener">
            <div class="mtj-wtw-card">
              <div class="mtj-wtw-logo">
                <svg viewBox="0 0 24 24" width="28" height="28">
                  <defs><linearGradient id="mtjg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="#9b5cd6"/><stop offset="1" stop-color="#1fa3dc"/></linearGradient></defs>
                  <circle cx="12" cy="12" r="11" fill="url(#mtjg)"/><path d="M9.5 7.5v9l7-4.5z" fill="#fff"/>
                </svg>
                <b>Jellyfin</b>
              </div>
              <p></p>
            </div>
          </a>`;
            const list = sec.querySelector('.trakt-list-item-container');
            const empty = sec.querySelector('.section-list-empty-state');
            if (list) list.prepend(tile);
            else if (empty) { empty.classList.add('mtj-has-tile'); empty.prepend(tile); }
            else return;
        }
        const a = tile.querySelector('a');
        if (a.href !== st.jf.url) a.href = st.jf.url;
        const label = st.jf.short === 'Series' || st.jf.short === 'Movie' ? 'Library' : st.jf.short;
        const p = tile.querySelector('p');
        if (p.textContent !== label) p.textContent = label;
        a.title = `Open in Jellyfin — ${st.jf.label}`;
    };

    // ---------- render ----------
    // inject(): idempotent, safe to run every tick (re-adds what Svelte replaced)
    // render(): after a state change — also refreshes an open dropdown
    const inject = () => {
        if (!ctx) return;
        renderAction();
        renderTile();
    };
    const render = () => {
        inject();
        if (pop) renderPop();
    };

    const cleanup = () => {
        closePop();
        document.querySelectorAll('.mtj-action, .mtj-wtw').forEach(n => n.remove());
        document.querySelectorAll('.mtj-widened').forEach(n => n.classList.remove('mtj-widened'));
        document.querySelectorAll('.mtj-has-tile').forEach(n => n.classList.remove('mtj-has-tile'));
    };

    onSettingsChanged = () => { if (ctx) load(); };

    // Poll for SPA navigation, season changes and Svelte re-renders (cheap)
    const tick = () => {
        const r = parseRoute();
        if (!r) { if (ctx) { cleanup(); ctx = null; gen++; } return; }
        if (!ctx || r.key !== ctx.key) {
            if (!ctx || r.slug !== ctx.slug || r.type !== ctx.type) cleanup();
            closePop();
            ctx = r;
            load();
            return;
        }
        inject(); // re-inject anything Svelte replaced (doesn't touch an open dropdown)
    };

    // ######################################################################
    // Boot
    // ######################################################################
    buildMenu();
    setInterval(tick, 700);
    tick();
})();