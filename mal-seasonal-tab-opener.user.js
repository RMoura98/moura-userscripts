// ==UserScript==
// @name         MAL Seasonal Tab Opener – open every seasonal anime at once
// @icon         https://www.google.com/s2/favicons?sz=64&domain=myanimelist.net
// @namespace    https://github.com/RMoura98/moura-userscripts
// @author       @RMoura98
// @version      2026-11-17
// @description  Adds an "Open All Tabs" link to the MyAnimeList home page seasonal widget that opens every anime in it in background tabs.
// @match        https://myanimelist.net/
// @match        https://myanimelist.net/?*
// @run-at       document-idle
// @grant        GM_openInTab
// @updateURL    https://github.com/RMoura98/moura-userscripts/raw/main/mal-seasonal-tab-opener.user.js
// @downloadURL  https://github.com/RMoura98/moura-userscripts/raw/main/mal-seasonal-tab-opener.user.js
// ==/UserScript==

(function () {
    'use strict';

    const WIDGET = '.widget.seasonal.left';
    const targetHeader = document.querySelector(`${WIDGET} .widget-header span`);
    if (!targetHeader) return;

    // Plain link so it picks up MAL's own header link styling, like "View More"
    const openAllBtn = document.createElement('a');
    openAllBtn.href = '#';
    openAllBtn.textContent = 'Open All Tabs';
    openAllBtn.style.cssText = 'font-weight: normal; margin-right: 15px; cursor: pointer;';

    const getLinks = () => {
        const links = document.querySelectorAll(`${WIDGET} .js-widget-slide .btn-anime a.link`);
        return [...new Set(Array.from(links, a => a.href))];
    };

    openAllBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const urls = getLinks();

        if (urls.length === 0) {
            alert('No anime links found!');
            return;
        }

        // Open tabs in the background, next to the current one
        urls.forEach(url => {
            GM_openInTab(url, { active: false, insert: true, setParent: true });
        });
    });

    // Add it to the left of "View More"
    targetHeader.prepend(openAllBtn);
})();
