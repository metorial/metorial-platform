import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  ID,
  Instance,
  Organization,
  Prisma,
  ProviderTemplate,
  ProviderTemplateStatus,
  withTransaction
} from '@metorial/db';
import {
  accessTagService,
  consumerProviderTemplateReadRoles,
  type AnyAccessTagSelector
} from '@metorial/module-access';
import { searchProviderTemplateIds } from '@metorial/module-search';
import { subspaceMagicMcpBackingService } from '@metorial/module-subspace';
import {
  providerTemplateArchivedQueue,
  providerTemplateCreatedQueue,
  providerTemplateUpdatedQueue
} from '../queues/lifecycle/providerTemplate';
import { enqueueProviderTemplateBackingCleanup } from '../queues/lifecycle/magicMcpBackingCleanup';

export type EnrichedProviderTemplate = ProviderTemplate & {
  subspaceIntegrationId: string | null;
};

type ProviderTemplateCreateInput = {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  integrationId: string;
};

class ProviderTemplateServiceImpl {
  private async getActiveProviderTemplateByIntegrationId(d: {
    instance: Instance;
    integrationId: string;
  }) {
    return await db.providerTemplate.findFirst({
      where: {
        instanceOid: d.instance.oid,
        subspaceIntegrationId: d.integrationId,
        status: 'active'
      }
    });
  }

  private async getProviderTemplateByIntegrationId(d: {
    instance: Instance;
    integrationId: string;
  }) {
    return await db.providerTemplate.findFirst({
      where: {
        instanceOid: d.instance.oid,
        subspaceIntegrationId: d.integrationId
      }
    });
  }

  private async resurrectProviderTemplate(d: {
    providerTemplate: ProviderTemplate;
    organization: Organization;
    instance: Instance;
    input: ProviderTemplateCreateInput;
    integrationId: string;
  }) {
    let providerTemplate = await withTransaction(async db => {
      return await db.providerTemplate.update({
        where: {
          oid: d.providerTemplate.oid
        },
        data: {
          status: 'active',
          archivedAt: null,
          deletedAt: null,
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata ?? {},
          organizationOid: d.organization.oid,
          instanceOid: d.instance.oid,
          hasSubspaceBacking: true,
          subspaceIntegrationId: d.integrationId
        }
      });
    });

    await providerTemplateCreatedQueue.add({ providerTemplateId: providerTemplate.id });
    return providerTemplate;
  }

