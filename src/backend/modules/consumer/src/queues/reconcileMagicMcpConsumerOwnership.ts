import { createCron } from '@metorial/cron';
import { MagicMcpEndpoint, MagicMcpSession, db } from '@metorial/db';
import { combineQueueProcessors, createQueue } from '@metorial/queue';
import { consumerIntegrationService } from '../services/consumerIntegration';

let BATCH_SIZE = 100;
let magicMcpConsumerOwnershipResourceTypes = [
  'token',
  'server',
  'endpoint',
  'session'
] as const;

type MagicMcpConsumerOwnershipResourceType =
  (typeof magicMcpConsumerOwnershipResourceTypes)[number];

let getUniqueConsumerProfile = async (d: { consumerProfileOids: bigint[] }) => {
  let consumerProfileOids = Array.from(new Set(d.consumerProfileOids));
  if (consumerProfileOids.length !== 1) {
    return null;
  }

  return await db.consumerProfile.findUnique({
    where: {
      oid: consumerProfileOids[0]
    },
    select: {
      oid: true,
      instanceOid: true,
      consumerOid: true
    }
  });
};

let getTokenOwnerFromConsumerAuthAttempt = async (d: { magicMcpTokenOid: bigint }) => {
  let consumerProfiles = await db.consumerAuthAttempt.findMany({
    where: {
      magicMcpTokenOid: d.magicMcpTokenOid,
      consumerProfileOid: {
        not: null
      }
    },
    select: {
      consumerProfileOid: true
    },
    distinct: ['consumerProfileOid']
  });

  return await getUniqueConsumerProfile({
    consumerProfileOids: consumerProfiles.flatMap(attempt =>
      attempt.consumerProfileOid ? [attempt.consumerProfileOid] : []
    )
  });
};

let getTokenOwnerFromPersonalGroupAccess = async (d: { magicMcpTokenOid: bigint }) => {
  let consumerProfiles = await db.consumerProfile.findMany({
    where: {
      personalConsumerGroup: {
        accessTag: {
          accessTagEntities: {
            some: {
              magicMcpTokenOid: d.magicMcpTokenOid
            }
          }
        }
      }
    },
    select: {
      oid: true,
      instanceOid: true,
      consumerOid: true
    }
  });

  if (consumerProfiles.length !== 1) {
    return null;
  }

  return consumerProfiles[0]!;
};

let reconcileMagicMcpToken = async (d: { resourceId: string }) => {
  let magicMcpToken = await db.magicMcpToken.findUnique({
    where: {
      id: d.resourceId
    },
    select: {
      oid: true,
      instanceOid: true
    }
  });
  if (!magicMcpToken) return;

  let consumerProfile =
    (await getTokenOwnerFromConsumerAuthAttempt({
      magicMcpTokenOid: magicMcpToken.oid
    })) ??
    (await getTokenOwnerFromPersonalGroupAccess({
      magicMcpTokenOid: magicMcpToken.oid
    }));

  if (consumerProfile) {
    await consumerIntegrationService.upsertConsumerToken({
      consumerProfile,
      magicMcpToken
    });
  }

  await consumerIntegrationService.markMagicMcpResourcesConsumerReconciled({
    magicMcpToken
  });
};

let getServerOwnerFromPersonalGroupAccess = async (d: { magicMcpServerOid: bigint }) => {
  let consumerProfiles = await db.consumerProfile.findMany({
    where: {
      personalConsumerGroup: {
        consumerAccesses: {
          some: {
            magicMcpServerOid: d.magicMcpServerOid
          }
        }
      }
    },
    select: {
      oid: true,
      instanceOid: true,
      consumerOid: true
    }
  });

  if (consumerProfiles.length !== 1) {
    return null;
  }

  return consumerProfiles[0]!;
};

let reconcileMagicMcpServer = async (d: { resourceId: string }) => {
  let magicMcpServer = await db.magicMcpServer.findUnique({
    where: {
      id: d.resourceId
    },
    select: {
      oid: true,
      instanceOid: true
    }
  });
  if (!magicMcpServer) return;

  let consumerProfile = await getServerOwnerFromPersonalGroupAccess({
    magicMcpServerOid: magicMcpServer.oid
  });

  if (consumerProfile) {
    await consumerIntegrationService.upsertConsumerIntegration({
      consumerProfile,
      magicMcpServer,
      isManaged: false
    });
  }

  await consumerIntegrationService.markMagicMcpResourcesConsumerReconciled({
    magicMcpServer
  });
};

