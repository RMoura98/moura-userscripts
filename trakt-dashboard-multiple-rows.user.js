// ==UserScript==
// @name         Trakt dashboard multiple rows
// @namespace    https://github.com/RMoura98/moura-userscripts
// @version      2024-10-04
// @description  Display multiple rows of TV shows on the Trakt dashboard by hiding clutter and increasing row count
// @author       @RMoura98
// @match        https://trakt.tv/dashboard
// @icon         https://www.google.com/s2/favicons?sz=64&domain=trakt.tv
// @grant        GM_addStyle
// @updateURL    https://github.com/RMoura98/moura-userscripts/raw/main/trakt-dashboard-multiple-rows.user.js
// @downloadURL  https://github.com/RMoura98/moura-userscripts/raw/main/trakt-dashboard-multiple-rows.user.js
// ==/UserScript==

GM_addStyle(`
  /* Hide unnecessary elements */
  .col-xs-6.col-sm-3.col-md-3.col-lg-2.col-xlg-2.col-xxlg-1.e1a979-grid-item.grid-item,
  .e1a979-cc189c-b8aedf,
  .grid-item:not([itemscope]),
  .brand-right.navbar-nav.nav [href="/vip"],
  .dark.top,
  .show-advanced-filters-link,
  .percentage,
  .watch-now,
  .reset,
  .collect,
  .btn-collect.btn-summary.btn-block.btn,
  .btn-checkin.btn-summary.btn-block.btn,
  .vip-actions,
  .summary-activity,
  .affix.affixable.sidebar > a.btn-watch-now,
  .btn-watch-now,
  [data-episode-id] .list,

  /* Profile specific links */
  [href*="/users/rmoura98/year"],
  [href*="/users/rmoura98/collection"],

  /* External links */
  #external-link-tmdb,
  #external-link-tvdb,
  #external-link-fanart,
  #external-link-justwatch,
  #external-link-wikipedia,
  #external-link-anidb,

  /* Collection/VIP links */
  [href*="/movies/collected"],
  [href*="/vip"],

  /* Feed icons */
  #schedule-wrapper > .container > .section > .feed-icons,
  #ondeck-wrapper > .container > .section > .feed-icons,

  /* Separator cleanup */
  .separator:not(.dark-knight ~ .separator) ~ :not(.dark-knight ~ .separator ~ *):not(.dark-knight ~ .separator),
  .separator:not(.dark-knight ~ .separator),

  /* Misc column */
  div.col-sm-4:nth-of-type(3),

  /* Collected badge */
  [data-original-title*="Collected"]
  {
    display: none !important;
  }
`);

(function () {
  'use strict';

  const observer = new MutationObserver(mutations => {
    const showsGrid = document.querySelector('.row.posters.loaded');
    if (showsGrid) {
      observer.disconnect();
      showsGrid.dataset.rowCount = 20; // Increase rows
    }
  });

  observer.observe(document, { childList: true, subtree: true });
})();
