import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  type Brand,
  db,
  type Environment,
  getId,
  ID,
  type Identity,
  type Provider,
  type ProviderAuthCredentials,
  type ProviderConfig,
  type ProviderDeployment,
  type ProviderDeploymentVersion,
  type ProviderSetupSession,
  type ProviderSetupSessionStatus,
  type ProviderSetupSessionType,
  ProviderSetupSessionTypeConcrete,
  type ProviderSetupSessionUiMode,
  type ProviderType,
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
  resolveProviderAuthConfigs,
  resolveProviderAuthCredentials,
  resolveProviderAuthMethods,
  resolveProviderDeployments,
  resolveProviders
} from '@metorial-subspace/list-utils';
import { checkProviderMatch } from '@metorial-subspace/module-provider-internal';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { addMinutes } from 'date-fns';
import {
  providerSetupSessionCreatedQueue,
  providerSetupSessionUpdatedQueue
} from '../queues/lifecycle/providerSetupSession';
import { providerAuthConfigInclude } from './providerAuthConfig';
import { providerSetupSessionInternalService } from './providerSetupSessionInternal';

let include = {
  identity: true,
  identityCredential: true,
  authConfig: { include: providerAuthConfigInclude },
  deployment: true,
  provider: true,
  authMethod: { include: { specification: { omit: { value: true } } } },
  authCredentials: true,
  config: {
    include: {
      deployment: true,
      specification: { omit: { value: true } },
      fromVault: { include: { deployment: true } }
    }
  }
};

export let providerSetupSessionInclude = include;

let normalizeProviderSetupSessionConfiguration = (
  configuration?: PrismaJson.ProviderSetupSessionConfiguration | null
): PrismaJson.ProviderSetupSessionConfiguration => {
  return {
    providerSearch: {
      groups: configuration?.providerSearch?.groups ?? [],
      collections: configuration?.providerSearch?.collections ?? [],
      categories: configuration?.providerSearch?.categories ?? []
    },
    toolFilters: {
      enabled: configuration?.toolFilters?.enabled ?? false
    },
    ui: {
      layout: configuration?.ui?.layout ?? 'box'
    }
  };
};

class providerSetupSessionServiceImpl {
  async listProviderSetupSessions(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;

    status?: ProviderSetupSessionStatus[];
    allowDeleted?: boolean;

    ids?: string[];
    providerIds?: string[];
    providerAuthMethodIds?: string[];
    providerDeploymentIds?: string[];
    providerAuthConfigIds?: string[];
    providerAuthCredentialsIds?: string[];

    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    let providers = await resolveProviders(d, d.providerIds);
    let deployments = await resolveProviderDeployments(d, d.providerDeploymentIds);
    let authConfigs = await resolveProviderAuthConfigs(d, d.providerAuthConfigIds);
    let authCredentials = await resolveProviderAuthCredentials(
      d,
      d.providerAuthCredentialsIds
    );
    let authMethods = await resolveProviderAuthMethods(d, d.providerAuthMethodIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerSetupSession.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,
              integrationSetupSessionProviderOid: null,

              ...normalizeStatusForList(d).onlyParent,

              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                providers ? { providerOid: providers.in } : undefined!,
                deployments ? { deploymentOid: deployments.in } : undefined!,
                authConfigs ? { authConfigOid: authConfigs.in } : undefined!,
                authCredentials ? { authCredentialsOid: authCredentials.in } : undefined!,
                authMethods ? { authMethodOid: authMethods.in } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getProviderSetupSessionById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerSetupSessionId: string;
    allowDeleted?: boolean;
  }) {
    let providerSetupSession = await db.providerSetupSession.findFirst({
      where: {
        id: d.providerSetupSessionId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        integrationSetupSessionProviderOid: null,
        ...normalizeStatusForGet(d).onlyParent
      },
      include
    });
    if (!providerSetupSession)
      throw new ServiceError(
        notFoundError('provider.setup_session', d.providerSetupSessionId)
      );

    return providerSetupSession;
  }

