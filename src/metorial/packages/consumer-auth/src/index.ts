import { preconditionFailedError, ServiceError, unauthorizedError } from '@lowerdeck/error';
import { Tokens } from '@lowerdeck/tokens';
import { createAresInternalClient } from '@metorial-platform-systems/ares-client';
import { getConfig } from '@metorial/config';
import {
  ConsumerGroup,
  ConsumerProfile,
  ConsumerSurface,
  db,
  Organization,
  type Prisma
} from '@metorial/db';

let tokenSecret = `${getConfig().encryptionSecret}:consumer`;
let consumerTokens = new Tokens({
  secret: tokenSecret
});

export let consumerSessionInclude = {
  consumerProfile: {
    include: {
      consumer: true,
      resourceActors: true,
      surface: {
        include: {
          portal: true
        }
      }
    }
  }
} as const;

export type ConsumerSessionWithProfile = Prisma.ConsumerSessionGetPayload<{
  include: typeof consumerSessionInclude;
}>;
export type ConsumerProfileFull = ConsumerSessionWithProfile['consumerProfile'];

export type ConsumerTokenSession = Pick<
  ConsumerSessionWithProfile,
  'id' | 'tokenNonce' | 'expiresAt'
>;

export type EffectiveConsumerGroup = ConsumerGroup & {
  assignedVia: 'default' | 'manual' | 'sso' | 'user';
};

export type ConsumerAccessContext = {
  ssoGroupIds: string[];
  consumerGroups: EffectiveConsumerGroup[];
  accessTags: bigint[];
};

export type SsoMembership = {
  groupIds: string[];
  roles: string[];
};

export let normalizeStringList = (values?: string[]) =>
  Array.from(new Set(values ?? [])).sort();

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

export let getSsoMembershipForUser = async (d: {
  userId: string;
  appId: string;
}): Promise<SsoMembership> => {
  let ares = getConsumerAresInternalClient();
  let identities = await ares.user.listIdentities({
    userId: d.userId
  });
  let allowedTenantIds = new Set(
    (await ares.sso.listTenants({ appId: d.appId, limit: 100 })).items.map(tenant => tenant.id)
  );
  let scopedProfiles = identities
    .filter(identity => {
      let ssoTenantId = identity.provider.ssoTenant?.id;
      return !!ssoTenantId && allowedTenantIds.has(ssoTenantId);
    })
    .map(identity => identity.ssoProfile)
    .filter(profile => !!profile);

  return {
    groupIds: normalizeStringList(scopedProfiles.flatMap(profile => profile.groups)),
    roles: normalizeStringList(scopedProfiles.flatMap(profile => profile.roles))
  };
};

export let getSsoGroupIdsForUser = async (d: { userId: string; appId: string }) => {
  return (await getSsoMembershipForUser(d)).groupIds;
};

// Kept for a possible future session-based resync path. The current flow mirrors Ares
// group and role membership onto ConsumerProfile when an Ares-backed session is created.
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
          loggedInUser =>
            loggedInUser.user.email.toLowerCase() == d.preferredEmail!.toLowerCase()
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
  let ssoGroupIds = d.ssoGroupIds ?? d.consumerProfile.ssoGroupIds ?? [];
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

let getConsumerAccessContextForConsumerProfileSingle = async (d: {
  profile: ConsumerProfileFull;
}): Promise<ConsumerAccessContext> => {
  let ssoGroupIds = d.profile.ssoGroupIds ?? [];

  let consumerGroups = await getEffectiveConsumerGroups({
    consumerProfile: d.profile,
    ssoGroupIds
  });

  return {
    ssoGroupIds,
    consumerGroups,
    accessTags: [d.profile.accessTagOid, ...consumerGroups.map(group => group.accessTagOid)]
  };
};

export let getConsumerAccessContextForConsumerProfile = async (d: {
  profile: ConsumerProfileFull;
}): Promise<ConsumerAccessContext> => {
  if (
    d.profile.surface.isInternal &&
    d.profile.surface.internalSurfaceUniqueIdentifier === 'cli'
  ) {
    let allProfiles = await db.consumerProfile.findMany({
      where: {
        instanceOid: d.profile.instanceOid,
        consumerOid: d.profile.consumerOid
      },
      include: consumerSessionInclude.consumerProfile.include
    });

    let all = await Promise.all(
      allProfiles.map(profile =>
        getConsumerAccessContextForConsumerProfileSingle({
          profile
        })
      )
    );

    return {
      ssoGroupIds: all.flatMap(a => a.ssoGroupIds),
      consumerGroups: all.flatMap(a => a.consumerGroups),
      accessTags: all.flatMap(a => a.accessTags)
    };
  }

  return await getConsumerAccessContextForConsumerProfileSingle(d);
};

export let getConsumerAccessContextForSession = async (d: {
  session: ConsumerSessionWithProfile;
}): Promise<ConsumerAccessContext> => {
  return await getConsumerAccessContextForConsumerProfile({
    profile: d.session.consumerProfile
  });
};

export let getConsumerToken = async (d: {
  session: ConsumerTokenSession;
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
  session: ConsumerTokenSession;
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
  organization: Pick<Organization, 'oid'>;
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
      expiresAt: {
        gt: new Date()
      },
      loggedOutAt: null,
      consumerProfile: {
        organizationOid: d.organization.oid,
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

  let ssoGroupIds = session.consumerProfile.ssoGroupIds ?? [];

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
      loggedOutAt: null,
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
