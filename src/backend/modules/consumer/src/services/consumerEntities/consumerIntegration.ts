import { ServiceError, preconditionFailedError } from '@mtsrc/error';
import { Service } from '@mtsrc/service';
import {
  ConsumerAuthAttempt,
  ConsumerIntegration,
  ConsumerProfile,
  ID,
  MagicMcpEndpoint,
  MagicMcpServer,
  MagicMcpSession,
  MagicMcpToken,
  Prisma,
  db,
  withTransaction
} from '@metorial/db';

type ConsumerOwnership = Pick<ConsumerProfile, 'oid' | 'instanceOid' | 'consumerOid'>;
type ConsumerOwnedMagicMcpTarget =
  | {
      type: 'server';
      target: Pick<MagicMcpServer, 'oid' | 'instanceOid'>;
    }
  | {
      type: 'endpoint';
      target: Pick<MagicMcpEndpoint, 'oid' | 'instanceOid' | 'consumerProfileOid'> & {
        servers: Array<{
          magicMcpServerOid: bigint;
          magicMcpServer: Pick<MagicMcpServer, 'oid' | 'instanceOid'>;
        }>;
      };
    };

let consumerTokenInclude = {
  consumerProfile: true,
  magicMcpToken: true
} satisfies Prisma.ConsumerTokenInclude;

