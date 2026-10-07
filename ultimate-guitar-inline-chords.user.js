// ==UserScript==
// @name         Ultimate Guitar Inline Chords
// @namespace    https://github.com/RMoura98/moura-userscripts
// @version      2026-10-07
// @description  Replaces the chord labels with inline chords
// @author       @RMoura98 (https://github.com/RMoura98)
// @match        https://tabs.ultimate-guitar.com/*
// @match        https://www.ultimate-guitar.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ultimate-guitar.com
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @updateURL    https://github.com/RMoura98/moura-userscripts/raw/main/ultimate-guitar-inline-chords.user.js
// @downloadURL  https://github.com/RMoura98/moura-userscripts/raw/main/ultimate-guitar-inline-chords.user.js
// ==/UserScript==

/*
 * Design goal: depend on as little of Ultimate Guitar's markup as possible.
 *
 *  - Lyrics are found as "the block that holds the most chord spans", not by a fixed path.
 *  - Chord diagrams are found by scanning EVERY <canvas> on the page and walking up
 *    until a known chord name (taken from the lyrics) appears next to it. No reliance
 *    on [role=tabpanel], <section>, wrapper depth, class names or canvas index.
 *  - Everything is re-evaluated whenever the page changes (transpose, instrument
 *    switch, SPA navigation, late canvas painting), and the original lyrics are
 *    restored automatically if no diagrams are available.
 *
 * Layout: every inline diagram occupies exactly the width of the chord name it
 * replaces, so the lyrics/chord alignment of the original tab is preserved. A diagram
 * is only nudged to the right when it would otherwise cover the previous one.
 *
 * Interaction: hovering (or clicking) an inline diagram is forwarded to the hidden
 * original chord, so Ultimate Guitar's own chord popup opens right above it.
 *
 * Controls: small panel in the bottom-right corner (on/off, size). Alt+I toggles.
 */

