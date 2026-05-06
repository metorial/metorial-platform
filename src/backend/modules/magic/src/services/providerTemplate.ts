import {
  badRequestError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
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
import {
  subspaceMagicMcpBackingService,
  subspaceProviderDeploymentService
} from '@metorial/module-subspace';
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

    return await this.enrichOne(backedProviderTemplate, d.instance);
  }

  async createProviderTemplate(d: {
    organization: Organization;
    instance: Instance;
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, unknown>;
      providers: ProviderTemplateProviderInput[];
      toolFilters?: any;
      providerDeploymentId?: string;
      providerDeployment?: ProviderTemplateDeploymentCreateInput;
    };
  }): Promise<EnrichedProviderTemplate> {
    let providerDeploymentId = await this.getOrCreateProviderDeployment(d);

    let existing = await db.providerTemplate.findFirst({
      where: {
        instanceOid: d.instance.oid,
        legacyProviderDeploymentId: providerDeploymentId
      }
    });
    if (existing) {
      let providerTemplate = await withTransaction(async db => {
        return await db.providerTemplate.update({
          where: {
            oid: existing.oid
          },
          data: {
            status: 'active',
            name: d.input.name,
            description: d.input.description,
            metadata: d.input.metadata ?? {},
            archivedAt: null
          }
        });
      });

      await providerTemplateUpdatedQueue.add({
        providerTemplateId: providerTemplate.id
      });
      await ensureProviderTemplateBacking({
        instance: d.instance,
        providerTemplate,
        providers: d.input.providers,
        ...(d.input.toolFilters ? { toolFilters: d.input.toolFilters } : {})
      });

      return await this.enrichOne(providerTemplate, d.instance);
    }

    if (d.input.toolFilters) {
      await subspaceProviderDeploymentService.update({
        instance: d.instance,
        providerDeploymentId,
        toolFilters: d.input.toolFilters
      });
    }

    let providerTemplate = await withTransaction(async db => {
      return await db.providerTemplate.create({
        data: {
          id: await ID.generateId('providerTemplate'),
          status: 'active',
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata ?? {},
          legacyProviderDeploymentId: providerDeploymentId,
          organizationOid: d.organization.oid,
          instanceOid: d.instance.oid
        }
      });
    });

    await providerTemplateCreatedQueue.add({ providerTemplateId: providerTemplate.id });
    await ensureProviderTemplateBacking({
      instance: d.instance,
      providerTemplate,
      providers: d.input.providers,
      ...(d.input.toolFilters ? { toolFilters: d.input.toolFilters } : {})
    });

    return await this.enrichOne(providerTemplate, d.instance);
  }

  async updateProviderTemplate(d: {
    providerTemplate: ProviderTemplate;
    instance: Instance;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, unknown>;
      providers?: ProviderTemplateProviderInput[];
      toolFilters?: any;
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

    if (d.input.toolFilters) {
      await subspaceProviderDeploymentService.update({
        instance: d.instance,
        providerDeploymentId: providerTemplate.legacyProviderDeploymentId,
        toolFilters: d.input.toolFilters
      });
    }

    await providerTemplateUpdatedQueue.add({ providerTemplateId: providerTemplate.id });
    await ensureProviderTemplateBacking({
      instance: d.instance,
      providerTemplate,
      providers: d.input.providers,
      ...(d.input.toolFilters ? { toolFilters: d.input.toolFilters } : {})
    });

    return await this.enrichOne(providerTemplate, d.instance);
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

    return await this.enrichOne(providerTemplate, d.instance);
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

    let paginator = Paginator.create(({ prisma }) =>
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
                      id: {
                        in: await this.getProviderTemplateIdsForIntegrationIds({
                          instance: d.instance,
                          integrationIds: d.integrationIds
                        })
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

    return {
      run: async (input: Parameters<typeof paginator.run>[0]) => {
        let result = await paginator.run(input);
        return {
          ...result,
          items: await this.enrich(result.items, d.instance)
        };
      }
    };
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

  private async enrich(
    templates: ProviderTemplate[],
    instance: Instance
  ): Promise<EnrichedProviderTemplate[]> {
    if (templates.length === 0) return [];

    let integrationIdMap = await this.getIntegrationIdMap({
      instance,
      templates
    });

    console.log('enriching provider templates with integration ids', {
      templateIds: templates.map(t => t.id),
      integrationIdMap
    });

    return templates.map(t => ({
      ...t,
      subspaceIntegrationId: integrationIdMap.get(t.id) ?? null
    }));
  }

  private async enrichOne(
    providerTemplate: ProviderTemplate,
    instance: Instance
  ): Promise<EnrichedProviderTemplate> {
    let [enrichedProviderTemplate] = await this.enrich([providerTemplate], instance);
    return enrichedProviderTemplate!;
  }

  private async getOrCreateProviderDeployment(d: {
    instance: Instance;
    input: {
      name: string;
      description?: string;
      providers?: ProviderTemplateProviderInput[];
      providerDeploymentId?: string;
      providerDeployment?: ProviderTemplateDeploymentCreateInput;
    };
  }) {
    let firstProviderDeploymentId = d.input.providers?.[0]?.providerDeploymentId;
    if (firstProviderDeploymentId) {
      await subspaceProviderDeploymentService.get({
        instance: d.instance,
        providerDeploymentId: firstProviderDeploymentId
      });

      return firstProviderDeploymentId;
    }

    if ('providerDeploymentId' in d.input && d.input.providerDeploymentId) {
      await subspaceProviderDeploymentService.get({
        instance: d.instance,
        providerDeploymentId: d.input.providerDeploymentId
      });

      return d.input.providerDeploymentId;
    }

    let providerDeployment = d.input.providerDeployment;
    if (!providerDeployment) {
      throw new ServiceError(
        badRequestError({
          message: 'At least one provider with provider_deployment_id is required.',
          code: 'provider_template_provider_deployment_missing'
        })
      );
    }

    let deployment = await subspaceProviderDeploymentService.create({
      instance: d.instance,
      providerId: providerDeployment.providerId,
      name: providerDeployment.name ?? d.input.name,
      description: providerDeployment.description ?? d.input.description,
      metadata: providerDeployment.metadata,
      lockedProviderVersionId: providerDeployment.lockedProviderVersionId
    });

    return deployment.id;
  }

  private async getIntegrationIdMap(d: {
    instance: Instance;
    templates: Pick<ProviderTemplate, 'id' | 'hasSubspaceBacking'>[];
  }) {
    let providerTemplateBackingIds = [
      ...new Set(
        d.templates
          .filter(template => template.hasSubspaceBacking)
          .map(template => template.id)
      )
    ];
    if (providerTemplateBackingIds.length === 0) return new Map<string, string>();

    let backings = await subspaceMagicMcpBackingService.getManyProviderTemplates({
      instance: d.instance,
      providerTemplateBackingIds
    });

    return new Map(backings.map(backing => [backing.id, backing.integrationId]));
  }

  private async getProviderTemplateIdsForIntegrationIds(d: {
    instance: Instance;
    integrationIds: string[];
  }) {
    let integrationIds = [...new Set(d.integrationIds)];
    if (integrationIds.length === 0) return [];

    let backings =
      await subspaceMagicMcpBackingService.getManyProviderTemplatesByIntegrationIds({
        instance: d.instance,
        integrationIds
      });

    return backings.map(backing => backing.id);
  }
}

export let providerTemplateService = Service.create(
  'providerTemplateService',
  () => new ProviderTemplateServiceImpl()
).build();
