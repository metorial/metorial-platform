import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Provider,
  type ProviderAuthConfig,
  type ProviderAuthConfigSource,
  type ProviderAuthConfigStatus,
  type ProviderAuthCredentials,
  type ProviderAuthImport,
  type ProviderDeployment,
  type ProviderDeploymentVersion,
  type ProviderVariant,
  type ProviderVersion,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  checkDeletedRelation,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList,
  resolveIdentities,
  resolveIdentityActors,
  resolveIdentityCredentials,
  resolveProviderAuthCredentials,
  resolveProviderAuthMethods,
  resolveProviderDeployments,
  resolveProviders
} from '@metorial-subspace/list-utils';
import {
  checkProviderMatch,
  normalizeToolFilters
} from '@metorial-subspace/module-provider-internal';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { checkTenant } from '@metorial-subspace/module-tenant';
import {
  providerAuthConfigArchivedQueue,
  providerAuthConfigUpdatedQueue
} from '../queues/lifecycle/providerAuthConfig';
import { providerAuthConfigInternalService } from './providerAuthConfigInternal';
import { providerAuthCredentialsService } from './providerAuthCredentials';

let include = {
  provider: true,
  deployment: true,
  authCredentials: true,
  authMethod: { include: { specification: { omit: { value: true } } } }
};

export let providerAuthConfigInclude = include;