let reconcileMagicMcpEndpoint = async (d: { resourceId: string }) => {
  let magicMcpEndpoint = await db.magicMcpEndpoint.findUnique({
    where: {
      id: d.resourceId
    },
    select: {
      oid: true,
      instanceOid: true,
      consumerProfileOid: true
    }
  });
  if (!magicMcpEndpoint) return;

  if (magicMcpEndpoint.consumerProfileOid) {
    let consumerProfile = await db.consumerProfile.findUnique({
      where: {
        oid: magicMcpEndpoint.consumerProfileOid
      },
      select: {
        oid: true,
        instanceOid: true,
        consumerOid: true
      }
    });

    if (consumerProfile) {
      await consumerIntegrationService.upsertConsumerIntegrationEndpoint({
        consumerProfile,
        magicMcpEndpoint,
        isManaged: false
      });
    }
  }

  await reconcileConsumerAuthAttemptsForMagicMcpEndpoint({
    magicMcpEndpoint
  });

  await consumerIntegrationService.markMagicMcpResourcesConsumerReconciled({
    magicMcpEndpoint
  });
};

let reconcileConsumerAuthAttemptsForMagicMcpEndpoint = async (d: {
  magicMcpEndpoint: Pick<MagicMcpEndpoint, 'oid' | 'instanceOid' | 'consumerProfileOid'>;
}) => {
  let consumerAuthAttempts = await db.consumerAuthAttempt.findMany({
    where: {
      consumerIntegrationEndpointOid: null,
      consumerProfileOid: {
        not: null
      },
      OR: [
        {
          magicMcpEndpointOid: d.magicMcpEndpoint.oid
        },
        {
          magicMcpEndpointOid: null,
          consumerAuthClient: {
            magicMcpEndpointOid: d.magicMcpEndpoint.oid
          }
        }
      ]
    },
    select: {
      oid: true,
      consumerProfile: {
        select: {
          oid: true,
          instanceOid: true,
          consumerOid: true
        }
      }
    }
  });

  for (let consumerAuthAttempt of consumerAuthAttempts) {
    if (!consumerAuthAttempt.consumerProfile) {
      continue;
    }

    await consumerIntegrationService.linkConsumerAuthAttemptToConsumerIntegrationEndpoint({
      consumerAuthAttempt,
      consumerProfile: consumerAuthAttempt.consumerProfile,
      magicMcpEndpoint: d.magicMcpEndpoint,
      isManaged:
        d.magicMcpEndpoint.consumerProfileOid !== consumerAuthAttempt.consumerProfile.oid
    });
  }
};

let getSessionOwner = async (d: {
  magicMcpSession: Pick<MagicMcpSession, 'magicMcpServerOid' | 'magicMcpEndpointOid'>;
}) => {
  if (d.magicMcpSession.magicMcpServerOid) {
    let consumerTokens = await db.consumerToken.findMany({
      where: {
        magicMcpToken: {
          magicMcpServerOid: d.magicMcpSession.magicMcpServerOid
        }
      },
      select: {
        consumerProfileOid: true
      },
      distinct: ['consumerProfileOid']
    });

    return await getUniqueConsumerProfile({
      consumerProfileOids: consumerTokens.map(
        consumerToken => consumerToken.consumerProfileOid
      )
    });
  }

  if (d.magicMcpSession.magicMcpEndpointOid) {
    let consumerTokens = await db.consumerToken.findMany({
      where: {
        magicMcpToken: {
          magicMcpEndpointOid: d.magicMcpSession.magicMcpEndpointOid
        }
      },
      select: {
        consumerProfileOid: true
      },
      distinct: ['consumerProfileOid']
    });

    return await getUniqueConsumerProfile({
      consumerProfileOids: consumerTokens.map(
        consumerToken => consumerToken.consumerProfileOid
      )
    });
  }

  return null;
};

