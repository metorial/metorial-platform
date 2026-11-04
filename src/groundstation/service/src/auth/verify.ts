import { ServiceError } from '@lowerdeck/error';
import { db } from '../db';
import { invalidCredentialError, missingCredentialError } from './errors';
import type { IngestPrincipal } from './principal';
import { getCachedIngestToken } from './tokenCache';
import { hashIngestTokenSecret, parseIngestToken, secretHashesMatch } from './tokenSecret';

let lastUsedWriteIntervalMs = 60_000;

let lastUsedWrites = new Map<string, number>();

let touchLastUsed = (tokenId: string) => {
  let now = Date.now();
  let previous = lastUsedWrites.get(tokenId);

  if (previous !== undefined && now - previous < lastUsedWriteIntervalMs) return;

  lastUsedWrites.set(tokenId, now);

  db.ingestToken
    .update({ where: { id: tokenId }, data: { lastUsedAt: new Date(now) } })
    .catch(error => console.error('Failed to record ingest token usage', error));
};

export let verifyIngestCredential = async (
  credential: string | undefined
): Promise<IngestPrincipal> => {
  if (!credential) throw new ServiceError(missingCredentialError());

  let parsed = parseIngestToken(credential);
  if (!parsed) throw new ServiceError(invalidCredentialError());

  let cached = await getCachedIngestToken({ prefix: parsed.prefix });
  if (!cached) throw new ServiceError(invalidCredentialError());

  let secretHash = await hashIngestTokenSecret(parsed.secret);
  if (!secretHashesMatch(secretHash, cached.secretHash)) {
    throw new ServiceError(invalidCredentialError());
  }

  let now = new Date();
  if (cached.revokedAt || (cached.expiresAt && cached.expiresAt <= now)) {
    throw new ServiceError(invalidCredentialError());
  }

  touchLastUsed(cached.id);

  return {
    tokenId: cached.id,
    principalRef: cached.principalRef,

    contentPolicy: cached.contentPolicy,
    limits: cached.limits,
    allowedClients: cached.allowedClients,
    allowedChannels: cached.allowedChannels,

    tenant: cached.tenant
  };
};
