import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { Context } from '@metorial/context';
import {
  ConsumerSurface,
  db,
  ID,
  Instance,
  Organization,
  Prisma,
  withTransaction
} from '@metorial/db';
import { createLock } from '@metorial/lock';
import { apiKeyService } from '@metorial/module-machine-access';
import { organizationActorService } from '@metorial/module-organization';
import { consumerAresService } from './ares';

export let consumerSurfaceInclude = {
  consumerAuthTenant: true,
  publishableApiKey: {
    include: {
      secrets: true
    }
  }
} as const;

export type ConsumerSurfaceWithPublishableApiKey = Prisma.ConsumerSurfaceGetPayload<{
  include: typeof consumerSurfaceInclude;
}>;

export type AresAppConfig = {
  slug: string;
  defaultRedirectUrl: string;
  redirectDomains: string[];
};

let internalCreateLock = createLock({
  name: 'cons/consumer-surface/internal-create'
});

class ConsumerSurfaceServiceImpl {
  async getConsumerSurfaceById(d: { instance: Instance; consumerSurfaceId: string }) {
    let consumerSurface = await db.consumerSurface.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.consumerSurfaceId
      },
      include: consumerSurfaceInclude
    });
    if (!consumerSurface) {
      throw new ServiceError(notFoundError('consumer.surface'));
    }

    return consumerSurface;
  }

  async listConsumerSurfaces(d: { instance: Instance }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.consumerSurface.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid
          },
          include: consumerSurfaceInclude
        });
      })
    );
  }

  private assertConsumerSurfaceIsActive(consumerSurface: ConsumerSurface) {
    if (consumerSurface.status !== 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Consumer surface is already archived or deleted.'
        })
      );
    }
  }

  private async disconnectConsumerSurfaceAres(d: {
    consumerSurface: ConsumerSurface;
    status: 'archived' | 'deleted';
  }) {
    if (!d.consumerSurface.consumerAuthTenantOid) return;

    return await withTransaction(async tx => {
      let consumerAuthTenant = await tx.consumerAuthTenant.findUniqueOrThrow({
        where: {
          oid: d.consumerSurface.consumerAuthTenantOid!
        }
      });

      if (consumerAuthTenant.aresAppId) {
        await consumerAresService.updateApp({
          id: consumerAuthTenant.aresAppId,
          slug: consumerAuthTenant.aresAppSlug
            ? `${consumerAuthTenant.aresAppSlug}-${d.status}-${Date.now()}`
            : undefined,
          redirectDomains: ['invalid.invalid']
        });

        await tx.consumerAuthTenant.update({
          where: {
            oid: consumerAuthTenant.oid
          },
          data: {
            aresAppId: null,
            aresAppSlug: null,
            aresClientId: null
          }
        });
      }
    });
  }

  private async updateConsumerAuthTenantAres(d: {
    consumerSurface: ConsumerSurface;
    aresApp: {
      id: string;
      slug?: string | null;
      clientId: string;
    };
  }) {
    if (!d.consumerSurface.consumerAuthTenantOid) {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Auth is not configured for this portal.'
        })
      );
    }

    return await withTransaction(async tx => {
      return await tx.consumerAuthTenant.update({
        where: {
          oid: d.consumerSurface.consumerAuthTenantOid!
        },
        data: {
          aresAppId: d.aresApp.id,
          aresAppSlug: d.aresApp.slug ?? null,
          aresClientId: d.aresApp.clientId
        }
      });
    });
  }

  private async deactivateConsumerSurfaceResources(d: {
    publishableApiKeyOid: bigint;
    consumerSurfaceOid?: bigint;
  }) {
    return await withTransaction(async tx => {
      let now = new Date();

      if (d.consumerSurfaceOid) {
        await tx.consumerSession.updateMany({
          where: {
            loggedOutAt: null,
            consumerProfile: {
              surfaceOid: d.consumerSurfaceOid
            }
          },
          data: {
            loggedOutAt: now
          }
        });
      }

      let apiKey = await tx.apiKey.findUnique({
        where: {
          oid: d.publishableApiKeyOid
        },
        select: {
          machineAccessOid: true
        }
      });

      await tx.apiKey.update({
        where: {
          oid: d.publishableApiKeyOid
        },
        data: {
          status: 'deleted',
          deletedAt: now
        }
      });

      if (apiKey) {
        await tx.machineAccess.update({
          where: {
            oid: apiKey.machineAccessOid
          },
          data: {
            status: 'deleted',
            deletedAt: now
          }
        });
      }
    });
  }

  async createConsumerSurface(d: {
    organization: Organization;
    instance: Instance;
    context: Context;
    input: {
      name: string;
      description?: string;
      sessionExpiryTimeInSeconds: number;
    };
    internalSurfaceUniqueIdentifier?: string;
  }) {
    let systemActor = await organizationActorService.getSystemActor({
      organization: d.organization
    });
    let { apiKey } = await apiKeyService.createApiKey({
      kind: 'system_internal',
      organization: d.organization,
      instance: d.instance,
      context: d.context,
      type: 'instance_access_token_publishable',
      performedBy: systemActor,
      input: {
        name: `Publishable API Key for Consumer Surface ${d.input.name}`
      }
    });

    try {
      return await withTransaction(async tx => {
        let consumerAuthTenant = await tx.consumerAuthTenant.create({
          data: {
            id: await ID.generateId('consumerAuthTenant'),
            organizationOid: d.organization.oid
          }
        });

        return await tx.consumerSurface.create({
          data: {
            id: await ID.generateId('consumerSurface'),
            status: 'active',
            name: d.input.name,
            description: d.input.description,
            sessionExpiryTimeInSeconds: d.input.sessionExpiryTimeInSeconds,
            organizationOid: d.organization.oid,
            instanceOid: d.instance.oid,
            consumerAuthTenantOid: consumerAuthTenant.oid,
            publishableApiKeyOid: apiKey.oid,
            internalSurfaceUniqueIdentifier: d.internalSurfaceUniqueIdentifier
          },
          include: consumerSurfaceInclude
        });
      });
    } catch (error) {
      await this.deactivateConsumerSurfaceResources({
        publishableApiKeyOid: apiKey.oid
      });

      throw error;
    }
  }

  async ensureInternalConsumerSurface(d: {
    instance: Instance;
    identifier: string;
    name: string;
  }) {
    let consumerSurface = await db.consumerSurface.findUnique({
      where: {
        instanceOid_internalSurfaceUniqueIdentifier: {
          instanceOid: d.instance.oid,
          internalSurfaceUniqueIdentifier: d.identifier
        }
      }
    });
    if (!consumerSurface) {
      return await internalCreateLock.usingLock(d.identifier, async () => {
        let existingSurface = await db.consumerSurface.findUnique({
          where: {
            instanceOid_internalSurfaceUniqueIdentifier: {
              instanceOid: d.instance.oid,
              internalSurfaceUniqueIdentifier: d.identifier
            }
          },
          include: consumerSurfaceInclude
        });
        if (existingSurface) return existingSurface;

        let org = await db.organization.findFirstOrThrow({
          where: { oid: d.instance.organizationOid }
        });

        return await this.createConsumerSurface({
          organization: org,
          instance: d.instance,
          context: { ip: '0.0.0.0', ua: 'Metorial System' },
          input: {
            name: d.name,
            sessionExpiryTimeInSeconds: 3600
          },
          internalSurfaceUniqueIdentifier: d.identifier
        });
      });
    }

    return consumerSurface;
  }

  async configureConsumerSurfaceAres(d: {
    consumerSurface: ConsumerSurface;
    aresApp: AresAppConfig;
  }) {
    if (d.consumerSurface.status !== 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot configure Ares for a non-active consumer surface.'
        })
      );
    }

    let app = await consumerAresService.upsertApp({
      slug: d.aresApp.slug,
      defaultRedirectUrl: d.aresApp.defaultRedirectUrl,
      redirectDomains: d.aresApp.redirectDomains
    });

    return await withTransaction(async tx => {
      let consumerAuthTenant = await this.updateConsumerAuthTenantAres({
        consumerSurface: d.consumerSurface,
        aresApp: {
          id: app.id,
          slug: app.slug ?? d.aresApp.slug,
          clientId: app.clientId
        }
      });

      return await tx.consumerSurface.update({
        where: {
          oid: d.consumerSurface.oid
        },
        data: {
          consumerAuthTenantOid: consumerAuthTenant.oid
        },
        include: consumerSurfaceInclude
      });
    });
  }

  async updateConsumerSurface(d: {
    consumerSurface: ConsumerSurface;
    input: {
      name?: string;
      description?: string;
      sessionExpiryTimeInSeconds?: number;
    };
  }) {
    if (d.consumerSurface.status !== 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot update a non-active consumer surface.'
        })
      );
    }

    return await db.consumerSurface.update({
      where: {
        oid: d.consumerSurface.oid
      },
      data: {
        name: d.input.name,
        description: d.input.description,
        sessionExpiryTimeInSeconds: d.input.sessionExpiryTimeInSeconds
      },
      include: consumerSurfaceInclude
    });
  }

  async archiveConsumerSurface(d: { consumerSurface: ConsumerSurface }) {
    this.assertConsumerSurfaceIsActive(d.consumerSurface);

    let now = new Date();

    await this.disconnectConsumerSurfaceAres({
      consumerSurface: d.consumerSurface,
      status: 'archived'
    });

    await this.deactivateConsumerSurfaceResources({
      publishableApiKeyOid: d.consumerSurface.publishableApiKeyOid,
      consumerSurfaceOid: d.consumerSurface.oid
    });

    return await db.consumerSurface.update({
      where: {
        oid: d.consumerSurface.oid
      },
      data: {
        status: 'archived',
        archivedAt: now,
        deletedAt: null
      },
      include: consumerSurfaceInclude
    });
  }

  async deleteConsumerSurface(d: { consumerSurface: ConsumerSurface }) {
    this.assertConsumerSurfaceIsActive(d.consumerSurface);

    let now = new Date();

    await this.disconnectConsumerSurfaceAres({
      consumerSurface: d.consumerSurface,
      status: 'deleted'
    });

    await this.deactivateConsumerSurfaceResources({
      publishableApiKeyOid: d.consumerSurface.publishableApiKeyOid,
      consumerSurfaceOid: d.consumerSurface.oid
    });

    return await db.consumerSurface.update({
      where: {
        oid: d.consumerSurface.oid
      },
      data: {
        status: 'deleted',
        archivedAt: null,
        deletedAt: now
      },
      include: consumerSurfaceInclude
    });
  }
}

export let consumerSurfaceService = Service.create(
  'consumerSurfaceService',
  () => new ConsumerSurfaceServiceImpl()
).build();
