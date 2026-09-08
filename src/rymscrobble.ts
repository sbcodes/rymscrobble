import { HttpResponse } from "./models/HttpResponse";
import ScrobbleRecord from "./models/ScrobbleRecord";
import {
  AuthSessionData,
  AuthTokenData,
  LastfmApiResult,
  buildAuthorizeUrl,
  buildScrobbleParams,
  clearSession,
  requestAuthToken,
  requestSession,
  scrobbleTracks,
  storeSession,
  storedSessionKey,
  storedSessionUser,
  updateNowPlaying
} from "./services/lastfm";
import { getApiKey, getApiSecret, hasApiCredentials, storeApiCredentials } from "./services/config";
import rymUi from "./services/rymUi";
import rymScrobbleUi from "./services/rymScrobbleUi";
import * as uiParser from "./services/uiParser";
import { fetch_unix_timestamp } from "./services/utilities";

const _rymUi = new rymUi();
const _rymScrobbleUi = new rymScrobbleUi(_rymUi);

let toScrobble: ScrobbleRecord[] = [];
let currentlyScrobbling = -1;
let currTrackDuration = 0;
let currTrackPlayTime = 0;
let pendingAuthToken = "";

function confirmBrowseAway(oEvent: BeforeUnloadEvent): string {
  if (currentlyScrobbling !== -1) {
    oEvent.preventDefault();
    return "You are currently scrobbling a record. Leaving the page now will prevent future tracks from this release from scrobbling.";
  }
  return "";
}

//#region Last.fm API key setup

function showApiKeySetup(): void {
  _rymScrobbleUi.showApiKeySetup(getApiKey(), getApiSecret());
}

function saveApiCredentials(apiKey: string, apiSecret: string): void {
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

function refreshConnectionUi(): void {
  if (!hasApiCredentials()) {
    showApiKeySetup();
    return;
  }

  const sessionKey = storedSessionKey();
  if (sessionKey.length > 0) {
    _rymScrobbleUi.showConnected(storedSessionUser());
  } else {
    _rymScrobbleUi.showDisconnected();
  }
}

function isConnected(): boolean {
  return storedSessionKey().length > 0;
}

function beginOrContinueAuth(): void {
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

function acceptAuthToken(result: LastfmApiResult<AuthTokenData>): void {
  if (!result.ok) {
    alert(`Could not start Last.fm login: ${result.errorMessage}`);
    refreshConnectionUi();
    return;
  }

  pendingAuthToken = result.data.token;
  window.open(buildAuthorizeUrl(pendingAuthToken), "_blank");
  _rymScrobbleUi.showAwaitingApproval();
}

function finishAuth(): void {
  _rymScrobbleUi.showConnecting();
  requestSession(pendingAuthToken, acceptAuthSession, handleNetworkError);
}

function acceptAuthSession(result: LastfmApiResult<AuthSessionData>): void {
  pendingAuthToken = "";

  if (!result.ok) {
    alert(`Could not finish Last.fm login: ${result.errorMessage}\n\nMake sure you approved access on the last.fm tab before clicking this button.`);
    refreshConnectionUi();
    return;
  }

  storeSession(result.data.session.name, result.data.session.key);
  refreshConnectionUi();
}

function disconnect(): void {
  clearSession();
  refreshConnectionUi();
}

//#endregion

function acceptSubmitResponse(result: LastfmApiResult<unknown>, isBatch: boolean) {
  if (!result.ok) {
    alertRequestFailed(result);
    resetScrobbler();
    return;
  }

  if (isBatch) {
    _rymScrobbleUi.elementsOn();
    _rymScrobbleUi.setMarquee("Scrobbled OK!");
  } else {
    scrobbleNextSong();
  }
}

function alertRequestFailed(result: LastfmApiResult<unknown>) {
  alert(`Track submit failed: ${result.errorMessage}`);
}

function acceptSubmitResponseSingle(result: LastfmApiResult<unknown>) {
  acceptSubmitResponse(result, false);
}

function acceptSubmitResponseBatch(result: LastfmApiResult<unknown>) {
  acceptSubmitResponse(result, true);
}

function acceptNPResponse(result: LastfmApiResult<unknown>) {
  if (!result.ok) {
    alertRequestFailed(result);
  }
}

function submitTracksBatch() {
  toScrobble = uiParser.buildListOfSongsToScrobble(_rymUi, _rymScrobbleUi);

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

  const postdata: Record<string, string> = {};

  for (let i = 0; i < toScrobble.length; i++) {
    Object.assign(postdata, buildScrobbleParams(toScrobble[i], i, album, toScrobble[i].time));
  }

  scrobbleTracks(postdata, acceptSubmitResponseBatch, handleNetworkError);
}

function startScrobble(): void {
  if (!isConnected()) {
    alert("Connect to Last.fm first.");
    return;
  }

  currentlyScrobbling = -1;
  currTrackDuration = 0;
  currTrackPlayTime = 0;

  _rymScrobbleUi.elementsOff();
  toScrobble = uiParser.buildListOfSongsToScrobble(_rymUi, _rymScrobbleUi);
  scrobbleNextSong();
}

function resetScrobbler(): void {
  currentlyScrobbling = -1;
  currTrackDuration = 0;
  currTrackPlayTime = 0;
  _rymScrobbleUi.setMarquee("&nbsp;");
  _rymScrobbleUi.setProgressBar(0);
  toScrobble = [];
  _rymScrobbleUi.elementsOn();
}

function scrobbleNextSong(): void {
  currentlyScrobbling++;

  if (currentlyScrobbling === toScrobble.length) {
    resetScrobbler();
  } else {
    window.setTimeout(timertick, 10);
    npNextTrack();
  }
}

function submitThisTrack(): void {
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

function handleNetworkError(response: HttpResponse) {
  alert(`Network request failed: ${response.status} ${response.statusText}\n\nCheck your internet connection and try again.\n\nData:\n${response.responseText}`);
  resetScrobbler();
}

function startBatchScrobble(): void {
  if (!isConnected()) {
    alert("Connect to Last.fm first.");
    return;
  }

  _rymScrobbleUi.elementsOff();
  submitTracksBatch();
}

function scrobbleTest(): void {
  console.log(_rymUi.pageAlbum);
  toScrobble = uiParser.buildListOfSongsToScrobble(_rymUi, _rymScrobbleUi);
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
