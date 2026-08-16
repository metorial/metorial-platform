import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createOrganizationActorAuditScope } from '@metorial/audit-scope';
import { skillConfigurationService } from '@metorial/module-skill-configurations';
import { Context } from '@metorial/context';
import {
  ConsumerSurface,
  db,
  ID,
  Instance,
  Organization,
  Prisma,
  SkillConfiguration,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createLock } from '@metorial/lock';
import { apiKeyService } from '@metorial/module-machine-access';
import { organizationActorService } from '@metorial/module-organization';
import { normalizeConsumerSurfaceEmailWhitelist } from '../../lib/consumerSurfaceEmailWhitelist';
import {
  consumerSurfaceArchivedQueue,
  consumerSurfaceCreatedQueue,
  consumerSurfaceDeletedQueue,
  consumerSurfaceUpdatedQueue
} from '../../queues/lifecycle/consumerSurface';

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

export type ConsumerSurfaceSkillConfigurationInput = {
  allowScripts?: boolean;
  allowedFileExtensions?: string[] | null;
  allowNonStandardDirectories?: boolean;
};

export type EnrichedConsumerSurface = ConsumerSurfaceWithPublishableApiKey & {
  skillConfiguration: SkillConfiguration;
};

let internalCreateLock = createLock({
  name: 'cons/consumer-surface/internal-create'
});

let fireConsumerAuthTenantLifecycleEvent = async (
  event: 'consumer.auth_tenant.archived:after' | 'consumer.auth_tenant.deleted:after',
  consumerSurface: ConsumerSurfaceWithPublishableApiKey
) => {
  if (!consumerSurface.consumerAuthTenant) return;

  let organization = await db.organization.findUniqueOrThrow({
    where: {
      oid: consumerSurface.organizationOid
    }
  });

  await Fabric.fire(event, {
    organization,
    consumerAuthTenant: consumerSurface.consumerAuthTenant,
    consumerSurface
  });
};

class ConsumerSurfaceServiceImpl {
  private async getSurfaceCargoScope(d: {
    consumerSurface: Pick<ConsumerSurface, 'instanceOid' | 'organizationOid'>;
  }) {
    let instance = await db.instance.findUniqueOrThrow({
      where: {
        oid: d.consumerSurface.instanceOid
      },
      include: {
        project: true
      }
    });

    return {
      project: instance.project,
      instance
    };
  }

  async enrichConsumerSurfaces<T extends ConsumerSurfaceWithPublishableApiKey>(d: {
    instance: Instance;
    consumerSurfaces: T[];
  }): Promise<(T & { skillConfiguration: SkillConfiguration })[]> {
    if (!d.consumerSurfaces.length) return [];

    let scope = await this.getSurfaceCargoScope({
      consumerSurface: d.consumerSurfaces[0]
    });

    let skillConfigurationIds = [
      ...new Set(
        d.consumerSurfaces.flatMap(consumerSurface =>
          consumerSurface.skillConfigurationId ? [consumerSurface.skillConfigurationId] : []
        )
      )
    ];

    let [linkedSkillConfigurations, defaultSkillConfiguration] = await Promise.all([
      skillConfigurationIds.length
        ? skillConfigurationService.getManySkillConfigurations({
            ...scope,
            skillConfigurationIds
          })
        : Promise.resolve([]),
      skillConfigurationService.getSkillConfigurationById({
        ...scope,
        skillConfigurationId: 'default'
      })
    ]);

    let skillConfigurationById = new Map(
      linkedSkillConfigurations.map(skillConfiguration => [
        skillConfiguration.id,
        skillConfiguration
      ])
    );

    return d.consumerSurfaces.map(consumerSurface => ({
      ...consumerSurface,
      skillConfiguration:
        (consumerSurface.skillConfigurationId
          ? skillConfigurationById.get(consumerSurface.skillConfigurationId)
          : undefined) ?? defaultSkillConfiguration
    }));
  }

  async enrichConsumerSurface<T extends ConsumerSurfaceWithPublishableApiKey>(d: {
    instance: Instance;
    consumerSurface: T;
  }): Promise<T & { skillConfiguration: SkillConfiguration }> {
    let [consumerSurface] = await this.enrichConsumerSurfaces({
      instance: d.instance,
      consumerSurfaces: [d.consumerSurface]
    });

    return consumerSurface!;
  }

  private async upsertConsumerSurfaceSkillConfiguration(d: {
    consumerSurface: ConsumerSurfaceWithPublishableApiKey;
    input: ConsumerSurfaceSkillConfigurationInput;
  }) {
    let scope = await this.getSurfaceCargoScope({
      consumerSurface: d.consumerSurface
    });

    if (d.consumerSurface.skillConfigurationId) {
      let [existing] = await skillConfigurationService.getManySkillConfigurations({
        ...scope,
        skillConfigurationIds: [d.consumerSurface.skillConfigurationId]
      });

      if (existing) {
        return await skillConfigurationService.updateSkillConfiguration({
          ...scope,
          skillConfigurationId: existing.id,
          input: d.input
        });
      }
    }

    return await skillConfigurationService.createSkillConfiguration({
      ...scope,
      input: {
        ...d.input,
        isInternal: true
      }
    });
  }

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

