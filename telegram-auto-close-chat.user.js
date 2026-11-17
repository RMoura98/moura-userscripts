// ==UserScript==
// @name         Telegram Auto-Close Chat – back to chat list when you leave the tab
// @icon         https://www.google.com/s2/favicons?sz=64&domain=telegram.org
// @namespace    https://github.com/RMoura98/moura-userscripts
// @author       @RMoura98
// @version      2026-11-17
// @description  Presses Escape to close the open chat and return to the chat list whenever the Telegram Web tab is hidden.
// @match        https://*.telegram.org/*
// @run-at       document-start
// @grant        none
// @updateURL    https://github.com/RMoura98/moura-userscripts/raw/main/telegram-auto-close-chat.user.js
// @downloadURL  https://github.com/RMoura98/moura-userscripts/raw/main/telegram-auto-close-chat.user.js
// ==/UserScript==

const KEY_EVENT_OPTIONS = { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true, cancelable: true, view: window };

(function () {
    'use strict';

    function triggerActions() {
        // Only act when a chat is open (its top bar is visible)
        if (!document.querySelector(".topbar:not(.hide)")) return;
        const target = document.activeElement || document.body;
        target.dispatchEvent(new KeyboardEvent("keydown", KEY_EVENT_OPTIONS));
        target.dispatchEvent(new KeyboardEvent("keyup", KEY_EVENT_OPTIONS));
    }

    document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
            triggerActions();
        }
    });
})();
