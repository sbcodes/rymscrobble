// ==UserScript==
// @name         RYMscrobble
// @license      MIT
// @version      2.20260908143304
// @description  Visit a release page on rateyourmusic.com and scrobble the songs you see, via Last.fm login (no password stored). Fork of scRYMble.
// @author       sbcodes
// @icon         https://e.snmc.io/2.5/img/sonemic.png
// @namespace    https://github.com/sbcodes/rymscrobble
// @include      https://rateyourmusic.com/release/*
// @connect      ws.audioscrobbler.com
// @connect      www.last.fm
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @updateURL    https://raw.githubusercontent.com/sbcodes/rymscrobble/main/dist/RYMscrobble.min.js
// @downloadURL  https://raw.githubusercontent.com/sbcodes/rymscrobble/main/dist/RYMscrobble.min.js
// ==/UserScript==
'use strict';

var _a, _b;
// RYMscrobble talks to Last.fm's modern REST API (ws.audioscrobbler.com/2.0)
// instead of the legacy username/password protocol, so it never needs your
// Last.fm password. Instead it needs an API key + shared secret identifying
// *this script* as a Last.fm "application" -- the same thing every desktop
// scrobbler (foobar2000, MusicBee, etc.) ships with. They are not a
// substitute for your password and do not grant access to your account by
// themselves -- that still requires you to explicitly approve a login on
// last.fm's own site (see the "Connect to Last.fm" button the script adds
// to release pages).
//
// Get your own free pair at https://www.last.fm/api/account/create. Most
// people paste them into the "Set up Last.fm API key" prompt the script
// shows on a RYM page; they're then stored locally with GM_setValue, same
// as everything else this script remembers, and never leave your browser.
//
// Developers building from source can instead put them in a .env file at
// the project root (see .env.example) -- Rollup inlines those as defaults
// at `npm run build` time, used only when nothing's been entered at runtime.
const API_KEY_STORAGE_KEY = "lastfmApiKey";
const API_SECRET_STORAGE_KEY = "lastfmApiSecret";
const BUILT_IN_API_KEY = (_a = "") !== null && _a !== void 0 ? _a : "";
const BUILT_IN_API_SECRET = (_b = "") !== null && _b !== void 0 ? _b : "";
function getApiKey() {
    return GM_getValue(API_KEY_STORAGE_KEY, "") || BUILT_IN_API_KEY;
}
function getApiSecret() {
    return GM_getValue(API_SECRET_STORAGE_KEY, "") || BUILT_IN_API_SECRET;
}
function hasApiCredentials() {
    return getApiKey().length > 0 && getApiSecret().length > 0;
}
function storeApiCredentials(apiKey, apiSecret) {
    GM_setValue(API_KEY_STORAGE_KEY, apiKey);
    GM_setValue(API_SECRET_STORAGE_KEY, apiSecret);
}

class HttpResponse {
    constructor() {
        this.status = 0;
        this.statusText = "";
        this.responseText = "";
        this.responseHeaders = "";
    }
}

const REQUEST_TIMEOUT_MS = 30000;
function encodeParams(params) {
    return Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join("&");
}
function httpGet(url, onload, onerror) {
    GM_xmlhttpRequest({
        method: "GET",
        url,
        timeout: REQUEST_TIMEOUT_MS,
        onload,
        onerror,
        ontimeout: () => onerror(new HttpResponse())
    });
}
function httpPost(url, data, onload, onerror) {
    GM_xmlhttpRequest({
        method: "POST",
        url,
        data,
        headers: {
            "Content-type": "application/x-www-form-urlencoded"
        },
        timeout: REQUEST_TIMEOUT_MS,
        onload,
        onerror,
        ontimeout: () => onerror(new HttpResponse())
    });
}

