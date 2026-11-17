// ==UserScript==
// @name         Allianz Care Timeout Redirect – skip the session-timeout login page
// @icon         https://www.google.com/s2/favicons?sz=64&domain=allianzcare.com
// @namespace    https://github.com/RMoura98/moura-userscripts
// @author       @RMoura98
// @version      2026-11-17
// @description  Sends you from MyHealth's "session timed out" login page back to the Allianz Care home page.
// @match        https://my.allianzcare.com/myhealth/1/login*
// @run-at       document-start
// @grant        none
// @updateURL    https://github.com/RMoura98/moura-userscripts/raw/main/allianz-timeout-redirect.user.js
// @downloadURL  https://github.com/RMoura98/moura-userscripts/raw/main/allianz-timeout-redirect.user.js
// ==/UserScript==

(function () {
    'use strict';

    // Only act on the timeout variant of the login page (…/login?timeOut=true)
    if (window.location.href.includes('timeOut=true')) {
        // replace() so the timeout page doesn't stay in history
        window.location.replace(window.location.origin);
    }
})();
