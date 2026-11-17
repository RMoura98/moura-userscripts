// ==UserScript==
// @name         Trakt Dashboard – multiple rows & hourly auto-refresh
// @icon         https://www.google.com/s2/favicons?sz=64&domain=trakt.tv
// @namespace    https://github.com/RMoura98/moura-userscripts
// @author       @RMoura98
// @version      2026-11-17
// @description  Shows multiple rows of TV shows on the Trakt dashboard by hiding clutter and increasing the row count, and refreshes the dashboard every hour.
// @match        https://trakt.tv/dashboard
// @run-at       document-idle
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

  // Auto-refresh the dashboard (merged from "Trakt Autorefresher")
  const REFRESH_SECONDS = 3600;
  const refresh = document.createElement('meta');
  refresh.setAttribute('http-equiv', 'refresh');
  refresh.setAttribute('content', String(REFRESH_SECONDS));
  document.head.append(refresh);
})();