// Vendored MD5 implementation (RFC 1321), written directly from the
// algorithm description. Replaces the third-party script previously pulled
// at install time via @require ("Portable MD5 Function" on greasyfork.org),
// so the userscript no longer loads remote code.
const SHIFTS = [
    7, 12, 17, 22,
    5, 9, 14, 20,
    4, 11, 16, 23,
    6, 10, 15, 21
];
const SINE_CONSTANTS = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296));
function hex_md5(input) {
    return md5Words(new TextEncoder().encode(input)).map(hexWord).join("");
}
function md5Words(bytes) {
    const padded = padMessage(bytes);
    let a0 = 0x67452301;
    let b0 = 0xEFCDAB89;
    let c0 = 0x98BADCFE;
    let d0 = 0x10325476;
    for (let offset = 0; offset < padded.length; offset += 64) {
        const words = littleEndianWords(padded, offset);
        let a = a0;
        let b = b0;
        let c = c0;
        let d = d0;
        for (let i = 0; i < 64; i++) {
            let f;
            let messageIndex;
            if (i < 16) {
                f = b & c | ~b & d;
                messageIndex = i;
            }
            else if (i < 32) {
                f = d & b | ~d & c;
                messageIndex = (5 * i + 1) % 16;
            }
            else if (i < 48) {
                f = b ^ c ^ d;
                messageIndex = (3 * i + 5) % 16;
            }
            else {
                f = c ^ (b | ~d);
                messageIndex = 7 * i % 16;
            }
            f = f + a + SINE_CONSTANTS[i] + words[messageIndex] | 0;
            a = d;
            d = c;
            c = b;
            b = b + rotateLeft(f, SHIFTS[i % 4 + Math.floor(i / 16) * 4]) | 0;
        }
        a0 = a0 + a | 0;
        b0 = b0 + b | 0;
        c0 = c0 + c | 0;
        d0 = d0 + d | 0;
    }
    return [a0, b0, c0, d0];
}
function padMessage(bytes) {
    const bitLength = bytes.length * 8;
    const paddedLength = (bytes.length + 8 >> 6) + 1 << 6;
    const padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const lowBits = bitLength % 4294967296;
    const highBits = Math.floor(bitLength / 4294967296);
    for (let i = 0; i < 4; i++) {
        padded[paddedLength - 8 + i] = lowBits >>> i * 8 & 0xFF;
        padded[paddedLength - 4 + i] = highBits >>> i * 8 & 0xFF;
    }
    return padded;
}
function littleEndianWords(bytes, offset) {
    const words = [];
    for (let j = 0; j < 16; j++) {
        const base = offset + j * 4;
        words[j] =
            bytes[base] |
                bytes[base + 1] << 8 |
                bytes[base + 2] << 16 |
                bytes[base + 3] << 24;
    }
    return words;
}
function rotateLeft(value, shift) {
    return value << shift | value >>> 32 - shift;
}
function hexWord(word) {
    let result = "";
    for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
        result += (word >>> byteIndex * 8 & 0xFF).toString(16).padStart(2, "0");
    }
    return result;
}

const API_ROOT = "https://ws.audioscrobbler.com/2.0/";
const AUTH_URL_ROOT = "https://www.last.fm/api/auth/";
const SESSION_KEY_STORAGE_KEY = "lastfmSessionKey";
const SESSION_USER_STORAGE_KEY = "lastfmSessionUser";
function isErrorPayload(value) {
    return typeof value === "object" && value !== null && "error" in value;
}
function parseApiResponse(response) {
    let json;
    try {
        json = JSON.parse(response.responseText);
    }
    catch (_a) {
        json = undefined;
    }
    if (response.status === 200 && json !== undefined && !isErrorPayload(json)) {
        return { ok: true, data: json, errorMessage: "" };
    }
    const errorMessage = isErrorPayload(json) ? json.message : response.statusText || "Unknown error";
    return { ok: false, data: json, errorMessage };
}
// Last.fm signs every authenticated call the same way: sort every param
// (except "format" and "callback") by key, concatenate key+value pairs,
// append the shared secret, and MD5 it. This never includes the user's
// password -- only the app's own key/secret and the call's own params.
function apiSignature(params) {
    const signableKeys = Object.keys(params)
        .filter(key => key !== "format" && key !== "callback")
        .sort();
    const concatenated = signableKeys.map(key => `${key}${params[key]}`).join("");
    return hex_md5(`${concatenated}${getApiSecret()}`);
}
function callApi(method, params, httpMethod, onload, onerror) {
    const signedParams = Object.assign({ method, api_key: getApiKey() }, params);
    signedParams["api_sig"] = apiSignature(signedParams);
    signedParams["format"] = "json";
    const wrappedOnload = (response) => onload(parseApiResponse(response));
    if (httpMethod === "GET") {
        httpGet(`${API_ROOT}?${encodeParams(signedParams)}`, wrappedOnload, onerror);
    }
    else {
        httpPost(API_ROOT, encodeParams(signedParams), wrappedOnload, onerror);
    }
}
function requestAuthToken(onload, onerror) {
    callApi("auth.getToken", {}, "GET", onload, onerror);
}
function buildAuthorizeUrl(token) {
    return `${AUTH_URL_ROOT}?api_key=${encodeURIComponent(getApiKey())}&token=${encodeURIComponent(token)}`;
}
function requestSession(token, onload, onerror) {
    callApi("auth.getSession", { token }, "GET", onload, onerror);
}
function storedSessionKey() {
    return GM_getValue(SESSION_KEY_STORAGE_KEY, "");
}
function storedSessionUser() {
    return GM_getValue(SESSION_USER_STORAGE_KEY, "");
}
function storeSession(username, sessionKey) {
    GM_setValue(SESSION_USER_STORAGE_KEY, username);
    GM_setValue(SESSION_KEY_STORAGE_KEY, sessionKey);
}
function clearSession() {
    GM_deleteValue(SESSION_KEY_STORAGE_KEY);
    GM_deleteValue(SESSION_USER_STORAGE_KEY);
}
function updateNowPlaying(song, index, album, onload, onerror) {
    callApi("track.updateNowPlaying", {
        artist: song.artist,
        track: song.trackName,
        album,
        trackNumber: `${index + 1}`,
        duration: `${song.duration}`,
        sk: storedSessionKey()
    }, "POST", onload, onerror);
}
function buildScrobbleParams(song, index, album, time) {
    return {
        [`artist[${index}]`]: song.artist,
        [`track[${index}]`]: song.trackName,
        [`album[${index}]`]: album,
        [`trackNumber[${index}]`]: `${index + 1}`,
        [`duration[${index}]`]: `${song.duration}`,
        [`timestamp[${index}]`]: `${time}`
    };
}
function scrobbleTracks(postdata, onload, onerror) {
    callApi("track.scrobble", Object.assign(Object.assign({}, postdata), { sk: storedSessionKey() }), "POST", onload, onerror);
}

