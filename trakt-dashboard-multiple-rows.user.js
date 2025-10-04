// ==UserScript==
// @name         Trakt dashboard multiple rows
// @namespace    https://github.com/RMoura98/moura-userscripts
// @version      2024-05-15
// @description  Allows to have multiple rows of tvshows on the trakt dashboard
// @author       @RMoura98 (https://github.com/RMoura98)
// @match        https://trakt.tv/dashboard
// @icon         https://www.google.com/s2/favicons?sz=64&domain=trakt.tv
// @grant        GM_addStyle
// @updateURL    https://github.com/RMoura98/moura-userscripts/raw/main/trakt-dashboard-multiple-rows.user.js
// @downloadURL  https://github.com/RMoura98/moura-userscripts/raw/main/trakt-dashboard-multiple-rows.user.js
// ==/UserScript==


GM_addStyle(`
    .col-xs-6.col-sm-3.col-md-3.col-lg-2.col-xlg-2.col-xxlg-1.e1a979-grid-item.grid-item,
    .e1a979-cc189c-b8aedf,
    .grid-item:not([itemscope]),
    .brand-right.navbar-nav.nav [href="/vip"],
    .dark.top,
    .show-advanced-filters-link,
    .separator:not(.dark-knight ~ .separator) ~ :not(.dark-knight ~ .separator ~ *):not(.dark-knight ~ .separator),
    .separator:not(.dark-knight ~ .separator),
    .percentage,
    .watch-now,
    .reset,
    [href*="/users/rmoura98/year"],
    [href*="/users/rmoura98/collection"],
    .collect,
    .btn-collect.btn-summary.btn-block.btn,
    div.col-sm-4:nth-of-type(3),
    .btn-checkin.btn-summary.btn-block.btn,
    .vip-actions,
    [data-original-title*="Collected"],
    .summary-activity,
    .affix.affixable.sidebar > a.btn-watch-now,
    .btn-watch-now,
    [href*="/watchnow/"],
    #external-link-tmdb,
    #external-link-tvdb,
    #external-link-fanart,
    #external-link-justwatch,
    #external-link-wikipedia,
    #external-link-anidb,
    [href*="/movies/collected"],
    [href*="/vip"],
    [data-episode-id] .list,
    #schedule-wrapper > .container > .section > .feed-icons,
    #ondeck-wrapper > .container > .section > .feed-icons
  {
    display: none !important;
  }
  `);
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
