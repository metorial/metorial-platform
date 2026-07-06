import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Environment,
  snowflake,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { integrationService } from '../integration';
import { magicMcpProviderTemplateBackingInclude, withMagicMcpBackingLock } from './shared';

type UpdateProviderTemplateBackingInput = {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  input: {
    providerTemplateId: string;
    name: string;
    description?: string | null;
    metadata?: Record<string, any> | null;
    privateMetadata?: Record<string, any> | null;
  };
};

type UpsertProviderTemplateBackingFromIntegrationInput = {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  input: {
    providerTemplateId: string;
    integrationId: string;
  };
};

class providerTemplateBackingServiceImpl {
  async updateProviderTemplateBacking(d: UpdateProviderTemplateBackingInput) {
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

        await integrationService.updateIntegration({
          tenant: d.tenant,
          solution: d.solution,
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

    return await this.getProviderTemplateBackingById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      providerTemplateBackingId: d.input.providerTemplateId
    });
  }

  async upsertProviderTemplateBackingFromIntegration(
    d: UpsertProviderTemplateBackingFromIntegrationInput
  ) {
    await withMagicMcpBackingLock(
      [
        `provider_template:${d.input.providerTemplateId}`,
        `provider_template_integration:${d.input.integrationId}`
      ],
      async () =>
        await withTransaction(async db => {
          let integration = await integrationService.getIntegrationById({
            tenant: d.tenant,
            solution: d.solution,
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
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        }
      },
      include: magicMcpProviderTemplateBackingInclude
    });
  }

  async getProviderTemplateBackingById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerTemplateBackingId: string;
  }) {
    let backing = await db.providerTemplateBacking.findFirst({
      where: {
        id: d.providerTemplateBackingId,
        integration: {
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
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

  async getManyProviderTemplateBackingsByIds(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerTemplateBackingIds: string[];
  }) {
    if (d.providerTemplateBackingIds.length === 0) return [];

    return await db.providerTemplateBacking.findMany({
      where: {
        id: { in: d.providerTemplateBackingIds },
        integration: {
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        }
      },
      include: magicMcpProviderTemplateBackingInclude
    });
  }

  async getManyProviderTemplateBackingsByIntegrationIds(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integrationIds: string[];
  }) {
    if (d.integrationIds.length === 0) return [];

    return await db.providerTemplateBacking.findMany({
      where: {
        integration: {
          id: { in: d.integrationIds },
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        }
      },
      include: magicMcpProviderTemplateBackingInclude
    });
  }

  async archiveProviderTemplateBacking(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerTemplateBackingId: string;
  }) {
    return await this.getProviderTemplateBackingById(d);
  }
}

export let providerTemplateBackingService = Service.create(
  'providerTemplateBacking',
  () => new providerTemplateBackingServiceImpl()
).build();
