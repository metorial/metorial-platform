import {
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
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

class ConsumerSurfaceServiceImpl {
  private async getOrCreateConsumerAuthTenant(d: {
    consumerSurface: ConsumerSurface;
    aresApp: {
      id: string;
      slug?: string | null;
      clientId: string;
    };
  }) {
    return await withTransaction(async tx => {
      if (d.consumerSurface.consumerAuthTenantOid) {
        return await tx.consumerAuthTenant.update({
          where: {
            oid: d.consumerSurface.consumerAuthTenantOid
          },
          data: {
            aresAppId: d.aresApp.id,
            aresAppSlug: d.aresApp.slug ?? null,
            aresClientId: d.aresApp.clientId
          }
        });
      }

      return await tx.consumerAuthTenant.create({
        data: {
          id: await ID.generateId('consumerAuthTenant'),
          organizationOid: d.consumerSurface.organizationOid,
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
      return await db.consumerSurface.create({
        data: {
          id: await ID.generateId('consumerSurface'),
          status: 'active',
          name: d.input.name,
          description: d.input.description,
          sessionExpiryTimeInSeconds: d.input.sessionExpiryTimeInSeconds,
          organizationOid: d.organization.oid,
          instanceOid: d.instance.oid,
          publishableApiKeyOid: apiKey.oid
        },
        include: consumerSurfaceInclude
      });
    } catch (error) {
      await this.deactivateConsumerSurfaceResources({
        publishableApiKeyOid: apiKey.oid
      });

      throw error;
    }
  }

  async configureConsumerSurfaceAres(d: {
    consumerSurface: ConsumerSurface;
    aresApp: AresAppConfig;
  }) {
    if (d.consumerSurface.status !== 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot configure Ares for an inactive consumer surface.'
        })
      );
    }

    let app = await consumerAresService.upsertApp({
      slug: d.aresApp.slug,
      defaultRedirectUrl: d.aresApp.defaultRedirectUrl,
      redirectDomains: d.aresApp.redirectDomains
    });

    return await withTransaction(async tx => {
      let consumerAuthTenant = await this.getOrCreateConsumerAuthTenant({
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
          message: 'Cannot update an inactive consumer surface.'
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

  async deleteConsumerSurface(d: { consumerSurface: ConsumerSurface }) {
    if (d.consumerSurface.status !== 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Consumer surface is already inactive.'
        })
      );
    }

    return await withTransaction(async tx => {
      let consumerAuthTenant =
        d.consumerSurface.consumerAuthTenantOid
          ? await tx.consumerAuthTenant.findUnique({
              where: {
                oid: d.consumerSurface.consumerAuthTenantOid
              }
            })
          : null;

      if (consumerAuthTenant?.aresAppId) {
        await consumerAresService.updateApp({
          id: consumerAuthTenant.aresAppId,
          slug: consumerAuthTenant.aresAppSlug
            ? `${consumerAuthTenant.aresAppSlug}-inactive-${Date.now()}`
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

      await this.deactivateConsumerSurfaceResources({
        publishableApiKeyOid: d.consumerSurface.publishableApiKeyOid,
        consumerSurfaceOid: d.consumerSurface.oid
      });

      return await tx.consumerSurface.update({
        where: {
          oid: d.consumerSurface.oid
        },
        data: {
          status: 'inactive',
          consumerAuthTenantOid: null
        },
        include: consumerSurfaceInclude
      });
    });
  }
}

export let consumerSurfaceService = Service.create(
  'consumerSurfaceService',
  () => new ConsumerSurfaceServiceImpl()
).build();
