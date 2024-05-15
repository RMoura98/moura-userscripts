// ==UserScript==
// @name         Trakt dashboard multiple rows
// @namespace    https://github.com/RMoura98/moura-userscripts
// @version      2024-05-15
// @description  Allows to have multiple rows of tvshows on the trakt dashboard
// @author       @RMoura98 (https://github.com/RMoura98)
// @match        https://trakt.tv/dashboard
// @icon         https://www.google.com/s2/favicons?sz=64&domain=trakt.tv
// @grant        none
// @updateURL    https://github.com/RMoura98/moura-userscripts/raw/main/trakt-dashboard-multiple-rows.user.js
// @downloadURL  https://github.com/RMoura98/moura-userscripts/raw/main/trakt-dashboard-multiple-rows.user.js
// ==/UserScript==

(function() {
    'use strict';

(new MutationObserver(check)).observe(document, {childList: true, subtree: true});

function check(changes, observer) {
    let showsGrid = document.querySelector('.row.posters.loaded')
    if(showsGrid) {
        observer.disconnect();
        showsGrid.setAttribute('data-row-count', 20);
    }
}
})();
