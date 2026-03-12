import {
  preconditionFailedError,
  ServiceError,
  unauthorizedError
} from '@lowerdeck/error';
import { Tokens } from '@lowerdeck/tokens';
import { getConfig } from '@metorial/config';
import {
  ConsumerGroup,
  ConsumerProfile,
  ConsumerSurface,
  db,
  type Prisma
} from '@metorial/db';
import { createAresInternalClient } from '@metorial-services/ares-client';

let tokenSecret = `${getConfig().encryptionSecret}:consumer`;
let consumerTokens = new Tokens({
  secret: tokenSecret
});

export let consumerSessionInclude = {
  consumerProfile: {
    include: {
      consumer: true,
      surface: true
    }
  }
} as const;

export type ConsumerSessionWithProfile = Prisma.ConsumerSessionGetPayload<{
  include: typeof consumerSessionInclude;
}>;

export type EffectiveConsumerGroup = ConsumerGroup & {
  assignedVia: 'default' | 'manual' | 'sso' | 'user';
};

export type ConsumerAccessContext = {
  ssoGroupIds: string[];
  consumerGroups: EffectiveConsumerGroup[];
  accessTags: bigint[];
};

type AresInternalClient = ReturnType<typeof createAresInternalClient>;

let aresClient: AresInternalClient | null = null;

export let getConsumerAresInternalClient = (): AresInternalClient => {
  let endpoint = process.env.ARES_INTERNAL_URL;
  if (!endpoint) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'Ares integration is not configured'
      })
    );
  }

  if (!aresClient) {
    aresClient = createAresInternalClient({
      endpoint
    });
  }

  return aresClient;
};

export let getSsoGroupIdsForUser = async (d: { userId: string; appId: string }) => {
  let ares = getConsumerAresInternalClient();
  let identities = await ares.user.listIdentities({
    userId: d.userId
  });
  let allowedTenantIds = new Set(
    (await ares.sso.listTenants({ appId: d.appId, limit: 100 })).items.map(tenant => tenant.id)
  );
  let scopedIdentities = identities.filter(identity => {
    let ssoTenantId = identity.provider.ssoTenant?.id;
    return !!ssoTenantId && allowedTenantIds.has(ssoTenantId);
  });

  return Array.from(
    new Set(
      scopedIdentities.flatMap(identity => {
        return identity.ssoProfile?.groups ?? [];
      })
    )
  ).sort();
};

export let getSsoGroupIdsForSession = async (d: {
  sessionId: string;
  preferredAresUserId?: string;
  preferredEmail?: string;
  appId: string;
}) => {
  let ares = getConsumerAresInternalClient();
  let loggedInUsers = await ares.session.getLoggedInUsers({
    sessionId: d.sessionId
  });

  let matchedUsers = d.preferredAresUserId
    ? loggedInUsers.filter(loggedInUser => loggedInUser.user.id == d.preferredAresUserId)
    : d.preferredEmail
      ? loggedInUsers.filter(
          loggedInUser => loggedInUser.user.email.toLowerCase() == d.preferredEmail!.toLowerCase()
        )
      : loggedInUsers;

  if ((d.preferredAresUserId || d.preferredEmail) && matchedUsers.length == 0) {
    return [];
  }

  return Array.from(
    new Set(
      (
        await Promise.all(
          matchedUsers.map(async loggedInUser => {
            return await getSsoGroupIdsForUser({
              userId: loggedInUser.user.id,
              appId: d.appId
            });
          })
        )
      ).flat()
    )
  ).sort();
};

export let getEffectiveConsumerGroups = async (d: {
  consumerProfile: ConsumerProfile;
  ssoGroupIds?: string[];
}) => {
  let ssoGroupIds = d.ssoGroupIds ?? [];
  let groups = await db.consumerGroup.findMany({
    where: {
      surfaceOid: d.consumerProfile.surfaceOid,
      status: 'active',
      OR: [
        {
          oid: d.consumerProfile.personalConsumerGroupOid
        },
        {
          isDefault: true
        },
        {
          profiles: {
            some: {
              profileOid: d.consumerProfile.oid
            }
          }
        },
        ssoGroupIds.length
          ? {
              ssoGroupIds: {
                hasSome: ssoGroupIds
              }
            }
          : undefined!
      ].filter(Boolean)
    }
  });

  return groups.map(group => {
    if (group.oid == d.consumerProfile.personalConsumerGroupOid) {
      return {
        ...group,
        assignedVia: 'user' as const
      };
    }

    if (group.isDefault) {
      return {
        ...group,
        assignedVia: 'default' as const
      };
    }

    if (ssoGroupIds.some(ssoGroupId => group.ssoGroupIds.includes(ssoGroupId))) {
      return {
        ...group,
        assignedVia: 'sso' as const
      };
    }

    return {
      ...group,
      assignedVia: 'manual' as const
    };
  });
};

