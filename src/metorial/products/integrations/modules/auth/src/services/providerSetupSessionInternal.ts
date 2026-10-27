import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
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
import {
  assertAuthMethodAllowedForTenant,
  checkProviderMatch
} from '@metorial-subspace/module-provider-internal';
import {
  getMetorialSolution,
  getSubspaceSystemProviderEventBase
} from '@metorial-subspace/module-tenant';
import { normalizeJsonSchema } from '@metorial-subspace/provider-utils';
import { Fabric } from '@metorial/fabric';
import { stampPublicMcpOwnership } from '../lib/publicMcpOwnership';
import { sessionTypeSkipsConfig } from '../lib/setupSessionType';
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
        (ProviderDeploymentVersion & { lockedVersion: ProviderVersion | null }) | null;
    };
    credentials?: ProviderAuthCredentials;
    ownerActorOid?: bigint | null;
    source?: 'explorer';
    isOwnerLocked?: boolean;
    isOwnerOnlyVisible?: boolean;
    ownerPublicMcpServerOid?: bigint | null;
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
        if (sessionTypeSkipsConfig(concreteType) && d.input.configInput) {
          throw new ServiceError(
            badRequestError({
              message: `Config input provided for ${concreteType} session type`
            })
          );
        }

        let inner: ProviderSetupSessionUncheckedUpdateInput = {};
        let credentials = d.credentials;
        let configInput = d.input.configInput;
        let originalConcreteType = concreteType;

        if (
          concreteType === 'auth_only' ||
          concreteType === 'auth_and_config' ||
          concreteType === 'admin'
        ) {
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

          assertAuthMethodAllowedForTenant({ tenant: d.tenant, authMethod });

          if (
            concreteType === 'admin' &&
            (authMethod.type !== 'oauth' ||
              !authMethod.value.capabilities?.adminSetup?.enabled)
          ) {
            throw new ServiceError(
              badRequestError({
                message: 'The selected auth method does not support admin setup',
                code: 'admin_setup_not_supported'
              })
            );
          }

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
                source: d.source,
                ownerActorOid: d.ownerActorOid,
                isOwnerLocked: d.isOwnerLocked,
                isOwnerOnlyVisible: d.isOwnerOnlyVisible,
                ownerPublicMcpServerOid: d.ownerPublicMcpServerOid,
                expiresAt: d.expiresAt,
                input: {
                  name: d.input.name,
                  description: d.input.description,
                  metadata: d.input.metadata,
                  toolFilters: d.input.toolFilters,
                  config: d.input.authConfigInput,
                  isAdminSetup: concreteType === 'admin'
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

        let skipsConfig = sessionTypeSkipsConfig(concreteType);

        if (
          !skipsConfig &&
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

        if (!skipsConfig && configInput) {
          let configInner = await this.createProviderConfig({
            tenant: d.tenant,
            environment: d.environment,
            provider: d.provider,
            providerDeployment: d.providerDeployment,
            source: d.source,
            ownerActorOid: d.ownerActorOid,
            isOwnerLocked: d.isOwnerLocked,
            isOwnerOnlyVisible: d.isOwnerOnlyVisible,
            ownerPublicMcpServerOid: d.ownerPublicMcpServerOid,
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

        if (!skipsConfig && d.input.providerConfig) {
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
        (ProviderDeploymentVersion & { lockedVersion: ProviderVersion | null }) | null;
    };
    credentials?: ProviderAuthCredentials;
    authMethod: ProviderAuthMethod;
    ownerActorOid?: bigint | null;
    source?: 'explorer';
    isOwnerLocked?: boolean;
    isOwnerOnlyVisible?: boolean;
    ownerPublicMcpServerOid?: bigint | null;
    expiresAt: Date;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      toolFilters?: PrismaJson.ToolFilter | null;
      config: Record<string, any>;
      isAdminSetup?: boolean;
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
          expiresAt: d.expiresAt,
          isAdminSetup: d.input.isAdminSetup
        }
      });

      await stampPublicMcpOwnership({
        ownerPublicMcpServerOid: d.ownerPublicMcpServerOid,
        oauthSetupOid: setup.oid,
        authConfigOid: setup.authConfigOid
      });

      return {
        oauthSetupOid: setup.oid,
        deploymentOid: setup.deploymentOid,
        authConfigOid: setup.authConfigOid,
        authMethodOid: setup.authMethodOid,
        authCredentialsOid: setup.authCredentialsOid
      };
    } else {
      let eventBase = await getSubspaceSystemProviderEventBase({
        job: 'subspace/providerSetupSession',
        instanceOid: d.environment.instanceOid
      });
      await Fabric.fire('provider.auth_config.created:before', eventBase);
      await Fabric.fire('provider.auth_import.created:before', eventBase);

      let config = await providerAuthConfigService.createProviderAuthConfigInternal({
        tenant: d.tenant,
        environment: d.environment,
        provider: d.provider,
        providerDeployment: d.providerDeployment,
        ownerActorOid: d.ownerActorOid,
        isOwnerLocked: d.isOwnerLocked,
        isOwnerOnlyVisible: d.isOwnerOnlyVisible,
        import: d.import,
        source: d.source ?? (d.ownerPublicMcpServerOid ? 'public_mcp' : 'setup_session'),
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

      await stampPublicMcpOwnership({
        ownerPublicMcpServerOid: d.ownerPublicMcpServerOid,
        authConfigOid: config.oid
      });

      await Fabric.fire('provider.auth_config.created:after', {
        ...eventBase,
        authConfig: config
      });
      if (config.authImport) {
        let authImport = await db.providerAuthImport.findUniqueOrThrow({
          where: { oid: config.authImport.oid },
          include: { authConfig: { include: { provider: true } } }
        });
        await Fabric.fire('provider.auth_import.created:after', {
          ...eventBase,
          authImport
        });
      }

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
        (ProviderDeploymentVersion & { lockedVersion: ProviderVersion | null }) | null;
    };
    ownerActorOid?: bigint | null;
    source?: 'explorer';
    isOwnerLocked?: boolean;
    isOwnerOnlyVisible?: boolean;
    ownerPublicMcpServerOid?: bigint | null;
    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
      toolFilters?: PrismaJson.ToolFilter | null;
      config: Record<string, any>;
    };
  }) {
    checkProviderMatch(d.provider, d.providerDeployment);

    let eventBase = await getSubspaceSystemProviderEventBase({
      job: 'subspace/providerSetupSession',
      instanceOid: d.environment.instanceOid
    });
    await Fabric.fire('provider.config.created:before', eventBase);

    let config = await providerConfigService.createProviderConfigInternal({
      tenant: d.tenant,
      environment: d.environment,
      provider: d.provider,
      providerDeployment: d.providerDeployment,
      source: d.source,
      ownerActorOid: d.ownerActorOid,
      isOwnerLocked: d.isOwnerLocked,
      isOwnerOnlyVisible: d.isOwnerOnlyVisible,
      input: {
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata,
        isEphemeral: true,
        toolFilters: d.input.toolFilters,
        config: { type: 'inline', data: d.input.config }
      }
    });

    await stampPublicMcpOwnership({
      ownerPublicMcpServerOid: d.ownerPublicMcpServerOid,
      configOid: config.oid
    });

    await Fabric.fire('provider.config.created:after', { ...eventBase, config });

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

          await stampPublicMcpOwnership({
            ownerPublicMcpServerOid: d.session.ownerPublicMcpServerOid,
            authConfigOid: d.setup.authConfigOid
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
            ...(d.session.typeConcrete === 'admin'
              ? []
              : [
                  {
                    ...getId('providerSetupSessionEvent'),
                    type: 'auth_config_set' as const,
                    ip: d.context.ip,
                    ua: d.context.ua,
                    sessionOid: d.session.oid,
                    setupOid: d.setup.oid
                  }
                ])
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
        include: { authConfig: true, config: true, oauthSetup: true }
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

      if (
        d.session.typeConcrete === 'admin' &&
        currentSession.oauthSetup?.status === 'completed'
      )
        isComplete = true;

      if (isComplete) {
        await stampPublicMcpOwnership({
          ownerPublicMcpServerOid: currentSession.ownerPublicMcpServerOid,
          authConfigOid: currentSession.authConfigOid,
          configOid: currentSession.configOid,
          oauthSetupOid: currentSession.oauthSetupOid
        });

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

        if (
          completedSession.typeConcrete !== 'admin' &&
          completedSession.identityOid &&
          !completedSession.identityCredentialOid
        ) {
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

          let identityCredential = await (async () => {
            let eventBase = await getSubspaceSystemProviderEventBase({
              job: 'subspace/providerSetupSession',
              instanceOid: environment.instanceOid
            });
            await Fabric.fire('identity.credential.created:before', eventBase);

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

            await Fabric.fire('identity.credential.created:after', {
              ...eventBase,
              identityCredential
            });
            return identityCredential;
          })();

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
