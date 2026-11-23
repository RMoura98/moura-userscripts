// ==UserScript==
// @name         GitHub Stargazers Button – one-click stargazers in the Star group
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// @namespace    https://github.com/RMoura98/moura-userscripts
// @author       @RMoura98
// @version      2026-11-23
// @description  Adds a small stargazers icon button inside the Star button group on repos you can administer (where the Settings tab is visible).
// @match        https://github.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://github.com/RMoura98/moura-userscripts/raw/main/github-stargazers-button.user.js
// @downloadURL  https://github.com/RMoura98/moura-userscripts/raw/main/github-stargazers-button.user.js
// ==/UserScript==

(() => {
  "use strict";

  const ITEM_ATTR = "data-moura-stargazers";
  const LABEL = "Stargazers";

  // Octicon "people" (16px), same markup GitHub uses for octicons.
  const PEOPLE_PATH =
    "M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 " +
    "4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 " +
    "2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954" +
    ".752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 " +
    ".416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 3.5Z";

  let uid = 0;

  /** "/owner/repo" for the current page, or null. */
  function repoPath() {
    const [, owner, repo] = location.pathname.split("/");
    return owner && repo ? `/${owner}/${repo}` : null;
  }

  /** Settings tab is only rendered for people who can administer the repo. */
  function hasSettingsTab(base) {
    return !!document.querySelector(
      [
        'a[data-tab-item="settings"]',
        'a[data-tab-item="settings-tab"]',
        "a#settings-tab",
        `a[href="${CSS.escape(base)}/settings"]`,
      ].join(",")
    );
  }

  function buildIcon() {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("data-component", "Octicon");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", "octicon octicon-people");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("display", "inline-block");
    svg.setAttribute("overflow", "visible");
    svg.style.verticalAlign = "text-bottom";
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", PEOPLE_PATH);
    svg.appendChild(path);
    return svg;
  }

  /** Native-looking TooltipV2 popover, positioned below the button like GitHub's. */
  function attachTooltip(btn, item, sampleTooltip) {
    const tip = document.createElement("span");
    tip.id = `moura-stargazers-tip-${++uid}`;
    tip.className = sampleTooltip?.className || "prc-TooltipV2-Tooltip-tLeuB";
    tip.setAttribute("data-component", "Tooltip");
    tip.setAttribute("data-direction", "s");
    tip.setAttribute("aria-hidden", "true");
    tip.textContent = LABEL;
    const popover = typeof tip.showPopover === "function";
    if (popover) tip.setAttribute("popover", "manual");
    item.appendChild(tip);
    btn.setAttribute("aria-labelledby", tip.id);

    const show = () => {
      if (!popover) return;
      try {
        tip.showPopover();
      } catch {
        return;
      }
      const r = btn.getBoundingClientRect();
      const w = tip.offsetWidth;
      tip.style.top = `${r.bottom + window.scrollY + 4}px`;
      tip.style.left = `${r.left + window.scrollX + r.width / 2 - w / 2}px`;
    };
    const hide = () => {
      if (!popover) return;
      try {
        tip.hidePopover();
      } catch {
        /* already hidden */
      }
    };
    btn.addEventListener("mouseenter", show);
    btn.addEventListener("focus", show);
    btn.addEventListener("mouseleave", hide);
    btn.addEventListener("blur", hide);
    btn.addEventListener("click", hide);
  }

  function buildItem(base, dropdownBtn) {
    const sampleItem = dropdownBtn.parentElement;
    const item = document.createElement("div");
    item.className = sampleItem.className;
    item.setAttribute(ITEM_ATTR, base);

    const a = document.createElement("a");
    a.href = `${base}/stargazers`;
    // Same classes as the dropdown IconButton, minus the "hide when narrow" one,
    // so the button keeps working on small screens.
    a.className = [...dropdownBtn.classList]
      .filter((c) => !/HiddenWhenNarrow/i.test(c))
      .join(" ");
    a.setAttribute("data-component", "IconButton");
    a.setAttribute("data-testid", "stargazers-button");
    a.setAttribute("data-no-visuals", "true");
    a.setAttribute("data-size", dropdownBtn.getAttribute("data-size") || "small");
    a.setAttribute("data-variant", dropdownBtn.getAttribute("data-variant") || "default");
    a.appendChild(buildIcon());
    item.appendChild(a);

    attachTooltip(a, item, sampleItem.querySelector('[data-component="Tooltip"]'));
    return item;
  }

  function sync() {
    const base = repoPath();
    const dropdownBtn = document.querySelector('[data-testid="star-dropdown-button"]');
    const existing = document.querySelectorAll(`[${ITEM_ATTR}]`);
    const wanted = !!(base && dropdownBtn && hasSettingsTab(base));

    // Drop stale buttons (other repo, lost permissions, re-rendered group).
    for (const el of existing) {
      const ok =
        wanted &&
        el.getAttribute(ITEM_ATTR) === base &&
        el.nextElementSibling === dropdownBtn.parentElement;
      if (!ok) el.remove();
    }

    if (!wanted || document.querySelector(`[${ITEM_ATTR}]`)) return;

    const dropdownItem = dropdownBtn.parentElement;
    dropdownItem.parentElement.insertBefore(buildItem(base, dropdownBtn), dropdownItem);
  }

  // Throttle to one run per frame; GitHub re-renders the header on soft navigation.
  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync();
    });
  }

  sync();
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  ["turbo:load", "turbo:render", "soft-nav:end", "popstate"].forEach((ev) =>
    window.addEventListener(ev, schedule)
  );
  document.addEventListener("turbo:load", schedule);
})();
