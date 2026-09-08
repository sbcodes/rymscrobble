import { HttpResponse } from "../models/HttpResponse";
import { IDictionary } from "../models/IDictionary";

const REQUEST_TIMEOUT_MS = 30000;

export function encodeParams(params: IDictionary): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

export function httpGet(
  url: string,
  onload: (response: HttpResponse) => void,
  onerror: (response: HttpResponse) => void
): void {
  GM_xmlhttpRequest({
    method: "GET",
    url,
    timeout: REQUEST_TIMEOUT_MS,
    onload,
    onerror,
    ontimeout: () => onerror(new HttpResponse())
  });
}

export function httpPost(
  url: string,
  data: string,
  onload: (response: HttpResponse) => void,
  onerror: (response: HttpResponse) => void
): void {
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
