import { HttpResponse } from "../../src/models/HttpResponse";
import { encodeParams, httpGet, httpPost } from "../../src/services/httpRequestHelper";
import { IDictionary } from "../../src/models/IDictionary";

interface CapturedRequestDetails {
  method?: string;
  url?: string;
  data?: string;
  headers?: Record<string, string>;
  timeout?: number;
  onload?: (response: HttpResponse) => void;
  onerror?: (response: HttpResponse) => void;
  ontimeout?: () => void;
}

describe("httpRequestHelper", () => {
  let captured: CapturedRequestDetails | undefined;

  beforeEach(() => {
    captured = undefined;
    global.GM_xmlhttpRequest = (details: CapturedRequestDetails) => {
      captured = details;
    };
  });

  test("httpGet sends a GET request with the expected timeout", () => {
    httpGet("https://example.com/handshake", () => undefined, () => undefined);

    expect(captured?.method).toBe("GET");
    expect(captured?.url).toBe("https://example.com/handshake");
    expect(captured?.timeout).toBe(30000);
  });

  test("httpGet forwards the raw response straight to onload", () => {
    let loaded: HttpResponse | undefined;
    httpGet(
      "https://example.com",
      response => {
        loaded = response;
      },
      () => undefined
    );

    const rawResponse = new HttpResponse();
    rawResponse.status = 200;
    rawResponse.statusText = "OK";
    rawResponse.responseText = "{\"token\":\"abc\"}";
    captured?.onload?.(rawResponse);

    expect(loaded).toBe(rawResponse);
  });

  test("httpGet passes transport errors through to the onerror handler", () => {
    let errored: HttpResponse | undefined;
    httpGet(
      "https://example.com",
      () => undefined,
      response => {
        errored = response;
      }
    );

    const errPayload = new HttpResponse();
    captured?.onerror?.(errPayload);

    expect(errored).toBe(errPayload);
  });

  test("httpGet reports timeouts as empty error responses", () => {
    let errored: HttpResponse | undefined;
    httpGet(
      "https://example.com",
      () => undefined,
      response => {
        errored = response;
      }
    );

    captured?.ontimeout?.();

    expect(errored).toBeInstanceOf(HttpResponse);
    expect(errored?.status).toBe(0);
  });

  test("httpPost sends a POST request with form content type and payload", () => {
    httpPost("https://example.com/submit", "s=abc&x=1", () => undefined, () => undefined);

    expect(captured?.method).toBe("POST");
    expect(captured?.url).toBe("https://example.com/submit");
    expect(captured?.data).toBe("s=abc&x=1");
    expect(captured?.headers).toEqual({
      "Content-type": "application/x-www-form-urlencoded"
    });
    expect(captured?.timeout).toBe(30000);
  });
});

describe("encodeParams", () => {
  test("encodes special characters in both keys and values", () => {
    const params: IDictionary = { "a[0]": "Simon & Garfunkel", s: "abc123" };

    expect(encodeParams(params)).toBe("a%5B0%5D=Simon%20%26%20Garfunkel&s=abc123");
  });

  test("preserves insertion order of the parameters", () => {
    const params: IDictionary = { z: "1", a: "2", m: "3" };

    expect(encodeParams(params)).toBe("z=1&a=2&m=3");
  });

  test("returns an empty string for an empty dictionary", () => {
    expect(encodeParams({})).toBe("");
  });
});
