import { ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db } from '@mtsrc/ai-gateway-db';
import type { GatewayPrincipal } from '@mtsrc/ai-gateway-spec';
import { invalidCredentialError, missingCredentialError } from '../lib/errors';
import { clearCachedTokenScope, getCachedGatewayToken } from '../lib/tokenCache';
import {
  hashGatewayTokenSecret,
  parseGatewayToken,
  secretHashesMatch
} from '../lib/tokenSecret';

let lastUsedWriteIntervalMs = 60_000;

class GatewayCredentialServiceImpl {
  private lastUsedWrites = new Map<string, number>();

  async verify(d: { token: string | undefined }): Promise<GatewayPrincipal> {
    if (!d.token) throw new ServiceError(missingCredentialError());

    let parsed = parseGatewayToken(d.token);
    if (!parsed) throw new ServiceError(invalidCredentialError());

    let cached = await getCachedGatewayToken({ prefix: parsed.prefix });
    if (!cached) throw new ServiceError(invalidCredentialError());

    let secretHash = await hashGatewayTokenSecret(parsed.secret);
    if (!secretHashesMatch(secretHash, cached.secretHash)) {
      throw new ServiceError(invalidCredentialError());
    }

    if (cached.revokedAt || (cached.expiresAt && cached.expiresAt <= new Date())) {
      throw new ServiceError(invalidCredentialError());
    }

    this.touchLastUsed(cached.id);

    return cached.principal;
  }

  async invalidateScope(d: { organizationId?: string; instanceIds?: string[] }) {
    await clearCachedTokenScope(d);
  }

  private touchLastUsed(id: string) {
    let now = Date.now();
    let previous = this.lastUsedWrites.get(id);

    if (previous !== undefined && now - previous < lastUsedWriteIntervalMs) return;

    this.lastUsedWrites.set(id, now);

    db.gatewayToken
      .update({ where: { id }, data: { lastUsedAt: new Date(now) } })
      .catch(error => console.error('Failed to record gateway token usage', error));
  }
}

export let gatewayCredentialService = Service.create(
  'gatewayCredentialService',
  () => new GatewayCredentialServiceImpl()
).build();
