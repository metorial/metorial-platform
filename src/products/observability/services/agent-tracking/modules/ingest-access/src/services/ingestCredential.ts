import { ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db } from '@mtsrc/agent-tracking-db';
import type { IngestPrincipal } from '@mtsrc/agent-tracking-records-model';
import type { CredentialKind } from '@mtsrc/agent-tracking-spec';
import { invalidCredentialError, missingCredentialError } from '../lib/errors';
import { clearCachedIngestScope, getCachedIngestCredential } from '../lib/tokenCache';
import {
  hashIngestTokenSecret,
  parseIngestCredential,
  secretHashesMatch
} from '../lib/tokenSecret';

let lastUsedWriteIntervalMs = 60_000;

class IngestCredentialServiceImpl {
  private lastUsedWrites = new Map<string, number>();

  async verify(d: { credential: string | undefined }): Promise<IngestPrincipal> {
    if (!d.credential) throw new ServiceError(missingCredentialError());

    let parsed = parseIngestCredential(d.credential);
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

    this.touchLastUsed(cached.kind, cached.id);

    return cached.principal;
  }

  async invalidateScope(d: { organizationId?: string; instanceIds?: string[] }) {
    await clearCachedIngestScope(d);
  }

  async invalidateTokens(d: { prefixes: string[] }) {
    for (let prefix of d.prefixes) {
      await getCachedIngestCredential.clearAndWait({ kind: 'token', prefix });
    }
  }

  private touchLastUsed(kind: CredentialKind, id: string) {
    let now = Date.now();
    let key = `${kind}:${id}`;
    let previous = this.lastUsedWrites.get(key);

    if (previous !== undefined && now - previous < lastUsedWriteIntervalMs) return;

    this.lastUsedWrites.set(key, now);

    let update = { where: { id }, data: { lastUsedAt: new Date(now) } };
    let write =
      kind == 'source' ? db.ingestSource.update(update) : db.ingestToken.update(update);

    write.catch(error => console.error('Failed to record ingest credential usage', error));
  }
}

export let ingestCredentialService = Service.create(
  'ingestCredentialService',
  () => new IngestCredentialServiceImpl()
).build();
