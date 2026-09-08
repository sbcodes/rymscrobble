import { HttpResponse } from "../models/HttpResponse";
import { IDictionary } from "../models/IDictionary";
import ScrobbleRecord from "../models/ScrobbleRecord";
import { getApiKey, getApiSecret } from "./config";
import { encodeParams, httpGet, httpPost } from "./httpRequestHelper";
import { hex_md5 } from "./md5";

const API_ROOT = "https://ws.audioscrobbler.com/2.0/";
const AUTH_URL_ROOT = "https://www.last.fm/api/auth/";

export const SESSION_KEY_STORAGE_KEY = "lastfmSessionKey";
export const SESSION_USER_STORAGE_KEY = "lastfmSessionUser";

export interface AuthTokenData {
  token: string;
}

export interface AuthSessionData {
  session: {
    name: string;
    key: string;
    subscriber?: number;
  };
}

export type LastfmApiResult<T> =
  | { ok: true; data: T; errorMessage: "" }
  | { ok: false; data: unknown; errorMessage: string };

interface LastfmErrorPayload {
  error: number;
  message: string;
}

function isErrorPayload(value: unknown): value is LastfmErrorPayload {
  return typeof value === "object" && value !== null && "error" in value;
}

function parseApiResponse<T>(response: HttpResponse): LastfmApiResult<T> {
  let json: unknown;
  try {
    json = JSON.parse(response.responseText);
  } catch {
    json = undefined;
  }

  if (response.status === 200 && json !== undefined && !isErrorPayload(json)) {
    return { ok: true, data: json as T, errorMessage: "" };
  }

  const errorMessage = isErrorPayload(json) ? json.message : response.statusText || "Unknown error";
  return { ok: false, data: json, errorMessage };
}

// Last.fm signs every authenticated call the same way: sort every param
// (except "format" and "callback") by key, concatenate key+value pairs,
// append the shared secret, and MD5 it. This never includes the user's
// password -- only the app's own key/secret and the call's own params.
function apiSignature(params: IDictionary): string {
  const signableKeys = Object.keys(params)
    .filter(key => key !== "format" && key !== "callback")
    .sort();
  const concatenated = signableKeys.map(key => `${key}${params[key]}`).join("");
  return hex_md5(`${concatenated}${getApiSecret()}`);
}

function callApi<T>(
  method: string,
  params: IDictionary,
  httpMethod: "GET" | "POST",
  onload: (result: LastfmApiResult<T>) => void,
  onerror: (response: HttpResponse) => void
): void {
  const signedParams: IDictionary = { method, api_key: getApiKey(), ...params };
  signedParams["api_sig"] = apiSignature(signedParams);
  signedParams["format"] = "json";

  const wrappedOnload = (response: HttpResponse) => onload(parseApiResponse<T>(response));

  if (httpMethod === "GET") {
    httpGet(`${API_ROOT}?${encodeParams(signedParams)}`, wrappedOnload, onerror);
  } else {
    httpPost(API_ROOT, encodeParams(signedParams), wrappedOnload, onerror);
  }
}

export function requestAuthToken(
  onload: (result: LastfmApiResult<AuthTokenData>) => void,
  onerror: (response: HttpResponse) => void
): void {
  callApi("auth.getToken", {}, "GET", onload, onerror);
}

export function buildAuthorizeUrl(token: string): string {
  return `${AUTH_URL_ROOT}?api_key=${encodeURIComponent(getApiKey())}&token=${encodeURIComponent(token)}`;
}

export function requestSession(
  token: string,
  onload: (result: LastfmApiResult<AuthSessionData>) => void,
  onerror: (response: HttpResponse) => void
): void {
  callApi("auth.getSession", { token }, "GET", onload, onerror);
}

export function storedSessionKey(): string {
  return GM_getValue(SESSION_KEY_STORAGE_KEY, "");
}

export function storedSessionUser(): string {
  return GM_getValue(SESSION_USER_STORAGE_KEY, "");
}

export function storeSession(username: string, sessionKey: string): void {
  GM_setValue(SESSION_USER_STORAGE_KEY, username);
  GM_setValue(SESSION_KEY_STORAGE_KEY, sessionKey);
}

export function clearSession(): void {
  GM_deleteValue(SESSION_KEY_STORAGE_KEY);
  GM_deleteValue(SESSION_USER_STORAGE_KEY);
}

export function updateNowPlaying(
  song: ScrobbleRecord,
  index: number,
  album: string,
  onload: (result: LastfmApiResult<unknown>) => void,
  onerror: (response: HttpResponse) => void
): void {
  callApi("track.updateNowPlaying", {
    artist: song.artist,
    track: song.trackName,
    album,
    trackNumber: `${index + 1}`,
    duration: `${song.duration}`,
    sk: storedSessionKey()
  }, "POST", onload, onerror);
}

export function buildScrobbleParams(
  song: ScrobbleRecord,
  index: number,
  album: string,
  time: number
): IDictionary {
  return {
    [`artist[${index}]`]: song.artist,
    [`track[${index}]`]: song.trackName,
    [`album[${index}]`]: album,
    [`trackNumber[${index}]`]: `${index + 1}`,
    [`duration[${index}]`]: `${song.duration}`,
    [`timestamp[${index}]`]: `${time}`
  };
}

export function scrobbleTracks(
  postdata: IDictionary,
  onload: (result: LastfmApiResult<unknown>) => void,
  onerror: (response: HttpResponse) => void
): void {
  callApi("track.scrobble", { ...postdata, sk: storedSessionKey() }, "POST", onload, onerror);
}
