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
  type ProviderDeployment,
  type ProviderDeploymentVersion,
  type ProviderSetupSession,
  type ProviderSetupSessionStatus,
  type ProviderSetupSessionType,
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
import { providerAuthConfigInternalService } from './providerAuthConfigInternal';
import { providerSetupSessionInternalService } from './providerSetupSessionInternal';
import { providerSetupSessionUiService } from './providerSetupSessionUi';

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
    identity?: Identity;
    credentials?: ProviderAuthCredentials;
    brand?: Brand;
    input: {
      name?: string;
      authMethodId?: string;
      description?: string;
      metadata?: Record<string, any>;
      expiresAt?: Date;
      redirectUrl?: string;
      type: ProviderSetupSessionType;
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
  }) {
    let normalizedConfiguration = normalizeProviderSetupSessionConfiguration(
      d.input.configuration
    );

    checkTenant(d, d.providerDeployment);
    checkTenant(d, d.identity);

    checkDeletedRelation(d.providerDeployment);
    checkDeletedRelation(d.identity);
    checkDeletedRelation(d.credentials);

    if (!d.provider) {
      let providerOid: bigint | undefined;

      if (d.providerDeployment) {
        providerOid = d.providerDeployment.providerOid;
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

    if (d.provider) {
      checkProviderMatch(d.provider, d.credentials);
      checkProviderMatch(d.provider, d.providerDeployment);
    }

    if (d.input.type === 'config_only' && d.input.authConfigInput) {
      throw new ServiceError(
        badRequestError({
          message: 'Auth config input provided for config_only session type'
        })
      );
    }
    if (d.input.type === 'auth_only' && d.input.configInput) {
      throw new ServiceError(
        badRequestError({
          message: 'Config input provided for auth_only session type'
        })
      );
    }

    return withTransaction(async db => {
      let expiresAt = d.input.expiresAt ?? addMinutes(new Date(), 30);
      let inner: Partial<ProviderSetupSession> = {};

      if (d.provider) {
        if (!d.provider.defaultVariant) {
          throw new Error('Provider has no default variant');
        }

        let { authMethod } = await providerAuthConfigInternalService.getVersionAndAuthMethod({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          provider: d.provider,
          providerDeployment: d.providerDeployment,
          authMethodId: d.input.authMethodId ?? (d.credentials ? 'oauth' : undefined)
        });

        inner.authMethodOid = authMethod.oid;

        if (d.credentials && authMethod.type !== 'oauth') d.credentials = undefined;
        if (
          authMethod.type === 'oauth' &&
          !d.credentials &&
          d.provider.type.attributes.auth.oauth?.oauthAutoRegistration?.status !== 'supported'
        ) {
          let defaultCredentials = await db.providerAuthCredentials.findFirst({
            where: {
              providerOid: d.provider.oid,
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,
              isDefault: true,
              status: 'active'
            }
          });

          if (!defaultCredentials) {
            throw new ServiceError(
              badRequestError({
                message: 'No default provider auth credentials found for oauth method',
                code: 'missing_oauth_credentials'
              })
            );
          }

          d.credentials = defaultCredentials;
        }

        if (d.input.authConfigInput && d.input.type !== 'config_only') {
          let authConfigInner =
            await providerSetupSessionInternalService.createProviderAuthConfig({
              tenant: d.tenant,
              solution: d.solution,
              environment: d.environment,
              provider: d.provider,
              providerDeployment: d.providerDeployment,
              credentials: d.credentials,
              authMethod,
              expiresAt,
              input: {
                name: d.input.name,
                description: d.input.description,
                metadata: d.input.metadata,
                toolFilters: normalizedConfiguration.toolFilters?.enabled
                  ? { type: 'v1.allow_all' }
                  : undefined,
                config: d.input.authConfigInput
              },
              import: {
                ip: d.import.ip,
                ua: d.import.ua
              }
            });

          inner = { ...inner, ...authConfigInner };
        }

        if (d.input.type !== 'auth_only' && !d.input.configInput) {
          let configRes = await providerSetupSessionUiService.getConfigSchemaWithoutSession({
            tenant: d.tenant,
            solution: d.solution,
            environment: d.environment,
            provider: d.provider,
            deployment: d.providerDeployment
          });

          if (configRes.type === 'none') {
            d.input.configInput = {};
          }
        }

        if (d.input.configInput && d.input.type !== 'auth_only') {
          let configInner = await providerSetupSessionInternalService.createProviderConfig({
            tenant: d.tenant,
            solution: d.solution,
            environment: d.environment,
            provider: d.provider,
            providerDeployment: d.providerDeployment,
            input: {
              name: d.input.name,
              description: d.input.description,
              metadata: d.input.metadata,
              toolFilters: normalizedConfiguration.toolFilters?.enabled
                ? { type: 'v1.allow_all' }
                : undefined,
              config: d.input.configInput
            }
          });

          inner = { ...inner, ...configInner };
        }
      }

      let session = await db.providerSetupSession.create({
        data: {
          ...getId('providerSetupSession'),
          ...inner,

          clientSecret: await ID.generateId('providerSetupSession_clientSecret'),

          type: d.input.type,
          uiMode: d.input.uiMode,
          status: 'pending',

          name: d.input.name?.trim() || undefined,
          description: d.input.description?.trim() || undefined,
          metadata: d.input.metadata,
          configuration: normalizedConfiguration,
          redirectUrl: d.input.redirectUrl,

          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          providerOid: d.provider?.oid,
          deploymentOid: d.providerDeployment?.oid,
          identityOid: d.identity?.oid ?? null,
          brandOid: d.brand?.oid,
          authCredentialsOid: d.credentials?.oid,

          expiresAt
        } as any,
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
