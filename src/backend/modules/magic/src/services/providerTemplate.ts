import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  ID,
  Instance,
  Organization,
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
import { subspaceProviderDeploymentService } from '@metorial/module-subspace';
import { ensureProviderTemplateBacking } from '../lib/backing';
import {
  providerTemplateArchivedQueue,
  providerTemplateCreatedQueue,
  providerTemplateUpdatedQueue
} from '../queues/lifecycle/providerTemplate';

type ProviderTemplateDeploymentCreateInput = Pick<
  Parameters<typeof subspaceProviderDeploymentService.create>[0],
  'providerId' | 'name' | 'description' | 'metadata' | 'lockedProviderVersionId'
>;

export type EnrichedProviderTemplate = ProviderTemplate & {
  subspaceIntegrationId: string | null;
};

export type ProviderTemplateProviderInput = {
  providerId: string;
  providerDeploymentId?: string | null;
  providerAuthMethodId?: string | null;
  providerAuthCredentialsId?: string | null;
  providerConfigId?: string | null;
  name?: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  toolFilters?: any;
};

class ProviderTemplateServiceImpl {
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

    let backedProviderTemplate = providerTemplate.hasSubspaceBacking
      ? providerTemplate
      : await ensureProviderTemplateBacking({
          instance: d.instance,
          providerTemplate
        });

    return backedProviderTemplate;
  }

  async createProviderTemplate(d: {
    organization: Organization;
    instance: Instance;
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, unknown>;
      providers: ProviderTemplateProviderInput[];
    };
  }): Promise<EnrichedProviderTemplate> {
    let providerTemplate = await withTransaction(async db => {
      return await db.providerTemplate.create({
        data: {
          id: await ID.generateId('providerTemplate'),
          status: 'active',
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata ?? {},
          organizationOid: d.organization.oid,
          instanceOid: d.instance.oid
        }
      });
    });

    await providerTemplateCreatedQueue.add({ providerTemplateId: providerTemplate.id });
    let backedProviderTemplate = await ensureProviderTemplateBacking({
      instance: d.instance,
      providerTemplate,
      providers: d.input.providers
    });

    return backedProviderTemplate;
  }

  async updateProviderTemplate(d: {
    providerTemplate: ProviderTemplate;
    instance: Instance;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, unknown>;
      providers?: ProviderTemplateProviderInput[];
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
          metadata: d.input.metadata,
          legacyProviderDeploymentId: d.input.providers?.[0]?.providerDeploymentId ?? undefined
        }
      });
    });

    await providerTemplateUpdatedQueue.add({ providerTemplateId: providerTemplate.id });
    let backedProviderTemplate = await ensureProviderTemplateBacking({
      instance: d.instance,
      providerTemplate,
      providers: d.input.providers
    });

    return backedProviderTemplate;
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

    return providerTemplate;
  }

  async listProviderTemplates(d: {
    instance: Instance;
    status?: ProviderTemplateStatus[];
    ids?: string[];
    providerDeploymentIds?: string[];
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
              ...(d.providerDeploymentIds?.length
                ? [
                    {
                      legacyProviderDeploymentId: { in: d.providerDeploymentIds }
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
