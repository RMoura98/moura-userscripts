// ==UserScript==
// @name         Riverside Copy Transcript – one-click transcript to clipboard
// @icon         https://www.google.com/s2/favicons?sz=64&domain=riverside.com
// @namespace    https://github.com/RMoura98/moura-userscripts
// @author       @RMoura98
// @version      2026-11-19
// @description  Adds a "Copy transcript" button to the Riverside editor header that copies the full transcript (with speakers and timestamps) to the clipboard.
// @match        https://riverside.com/*
// @run-at       document-idle
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @updateURL    https://github.com/RMoura98/moura-userscripts/raw/main/riverside-copy-transcript.user.js
// @downloadURL  https://github.com/RMoura98/moura-userscripts/raw/main/riverside-copy-transcript.user.js
// ==/UserScript==

(function () {
  'use strict';

  const BTN_ID = 'moura-copy-transcript-btn';
  const TRANSCRIPT_RE = /\/api\/v4\/transcriptions\/editable[^/]*\/[^/?]+/;

  // The editor draws the transcript on a <canvas>, so there is no DOM text to copy.
  // Instead we reuse the signed transcription request the editor already made.
  let lastTranscriptUrl = null;

  function scanEntries(entries) {
    for (const e of entries) {
      if (TRANSCRIPT_RE.test(e.name)) lastTranscriptUrl = e.name;
    }
  }
  scanEntries(performance.getEntriesByType('resource'));
  try {
    new PerformanceObserver((list) => scanEntries(list.getEntries()))
      .observe({ type: 'resource', buffered: true });
  } catch (_) { /* older browsers: rely on getEntriesByType at click time */ }

  function findTranscriptUrl() {
    scanEntries(performance.getEntriesByType('resource'));
    if (!lastTranscriptUrl) return null;
    // Prefer the request for the session currently open in the editor.
    const m = location.pathname.match(/\/editor\/([^/]+)/);
    if (m && !lastTranscriptUrl.includes(m[1])) {
      const match = performance.getEntriesByType('resource')
        .map((e) => e.name)
        .filter((n) => TRANSCRIPT_RE.test(n) && n.includes(m[1]))
        .pop();
      if (match) return match;
    }
    return lastTranscriptUrl;
  }

  function fmtTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  function buildTranscript(data) {
    const speakers = (data && data.speakers) || [];
    const sentences = [];
    for (const sp of speakers) {
      for (const sentence of sp.sentences || []) {
        const words = (sentence.words || []).filter(
          (w) => Array.isArray(w) && w[0] && w[3] !== 'noise'
        );
        if (!words.length) continue;
        sentences.push({
          speaker: sp.name || 'Speaker',
          start: words[0][1] || 0,
          text: words.map((w) => w[0]).join(' ').replace(/\s+([,.!?;:])/g, '$1'),
        });
      }
    }
    sentences.sort((a, b) => a.start - b.start);

    const blocks = [];
    for (const s of sentences) {
      const last = blocks[blocks.length - 1];
      if (last && last.speaker === s.speaker) last.text.push(s.text);
      else blocks.push({ speaker: s.speaker, start: s.start, text: [s.text] });
    }
    return blocks
      .map((b) => `${b.speaker} [${fmtTime(b.start)}]\n${b.text.join(' ')}`)
      .join('\n\n');
  }

  async function copyTranscript() {
    const url = findTranscriptUrl();
    if (!url) throw new Error('Transcript not loaded yet — wait for the editor to finish loading and try again.');
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`Transcript request failed (${res.status}). Reload the page and try again.`);
    const json = await res.json();
    const text = buildTranscript(json.data);
    if (!text) throw new Error('The transcript is empty.');
    GM_setClipboard(text, 'text');
    return text;
  }

  const ICON_COPY =
    '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-button--icon">' +
    '<path d="M6.667 6.667V4.333c0-.933 0-1.4.181-1.757.16-.313.415-.568.729-.728.356-.182.823-.182 1.756-.182h6.334c.933 0 1.4 0 1.756.182.314.16.569.415.729.728.181.357.181.824.181 1.757v6.334c0 .933 0 1.4-.181 1.756-.16.314-.415.569-.729.729-.356.181-.823.181-1.756.181h-2.334M4.333 18.333h6.334c.933 0 1.4 0 1.756-.181.314-.16.569-.415.729-.729.181-.356.181-.823.181-1.756V9.333c0-.933 0-1.4-.181-1.756a1.667 1.667 0 0 0-.729-.729c-.356-.181-.823-.181-1.756-.181H4.333c-.933 0-1.4 0-1.756.181-.314.16-.569.415-.729.729-.181.356-.181.823-.181 1.756v6.334c0 .933 0 1.4.181 1.756.16.314.415.569.729.729.356.181.823.181 1.756.181Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_DONE =
    '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-button--icon">' +
    '<path d="M16.667 5 7.5 14.167 3.333 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_ERROR =
    '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-button--icon">' +
    '<path d="M15 5 5 15M5 5l10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function setState(btn, icon, title) {
    btn.innerHTML = icon;
    btn.title = title;
  }

  async function onClick(btn) {
    if (btn.dataset.busy) return;
    btn.dataset.busy = '1';
    try {
      const text = await copyTranscript();
      const words = text.split(/\s+/).length;
      setState(btn, ICON_DONE, `Copied transcript (${words.toLocaleString()} words)`);
    } catch (err) {
      console.warn('[Riverside Copy Transcript]', err);
      setState(btn, ICON_ERROR, err.message);
    }
    setTimeout(() => {
      setState(btn, ICON_COPY, 'Copy transcript');
      delete btn.dataset.busy;
    }, 2000);
  }

  function ensureButton() {
    if (document.getElementById(BTN_ID)) return;
    // Anchor next to the native Comments button so the new button inherits its look.
    const anchor =
      document.querySelector('[data-testid="topbar-chat-btn"]') ||
      document.querySelector('[data-testid="editor-header"] button[aria-label="Comments"]');
    if (!anchor) return;

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.className = anchor.className;
    btn.setAttribute('aria-label', 'Copy transcript');
    setState(btn, ICON_COPY, 'Copy transcript');
    btn.addEventListener('click', () => onClick(btn));
    anchor.parentElement.insertBefore(btn, anchor);
  }

  new MutationObserver(ensureButton).observe(document.body, { childList: true, subtree: true });
  ensureButton();

  GM_registerMenuCommand('Copy transcript', () => {
    const btn = document.getElementById(BTN_ID);
    if (btn) onClick(btn);
    else copyTranscript().catch((err) => alert(err.message));
  });
})();
