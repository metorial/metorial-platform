import { createHash, createHmac } from 'node:crypto';

let organizationKeyCacheSize = 1024;

let truncatedBytes = 16;

export type OrganizationKey = { organizationId: string; version: number; key: Buffer };

export type OrganizationKeyDeriver = {
  forOrganization: (organization: { id: string; hashKeyVersion: number }) => OrganizationKey;
};

export let createOrganizationKeyDeriver = (secret: string): OrganizationKeyDeriver => {
  let cache = new Map<string, OrganizationKey>();

  return {
    forOrganization: organization => {
      let cacheKey = `${organization.hashKeyVersion}\0${organization.id}`;
      let cached = cache.get(cacheKey);

      if (cached) return cached;

      let derived: OrganizationKey = {
        organizationId: organization.id,
        version: organization.hashKeyVersion,
        key: createHmac('sha256', secret)
          .update(
            `groundstation/organization-key/v${organization.hashKeyVersion}/${organization.id}`
          )
          .digest()
      };

      if (cache.size >= organizationKeyCacheSize) {
        let oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }

      cache.set(cacheKey, derived);

      return derived;
    }
  };
};

export let hmac128 = (
  organizationKey: OrganizationKey,
  purpose: string,
  ...parts: (string | Uint8Array)[]
) => {
  let hmac = createHmac('sha256', organizationKey.key);

  hmac.update(purpose);

  for (let part of parts) {
    hmac.update('\0');
    hmac.update(part);
  }

  return hmac.digest().subarray(0, truncatedBytes).toString('hex');
};

export let sha256Hex = (input: string | Uint8Array) =>
  createHash('sha256').update(input).digest('hex');

export let recordId = (
  organizationKey: OrganizationKey,
  instanceId: string,
  adapterNs: string,
  identity: string
) => hmac128(organizationKey, 'record', instanceId, adapterNs, identity);

export let sessionKey = (
  organizationKey: OrganizationKey,
  instanceId: string,
  family: string,
  sessionId: string
) => hmac128(organizationKey, 'session', instanceId, family, sessionId);

export let contentHash = (
  organizationKey: OrganizationKey,
  role: string,
  text: string | Uint8Array
) => hmac128(organizationKey, `content/${role}`, text);
