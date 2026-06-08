import { sha256Hex, zeroBuffer } from './crypto';

type CacheEntry = {
  key: Uint8Array;
  expiresAt: number;
};

let ttlMs = 10 * 60 * 1000;

class DataKeyCache {
  private entries = new Map<string, CacheEntry>();

  get(cacheKey: string) {
    let entry = this.entries.get(cacheKey);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      zeroBuffer(entry.key);
      this.entries.delete(cacheKey);
      return null;
    }

    return new Uint8Array(entry.key);
  }

  set(cacheKey: string, key: Uint8Array) {
    let previous = this.entries.get(cacheKey);
    if (previous) zeroBuffer(previous.key);

    this.entries.set(cacheKey, {
      key: new Uint8Array(key),
      expiresAt: Date.now() + ttlMs
    });
  }

  delete(cacheKey: string) {
    let entry = this.entries.get(cacheKey);
    if (entry) zeroBuffer(entry.key);
    this.entries.delete(cacheKey);
  }

  clear() {
    for (let entry of this.entries.values()) zeroBuffer(entry.key);
    this.entries.clear();
  }
}

export let dataKeyCache = new DataKeyCache();

export let getDataKeyCacheKey = (d: { keyId: string; encryptedDataKey: Uint8Array; keyInfo: any }) =>
  `${d.keyId}:${sha256Hex(
    Buffer.concat([
      Buffer.from(d.encryptedDataKey),
      Buffer.from(JSON.stringify(d.keyInfo ?? null), 'utf8')
    ])
  )}`;
