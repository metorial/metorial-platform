import { createHash, createHmac } from 'node:crypto';

let tenantKeyCacheSize = 1024;

let truncatedBytes = 16;

export type TenantKey = { tenantId: string; version: number; key: Buffer };

export type TenantKeyDeriver = {
  forTenant: (tenant: { id: string; hashKeyVersion: number }) => TenantKey;
};

export let createTenantKeyDeriver = (secret: string): TenantKeyDeriver => {
  let cache = new Map<string, TenantKey>();

  return {
    forTenant: tenant => {
      let cacheKey = `${tenant.hashKeyVersion}\0${tenant.id}`;
      let cached = cache.get(cacheKey);

      if (cached) return cached;

      let derived: TenantKey = {
        tenantId: tenant.id,
        version: tenant.hashKeyVersion,
        key: createHmac('sha256', secret)
          .update(`groundstation/tenant-key/v${tenant.hashKeyVersion}/${tenant.id}`)
          .digest()
      };

      if (cache.size >= tenantKeyCacheSize) {
        let oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }

      cache.set(cacheKey, derived);

      return derived;
    }
  };
};

export let hmac128 = (
  tenantKey: TenantKey,
  purpose: string,
  ...parts: (string | Uint8Array)[]
) => {
  let hmac = createHmac('sha256', tenantKey.key);

  hmac.update(purpose);

  for (let part of parts) {
    hmac.update('\0');
    hmac.update(part);
  }

  return hmac.digest().subarray(0, truncatedBytes).toString('hex');
};

export let sha256Hex = (input: string | Uint8Array) =>
  createHash('sha256').update(input).digest('hex');

export let recordId = (tenantKey: TenantKey, adapterNs: string, identity: string) =>
  hmac128(tenantKey, 'record', adapterNs, identity);

export let sessionKey = (tenantKey: TenantKey, family: string, sessionId: string) =>
  hmac128(tenantKey, 'session', family, sessionId);

export let contentHash = (tenantKey: TenantKey, role: string, text: string | Uint8Array) =>
  hmac128(tenantKey, `content/${role}`, text);
