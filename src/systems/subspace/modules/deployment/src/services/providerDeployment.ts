import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  ID,
  type Provider,
  type ProviderConfig,
  type ProviderConfigVault,
  type ProviderDeployment,
  type ProviderDeploymentStatus,
  type ProviderVariant,
  type ProviderVersion,
  snowflake,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  assertNoActiveIdentityCredentialDeploymentLink,
  assertNoActiveIntegrationInstanceProviderDeploymentLink,
  checkDeletedEdit,
  checkDeletedRelation,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveIdentities,
  resolveIdentityActors,
  resolveIdentityCredentials,
  resolveProviders,
  resolveProviderVersions
} from '@metorial-subspace/list-utils';
import type { ProviderCapabilityFilter } from '@metorial-subspace/module-catalog';
import { getProviderCapabilityFilter } from '@metorial-subspace/module-catalog';
import {
  checkProviderMatch,
  normalizeToolFilters,
  providerDeploymentInternalService
} from '@metorial-subspace/module-provider-internal';
import { enclaveInternalService } from '@metorial-subspace/module-enclave';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
import { normalizeJsonSchema } from '@metorial-subspace/provider-utils';
import { env } from '../env';
import {
  providerDeploymentArchivedQueue,
  providerDeploymentCreatedQueue,
  providerDeploymentUpdatedQueue
} from '../queues/lifecycle/providerDeployment';
import { providerConfigService } from './providerConfig';

let include = {
  provider: true,
  defaultConfig: true,
  providerVariant: true,
  enclave: {
    select: {
      id: true
    }
  },
  currentVersion: { include: { lockedVersion: { include: { specification: true } } } }
};

let defaultLock = createLock({
  name: 'sub/dep/pdep/def/lock',
  redisUrl: env.service.REDIS_URL
});

