import { vi, beforeEach, afterEach } from 'vitest';

let ALLOW_PRIVATE_KEY = 'SHUTTLE_ALLOW_PRIVATE_URLS';
let SSRF_BYPASS_KEY = 'SHUTTLE_UNSAFE_SSRF_BYPASS';
let ENV_KEYS = [ALLOW_PRIVATE_KEY, SSRF_BYPASS_KEY];

export let allowPrivateUrls = () => {
  process.env[ALLOW_PRIVATE_KEY] = 'true';
};

export let denyPrivateUrls = () => {
  delete process.env[ALLOW_PRIVATE_KEY];
};

export let enableSsrfBypass = () => {
  process.env[SSRF_BYPASS_KEY] = 'true';
};

export let disableSsrfBypass = () => {
  delete process.env[SSRF_BYPASS_KEY];
};

export let useFreshModules = () => {
  let saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (let key of ENV_KEYS) saved[key] = process.env[key];
    vi.resetModules();
  });

  afterEach(() => {
    for (let key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });
};

export let mockFetch = () => {
  let original: typeof globalThis.fetch;
  let mock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    original = globalThis.fetch;
    mock = vi.fn().mockResolvedValue(new Response('ok'));
    globalThis.fetch = mock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = original;
  });

  return { get mock() { return mock; } };
};

export let mockBunDns = (addresses: string[]) => {
  let restore: (() => void) | undefined;

  beforeEach(() => {
    restore = undefined;
    let lookupMock = vi.fn().mockResolvedValue(addresses.map(address => ({ address })));
    let g = globalThis as any;

    if (g.Bun?.dns?.lookup) {
      let originalLookup = g.Bun.dns.lookup;
      g.Bun.dns.lookup = lookupMock;
      restore = () => {
        g.Bun.dns.lookup = originalLookup;
      };
      return;
    }

    let originalBun = g.Bun;
    g.Bun = {
      ...(originalBun ?? {}),
      dns: {
        ...(originalBun?.dns ?? {}),
        lookup: lookupMock
      }
    };
    restore = () => {
      if (originalBun === undefined) delete g.Bun;
      else g.Bun = originalBun;
    };
  });

  afterEach(() => {
    restore?.();
  });
};
