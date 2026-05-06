import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import {
  db,
  type Environment,
  type Integration,
  type IntegrationProvider,
  snowflake,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { integrationService } from '../integration';
import { integrationProviderService, MAX_INTEGRATION_PROVIDERS } from '../integrationProvider';
import { reconcileMagicMcpServerProvidersForBacking } from './serverProvider';
import { magicMcpProviderTemplateBackingInclude, withMagicMcpBackingLock } from './shared';

type UpsertProviderTemplateBackingInput = {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  input: {
    providerTemplateId: string;
    name: string;
    description?: string | null;
    metadata?: Record<string, any> | null;
    privateMetadata?: Record<string, any> | null;
    providerDeploymentId?: string | null;
    toolFilters?: PrismaJson.ToolFilter | null;
    providers?: ProviderTemplateBackingProviderInput[];
  };
};

type ProviderTemplateBackingProviderInput = {
  providerId: string;
  providerDeploymentId?: string | null;
  providerAuthMethodId?: string | null;
  providerAuthCredentialsId?: string | null;
  providerConfigId?: string | null;
  name?: string;
  description?: string | null;
  metadata?: Record<string, any> | null;
  toolFilters?: PrismaJson.ToolFilter | null;
};

class providerTemplateBackingServiceImpl {
  private normalizeProviderInput(providerInput: ProviderTemplateBackingProviderInput) {
    return {
      ...providerInput,
      providerDeploymentId: providerInput.providerDeploymentId ?? undefined,
      providerAuthMethodId: providerInput.providerAuthMethodId ?? undefined,
      providerAuthCredentialsId: providerInput.providerAuthCredentialsId ?? undefined,
      providerConfigId: providerInput.providerConfigId ?? undefined,
      description:
        providerInput.description === undefined ? undefined : providerInput.description,
      metadata: providerInput.metadata ?? undefined
    };
  }

  private async syncIntegrationProviders(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    integration: Integration;
    providers: ProviderTemplateBackingProviderInput[];
  }) {
    if (d.providers.length > MAX_INTEGRATION_PROVIDERS) {
      throw new ServiceError(
        badRequestError({
          message: `Cannot associate more than ${MAX_INTEGRATION_PROVIDERS} providers to an integration`
        })
      );
    }

    let existing = await db.integrationProvider.findMany({
      where: {
        integrationOid: d.integration.oid
      },
      include: {
        provider: true
      }
    });
    let existingByProviderId = new Map(
      existing.map(provider => [provider.provider.id, provider])
    );
    let touchedProviderIds = new Set<string>();

    for (let providerInput of d.providers) {
      touchedProviderIds.add(providerInput.providerId);
      let existingProvider = existingByProviderId.get(providerInput.providerId);

      if (existingProvider?.status === 'active') {
        await integrationProviderService.updateIntegrationProvider({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          integrationProvider: existingProvider as IntegrationProvider,
          input: this.normalizeProviderInput(providerInput)
        });
        continue;
      }

      await integrationProviderService.createIntegrationProvider({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        integration: d.integration,
        input: {
          ...this.normalizeProviderInput(providerInput),
          description: providerInput.description ?? undefined
        }
      });
    }

    for (let existingProvider of existing) {
      if (touchedProviderIds.has(existingProvider.provider.id)) continue;
      if (existingProvider.status !== 'active') continue;

      await integrationProviderService.archiveIntegrationProvider({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        integrationProvider: existingProvider
      });
    }
  }

  async upsertProviderTemplateBacking(d: UpsertProviderTemplateBackingInput) {
    await withMagicMcpBackingLock(
      `provider_template:${d.input.providerTemplateId}`,
      async () =>
        await withTransaction(async db => {
          let existing = await db.providerTemplateBacking.findUnique({
            where: { id: d.input.providerTemplateId },
            include: magicMcpProviderTemplateBackingInclude
          });

          let hasProvidersWithoutConfig =
            !!d.input.providers && d.input.providers.some(p => !p.providerConfigId);

          let integration = await integrationService.upsertMagicMcpIntegration({
            tenant: d.tenant,
            solution: d.solution,
            environment: d.environment,
            integration: existing?.integration,
            input: {
              slug: `${slugify(d.input.name)}-${(await Hash.sha256(d.input.providerTemplateId)).slice(0, 6)}[template]`,
              name: d.input.name,
              description: d.input.description,
              metadata: d.input.metadata,
              privateMetadata: d.input.privateMetadata,
              canAttachCustomToolFilters: true,
              canAttachCustomProviderConfig: hasProvidersWithoutConfig,
              canOverrideToolFilters: false
            }
          });

          await db.providerTemplateBacking.upsert({
            where: { id: d.input.providerTemplateId },
            create: {
              oid: snowflake.nextId(),
              id: d.input.providerTemplateId,
              integrationOid: integration.oid
            },
            update: {
              integrationOid: integration.oid
            }
          });

          if (d.input.providers) {
            await this.syncIntegrationProviders({
              tenant: d.tenant,
              solution: d.solution,
              environment: d.environment,
              integration,
              providers: d.input.providers
            });
          } else if (d.input.providerDeploymentId) {
            await integrationProviderService.ensureIntegrationProviderForDeployment({
              tenant: d.tenant,
              solution: d.solution,
              environment: d.environment,
              integration,
              input: {
                providerDeploymentId: d.input.providerDeploymentId,
                toolFilters: d.input.toolFilters
              }
            });
          }
        })
    );

    let backing = await db.providerTemplateBacking.findUniqueOrThrow({
      where: { id: d.input.providerTemplateId },
      include: magicMcpProviderTemplateBackingInclude
    });

    let linkedBackings = await db.magicMcpServerBacking.findMany({
      where: {
        providerTemplateBackingOid: backing.oid
      },
      select: { id: true }
    });
    for (let linkedBacking of linkedBackings) {
      await reconcileMagicMcpServerProvidersForBacking({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        magicMcpServerBackingId: linkedBacking.id
      });
    }

    return backing;
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

  async reconcileProviderTemplateBacking(d: UpsertProviderTemplateBackingInput) {
    return await this.upsertProviderTemplateBacking(d);
  }

  async archiveProviderTemplateBacking(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerTemplateBackingId: string;
  }) {
    let backing = await this.getProviderTemplateBackingById(d);
    await integrationService.archiveIntegration({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      integration: backing.integration,
      _canModifyMagicMcpBacking: true
    });

    return await this.getProviderTemplateBackingById(d);
  }
}

export let providerTemplateBackingService = Service.create(
  'providerTemplateBacking',
  () => new providerTemplateBackingServiceImpl()
).build();