export let getConsumerAccessContextForSession = async (d: {
  session: ConsumerSessionWithProfile;
}): Promise<ConsumerAccessContext> => {
  let ssoGroupIds =
    d.session.aresSessionId && d.session.consumerProfile.surface.aresAppId
      ? await getSsoGroupIdsForSession({
          sessionId: d.session.aresSessionId,
          preferredAresUserId: d.session.consumerProfile.aresUserId ?? undefined,
          preferredEmail: d.session.consumerProfile.email,
          appId: d.session.consumerProfile.surface.aresAppId
        })
      : [];

  let consumerGroups = await getEffectiveConsumerGroups({
    consumerProfile: d.session.consumerProfile,
    ssoGroupIds
  });

  return {
    ssoGroupIds,
    consumerGroups,
    accessTags: [
      d.session.consumerProfile.accessTagOid,
      ...consumerGroups.map(group => group.accessTagOid)
    ]
  };
};

export let getConsumerToken = async (d: {
  session: Pick<ConsumerSessionWithProfile, 'id' | 'tokenNonce' | 'expiresAt'>;
  surface: Pick<ConsumerSurface, 'id'>;
}) => {
  return await consumerTokens.sign({
    type: 'consumer_token',
    data: {
      surfaceId: d.surface.id,
      sessionId: d.session.id,
      nonce: d.session.tokenNonce
    },
    expiresAt: d.session.expiresAt
  });
};

export let getConsumerSessionToken = async (d: {
  session: Pick<ConsumerSessionWithProfile, 'id' | 'tokenNonce' | 'expiresAt'>;
  surface: Pick<ConsumerSurface, 'id'>;
}) => {
  return await consumerTokens.sign({
    type: 'consumer_session',
    data: {
      surfaceId: d.surface.id,
      sessionId: d.session.id,
      nonce: d.session.tokenNonce
    },
    expiresAt: d.session.expiresAt
  });
};

export let authenticateWithConsumerToken = async (d: {
  token: string;
  organizationOid: bigint;
}) => {
  let payload = await consumerTokens.verify({
    token: d.token,
    expectedType: 'consumer_token'
  });
  if (!payload.verified) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Invalid consumer token.'
      })
    );
  }

  let session = await db.consumerSession.findFirst({
    where: {
      id: payload.data.sessionId,
      tokenNonce: payload.data.nonce,
      revokedAt: null,
      expiresAt: {
        gt: new Date()
      },
      consumerProfile: {
        organizationOid: d.organizationOid,
        surface: {
          id: payload.data.surfaceId,
          status: 'active'
        }
      }
    },
    include: consumerSessionInclude
  });
  if (!session) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Invalid consumer token.'
      })
    );
  }

  await db.consumerSession.update({
    where: {
      oid: session.oid
    },
    data: {
      lastUsedAt: new Date()
    }
  });

  let ssoGroupIds =
    session.aresSessionId && session.consumerProfile.surface.aresAppId
      ? await getSsoGroupIdsForSession({
          sessionId: session.aresSessionId,
          preferredAresUserId: session.consumerProfile.aresUserId ?? undefined,
          preferredEmail: session.consumerProfile.email,
          appId: session.consumerProfile.surface.aresAppId
        })
      : [];

  return {
    session,
    consumerProfile: session.consumerProfile,
    surface: session.consumerProfile.surface,
    ssoGroupIds
  };
};

export let authenticateWithConsumerSessionToken = async (d: {
  token: string;
  surfaceOid: bigint;
}) => {
  let payload = await consumerTokens.verify({
    token: d.token,
    expectedType: 'consumer_session'
  });
  if (!payload.verified) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Invalid consumer session token.'
      })
    );
  }

  let session = await db.consumerSession.findFirst({
    where: {
      id: payload.data.sessionId,
      tokenNonce: payload.data.nonce,
      revokedAt: null,
      expiresAt: {
        gt: new Date()
      },
      consumerProfile: {
        surfaceOid: d.surfaceOid,
        surface: {
          status: 'active'
        }
      }
    },
    include: consumerSessionInclude
  });
  if (!session) {
    throw new ServiceError(
      unauthorizedError({
        message: 'Invalid consumer session token.'
      })
    );
  }

  return session;
};
