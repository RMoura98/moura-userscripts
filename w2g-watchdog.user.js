// ==UserScript==
// @name         W2G Watchdog – memory guard, live stats & safe auto-reload
// @icon         https://www.google.com/s2/favicons?sz=64&domain=w2g.tv
// @namespace    https://github.com/RMoura98/moura-userscripts
// @author       @RMoura98
// @version      2026-11-17
// @description  Shows live memory/lag/connection stats for Watch2Gether rooms and reloads the room at a safe moment (idle, not typing) with a cancelable countdown, keeping your chat draft. Also recovers rooms stuck on the "disconnected" spinner.
// @match        https://w2g.tv/*
// @run-at       document-idle
// @grant        GM_registerMenuCommand
// @updateURL    https://github.com/RMoura98/moura-userscripts/raw/main/w2g-watchdog.user.js
// @downloadURL  https://github.com/RMoura98/moura-userscripts/raw/main/w2g-watchdog.user.js
// @description  Display multiple rows of TV shows on the Trakt dashboard by hiding clutter and increasing row count
// ==/UserScript==

(function () {
  'use strict';

  // Only run inside a room
  if (!/\/room\b/.test(location.pathname)) return;

  // ---------------- Config ----------------
  const CFG = {
    checkEveryMs: 30_000,          // how often to evaluate reload conditions
    statsEveryMs: 2_000,           // how often the badge refreshes (only while the tab is visible)
    warnHeapMB: 500,               // badge turns yellow + one-time heads-up (JS heap; Task Manager shows more than this)
    reloadHeapMB: 800,             // start the reload flow (~roughly 1 GB+ in Chrome's Task Manager)
    maxUptimeHours: 4,             // reload after this long regardless (also covers Firefox, which has no memory API)
    lagReloadMs: 250,              // avg main-thread lag that counts as "sluggish"
    lagSustainMin: 2,              // ...if sustained this many minutes
    idleBeforeReloadSec: 20,       // wait until no mouse/keyboard input for this long
    countdownSec: 15,              // visible countdown before reloading
    snoozeMin: 30,                 // "Not now" postpones by this much
    disconnectReloadSec: 20,       // reload if W2G's "not connected" spinner stays up this long (doubles per recent retry)
    disconnectMaxWaitSec: 300,     // cap for the retry back-off
    disconnectCountdownSec: 5,     // short countdown for disconnect reloads (room is unusable anyway)
    disconnectSnoozeMin: 2,        // "Not now" on a disconnect reload postpones by this much
    defaultCorner: 'bottom-left',  // badge position: bottom-left | bottom-right | top-left | top-right
  };

  const SS_DRAFT = 'w2gWatchdog:chatDraft';
  const SS_NOTE  = 'w2gWatchdog:reloadedNote';
  const SS_REASON = 'w2gWatchdog:reloadReason';
  const SS_DISC = 'w2gWatchdog:disconnectReloads';
  const LS_CORNER = 'w2gWatchdog:corner';
  const LS_HIDDEN = 'w2gWatchdog:badgeHidden';
  const CORNERS = ['bottom-left', 'bottom-right', 'top-right', 'top-left'];

  const startedAt = performance.now();
  let snoozeUntil = 0;
  let warned = false;
  let flowActive = false;
  let flowKind = '';              // '' | 'normal' | 'disconnect'
  let flowState = '';             // human-readable status of the reload flow
  let waitTimer = null;
  let activeCountdown = null;
  let lastInput = Date.now();
  let laggySince = 0;
  let lagEma = 0;
  let disconnectedSince = 0;
  let discSnoozeUntil = 0;
  const heapSamples = [];         // [timeMs, MB] for growth rate

  // ---------------- Helpers ----------------
  const heapMB = () =>
    performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
  const uptimeH = () => (performance.now() - startedAt) / 3_600_000;
  const allEls = document.getElementsByTagName('*'); // live collection, cheap .length
  const domCount = () => allEls.length;
  const fmtMB = (mb) => (mb === null ? '—' : mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`);
  const fmtH = (h) => (h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} h`);
  const fmtSecs = (s) => (s < 60 ? `${Math.round(s)}s` : `${Math.round(s / 60)} min`);
  const fmtClock = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const growthMBPerHour = () => {
    if (heapSamples.length < 2) return null;
    const [t0, m0] = heapSamples[0];
    const [t1, m1] = heapSamples[heapSamples.length - 1];
    const dtH = (t1 - t0) / 3_600_000;
    return dtH < 1 / 60 ? null : Math.round((m1 - m0) / dtH);
  };

  const findChatInput = () =>
    document.querySelector(
      '[class*="chat"] textarea, [class*="chat"] input[type="text"], [id*="chat"] textarea, [id*="chat"] input[type="text"]'
    );

  const isTyping = () => {
    const a = document.activeElement;
    return !!a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT' || a.isContentEditable);
  };

  // W2G shows a full-screen spinner overlay tagged data-w2g="['connected', 'ifnot']" while the room is not connected.
  const isDisconnected = () => {
    const o = document.querySelector('[data-w2g*="connected"][data-w2g*="ifnot"]');
    if (!o) return false;
    const cs = getComputedStyle(o);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && o.getClientRects().length > 0;
  };
  const disconnectedSecs = () => (disconnectedSince ? (Date.now() - disconnectedSince) / 1000 : 0);

  const recentDiscReloads = () => {
    try {
      const now = Date.now();
      return JSON.parse(sessionStorage.getItem(SS_DISC) || '[]').filter((t) => now - t < 10 * 60_000);
    } catch (_) { return []; }
  };
  const discThresholdMs = () =>
    Math.min(CFG.disconnectReloadSec * 1000 * 2 ** recentDiscReloads().length, CFG.disconnectMaxWaitSec * 1000);

  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach((ev) =>
    window.addEventListener(ev, () => (lastInput = Date.now()), { passive: true, capture: true })
  );

  // ---------------- Styles (W2G palette) ----------------
  const style = document.createElement('style');
  style.textContent = `
    #w2gwd-toast, #w2gwd-badge, #w2gwd-panel {
      background: rgb(25, 32, 42); color: rgba(255,255,255,.85);
      border: 1px solid rgb(58, 71, 89); border-radius: 6px;
      font-family: inherit; line-height: 1.35;
    }
    #w2gwd-toast {
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483001;
      max-width: 340px; padding: 12px 14px; font-size: 14px;
      box-shadow: 0 10px 25px rgba(0,0,0,.5);
      transition: opacity .2s, transform .2s;
    }
    #w2gwd-toast.w2gwd-hide { opacity: 0; transform: translateY(8px); pointer-events: none; }
    #w2gwd-toast .w2gwd-title { color: #fff; font-weight: 600; margin-bottom: 4px; }
    #w2gwd-toast .w2gwd-meta { opacity: .65; font-size: 12px; margin-top: 2px; }
    .w2gwd-actions { display: flex; gap: 8px; margin-top: 10px; justify-content: flex-end; }
    .w2gwd-bar { height: 3px; margin-top: 10px; background: rgb(58,71,89); border-radius: 3px; overflow: hidden; }
    .w2gwd-bar > div { height: 100%; background: rgb(42,104,194); width: 100%; transition: width 1s linear; }
    #w2gwd-toast button, #w2gwd-panel button {
      border-radius: 6px; padding: 4px 10px; cursor: pointer; border: 0; color: #fff; font-size: 13px;
    }
    .w2gwd-primary { background: rgb(42,104,194); }
    .w2gwd-secondary { background: rgb(58,71,89); }

    /* Badge */
    #w2gwd-badge {
      position: fixed; z-index: 2147483000;
      display: flex; align-items: center; gap: 6px;
      padding: 3px 9px; font-size: 12px; cursor: pointer; user-select: none;
      opacity: .75; transition: opacity .15s;
      font-variant-numeric: tabular-nums;
    }
    #w2gwd-badge:hover, #w2gwd-badge.w2gwd-open { opacity: 1; }
    #w2gwd-badge .w2gwd-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
    .w2gwd-ok   { background: rgb(34,197,94); }
    .w2gwd-warn { background: rgb(253,189,0); }
    .w2gwd-bad  { background: rgb(235,54,87); }

    /* Panel */
    #w2gwd-panel {
      position: fixed; z-index: 2147483000; width: 270px; padding: 12px 14px; font-size: 13px;
      box-shadow: 0 10px 25px rgba(0,0,0,.5);
      font-variant-numeric: tabular-nums;
    }
    #w2gwd-panel[hidden] { display: none; }
    #w2gwd-panel .w2gwd-title { color: #fff; font-weight: 600; margin-bottom: 8px; display: flex; justify-content: space-between; }
    #w2gwd-panel .w2gwd-close { cursor: pointer; opacity: .6; }
    #w2gwd-panel .w2gwd-close:hover { opacity: 1; }
    #w2gwd-panel .w2gwd-row { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; }
    #w2gwd-panel .w2gwd-row > span:first-child { opacity: .6; }
    #w2gwd-panel .w2gwd-row > span:last-child { color: #fff; text-align: right; }
    #w2gwd-panel .w2gwd-membar { height: 4px; margin: 2px 0 6px; background: rgb(58,71,89); border-radius: 4px; overflow: hidden; }
    #w2gwd-panel .w2gwd-membar > div { height: 100%; width: 0; transition: width .4s, background .4s; }
    #w2gwd-panel .w2gwd-status { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgb(58,71,89); font-size: 12px; opacity: .8; }
  `;
  document.head.appendChild(style);

  // ---------------- Toast ----------------
  let toastEl = null;
  function toast({ title, body, meta, actions = [], progress = null, autoHideMs = 0 }) {
    closeToast();
    toastEl = document.createElement('div');
    toastEl.id = 'w2gwd-toast';
    toastEl.className = 'w2gwd-hide';
    toastEl.innerHTML = `
      <div class="w2gwd-title"></div>
      <div class="w2gwd-body"></div>
      ${meta ? '<div class="w2gwd-meta"></div>' : ''}
      ${progress !== null ? '<div class="w2gwd-bar"><div></div></div>' : ''}
      ${actions.length ? '<div class="w2gwd-actions"></div>' : ''}`;
    toastEl.querySelector('.w2gwd-title').textContent = title;
    toastEl.querySelector('.w2gwd-body').textContent = body;
    if (meta) toastEl.querySelector('.w2gwd-meta').textContent = meta;
    const box = toastEl.querySelector('.w2gwd-actions');
    actions.forEach(({ label, primary, onClick }) => box.appendChild(makeButton(label, primary, onClick)));
    document.body.appendChild(toastEl);
    requestAnimationFrame(() => toastEl && toastEl.classList.remove('w2gwd-hide'));
    if (autoHideMs) {
      const mine = toastEl;
      setTimeout(() => { if (toastEl === mine) closeToast(); }, autoHideMs);
    }
    return toastEl;
  }
  function closeToast() {
    if (toastEl) { toastEl.remove(); toastEl = null; }
  }
  function makeButton(label, primary, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `w2g-button w2g-compact ${primary ? 'primary w2gwd-primary' : 'w2gwd-secondary'}`;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  const statsLine = () =>
    `${heapMB() !== null ? `Memory ${fmtMB(heapMB())} · ` : ''}open ${fmtH(uptimeH())} · ${domCount().toLocaleString()} elements`;

  // ---------------- Stats badge + panel ----------------
  const badge = document.createElement('div');
  badge.id = 'w2gwd-badge';
  badge.title = 'W2G Watchdog – click for details';
  badge.innerHTML = '<span class="w2gwd-dot w2gwd-ok"></span><span class="w2gwd-label">…</span>';

  const panel = document.createElement('div');
  panel.id = 'w2gwd-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="w2gwd-title"><span>Room health</span><span class="w2gwd-close" title="Close">✕</span></div>
    <div class="w2gwd-row"><span>Connection</span><span data-k="conn"></span></div>
    <div class="w2gwd-row"><span>Memory</span><span data-k="mem"></span></div>
    <div class="w2gwd-membar"><div></div></div>
    <div class="w2gwd-row"><span>Growth</span><span data-k="growth"></span></div>
    <div class="w2gwd-row"><span>Open for</span><span data-k="uptime"></span></div>
    <div class="w2gwd-row"><span>Page elements</span><span data-k="dom"></span></div>
    <div class="w2gwd-row"><span>Main-thread lag</span><span data-k="lag"></span></div>
    <div class="w2gwd-status" data-k="status"></div>
    <div class="w2gwd-actions"></div>`;
  const pActions = panel.querySelector('.w2gwd-actions');
  const snoozeBtn = makeButton(`Snooze ${CFG.snoozeMin} min`, false, () => toggleSnooze());
  pActions.appendChild(snoozeBtn);
  pActions.appendChild(makeButton('Reload now', true, () => doReload()));

  const dot = badge.querySelector('.w2gwd-dot');
  const label = badge.querySelector('.w2gwd-label');
  const field = (k) => panel.querySelector(`[data-k="${k}"]`);
  const memBar = panel.querySelector('.w2gwd-membar > div');

  badge.addEventListener('click', () => { panel.hidden = !panel.hidden; badge.classList.toggle('w2gwd-open', !panel.hidden); placeUI(); renderStats(); });
  panel.querySelector('.w2gwd-close').addEventListener('click', () => { panel.hidden = true; badge.classList.remove('w2gwd-open'); });

  let corner = localStorage.getItem(LS_CORNER) || CFG.defaultCorner;
  function placeUI() {
    const [v, h] = corner.split('-');
    for (const el of [badge, panel]) {
      el.style.top = el.style.bottom = el.style.left = el.style.right = '';
      el.style[h] = '12px';
    }
    badge.style[v] = '12px';
    panel.style[v] = `${12 + badge.offsetHeight + 6}px`;
  }

  function level() {
    const h = heapMB();
    const up = uptimeH();
    if (disconnectedSince || (h !== null && h >= CFG.reloadHeapMB) || up >= CFG.maxUptimeHours || laggySince) return 'bad';
    if ((h !== null && h >= CFG.warnHeapMB) || up >= CFG.maxUptimeHours * 0.75 || lagEma > CFG.lagReloadMs / 2) return 'warn';
    return 'ok';
  }

  function statusText() {
    if (flowActive && flowState) return flowState;
    if (disconnectedSince) {
      if (!navigator.onLine) return "Room disconnected and you're offline — will reload once you're back online.";
      if (Date.now() < discSnoozeUntil) return `Room disconnected — auto-reload paused until ${fmtClock(discSnoozeUntil)}.`;
      const leftS = Math.max(0, (discThresholdMs() - (Date.now() - disconnectedSince)) / 1000);
      return `Room disconnected for ${fmtSecs(disconnectedSecs())}. Reloading in ~${fmtSecs(leftS)} if it doesn't recover.`;
    }
    if (Date.now() < snoozeUntil) return `Auto-reload snoozed until ${fmtClock(snoozeUntil)}.`;
    const h = heapMB();
    const parts = [];
    if (h !== null) parts.push(`${fmtMB(CFG.reloadHeapMB)} memory`);
    parts.push(`${CFG.maxUptimeHours} h open`);
    parts.push(`${CFG.lagSustainMin} min of lag`);
    let s = `Auto-reloads at ${parts.join(', ')} — only when you're idle. Also recovers if the room disconnects.`;
    const g = growthMBPerHour();
    if (h !== null && g && g > 0 && h < CFG.reloadHeapMB) {
      const etaMs = ((CFG.reloadHeapMB - h) / g) * 3_600_000;
      if (etaMs < 12 * 3_600_000) s += ` At this rate: ~${fmtClock(Date.now() + etaMs)}.`;
    }
    return s;
  }

  function renderStats() {
    const h = heapMB();
    const lv = level();
    dot.className = `w2gwd-dot w2gwd-${lv}`;
    if (disconnectedSince) label.textContent = `Disconnected · ${fmtSecs(disconnectedSecs())}`;
    else label.textContent = h !== null ? `${fmtMB(h)} · ${fmtH(uptimeH())}` : `${fmtH(uptimeH())} open`;
    if (panel.hidden) return;

    field('conn').textContent = disconnectedSince ? `Disconnected ${fmtSecs(disconnectedSecs())}` : 'Connected';
    field('mem').textContent = h !== null ? `${fmtMB(h)} / ${fmtMB(CFG.reloadHeapMB)}` : 'n/a in this browser';
    const pct = h !== null ? Math.min(100, (h / CFG.reloadHeapMB) * 100) : 0;
    memBar.style.width = `${pct}%`;
    memBar.className = `w2gwd-${lv}`;
    const g = growthMBPerHour();
    field('growth').textContent = g === null ? 'measuring…' : `${g > 0 ? '+' : ''}${g} MB/h`;
    field('uptime').textContent = `${fmtH(uptimeH())} / ${CFG.maxUptimeHours} h`;
    field('dom').textContent = domCount().toLocaleString();
    field('lag').textContent = document.visibilityState === 'visible' ? `${Math.round(lagEma)} ms` : 'tab hidden';
    field('status').textContent = statusText();
    snoozeBtn.textContent = Date.now() < snoozeUntil ? 'Resume' : `Snooze ${CFG.snoozeMin} min`;
  }

  function sampleHeap() {
    const h = heapMB();
    if (h === null) return;
    const now = Date.now();
    heapSamples.push([now, h]);
    while (heapSamples.length && now - heapSamples[0][0] > 15 * 60_000) heapSamples.shift(); // 15-min window
  }

  function setBadgeHidden(hidden) {
    localStorage.setItem(LS_HIDDEN, hidden ? '1' : '');
    badge.style.display = hidden ? 'none' : '';
    if (hidden) { panel.hidden = true; badge.classList.remove('w2gwd-open'); }
  }

  document.body.appendChild(badge);
  document.body.appendChild(panel);
  placeUI();
  setBadgeHidden(!!localStorage.getItem(LS_HIDDEN));
  sampleHeap();
  renderStats();
  setInterval(() => {
    if (document.visibilityState === 'visible') renderStats();
  }, CFG.statsEveryMs);
  setInterval(sampleHeap, 30_000);

  function toggleSnooze() {
    if (Date.now() < snoozeUntil) snoozeUntil = 0;
    else snoozeUntil = Date.now() + CFG.snoozeMin * 60_000;
    renderStats();
  }

  // ---------------- Reload flow ----------------
  function doReload(kind = '') {
    try {
      const input = findChatInput();
      if (input && input.value) sessionStorage.setItem(SS_DRAFT, input.value);
      sessionStorage.setItem(SS_NOTE, statsLine());
      sessionStorage.setItem(SS_REASON, kind);
      if (kind === 'disconnect') sessionStorage.setItem(SS_DISC, JSON.stringify([...recentDiscReloads(), Date.now()]));
    } catch (_) {}
    location.reload();
  }

  function resetFlow() {
    if (waitTimer) { clearInterval(waitTimer); waitTimer = null; }
    if (activeCountdown) activeCountdown.stop();
    flowActive = false; flowKind = ''; flowState = '';
  }

  function startReloadFlow(reason) {
    if (flowActive || Date.now() < snoozeUntil) return;
    flowActive = true;
    flowKind = 'normal';
    flowState = `${reason} Waiting until you're idle to reload…`;
    renderStats();

    // Step 1: wait for a safe moment (idle and not typing). Hidden tab = safe right away.
    waitTimer = setInterval(() => {
      if (Date.now() < snoozeUntil) { resetFlow(); renderStats(); return; }
      const hidden = document.visibilityState === 'hidden';
      const idle = Date.now() - lastInput > CFG.idleBeforeReloadSec * 1000;
      if (hidden) { resetFlow(); doReload(); return; }
      if (idle && !isTyping()) {
        clearInterval(waitTimer); waitTimer = null;
        countdown(reason, {
          notNowLabel: `Not now (${CFG.snoozeMin} min)`,
          onNotNow: () => { snoozeUntil = Date.now() + CFG.snoozeMin * 60_000; },
        });
      }
    }, 1000);
  }

  function countdown(reason, {
    seconds = CFG.countdownSec,
    cancelOnInput = true,       // any user activity postpones (normal flow); disconnect flow ignores input
    abortIf = null,             // e.g. room reconnected on its own
    kind = '',
    notNowLabel = 'Not now',
    onNotNow = () => {},
  } = {}) {
    let left = seconds;
    flowState = `${reason} Reload countdown running.`;
    const msg = () => `${reason} Reloading in ${left}s — the room will resync automatically.`;
    const el = toast({
      title: kind === 'disconnect' ? 'Room lost its connection' : 'Refreshing room to keep it smooth',
      body: msg(),
      meta: statsLine(),
      progress: 1,
      actions: [
        { label: notNowLabel, onClick: () => { stop(); onNotNow(); renderStats(); } },
        { label: 'Reload now', primary: true, onClick: () => doReload(kind) },
      ],
    });
    const body = el.querySelector('.w2gwd-body');
    const bar = el.querySelector('.w2gwd-bar > div');
    const startInput = lastInput;

    const t = setInterval(() => {
      // Activity (other than hovering our toast) postpones; the next check cycle retries once idle
      if ((cancelOnInput && lastInput !== startInput && !el.matches(':hover')) || (abortIf && abortIf())) {
        stop(); renderStats();
        return;
      }
      left--;
      body.textContent = msg();
      bar.style.width = `${(left / seconds) * 100}%`;
      if (left <= 0) { clearInterval(t); doReload(kind); }
    }, 1000);

    function stop() {
      clearInterval(t);
      if (toastEl === el) closeToast();
      activeCountdown = null;
      flowActive = false; flowKind = ''; flowState = '';
    }
    activeCountdown = { stop };
  }

  // ---------------- Connection watchdog (stuck "not connected" spinner) ----------------
  function checkConnection() {
    if (!isDisconnected()) {
      if (disconnectedSince) {
        disconnectedSince = 0;
        if (flowKind === 'disconnect') resetFlow();
        renderStats();
      }
      return;
    }
    disconnectedSince ||= Date.now();
    if (flowKind === 'disconnect' || Date.now() < discSnoozeUntil || !navigator.onLine) return;
    if (Date.now() - disconnectedSince < discThresholdMs()) return;

    resetFlow(); // a disconnect overrides any pending memory/uptime flow
    const reason = `The room has been disconnected for ${fmtSecs(disconnectedSecs())} and hasn't recovered.`;
    if (document.visibilityState === 'hidden') { doReload('disconnect'); return; }
    flowActive = true;
    flowKind = 'disconnect';
    countdown(reason, {
      seconds: CFG.disconnectCountdownSec,
      cancelOnInput: false,
      abortIf: () => !isDisconnected(),
      kind: 'disconnect',
      notNowLabel: `Not now (${CFG.disconnectSnoozeMin} min)`,
      onNotNow: () => { discSnoozeUntil = Date.now() + CFG.disconnectSnoozeMin * 60_000; },
    });
    renderStats();
  }
  setInterval(checkConnection, 2000);

  // ---------------- Lag monitor (only while visible; hidden tabs are throttled) ----------------
  let expected = performance.now() + 1000;
  setInterval(() => {
    const now = performance.now();
    const drift = Math.max(0, now - expected);
    expected = now + 1000;
    if (document.visibilityState !== 'visible') { laggySince = 0; lagEma = 0; return; }
    lagEma = lagEma * 0.8 + drift * 0.2;
    if (lagEma > CFG.lagReloadMs) { laggySince ||= Date.now(); }
    else laggySince = 0;
  }, 1000);

  // ---------------- Main check ----------------
  function check() {
    if (flowKind === 'disconnect' || disconnectedSince) return; // connection watchdog handles this
    const h = heapMB();
    if (h !== null && h >= CFG.reloadHeapMB) return startReloadFlow(`Memory has grown to ${fmtMB(h)}.`);
    if (uptimeH() >= CFG.maxUptimeHours) return startReloadFlow(`The room has been open ${fmtH(uptimeH())}.`);
    if (laggySince && Date.now() - laggySince > CFG.lagSustainMin * 60_000)
      return startReloadFlow('The page has been lagging for a few minutes.');
    if (h !== null && h >= CFG.warnHeapMB && !warned && !flowActive) {
      warned = true;
      toast({
        title: 'Room is getting heavy',
        body: `Memory is at ${fmtMB(h)}. It will refresh itself at ${fmtMB(CFG.reloadHeapMB)} when you're idle.`,
        actions: [{ label: 'Reload now', primary: true, onClick: () => doReload() }, { label: 'OK', onClick: closeToast }],
        autoHideMs: 12_000,
      });
    }
  }
  setInterval(check, CFG.checkEveryMs);

  // ---------------- After a reload: restore chat draft + confirm ----------------
  try {
    const draft = sessionStorage.getItem(SS_DRAFT);
    const note = sessionStorage.getItem(SS_NOTE);
    const reason = sessionStorage.getItem(SS_REASON);
    sessionStorage.removeItem(SS_DRAFT);
    sessionStorage.removeItem(SS_NOTE);
    sessionStorage.removeItem(SS_REASON);
    if (draft) {
      const t0 = Date.now();
      const iv = setInterval(() => {
        const input = findChatInput();
        if (input) {
          clearInterval(iv);
          const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set;
          setter.call(input, draft);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (Date.now() - t0 > 20_000) clearInterval(iv);
      }, 500);
    }
    if (note) {
      const disc = reason === 'disconnect';
      setTimeout(() => toast({
        title: disc ? 'Room reconnected' : 'Room refreshed',
        body: disc
          ? `The room had lost its connection, so it was reloaded.${draft ? ' Your chat draft was restored.' : ''}`
          : draft ? 'Your chat draft was restored.' : 'Everything should feel snappy again.',
        meta: `Before: ${note}`,
        autoHideMs: 8000,
      }), 2500);
    }
  } catch (_) {}

  // ---------------- Menu ----------------
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Show / hide stats badge', () => setBadgeHidden(badge.style.display !== 'none'));
    GM_registerMenuCommand('Move stats badge to next corner', () => {
      corner = CORNERS[(CORNERS.indexOf(corner) + 1) % CORNERS.length];
      localStorage.setItem(LS_CORNER, corner);
      placeUI();
    });
    GM_registerMenuCommand('Reload room now (keep chat draft)', () => doReload());
    GM_registerMenuCommand(`Snooze / resume auto-reload`, () => {
      toggleSnooze();
      toast({
        title: 'W2G Watchdog',
        body: Date.now() < snoozeUntil ? `Auto-reload snoozed until ${fmtClock(snoozeUntil)}.` : 'Auto-reload resumed.',
        autoHideMs: 4000,
      });
    });
  }
})();
