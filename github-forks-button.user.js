// ==UserScript==
// @name         GitHub Forks Button – one-click forks list next to Fork
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// @namespace    https://github.com/RMoura98/moura-userscripts
// @author       @RMoura98
// @version      2026-11-25
// @description  Adds a small forks-list icon button joined to the Fork button on repos you can administer (where the Settings tab is visible).
// @match        https://github.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://github.com/RMoura98/moura-userscripts/raw/main/github-forks-button.user.js
// @downloadURL  https://github.com/RMoura98/moura-userscripts/raw/main/github-forks-button.user.js
// ==/UserScript==

(() => {
  "use strict";

  const ITEM_ATTR = "data-moura-forks";
  const LABEL = "Forks";
  const STYLE_ID = "moura-forks-style";

  // Octicon "list-unordered" (16px), same markup GitHub uses for octicons.
  const LIST_PATH =
    "M5.75 2.5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 " +
    "1.5h-8.5a.75.75 0 0 1 0-1.5ZM2 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-6a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM2 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z";

  // Fallbacks in case no native IconButton/Tooltip is on the page to copy classes from.
  const FALLBACK_BTN_CLASS = "prc-Button-ButtonBase-9n-Xk prc-Button-IconButton-fyge7";
  const FALLBACK_TIP_CLASS = "prc-TooltipV2-Tooltip-tLeuB";

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

  /**
   * When Fork is a standalone button, visually join ours to it like a Primer
   * ButtonGroup, using CSS only so GitHub's React-owned nodes are never moved.
   */
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      li:has(> [${ITEM_ATTR}][data-joined]) { display: flex; align-items: center; }
      li:has(> [${ITEM_ATTR}][data-joined]) > [data-testid="fork-button"] {
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
      }
      [${ITEM_ATTR}][data-joined] { display: flex; margin-left: -1px; }
      [${ITEM_ATTR}][data-joined] > a {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
      }
      [${ITEM_ATTR}][data-joined] > a:focus-visible { position: relative; z-index: 1; }
    `;
    document.head.appendChild(style);
  }

  function buildIcon() {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("data-component", "Octicon");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", "octicon octicon-list-unordered");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("display", "inline-block");
    svg.setAttribute("overflow", "visible");
    svg.style.verticalAlign = "text-bottom";
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", LIST_PATH);
    svg.appendChild(path);
    return svg;
  }

  /** Native-looking TooltipV2 popover, positioned below the button like GitHub's. */
  function attachTooltip(btn, item, tipClass) {
    const tip = document.createElement("span");
    tip.id = `moura-forks-tip-${++uid}`;
    tip.className = tipClass || FALLBACK_TIP_CLASS;
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

  /** Classes of a native IconButton on the page (minus "hide when narrow"), or a fallback. */
  function iconButtonClass() {
    const sample = document.querySelector(
      'button[data-component="IconButton"][class*="IconButton"], a[data-component="IconButton"][class*="IconButton"]'
    );
    if (!sample) return FALLBACK_BTN_CLASS;
    const keep = [...sample.classList].filter((c) => /^prc-Button-/.test(c));
    return keep.length ? keep.join(" ") : FALLBACK_BTN_CLASS;
  }

  function buildItem(base, forkBtn, groupItemClass) {
    const item = document.createElement("div");
    if (groupItemClass) item.className = groupItemClass;
    item.setAttribute(ITEM_ATTR, base);

    const a = document.createElement("a");
    a.href = `${base}/forks`;
    a.className = iconButtonClass();
    a.setAttribute("data-component", "IconButton");
    a.setAttribute("data-testid", "forks-list-button");
    a.setAttribute("data-no-visuals", "true");
    a.setAttribute("data-size", forkBtn.getAttribute("data-size") || "small");
    a.setAttribute("data-variant", forkBtn.getAttribute("data-variant") || "default");
    a.appendChild(buildIcon());
    item.appendChild(a);

    const tipClass = document.querySelector('[data-component="Tooltip"]')?.className;
    attachTooltip(a, item, tipClass);
    return item;
  }

  /** Where the button should go: inside a Fork ButtonGroup, or joined to a standalone Fork. */
  function placement(forkBtn) {
    const group = forkBtn.closest('[data-component="ButtonGroup"]');
    if (group) {
      const forkItem = [...group.children].find((c) => c.contains(forkBtn));
      if (forkItem) return { parent: group, after: forkItem, groupItemClass: forkItem.className };
    }
    const li = forkBtn.closest("li");
    if (li && forkBtn.parentElement === li) return { parent: li, after: forkBtn, joined: true };
    return null;
  }

  function sync() {
    const base = repoPath();
    const forkBtn = document.querySelector('[data-testid="fork-button"]');
    const existing = document.querySelectorAll(`[${ITEM_ATTR}]`);
    const wanted = !!(base && forkBtn && hasSettingsTab(base));
    const place = wanted ? placement(forkBtn) : null;

    // Drop stale buttons (other repo, lost permissions, re-rendered header).
    for (const el of existing) {
      const ok =
        place &&
        el.getAttribute(ITEM_ATTR) === base &&
        el.parentElement === place.parent &&
        el.previousElementSibling === place.after;
      if (!ok) el.remove();
    }

    if (!place || document.querySelector(`[${ITEM_ATTR}]`)) return;

    ensureStyle();
    const item = buildItem(base, forkBtn, place.groupItemClass);
    if (place.joined) item.setAttribute("data-joined", "");
    place.after.after(item);
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
})();
