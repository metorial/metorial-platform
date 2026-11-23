import type { ProviderCredentials } from '@mtsrc/ai-gateway-spec';

let ttlMs = 5 * 60_000;
let maxEntries = 2000;

type Entry = { credentials: ProviderCredentials; expiresAt: number };

let entries = new Map<string, Entry>();
let inFlight = new Map<string, Promise<ProviderCredentials>>();

// Keyed by the connection's `updatedAt` as well as its id: any write to the connection (including a
// credential rotation on another replica) produces a new key, so callers holding a fresh row never
// read a stale key. Plaintext only ever lives in this process's memory.
let keyOf = (d: { id: string; updatedAt: Date }) => `${d.id}:${d.updatedAt.getTime()}`;

export let getCachedCredentials = async (
  connection: { id: string; updatedAt: Date },
  load: () => Promise<ProviderCredentials>
) => {
  let key = keyOf(connection);

  let cached = entries.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.credentials;

  let pending = inFlight.get(key);
  if (pending) return await pending;

  let read = (async () => {
    let credentials = await load();

    if (entries.size >= maxEntries) entries.delete(entries.keys().next().value!);
    entries.set(key, { credentials, expiresAt: Date.now() + ttlMs });

    return credentials;
  })();

  inFlight.set(key, read);

  try {
    return await read;
  } finally {
    inFlight.delete(key);
  }
};

export let forgetCachedCredentials = (connectionId: string) => {
  for (let key of entries.keys()) {
    if (key.startsWith(`${connectionId}:`)) entries.delete(key);
  }
};