let consumerTokenForMagicMcpInclude = {
  consumerProfile: true,
  magicMcpToken: {
    include: {
      consumerAuthAttempts: {
        orderBy: {
          updatedAt: 'desc'
        },
        take: 1,
        select: {
          consumerAuthClient: {
            select: {
              id: true,
              name: true,
              consumerAuthClientSurfaces: {
                take: 1,
                select: {
                  consumerClient: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
} satisfies Prisma.ConsumerTokenInclude;

let consumerIntegrationInclude = {
  magicMcpServer: true
} satisfies Prisma.ConsumerIntegrationInclude;

let consumerIntegrationEndpointInclude = {
  magicMcpEndpoint: {
    include: {
      servers: {
        include: {
          magicMcpServer: true
        }
      }
    }
  }
} satisfies Prisma.ConsumerIntegrationEndpointInclude;

let consumerIntegrationSessionInclude = {
  consumerIntegration: {
    include: consumerIntegrationInclude
  },
  magicMcpSession: true
} satisfies Prisma.ConsumerIntegrationSessionInclude;

type ConsumerIntegrationWithRelations = Prisma.ConsumerIntegrationGetPayload<{
  include: typeof consumerIntegrationInclude;
}>;

let isConsumerIntegrationDuplicateError = (error: unknown) => {
  let err = error as {
    code?: string;
    meta?: { target?: string[] | string };
    message?: string;
  };
  if (err.code !== 'P2002') return false;

  let target = Array.isArray(err.meta?.target) ? err.meta.target.join(',') : err.meta?.target;
  return (
    (target?.includes('consumerProfileOid') || err.message?.includes('consumerProfileOid')) &&
    (target?.includes('magicMcpServerOid') || err.message?.includes('magicMcpServerOid'))
  );
};

let assertMagicResourceOwnership = <
  T extends {
    instanceOid: bigint;
  }
>(d: {
  consumerProfile: ConsumerOwnership;
  resource: T;
  resourceType: 'token' | 'server' | 'endpoint' | 'session';
}) => {
  if (d.consumerProfile.instanceOid !== d.resource.instanceOid) {
    throw new ServiceError(
      preconditionFailedError({
        message: `The consumer profile and magic MCP ${d.resourceType} must belong to the same instance.`
      })
    );
  }
};

let assertConsumerIntegrationOwnership = (d: {
  consumerProfile: ConsumerOwnership;
  consumerIntegration: Pick<
    ConsumerIntegration,
    'instanceOid' | 'consumerOid' | 'consumerProfileOid'
  >;
}) => {
  if (
    d.consumerIntegration.instanceOid !== d.consumerProfile.instanceOid ||
    d.consumerIntegration.consumerOid !== d.consumerProfile.consumerOid ||
    d.consumerIntegration.consumerProfileOid !== d.consumerProfile.oid
  ) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'The consumer integration does not belong to the provided consumer profile.'
      })
    );
  }
};

class ConsumerIntegrationServiceImpl {
  async findConsumerTokenByMagicMcpToken(d: { magicMcpToken: Pick<MagicMcpToken, 'oid'> }) {
    return await db.consumerToken.findFirst({
      where: {
        magicMcpTokenOid: d.magicMcpToken.oid
      },
      include: consumerTokenForMagicMcpInclude
    });
  }

  async upsertConsumerToken(d: {
    consumerProfile: ConsumerOwnership;
    magicMcpToken: Pick<MagicMcpToken, 'oid' | 'instanceOid'>;
  }) {
    assertMagicResourceOwnership({
      consumerProfile: d.consumerProfile,
      resource: d.magicMcpToken,
      resourceType: 'token'
    });

    return await db.consumerToken.upsert({
      where: {
        consumerProfileOid_magicMcpTokenOid: {
          consumerProfileOid: d.consumerProfile.oid,
          magicMcpTokenOid: d.magicMcpToken.oid
        }
      },
      create: {
        id: await ID.generateId('consumerToken'),
        instanceOid: d.consumerProfile.instanceOid,
        consumerOid: d.consumerProfile.consumerOid,
        consumerProfileOid: d.consumerProfile.oid,
        magicMcpTokenOid: d.magicMcpToken.oid
      },
      update: {
        instanceOid: d.consumerProfile.instanceOid,
        consumerOid: d.consumerProfile.consumerOid
      },
      include: consumerTokenInclude
    });
  }

  async upsertConsumerIntegration(d: {
    consumerProfile: ConsumerOwnership;
    magicMcpServer: Pick<MagicMcpServer, 'oid' | 'instanceOid'>;
    isManaged: boolean;
  }) {
    assertMagicResourceOwnership({
      consumerProfile: d.consumerProfile,
      resource: d.magicMcpServer,
      resourceType: 'server'
    });

    let where = {
      consumerProfileOid_magicMcpServerOid: {
        consumerProfileOid: d.consumerProfile.oid,
        magicMcpServerOid: d.magicMcpServer.oid
      }
    };
    let update = {
      instanceOid: d.consumerProfile.instanceOid,
      consumerOid: d.consumerProfile.consumerOid,
      isManaged: d.isManaged ? undefined : false
    };

    try {
      return await db.consumerIntegration.upsert({
        where,
        create: {
          id: await ID.generateId('consumerIntegration'),
          instanceOid: d.consumerProfile.instanceOid,
          consumerOid: d.consumerProfile.consumerOid,
          consumerProfileOid: d.consumerProfile.oid,
          magicMcpServerOid: d.magicMcpServer.oid,
          isManaged: d.isManaged
        },
        update,
        include: consumerIntegrationInclude
      });
    } catch (error) {
      if (!isConsumerIntegrationDuplicateError(error)) throw error;

      return await db.consumerIntegration.update({
        where,
        data: update,
        include: consumerIntegrationInclude
      });
    }
  }

  async upsertConsumerIntegrationEndpoint(d: {
    consumerProfile: ConsumerOwnership;
    magicMcpEndpoint: Pick<MagicMcpEndpoint, 'oid' | 'instanceOid'>;
    isManaged: boolean;
  }) {
    assertMagicResourceOwnership({
      consumerProfile: d.consumerProfile,
      resource: d.magicMcpEndpoint,
      resourceType: 'endpoint'
    });

    return await db.consumerIntegrationEndpoint.upsert({
      where: {
        consumerProfileOid_magicMcpEndpointOid: {
          consumerProfileOid: d.consumerProfile.oid,
          magicMcpEndpointOid: d.magicMcpEndpoint.oid
        }
      },
      create: {
        id: await ID.generateId('consumerIntegrationEndpoint'),
        instanceOid: d.consumerProfile.instanceOid,
        consumerOid: d.consumerProfile.consumerOid,
        consumerProfileOid: d.consumerProfile.oid,
        magicMcpEndpointOid: d.magicMcpEndpoint.oid,
        isManaged: d.isManaged
      },
      update: {
        instanceOid: d.consumerProfile.instanceOid,
        consumerOid: d.consumerProfile.consumerOid,
        isManaged: d.isManaged ? undefined : false
      },
      include: consumerIntegrationEndpointInclude
    });
  }

  async linkConsumerAuthAttemptToConsumerIntegrationEndpoint(d: {
    consumerAuthAttempt: Pick<ConsumerAuthAttempt, 'oid'>;
    consumerProfile: ConsumerOwnership;
    magicMcpEndpoint: Pick<MagicMcpEndpoint, 'oid' | 'instanceOid'>;
    isManaged: boolean;
  }) {
    let consumerIntegrationEndpoint = await this.upsertConsumerIntegrationEndpoint({
      consumerProfile: d.consumerProfile,
      magicMcpEndpoint: d.magicMcpEndpoint,
      isManaged: d.isManaged
    });

    await db.consumerAuthAttempt.updateMany({
      where: {
        oid: d.consumerAuthAttempt.oid
      },
      data: {
        consumerIntegrationEndpointOid: consumerIntegrationEndpoint.oid
      }
    });

    return consumerIntegrationEndpoint;
  }

  async upsertConsumerIntegrationSession(d: {
    consumerProfile: ConsumerOwnership;
    consumerIntegration: Pick<
      ConsumerIntegration,
      'oid' | 'instanceOid' | 'consumerOid' | 'consumerProfileOid'
    >;
    magicMcpSession: Pick<MagicMcpSession, 'oid' | 'instanceOid'>;
  }) {
    assertConsumerIntegrationOwnership({
      consumerProfile: d.consumerProfile,
      consumerIntegration: d.consumerIntegration
    });
    assertMagicResourceOwnership({
      consumerProfile: d.consumerProfile,
      resource: d.magicMcpSession,
      resourceType: 'session'
    });

    return await db.consumerIntegrationSession.upsert({
      where: {
        consumerIntegrationOid_magicMcpSessionOid: {
          consumerIntegrationOid: d.consumerIntegration.oid,
          magicMcpSessionOid: d.magicMcpSession.oid
        }
      },
      create: {
        id: await ID.generateId('consumerIntegrationSession'),
        instanceOid: d.consumerProfile.instanceOid,
        consumerOid: d.consumerProfile.consumerOid,
        consumerProfileOid: d.consumerProfile.oid,
        consumerIntegrationOid: d.consumerIntegration.oid,
        magicMcpSessionOid: d.magicMcpSession.oid
      },
      update: {
        instanceOid: d.consumerProfile.instanceOid,
        consumerOid: d.consumerProfile.consumerOid,
        consumerProfileOid: d.consumerProfile.oid
      },
      include: consumerIntegrationSessionInclude
    });
  }

  async materializeMagicMcpSessionOwnership(d: {
    consumerProfile: ConsumerOwnership;
    magicMcpTarget: ConsumerOwnedMagicMcpTarget;
    magicMcpSession: Pick<MagicMcpSession, 'oid' | 'instanceOid'>;
  }) {
    return await withTransaction(async () => {
      if (d.magicMcpTarget.type === 'server') {
        let consumerIntegration = await this.upsertConsumerIntegration({
          consumerProfile: d.consumerProfile,
          magicMcpServer: d.magicMcpTarget.target,
          isManaged: true
        });

        let session = await this.upsertConsumerIntegrationSession({
          consumerProfile: d.consumerProfile,
          consumerIntegration,
          magicMcpSession: d.magicMcpSession
        });

        return {
          consumerIntegrationEndpoints: [],
          consumerIntegrations: [consumerIntegration],
          consumerIntegrationSessions: [session]
        };
      }

      let consumerIntegrationEndpoint = await this.upsertConsumerIntegrationEndpoint({
        consumerProfile: d.consumerProfile,
        magicMcpEndpoint: d.magicMcpTarget.target,
        isManaged: d.magicMcpTarget.target.consumerProfileOid !== d.consumerProfile.oid
      });
      let seenServerOids = new Set<bigint>();
      let consumerIntegrations: ConsumerIntegrationWithRelations[] = [];

      for (let server of d.magicMcpTarget.target.servers) {
        if (seenServerOids.has(server.magicMcpServerOid)) {
          continue;
        }

        seenServerOids.add(server.magicMcpServerOid);
        consumerIntegrations.push(
          await this.upsertConsumerIntegration({
            consumerProfile: d.consumerProfile,
            magicMcpServer: server.magicMcpServer,
            isManaged: true
          })
        );
      }

      let consumerIntegrationSessions = [];
      for (let consumerIntegration of consumerIntegrations) {
        consumerIntegrationSessions.push(
          await this.upsertConsumerIntegrationSession({
            consumerProfile: d.consumerProfile,
            consumerIntegration,
            magicMcpSession: d.magicMcpSession
          })
        );
      }

      return {
        consumerIntegrationEndpoints: [consumerIntegrationEndpoint],
        consumerIntegrations,
        consumerIntegrationSessions
      };
    });
  }

  async markMagicMcpResourcesConsumerReconciled(d: {
    magicMcpToken?: Pick<MagicMcpToken, 'oid'> | null;
    magicMcpServer?: Pick<MagicMcpServer, 'oid'> | null;
    magicMcpEndpoint?: Pick<MagicMcpEndpoint, 'oid'> | null;
    magicMcpSession?: Pick<MagicMcpSession, 'oid'> | null;
    magicMcpServers?: Array<Pick<MagicMcpServer, 'oid'>>;
  }) {
    let magicMcpServerOids = Array.from(
      new Set([
        ...(d.magicMcpServer ? [d.magicMcpServer.oid] : []),
        ...(d.magicMcpServers?.map(server => server.oid) ?? [])
      ])
    );

    await withTransaction(async tx => {
      if (d.magicMcpToken) {
        await tx.magicMcpToken.updateMany({
          where: {
            oid: d.magicMcpToken.oid
          },
          data: {
            isConsumerReconciled: true
          }
        });
      }

      if (magicMcpServerOids.length) {
        await tx.magicMcpServer.updateMany({
          where: {
            oid: {
              in: magicMcpServerOids
            }
          },
          data: {
            isConsumerReconciled: true
          }
        });
      }

      if (d.magicMcpEndpoint) {
        await tx.magicMcpEndpoint.updateMany({
          where: {
            oid: d.magicMcpEndpoint.oid
          },
          data: {
            isConsumerReconciled: true
          }
        });
      }

      if (d.magicMcpSession) {
        await tx.magicMcpSession.updateMany({
          where: {
            oid: d.magicMcpSession.oid
          },
          data: {
            isConsumerReconciled: true
          }
        });
      }
    });
  }
}

export let consumerIntegrationService = Service.create(
  'consumerIntegrationService',
  () => new ConsumerIntegrationServiceImpl()
).build();