class providerDeploymentServiceImpl {
  async listProviderDeployments(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    search?: string;

    status?: ProviderDeploymentStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    providerIds?: string[];
    providerVersionIds?: string[];
    actorIds?: string[];
    identityIds?: string[];
    identityCredentialIds?: string[];

    capabilities?: ProviderCapabilityFilter;

    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let providers = await resolveProviders(d, d.providerIds);
    let versions = await resolveProviderVersions(d, d.providerVersionIds);
    let actors = await resolveIdentityActors(d, d.actorIds);
    let identities = await resolveIdentities(d, d.identityIds);
    let identityCredentials = await resolveIdentityCredentials(d, d.identityCredentialIds);

    let capFilters = getProviderCapabilityFilter(d.capabilities || {});

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.providerDeployment.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerDeployment.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,
              isEphemeral: false,

              ...normalizeStatusForList(d).noParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                versions ? { currentVersion: { lockedVersionOid: versions.in } } : undefined!,
                actors
                  ? { identityCredentials: { some: { identity: { actor: actors.oidIn } } } }
                  : undefined!,
                identities
                  ? { identityCredentials: { some: { identityOid: identities.in } } }
                  : undefined!,
                identityCredentials
                  ? { identityCredentials: { some: identityCredentials.oidIn } }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!,
                capFilters ? { provider: { type: capFilters } } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getProviderDeploymentById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerDeploymentId: string;
    allowDeleted?: boolean;
  }) {
    let providerDeployment = await withTransaction(
      async db =>
        await db.providerDeployment.findFirst({
          where: {
            id: d.providerDeploymentId,
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,

            ...normalizeStatusForGet(d).noParent
          },
          include
        }),
      { ifExists: true }
    );
    if (!providerDeployment)
      throw new ServiceError(notFoundError('provider.deployment', d.providerDeploymentId));

    return providerDeployment;
  }

  async getManyProviderDeploymentsByIds(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    ids: string[];
    allowDeleted?: boolean;
  }) {
    return await db.providerDeployment.findMany({
      where: {
        id: { in: d.ids },
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include
    });
  }

  async createProviderDeployment(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    lockedVersion?: ProviderVersion;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;
      toolFilters?: PrismaJson.ToolFilter | null;
      isEphemeral?: boolean;
      isDefault?: boolean;

      config:
        | {
            type: 'none';
          }
        | {
            type: 'vault';
            vault: ProviderConfigVault;
          }
        | {
            type: 'inline';
            data: Record<string, any>;
          }
        | {
            type: 'config';
            config: ProviderConfig;
          };
    };
  }) {
    checkDeletedRelation(d.provider, { allowEphemeral: d.input.isEphemeral });

    if (d.input.config.type === 'vault') {
      checkTenant(d, d.input.config.vault);
      checkDeletedRelation(d.input.config.vault, { allowEphemeral: d.input.isEphemeral });
      checkProviderMatch(d.provider, d.input.config.vault);
    }

    if (d.input.config.type === 'config') {
      checkTenant(d, d.input.config.config);
      checkDeletedRelation(d.input.config.config, { allowEphemeral: d.input.isEphemeral });
      checkProviderMatch(d.provider, d.input.config.config);
    }

    return withTransaction(async db => {
      if (!d.provider.defaultVariant) {
        throw new Error('Provider has no default variant');
      }

      let backend = await getBackend({ entity: d.provider.defaultVariant });

      let environmentProvider = await db.environmentProvider.findFirst({
        where: { tenantOid: d.tenant.oid, providerOid: d.provider.oid }
      });
      if (!environmentProvider) {
        await db.environmentProvider.upsert({
          where: {
            tenantOid_providerOid: {
              tenantOid: d.tenant.oid,
              providerOid: d.provider.oid
            }
          },
          create: {
            oid: snowflake.nextId(),
            id: `${ID.idPrefixes.environmentProvider}_1${d.tenant.oid.toString(36).padStart(16, '0')}${d.environment.oid.toString(36).padStart(16, '0')}${d.provider.oid.toString(36).padStart(16, '0')}`,
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,
            providerOid: d.provider.oid
          },
          update: {}
        });
      }

      let ids = getId('providerDeployment');

      let inner = await backend.deployment.createProviderDeployment({
        tenant: d.tenant,
        id: ids.id,
        provider: d.provider,
        providerVariant: d.provider.defaultVariant,
        lockedVersion: d.lockedVersion ?? null
      });

      let providerDeployment = await db.providerDeployment.create({
        data: {
          ...ids,

          status: 'active',

          isEphemeral: !!d.input.isEphemeral,
          isDefault: !!d.input.isDefault,
          isEnclaveReconciled: true,

          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,
          privateMetadata: d.input.privateMetadata,
          toolFilter: normalizeToolFilters(d.input.toolFilters),

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          providerOid: d.provider.oid,
          providerVariantOid: d.provider.defaultVariant.oid
        },
        include
      });

      let currentVersion = await db.providerDeploymentVersion.create({
        data: {
          ...getId('providerDeploymentVersion'),
          lockedVersionOid: d.lockedVersion?.oid,
          providerVariantOid: d.provider.defaultVariant.oid,
          deploymentOid: providerDeployment.oid
        },
        include: include.currentVersion.include
      });
      providerDeployment.currentVersion = currentVersion;

      await db.providerDeployment.updateMany({
        where: { oid: providerDeployment.oid },
        data: { currentVersionOid: currentVersion.oid }
      });

      if (d.input.config.type === 'none') {
        let version = await providerDeploymentInternalService.getCurrentVersion({
          environment: d.environment,
          deployment: providerDeployment,
          provider: d.provider
        });

        if (version?.specificationOid) {
          let spec = await db.providerSpecification.findFirstOrThrow({
            where: { oid: version.specificationOid }
          });
          let schema = normalizeJsonSchema(spec.value.specification.configJsonSchema);

          // If the schema is empty, we can just create
          // a default config with empty data, instead of
          // forcing the user to create a config
          if (!schema) {
            d.input.config = {
              type: 'inline',
              data: {}
            };
          }
        }
      }

      if (d.input.config.type === 'config') {
        checkProviderMatch(d.provider, d.input.config.config);

        await db.providerDeployment.update({
          where: { oid: providerDeployment.oid },
          data: { defaultConfigOid: d.input.config.config.oid }
        });
      } else if (d.input.config.type !== 'none') {
        await providerConfigService.createProviderConfig({
          tenant: d.tenant,
          providerDeployment,
          provider: d.provider,
          solution: d.solution,
          environment: d.environment,
          input: {
            name: `Default Config for ${d.input.name}`,
            config: d.input.config,
            metadata: d.input.metadata,
            isEphemeral: false,
            isDefault: true
          }
        });
      }

      if (providerDeployment.isDefault) {
        await db.providerDeployment.updateMany({
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,
            providerOid: d.provider.oid,
            oid: { not: providerDeployment.oid },
            isDefault: true
          },
          data: { isDefault: false }
        });
      }

      await enclaveInternalService.ensureEnclaveForProviderDeployment({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        provider: d.provider,
        providerDeployment
      });

      await addAfterTransactionHook(async () =>
        providerDeploymentCreatedQueue.add({ providerDeploymentId: providerDeployment.id })
      );

      return await db.providerDeployment.findFirstOrThrow({
        where: { oid: providerDeployment.oid },
        include
      });
    });
  }

  async ensureDefaultProviderDeployment(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null };
  }) {
    let currentDefault = await this.getDefaultProviderDeployment(d);
    if (currentDefault) return currentDefault;

    return await defaultLock.usingLock(d.provider.id, async () => {
      let currentDefault = await this.getDefaultProviderDeployment(d);
      if (currentDefault) return currentDefault;

      return await this.createProviderDeployment({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        provider: d.provider,
        input: {
          name: `Default Deployment for ${d.provider.name}`,
          description: 'Auto-created by Metorial',
          config: { type: 'none' },
          isDefault: true
        }
      });
    });
  }

  async updateProviderDeployment(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerDeployment: ProviderDeployment & {
      providerVariant: ProviderVariant;
      provider: Provider;
    };
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;
      toolFilters?: PrismaJson.ToolFilter | null;
    };
  }) {
    checkDeletedEdit(d.providerDeployment, 'update');

    return withTransaction(async db => {
      let providerDeployment = await db.providerDeployment.update({
        where: {
          oid: d.providerDeployment.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          name: d.input.name ?? d.providerDeployment.name,
          description: d.input.description ?? d.providerDeployment.description,
          metadata: d.input.metadata ?? d.providerDeployment.metadata,
          privateMetadata: d.input.privateMetadata ?? d.providerDeployment.privateMetadata,
          toolFilter: d.input.toolFilters
            ? normalizeToolFilters(d.input.toolFilters)
            : d.providerDeployment.toolFilter
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerDeploymentUpdatedQueue.add({ providerDeploymentId: providerDeployment.id })
      );

      return providerDeployment;
    });
  }

  async archiveProviderDeployment(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerDeployment: ProviderDeployment;
  }) {
    checkTenant(d, d.providerDeployment);
    checkDeletedEdit(d.providerDeployment, 'archive');
    await this.assertNoActiveIntegrationProviderLink(d);
    await assertNoActiveIntegrationInstanceProviderDeploymentLink({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      deploymentOid: d.providerDeployment.oid,
      resourceId: d.providerDeployment.id
    });
    await assertNoActiveIdentityCredentialDeploymentLink({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      deploymentOid: d.providerDeployment.oid,
      resourceId: d.providerDeployment.id
    });

    return withTransaction(async db => {
      let archivedAt = new Date();
      let providerDeployment = await db.providerDeployment.update({
        where: {
          oid: d.providerDeployment.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          status: 'archived',
          archivedAt,
          isDefault: false,
          defaultConfigOid: null,
          defaultAuthConfigOid: null
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerDeploymentArchivedQueue.add({
          providerDeploymentId: providerDeployment.id
        })
      );

      return providerDeployment;
    });
  }

  private async getDefaultProviderDeployment(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    provider: Provider;
  }) {
    return await withTransaction(
      db =>
        db.providerDeployment.findFirst({
          where: {
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,
            providerOid: d.provider.oid,
            isDefault: true
          },
          include: { ...include, currentVersion: true }
        }),
      { ifExists: true }
    );
  }

  private async assertNoActiveIntegrationProviderLink(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerDeployment: ProviderDeployment;
  }) {
    let integrationProvider = await db.integrationProvider.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        status: 'active',
        integration: {
          status: 'active'
        },
        currentVersion: {
          deploymentOid: d.providerDeployment.oid
        }
      },
      select: {
        id: true,
        integration: {
          select: {
            id: true
          }
        }
      }
    });
    if (!integrationProvider) return;

    throw new ServiceError(
      badRequestError({
        message:
          'Provider deployment is linked to an active integration provider and cannot be archived directly.',
        code: 'provider_deployment_integration_provider_archive_not_allowed',
        data: {
          id: d.providerDeployment.id,
          integrationProviderId: integrationProvider.id,
          integrationId: integrationProvider.integration.id
        }
      })
    );
  }
}

export let providerDeploymentService = Service.create(
  'providerDeployment',
  () => new providerDeploymentServiceImpl()
).build();
