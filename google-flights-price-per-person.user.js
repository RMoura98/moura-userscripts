// ==UserScript==
// @name         Google Flights price per person – hover a price to see it split per passenger
// @icon         https://www.google.com/s2/favicons?sz=64&domain=flights.google.com
// @namespace    https://github.com/RMoura98/moura-userscripts
// @author       @RMoura98
// @version      2026-11-17
// @description  On Google Flights with more than one passenger, hovering a total price shows the price per person.
// @match        https://www.google.com/travel/flights
// @match        https://www.google.com/travel/flights?*
// @match        https://www.google.com/travel/flights/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://github.com/RMoura98/moura-userscripts/raw/main/google-flights-price-per-person.user.js
// @downloadURL  https://github.com/RMoura98/moura-userscripts/raw/main/google-flights-price-per-person.user.js
// ==/UserScript==

(function () {
    'use strict';

    const MARK = 'ppTitle';

    const getPassengerCount = () => {
        const el = document.querySelector("button[aria-label*='passenger']")
            || document.querySelector("[aria-label*='passenger']");
        const match = el && el.textContent.trim().match(/\d+/);
        return match ? Number(match[0]) : 1;
    };

    const extractPrice = txt => {
        const digits = txt.replace(/\D+/g, '');
        return digits ? Number(digits) : null;
    };

    const apply = () => {
        const count = getPassengerCount();

        document.querySelectorAll("[aria-label*='euros'][role='text']").forEach(el => {
            if (count <= 1) {
                // Passenger count went back to 1: drop titles we added earlier
                if (el.dataset[MARK]) {
                    el.removeAttribute('title');
                    delete el.dataset[MARK];
                }
                return;
            }

            const total = extractPrice(el.textContent);
            if (!total) return;

            const title = `€${Math.round(total / count)} per person (${count} passengers)`;
            if (el.title !== title) {
                el.title = title;
                el.dataset[MARK] = '1';
            }
        });
    };

    // Google Flights is a single-page app: results and the passenger picker
    // re-render without a page load, so watch the whole page (debounced).
    let timer = null;
    new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(apply, 200);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });

    apply();
})();