class providerAuthConfigServiceImpl {
  async listProviderAuthConfigs(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: ProviderAuthConfigStatus[];
    allowDeleted?: boolean;

    search?: string;

    ids?: string[];
    providerIds?: string[];
    providerDeploymentIds?: string[];
    providerAuthCredentialsIds?: string[];
    providerAuthMethodIds?: string[];
    actorIds?: string[];
    identityIds?: string[];
    identityCredentialIds?: string[];

    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let providers = await resolveProviders(d, d.providerIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let credentials = await resolveProviderAuthCredentials(d, d.providerAuthCredentialsIds);
    let authMethods = await resolveProviderAuthMethods(d, d.providerAuthMethodIds);
    let actors = await resolveIdentityActors(d, d.actorIds);
    let identities = await resolveIdentities(d, d.identityIds);
    let identityCredentials = await resolveIdentityCredentials(d, d.identityCredentialIds);

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.providerAuthConfig.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerAuthConfig.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,
              isEphemeral: false,

              ...normalizeStatusForList(d).hasParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                deployments ? { deploymentOid: deployments.in } : undefined!,
                credentials ? { authCredentialsOid: credentials.in } : undefined!,
                authMethods ? { authMethodOid: authMethods.in } : undefined!,
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
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getProviderAuthConfigById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerAuthConfigId: string;
    allowDeleted?: boolean;
  }) {
    let providerAuthConfig = await db.providerAuthConfig.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,

        OR: [
          { id: d.providerAuthConfigId },
          { providerSetupSession: { id: d.providerAuthConfigId } }
        ],

        ...normalizeStatusForGet(d).hasParent
      },
      include
    });
    if (!providerAuthConfig)
      throw new ServiceError(notFoundError('provider.auth_config', d.providerAuthConfigId));

    return providerAuthConfig;
  }

  async getProviderAuthConfigSchema(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    provider?: Provider & { defaultVariant: ProviderVariant | null };
    providerVersion?: ProviderVersion;
    providerDeployment?: ProviderDeployment & {
      provider: Provider;
      providerVariant: ProviderVariant;
      currentVersion:
        | (ProviderDeploymentVersion & { lockedVersion: ProviderVersion | null })
        | null;
    };

    providerAuthConfig?: ProviderAuthConfig & { deployment: ProviderDeployment | null };

    authMethodId?: string;
  }) {
    if (d.providerAuthConfig) {
      let authMethod = await db.providerAuthMethod.findFirstOrThrow({
        where: { oid: d.providerAuthConfig.authMethodOid },
        include: { specification: true, provider: true }
      });
      return {
        provider: authMethod.provider,
        authMethod,
        specification: authMethod.specification
      };
    }

    let provider: (Provider & { defaultVariant: ProviderVariant | null }) | undefined;
    if (d.provider) {
      provider = d.provider;
    } else if (d.providerDeployment) {
      provider = await db.provider.findFirstOrThrow({
        where: { oid: d.providerDeployment.providerOid },
        include: { defaultVariant: true }
      });
    } else if (d.providerVersion) {
      provider = await db.provider.findFirstOrThrow({
        where: { oid: d.providerVersion.providerOid },
        include: { defaultVariant: true }
      });
    }

    if (!provider) {
      throw new ServiceError(
        badRequestError({
          message:
            'Must provide provider, provider deployment, provider version, or provider auth config to get schema',
          code: 'missing_provider_information'
        })
      );
    }

    let { authMethod } = await providerAuthConfigInternalService.getVersionAndAuthMethod({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,

      provider,
      providerDeployment: d.providerDeployment,
      authMethodId: d.authMethodId
    });

    return {
      provider,
      authMethod,
      specification: authMethod.specification
    };
  }

  async createProviderAuthConfig(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerDeployment?: ProviderDeployment & {
      provider: Provider;
      providerVariant: ProviderVariant;
      currentVersion:
        | (ProviderDeploymentVersion & { lockedVersion: ProviderVersion | null })
        | null;
    };
    source: ProviderAuthConfigSource;
    credentials?: ProviderAuthCredentials;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      isEphemeral?: boolean;
      isDefault?: boolean;
      authMethodId?: string;
      toolFilters?: PrismaJson.ToolFilter | null;
      config: Record<string, any>;
    };
    import: {
      ip: string | undefined;
      ua: string | undefined;
      note?: string | undefined;
    };
  }) {
    checkTenant(d, d.providerDeployment);
    checkDeletedRelation(d.providerDeployment, { allowEphemeral: d.input.isEphemeral });
    checkProviderMatch(d.provider, d.providerDeployment);
    checkProviderMatch(d.provider, d.credentials);

    if (d.input.isDefault && !d.providerDeployment) {
      throw new ServiceError(
        badRequestError({
          message: 'Default provider configs must be associated with a deployment',
          code: 'default_config_requires_deployment'
        })
      );
    }

    return withTransaction(async db => {
      if (!d.provider.defaultVariant) {
        throw new Error('Provider has no default variant');
      }

      let { version, authMethod } =
        await providerAuthConfigInternalService.getVersionAndAuthMethod({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          provider: d.provider,
          providerDeployment: d.providerDeployment,
          authMethodId: d.input.authMethodId
        });

      let credentials = d.credentials;

      if (credentials && authMethod.type === 'oauth') {
        credentials =
          await providerAuthCredentialsService.getProviderAuthCredentialsForBackendUse({
            tenant: d.tenant,
            solution: d.solution,
            provider: d.provider,
            providerAuthCredentials: credentials,
            providerAuthMethod: authMethod
          });
      }

      let backendRes = await providerAuthConfigInternalService.createBackendProviderAuthConfig(
        {
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,

          provider: d.provider,
          providerVersion: version,
          authMethod,

          config: d.input.config
        }
      );

      return await providerAuthConfigInternalService.createProviderAuthConfigInternal({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        provider: d.provider,
        providerDeployment: d.providerDeployment,
        source: d.source,
        input: {
          ...d.input,
          toolFilters: normalizeToolFilters(d.input.toolFilters)
        },
        import: d.import,
        authMethod,
        credentials,
        backend: backendRes.backend,
        backendProviderAuthConfig: backendRes.backendProviderAuthConfig,
        type: authMethod.type === 'oauth' ? 'oauth_manual' : 'manual'
      });
    });
  }

  async updateProviderAuthConfig(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerAuthConfig: ProviderAuthConfig & { authMethod: { id: string } };

    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      config?: Record<string, any>;

      authMethodId?: string;
      toolFilters?: PrismaJson.ToolFilter | null;
    };

    import: {
      ip: string | undefined;
      ua: string | undefined;
      note?: string | undefined;
    };
  }) {
    checkTenant(d, d.providerAuthConfig);
    checkDeletedEdit(d.providerAuthConfig, 'update');

    if (d.providerAuthConfig.type === 'oauth_automated') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update automated OAuth provider auth configs',
          code: 'cannot_update_automated_oauth_config'
        })
      );
    }

    return withTransaction(async db => {
      let provider = await db.provider.findFirstOrThrow({
        where: { oid: d.providerAuthConfig.providerOid },
        include: { defaultVariant: true }
      });
      let providerDeployment = d.providerAuthConfig.deploymentOid
        ? await db.providerDeployment.findFirstOrThrow({
            where: { oid: d.providerAuthConfig.deploymentOid },
            include: { currentVersion: { include: { lockedVersion: true } } }
          })
        : undefined;

      let { version, authMethod } =
        await providerAuthConfigInternalService.getVersionAndAuthMethod({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          provider: provider,
          providerDeployment,
          authMethodId: d.providerAuthConfig.authMethod.id
        });

      if (d.input.authMethodId && d.input.authMethodId !== authMethod.id) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot change auth method of existing auth config',
            code: 'cannot_change_auth_method'
          })
        );
      }

      let backendRes = d.input.config
        ? await providerAuthConfigInternalService.createBackendProviderAuthConfig({
            tenant: d.tenant,
            solution: d.solution,
            environment: d.environment,

            provider,
            providerVersion: version,
            authMethod,

            config: d.input.config
          })
        : undefined;

      let newConfigVersion = await db.providerAuthConfigVersion.create({
        data: {
          ...getId('providerAuthConfigVersion'),
          authConfigOid: d.providerAuthConfig.oid,
          slateAuthConfigOid: backendRes?.backendProviderAuthConfig.slateAuthConfig?.oid,
          shuttleAuthConfigOid: backendRes?.backendProviderAuthConfig.shuttleAuthConfig?.oid
        }
      });
      let fromVersionOid = d.providerAuthConfig.currentVersionOid;

      let config = await db.providerAuthConfig.update({
        where: {
          oid: d.providerAuthConfig.oid
        },
        data: {
          name: d.input.name?.trim() || d.providerAuthConfig.name,
          description: d.input.description?.trim() || d.providerAuthConfig.description,
          metadata: d.input.metadata ?? d.providerAuthConfig.metadata,
          toolFilter:
            d.input.toolFilters || d.input.toolFilters === null
              ? normalizeToolFilters(d.input.toolFilters)
              : d.providerAuthConfig.toolFilter,

          currentVersionOid: newConfigVersion.oid
        },
        include
      });

      let authImport: ProviderAuthImport | undefined;

      if (backendRes) {
        let update = await db.providerAuthConfigUpdate.create({
          data: {
            ...getId('providerAuthConfigUpdate'),
            authConfigOid: config.oid,
            fromVersionOid: fromVersionOid,
            toVersionOid: newConfigVersion.oid
          }
        });

        authImport = await db.providerAuthImport.create({
          data: {
            ...getId('providerAuthImport'),

            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,

            authConfigOid: config.oid,
            authConfigUpdateOid: update.oid,
            deploymentOid: d.providerAuthConfig.deploymentOid,

            ip: d.import.ip,
            ua: d.import.ua,
            note: d.import.note,
            metadata: d.input.metadata
          }
        });
      }

      await addAfterTransactionHook(async () =>
        providerAuthConfigUpdatedQueue.add({ providerAuthConfigId: config.id })
      );

      return {
        ...config,
        authImport
      };
    });
  }

  async archiveProviderAuthConfig(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerAuthConfig: ProviderAuthConfig;
  }) {
    checkTenant(d, d.providerAuthConfig);
    checkDeletedEdit(d.providerAuthConfig, 'archive');

    return withTransaction(async db => {
      let archivedAt = new Date();
      let providerAuthConfig = await db.providerAuthConfig.update({
        where: {
          oid: d.providerAuthConfig.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: {
          status: 'archived',
          archivedAt,
          isDefault: false
        },
        include
      });

      await addAfterTransactionHook(async () =>
        providerAuthConfigArchivedQueue.add({
          providerAuthConfigId: providerAuthConfig.id
        })
      );

      return providerAuthConfig;
    });
  }
}

export let providerAuthConfigService = Service.create(
  'providerAuthConfig',
  () => new providerAuthConfigServiceImpl()
).build();
