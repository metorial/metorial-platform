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
import {
  subspaceProviderDeploymentService,
  type SubspaceProviderDeployment
} from '@metorial/module-subspace';
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
  providerDeployment: SubspaceProviderDeployment;
};

class ProviderTemplateServiceImpl {
  async getProviderTemplateById(d: {
    instance: Instance;
    providerTemplateId: string;
    accessTags?: AnyAccessTagSelector;
  }) {
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

    return (await this.enrich([providerTemplate], d.instance))[0];
  }

  async createProviderTemplate(d: {
    organization: Organization;
    instance: Instance;
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, unknown>;
      toolFilters?: any;
    } & (
      | {
          providerDeploymentId: string;
          providerDeployment?: never;
        }
      | {
          providerDeployment: ProviderTemplateDeploymentCreateInput;
          providerDeploymentId?: never;
        }
    );
  }) {
    let providerDeploymentId = await this.getOrCreateProviderDeployment(d);

    // let existing = await db.providerTemplate.findFirst({
    //   where: {
    //     instanceOid: d.instance.oid,
    //     providerDeploymentId
    //   }
    // });
    // if (existing) {
    //   if (existing.status == 'archived') {
    //     let providerTemplate = await db.providerTemplate.update({
    //       where: {
    //         oid: existing.oid
    //       },
    //       data: {
    //         status: 'active',
    //         name: d.input.name,
    //         description: d.input.description,
    //         metadata: d.input.metadata ?? {},
    //         archivedAt: null
    //       }
    //     });

    //     await providerTemplateUpdatedQueue.add({
    //       providerTemplateId: providerTemplate.id
    //     });

    //     return providerTemplate;
    //   }

    //   throw new ServiceError(
    //     conflictError({
    //       message: 'A provider template already exists for this provider deployment.'
    //     })
    //   );
    // }

    if (d.input.toolFilters) {
      await subspaceProviderDeploymentService.update({
        instance: d.instance,
        providerDeploymentId,
        toolFilters: d.input.toolFilters
      });
    }

    let providerTemplate = await db.providerTemplate.create({
      data: {
        id: await ID.generateId('providerTemplate'),
        status: 'active',
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata ?? {},
        providerDeploymentId,
        organizationOid: d.organization.oid,
        instanceOid: d.instance.oid
      }
    });

    await providerTemplateCreatedQueue.add({ providerTemplateId: providerTemplate.id });

    return (await this.enrich([providerTemplate], d.instance))[0];
  }

  async updateProviderTemplate(d: {
    providerTemplate: ProviderTemplate;
    instance: Instance;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, unknown>;
      toolFilters?: any;
    };
  }) {
    if (d.providerTemplate.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot update a non-active provider template.'
        })
      );
    }

    let providerTemplate = await db.providerTemplate.update({
      where: {
        oid: d.providerTemplate.oid
      },
      data: {
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata
      }
    });

    if (d.input.toolFilters) {
      await subspaceProviderDeploymentService.update({
        instance: d.instance,
        providerDeploymentId: providerTemplate.providerDeploymentId,
        toolFilters: d.input.toolFilters
      });
    }

    await providerTemplateUpdatedQueue.add({ providerTemplateId: providerTemplate.id });

    return (await this.enrich([providerTemplate], d.instance))[0];
  }

  async archiveProviderTemplate(d: {
    instance: Instance;
    providerTemplate: ProviderTemplate;
  }) {
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

    return (await this.enrich([providerTemplate], d.instance))[0];
  }

  async listProviderTemplates(d: {
    instance: Instance;
    status?: ProviderTemplateStatus[];
    ids?: string[];
    providerDeploymentIds?: string[];
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
                      providerDeploymentId: { in: d.providerDeploymentIds }
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

    let deploymentIds = [...new Set(templates.map(t => t.providerDeploymentId))];
    let deployments = await subspaceProviderDeploymentService.getMany({
      instance,
      ids: deploymentIds
    });
    let deploymentMap = new Map(deployments.map(d => [d.id, d]));

    return templates.map(t => ({
      ...t,
      providerDeployment: deploymentMap.get(t.providerDeploymentId)!
    }));
  }

  private async getOrCreateProviderDeployment(d: {
    instance: Instance;
    input: {
      name: string;
      description?: string;
    } & (
      | {
          providerDeploymentId: string;
          providerDeployment?: never;
        }
      | {
          providerDeployment: ProviderTemplateDeploymentCreateInput;
          providerDeploymentId?: never;
        }
    );
  }) {
    if ('providerDeploymentId' in d.input && d.input.providerDeploymentId) {
      await subspaceProviderDeploymentService.get({
        instance: d.instance,
        providerDeploymentId: d.input.providerDeploymentId
      });

      return d.input.providerDeploymentId;
    }

    let providerDeployment = d.input.providerDeployment;
    if (!providerDeployment) {
      throw new Error('providerDeployment is required');
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
}

export let providerTemplateService = Service.create(
  'providerTemplateService',
  () => new ProviderTemplateServiceImpl()
).build();
