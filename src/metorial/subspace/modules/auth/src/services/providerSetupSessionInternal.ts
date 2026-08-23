import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  type Environment,
  getId,
  type Provider,
  type ProviderAuthCredentials,
  type ProviderAuthMethod,
  type ProviderConfig,
  type ProviderDeployment,
  type ProviderDeploymentVersion,
  type ProviderOAuthSetup,
  type ProviderSetupSession,
  ProviderSetupSessionTypeConcrete,
  type ProviderType,
  type ProviderVariant,
  type ProviderVersion,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import type { ProviderSetupSessionUncheckedUpdateInput } from '@metorial-subspace/db/prisma/generated/models';
import { providerConfigService } from '@metorial-subspace/module-deployment';
import { identityCredentialService } from '@metorial-subspace/module-identity';
import { getMetorialSolution } from '@metorial-subspace/module-tenant';
import { checkProviderMatch } from '@metorial-subspace/module-provider-internal';
import { normalizeJsonSchema } from '@metorial-subspace/provider-utils';
import { providerSetupSessionUpdatedQueue } from '../queues/lifecycle/providerSetupSession';
import { providerAuthConfigService } from './providerAuthConfig';
import { providerAuthConfigInternalService } from './providerAuthConfigInternal';
import { providerOAuthSetupService } from './providerOAuthSetup';