  async getProviderTemplateById(d: {
    instance: Instance;
    providerTemplateId: string;
    accessTags?: AnyAccessTagSelector;
  }): Promise<EnrichedProviderTemplate> {
    let providerTemplate = await db.providerTemplate.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.providerTemplateId,
        status: d.accessTags ? 'active' : undefined
      }
    });
    if (!providerTemplate) {
      throw new ServiceError(notFoundError('provider.template'));
    }

    if (d.accessTags) {
      await this.checkConsumerReadAccess({
        providerTemplate,
        accessTags: d.accessTags
      });
    }

    return providerTemplate;
  }

  async createProviderTemplate(d: {
    organization: Organization;
    instance: Instance;
    input: ProviderTemplateCreateInput;
  }): Promise<EnrichedProviderTemplate> {
    let integrationId = d.input.integrationId;
    let existing = await this.getActiveProviderTemplateByIntegrationId({
      instance: d.instance,
      integrationId
    });
    if (existing) return existing;

    let backing = await subspaceMagicMcpBackingService.upsertProviderTemplateFromIntegration({
      instance: d.instance,
      providerTemplateId: await ID.generateId('providerTemplate'),
      integrationId
    });

    existing = await this.getActiveProviderTemplateByIntegrationId({
      instance: d.instance,
      integrationId: backing.integrationId
    });
    if (existing) return existing;

    let inactive = await this.getProviderTemplateByIntegrationId({
      instance: d.instance,
      integrationId: backing.integrationId
    });
    if (inactive && inactive.status !== 'deleted') {
      return await this.resurrectProviderTemplate({
        providerTemplate: inactive,
        organization: d.organization,
        instance: d.instance,
        input: d.input,
        integrationId: backing.integrationId
      });
    }

    try {
      let providerTemplate = await withTransaction(async db => {
        return await db.providerTemplate.create({
          data: {
            id: backing.id,
            status: 'active',
            name: d.input.name,
            description: d.input.description,
            metadata: d.input.metadata ?? {},
            organizationOid: d.organization.oid,
            instanceOid: d.instance.oid,
            hasSubspaceBacking: true,
            subspaceIntegrationId: backing.integrationId
          }
        });
      });

      await providerTemplateCreatedQueue.add({ providerTemplateId: providerTemplate.id });
      return providerTemplate;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        let providerTemplate = await this.getProviderTemplateByIntegrationId({
          instance: d.instance,
          integrationId: backing.integrationId
        });
        if (providerTemplate && providerTemplate.status !== 'deleted') {
          return await this.resurrectProviderTemplate({
            providerTemplate,
            organization: d.organization,
            instance: d.instance,
            input: d.input,
            integrationId: backing.integrationId
          });
        }
      }

      throw error;
    }
  }

  async updateProviderTemplate(d: {
    providerTemplate: ProviderTemplate;
    instance: Instance;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    };
  }): Promise<EnrichedProviderTemplate> {
    if (d.providerTemplate.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot update a non-active provider template.'
        })
      );
    }

    let providerTemplate = await withTransaction(async db => {
      return await db.providerTemplate.update({
        where: {
          oid: d.providerTemplate.oid
        },
        data: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata
        }
      });
    });

    await providerTemplateUpdatedQueue.add({ providerTemplateId: providerTemplate.id });
    if (providerTemplate.hasSubspaceBacking) {
      await subspaceMagicMcpBackingService.upsertProviderTemplate({
        instance: d.instance,
        providerTemplateId: providerTemplate.id,
        name: providerTemplate.name,
        description: providerTemplate.description,
        metadata: providerTemplate.metadata as Record<string, any>
      });
    }

    return providerTemplate;
  }

  async archiveProviderTemplate(d: {
    instance: Instance;
    providerTemplate: ProviderTemplate;
  }): Promise<EnrichedProviderTemplate> {
    if (d.providerTemplate.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Provider template is already archived or deleted.'
        })
      );
    }

    let providerTemplate = await withTransaction(async tx => {
      return await tx.providerTemplate.update({
        where: {
          oid: d.providerTemplate.oid
        },
        data: {
          status: 'archived',
          archivedAt: new Date()
        }
      });
    });

    await providerTemplateArchivedQueue.add({ providerTemplateId: providerTemplate.id });
    await enqueueProviderTemplateBackingCleanup({
      instanceId: d.instance.id,
      integrationId: providerTemplate.subspaceIntegrationId,
      providerTemplateId: providerTemplate.id
    });

    return providerTemplate;
  }

  async listProviderTemplates(d: {
    instance: Instance;
    status?: ProviderTemplateStatus[];
    ids?: string[];
    integrationIds?: string[];
    search?: string;
    accessTags?: AnyAccessTagSelector;
  }) {
    let search = d.search?.trim();
    let accessTagFilter = d.accessTags
      ? await accessTagService.getAccessTagFilter({
          tags: d.accessTags,
          roles: [...consumerProviderTemplateReadRoles]
        })
      : undefined;
    let searchedProviderTemplateIds = search
      ? await searchProviderTemplateIds({
          instanceId: d.instance.id,
          query: search
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.providerTemplate.findMany({
          ...opts,
          where: {
            AND: [
              {
                instanceOid: d.instance.oid,
                status: d.status ? { in: d.status } : 'active',
                accessTagEntities: accessTagFilter
              },
              ...(d.ids?.length
                ? [
                    {
                      id: { in: d.ids }
                    }
                  ]
                : []),
              ...(d.integrationIds?.length
                ? [
                    {
                      subspaceIntegrationId: {
                        in: d.integrationIds
                      }
                    }
                  ]
                : []),
              ...(search
                ? [
                    {
                      id: {
                        in: searchedProviderTemplateIds ?? []
                      }
                    }
                  ]
                : [])
            ]
          }
        });
      })
    );
  }

  async checkConsumerReadAccess(d: {
    providerTemplate: ProviderTemplate;
    accessTags: AnyAccessTagSelector;
  }) {
    await accessTagService.checkResourceAccess({
      tags: d.accessTags,
      roles: [...consumerProviderTemplateReadRoles],
      checker: async filter => {
        return await db.providerTemplate.findFirst({
          where: {
            oid: d.providerTemplate.oid,
            accessTagEntities: filter
          }
        });
      }
    });
  }
}

export let providerTemplateService = Service.create(
  'providerTemplateService',
  () => new ProviderTemplateServiceImpl()
).build();
