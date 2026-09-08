import {
  clearApiCredentials,
  getApiKey,
  getApiSecret,
  hasApiCredentials,
  storeApiCredentials
} from "../../src/services/config";

describe("config", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();

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

  test("has no credentials before anything is stored", () => {
    expect(hasApiCredentials()).toBe(false);
    expect(getApiKey()).toBe("");
    expect(getApiSecret()).toBe("");
  });

  test("storeApiCredentials persists both values locally", () => {
    storeApiCredentials("mykey", "mysecret");

    expect(getApiKey()).toBe("mykey");
    expect(getApiSecret()).toBe("mysecret");
    expect(hasApiCredentials()).toBe(true);
  });

  test("clearApiCredentials removes both values", () => {
    storeApiCredentials("mykey", "mysecret");
    clearApiCredentials();

    expect(getApiKey()).toBe("");
    expect(getApiSecret()).toBe("");
    expect(hasApiCredentials()).toBe(false);
  });

  test("is not considered configured with only a key or only a secret", () => {
    storeApiCredentials("mykey", "");
    expect(hasApiCredentials()).toBe(false);

    clearApiCredentials();
    storeApiCredentials("", "mysecret");
    expect(hasApiCredentials()).toBe(false);
  });
});