;(function () {
    "use strict"

    // --- Configuration ---
    const CONFIG = {
        CLONE_ID: "ug-inline-chords-clone",
        PANEL_ID: "ugic-panel",
        SETTINGS_KEY: "ugic-settings",

        // Preferred way to recognise a chord inside the lyrics
        CHORD_SPAN_SELECTOR: "span[data-name]",
        CHORD_NAME_ATTR: "data-name",
        // Fallback when the attribute above disappears: leaf <span>s whose text looks like a chord
        CHORD_REGEX: /^[A-H][#b♯♭]?(?:maj|min|dim|aug|sus|add|m|M|\d|[#b♯♭+\-°ø()])*(?:\/[A-H][#b♯♭]?)?$/,
        MIN_FALLBACK_CHORDS: 4,

        // How far up from a <canvas> we look for its chord name
        MAX_ANCESTOR_DEPTH: 8,

        // Visual settings (the scale is the default; the panel overrides and remembers it)
        DEFAULT_SCALE: 0.6,
        MIN_SCALE: 0.3,
        MAX_SCALE: 1.5,
        SCALE_STEP: 0.1,
        COLLISION_GAP: 3, // px kept between two neighbouring diagrams

        // Timings (ms)
        THROTTLE: 200,
        REPAINT_DELAYS: [400, 1200, 3000], // re-copy diagrams in case UG painted them late
        DIAGNOSE_AFTER: 8000,

        // Set to true ONLY if lyrics come out truncated (UG virtualizing the lyric lines).
        // It briefly shrinks the lyrics and scrolls to the top to force a full render.
        FORCE_FULL_RENDER: false,
        FORCE_FULL_RENDER_DELAY: 150,

        DEBUG: false,

        STYLE: `
        #ug-inline-chords-clone {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            /* Ensure the clone takes up space properly */
            height: auto !important;
            overflow: visible !important;
        }
        /* Takes exactly the room of the chord name it replaces (width is set inline, in ch) */
        .ugic-stack-wrapper {
            display: inline-flex !important;
            justify-content: flex-start !important;
            align-items: flex-end !important;
            box-sizing: content-box !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            background: none !important;
            vertical-align: bottom !important;
            cursor: pointer !important;
        }
        .ugic-stack-wrapper:after {
            display: unset;
            background: unset;
        }
        /* The diagram itself: allowed to overflow its wrapper to the right */
        .ugic-stack {
            display: flex !important;
            flex: none !important;
            flex-direction: column !important;
            align-items: center !important; /* chord name centered over its diagram */
            margin: 0 0 1px 0 !important;
            line-height: 1 !important;
            border: none !important;
            background: none !important;
        }
        .ugic-label {
            font-size: var(--ugic-label-size, 7px) !important;
            font-weight: bold !important;
            font-family: Roboto, sans-serif !important;
            white-space: nowrap !important;
            text-align: center !important;
            display: block !important;
        }
        .ugic-canvas {
            display: block !important;
            pointer-events: none !important;
        }

        #ugic-panel {
            position: fixed;
            right: 16px;
            bottom: 16px;
            z-index: 2147483000;
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 6px;
            border-radius: 8px;
            background: rgba(30, 30, 30, .92);
            color: #fff;
            font: 12px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            box-shadow: 0 2px 8px rgba(0, 0, 0, .3);
            opacity: .45;
            transition: opacity .15s;
            user-select: none;
        }
        #ugic-panel:hover, #ugic-panel:focus-within { opacity: 1; }
        #ugic-panel button {
            all: unset;
            cursor: pointer;
            padding: 3px 8px;
            border-radius: 5px;
            background: rgba(255, 255, 255, .14);
            color: #fff;
            font: inherit;
        }
        #ugic-panel button:hover { background: rgba(255, 255, 255, .28); }
        #ugic-panel button:focus-visible { outline: 2px solid #fff; }
        #ugic-panel .ugic-scale { min-width: 36px; text-align: center; }
        #ugic-panel.ugic-off .ugic-size { display: none; }
        @media print { #ugic-panel { display: none !important; } }
    `
    }

    const log = (...args) => console.log("[UGIC]", ...args)
    const debug = (...args) => { if (CONFIG.DEBUG) console.log("[UGIC]", ...args) }

    // --- Styles ---
    const addStyle = (css) => {
        try {
            if (typeof GM_addStyle === "function") return GM_addStyle(css)
        } catch (e) { /* fall through */ }
        const style = document.createElement("style")
        style.textContent = css
        ;(document.head || document.documentElement).appendChild(style)
    }
    addStyle(CONFIG.STYLE)

    // --- Settings (remembered between visits) ---
    const clampScale = (value) => {
        const number = Number(value)
        if (!Number.isFinite(number)) return CONFIG.DEFAULT_SCALE
        return Math.round(Math.min(CONFIG.MAX_SCALE, Math.max(CONFIG.MIN_SCALE, number)) * 10) / 10
    }

    const loadSettings = () => {
        let raw = null
        try {
            if (typeof GM_getValue === "function") raw = GM_getValue(CONFIG.SETTINGS_KEY, null)
        } catch (e) { /* fall through */ }
        if (raw == null) {
            try { raw = localStorage.getItem(CONFIG.SETTINGS_KEY) } catch (e) { /* ignore */ }
        }
        let stored = {}
        try { stored = (typeof raw === "string" ? JSON.parse(raw) : raw) || {} } catch (e) { /* ignore */ }
        return {
            enabled: stored.enabled !== false,
            scale: clampScale(stored.scale == null ? CONFIG.DEFAULT_SCALE : stored.scale),
        }
    }

    const settings = loadSettings()

    const saveSettings = () => {
        const raw = JSON.stringify(settings)
        try {
            if (typeof GM_setValue === "function") return GM_setValue(CONFIG.SETTINGS_KEY, raw)
        } catch (e) { /* fall through */ }
        try { localStorage.setItem(CONFIG.SETTINGS_KEY, raw) } catch (e) { /* ignore */ }
    }

    // --- State ---
    let lastSignature = null
    let lastChordMap = new Map()
    let lastLayoutKey = null
    let building = false
    let scheduled = false
    let paintPairs = [] // [{ target, source }]
    let repaintTimers = []
    let currentLyrics = null // the original (React-owned) lyrics block
    let originalSpans = [] // chord spans of the original, same order as in the clone
    let ghostedLyrics = null // original lyrics block currently hidden by us
    let hoveredWrapper = null
    let shiftedSpan = null // original chord currently moved under the hovered inline diagram
    const canvasIds = new WeakMap()
    let canvasIdCounter = 0

    const ownSelector = `#${CONFIG.CLONE_ID}, #${CONFIG.PANEL_ID}`
    const getClone = () => document.getElementById(CONFIG.CLONE_ID)
    const insideOwn = (el) => !!(el && el.closest && el.closest(ownSelector))
    const isOwnNode = (node) =>
        node.nodeType === Node.ELEMENT_NODE && (node.id === CONFIG.CLONE_ID || node.id === CONFIG.PANEL_ID)
    const canvasId = (canvas) => {
        if (!canvasIds.has(canvas)) canvasIds.set(canvas, ++canvasIdCounter)
        return canvasIds.get(canvas)
    }

    // --- Lyrics discovery ---

    /** Chord spans inside a given root (attribute first, chord-looking text as fallback). */
    const getChordSpans = (root) => {
        const byAttr = root.querySelectorAll(CONFIG.CHORD_SPAN_SELECTOR)
        if (byAttr.length) return [...byAttr]
        return [...root.querySelectorAll("span")].filter(span =>
            span.childElementCount === 0 && CONFIG.CHORD_REGEX.test(span.textContent.trim())
        )
    }

    /** Possible names for one chord span: what is displayed first, then the attribute. */
    const chordNamesOf = (span) => {
        const names = []
        const text = (span.textContent || "").trim()
        const attr = (span.getAttribute(CONFIG.CHORD_NAME_ATTR) || "").trim()
        if (text) names.push(text)
        if (attr && attr !== text) names.push(attr)
        return names
    }

    /** The original lyrics block = the block holding the most chord spans. */
    const findLyrics = () => {
        const tally = new Map()
        const count = (span) => {
            if (insideOwn(span)) return
            const block = span.closest("pre") || span.parentElement
            if (block) tally.set(block, (tally.get(block) || 0) + 1)
        }

        document.querySelectorAll(CONFIG.CHORD_SPAN_SELECTOR).forEach(count)

        let minimum = 1
        if (tally.size === 0) {
            // Fallback: UG dropped the attribute. Look for chord-looking spans inside <pre> blocks.
            minimum = CONFIG.MIN_FALLBACK_CHORDS
            document.querySelectorAll("pre").forEach(pre => {
                if (insideOwn(pre)) return
                getChordSpans(pre).forEach(count)
            })
        }

        let best = null
        let bestCount = 0
        tally.forEach((n, block) => {
            if (n > bestCount) { best = block; bestCount = n }
        })
        return bestCount >= minimum ? best : null
    }

    // --- Diagram discovery ---

    /** Finds the single known chord name written next to a canvas, or null. */
    const findNameForCanvas = (canvas, knownNames) => {
        let el = canvas.parentElement
        for (let depth = 0; el && el !== document.body && depth < CONFIG.MAX_ANCESTOR_DEPTH; depth++, el = el.parentElement) {
            const found = new Set()
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
            let node
            while ((node = walker.nextNode())) {
                const text = node.nodeValue.trim()
                if (text && knownNames.has(text)) {
                    found.add(text)
                    if (found.size > 1) return null // Went too far up: several chords share this ancestor
                }
            }
            if (found.size === 1) return [...found][0]
        }
        return null
    }

    const canvasScore = (canvas) => {
        const rect = canvas.getBoundingClientRect()
        const visible = rect.width > 0 && rect.height > 0
        return (visible ? 1e9 : 0) + canvas.width * canvas.height
    }

    /** Map: chord name -> best source canvas for that chord. */
    const getChordCanvasMap = (knownNames) => {
        const chordMap = new Map()
        if (knownNames.size === 0) return chordMap

        // Stick to the canvases already in use, so temporary ones (UG's hover popup) never take over
        lastChordMap.forEach((canvas, name) => {
            if (knownNames.has(name) && canvas.isConnected && canvas.width && canvas.height) chordMap.set(name, canvas)
        })
        const sticky = new Set(chordMap.keys())

        document.querySelectorAll("canvas").forEach(canvas => {
            if (insideOwn(canvas) || canvas.classList.contains("ugic-canvas")) return
            if (!canvas.width || !canvas.height) return

            const name = findNameForCanvas(canvas, knownNames)
            if (!name || sticky.has(name)) return

            // Several canvases for the same chord: prefer visible, then biggest, then the later one
            const current = chordMap.get(name)
            if (!current || canvasScore(canvas) >= canvasScore(current)) chordMap.set(name, canvas)
        })
        return chordMap
    }

    // --- Rendering ---

    const paint = ({ target, source }) => {
        if (!source.isConnected || !source.width || !source.height) return
        try {
            if (target.width !== source.width) target.width = source.width
            if (target.height !== source.height) target.height = source.height

            const rect = source.getBoundingClientRect()
            const dpr = window.devicePixelRatio || 1
            const cssWidth = rect.width || source.width / dpr
            const cssHeight = rect.height || source.height / dpr
            target.style.width = (cssWidth * settings.scale) + "px"
            target.style.height = (cssHeight * settings.scale) + "px"

            const ctx = target.getContext("2d")
            ctx.clearRect(0, 0, target.width, target.height)
            ctx.drawImage(source, 0, 0)
        } catch (e) {
            debug("Could not copy canvas", e)
        }
    }

    /**
     * Diagrams are wider than chord names, so two chords close together would overlap.
     * Push a diagram right (visually only, the text flow is untouched) just enough to clear the previous one.
     */
    const layoutStacks = () => {
        const clone = getClone()
        if (!clone) return

        const stacks = [...clone.querySelectorAll(".ugic-stack")]
        stacks.forEach(stack => { if (stack.style.transform) stack.style.transform = "" })
        const rects = stacks.map(stack => stack.getBoundingClientRect()) // single layout pass

        let previousRight = -Infinity
        let previousBottom = null
        stacks.forEach((stack, i) => {
            const rect = rects[i]
            if (!rect.width) return

            const sameLine = previousBottom !== null && Math.abs(rect.bottom - previousBottom) < rect.height / 2
            const minLeft = previousRight + CONFIG.COLLISION_GAP
            const shift = sameLine && rect.left < minLeft ? minLeft - rect.left : 0
            if (shift) stack.style.transform = `translateX(${shift}px)`

            previousRight = rect.right + shift
            previousBottom = rect.bottom
        })
    }

    const applyScale = () => {
        const clone = getClone()
        if (clone) clone.style.setProperty("--ugic-label-size", Math.max(7, Math.round(11.5 * settings.scale)) + "px")
    }

    const repaintAll = () => {
        paintPairs.forEach(paint)
        const clone = getClone()
        if (!clone) return
        const key = [clone.clientWidth, clone.style.fontSize, settings.scale, paintPairs[0] && paintPairs[0].target.style.width].join("|")
        if (key !== lastLayoutKey) {
            lastLayoutKey = key
            layoutStacks()
        }
    }

    const createChordStack = (chordName, sourceCanvas) => {
        // 1. Container
        const wrapper = document.createElement("span")
        wrapper.className = "ugic-stack"

        // 2. Label
        const label = document.createElement("span")
        label.className = "ugic-label"
        label.textContent = chordName

        // 3. Canvas
        const newCanvas = document.createElement("canvas")
        newCanvas.className = "ugic-canvas"
        const pair = { target: newCanvas, source: sourceCanvas }
        paintPairs.push(pair)
        paint(pair)

        wrapper.appendChild(label)
        wrapper.appendChild(newCanvas)
        return wrapper
    }

    // --- Hiding the original lyrics ---
    // The original is kept in the layout tree (invisible, zero height) instead of display:none,
    // so its chord spans still have coordinates. That lets UG position its own chord popup when
    // we forward a hover to them. It must stay position:static: UG places the popup from the
    // chord's offsetTop/offsetLeft, which are measured against the nearest positioned ancestor.
    const GHOST_STYLE = {
        "visibility": "hidden",
        "pointer-events": "none",
        "height": "0px",
        "min-height": "0px",
        "overflow": "hidden",
        "margin": "0px",
        "padding": "0px",
        "border-width": "0px",
    }
    const GHOST_PROPS = Object.keys(GHOST_STYLE)
    const SHIFT_PROPS = ["position", "left", "top"]

    const ghostOriginal = (lyrics) => {
        if (ghostedLyrics && ghostedLyrics !== lyrics) unghostOriginal()
        ghostedLyrics = lyrics
        Object.entries(GHOST_STYLE).forEach(([prop, value]) => {
            // Hide, never remove: React still owns this node (and may reset its inline style)
            if (lyrics.style.getPropertyValue(prop) !== value || lyrics.style.getPropertyPriority(prop) !== "important") {
                lyrics.style.setProperty(prop, value, "important")
            }
        })
    }

    const clearSpanShift = () => {
        if (!shiftedSpan) return
        SHIFT_PROPS.forEach(prop => shiftedSpan.style.removeProperty(prop))
        shiftedSpan = null
    }

    const unghostOriginal = () => {
        clearSpanShift()
        if (!ghostedLyrics) return
        GHOST_PROPS.forEach(prop => ghostedLyrics.style.removeProperty(prop))
        ghostedLyrics = null
    }

    /** Back to the untouched page (disabled, no diagrams available, or lyrics are gone). */
    const teardown = () => {
        const clone = getClone()
        if (clone) clone.remove()
        unghostOriginal()
        paintPairs = []
        originalSpans = []
        hoveredWrapper = null
        lastSignature = null
        lastLayoutKey = null
    }

    // --- Hover / click forwarding (UG's own chord popup) ---

    const originalSpanFor = (wrapper) => {
        const index = Number(wrapper.dataset.ugicIndex)
        let span = originalSpans[index]
        if ((!span || !span.isConnected) && currentLyrics) {
            originalSpans = getChordSpans(currentLyrics)
            span = originalSpans[index]
        }
        return span && span.isConnected ? span : null
    }

    const fire = (el, type, bubbles, relatedTarget) => {
        const rect = el.getBoundingClientRect()
        el.dispatchEvent(new MouseEvent(type, {
            bubbles,
            cancelable: bubbles,
            composed: true,
            view: el.ownerDocument.defaultView,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            relatedTarget: relatedTarget || null,
        }))
    }

    /**
     * Moves the invisible original chord so that it sits exactly on top of the inline diagram.
     * Done with position:relative on the chord itself (not a transform), because UG reads
     * offsetTop/offsetLeft, which ignore transforms.
     */
    const alignOriginalTo = (wrapper, span) => {
        clearSpanShift()
        const lyrics = ghostedLyrics
        if (!lyrics || !lyrics.contains(span)) return
        const stack = wrapper.querySelector(".ugic-stack") || wrapper

        const from = span.getBoundingClientRect()
        const to = stack.getBoundingClientRect()
        const dx = (to.left + to.width / 2) - (from.left + from.width / 2)
        const dy = to.top - from.top
        span.style.setProperty("position", "relative", "important")
        span.style.setProperty("left", dx + "px", "important")
        span.style.setProperty("top", dy + "px", "important")
        shiftedSpan = span
    }

    const forwardEnter = (wrapper) => {
        const span = originalSpanFor(wrapper)
        if (!span) return
        alignOriginalTo(wrapper, span)
        fire(span, "mouseover", true, document.body)
        fire(span, "mouseenter", false, document.body)
    }

    const forwardLeave = (wrapper, relatedTarget) => {
        const span = originalSpanFor(wrapper)
        if (!span) return
        fire(span, "mouseout", true, relatedTarget || document.body)
        fire(span, "mouseleave", false, relatedTarget || document.body)
        clearSpanShift()
    }

    const attachInteractions = (clone) => {
        clone.addEventListener("mouseover", (event) => {
            const wrapper = event.target.closest && event.target.closest(".ugic-stack-wrapper")
            if (!wrapper || wrapper === hoveredWrapper) return
            if (hoveredWrapper) forwardLeave(hoveredWrapper, wrapper)
            hoveredWrapper = wrapper
            forwardEnter(wrapper)
        })
        clone.addEventListener("mouseout", (event) => {
            if (!hoveredWrapper) return
            if (event.relatedTarget && hoveredWrapper.contains(event.relatedTarget)) return
            forwardLeave(hoveredWrapper, event.relatedTarget)
            hoveredWrapper = null
        })
        clone.addEventListener("click", (event) => {
            const wrapper = event.target.closest && event.target.closest(".ugic-stack-wrapper")
            if (!wrapper) return
            if (wrapper !== hoveredWrapper) { // touch screens: there was no hover first
                hoveredWrapper = wrapper
                forwardEnter(wrapper)
            }
            const span = originalSpanFor(wrapper)
            if (span) fire(span, "click", true)
        })
    }

    // --- Building the clone ---

    const syncCloneStyle = (lyrics, clone) => {
        // UG's FONT -1/+1 buttons write an inline font-size on the original
        ;["font-size", "font-family", "line-height"].forEach(prop => {
            const value = lyrics.style.getPropertyValue(prop)
            if (clone.style.getPropertyValue(prop) !== value) {
                if (value) clone.style.setProperty(prop, value)
                else clone.style.removeProperty(prop)
            }
        })
    }

    const swapInClone = (lyrics, chordMap) => {
        const oldClone = getClone()
        if (oldClone) oldClone.remove()
        paintPairs = []
        hoveredWrapper = null

        const clone = lyrics.cloneNode(true)
        clone.id = CONFIG.CLONE_ID
        clone.style.removeProperty("display")
        GHOST_PROPS.forEach(prop => clone.style.removeProperty(prop))

        let replaced = 0
        getChordSpans(clone).forEach((span, index) => {
            const chordName = chordNamesOf(span).find(name => chordMap.has(name))
            if (!chordName) return

            // Keep exactly the width the chord name had (monospace => 1ch per character)
            const widthInChars = [...(span.textContent || chordName)].length

            const stack = createChordStack(chordName, chordMap.get(chordName))
            span.textContent = ""
            span.classList.add("ugic-stack-wrapper")
            span.dataset.ugicIndex = String(index)
            span.appendChild(stack)
            span.removeAttribute(CONFIG.CHORD_NAME_ATTR)
            span.style.cssText = `width: ${widthInChars}ch;`
            replaced++
        })

        if (replaced === 0 || !lyrics.parentElement) {
            paintPairs = []
            return 0
        }

        attachInteractions(clone)
        ghostOriginal(lyrics)
        lyrics.parentElement.appendChild(clone)
        applyScale()
        lastLayoutKey = null
        repaintAll() // also resolves overlaps now that the clone is laid out
        return replaced
    }

    /** Optional: force a virtualized lyrics list to render everything before cloning. */
    const withFullRender = (lyrics, callback) => {
        if (!CONFIG.FORCE_FULL_RENDER) return callback()

        const scrollX = window.scrollX
        const scrollY = window.scrollY
        const fontSize = lyrics.style.fontSize
        const lineHeight = lyrics.style.lineHeight

        unghostOriginal()
        lyrics.style.fontSize = "0.000001px" // Everything "fits", so everything gets rendered
        lyrics.style.lineHeight = "1px"
        window.scrollTo(0, 0)

        setTimeout(() => {
            try {
                callback()
            } finally {
                lyrics.style.fontSize = fontSize
                lyrics.style.lineHeight = lineHeight
                const clone = getClone()
                if (clone) {
                    syncCloneStyle(lyrics, clone)
                    lastLayoutKey = null
                    repaintAll()
                }
                window.scrollTo(scrollX, scrollY)
            }
        }, CONFIG.FORCE_FULL_RENDER_DELAY)
    }

    // --- Control panel ---

    let panel = null
    let panelToggle = null
    let panelScale = null

    const refreshPanel = () => {
        if (!panel) return
        panel.classList.toggle("ugic-off", !settings.enabled)
        panelToggle.textContent = settings.enabled ? "Inline chords: on" : "Inline chords: off"
        panelToggle.setAttribute("aria-pressed", String(settings.enabled))
        panelScale.textContent = Math.round(settings.scale * 100) + "%"
    }

    const setEnabled = (enabled) => {
        settings.enabled = enabled
        saveSettings()
        refreshPanel()
        if (!enabled) teardown()
        sync()
    }

    const setScale = (scale) => {
        settings.scale = clampScale(scale)
        saveSettings()
        refreshPanel()
        applyScale()
        repaintAll()
    }

    const makeButton = (text, title, onClick) => {
        const button = document.createElement("button")
        button.type = "button"
        button.textContent = text
        button.title = title
        button.addEventListener("click", onClick)
        return button
    }

    const ensurePanel = (wanted) => {
        if (!wanted) {
            if (panel && panel.isConnected) panel.remove()
            return
        }
        if (!document.body) return
        if (!panel) {
            panel = document.createElement("div")
            panel.id = CONFIG.PANEL_ID

            panelToggle = makeButton("", "Show chord diagrams inside the lyrics (Alt+I)", () => setEnabled(!settings.enabled))

            const smaller = makeButton("−", "Smaller diagrams", () => setScale(settings.scale - CONFIG.SCALE_STEP))
            const bigger = makeButton("+", "Bigger diagrams", () => setScale(settings.scale + CONFIG.SCALE_STEP))
            panelScale = document.createElement("span")
            panelScale.className = "ugic-scale ugic-size"
            panelScale.title = "Diagram size"
            smaller.classList.add("ugic-size")
            bigger.classList.add("ugic-size")

            panel.append(panelToggle, smaller, panelScale, bigger)
            refreshPanel()
        }
        if (!panel.isConnected) document.body.appendChild(panel)
    }

    document.addEventListener("keydown", (event) => {
        if (event.code !== "KeyI" || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
        const target = event.target
        if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.nodeName))) return
        if (!currentLyrics) return
        event.preventDefault()
        setEnabled(!settings.enabled)
    })

    // --- Main sync loop ---

    const scheduleRepaints = () => {
        repaintTimers.forEach(clearTimeout)
        repaintTimers = CONFIG.REPAINT_DELAYS.map(delay => setTimeout(repaintAll, delay))
    }

    function sync() {
        if (building) return

        const lyrics = findLyrics()
        currentLyrics = lyrics
        ensurePanel(!!lyrics)

        if (!lyrics || !settings.enabled) {
            if (getClone() || ghostedLyrics) teardown()
            return
        }

        const spans = getChordSpans(lyrics)
        const knownNames = new Set()
        spans.forEach(span => chordNamesOf(span).forEach(name => knownNames.add(name)))

        const chordMap = getChordCanvasMap(knownNames)
        if (chordMap.size === 0) {
            // Diagrams not there (yet, or hidden by the user): show the normal page
            if (getClone() || ghostedLyrics) teardown()
            return
        }
        lastChordMap = chordMap

        const signature = [
            location.pathname,
            spans.map(span => chordNamesOf(span).join("~")).join(","),
            [...chordMap].map(([name, canvas]) => `${name}:${canvasId(canvas)}:${canvas.width}x${canvas.height}`).join(","),
        ].join("|")

        const clone = getClone()
        const cloneInPlace = clone && clone.isConnected && clone.parentElement === lyrics.parentElement
        if (signature === lastSignature && cloneInPlace) {
            ghostOriginal(lyrics) // React may have reset the inline style
            originalSpans = spans
            syncCloneStyle(lyrics, clone)
            repaintAll() // Same diagrams, but UG may have redrawn them
            return
        }

        building = true
        withFullRender(lyrics, () => {
            try {
                const replaced = swapInClone(lyrics, chordMap)
                if (replaced > 0) {
                    originalSpans = getChordSpans(lyrics)
                    lastSignature = signature
                    scheduleRepaints()
                    log(`🔨 Swapped in clone with ${replaced}/${spans.length} chords (${chordMap.size} diagrams)`)
                } else {
                    teardown()
                }
            } catch (e) {
                console.error("[UGIC] Failed to build inline chords, restoring original lyrics", e)
                teardown()
            } finally {
                building = false
            }
        })
    }

    const schedule = () => {
        if (scheduled) return
        scheduled = true
        setTimeout(() => {
            scheduled = false
            try {
                sync()
            } catch (e) {
                console.error("[UGIC] sync failed", e)
            }
        }, CONFIG.THROTTLE)
    }

    /** Ignore the DOM changes this script makes itself (and style changes that do not concern the lyrics). */
    const isIrrelevantMutation = (mutation) => {
        const target = mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement
        if (insideOwn(target)) return true

        if (mutation.type === "attributes" && mutation.attributeName === "style") {
            // Only the font size of the original lyrics matters (UG's FONT buttons)
            const clone = getClone()
            if (mutation.target !== currentLyrics || !clone) return true
            return clone.style.fontSize === currentLyrics.style.fontSize
        }

        if (mutation.type !== "childList") return false
        const nodes = [...mutation.addedNodes, ...mutation.removedNodes]
        return nodes.length > 0 && nodes.every(isOwnNode)
    }

    log("🧙‍♂️ Ultimate Guitar Inline Chords script started")

    const observer = new MutationObserver((mutations) => {
        if (building) return
        if (mutations.every(isIrrelevantMutation)) return
        schedule()
    })
    observer.observe(document, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: [CONFIG.CHORD_NAME_ATTR, "style"],
    })

    // Things a MutationObserver cannot see
    window.addEventListener("load", schedule)
    window.addEventListener("resize", schedule)
    window.addEventListener("popstate", schedule)
    schedule()

    // If this ever stops working, say why in the console instead of failing silently
    setTimeout(() => {
        if (getClone() || !settings.enabled) return
        const lyrics = findLyrics()
        if (!lyrics) {
            debug("No chord lyrics found on this page (nothing to do)")
            return
        }
        const knownNames = new Set()
        getChordSpans(lyrics).forEach(span => chordNamesOf(span).forEach(name => knownNames.add(name)))
        const canvases = [...document.querySelectorAll("canvas")].filter(canvas => !insideOwn(canvas))
        console.warn(
            "[UGIC] ⚠️ Lyrics found but no chord diagrams could be matched.",
            { chordsInLyrics: [...knownNames], canvasesOnPage: canvases.length, matched: getChordCanvasMap(knownNames).size },
            "If the diagrams are visible on the page, Ultimate Guitar probably stopped drawing them on <canvas>."
        )
    }, CONFIG.DIAGNOSE_AFTER)
})()