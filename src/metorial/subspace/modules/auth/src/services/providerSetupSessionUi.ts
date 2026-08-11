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
  type ProviderVariant,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import type { ProviderSetupSessionUncheckedUpdateInput } from '@metorial-subspace/db/prisma/generated/models';
import { providerListingService, providerService } from '@metorial-subspace/module-catalog';
import { providerConfigService } from '@metorial-subspace/module-deployment';
import { checkProviderMatch } from '@metorial-subspace/module-provider-internal';
import { normalizeJsonSchema } from '@metorial-subspace/provider-utils';
import { env } from '../env';
import { providerSetupSessionUpdatedQueue } from '../queues/lifecycle/providerSetupSession';
import { providerAuthConfigService } from './providerAuthConfig';
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
  private canConfirmToolFilters(d: {
    providerSetupSession: Pick<
      ProviderSetupSession,
      'status' | 'expiresAt' | 'configuration'
    >;
  }) {
    return (
      !!d.providerSetupSession.configuration?.toolFilters?.enabled &&
      d.providerSetupSession.expiresAt >= new Date()
    );
  }

  private async cloneConfigForToolFilters(d: {
    config: Awaited<ReturnType<typeof db.providerConfig.findUniqueOrThrow>> & {
      currentVersion: { slateInstanceOid: bigint | null; shuttleConfigOid: bigint | null } | null;
    };
    toolFilters?: PrismaJson.ToolFilter | null;
  }) {
    let cloned = await db.providerConfig.create({
      data: {
        ...getId('providerConfig'),
        status: 'active',
        isDefault: false,
        isEphemeral: true,
        isForVault: d.config.isForVault,
        name: d.config.name,
        description: d.config.description,
        metadata: d.config.metadata,
        privateMetadata: d.config.privateMetadata,
        toolFilter: d.toolFilters ?? d.config.toolFilter,
        tenantOid: d.config.tenantOid,
        providerOid: d.config.providerOid,
        solutionOid: d.config.solutionOid,
        environmentOid: d.config.environmentOid,
        specificationOid: d.config.specificationOid,
        deploymentOid: d.config.deploymentOid,
        fromVaultOid: d.config.fromVaultOid,
        parentConfigOid: d.config.oid
      }
    });

    let currentVersion = await db.providerConfigVersion.create({
      data: {
        ...getId('providerConfigVersion'),
        configOid: cloned.oid,
        slateInstanceOid: d.config.currentVersion?.slateInstanceOid,
        shuttleConfigOid: d.config.currentVersion?.shuttleConfigOid
      }
    });

    return await db.providerConfig.update({
      where: { oid: cloned.oid },
      data: { currentVersionOid: currentVersion.oid }
    });
  }

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

    if (
      !d.providerSetupSession.typeConcrete ||
      d.providerSetupSession.typeConcrete === 'auth_only'
    ) {
      return {
        type: 'none' as const
      };
    }

    let schema = await providerConfigService.getProviderConfigSchema({
      tenant: fullSession.tenant,
      environment: fullSession.environment,
      provider: fullSession.provider,
      providerDeployment: fullSession.deployment ?? undefined
    });

    let configSchema = normalizeJsonSchema(schema.value.specification.configJsonSchema);
    let hasProperties =
      configSchema &&
      typeof configSchema === 'object' &&
      'properties' in configSchema &&
      Object.keys(configSchema.properties || {}).length > 0;

    if (!configSchema || !hasProperties) {
      return {
        type: 'none' as const
      };
    }

    return {
      type: 'required' as const,
      schema: configSchema
    };
  }

  async getConfigSchemaWithoutSession(d: {
    tenant: Tenant;
    environment: Environment;
    provider: Provider & { defaultVariant: ProviderVariant | null };
    deployment?: ProviderDeployment & {
      currentVersion: ProviderDeploymentVersion | null;
    };
  }) {
    checkProviderMatch(d.provider, d.deployment);

    let schema = await providerConfigService.getProviderConfigSchema({
      tenant: d.tenant,
      environment: d.environment,

      provider: d.provider,
      providerDeployment: d.deployment ?? undefined
    });

    let configSchema = normalizeJsonSchema(schema.value.specification.configJsonSchema);
    let hasProperties =
      configSchema &&
      typeof configSchema === 'object' &&
      'properties' in configSchema &&
      Object.keys(configSchema.properties || {}).length > 0;

    if (!configSchema) return { type: 'none' as const };

    if (!hasProperties) return { type: 'none' as const };

    return {
      type: 'required' as const,
      schema: configSchema
    };
  }

  async getAuthConfigSchema(d: { providerSetupSession: ProviderSetupSession }) {
    let fullSession = await this.getSelectedSessionContext(d.providerSetupSession);

    if (
      !d.providerSetupSession.typeConcrete ||
      d.providerSetupSession.typeConcrete === 'config_only'
    ) {
      return {
        type: 'none' as const
      };
    }

    this.assertSelectedAuthMethod(fullSession);

    let schema = await providerAuthConfigService.getProviderAuthConfigSchema({
      tenant: fullSession.tenant,
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

    if (
      !d.providerSetupSession.typeConcrete ||
      d.providerSetupSession.typeConcrete === 'config_only'
    ) {
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
        if (!currentSession.authMethod) {
          throw new ServiceError(
            badRequestError({
              message: 'A provider must be selected before continuing setup',
              code: 'provider_selection_required'
            })
          );
        }
        let authMethod = currentSession.authMethod;
        if (currentSession.status === 'completed' || currentSession.authConfigOid) {
          throw new ServiceError(
            badRequestError({
              message: 'Cannot update a completed provider auth session'
            })
          );
        }

        let setAuthConfigInner =
          await providerSetupSessionInternalService.createProviderAuthConfigInternal({
            tenant: currentSession.tenant,
            provider: currentSession.provider,
            environment: currentSession.environment,
            providerDeployment: currentSession.deployment ?? undefined,
            credentials: currentSession.authCredentials ?? undefined,
            authMethod,
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
    let canConfirmToolFilters = this.canConfirmToolFilters({
      providerSetupSession: d.providerSetupSession
    });
    if (!canConfirmToolFilters) {
      await this.checkEditable(d);
    }

    if (
      !d.providerSetupSession.typeConcrete ||
      d.providerSetupSession.typeConcrete === 'auth_only'
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot set config for auth_only session type'
        })
      );
    }

    if (d.providerSetupSession.configOid && !canConfirmToolFilters) {
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
            config: {
              include: {
                currentVersion: true
              }
            },
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

        let allowToolFilterConfirmation =
          canConfirmToolFilters &&
          currentSession.configOid &&
          Object.keys(d.input.configInput).length === 0;

        if (
          (currentSession.status === 'completed' || currentSession.configOid) &&
          !allowToolFilterConfirmation
        ) {
          throw new ServiceError(
            badRequestError({
              message: 'Cannot update a completed provider setup session'
            })
          );
        }

        let session: ProviderSetupSession = currentSession;

        if (allowToolFilterConfirmation && currentSession.config) {
          let nextConfig = currentSession.config.isEphemeral
            ? await providerConfigService.updateProviderConfigInternal({
                tenant: currentSession.tenant,
                environment: currentSession.environment,
                providerConfig: currentSession.config,
                input: {
                  toolFilters: d.input.toolFilters
                }
              })
            : await this.cloneConfigForToolFilters({
                config: currentSession.config,
                toolFilters: d.input.toolFilters
              });

          session = await db.providerSetupSession.update({
            where: { oid: d.providerSetupSession.oid },
            data: { configOid: nextConfig.oid }
          });
        } else {
          let setConfigInner = await providerSetupSessionInternalService.createProviderConfig({
            tenant: currentSession.tenant,
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

          session = await db.providerSetupSession.update({
            where: { oid: d.providerSetupSession.oid },
            data: setConfigInner
          });
        }

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
    ids?: string[];
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
        supportsConfig: session.typeSelected === 'auth_only' ? false : undefined,
        supportsAuth: session.typeSelected === 'config_only' ? false : undefined
      },
      ids: d.ids
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
        slug: providerListing.prettySlug || providerListing.slug,
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

        let allowedProviders = await this.listProviders({
          providerSetupSession: session,
          ids: [d.providerId]
        });
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
          environment: session.environment
        });

        let initialized =
          await providerSetupSessionInternalService.initializeProviderSetupSessionProvider({
            tenant: session.tenant,
            environment: session.environment,
            provider,
            expiresAt: session.expiresAt,
            input: {
              name: session.name ?? undefined,
              description: session.description ?? undefined,
              metadata: session.metadata ?? undefined,
              type: session.typeSelected,
              toolFilters: session.configuration?.toolFilters?.enabled
                ? { type: 'v1.allow_all' }
                : undefined,
              requiresToolFiltersSelection: session.configuration?.toolFilters?.enabled
            },
            import: {
              ip: undefined,
              ua: undefined
            }
          });

        let updatedSession = await db.providerSetupSession.update({
          where: { oid: session.oid },
          data: {
            ...(initialized.inner as ProviderSetupSessionUncheckedUpdateInput),
            providerOid: provider.oid,
            typeConcrete: initialized.concreteType
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

        let evaluatedSession = await providerSetupSessionInternalService.evaluate({
          session: updatedSession,
          context: { ip: '', ua: '' }
        });

        updatedSession = await db.providerSetupSession.findUniqueOrThrow({
          where: { oid: evaluatedSession.oid },
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
    if (
      d.providerSetupSession.status === 'completed' &&
      !this.canConfirmToolFilters({ providerSetupSession: d.providerSetupSession })
    ) {
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
    session: ProviderSetupSession & { provider?: Provider | null }
  ): asserts session is ProviderSetupSession & {
    provider: Provider;
  } {
    if (!session.providerOid || !session.provider) {
      throw new ServiceError(
        badRequestError({
          message: 'A provider must be selected before continuing setup',
          code: 'provider_selection_required'
        })
      );
    }
  }

  private assertSelectedAuthMethod(
    session: ProviderSetupSession & { authMethod?: any | null }
  ): asserts session is ProviderSetupSession & {
    authMethod: NonNullable<typeof session.authMethod>;
  } {
    if (!session.authMethodOid || !session.authMethod) {
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
