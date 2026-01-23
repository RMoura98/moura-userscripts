// ==UserScript==
// @name         Ultimate Guitar Inline Chords (2026)
// @namespace    https://github.com/RMoura98/moura-userscripts
// @version      2026-01-01
// @description  Replaces the chord labels with inline chords
// @author       @RMoura98 (https://github.com/RMoura98)
// @match        https://tabs.ultimate-guitar.com/tab/*
// @match        https://tabs.ultimate-guitar.com/user/tab/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ultimate-guitar.com
// @grant        GM_addStyle
// @updateURL    https://github.com/RMoura98/moura-userscripts/raw/main/ultimate-guitar-inline-chords.user.js
// @downloadURL  https://github.com/RMoura98/moura-userscripts/raw/main/ultimate-guitar-inline-chords.user.js
// ==/UserScript==

// --- Configuration ---
const CONFIG = {
    TABPANEL_SELECTOR: "[role=tabpanel]",
    // Where the source chords live (top of page)
    CHORD_BLOCK_SELECTOR: "section",
    CHORD_NAME_SELECTOR: "span",
    CANVAS_SELECTOR: "canvas",
    CANVAS_NODE_NAME: "CANVAS",
    CLONE_ID: "ug-inline-chords-clone",

    // Where the lyrics live
    LYRICS_CONTAINER_SELECTOR: "code > pre",
    CHORD_SPAN_SELECTOR: "span[data-name]",

    // Visual settings
    SCALE: 0.6, // Make chords smaller to fit text
    STYLE: `
        .ugic-stack {
            display: inline-flex !important;
            flex-direction: column !important;
            align-items: center !important;
            vertical-align: text-bottom !important;
            margin: 0 -10px -5px -10px !important;
            cursor: pointer !important;
            line-height: 1 !important;
            border: none !important;
            background: none !important;
        }
        .ugic-label {
            font-size: 7px !important;
            font-weight: bold !important;
            font-family: Roboto, sans-serif !important;
            display: block !important;
        }
        .ugic-canvas {
            display: block !important;
            pointer-events: none !important;
        }
        #ug-inline-chords-clone {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            /* Ensure the clone takes up space properly */
            height: auto !important;
            overflow: visible !important;
        }
        .ugic-stack-wrapper:after {
            display: unset;
            background: unset;
        }
    `
}

GM_addStyle(CONFIG.STYLE)

/**
 * Generates a dictionary mapping chord names to their FIRST canvas element.
 * Returns: { "Am": <canvas>, "C": <canvas>, ... }
 * Robustly handles the structure: <section> -> <div><span>Name</span></div> -> <div><canvas></div>
 */