  async createProviderSetupSession(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    provider?: Provider & { defaultVariant: ProviderVariant | null; type: ProviderType };
    providerDeployment?: ProviderDeployment & {
      provider: Provider;
      providerVariant: ProviderVariant;
      currentVersion:
        | (ProviderDeploymentVersion & { lockedVersion: ProviderVersion | null })
        | null;
    };
    providerConfig?: ProviderConfig;
    identity?: Identity;
    credentials?: ProviderAuthCredentials;
    brand?: Brand;
    input: {
      name?: string;
      authMethodId?: string;
      description?: string;
      metadata?: Record<string, any>;
      privateMetadata?: Record<string, any>;

      expiresAt?: Date;
      redirectUrl?: string;
      type: ProviderSetupSessionType | 'auto';
      uiMode: ProviderSetupSessionUiMode;
      configuration?: PrismaJson.ProviderSetupSessionConfiguration | null;

      authConfigInput?: Record<string, any>;
      configInput?: Record<string, any>;
    };
    import: {
      ip: string;
      ua: string;
      note?: string | undefined;
    };
    internal?: {
      integrationSetupSessionProviderOid?: bigint;
    };
  }) {
    let normalizedConfiguration = normalizeProviderSetupSessionConfiguration(
      d.input.configuration
    );

    checkTenant(d, d.providerDeployment);
    checkTenant(d, d.providerConfig);
    checkTenant(d, d.identity);

    checkDeletedRelation(d.providerDeployment);
    checkDeletedRelation(d.providerConfig);
    checkDeletedRelation(d.identity);
    checkDeletedRelation(d.credentials);

    if (!d.provider) {
      let providerOid: bigint | undefined;

      if (d.providerDeployment) {
        providerOid = d.providerDeployment.providerOid;
      } else if (d.providerConfig) {
        providerOid = d.providerConfig.providerOid;
      } else if (d.credentials) {
        providerOid = d.credentials.providerOid;
      }

      if (providerOid) {
        d.provider = await db.provider.findFirstOrThrow({
          where: {
            oid: providerOid,
            OR: [{ ownerTenantOid: d.tenant.oid }, { access: 'public' }]
          },
          include: { defaultVariant: true, type: true }
        });
      }
    }

    if (!d.provider && (d.input.authConfigInput || d.input.configInput)) {
      throw new ServiceError(
        badRequestError({
          message: 'Auth config or config input provided without provider'
        })
      );
    }

    return withTransaction(async db => {
      let expiresAt = d.input.expiresAt ?? addMinutes(new Date(), 30);
      let inner: {
        authMethodOid?: bigint | null;
        authCredentialsOid?: bigint | null;
        oauthSetupOid?: bigint | null;
        authConfigOid?: bigint | null;
        deploymentOid?: bigint | null;
        configOid?: bigint | null;
      } = {};
      let concreteType: ProviderSetupSessionTypeConcrete | null = null;

      if (d.provider) {
        checkProviderMatch(d.provider, d.credentials);
        checkProviderMatch(d.provider, d.providerDeployment);
        checkProviderMatch(d.provider, d.providerConfig);

        let initialized =
          await providerSetupSessionInternalService.initializeProviderSetupSessionProvider({
            tenant: d.tenant,
            solution: d.solution,
            environment: d.environment,
            provider: d.provider,
            providerDeployment: d.providerDeployment,
            credentials: d.credentials,
            expiresAt,
            input: {
              name: d.input.name,
              authMethodId: d.input.authMethodId,
              description: d.input.description,
              metadata: d.input.metadata,
              type: d.input.type,
              authConfigInput: d.input.authConfigInput,
              configInput: d.input.configInput,
              providerConfig: d.providerConfig,
              toolFilters: normalizedConfiguration.toolFilters?.enabled
                ? { type: 'v1.allow_all' }
                : undefined,
              requiresToolFiltersSelection: normalizedConfiguration.toolFilters?.enabled
            },
            import: {
              ip: d.import.ip,
              ua: d.import.ua
            }
          });

        concreteType = initialized.concreteType;
        inner = initialized.inner as typeof inner;
      }

      if (d.providerConfig) {
        inner.configOid = inner.configOid ?? d.providerConfig.oid;
        inner.deploymentOid = inner.deploymentOid ?? d.providerConfig.deploymentOid;
      }

      let session = await db.providerSetupSession.create({
        data: {
          ...getId('providerSetupSession'),
          ...inner,

          clientSecret: await ID.generateId('providerSetupSession_clientSecret'),

          typeSelected: d.input.type,
          typeConcrete: concreteType,

          uiMode: d.input.uiMode,
          status: 'pending',

          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,
          privateMetadata: d.input.privateMetadata,

          configuration: normalizedConfiguration,
          redirectUrl: d.input.redirectUrl,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          providerOid: d.provider?.oid,
          deploymentOid: d.providerDeployment?.oid ?? d.providerConfig?.deploymentOid,
          identityOid: d.identity?.oid ?? null,
          brandOid: d.brand?.oid,
          authCredentialsOid: inner.authCredentialsOid ?? d.credentials?.oid,
          integrationSetupSessionProviderOid: d.internal?.integrationSetupSessionProviderOid,

          expiresAt
        },
        include
      });

      await db.providerSetupSessionEvent.createMany({
        data: {
          ...getId('providerSetupSessionEvent'),
          type: 'created',
          sessionOid: session.oid
        }
      });

      if (session.authConfigOid) {
        await db.providerSetupSessionEvent.createMany({
          data: {
            ...getId('providerSetupSessionEvent'),
            type: 'auth_config_set',
            sessionOid: session.oid
          }
        });
      }

      await providerSetupSessionInternalService.evaluate({
        session,
        context: { ip: d.import.ip, ua: d.import.ua }
      });

      await addAfterTransactionHook(() =>
        providerSetupSessionCreatedQueue.add({ providerSetupSessionId: session.id })
      );

      return await db.providerSetupSession.findUniqueOrThrow({
        where: { oid: session.oid },
        include
      });
    });
  }

  async updateProviderSetupSession(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    providerSetupSession: ProviderSetupSession;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      identity?: Identity;
    };
  }) {
    checkDeletedEdit(d.providerSetupSession, 'update');
    checkTenant(d, d.input.identity);
    checkDeletedRelation(d.input.identity);

    let providerSetupSession = d.providerSetupSession;

    if (
      d.input.identity &&
      (providerSetupSession.identityCredentialOid ||
        d.providerSetupSession.status !== 'pending') &&
      providerSetupSession.identityOid !== d.input.identity.oid
    ) {
      throw new ServiceError(
        badRequestError({
          message:
            'Cannot change the linked identity after an identity credential has been created'
        })
      );
    }

    return withTransaction(async db => {
      let config = await db.providerSetupSession.update({
        where: {
          oid: d.providerSetupSession.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
        },
        data: {
          name: d.input.name ?? d.providerSetupSession.name,
          description: d.input.description ?? d.providerSetupSession.description,
          metadata: d.input.metadata ?? d.providerSetupSession.metadata,
          identityOid: d.input.identity?.oid ?? providerSetupSession.identityOid
        },
        include
      });

      await addAfterTransactionHook(() =>
        providerSetupSessionUpdatedQueue.add({ providerSetupSessionId: config.id })
      );

      return config;
    });
  }
}

export let providerSetupSessionService = Service.create(
  'providerSetupSession',
  () => new providerSetupSessionServiceImpl()
).build();