let reconcileMagicMcpSession = async (d: { resourceId: string }) => {
  let magicMcpSession = await db.magicMcpSession.findUnique({
    where: {
      id: d.resourceId
    },
    include: {
      magicMcpServer: true,
      magicMcpEndpoint: {
        include: {
          servers: {
            include: {
              magicMcpServer: true
            }
          }
        }
      }
    }
  });
  if (!magicMcpSession) return;

  let consumerProfile = await getSessionOwner({
    magicMcpSession
  });

  if (consumerProfile && magicMcpSession.magicMcpServer) {
    let consumerIntegration = await consumerIntegrationService.upsertConsumerIntegration({
      consumerProfile,
      magicMcpServer: magicMcpSession.magicMcpServer,
      isManaged: true
    });

    await consumerIntegrationService.upsertConsumerIntegrationSession({
      consumerProfile,
      consumerIntegration,
      magicMcpSession
    });
  }

  if (consumerProfile && magicMcpSession.magicMcpEndpoint) {
    await consumerIntegrationService.materializeMagicMcpSessionOwnership({
      consumerProfile,
      magicMcpTarget: {
        type: 'endpoint',
        target: magicMcpSession.magicMcpEndpoint
      },
      magicMcpSession
    });
  }

  await consumerIntegrationService.markMagicMcpResourcesConsumerReconciled({
    magicMcpSession
  });
};

export let reconcileMagicMcpConsumerOwnershipCron = createCron(
  {
    name: 'cons/magic/reconcile/cron',
    cron: process.env.NODE_ENV === 'production' ? '0 * * * *' : '* * * * *'
  },
  async () => {
    await reconcileMagicMcpConsumerOwnershipManyQueue.addMany(
      magicMcpConsumerOwnershipResourceTypes.map(resourceType => ({
        resourceType
      }))
    );
  }
);

export let reconcileMagicMcpConsumerOwnershipManyQueue = createQueue<{
  resourceType: MagicMcpConsumerOwnershipResourceType;
  cursor?: string;
}>({
  name: 'cons/magic/reconcile/many'
});

export let reconcileMagicMcpConsumerOwnershipManyQueueProcessor =
  reconcileMagicMcpConsumerOwnershipManyQueue.process(async data => {
    let items =
      data.resourceType === 'token'
        ? await db.magicMcpToken.findMany({
            where: {
              isConsumerReconciled: false,
              id: data.cursor ? { gt: data.cursor } : undefined
            },
            select: { id: true },
            take: BATCH_SIZE,
            orderBy: { id: 'asc' }
          })
        : data.resourceType === 'server'
          ? await db.magicMcpServer.findMany({
              where: {
                isConsumerReconciled: false,
                id: data.cursor ? { gt: data.cursor } : undefined
              },
              select: { id: true },
              take: BATCH_SIZE,
              orderBy: { id: 'asc' }
            })
          : data.resourceType === 'endpoint'
            ? await db.magicMcpEndpoint.findMany({
                where: {
                  isConsumerReconciled: false,
                  id: data.cursor ? { gt: data.cursor } : undefined
                },
                select: { id: true },
                take: BATCH_SIZE,
                orderBy: { id: 'asc' }
              })
            : await db.magicMcpSession.findMany({
                where: {
                  isConsumerReconciled: false,
                  id: data.cursor ? { gt: data.cursor } : undefined
                },
                select: { id: true },
                take: BATCH_SIZE,
                orderBy: { id: 'asc' }
              });

    if (items.length === 0) return;

    await reconcileMagicMcpConsumerOwnershipSingleQueue.addMany(
      items.map(item => ({
        resourceType: data.resourceType,
        resourceId: item.id
      }))
    );

    await reconcileMagicMcpConsumerOwnershipManyQueue.add({
      resourceType: data.resourceType,
      cursor: items[items.length - 1]!.id
    });
  });

export let reconcileMagicMcpConsumerOwnershipSingleQueue = createQueue<{
  resourceType: MagicMcpConsumerOwnershipResourceType;
  resourceId: string;
}>({
  name: 'cons/magic/reconcile/single',
  workerOpts: {
    concurrency: 5
  }
});

export let reconcileMagicMcpConsumerOwnershipSingleQueueProcessor =
  reconcileMagicMcpConsumerOwnershipSingleQueue.process(async data => {
    if (data.resourceType === 'token') {
      await reconcileMagicMcpToken({
        resourceId: data.resourceId
      });
      return;
    }

    if (data.resourceType === 'server') {
      await reconcileMagicMcpServer({
        resourceId: data.resourceId
      });
      return;
    }

    if (data.resourceType === 'endpoint') {
      await reconcileMagicMcpEndpoint({
        resourceId: data.resourceId
      });
      return;
    }

    await reconcileMagicMcpSession({
      resourceId: data.resourceId
    });
  });

export let reconcileMagicMcpConsumerOwnershipProcessors = combineQueueProcessors([
  reconcileMagicMcpConsumerOwnershipCron,
  reconcileMagicMcpConsumerOwnershipManyQueueProcessor,
  reconcileMagicMcpConsumerOwnershipSingleQueueProcessor
]);