class providerSetupSessionInternalServiceImpl {
  async initializeProviderSetupSessionProvider(d: {
    tenant: Tenant;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null; type: ProviderType };
    providerDeployment?: ProviderDeployment & {
      provider: Provider;
      providerVariant: ProviderVariant;
      currentVersion:
        | (ProviderDeploymentVersion & { lockedVersion: ProviderVersion | null })
        | null;
    };
    credentials?: ProviderAuthCredentials;
    expiresAt: Date;
    input: {
      name?: string;
      authMethodId?: string;
      description?: string;
      metadata?: Record<string, any>;
      type: ProviderSetupSessionTypeConcrete | 'auto';
      authConfigInput?: Record<string, any>;
      configInput?: Record<string, any>;
      providerConfig?: ProviderConfig;
      toolFilters?: PrismaJson.ToolFilter | null;
      requiresToolFiltersSelection?: boolean;
    };
    import: {
      ip: string | undefined;
      ua: string | undefined;
    };
  }) {
    let solution = await getMetorialSolution();
    return withTransaction(
      async db => {
        if (!d.provider.defaultVariant) {
          throw new Error('Provider has no default variant');
        }

        let concreteType: ProviderSetupSessionTypeConcrete;

        if (d.input.type === 'auto') {
          if (
            d.provider.type.attributes.config.status === 'enabled' &&
            d.provider.type.attributes.auth.status === 'enabled'
          ) {
            concreteType = 'auth_and_config';
          } else if (d.provider.type.attributes.auth.status === 'enabled') {
            concreteType = 'auth_only';
          } else {
            concreteType = 'config_only';
          }
        } else {
          concreteType = d.input.type;
        }

        if (concreteType === 'config_only' && d.input.authConfigInput) {
          throw new ServiceError(
            badRequestError({
              message: 'Auth config input provided for config_only session type'
            })
          );
        }
        if (concreteType === 'auth_only' && d.input.configInput) {
          throw new ServiceError(
            badRequestError({
              message: 'Config input provided for auth_only session type'
            })
          );
        }

        let inner: ProviderSetupSessionUncheckedUpdateInput = {};
        let credentials = d.credentials;
        let configInput = d.input.configInput;
        let originalConcreteType = concreteType;

        if (concreteType === 'auth_only' || concreteType === 'auth_and_config') {
          let { authMethod } = await providerAuthConfigInternalService.getVersionAndAuthMethod(
            {
              tenant: d.tenant,
              environment: d.environment,
              provider: d.provider,
              providerDeployment: d.providerDeployment,
              authMethodId: d.input.authMethodId,
              credentials
            }
          );

          if (credentials && authMethod.type !== 'oauth') credentials = undefined;
          if (
            authMethod.type === 'oauth' &&
            !credentials &&
            d.provider.type.attributes.auth.oauth?.oauthAutoRegistration?.status !==
              'supported'
          ) {
            let defaultCredentials = await db.providerAuthCredentials.findFirst({
              where: {
                providerOid: d.provider.oid,
                tenantOid: d.tenant.oid,
                solutionOid: solution.oid,
                environmentOid: d.environment.oid,
                isDefault: true,
                status: 'active'
              }
            });

            if (!defaultCredentials) {
              if (d.input.type === 'auto' && concreteType === 'auth_and_config') {
                concreteType = 'config_only';
              } else {
                throw new ServiceError(
                  badRequestError({
                    message: 'No default provider auth credentials found for oauth method',
                    code: 'missing_auth_credentials'
                  })
                );
              }
            } else {
              credentials = defaultCredentials;
            }
          }

          if (concreteType !== 'config_only') {
            inner.authMethodOid = authMethod.oid;
            inner.authCredentialsOid = credentials?.oid;

            if (d.input.authConfigInput) {
              let authConfigInner = await this.createProviderAuthConfigInternal({
                tenant: d.tenant,
                environment: d.environment,
                provider: d.provider,
                providerDeployment: d.providerDeployment,
                credentials,
                authMethod,
                expiresAt: d.expiresAt,
                input: {
                  name: d.input.name,
                  description: d.input.description,
                  metadata: d.input.metadata,
                  toolFilters: d.input.toolFilters,
                  config: d.input.authConfigInput
                },
                import: {
                  ip: d.import.ip,
                  ua: d.import.ua
                }
              });

              inner = { ...inner, ...authConfigInner };
            }
          }
        }

        if (
          concreteType !== 'auth_only' &&
          !configInput &&
          !d.input.providerConfig &&
          !(concreteType === 'config_only' && d.input.requiresToolFiltersSelection)
        ) {
          let configSchema = await this.getProviderConfigSchemaType({
            tenant: d.tenant,
            environment: d.environment,
            provider: d.provider,
            deployment: d.providerDeployment
          });

          if (configSchema.type === 'none') {
            configInput = {};
          }
        }

        if (concreteType !== 'auth_only' && configInput) {
          let configInner = await this.createProviderConfig({
            tenant: d.tenant,
            environment: d.environment,
            provider: d.provider,
            providerDeployment: d.providerDeployment,
            input: {
              name: d.input.name,
              description: d.input.description,
              metadata: d.input.metadata,
              toolFilters: d.input.toolFilters,
              config: configInput
            }
          });

          inner = { ...inner, ...configInner };
        }

        if (concreteType !== 'auth_only' && d.input.providerConfig) {
          inner.configOid = d.input.providerConfig.oid;
          inner.deploymentOid = inner.deploymentOid ?? d.input.providerConfig.deploymentOid;
        }

        return { concreteType, inner };
      },
      { ifExists: true }
    );
  }

  async createProviderAuthConfigInternal(d: {
    tenant: Tenant;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null; type: ProviderType };
    providerDeployment?: ProviderDeployment & {
      provider: Provider;
      providerVariant: ProviderVariant;
      currentVersion:
        | (ProviderDeploymentVersion & { lockedVersion: ProviderVersion | null })
        | null;
    };
    credentials?: ProviderAuthCredentials;
    authMethod: ProviderAuthMethod;
    expiresAt: Date;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      toolFilters?: PrismaJson.ToolFilter | null;
      config: Record<string, any>;
    };
    import: {
      ip: string | undefined;
      ua: string | undefined;
    };
  }) {
    checkProviderMatch(d.provider, d.credentials);
    checkProviderMatch(d.provider, d.providerDeployment);
    checkProviderMatch(d.provider, d.authMethod);

    if (d.authMethod.type === 'oauth') {
      if (
        !d.credentials &&
        d.provider.type.attributes.auth.oauth?.oauthAutoRegistration?.status !== 'supported'
      ) {
        throw new ServiceError(
          badRequestError({
            message: 'No provider auth credentials provided for oauth method',
            code: 'missing_auth_credentials'
          })
        );
      }

      let setup = await providerOAuthSetupService.createProviderOAuthSetupInternal({
        tenant: d.tenant,
        environment: d.environment,
        provider: d.provider,
        providerDeployment: d.providerDeployment,
        credentials: d.credentials,
        input: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,
          toolFilters: d.input.toolFilters,
          config: d.input.config,
          authMethodId: d.authMethod.id,
          expiresAt: d.expiresAt
        }
      });

      return {
        oauthSetupOid: setup.oid,
        deploymentOid: setup.deploymentOid,
        authConfigOid: setup.authConfigOid,
        authMethodOid: setup.authMethodOid,
        authCredentialsOid: setup.authCredentialsOid
      };
    } else {
      let config = await providerAuthConfigService.createProviderAuthConfigInternal({
        tenant: d.tenant,
        environment: d.environment,
        provider: d.provider,
        providerDeployment: d.providerDeployment,
        import: d.import,
        source: 'setup_session',
        input: {
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata,
          isEphemeral: true,
          toolFilters: d.input.toolFilters,
          config: d.input.config,
          authMethodId: d.authMethod.id
        }
      });

      return {
        authConfigOid: config.oid,
        deploymentOid: config.deploymentOid,
        authMethodOid: config.authMethodOid,
        authCredentialsOid: config.currentVersion.authCredentialsOid
      };
    }
  }

  async createProviderConfig(d: {
    tenant: Tenant;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    providerDeployment?: ProviderDeployment & {
      provider: Provider;
      providerVariant: ProviderVariant;
      currentVersion:
        | (ProviderDeploymentVersion & { lockedVersion: ProviderVersion | null })
        | null;
    };
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      toolFilters?: PrismaJson.ToolFilter | null;
      config: Record<string, any>;
    };
  }) {
    checkProviderMatch(d.provider, d.providerDeployment);

    let config = await providerConfigService.createProviderConfigInternal({
      tenant: d.tenant,
      environment: d.environment,
      provider: d.provider,
      providerDeployment: d.providerDeployment,
      input: {
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata,
        isEphemeral: true,
        toolFilters: d.input.toolFilters,
        config: { type: 'inline', data: d.input.config }
      }
    });

    return {
      configOid: config.oid,
      deploymentOid: config.deploymentOid
    };
  }

  async oauthSetupCompleted(d: {
    session: ProviderSetupSession;
    setup: ProviderOAuthSetup;
    context: { ip: string; ua: string };
  }) {
    return withTransaction(async db => {
      if (
        d.session.status === 'completed' ||
        d.session.status === 'failed' ||
        d.session.status === 'archived' ||
        d.session.status === 'deleted' ||
        d.session.status === 'expired'
      )
        return d.setup;

      if (d.setup.status === 'completed') {
        await db.providerSetupSession.update({
          where: { oid: d.session.oid },
          data: {
            authCredentialsOid: d.setup.authCredentialsOid ?? undefined,
            authConfigOid: d.setup.authConfigOid ?? undefined
          }
        });

        if (d.setup.authConfigOid) {
          await db.providerAuthConfig.update({
            where: { oid: d.setup.authConfigOid },
            data: { metadata: d.session.metadata }
          });
        }

        await db.providerSetupSessionEvent.createMany({
          data: [
            {
              ...getId('providerSetupSessionEvent'),
              type: 'oauth_setup_completed',
              ip: d.context.ip,
              ua: d.context.ua,
              sessionOid: d.session.oid,
              setupOid: d.setup.oid
            },
            {
              ...getId('providerSetupSessionEvent'),
              type: 'auth_config_set',
              ip: d.context.ip,
              ua: d.context.ua,
              sessionOid: d.session.oid,
              setupOid: d.setup.oid
            }
          ]
        });

        d.setup = await db.providerOAuthSetup.update({
          where: { oid: d.setup.oid },
          data: { redirectUrl: d.session.redirectUrl }
        });
      } else if (d.setup.status === 'failed') {
        await db.providerSetupSession.update({
          where: { oid: d.session.oid },
          data: {
            status: 'failed',
            authCredentialsOid: d.setup.authCredentialsOid ?? undefined,
            authConfigOid: d.setup.authConfigOid ?? undefined
          }
        });

        await db.providerSetupSessionEvent.createMany({
          data: {
            ...getId('providerSetupSessionEvent'),
            type: 'oauth_setup_failed',
            ip: d.context.ip,
            ua: d.context.ua,
            sessionOid: d.session.oid,
            setupOid: d.setup.oid
          }
        });
      } else {
        let now = new Date();
        let setupExpired = d.setup.status === 'expired' || d.setup.expiresAt <= now;
        let sessionExpired = d.session.expiresAt <= now;

        if (setupExpired || sessionExpired) {
          if (d.setup.status !== 'expired' && d.setup.expiresAt <= now) {
            d.setup = await db.providerOAuthSetup.update({
              where: { oid: d.setup.oid },
              data: { status: 'expired' }
            });
          }

          await db.providerSetupSession.update({
            where: { oid: d.session.oid },
            data: { status: 'expired' }
          });

          await db.providerSetupSessionEvent.createMany({
            data: {
              ...getId('providerSetupSessionEvent'),
              type: 'expired',
              ip: d.context.ip,
              ua: d.context.ua,
              sessionOid: d.session.oid,
              setupOid: d.setup.oid
            }
          });

          addAfterTransactionHook(async () =>
            providerSetupSessionUpdatedQueue.add({ providerSetupSessionId: d.session.id })
          );
        }

        return d.setup;
      }

      if (d.setup.status === 'completed') {
        await this.evaluate({
          session: d.session,
          context: { ip: d.context.ip, ua: d.context.ua }
        });
      }

      addAfterTransactionHook(async () =>
        providerSetupSessionUpdatedQueue.add({ providerSetupSessionId: d.session.id })
      );

      return d.setup;
    });
  }

  async evaluate(d: { session: ProviderSetupSession; context: { ip: string; ua: string } }) {
    if (
      d.session.status === 'completed' ||
      d.session.status === 'archived' ||
      d.session.status === 'deleted' ||
      d.session.status === 'expired'
    )
      return d.session;

    return withTransaction(async db => {
      let currentSession = await db.providerSetupSession.findFirstOrThrow({
        where: { oid: d.session.oid },
        include: { authConfig: true, config: true }
      });
      d.session = currentSession;
      let result = d.session;

      if (
        currentSession.authConfig &&
        currentSession.authConfig.toolFilter.type != 'v1.allow_all' &&
        currentSession.config
      ) {
        await db.providerConfig.updateMany({
          where: { oid: currentSession.config.oid },
          data: { toolFilter: currentSession.authConfig.toolFilter }
        });
      } else if (
        currentSession.config &&
        currentSession.config.toolFilter.type != 'v1.allow_all' &&
        currentSession.authConfig
      ) {
        await db.providerAuthConfig.updateMany({
          where: { oid: currentSession.authConfig.oid },
          data: { toolFilter: currentSession.config.toolFilter }
        });
      }

      let hasAuthConfig = d.session.authConfigOid !== null;
      let hasConfig = d.session.configOid !== null;

      let isComplete = false;

      if (d.session.typeConcrete === 'auth_only' && hasAuthConfig) isComplete = true;

      if (d.session.typeConcrete === 'auth_and_config' && hasAuthConfig && hasConfig)
        isComplete = true;

      if (d.session.typeConcrete === 'config_only' && hasConfig) isComplete = true;

      if (isComplete) {
        result = await db.providerSetupSession.update({
          where: { oid: d.session.oid },
          data: { status: 'completed' }
        });

        let completedSession = result as ProviderSetupSession & {
          identityOid: bigint | null;
          identityCredentialOid: bigint | null;
        };

        await db.providerSetupSessionEvent.createMany({
          data: [
            {
              ...getId('providerSetupSessionEvent'),
              type: 'completed',
              sessionOid: d.session.oid,
              ip: d.context.ip,
              ua: d.context.ua
            }
          ]
        });

        if (completedSession.identityOid && !completedSession.identityCredentialOid) {
          let identity = await db.identity.findFirstOrThrow({
            where: {
              oid: completedSession.identityOid,
              tenantOid: completedSession.tenantOid,
              solutionOid: completedSession.solutionOid,
              environmentOid: completedSession.environmentOid
            }
          });

          let tenant = await db.tenant.findFirstOrThrow({
            where: { oid: completedSession.tenantOid }
          });
          let environment = await db.environment.findFirstOrThrow({
            where: { oid: completedSession.environmentOid }
          });
          let deployment = completedSession.deploymentOid
            ? await db.providerDeployment.findFirstOrThrow({
                where: { oid: completedSession.deploymentOid }
              })
            : null;
          let config = completedSession.configOid
            ? await db.providerConfig.findFirstOrThrow({
                where: { oid: completedSession.configOid }
              })
            : null;
          let authConfig = completedSession.authConfigOid
            ? await db.providerAuthConfig.findFirstOrThrow({
                where: { oid: completedSession.authConfigOid }
              })
            : null;

          let identityCredential =
            await identityCredentialService.createIdentityCredentialInternal({
              tenant,
              environment,
              identity,
              input: {
                deploymentId: deployment?.id,
                configId: config?.id,
                authConfigId: authConfig?.id
              }
            });

          result = await db.providerSetupSession.update({
            where: { oid: result.oid },
            data: { identityCredentialOid: identityCredential.oid }
          });
        }
      }

      return result;
    });
  }

  private async getProviderConfigSchemaType(d: {
    tenant: Tenant;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    deployment?: ProviderDeployment & {
      currentVersion: ProviderDeploymentVersion | null;
    };
  }) {
    let schema = await providerConfigService.getProviderConfigSchemaInternal({
      tenant: d.tenant,
      environment: d.environment,
      provider: d.provider,
      providerDeployment: d.deployment ?? undefined
    });

    let configSchema = normalizeJsonSchema(schema.value.specification.configJsonSchema);
    if (!configSchema) {
      return { type: 'none' as const };
    }

    let hasProperties =
      typeof configSchema === 'object' &&
      'properties' in configSchema &&
      Object.keys(configSchema.properties || {}).length > 0;

    if (!hasProperties) return { type: 'none' as const };

    return {
      type: 'required' as const,
      schema: configSchema
    };
  }
}

export let providerSetupSessionInternalService = Service.create(
  'providerSetupSession',
  () => new providerSetupSessionInternalServiceImpl()
).build();
