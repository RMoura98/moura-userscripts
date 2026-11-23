// ==UserScript==
// @name         Google Flights price per person – hover a price to see it split per passenger
// @icon         https://www.google.com/s2/favicons?sz=64&domain=flights.google.com
// @namespace    https://github.com/RMoura98/moura-userscripts
// @author       @RMoura98
// @version      2026-11-23
// @description  On Google Flights with more than one passenger, hovering a total price shows the price per person in a Google-style tooltip.
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

    const PRICE_SEL = "[aria-label*='euros'][role='text']";
    const TIP_ID = 'moura-pp-tooltip';

    // Same look as Google's own Material tooltips on the page
    // (e.g. the "Change appearance" one): dark pill, 12px Roboto, 4px below the target.
    const style = document.createElement('style');
    style.textContent = `
        #${TIP_ID} {
            position: fixed;
            z-index: 2101;
            pointer-events: none;
            background: rgb(60, 64, 67);
            color: rgb(232, 234, 237);
            font: 400 12px/16px Roboto, "Google Sans Text", sans-serif;
            letter-spacing: 0.4px;
            border-radius: 4px;
            padding: 4px 8px;
            white-space: nowrap;
            opacity: 0;
            transform: scale(0.8);
            transition: opacity 75ms linear, transform 150ms cubic-bezier(0, 0, 0.2, 1);
        }
        #${TIP_ID}.moura-pp-show { opacity: 1; transform: scale(1); }
    `;
    document.head.appendChild(style);

    const tip = document.createElement('div');
    tip.id = TIP_ID;
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);

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

    const perPersonText = el => {
        const count = getPassengerCount();
        if (count <= 1) return null;
        const total = extractPrice(el.textContent);
        if (!total) return null;
        return `€${Math.round(total / count)} per person (${count} passengers)`;
    };

    let current = null;

    const show = el => {
        const text = perPersonText(el);
        if (!text) return hide();
        current = el;
        tip.textContent = text;
        const r = el.getBoundingClientRect();
        const w = tip.offsetWidth;
        const left = Math.min(Math.max(4, r.left + r.width / 2 - w / 2), window.innerWidth - w - 4);
        tip.style.left = `${left}px`;
        tip.style.top = `${r.bottom + 4}px`;
        tip.classList.add('moura-pp-show');
    };

    const hide = () => {
        current = null;
        tip.classList.remove('moura-pp-show');
    };

    // Event delegation: results re-render without a page load, so no per-element setup.
    document.addEventListener('mouseover', e => {
        const el = e.target.closest && e.target.closest(PRICE_SEL);
        if (el && el !== current) show(el);
        else if (!el && current) hide();
    });
    document.addEventListener('mouseout', e => {
        if (current && !current.contains(e.relatedTarget)) hide();
    });
    window.addEventListener('scroll', hide, { passive: true, capture: true });
})();
