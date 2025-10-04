// ==UserScript==
// @name         Ultimate Guitar inline chords
// @namespace    https://github.com/RMoura98/moura-userscripts
// @version      2024-10-04
// @description  Replaces chord labels with inline chord diagrams
// @author       @RMoura98
// @match        https://tabs.ultimate-guitar.com/tab/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ultimate-guitar.com
// @grant        GM_addStyle
// @updateURL    https://github.com/RMoura98/moura-userscripts/raw/main/ultimate-guitar-inline-chords.user.js
// @downloadURL  https://github.com/RMoura98/moura-userscripts/raw/main/ultimate-guitar-inline-chords.user.js
// ==/UserScript==

GM_addStyle(`
  span[data-name] {
    font-size: 0;
    margin: -25px -28px !important;
    display: inline-block;
    height: 50px;
    transform: translate(0, 15px);
  }
  span[data-name]:after {
    content: none;
  }
`);

// Config
const CHORD_SECTION_SELECTOR = "article > section:nth-child(2) > article > section";
const CHORD_SECTION_TO_CHORDS_SELECTOR = "section > div > div";
const CANVAS_SIZE_MULTIPLIER = 0.7;

// Utils
const debounce = (fn, delay, immediate = false) => {
  let timer;
  return function(...args) {
    const callNow = immediate && !timer;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!immediate) fn.apply(this, args);
    }, delay);
    if (callNow) fn.apply(this, args);
  };
};

// Core helpers
const findChordElements = () => {
  const section = document.querySelector(CHORD_SECTION_SELECTOR);
  return section ? section.querySelectorAll(CHORD_SECTION_TO_CHORDS_SELECTOR) : [];
};

const mapChordToCanvas = chords =>
  [...chords].reduce((map, el) => {
    const name = el.children[0]?.textContent;
    const canvas = el.querySelector("canvas");
    if (name && canvas) map[name] = canvas;
    return map;
  }, {});

const copyCanvas = (src, dest) => {
  const ctx = dest.getContext("2d");
  ctx.drawImage(src, 0, 0);
};

const addInlineChords = chordElements => {
  const chordMap = mapChordToCanvas(chordElements);
  const chordLabels = document.querySelectorAll("span[data-name]");

  chordLabels.forEach(label => {
    const sourceCanvas = chordMap[label.textContent];
    if (!sourceCanvas) return;

    // Replace label content with scaled canvas
    label.innerHTML = "";
    const newCanvas = sourceCanvas.cloneNode(true);
    newCanvas.style.transform = `scale(${CANVAS_SIZE_MULTIPLIER})`;
    copyCanvas(sourceCanvas, newCanvas);
    label.appendChild(newCanvas);
  });
};

const reAddInlineChords = debounce(() => {
  const chords = findChordElements();
  if (chords.length) addInlineChords(chords);
}, 250);

const watchChordChanges = canvases => {
  canvases.forEach(canvas => {
    new MutationObserver(() => reAddInlineChords())
      .observe(canvas.parentElement, { childList: true, subtree: true });
  });
};

// Init
(function() {
  'use strict';

  const observer = new MutationObserver((_changes, obs) => {
    const chordElements = findChordElements();
    const canvases = [...chordElements].map(c => c.querySelector("canvas")).filter(Boolean);

    if (!canvases.length) return;

    // Check if all canvases are identical (empty placeholders)
    const firstData = canvases[0].toDataURL();
    const allEmpty = canvases.every(c => c.toDataURL() === firstData);

    if (!allEmpty) {
      obs.disconnect();
      addInlineChords(chordElements);
      watchChordChanges(canvases);
    }
  });

  observer.observe(document, { childList: true, subtree: true });
})();
