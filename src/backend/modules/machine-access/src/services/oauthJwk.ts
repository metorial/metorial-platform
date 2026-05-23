import { delay } from '@mtsrc/delay';
import { Service } from '@mtsrc/service';
import { generateCustomId } from '@metorial/id';
import { oauthJwkGlobalRepository } from '@metorial/multi-region';
import { addDays } from 'date-fns';

let OAUTH_JWK_LOCK_NAME = 'machine_access.oauth_jwk.rotate';
let OAUTH_JWK_LOCK_TTL_MS = 5 * 60 * 1000;
let OAUTH_JWK_GENERATION_JITTER_MS = 30 * 1000;
let OAUTH_JWK_ACTIVE_LIFETIME_DAYS = 90;
let OAUTH_JWK_ROTATE_BEFORE_DAYS = 21;
let OAUTH_JWK_RETIRED_RETENTION_DAYS = 14;

let getRandomInt = (max: number) => {
  if (max <= 0) return 0;

  let array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
};

let sortKeys = <T extends { status: string; activatesAt: Date }>(keys: T[]) =>
  [...keys].sort((a, b) => {
    if (a.status == b.status) return a.activatesAt.getTime() - b.activatesAt.getTime();
    return a.status.localeCompare(b.status);
  });

type OAuthJwkRecord = Awaited<
  ReturnType<typeof oauthJwkGlobalRepository.listOAuthJwks>
>[number];

class OAuthJwkService {
  private async generateKeyMaterial() {
    let keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['sign', 'verify']
    );

    let publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    let privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    let kid = generateCustomId('oidc_kid', 24);

    return {
      kid,
      publicJwk: {
        ...publicJwk,
        kid,
        use: 'sig',
        alg: 'ES256',
        key_ops: ['verify']
      },
      privateJwk: {
        ...privateJwk,
        kid,
        use: 'sig',
        alg: 'ES256',
        key_ops: ['sign']
      }
    };
  }

  private async createJwk(d: { status: 'active' | 'next'; activatesAt: Date }) {
    let keyMaterial = await this.generateKeyMaterial();

    return await oauthJwkGlobalRepository.createOAuthJwk({
      kid: keyMaterial.kid,
      status: d.status,
      alg: 'ES256',
      use: 'sig',
      kty: 'EC',
      crv: 'P-256',
      publicJwk: keyMaterial.publicJwk as any,
      privateJwk: keyMaterial.privateJwk as any,
      activatesAt: d.activatesAt,
      expiresAt: addDays(d.activatesAt, OAUTH_JWK_ACTIVE_LIFETIME_DAYS)
    });
  }

  private async retireKey(d: { id: string; retiredAt?: Date }) {
    await oauthJwkGlobalRepository.updateOAuthJwkStatus({
      id: d.id,
      status: 'retired',
      retiredAt: d.retiredAt ?? new Date()
    });
  }

  private async activateKey(d: { id: string }) {
    await oauthJwkGlobalRepository.updateOAuthJwkStatus({
      id: d.id,
      status: 'active',
      retiredAt: null
    });
  }

  async listPublicOAuthJwks() {
    return await oauthJwkGlobalRepository.getPublicOAuthJwks();
  }

  async rotateOAuthJwks(d?: { withJitter?: boolean }) {
    if (d?.withJitter) {
      await delay(getRandomInt(OAUTH_JWK_GENERATION_JITTER_MS));
    }

    let lockToken = generateCustomId('oauth_jwk_lock', 24);
    let acquired = await oauthJwkGlobalRepository.tryAcquireLease({
      name: OAUTH_JWK_LOCK_NAME,
      token: lockToken,
      ttlMs: OAUTH_JWK_LOCK_TTL_MS
    });
    if (!acquired) {
      return {
        status: 'skipped_locked' as const
      };
    }

    try {
      let now = new Date();
      let rotated = false;
      let deletedRetired = 0;

      let keys = sortKeys(await oauthJwkGlobalRepository.listOAuthJwks());

      let activeKeys = keys
        .filter(key => key.status == 'active')
        .sort((a, b) => b.activatesAt.getTime() - a.activatesAt.getTime());
      for (let extraActive of activeKeys.slice(1)) {
        await this.retireKey({ id: extraActive.id, retiredAt: now });
        rotated = true;
      }
      let active: OAuthJwkRecord | null = activeKeys[0] ?? null;

      let nextKeys = keys
        .filter(key => key.status == 'next')
        .sort((a, b) => a.activatesAt.getTime() - b.activatesAt.getTime());
      for (let extraNext of nextKeys.slice(1)) {
        await this.retireKey({ id: extraNext.id, retiredAt: now });
        rotated = true;
      }
      let next: OAuthJwkRecord | null = nextKeys[0] ?? null;

      if (active && active.expiresAt <= now) {
        await this.retireKey({ id: active.id, retiredAt: now });
        active = null;
        rotated = true;
      }

      if (!active && next && next.activatesAt <= now) {
        await this.activateKey({ id: next.id });
        active = {
          ...next,
          status: 'active'
        };
        next = null;
        rotated = true;
      }

      if (!active) {
        active = await this.createJwk({
          status: 'active',
          activatesAt: now
        });
        rotated = true;
      }

      if (
        active.expiresAt <= addDays(now, OAUTH_JWK_ROTATE_BEFORE_DAYS) &&
        (!next || next.activatesAt > active.expiresAt)
      ) {
        next = await this.createJwk({
          status: 'next',
          activatesAt: active.expiresAt
        });
        rotated = true;
      }

      let deleteBefore = addDays(now, -OAUTH_JWK_RETIRED_RETENTION_DAYS);
      let refreshedKeys = await oauthJwkGlobalRepository.listOAuthJwks();
      for (let key of refreshedKeys) {
        if (key.status != 'retired') continue;
        if ((key.retiredAt ?? key.expiresAt) > deleteBefore) continue;

        await oauthJwkGlobalRepository.deleteOAuthJwk({
          id: key.id
        });
        deletedRetired += 1;
      }

      return {
        status: 'rotated' as const,
        rotated,
        deletedRetired,
        activeKid: active.kid,
        nextKid: next?.kid ?? null
      };
    } finally {
      await oauthJwkGlobalRepository.releaseLease({
        name: OAUTH_JWK_LOCK_NAME,
        token: lockToken
      });
    }
  }
}

export let oauthJwkService = Service.create(
  'oauthJwkService',
  () => new OAuthJwkService()
).build();