    return await this.enrichConsumerSurface({
      instance: d.instance,
      consumerSurface
    });
  }

  async listConsumerSurfaces(d: { instance: Instance }) {
    let paginator = Paginator.create(({ prisma }) =>
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

    return Paginator.create(() => async input => {
      let list = await paginator.run(input);

      return {
        ...list,
        items: await this.enrichConsumerSurfaces({
          instance: d.instance,
          consumerSurfaces: list.items
        })
      };
    });
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
      emailWhitelist?: string[];
      allowConsumerSkillAuthoring?: boolean;
      allowConsumerSkillPublishing?: boolean;
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
      type: 'instance_access_token_publishable',
      auditScope: createOrganizationActorAuditScope({
        organization: d.organization,
        organizationActor: systemActor,
        instance: d.instance,
        context: d.context
      }),
      input: {
        name: `Publishable API Key for Consumer Surface ${d.input.name}`
      }
    });

    try {
      await Fabric.fire('consumer.auth_tenant.created:before', {
        organization: d.organization,
        instance: d.instance
      });

      let consumerSurface = await withTransaction(async tx => {
        let consumerAuthTenant = await tx.consumerAuthTenant.create({
          data: {
            id: await ID.generateId('consumerAuthTenant'),
            organizationOid: d.organization.oid
          }
        });

        let consumerSurface = await tx.consumerSurface.create({
          data: {
            id: await ID.generateId('consumerSurface'),
            status: 'active',
            name: d.input.name,
            description: d.input.description,
            sessionExpiryTimeInSeconds: d.input.sessionExpiryTimeInSeconds,
            allowConsumerSkillAuthoring: d.input.allowConsumerSkillAuthoring,
            allowConsumerSkillPublishing: d.input.allowConsumerSkillPublishing,
            emailWhitelist: normalizeConsumerSurfaceEmailWhitelist(
              d.input.emailWhitelist ?? []
            ),
            organizationOid: d.organization.oid,
            instanceOid: d.instance.oid,
            consumerAuthTenantOid: consumerAuthTenant.oid,
            publishableApiKeyOid: apiKey.oid,
            internalSurfaceUniqueIdentifier: d.internalSurfaceUniqueIdentifier
          },
          include: consumerSurfaceInclude
        });

        await Fabric.fire('consumer.auth_tenant.created:after', {
          organization: d.organization,
          consumerAuthTenant,
          consumerSurface
        });

        return consumerSurface;
      });

      await consumerSurfaceCreatedQueue.add({ consumerSurfaceId: consumerSurface.id });

      return consumerSurface;
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

  async updateConsumerSurface(d: {
    consumerSurface: ConsumerSurface;
    input: {
      name?: string;
      description?: string;
      sessionExpiryTimeInSeconds?: number;
      emailWhitelist?: string[];
      allowConsumerSkillAuthoring?: boolean;
      allowConsumerSkillPublishing?: boolean;
      skillConfiguration?: ConsumerSurfaceSkillConfigurationInput;
    };
  }) {
    if (d.consumerSurface.status !== 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot update a non-active consumer surface.'
        })
      );
    }

    let skillConfiguration = d.input.skillConfiguration
      ? await this.upsertConsumerSurfaceSkillConfiguration({
          consumerSurface: d.consumerSurface as ConsumerSurfaceWithPublishableApiKey,
          input: d.input.skillConfiguration
        })
      : undefined;

    let consumerSurface = await db.consumerSurface.update({
      where: {
        oid: d.consumerSurface.oid
      },
      data: {
        name: d.input.name,
        description: d.input.description,
        sessionExpiryTimeInSeconds: d.input.sessionExpiryTimeInSeconds,
        allowConsumerSkillAuthoring: d.input.allowConsumerSkillAuthoring,
        allowConsumerSkillPublishing: d.input.allowConsumerSkillPublishing,
        emailWhitelist:
          d.input.emailWhitelist === undefined
            ? undefined
            : normalizeConsumerSurfaceEmailWhitelist(d.input.emailWhitelist),
        skillConfigurationId: skillConfiguration?.id
      },
      include: consumerSurfaceInclude
    });

    await consumerSurfaceUpdatedQueue.add({ consumerSurfaceId: consumerSurface.id });

    return await this.enrichConsumerSurface({
      instance: await db.instance.findUniqueOrThrow({
        where: {
          oid: consumerSurface.instanceOid
        }
      }),
      consumerSurface
    });
  }

  async archiveConsumerSurface(d: { consumerSurface: ConsumerSurface }) {
    this.assertConsumerSurfaceIsActive(d.consumerSurface);

    let now = new Date();

    let consumerSurface = await db.consumerSurface.update({
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

    await consumerSurfaceArchivedQueue.add({ consumerSurfaceId: consumerSurface.id });
    await fireConsumerAuthTenantLifecycleEvent(
      'consumer.auth_tenant.archived:after',
      consumerSurface
    );

    return consumerSurface;
  }

  async deleteConsumerSurface(d: { consumerSurface: ConsumerSurface }) {
    this.assertConsumerSurfaceIsActive(d.consumerSurface);

    let now = new Date();

    let consumerSurface = await db.consumerSurface.update({
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

    await consumerSurfaceDeletedQueue.add({ consumerSurfaceId: consumerSurface.id });
    await fireConsumerAuthTenantLifecycleEvent(
      'consumer.auth_tenant.deleted:after',
      consumerSurface
    );

    return consumerSurface;
  }
}

export let consumerSurfaceService = Service.create(
  'consumerSurfaceService',
  () => new ConsumerSurfaceServiceImpl()
).build();
