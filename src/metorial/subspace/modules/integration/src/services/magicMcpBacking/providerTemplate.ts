import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  snowflake,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { integrationService } from '../integration';
import { magicMcpProviderTemplateBackingInclude, withMagicMcpBackingLock } from './shared';

type UpdateProviderTemplateBackingParams = {
  input: {
    providerTemplateId: string;
    name: string;
    description?: string | null;
    metadata?: Record<string, any> | null;
    privateMetadata?: Record<string, any> | null;
  };
};

type UpsertProviderTemplateBackingFromIntegrationParams = {
  input: {
    providerTemplateId: string;
    integrationId: string;
  };
};

type GetProviderTemplateBackingByIdParams = {
  providerTemplateBackingId: string;
};

type GetManyProviderTemplateBackingsByIdsParams = {
  providerTemplateBackingIds: string[];
};

type GetManyProviderTemplateBackingsByIntegrationIdsParams = {
  integrationIds: string[];
};

type ArchiveProviderTemplateBackingParams = {
  providerTemplateBackingId: string;
};

class providerTemplateBackingServiceImpl {
  async updateProviderTemplateBacking(
    d: MetorialFacing<UpdateProviderTemplateBackingParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.updateProviderTemplateBackingInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async updateProviderTemplateBackingInternal(
    d: { tenant: Tenant; environment: Environment } & UpdateProviderTemplateBackingParams
  ) {
    await withMagicMcpBackingLock(
      `provider_template:${d.input.providerTemplateId}`,
      async () => {
        let existing = await db.providerTemplateBacking.findUnique({
          where: { id: d.input.providerTemplateId },
          include: magicMcpProviderTemplateBackingInclude
        });
        if (!existing) {
          throw new ServiceError(
            notFoundError('provider_template', d.input.providerTemplateId)
          );
        }

        await integrationService.updateIntegrationInternal({
          tenant: d.tenant,
          environment: d.environment,
          integration: existing.integration,
          input: {
            name: d.input.name,
            description: d.input.description,
            metadata: d.input.metadata,
            privateMetadata: d.input.privateMetadata
          }
        });
      }
    );

    return await this.getProviderTemplateBackingByIdInternal({
      tenant: d.tenant,
      environment: d.environment,
      providerTemplateBackingId: d.input.providerTemplateId
    });
  }

  async upsertProviderTemplateBackingFromIntegration(
    d: MetorialFacing<UpsertProviderTemplateBackingFromIntegrationParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.upsertProviderTemplateBackingFromIntegrationInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async upsertProviderTemplateBackingFromIntegrationInternal(
    d: {
      tenant: Tenant;
      environment: Environment;
    } & UpsertProviderTemplateBackingFromIntegrationParams
  ) {
    let solution = await getMetorialSolution();

    await withMagicMcpBackingLock(
      [
        `provider_template:${d.input.providerTemplateId}`,
        `provider_template_integration:${d.input.integrationId}`
      ],
      async () =>
        await withTransaction(async db => {
          let integration = await integrationService.getIntegrationByIdInternal({
            tenant: d.tenant,
            environment: d.environment,
            integrationId: d.input.integrationId
          });

          let existing = await db.providerTemplateBacking.findUnique({
            where: { integrationOid: integration.oid },
            include: magicMcpProviderTemplateBackingInclude
          });
          if (existing) return existing;

          return await db.providerTemplateBacking.create({
            data: {
              oid: snowflake.nextId(),
              id: d.input.providerTemplateId,
              integrationOid: integration.oid
            },
            include: magicMcpProviderTemplateBackingInclude
          });
        })
    );

    return await db.providerTemplateBacking.findFirstOrThrow({
      where: {
        integration: {
          id: d.input.integrationId,
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid
        }
      },
      include: magicMcpProviderTemplateBackingInclude
    });
  }

  async getProviderTemplateBackingById(
    d: MetorialFacing<GetProviderTemplateBackingByIdParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getProviderTemplateBackingByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getProviderTemplateBackingByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetProviderTemplateBackingByIdParams
  ) {
    let solution = await getMetorialSolution();

    let backing = await db.providerTemplateBacking.findFirst({
      where: {
        id: d.providerTemplateBackingId,
        integration: {
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid
        }
      },
      include: magicMcpProviderTemplateBackingInclude
    });
    if (!backing) {
      throw new ServiceError(notFoundError('provider_template', d.providerTemplateBackingId));
    }

    return backing;
  }

  async getManyProviderTemplateBackingsByIds(
    d: MetorialFacing<GetManyProviderTemplateBackingsByIdsParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getManyProviderTemplateBackingsByIdsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getManyProviderTemplateBackingsByIdsInternal(
    d: {
      tenant: Tenant;
      environment: Environment;
    } & GetManyProviderTemplateBackingsByIdsParams
  ) {
    if (d.providerTemplateBackingIds.length === 0) return [];

    let solution = await getMetorialSolution();

    return await db.providerTemplateBacking.findMany({
      where: {
        id: { in: d.providerTemplateBackingIds },
        integration: {
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid
        }
      },
      include: magicMcpProviderTemplateBackingInclude
    });
  }

  async getManyProviderTemplateBackingsByIntegrationIds(
    d: MetorialFacing<GetManyProviderTemplateBackingsByIntegrationIdsParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.getManyProviderTemplateBackingsByIntegrationIdsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getManyProviderTemplateBackingsByIntegrationIdsInternal(
    d: {
      tenant: Tenant;
      environment: Environment;
    } & GetManyProviderTemplateBackingsByIntegrationIdsParams
  ) {
    if (d.integrationIds.length === 0) return [];

    let solution = await getMetorialSolution();

    return await db.providerTemplateBacking.findMany({
      where: {
        integration: {
          id: { in: d.integrationIds },
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid
        }
      },
      include: magicMcpProviderTemplateBackingInclude
    });
  }

  async archiveProviderTemplateBacking(
    d: MetorialFacing<ArchiveProviderTemplateBackingParams>
  ) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.archiveProviderTemplateBackingInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async archiveProviderTemplateBackingInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveProviderTemplateBackingParams
  ) {
    return await this.getProviderTemplateBackingByIdInternal(d);
  }
}

export let providerTemplateBackingService = Service.create(
  'providerTemplateBacking',
  () => new providerTemplateBackingServiceImpl()
).build();
