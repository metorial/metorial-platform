import { ServiceError } from '@lowerdeck/error';
import type { CredentialKind } from '@metorial/groundstation-spec';
import { db } from '../db';
import { invalidCredentialError, missingCredentialError } from './errors';
import type { IngestPrincipal } from './principal';
import { getCachedIngestCredential } from './tokenCache';
import {
  hashIngestTokenSecret,
  parseIngestCredential,
  secretHashesMatch
} from './tokenSecret';

let lastUsedWriteIntervalMs = 60_000;

let lastUsedWrites = new Map<string, number>();

let touchLastUsed = (kind: CredentialKind, id: string) => {
  let now = Date.now();
  let key = `${kind}:${id}`;
  let previous = lastUsedWrites.get(key);

  if (previous !== undefined && now - previous < lastUsedWriteIntervalMs) return;

  lastUsedWrites.set(key, now);

  let update = { where: { id }, data: { lastUsedAt: new Date(now) } };
  let write =
    kind == 'source' ? db.ingestSource.update(update) : db.ingestToken.update(update);

  write.catch(error => console.error('Failed to record ingest credential usage', error));
};

export let verifyIngestCredential = async (
  credential: string | undefined
): Promise<IngestPrincipal> => {
  if (!credential) throw new ServiceError(missingCredentialError());

  let parsed = parseIngestCredential(credential);
  if (!parsed) throw new ServiceError(invalidCredentialError());

  let cached = await getCachedIngestCredential({ kind: parsed.kind, prefix: parsed.prefix });
  if (!cached) throw new ServiceError(invalidCredentialError());

  let secretHash = await hashIngestTokenSecret(parsed.secret);
  if (!secretHashesMatch(secretHash, cached.secretHash)) {
    throw new ServiceError(invalidCredentialError());
  }

  let now = new Date();
  if (cached.revokedAt || (cached.expiresAt && cached.expiresAt <= now)) {
    throw new ServiceError(invalidCredentialError());
  }

  touchLastUsed(cached.kind, cached.id);

  return cached.principal;
};