const getChordCanvasMap = (tabpanel) => {
    const chordMap = {}
    const chordSections = tabpanel.querySelectorAll(CONFIG.CHORD_BLOCK_SELECTOR)

    chordSections.forEach(section => {
        // 1. Get Chord Name (First span usually holds the text like "Em7")
        const nameEl = section.querySelector(CONFIG.CHORD_NAME_SELECTOR)
        if (!nameEl) return

        const chordName = nameEl.textContent.trim()

        // 2. Get the Canvas (There might be multiple, we usually want the second one)
        const canvas = section.querySelectorAll(CONFIG.CANVAS_SELECTOR)[1]

        // 3. Map it
        if (chordName && canvas) {
            chordMap[chordName] = canvas
        }
    })

    return chordMap
}
const createChordStack = (chordName, sourceCanvas) => {
    // 1. Container
    const wrapper = document.createElement("span")
    wrapper.className = "ugic-stack" // Custom class

    // 2. Label
    const label = document.createElement("span")
    label.className = "ugic-label" // Custom class
    label.textContent = chordName

    // 3. Canvas
    const newCanvas = document.createElement("canvas")
    newCanvas.className = "ugic-canvas" // Custom class
    newCanvas.width = sourceCanvas.width
    newCanvas.height = sourceCanvas.height
    newCanvas.style.width = (sourceCanvas.width * CONFIG.SCALE) + "px"
    newCanvas.style.height = (sourceCanvas.height * CONFIG.SCALE) + "px"
    newCanvas.getContext("2d").drawImage(sourceCanvas, 0, 0)

    wrapper.appendChild(label)
    wrapper.appendChild(newCanvas)
    return wrapper
}
const injectInlineChords = (chordMap) => {
    const originalLyrics = document.querySelector(CONFIG.LYRICS_CONTAINER_SELECTOR);
    if (!originalLyrics) return;

    // 1. PREPARE: Apply the "Tiny Font" Hack
    const originalLyricsFontSize = originalLyrics.style.fontSize;
    originalLyrics.style.display = "block";
    originalLyrics.style.fontSize = "0.000001px"; // Make content tiny so it all "fits" to force it to render
    originalLyrics.style.lineHeight = "1px"; // Safety for line-height calculations

    // 2. TRIGGER: Scroll to top to force recalc from index 0
    window.scrollTo(0, 0);
    if (originalLyrics.scrollTop) originalLyrics.scrollTop = 0;

    console.log("⏳ Waiting for virtualizer to catch up...");

    // 3. WAIT & CLONE (The Fix)
    // We give React to realize it needs to render everything.
    setTimeout(() => {
        // --- START OF DELAYED CODE ---
        const oldClone = document.getElementById(CONFIG.CLONE_ID);
        if (oldClone) oldClone.remove();

        // Now that the delay passed, the DOM should be full.
        const clone = originalLyrics.cloneNode(true);
        clone.id = CONFIG.CLONE_ID;

        // Process the clone (Your original logic)
        const chordSpans = clone.querySelectorAll(CONFIG.CHORD_SPAN_SELECTOR);
        chordSpans.forEach(span => {
            const chordName = span.getAttribute("data-name") || span.textContent.trim();
            const sourceCanvas = chordMap[chordName];

            if (sourceCanvas) {
                const stack = createChordStack(chordName, sourceCanvas);
                span.innerHTML = "";
                span.classList.add("ugic-stack-wrapper")
                span.appendChild(stack);
                span.removeAttribute("data-name");
                span.style.cssText = "display: inline-flex !important; border: none !important; vertical-align: middle;";
            }
        });

        // RESTORE & SWAP
        // Restore styling on the clone so it looks normal to the user
        clone.style.fontSize = originalLyricsFontSize || "initial";
        clone.style.lineHeight = "initial";
        clone.style.display = "block";

        // Hide original (don't remove, or React crashes)
        originalLyrics.style.display = "none";
        // Restore original font size (just in case we need to revert later)
        originalLyrics.style.fontSize = originalLyricsFontSize;

        if (originalLyrics.parentElement) {
            originalLyrics.parentElement.appendChild(clone);
        }

        console.log(`[UGIC] 🔨 Swapped in clone with ${chordSpans.length} chords`);
        // --- END OF DELAYED CODE ---

    }, 100); // 250ms delay is usually enough for React to render
};
;(function () {
    "use strict"
    console.log("[UGIC] 🧙‍♂️ Ultimate Guitar Inline Chords script started")

    const observer = new MutationObserver((mutations) => {
        const tabpanel = document.querySelector(CONFIG.TABPANEL_SELECTOR)
        if (!tabpanel) return

        const canvasChanged = mutations.some(m =>
            // 1. Ensure mutation is inside tabpanel
            tabpanel.contains(m.target) &&
            // 2. Check added or removed nodes for a canvas
            [...m.addedNodes, ...m.removedNodes].some(node => node.nodeName === CONFIG.CANVAS_NODE_NAME)
        )

        if (canvasChanged) {
            const chordMap = getChordCanvasMap(tabpanel)
            console.log(`[UGIC] 👁️ At least one canvas changed inside ${CONFIG.TABPANEL_SELECTOR} element`, chordMap)
            if (Object.keys(chordMap).length === 0) return

            injectInlineChords(chordMap)
        }
    })

    observer.observe(document, { childList: true, subtree: true })
})()
