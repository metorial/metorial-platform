import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Provider,
  type ProviderDeployment,
  type ProviderDeploymentVersion,
  type ProviderSetupSession,
  type ProviderType,
  type ProviderVariant,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { providerListingService, providerService } from '@metorial-subspace/module-catalog';
import { providerConfigService } from '@metorial-subspace/module-deployment';
import { checkProviderMatch } from '@metorial-subspace/module-provider-internal';
import { normalizeJsonSchema } from '@metorial-subspace/provider-utils';
import { env } from '../env';
import { providerSetupSessionUpdatedQueue } from '../queues/lifecycle/providerSetupSession';
import { providerAuthConfigService } from './providerAuthConfig';
import { providerAuthConfigInternalService } from './providerAuthConfigInternal';
import { providerOAuthSetupInclude } from './providerOAuthSetup';
import { providerSetupSessionInclude } from './providerSetupSession';
import { providerSetupSessionInternalService } from './providerSetupSessionInternal';

let updateLock = createLock({
  name: 'sub/auth/providerSetupSession/service',
  redisUrl: env.service.REDIS_URL
});

let undefinedIfEmpty = <T>(value: T[] | null | undefined): T[] | undefined => {
  if (!value || value.length === 0) return undefined;
  return value;
};

class providerSetupSessionUiServiceImpl {
  async getProviderSetupSessionByClientSecret(d: { sessionId: string; clientSecret: string }) {
    let providerSetupSession = await db.providerSetupSession.findFirst({
      where: {
        id: d.sessionId,
        clientSecret: d.clientSecret,
        status: { notIn: ['archived', 'deleted'] }
      },
      include: {
        ...providerSetupSessionInclude,
        provider: {
          include: {
            listing: true
          }
        },
        brand: true,
        tenant: true
      }
    });
    if (!providerSetupSession) throw new ServiceError(notFoundError('provider.setup_session'));

    return providerSetupSession;
  }

  async getConfigSchema(d: { providerSetupSession: ProviderSetupSession }) {
    let fullSession = await this.getSelectedSessionContext(d.providerSetupSession);

    if (d.providerSetupSession.type === 'auth_only') {
      return {
        type: 'none' as const
      };
    }

    return await providerConfigService.getProviderConfigSchema({
      tenant: fullSession.tenant,
      solution: fullSession.solution,
      environment: fullSession.environment,
      provider: fullSession.provider,
      providerDeployment: fullSession.deployment ?? undefined
    });
  }

