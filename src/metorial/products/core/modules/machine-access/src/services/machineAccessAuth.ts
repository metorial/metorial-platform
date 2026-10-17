import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { Service } from '@lowerdeck/service';
import { UnifiedApiKey } from '@metorial/api-keys';
import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { Context } from '@metorial/context';
import { db, Prisma } from '@metorial/db';
import { differenceInMinutes } from 'date-fns';

let API_KEY_SECRET_CACHE_TTL_SECONDS = 10;

export let machineAccessInclude = {
  organization: true,
  user: true,
  instance: {
    include: {
      project: true
    }
  },
  actor: true
} as const;

let apiKeySecretInclude = {
  apiKey: {
    include: {
      machineAccess: {
        include: machineAccessInclude
      }
    }
  }
} as const;

let oauthTokenInclude = {
  oauthAuthorization: {
    include: {
      oauthApplication: true,
      oauthInstallation: true,
      organizationMember: true,
      serviceAccountCredential: {
        include: {
          serviceAccount: true
        }
      },
      user: true,
      machineAccess: {
        include: machineAccessInclude
      }
    }
  }
} as const;

type ApiKeySecretWithMachineAccess = Prisma.ApiKeySecretGetPayload<{
  include: typeof apiKeySecretInclude;
}>;

// Process-local on purpose: the row carries the plaintext secret and user records, which
// must not be copied into Redis. Revocation clears this process; others expire within the TTL.
let getApiKeySecretBySha512 = createLocallyCachedFunction({
  ttlSeconds: API_KEY_SECRET_CACHE_TTL_SECONDS,
  getHash: (d: { token: string; secretSha512: string }) => d.secretSha512,
  provider: async (d: { token: string; secretSha512: string }) =>
    await db.apiKeySecret.findUnique({
      where: { secret: d.token },
      include: apiKeySecretInclude
    })
});

export type OAuthTokenWithAuthorization = Prisma.OAuthTokenGetPayload<{
  include: typeof oauthTokenInclude;
}>;

export type MachineAccessAuthResult =
  | {
      type: 'api_key';
      secret: ApiKeySecretWithMachineAccess;
    }
  | {
      type: 'oauth_token';
      oauthToken: OAuthTokenWithAuthorization;
    };

class MachineAccessAuthService {
  async authenticateWithMachineAccessToken(d: {
    token: string;
    context: Context;
  }): Promise<MachineAccessAuthResult> {
    let parsed = UnifiedApiKey.from(d.token);

    if (parsed) {
      if (parsed.type == 'oauth_access_token') {
        let oauthToken = await db.oAuthToken.findFirst({
          where: {
            accessToken: d.token
          },
          include: oauthTokenInclude
        });

        if (!oauthToken) {
          throw new ServiceError(
            unauthorizedError({
              message: 'Invalid OAuth access token'
            })
          );
        }

        if (
          oauthToken.oauthAuthorization.status != 'active' ||
          oauthToken.oauthAuthorization.oauthApplication.status != 'active' ||
          oauthToken.oauthAuthorization.oauthInstallation.status != 'active' ||
          oauthToken.oauthAuthorization.machineAccess.status != 'active' ||
          oauthToken.accessTokenExpiresAt < new Date() ||
          (oauthToken.completelyExpiresAt && oauthToken.completelyExpiresAt < new Date())
        ) {
          throw new ServiceError(
            unauthorizedError({
              message: 'OAuth access token is expired or has been revoked'
            })
          );
        }

        if (
          !oauthToken.lastUsedAt ||
          differenceInMinutes(new Date(), oauthToken.lastUsedAt) > 30
        ) {
          await db.oAuthToken.update({
            where: { id: oauthToken.id },
            data: { lastUsedAt: new Date() }
          });
        }

        return {
          type: 'oauth_token',
          oauthToken
        };
      }

      let secret = await getApiKeySecretBySha512({
        token: d.token,
        secretSha512: await Hash.sha512(d.token)
      });
      if (secret) {
        if (
          secret.apiKey.status != 'active' ||
          secret.apiKey.machineAccess.status != 'active' ||
          (secret.expiresAt && secret.expiresAt < new Date()) ||
          (secret.apiKey.expiresAt && secret.apiKey.expiresAt < new Date())
        ) {
          throw new ServiceError(
            unauthorizedError({
              message: 'API key is expired or has been revoked',
              hint: 'Make sure to use a valid API key from the Metorial dashboard'
            })
          );
        }

        if (
          !secret.apiKey.lastUsedAt ||
          differenceInMinutes(new Date(), secret.apiKey.lastUsedAt) > 30
        ) {
          let lastUsedAt = new Date();
          await db.apiKey.update({
            where: { id: secret.apiKey.id },
            data: { lastUsedAt }
          });

          // The row may be served from the cache, so record the write there too.
          secret.apiKey.lastUsedAt = lastUsedAt;
        }

        return {
          type: 'api_key',
          secret
        };
      }
    }

    throw new ServiceError(
      unauthorizedError({
        message: 'Invalid API key',
        hint: 'Make sure to use a valid API key from the Metorial dashboard'
      })
    );
  }

  async clearApiKeyAuthCache(d: { apiKeyOid: bigint }) {
    let secrets = await db.apiKeySecret.findMany({
      where: { apiKeyOid: d.apiKeyOid },
      select: { secretSha512: true }
    });

    for (let secret of secrets) {
      await getApiKeySecretBySha512.clear({ token: '', secretSha512: secret.secretSha512 });
    }
  }
}

export let machineAccessAuthService = Service.create(
  'machineAccessAuthService',
  () => new MachineAccessAuthService()
).build();