function fetch_unix_timestamp() {
    return Math.floor(Date.now() / 1000);
}
function decodeHtmlEntities(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
}
function stripAndClean(input) {
    let result = decodeHtmlEntities(input)
        .replace(/\n/g, " ")
        .replace(/\u00A0/g, " ")
        .replace(/ {2,}/g, " ")
        .trim();
    while (result.startsWith("& - ")) {
        result = result.substring(4);
    }
    while (result.startsWith(" - ")) {
        result = result.substring(3);
    }
    while (result.startsWith("- ")) {
        result = result.substring(2);
    }
    return result;
}

class rymUi {
    constructor() {
        this.albumTitleClass = ".album_title";
        this.byArtistProperty = "byArtist";
        this.creditedNameClass = "credited_name";
        this.trackElementId = "tracks";
        this.tracklistDurationClass = ".tracklist_duration";
        this.tracklistLineClass = "tracklist_line";
        this.tracklistNumClass = ".tracklist_num";
        this.tracklistTitleClass = ".tracklist_title";
        this.tracklistArtistClass = ".artist";
        this.tracklistRenderedTextClass = ".rendered_text";
        //#endregion
    }
    get isVariousArtists() {
        const artist = this.pageArtist;
        return artist.indexOf("Various Artists") > -1 ||
            artist.indexOf(" / ") > -1;
    }
    get pageArtist() {
        var _a;
        return (_a = this.multipleByArtists) !== null && _a !== void 0 ? _a : this.singleByArtist;
    }
    get pageAlbum() {
        var _a, _b;
        // Not using innerText because it doesn't work with Jest tests.
        const element = document.querySelector(this.albumTitleClass);
        return ((_b = (_a = element.firstChild) === null || _a === void 0 ? void 0 : _a.textContent) !== null && _b !== void 0 ? _b : "").trim();
    }
    get multipleByArtists() {
        return Array.from(document.getElementsByClassName(this.creditedNameClass))
            .map(x => x)
            .map(x => { var _a; return (_a = x.innerText) !== null && _a !== void 0 ? _a : ""; })[1];
    }
    get singleByArtist() {
        return Array.from(document.querySelectorAll(`span[itemprop='${this.byArtistProperty}'] > a`))
            .map(e => this.parseArtistLink(e))
            .join(" / ");
    }
    parseArtistLink(element) {
        return Array.from(element.childNodes)
            .filter(node => node.nodeType === 3) // Node.TEXT_NODE
            .map(node => { var _a, _b; return (_b = (_a = node.textContent) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : ""; })
            .join("");
    }
    hasTrackNumber(tracklistLine) {
        var _a, _b;
        return ((_b = (_a = tracklistLine.querySelector(this.tracklistNumClass)) === null || _a === void 0 ? void 0 : _a.innerHTML) !== null && _b !== void 0 ? _b : "").trim().length > 0;
    }
    //#region Element getters
    get trackListDiv() {
        return document.getElementById(this.trackElementId);
    }
    get tracklistLines() {
        var _a;
        return Array.from((_a = this.trackListDiv.getElementsByClassName(this.tracklistLineClass)) !== null && _a !== void 0 ? _a : [])
            .map(l => l);
    }
    tracklistLine(checkbox) {
        var _a;
        return (_a = checkbox.parentElement) === null || _a === void 0 ? void 0 : _a.parentElement;
    }
    trackName(tracklistLine) {
        var _a, _b;
        let songTitle = "";
        const songTags = tracklistLine === null || tracklistLine === void 0 ? void 0 : tracklistLine.querySelectorAll("[itemprop=name]");
        if (songTags.length > 0) {
            const lastSongTag = songTags[songTags.length - 1];
            songTitle = ((_a = lastSongTag === null || lastSongTag === void 0 ? void 0 : lastSongTag.textContent) !== null && _a !== void 0 ? _a : "").replace(/\n/g, " ");
            // Check if the tag is hiding any artist links; if so, strip them out
            const artistLinks = lastSongTag.querySelectorAll(this.tracklistArtistClass);
            if (artistLinks.length > 0) {
                const renderedTextSpan = lastSongTag.querySelector(this.tracklistRenderedTextClass);
                songTitle = renderedTextSpan.innerHTML.replace(/<a[^>]*>.*?<\/a>/g, " ").trim();
            }
        }
        else {
            const renderedTextSpan = tracklistLine === null || tracklistLine === void 0 ? void 0 : tracklistLine.querySelector(this.tracklistRenderedTextClass);
            songTitle = (_b = renderedTextSpan === null || renderedTextSpan === void 0 ? void 0 : renderedTextSpan.textContent) !== null && _b !== void 0 ? _b : "";
        }
        return stripAndClean(songTitle);
    }
    trackArtist(tracklistLine) {
        var _a, _b;
        const artistTags = tracklistLine === null || tracklistLine === void 0 ? void 0 : tracklistLine.querySelectorAll(this.tracklistArtistClass);
        if (artistTags.length === 0)
            return "";
        if (artistTags.length === 1) {
            return (_a = artistTags[0].textContent) !== null && _a !== void 0 ? _a : "";
        }
        // Multiple artists
        const entireSpan = tracklistLine.querySelector(this.tracklistTitleClass);
        const entireText = ((_b = entireSpan.textContent) !== null && _b !== void 0 ? _b : "").replace(/\n/g, " ");
        const dashIndex = entireText.indexOf(" - ");
        return entireText.substring(0, dashIndex);
    }
    trackDuration(tracklistLine) {
        var _a;
        const durationElement = tracklistLine === null || tracklistLine === void 0 ? void 0 : tracklistLine.querySelector(this.tracklistDurationClass);
        return ((_a = durationElement.textContent) !== null && _a !== void 0 ? _a : "").trim();
    }
}

class rymScrobbleUi {
    constructor(rymUi) {
        var _a, _b;
        this.enabled = false;
        this.marqueeId = "rymscrobblemarquee";
        this.progBarId = "progbar";
        this.scrobbleNowId = "scrobblenow";
        this.scrobbleThenId = "scrobblethen";
        this.testId = "scrobbletest";
        this.checkboxClass = "rymscrobblechk";
        this.selectAllOrNoneId = "allornone";
        this.authButtonId = "rymscrobbleauth";
        this.authStatusId = "rymscrobbleauthstatus";
        this.disconnectId = "rymscrobbledisconnect";
        this.apiSetupContainerId = "rymscrobbleapisetup";
        this.apiKeyInputId = "rymscrobbleapikey";
        this.apiSecretInputId = "rymscrobbleapisecret";
        this.saveApiCredsId = "rymscrobblesaveapicreds";
        this.authContainerId = "rymscrobbleauthcontainer";
        this.changeApiKeyId = "rymscrobblechangeapikey";
        this._rymUi = rymUi;
        if (((_b = (_a = this._rymUi.trackListDiv) === null || _a === void 0 ? void 0 : _a.children.length) !== null && _b !== void 0 ? _b : 0) === 0) {
            console.log("RYMscrobble: No track list found.");
        }
        else {
            this.enabled = true;
            this.createCheckboxes();
            this.createControls();
        }
    }
    get isEnabled() {
        return this.enabled;
    }
    createCheckboxes() {
        const checkboxTemplate = `<input type="checkbox" class="${this.checkboxClass}" checked="checked">`;
        for (const tracklistLine of this._rymUi.tracklistLines) {
            if (this._rymUi.hasTrackNumber(tracklistLine)) {
                const thisCheckboxElement = document.createElement("span");
                thisCheckboxElement.style.float = "left";
                thisCheckboxElement.innerHTML = checkboxTemplate;
                tracklistLine.prepend(thisCheckboxElement);
            }
        }
    }
    createControls() {
        var _a;
        const eleButtonDiv = document.createElement("div");
        eleButtonDiv.className = "rymscrobble-controls";
        eleButtonDiv.innerHTML = `
<table style="border: 0;" cellpadding="0" cellspacing="2px">
  <tr>
    <td style="width: 112px;">
      <input type="checkbox" name="${this.selectAllOrNoneId}" id="${this.selectAllOrNoneId}" style="vertical-align: middle;" checked="checked">&nbsp;
      <label for="${this.selectAllOrNoneId}" style="font-size: 60%;">select&nbsp;all/none</label>
      <br/>
      <table border="2" cellpadding="0" cellspacing="0">
        <tr>
          <td style="height: 50px; width: 103px; background: url(https://cdn.last.fm/flatness/logo_black.3.png) no-repeat; color: #fff;">
            <div class="marquee" style="position: relative; top: 17px; overflow: hidden; white-space: nowrap;">
              <span style="font-size: 80%; width: 88px; display: inline-block; animation: marquee 5s linear infinite;" id="${this.marqueeId}">&nbsp;</span>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color: #003;">
            <div style="position: relative; background-color: #f00; width: 0; max-height: 5px; left: 0; top: 0;" id="${this.progBarId}">&nbsp;</div>
          </td>
        </tr>
      </table>
    </td>
    <td>
        <div id="${this.apiSetupContainerId}" style="display: none; font-size: 85%; text-align: left; max-width: 260px; margin-left: auto;">
          Paste a Last.fm <a href="https://www.last.fm/api/account/create" target="_blank" rel="noopener noreferrer">API key</a> to enable scrobbling (free, one-time setup):<br/>
          API key: <input type="text" size="20" id="${this.apiKeyInputId}" /><br/>
          Shared secret: <input type="text" size="20" id="${this.apiSecretInputId}" /><br/>
          <input type="button" id="${this.saveApiCredsId}" value="Save API key" />
        </div>
        <div id="${this.authContainerId}">
          <span id="${this.authStatusId}" style="font-size: 85%;"></span>
          <a href="#" id="${this.changeApiKeyId}" style="font-size: 75%; display: none;">(change API key)</a><br />
          <input type="button" id="${this.authButtonId}" value="Connect to Last.fm" />
          <input type="button" id="${this.disconnectId}" value="Disconnect" style="display: none;" /><br />
          <input type="button" id="${this.scrobbleNowId}" value="Scrobble in real-time" disabled />
          <input type="button" id="${this.scrobbleThenId}" value="Scrobble a previous play" disabled />
          <input type="button" id="${this.testId}" value="Test tracklist parsing" style="display: none;" />
        </div>
      </td>
    </tr>
  </table>`;
        eleButtonDiv.style.textAlign = "right";
        (_a = this._rymUi.trackListDiv) === null || _a === void 0 ? void 0 : _a.after(eleButtonDiv);
        this.allOrNoneCheckbox.addEventListener("click", () => this.allOrNoneClick(), true);
        const marqueeStyle = document.createElement("style");
        document.head.appendChild(marqueeStyle);
        marqueeStyle.textContent = `
      @keyframes marquee {
        0% { transform: translateX(100%); }
        100% { transform: translateX(-100%); }
      }

      .rymscrobble-controls input[type="button"],
      .rymscrobble-controls input[type="text"] {
        margin: 3px 4px;
      }`;
    }
    hookUpScrobbleNow(startScrobble) {
        this.scrobbleNowButton.addEventListener("click", startScrobble, true);
    }
    hookUpScrobbleThen(startBatchScrobble) {
        this.scrobbleThenButton.addEventListener("click", startBatchScrobble, true);
    }
    hookUpScrobbleTest(callback) {
        this.scrobbleTestButton.addEventListener("click", callback, true);
    }
    hookUpAuthButton(callback) {
        this.authButton.addEventListener("click", callback, true);
    }
    hookUpDisconnectButton(callback) {
        this.disconnectButton.addEventListener("click", callback, true);
    }
    hookUpSaveApiCredentials(callback) {
        this.saveApiCredsButton.addEventListener("click", () => {
            callback(this.apiKeyInput.value.trim(), this.apiSecretInput.value.trim());
        }, true);
    }
    hookUpChangeApiKey(callback) {
        this.changeApiKeyLink.addEventListener("click", event => {
            event.preventDefault();
            callback();
        }, true);
    }
    setMarquee(value) {
        this.marquee.innerHTML = value;
    }
    setProgressBar(percentage) {
        if (percentage >= 0 && percentage <= 100) {
            this.progressBar.style.width = `${percentage}%`;
        }
    }
    allOrNoneClick() {
        window.setTimeout(() => this.allOrNoneAction(), 10);
    }
    allOrNoneAction() {
        for (const checkbox of this.checkboxes) {
            checkbox.checked = this.allOrNoneCheckbox.checked;
        }
    }
    elementsOnAndOff(state) {
        const controls = [
            this.scrobbleNowButton,
            this.scrobbleThenButton
        ];
        for (const control of controls) {
            control.toggleAttribute("disabled", !state);
        }
        for (const checkbox of this.checkboxes) {
            checkbox.toggleAttribute("disabled", !state);
        }
    }
    elementsOff() {
        this.elementsOnAndOff(false);
    }
    elementsOn() {
        this.elementsOnAndOff(true);
    }
    showApiKeySetup(currentApiKey, currentApiSecret) {
        this.apiKeyInput.value = currentApiKey;
        this.apiSecretInput.value = currentApiSecret;
        this.apiSetupContainer.style.display = "";
        this.authContainer.style.display = "none";
        this.elementsOnAndOff(false);
    }
    showDisconnected() {
        this.apiSetupContainer.style.display = "none";
        this.authContainer.style.display = "";
        this.changeApiKeyLink.style.display = "";
        this.authStatus.textContent = "Not connected to Last.fm";
        this.authButton.value = "Connect to Last.fm";
        this.authButton.style.display = "";
        this.authButton.toggleAttribute("disabled", false);
        this.disconnectButton.style.display = "none";
        this.elementsOnAndOff(false);
    }
    showAwaitingApproval() {
        this.authStatus.textContent = "Approve access on the last.fm tab that just opened, then click below.";
        this.authButton.value = "I've approved it, finish connecting";
        this.authButton.style.display = "";
        this.authButton.toggleAttribute("disabled", false);
        this.disconnectButton.style.display = "none";
    }
    showConnecting() {
        this.authButton.toggleAttribute("disabled", true);
    }
    showConnected(username) {
        this.apiSetupContainer.style.display = "none";
        this.authContainer.style.display = "";
        this.changeApiKeyLink.style.display = "";
        this.authStatus.innerHTML = `Connected to Last.fm as <b>${username}</b>`;
        this.authButton.style.display = "none";
        this.disconnectButton.style.display = "";
        this.elementsOnAndOff(true);
    }
    //#region Element getters
    get allOrNoneCheckbox() {
        return document.getElementById(this.selectAllOrNoneId);
    }
    get scrobbleNowButton() {
        return document.getElementById(this.scrobbleNowId);
    }
    get scrobbleThenButton() {
        return document.getElementById(this.scrobbleThenId);
    }
    get scrobbleTestButton() {
        return document.getElementById(this.testId);
    }
    get marquee() {
        return document.getElementById(this.marqueeId);
    }
    get progressBar() {
        return document.getElementById(this.progBarId);
    }
    get authButton() {
        return document.getElementById(this.authButtonId);
    }
    get disconnectButton() {
        return document.getElementById(this.disconnectId);
    }
    get authStatus() {
        return document.getElementById(this.authStatusId);
    }
    get apiSetupContainer() {
        return document.getElementById(this.apiSetupContainerId);
    }
    get authContainer() {
        return document.getElementById(this.authContainerId);
    }
    get apiKeyInput() {
        return document.getElementById(this.apiKeyInputId);
    }
    get apiSecretInput() {
        return document.getElementById(this.apiSecretInputId);
    }
    get saveApiCredsButton() {
        return document.getElementById(this.saveApiCredsId);
    }
    get changeApiKeyLink() {
        return document.getElementById(this.changeApiKeyId);
    }
    get checkboxes() {
        return document.getElementsByClassName(this.checkboxClass);
    }
}

class ScrobbleRecord {
    constructor(trackName, artist, duration) {
        this.artist = artist;
        this.trackName = trackName;
        const durastr = duration.trim();
        if (durastr.indexOf(":") !== -1) {
            this.duration = durastr
                .split(":")
                .reduce((totalSeconds, part) => totalSeconds * 60 + parseInt(part), 0);
        }
        else {
            this.duration = 180;
        }
        this.time = 0;
    }
}

function buildListOfSongsToScrobble(_rymUi, _rymScrobbleUi) {
    const toScrobble = [];
    Array.from(_rymScrobbleUi.checkboxes).forEach(checkbox => {
        if (checkbox.checked) {
            toScrobble[toScrobble.length] = parseTracklistLine(_rymUi, checkbox);
        }
    });
    return toScrobble;
}
function parseTracklistLine(rymUi, checkbox) {
    const tracklistLine = rymUi.tracklistLine(checkbox);
    const pageArtist = rymUi.pageArtist;
    let songTitle = rymUi.trackName(tracklistLine);
    let artist = pageArtist;
    const duration = rymUi.trackDuration(tracklistLine);
    if (rymUi.isVariousArtists) {
        artist = rymUi.trackArtist(tracklistLine);
        if (artist.length === 0) {
            artist = pageArtist.indexOf("Various Artists") > -1
                ? rymUi.pageAlbum
                : pageArtist; // Probably a collaboration release, like a classical work.
        }
    }
    else {
        const trackArtist = rymUi.trackArtist(tracklistLine);
        if (trackArtist.length > 0) {
            artist = trackArtist;
        }
    }
    if (songTitle.toLowerCase() === "untitled" ||
        songTitle.toLowerCase() === "untitled track" ||
        songTitle === "") {
        songTitle = "[untitled]";
    }
    return new ScrobbleRecord(songTitle, artist, duration);
}

const _rymUi = new rymUi();
const _rymScrobbleUi = new rymScrobbleUi(_rymUi);
let toScrobble = [];
let currentlyScrobbling = -1;
let currTrackDuration = 0;
let currTrackPlayTime = 0;
let pendingAuthToken = "";
function confirmBrowseAway(oEvent) {
    if (currentlyScrobbling !== -1) {
        oEvent.preventDefault();
        return "You are currently scrobbling a record. Leaving the page now will prevent future tracks from this release from scrobbling.";
    }
    return "";
}
//#region Last.fm API key setup
function showApiKeySetup() {
    _rymScrobbleUi.showApiKeySetup(getApiKey(), getApiSecret());
}
function saveApiCredentials(apiKey, apiSecret) {
    if (apiKey.length === 0 || apiSecret.length === 0) {
        alert("Both the API key and shared secret are required.");
        return;
    }
    // A session key is only valid for the app that requested it, so switching
    // API credentials invalidates whatever session was previously stored.
    clearSession();
    storeApiCredentials(apiKey, apiSecret);
    refreshConnectionUi();
}
//#endregion
//#region Last.fm connect / disconnect
function refreshConnectionUi() {
    if (!hasApiCredentials()) {
        showApiKeySetup();
        return;
    }
    const sessionKey = storedSessionKey();
    if (sessionKey.length > 0) {
        _rymScrobbleUi.showConnected(storedSessionUser());
    }
    else {
        _rymScrobbleUi.showDisconnected();
    }
}
function isConnected() {
    return storedSessionKey().length > 0;
}
function beginOrContinueAuth() {
    if (isConnected()) {
        return;
    }
    if (pendingAuthToken.length > 0) {
        finishAuth();
        return;
    }
    _rymScrobbleUi.showConnecting();
    requestAuthToken(acceptAuthToken, handleNetworkError);
}
function acceptAuthToken(result) {
    if (!result.ok) {
        alert(`Could not start Last.fm login: ${result.errorMessage}`);
        refreshConnectionUi();
        return;
    }
    pendingAuthToken = result.data.token;
    window.open(buildAuthorizeUrl(pendingAuthToken), "_blank");
    _rymScrobbleUi.showAwaitingApproval();
}
function finishAuth() {
    _rymScrobbleUi.showConnecting();
    requestSession(pendingAuthToken, acceptAuthSession, handleNetworkError);
}
function acceptAuthSession(result) {
    pendingAuthToken = "";
    if (!result.ok) {
        alert(`Could not finish Last.fm login: ${result.errorMessage}\n\nMake sure you approved access on the last.fm tab before clicking this button.`);
        refreshConnectionUi();
        return;
    }
    storeSession(result.data.session.name, result.data.session.key);
    refreshConnectionUi();
}
function disconnect() {
    clearSession();
    refreshConnectionUi();
}
//#endregion
function acceptSubmitResponse(result, isBatch) {
    if (!result.ok) {
        alertRequestFailed(result);
        resetScrobbler();
        return;
    }
    if (isBatch) {
        _rymScrobbleUi.elementsOn();
        _rymScrobbleUi.setMarquee("Scrobbled OK!");
    }
    else {
        scrobbleNextSong();
    }
}
function alertRequestFailed(result) {
    alert(`Track submit failed: ${result.errorMessage}`);
}
function acceptSubmitResponseSingle(result) {
    acceptSubmitResponse(result, false);
}
function acceptSubmitResponseBatch(result) {
    acceptSubmitResponse(result, true);
}
function acceptNPResponse(result) {
    if (!result.ok) {
        alertRequestFailed(result);
    }
}
function submitTracksBatch() {
    toScrobble = buildListOfSongsToScrobble(_rymUi, _rymScrobbleUi);
    let currTime = fetch_unix_timestamp();
    const hoursFudgeStr = prompt("How many hours ago did you finish listening to this?");
    if (hoursFudgeStr === null) {
        _rymScrobbleUi.elementsOn();
        return;
    }
    const album = _rymUi.pageAlbum;
    const hoursFudge = parseFloat(hoursFudgeStr);
    if (!isNaN(hoursFudge)) {
        currTime = currTime - hoursFudge * 60 * 60;
    }
    for (let i = toScrobble.length - 1; i >= 0; i--) {
        currTime -= toScrobble[i].duration;
        toScrobble[i].time = currTime;
    }
    const postdata = {};
    for (let i = 0; i < toScrobble.length; i++) {
        Object.assign(postdata, buildScrobbleParams(toScrobble[i], i, album, toScrobble[i].time));
    }
    scrobbleTracks(postdata, acceptSubmitResponseBatch, handleNetworkError);
}
function startScrobble() {
    if (!isConnected()) {
        alert("Connect to Last.fm first.");
        return;
    }
    currentlyScrobbling = -1;
    currTrackDuration = 0;
    currTrackPlayTime = 0;
    _rymScrobbleUi.elementsOff();
    toScrobble = buildListOfSongsToScrobble(_rymUi, _rymScrobbleUi);
    scrobbleNextSong();
}
function resetScrobbler() {
    currentlyScrobbling = -1;
    currTrackDuration = 0;
    currTrackPlayTime = 0;
    _rymScrobbleUi.setMarquee("&nbsp;");
    _rymScrobbleUi.setProgressBar(0);
    toScrobble = [];
    _rymScrobbleUi.elementsOn();
}
function scrobbleNextSong() {
    currentlyScrobbling++;
    if (currentlyScrobbling === toScrobble.length) {
        resetScrobbler();
    }
    else {
        window.setTimeout(timertick, 10);
        npNextTrack();
    }
}
function submitThisTrack() {
    const song = toScrobble[currentlyScrobbling];
    const currTime = fetch_unix_timestamp();
    const postdata = buildScrobbleParams(song, 0, _rymUi.pageAlbum, currTime - song.duration);
    scrobbleTracks(postdata, acceptSubmitResponseSingle, handleNetworkError);
}
function npNextTrack() {
    const song = toScrobble[currentlyScrobbling];
    currTrackDuration = song.duration;
    currTrackPlayTime = 0;
    _rymScrobbleUi.setMarquee(song.trackName);
    updateNowPlaying(song, currentlyScrobbling, _rymUi.pageAlbum, acceptNPResponse, handleNetworkError);
}
function timertick() {
    let again = true;
    if (currentlyScrobbling !== -1) {
        if (currTrackDuration !== 0) {
            _rymScrobbleUi.setProgressBar(100 * currTrackPlayTime / currTrackDuration);
        }
        currTrackPlayTime++;
        if (currTrackPlayTime === currTrackDuration) {
            submitThisTrack();
            again = false;
        }
    }
    if (again && currentlyScrobbling !== -1) {
        window.setTimeout(timertick, 1000);
    }
}
function handleNetworkError(response) {
    alert(`Network request failed: ${response.status} ${response.statusText}\n\nCheck your internet connection and try again.\n\nData:\n${response.responseText}`);
    resetScrobbler();
}
function startBatchScrobble() {
    if (!isConnected()) {
        alert("Connect to Last.fm first.");
        return;
    }
    _rymScrobbleUi.elementsOff();
    submitTracksBatch();
}
function scrobbleTest() {
    console.log(_rymUi.pageAlbum);
    toScrobble = buildListOfSongsToScrobble(_rymUi, _rymScrobbleUi);
    toScrobble.forEach((song, i) => {
        const minutes = Math.floor(song.duration / 60);
        const seconds = song.duration % 60;
        const secondsStr = `00${seconds}`.slice(-2);
        console.log(`${i + 1}. ${song.artist} — ${song.trackName} (${minutes}:${secondsStr})`);
    });
}
(function () {
    if (!_rymScrobbleUi.isEnabled) {
        return;
    }
    refreshConnectionUi();
    _rymScrobbleUi.hookUpSaveApiCredentials(saveApiCredentials);
    _rymScrobbleUi.hookUpChangeApiKey(showApiKeySetup);
    _rymScrobbleUi.hookUpAuthButton(beginOrContinueAuth);
    _rymScrobbleUi.hookUpDisconnectButton(disconnect);
    _rymScrobbleUi.hookUpScrobbleNow(startScrobble);
    _rymScrobbleUi.hookUpScrobbleThen(startBatchScrobble);
    _rymScrobbleUi.hookUpScrobbleTest(scrobbleTest);
    window.addEventListener("beforeunload", confirmBrowseAway, true);
})();
