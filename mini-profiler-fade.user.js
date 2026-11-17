// ==UserScript==
// @name         Mini Profiler Fade – dim the rack-mini-profiler badge on localhost
// @icon         https://www.google.com/s2/favicons?sz=64&domain=rubyonrails.org
// @namespace    https://github.com/RMoura98/moura-userscripts
// @author       @RMoura98
// @version      2026-11-17
// @description  Makes the rack-mini-profiler timing badge nearly transparent on local Rails apps (localhost:3000) so it doesn't cover the page.
// @match        http://localhost:3000/*
// @run-at       document-start
// @grant        GM_addStyle
// @updateURL    https://github.com/RMoura98/moura-userscripts/raw/main/mini-profiler-fade.user.js
// @downloadURL  https://github.com/RMoura98/moura-userscripts/raw/main/mini-profiler-fade.user.js
// ==/UserScript==

(function () {
    'use strict';

    // Injected at document-start so the badge never flashes at full opacity
    GM_addStyle('.profiler-results { opacity: 10% !important; }');
})();