  async getConfigSchemaWithoutSession(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    deployment?: ProviderDeployment & {
      currentVersion: ProviderDeploymentVersion | null;
    };
  }) {
    checkProviderMatch(d.provider, d.deployment);

    let schema = await providerConfigService.getProviderConfigSchema({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,

      provider: d.provider,
      providerDeployment: d.deployment ?? undefined
    });

    let configSchema = normalizeJsonSchema(schema.value.specification.configJsonSchema);
    if (!configSchema) return { type: 'none' as const };

    let hasProperties =
      configSchema &&
      typeof configSchema === 'object' &&
      'properties' in configSchema &&
      Object.keys(configSchema.properties || {}).length > 0;

    if (!hasProperties) return { type: 'none' as const };

    return {
      type: 'required' as const,
      schema: configSchema
    };
  }

  async getAuthConfigSchema(d: { providerSetupSession: ProviderSetupSession }) {
    let fullSession = await this.getSelectedSessionContext(d.providerSetupSession);

    if (d.providerSetupSession.type === 'config_only') {
      return {
        type: 'none' as const
      };
    }

    let schema = await providerAuthConfigService.getProviderAuthConfigSchema({
      tenant: fullSession.tenant,
      solution: fullSession.solution,
      environment: fullSession.environment,

      provider: fullSession.provider,
      providerDeployment: fullSession.deployment ?? undefined,
      authMethodId: fullSession.authMethod?.id
    });

    return {
      type: 'required' as const,
      schema: schema.authMethod.value.inputJsonSchema
    };
  }

  async getOAuthSetup(d: { providerSetupSession: ProviderSetupSession }) {
    if (!d.providerSetupSession.oauthSetupOid) return null;

    return await db.providerOAuthSetup.findUnique({
      where: { oid: d.providerSetupSession.oauthSetupOid },
      include: providerOAuthSetupInclude
    });
  }

  async setAuthConfig(d: {
    providerSetupSession: ProviderSetupSession;
    input: {
      authConfigInput: Record<string, any>;
      toolFilters?: PrismaJson.ToolFilter | null;
    };
    context: {
      ip: string;
      ua: string;
    };
  }) {
    await this.checkEditable(d);

    if (d.providerSetupSession.type === 'config_only') {
      throw new ServiceError(
        badRequestError({
          message: 'Config input is required for auth_and_config session type'
        })
      );
    }

    if (d.providerSetupSession.oauthSetupOid || d.providerSetupSession.authConfigOid) {
      return d.providerSetupSession;
    }

    return updateLock.usingLock(d.providerSetupSession.id, () =>
      withTransaction(async db => {
        let currentSession = await db.providerSetupSession.findUniqueOrThrow({
          where: {
            oid: d.providerSetupSession.oid
          },
          include: {
            tenant: true,
            solution: true,
            environment: true,
            authCredentials: true,
            provider: { include: { defaultVariant: true, type: true } },
            authMethod: true,
            deployment: {
              include: {
                provider: true,
                providerVariant: true,
                currentVersion: { include: { lockedVersion: true } }
              }
            }
          }
        });
        this.assertSelectedProvider(currentSession);
        if (currentSession.status === 'completed' || currentSession.authConfigOid) {
          throw new ServiceError(
            badRequestError({
              message: 'Cannot update a completed provider auth session'
            })
          );
        }

        let setAuthConfigInner =
          await providerSetupSessionInternalService.createProviderAuthConfig({
            tenant: currentSession.tenant,
            solution: currentSession.solution,
            provider: currentSession.provider,
            environment: currentSession.environment,
            providerDeployment: currentSession.deployment ?? undefined,
            credentials: currentSession.authCredentials ?? undefined,
            authMethod: currentSession.authMethod,
            expiresAt: currentSession.expiresAt,
            input: {
              name: currentSession.name ?? undefined,
              description: currentSession.description ?? undefined,
              metadata: currentSession.metadata ?? undefined,
              toolFilters: d.input.toolFilters,
              config: d.input.authConfigInput
            },
            import: {
              ip: d.context.ip,
              ua: d.context.ua
            }
          });

        let session = await db.providerSetupSession.update({
          where: { oid: d.providerSetupSession.oid },
          data: setAuthConfigInner
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

        session = await providerSetupSessionInternalService.evaluate({
          session: session,
          context: { ip: d.context.ip, ua: d.context.ua }
        });

        await addAfterTransactionHook(() =>
          providerSetupSessionUpdatedQueue.add({ providerSetupSessionId: session.id })
        );

        return session;
      })
    );
  }

  async setConfig(d: {
    providerSetupSession: ProviderSetupSession;
    input: {
      configInput: Record<string, any>;
      toolFilters?: PrismaJson.ToolFilter | null;
    };
    context: {
      ip: string;
      ua: string;
    };
  }) {
    await this.checkEditable(d);

    if (d.providerSetupSession.type === 'auth_only') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot set config for auth_only session type'
        })
      );
    }
    if (d.providerSetupSession.configOid) {
      throw new ServiceError(
        badRequestError({
          message: 'Config has already been set for this session'
        })
      );
    }

    return updateLock.usingLock(d.providerSetupSession.id, () =>
      withTransaction(async db => {
        let currentSession = await db.providerSetupSession.findUniqueOrThrow({
          where: {
            oid: d.providerSetupSession.oid
          },
          include: {
            tenant: true,
            solution: true,
            authCredentials: true,
            provider: { include: { defaultVariant: true } },
            authMethod: true,
            environment: true,
            deployment: {
              include: {
                provider: true,
                providerVariant: true,
                currentVersion: { include: { lockedVersion: true } }
              }
            }
          }
        });
        this.assertSelectedProvider(currentSession);

        if (currentSession.status === 'completed' || currentSession.configOid) {
          throw new ServiceError(
            badRequestError({
              message: 'Cannot update a completed provider setup session'
            })
          );
        }

        let setConfigInner = await providerSetupSessionInternalService.createProviderConfig({
          tenant: currentSession.tenant,
          solution: currentSession.solution,
          provider: currentSession.provider,
          environment: currentSession.environment,
          providerDeployment: currentSession.deployment ?? undefined,
          input: {
            name: currentSession.name ?? undefined,
            description: currentSession.description ?? undefined,
            metadata: currentSession.metadata ?? undefined,
            toolFilters: d.input.toolFilters,
            config: d.input.configInput
          }
        });

        let session = await db.providerSetupSession.update({
          where: { oid: d.providerSetupSession.oid },
          data: setConfigInner
        });

        if (session.configOid) {
          await db.providerSetupSessionEvent.createMany({
            data: {
              ...getId('providerSetupSessionEvent'),
              type: 'config_set',
              sessionOid: session.oid
            }
          });
        }

        session = await providerSetupSessionInternalService.evaluate({
          session: session,
          context: { ip: d.context.ip, ua: d.context.ua }
        });

        await addAfterTransactionHook(() =>
          providerSetupSessionUpdatedQueue.add({ providerSetupSessionId: session.id })
        );

        return session;
      })
    );
  }

  async listProviders(d: {
    providerSetupSession: ProviderSetupSession;
    search?: string;
    limit?: number;
    after?: string;
    before?: string;
  }) {
    let session = await db.providerSetupSession.findUniqueOrThrow({
      where: { oid: d.providerSetupSession.oid },
      include: {
        tenant: true,
        solution: true,
        environment: true
      }
    });

    let providerSearch = session.configuration?.providerSearch;

    let paginator = await providerListingService.listProviderListings({
      tenant: session.tenant,
      solution: session.solution,
      environment: session.environment,
      search: d.search,
      providerGroupIds: undefinedIfEmpty(
        providerSearch?.groups?.map(filter => filter.groupId)
      ),
      providerCollectionIds: undefinedIfEmpty(
        providerSearch?.collections?.map(filter => filter.collectionId)
      ),
      providerCategoryIds: undefinedIfEmpty(
        providerSearch?.categories?.map(filter => filter.categoryId)
      ),
      orderByRank: true,
      capabilities: {
        supportsConfig: session.type !== 'auth_only' ? true : undefined,
        supportsAuth: session.type !== 'config_only' ? true : undefined
      }
    });

    let rankedList = await paginator.run({
      limit: d.limit,
      after: d.after,
      before: d.before
    });

    return {
      items: rankedList.items.map(providerListing => ({
        id: providerListing.provider.id,
        listingId: providerListing.id,
        name: providerListing.name ?? providerListing.provider.name,
        description: providerListing.description ?? providerListing.provider.description,
        slug: providerListing.slug ?? providerListing.provider.slug,
        image: providerListing.image,
        groups: providerListing.groups?.map(group => ({
          id: group.id,
          name: group.name
        }))
      })),
      pagination: rankedList.pagination
    };
  }

  async selectProvider(d: { providerSetupSession: ProviderSetupSession; providerId: string }) {
    await this.checkEditable(d);

    return updateLock.usingLock(d.providerSetupSession.id, () =>
      withTransaction(async db => {
        let session = await db.providerSetupSession.findUniqueOrThrow({
          where: { oid: d.providerSetupSession.oid },
          include: {
            tenant: true,
            solution: true,
            environment: true,
            provider: { include: { defaultVariant: true, type: true } }
          }
        });

        let allowedProviders = await this.listProviders({ providerSetupSession: session });
        if (!allowedProviders.items.some(provider => provider.id === d.providerId)) {
          throw new ServiceError(
            badRequestError({
              message: 'Selected provider is not allowed for this setup session',
              code: 'provider_not_allowed'
            })
          );
        }

        if (session.provider && session.provider.id !== d.providerId) {
          throw new ServiceError(
            badRequestError({
              message: 'Provider has already been selected for this setup session'
            })
          );
        }

        let provider = await providerService.getProviderById({
          providerId: d.providerId,
          tenant: session.tenant,
          environment: session.environment,
          solution: session.solution
        });

        let { authMethod } = await providerAuthConfigInternalService.getVersionAndAuthMethod({
          tenant: session.tenant,
          solution: session.solution,
          environment: session.environment,
          provider: provider as Provider & {
            defaultVariant: ProviderVariant | null;
            type: ProviderType;
          }
        });

        let authCredentialsOid: bigint | undefined;
        if (
          authMethod.type === 'oauth' &&
          provider.type.attributes.auth.oauth?.oauthAutoRegistration?.status !== 'supported'
        ) {
          let defaultCredentials = await db.providerAuthCredentials.findFirst({
            where: {
              providerOid: provider.oid,
              tenantOid: session.tenant.oid,
              solutionOid: session.solution.oid,
              environmentOid: session.environment.oid,
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

          authCredentialsOid = defaultCredentials.oid;
        }

        let updatedSession = await db.providerSetupSession.update({
          where: { oid: session.oid },
          data: {
            providerOid: provider.oid,
            authMethodOid: authMethod.oid,
            authCredentialsOid
          },
          include: {
            ...providerSetupSessionInclude,
            provider: {
              include: {
                listing: true
              }
            },
            brand: true,
            tenant: true
          }
        });

        await addAfterTransactionHook(() =>
          providerSetupSessionUpdatedQueue.add({ providerSetupSessionId: updatedSession.id })
        );

        return updatedSession;
      })
    );
  }

  async listTools(d: { providerSetupSession: ProviderSetupSession }) {
    let session = await this.getSelectedSessionContext(d.providerSetupSession);
    let specificationOid =
      session.deployment?.currentVersion?.lockedVersion?.specificationOid ??
      session.provider.defaultVariant?.currentVersion?.specificationOid;

    if (!specificationOid) return [];

    let tools = await db.providerTool.findMany({
      where: {
        specificationOid
      },
      orderBy: {
        name: 'asc'
      }
    });

    return tools.map(tool => ({
      id: tool.id,
      key: tool.key,
      name: tool.name,
      description: tool.description
    }));
  }

  private async checkEditable(d: { providerSetupSession: ProviderSetupSession }) {
    if (d.providerSetupSession.status === 'completed') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update a completed provider auth session'
        })
      );
    }
    if (d.providerSetupSession.expiresAt < new Date()) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot update an expired provider auth session'
        })
      );
    }
  }

  private async getSelectedSessionContext(providerSetupSession: ProviderSetupSession) {
    let fullSession = await db.providerSetupSession.findUniqueOrThrow({
      where: { oid: providerSetupSession.oid },
      include: {
        tenant: true,
        solution: true,
        environment: true,
        provider: {
          include: {
            defaultVariant: {
              include: {
                currentVersion: true
              }
            },
            type: true,
            listing: true
          }
        },
        authMethod: true,
        deployment: {
          include: {
            provider: true,
            providerVariant: true,
            currentVersion: { include: { lockedVersion: true } }
          }
        }
      }
    });

    this.assertSelectedProvider(fullSession);

    return fullSession;
  }

  private assertSelectedProvider(
    session: ProviderSetupSession & { provider?: Provider | null; authMethod?: any | null }
  ): asserts session is ProviderSetupSession & {
    provider: Provider;
    authMethod: NonNullable<typeof session.authMethod>;
  } {
    if (
      !session.providerOid ||
      !session.authMethodOid ||
      !session.provider ||
      !session.authMethod
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'A provider must be selected before continuing setup',
          code: 'provider_selection_required'
        })
      );
    }
  }
}

export let providerSetupSessionUiService = Service.create(
  'providerSetupSession',
  () => new providerSetupSessionUiServiceImpl()
).build();
