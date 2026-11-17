// ==UserScript==
// @name         Claude.ai Login Email Autofill – prefill your email on the login page
// @icon         https://www.google.com/s2/favicons?sz=64&domain=claude.ai
// @namespace    https://github.com/RMoura98/moura-userscripts
// @author       @RMoura98
// @version      2026-11-17
// @description  Prefills the email field on the Claude.ai login and signup pages with an email you set from the Tampermonkey menu.
// @match        https://claude.ai/login*
// @match        https://claude.ai/signup*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @updateURL    https://github.com/RMoura98/moura-userscripts/raw/main/claude-login-email-autofill.user.js
// @downloadURL  https://github.com/RMoura98/moura-userscripts/raw/main/claude-login-email-autofill.user.js
// ==/UserScript==

(function () {
    'use strict';

    // Config lives in Tampermonkey storage, never in this file.
    // Set it via the Tampermonkey menu → "Set login email".
    const EMAIL_KEY = 'email';

    function getEmail() {
        return (GM_getValue(EMAIL_KEY, '') || '').trim();
    }

    GM_registerMenuCommand('Set login email', () => {
        const value = window.prompt('Email to prefill on the Claude.ai login page (leave empty to disable):', getEmail());
        if (value === null) return; // cancelled
        GM_setValue(EMAIL_KEY, value.trim());
        if (value.trim()) tryFill();
    });

    // React-controlled inputs ignore plain `.value =`; use the native setter
    // and dispatch an input event so the app's state picks up the value.
    function setReactValue(input, value) {
        const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
        ).set;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function findEmailInput() {
        return (
            document.querySelector('input#email') ||
            document.querySelector('input[type="email"]') ||
            document.querySelector('input[name="email"]') ||
            document.querySelector('input[autocomplete="email"]') ||
            document.querySelector('input[aria-label="Email" i]')
        );
    }

    function tryFill() {
        const email = getEmail();
        if (!email) return true; // nothing configured, nothing to do

        const input = findEmailInput();
        if (!input || input.offsetParent === null) return false;
        // Don't overwrite anything the user has already typed.
        if (input.dataset.autofilled === '1' || input.value) return true;

        setReactValue(input, email);
        input.dataset.autofilled = '1';
        return true;
    }

    if (tryFill()) return;

    // The login form renders client-side, so watch for it to appear.
    const observer = new MutationObserver(() => {
        if (tryFill()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Stop watching after 15s regardless.
    setTimeout(() => observer.disconnect(), 15000);
})();
