import { HttpResponse } from "../../src/models/HttpResponse";
import ScrobbleRecord from "../../src/models/ScrobbleRecord";
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
} from "../../src/services/lastfm";
import { hex_md5 } from "../../src/services/md5";

jest.mock("../../src/services/config", () => ({
  getApiKey: () => "test-api-key",
  getApiSecret: () => "test-secret"
}));

interface CapturedRequestDetails {
  method?: string;
  url?: string;
  data?: string;
  onload?: (response: HttpResponse) => void;
  onerror?: (response: HttpResponse) => void;
}

function makeResponse(status: number, body: unknown): HttpResponse {
  const response = new HttpResponse();
  response.status = status;
  response.statusText = status === 200 ? "OK" : "Error";
  response.responseText = JSON.stringify(body);
  return response;
}

function parseQuery(url: string): URLSearchParams {
  return new URLSearchParams(url.split("?")[1] ?? "");
}

describe("lastfm", () => {
  let captured: CapturedRequestDetails | undefined;
  const storage = new Map<string, string>();

  beforeEach(() => {
    captured = undefined;
    storage.clear();

    global.GM_xmlhttpRequest = (details: CapturedRequestDetails) => {
      captured = details;
    };
    global.GM_getValue = ((key: string, defaultValue?: string) => {
      const stored = storage.get(key);
      return stored !== undefined ? stored : defaultValue ?? "";
    }) as typeof GM_getValue;
    global.GM_setValue = (key: string, value: string) => {
      storage.set(key, value);
    };
    global.GM_deleteValue = (key: string) => {
      storage.delete(key);
    };
  });

  describe("requestAuthToken", () => {
    test("signs a GET call to auth.getToken", () => {
      requestAuthToken(() => undefined, () => undefined);

      expect(captured?.method).toBe("GET");
      const query = parseQuery(captured?.url ?? "");
      expect(query.get("method")).toBe("auth.getToken");
      expect(query.get("api_key")).toBe("test-api-key");
      expect(query.get("format")).toBe("json");

      const expectedSig = hex_md5("api_keytest-api-keymethodauth.getTokentest-secret");
      expect(query.get("api_sig")).toBe(expectedSig);
    });

    test("never includes format in the signature", () => {
      requestAuthToken(() => undefined, () => undefined);

      const query = parseQuery(captured?.url ?? "");
      const sigWithoutFormat = hex_md5("api_keytest-api-keymethodauth.getTokentest-secret");
      const sigWithFormat = hex_md5("api_keytest-api-keyformatjsonmethodauth.getTokentest-secret");

      expect(query.get("api_sig")).toBe(sigWithoutFormat);
      expect(query.get("api_sig")).not.toBe(sigWithFormat);
    });

    test("resolves with the token on success", () => {
      let result: LastfmApiResult<AuthTokenData> | undefined;
      requestAuthToken(r => {
        result = r;
      }, () => undefined);

      captured?.onload?.(makeResponse(200, { token: "abc123" }));

      expect(result?.ok).toBe(true);
      expect(result?.ok && result.data.token).toBe("abc123");
    });

    test("resolves not-ok with the error message on failure", () => {
      let result: LastfmApiResult<AuthTokenData> | undefined;
      requestAuthToken(r => {
        result = r;
      }, () => undefined);

      captured?.onload?.(makeResponse(403, { error: 10, message: "Invalid API key" }));

      expect(result?.ok).toBe(false);
      expect(result?.errorMessage).toBe("Invalid API key");
    });

    test("forwards transport errors to onerror", () => {
      let errored: HttpResponse | undefined;
      requestAuthToken(() => undefined, response => {
        errored = response;
      });

      const errPayload = new HttpResponse();
      captured?.onerror?.(errPayload);

      expect(errored).toBe(errPayload);
    });
  });

  describe("buildAuthorizeUrl", () => {
    test("builds the last.fm authorize link with the api key and token", () => {
      const url = buildAuthorizeUrl("mytoken");
      expect(url).toBe("https://www.last.fm/api/auth/?api_key=test-api-key&token=mytoken");
    });

    test("encodes special characters in the token", () => {
      const url = buildAuthorizeUrl("tok&en");
      expect(url).toContain("token=tok%26en");
    });
  });

  describe("requestSession", () => {
    test("signs a GET call to auth.getSession with the token", () => {
      requestSession("mytoken", () => undefined, () => undefined);

      const query = parseQuery(captured?.url ?? "");
      expect(query.get("method")).toBe("auth.getSession");
      expect(query.get("token")).toBe("mytoken");

      const expectedSig = hex_md5("api_keytest-api-keymethodauth.getSessiontokenmytokentest-secret");
      expect(query.get("api_sig")).toBe(expectedSig);
    });

    test("resolves with the session on success", () => {
      let result: LastfmApiResult<AuthSessionData> | undefined;
      requestSession("mytoken", r => {
        result = r;
      }, () => undefined);

      captured?.onload?.(makeResponse(200, { session: { name: "someuser", key: "sesskey123" } }));

      expect(result?.ok).toBe(true);
      expect(result?.ok && result.data.session.name).toBe("someuser");
      expect(result?.ok && result.data.session.key).toBe("sesskey123");
    });
  });

  describe("session storage", () => {
    test("storeSession never touches a password field", () => {
      storeSession("someuser", "sesskey123");

      expect(storage.get("lastfmSessionUser")).toBe("someuser");
      expect(storage.get("lastfmSessionKey")).toBe("sesskey123");
      expect(Array.from(storage.keys())).not.toContain("pass");
      expect(Array.from(storage.keys())).not.toContain("pwhash");
    });

    test("storedSessionKey and storedSessionUser read back what was stored", () => {
      storeSession("someuser", "sesskey123");

      expect(storedSessionUser()).toBe("someuser");
      expect(storedSessionKey()).toBe("sesskey123");
    });

    test("clearSession removes both values", () => {
      storeSession("someuser", "sesskey123");
      clearSession();

      expect(storedSessionKey()).toBe("");
      expect(storedSessionUser()).toBe("");
    });

    test("storedSessionKey is empty before any session is stored", () => {
      expect(storedSessionKey()).toBe("");
    });
  });

  describe("updateNowPlaying", () => {
    test("posts the current track with the stored session key", () => {
      storeSession("someuser", "sesskey123");
      const song = new ScrobbleRecord("The Sound of Silence", "Simon & Garfunkel", "3:06");

      updateNowPlaying(song, 2, "Wednesday Morning, 3 A.M.", () => undefined, () => undefined);

      expect(captured?.method).toBe("POST");
      const query = new URLSearchParams(captured?.data ?? "");
      expect(query.get("method")).toBe("track.updateNowPlaying");
      expect(query.get("artist")).toBe("Simon & Garfunkel");
      expect(query.get("track")).toBe("The Sound of Silence");
      expect(query.get("album")).toBe("Wednesday Morning, 3 A.M.");
      expect(query.get("trackNumber")).toBe("3");
      expect(query.get("duration")).toBe("186");
      expect(query.get("sk")).toBe("sesskey123");
    });
  });

  describe("buildScrobbleParams", () => {
    const song = new ScrobbleRecord("The Sound of Silence", "Simon & Garfunkel", "3:06");

    test("brackets every key with the track index", () => {
      const params = buildScrobbleParams(song, 2, "Wednesday Morning, 3 A.M.", 1724000000);

      expect(Object.keys(params)).toEqual([
        "artist[2]",
        "track[2]",
        "album[2]",
        "trackNumber[2]",
        "duration[2]",
        "timestamp[2]"
      ]);
    });

    test("fills in the api values", () => {
      const params = buildScrobbleParams(song, 0, "Wednesday Morning, 3 A.M.", 1724000000);

      expect(params["artist[0]"]).toBe("Simon & Garfunkel");
      expect(params["track[0]"]).toBe("The Sound of Silence");
      expect(params["album[0]"]).toBe("Wednesday Morning, 3 A.M.");
      expect(params["trackNumber[0]"]).toBe("1");
      expect(params["duration[0]"]).toBe("186");
      expect(params["timestamp[0]"]).toBe("1724000000");
    });

    test("does not set the session key", () => {
      const params = buildScrobbleParams(song, 0, "Album", 1724000000);
      expect(params["sk"]).toBeUndefined();
    });
  });

  describe("scrobbleTracks", () => {
    test("adds the stored session key to a batch of scrobbles", () => {
      storeSession("someuser", "sesskey123");
      const song = new ScrobbleRecord("The Sound of Silence", "Simon & Garfunkel", "3:06");
      const postdata = buildScrobbleParams(song, 0, "Album", 1724000000);

      scrobbleTracks(postdata, () => undefined, () => undefined);

      const query = new URLSearchParams(captured?.data ?? "");
      expect(query.get("method")).toBe("track.scrobble");
      expect(query.get("artist[0]")).toBe("Simon & Garfunkel");
      expect(query.get("sk")).toBe("sesskey123");
    });

    test("resolves ok on a successful scrobble response", () => {
      let result: LastfmApiResult<unknown> | undefined;
      scrobbleTracks({}, r => {
        result = r;
      }, () => undefined);

      captured?.onload?.(makeResponse(200, { scrobbles: { "@attr": { accepted: 1, ignored: 0 } } }));

      expect(result?.ok).toBe(true);
    });

    test("resolves not-ok on a rejected scrobble", () => {
      let result: LastfmApiResult<unknown> | undefined;
      scrobbleTracks({}, r => {
        result = r;
      }, () => undefined);

      captured?.onload?.(makeResponse(403, { error: 9, message: "Invalid session key" }));

      expect(result?.ok).toBe(false);
      expect(result?.errorMessage).toBe("Invalid session key");
    });
  });
});
