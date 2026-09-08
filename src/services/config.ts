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

const BUILT_IN_API_KEY = process.env.LASTFM_API_KEY ?? "";
const BUILT_IN_API_SECRET = process.env.LASTFM_API_SECRET ?? "";

export function getApiKey(): string {
  return GM_getValue(API_KEY_STORAGE_KEY, "") || BUILT_IN_API_KEY;
}

export function getApiSecret(): string {
  return GM_getValue(API_SECRET_STORAGE_KEY, "") || BUILT_IN_API_SECRET;
}

export function hasApiCredentials(): boolean {
  return getApiKey().length > 0 && getApiSecret().length > 0;
}

export function storeApiCredentials(apiKey: string, apiSecret: string): void {
  GM_setValue(API_KEY_STORAGE_KEY, apiKey);
  GM_setValue(API_SECRET_STORAGE_KEY, apiSecret);
}

export function clearApiCredentials(): void {
  GM_deleteValue(API_KEY_STORAGE_KEY);
  GM_deleteValue(API_SECRET_STORAGE_KEY);
}
