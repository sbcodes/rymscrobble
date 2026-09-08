# RYMscrobble

> Visit a release page on rateyourmusic.com and scrobble the songs you see!

RYMscrobble is a userscript for web browsers that lets you scrobble songs to [last.fm](https://www.last.fm/) directly from [RateYourMusic](https://rateyourmusic.com/). If you like to listen on a record or CD player and still want to track your music habits, you can scrobble from any supported web browser instead.

This is a fork of [scRYMble](https://github.com/fidwell/scRYMble) that swaps its username/password login for Last.fm's own web login flow, so **your Last.fm password never touches this script**. See [Why not username/password?](#why-not-usernamepassword) below.

## Installation

1. Install the [Violentmonkey](https://violentmonkey.github.io/) browser extension.
2. Install the script: [**click here to install RYMscrobble**](https://raw.githubusercontent.com/sbcodes/rymscrobble/main/dist/RYMscrobble.min.js) — Violentmonkey will prompt to add it. (This file is rebuilt automatically by CI on every push to `main`, so it always matches the latest source and never has anyone's personal API key baked in. See [For developers](#for-developers-how-to-build) to build it yourself instead.)
3. Visit any RYM release page. The script shows a one-time "Paste your Last.fm API key" prompt — see below to get one.

### Getting a Last.fm API key

RYMscrobble needs to identify itself to Last.fm as an "application", the same way every desktop scrobbler (foobar2000, MusicBee, etc.) does. This is separate from your Last.fm password and doesn't grant access to your account by itself.

1. Go to <https://www.last.fm/api/account/create> and create an application. Any name/description is fine; the callback URL field isn't used by this script and can be left blank or filled with anything.
2. Copy the "API key" and "Shared secret" it gives you.
3. Paste them into the "Set up Last.fm API key" box RYMscrobble shows on a RYM release page, and click Save.

That's it — the key/secret are stored locally in Violentmonkey (via `GM_setValue`), the same as everything else RYMscrobble remembers, and are never sent anywhere but last.fm itself. You can change them later via the "(change API key)" link next to the connect button.

Registering your own app also means Last.fm rate-limits are scoped to you, not shared with every other person using this script.

## Usage

Visit any release page on RateYourMusic (`https://rateyourmusic.com/release/*`) that has a tracklist. RYMscrobble will add scrobbling controls below the tracklist. Once your API key is set up, click **Connect to Last.fm** — this opens a last.fm tab where *you* log in and approve access, entirely on last.fm's own site. Once you approve, come back to the RYM tab and click the button again ("I've approved it, finish connecting") to complete the login. RYMscrobble remembers this connection (a Last.fm session key, not your password) between visits until you click **Disconnect**.

You can also check and uncheck tracks you wish to scrobble or ignore.

### Scrobble in real-time

If you want the page to scrobble along with you as you listen, click the "Scrobble in real-time" button. RYMscrobble will start a timer for each track based on the listed duration, and submit the scrobble when the time is up. (If no duration is listed, a default of 3 minutes is used.)

### Scrobble a previous play

If you already finished listening to the release, click the "Scrobble a previous play" button. You can then enter how long ago, in hours, you listened to the release. RYMscrobble will then submit all checked tracks in a batch. (You can submit fractional hours, too; for example, enter `0.5` for half an hour ago.)

## Why not username/password?

The original scRYMble asks for your Last.fm username and password directly, storing an MD5 hash of the password and using it to sign requests against Last.fm's legacy pre-2010 "Audioscrobbler" submission protocol. That's still effectively handing a copy of your password's hash to a third-party script.

RYMscrobble instead uses Last.fm's modern REST API and its **web authentication flow**, the closest thing Last.fm has to OAuth:

1. The script requests a one-time token from Last.fm (`auth.getToken`).
2. It opens `last.fm/api/auth/...` in a new tab, where you log in and approve access **on last.fm's own site** — RYMscrobble never sees your password.
3. The script exchanges the approved token for a permanent session key (`auth.getSession`).
4. That session key (not your password) is stored locally and used to sign future `track.updateNowPlaying` / `track.scrobble` calls.

You can revoke this access at any time from your [Last.fm account settings](https://www.last.fm/settings/applications) without changing your password.

## About

scRYMble was created by [bluetshirt](https://rateyourmusic.com/~bluetshirt) in 2009 with assistance from various RYM community members.

### Credits

- Original author: bluetshirt
- Name: lynkali
- Useful tweaks and bug fixes: fidwell, AnniesBoobs, BruceWayne, actually, Kronz, Carcinogeneration

## For developers: How to build

1. Install the latest version of [Node](https://nodejs.org/en/) and make sure to include NPM in the installation options.
2. Clone the project to a location of your choice on your PC.
3. Open a command prompt, use `cd` to change your current directory to the root folder of this project, and run `npm install`.
4. Run `npm run build` to build the project. Compiled and minified `.js` files will be added to the `dist` folder. You can paste the contents of those files into your script manager extension.

You can also use `npm run lint` to just run the linter to find style errors, or `npm run lint-fix` to fix them where possible.

`npm test` runs the Jest test suite, which checks RYMscrobble's logic against saved HTML fixtures of real RYM pages and mocked Last.fm API responses.

### About the API key and `.env`

The build above produces a script with **no** API key baked in — anyone installing it enters their own via the in-script prompt (see [Getting a Last.fm API key](#getting-a-lastfm-api-key)), which is what you want if you're publishing the built file (e.g. to Greasy Fork) for other people to install.

If you'd rather bake your own key into your personal build so you don't have to paste it in every time you reinstall the script, copy [`.env.example`](.env.example) to `.env` (gitignored, never committed) and fill in `LASTFM_API_KEY`/`LASTFM_API_SECRET` — `npm run build` inlines them as the script's default, used only when nothing's been entered at runtime. `src/services/config.ts` itself never contains real values either way.

**Don't commit a `dist/` you built locally with `.env` present.** `dist/` is checked into this repo (so `@updateURL`/`@downloadURL` above resolve to a real file), but it's meant to only ever be updated by CI, which never has your `.env` and therefore always produces a clean build. If you build locally with your own key for personal use, leave `dist/` uncommitted — check `git status`/`git diff` before pushing if you're ever unsure.

## License

RYMscrobble is released under the [MIT License](LICENSE), same as the scRYMble project it's forked from.
