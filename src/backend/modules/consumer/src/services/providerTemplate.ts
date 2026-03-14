import {
  conflictError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  accessTagService,
  consumerProviderTemplateReadRoles,
  type AnyAccessTagSelector
} from '@metorial/module-access';
import { subspaceProviderDeploymentService } from '@metorial/module-subspace';
import {
  db,
  ID,
  Instance,
  Organization,
  ProviderTemplate,
  ProviderTemplateStatus,
  withTransaction
} from '@metorial/db';

type ProviderTemplateDeploymentCreateInput = Pick<
  Parameters<typeof subspaceProviderDeploymentService.create>[0],
  'providerId' | 'name' | 'description' | 'metadata' | 'lockedProviderVersionId'
>;

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

    return providerTemplate;
  }

  async createProviderTemplate(d: {
    organization: Organization;
    instance: Instance;
    input: {
      name: string;
      description?: string;
      metadata?: Record<string, unknown>;
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

    let existing = await db.providerTemplate.findFirst({
      where: {
        instanceOid: d.instance.oid,
        providerDeploymentId
      }
    });
    if (existing) {
      throw new ServiceError(
        conflictError({
          message: 'A provider template already exists for this provider deployment.'
        })
      );
    }

    return await db.providerTemplate.create({
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
  }

  async updateProviderTemplate(d: {
    providerTemplate: ProviderTemplate;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    };
  }) {
    if (d.providerTemplate.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot update a non-active provider template.'
        })
      );
    }

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
  }

  async archiveProviderTemplate(d: { providerTemplate: ProviderTemplate }) {
    if (d.providerTemplate.status != 'active') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Provider template is already archived or deleted.'
        })
      );
    }

    return await withTransaction(async tx => {
      await tx.accessTagEntity.deleteMany({
        where: {
          providerTemplateOid: d.providerTemplate.oid,
          accessTagPolicy: {
            organizationOid: d.providerTemplate.organizationOid,
            roles: {
              hasSome: [...consumerProviderTemplateReadRoles]
            }
          }
        }
      });

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
  }

  async listProviderTemplates(d: {
    instance: Instance;
    status?: ProviderTemplateStatus[];
    ids?: string[];
    providerDeploymentIds?: string[];
    accessTags?: AnyAccessTagSelector;
  }) {
    let accessTagFilter = d.accessTags
      ? await accessTagService.getAccessTagFilter({
          tags: d.accessTags,
          roles: [...consumerProviderTemplateReadRoles]
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        return await db.providerTemplate.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            id: d.ids?.length ? { in: d.ids } : undefined,
            providerDeploymentId: d.providerDeploymentIds?.length
              ? { in: d.providerDeploymentIds }
              : undefined,
            status: d.status ? { in: d.status } : 'active',
            accessTagEntities: accessTagFilter
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
