import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type ChatConnection,
  type ChatConnectionProvider,
  type ChatConnectionProviderStatus,
  db,
  type Environment,
  getId,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList
} from '@metorial-subspace/list-utils';
import {
  ensureAdapterProvider,
  integrationProviderVersionInclude,
  removeAdapterProvider,
  updateAdapterProvider
} from '@metorial-subspace/module-integration';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { upsertChatProviderProjection } from '../lib/project';
import { enqueueChatConnectionUpdated } from '../queues/lifecycle';

export let chatConnectionProviderInclude = {
  chatConnection: true,
  adapterIntegrationProvider: {
    include: {
      integrationProvider: {
        include: {
          provider: {
            include: {
              defaultVariant: {
                include: {
                  currentVersion: {
                    include: {
                      specification: {
                        include: { providerTriggerGroups: true }
                      }
                    }
                  }
                }
              }
            }
          },
          currentVersion: { include: integrationProviderVersionInclude }
        }
      }
    }
  }
} as const;

export type ListChatConnectionProvidersParams = {
  search?: string;
  status?: ChatConnectionProviderStatus[];
  allowDeleted?: boolean;
  ids?: string[];
  chatConnectionIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetChatConnectionProviderByIdParams = {
  chatConnectionProviderId: string;
  allowDeleted?: boolean;
};

export type CreateChatConnectionProviderParams = {
  chatConnection: ChatConnection;
  input: {
    providerId: string;
    providerDeploymentId?: string | null;
    providerAuthMethodId?: string | null;
    providerAuthCredentialsId?: string | null;
    providerConfigId?: string | null;
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
  };
};

export type UpdateChatConnectionProviderParams = {
  chatConnectionProvider: ChatConnectionProvider;
  input: {
    providerDeploymentId?: string;
    providerAuthMethodId?: string | null;
    providerAuthCredentialsId?: string | null;
    providerConfigId?: string | null;
    name?: string;
    description?: string | null;
    metadata?: Record<string, any> | null;
  };
};

export type ArchiveChatConnectionProviderParams = {
  chatConnectionProvider: ChatConnectionProvider;
};

class chatConnectionProviderServiceImpl {
  async listChatConnectionProviders(d: MetorialFacing<ListChatConnectionProvidersParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.listChatConnectionProvidersInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listChatConnectionProvidersInternal(
    d: { tenant: Tenant; environment: Environment } & ListChatConnectionProvidersParams
  ) {
    let solution = await getMetorialSolution();

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.chatConnectionProvider.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: solution.oid,
              environmentOid: d.environment.oid,
              ...normalizeStatusForList(d).noParent,
              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.chatConnectionIds
                  ? { chatConnection: { id: { in: d.chatConnectionIds } } }
                  : undefined!,
                d.search
                  ? { name: { contains: d.search, mode: 'insensitive' as const } }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: chatConnectionProviderInclude
          })
      )
    );
  }

  async getChatConnectionProviderById(d: MetorialFacing<GetChatConnectionProviderByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.getChatConnectionProviderByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getChatConnectionProviderByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetChatConnectionProviderByIdParams
  ) {
    let solution = await getMetorialSolution();
    let chatConnectionProvider = await db.chatConnectionProvider.findFirst({
      where: {
        id: d.chatConnectionProviderId,
        tenantOid: d.tenant.oid,
        solutionOid: solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include: chatConnectionProviderInclude
    });
    if (!chatConnectionProvider) {
      throw new ServiceError(
        notFoundError('chat.integration.provider', d.chatConnectionProviderId)
      );
    }

    return chatConnectionProvider;
  }

  async createChatConnectionProvider(d: MetorialFacing<CreateChatConnectionProviderParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.createChatConnectionProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async createChatConnectionProviderInternal(
    d: { tenant: Tenant; environment: Environment } & CreateChatConnectionProviderParams
  ) {
    checkTenant(d, d.chatConnection);
    checkDeletedEdit(d.chatConnection, 'update');

    return withTransaction(async db => {
      let adapterIntegration = await db.adapterIntegration.findUniqueOrThrow({
        where: { oid: d.chatConnection.adapterIntegrationOid }
      });

      let adapterProvider = await ensureAdapterProvider({
        tenant: d.tenant,
        environment: d.environment,
        adapterIntegration,
        input: d.input
      });

      let existing = await db.chatConnectionProvider.findUnique({
        where: { adapterIntegrationProviderOid: adapterProvider.oid }
      });

      let chatConnectionProvider = existing
        ? await db.chatConnectionProvider.update({
            where: { oid: existing.oid },
            data: {
              status: 'active',
              archivedAt: null,
              name: d.input.name?.trim() || existing.name,
              description: d.input.description?.trim() || existing.description,
              metadata: d.input.metadata ?? existing.metadata
            },
            include: chatConnectionProviderInclude
          })
        : await db.chatConnectionProvider.create({
            data: {
              ...getId('chatConnectionProvider'),
              status: 'active',
              name: d.input.name?.trim() || 'Provider',
              description: d.input.description?.trim() || null,
              metadata: d.input.metadata ?? {},
              chatConnectionOid: d.chatConnection.oid,
              adapterIntegrationOid: adapterIntegration.oid,
              adapterIntegrationProviderOid: adapterProvider.oid,
              tenantOid: adapterProvider.tenantOid,
              projectOid: adapterProvider.projectOid,
              environmentOid: adapterProvider.environmentOid,
              instanceOid: adapterProvider.instanceOid,
              solutionOid: adapterProvider.solutionOid
            },
            include: chatConnectionProviderInclude
          });

      await upsertChatProviderProjection(adapterProvider);

      await enqueueChatConnectionUpdated(d.chatConnection.id);

      return chatConnectionProvider;
    });
  }

  async updateChatConnectionProvider(d: MetorialFacing<UpdateChatConnectionProviderParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.updateChatConnectionProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async updateChatConnectionProviderInternal(
    d: { tenant: Tenant; environment: Environment } & UpdateChatConnectionProviderParams
  ) {
    checkTenant(d, d.chatConnectionProvider);
    checkDeletedEdit(d.chatConnectionProvider, 'update');

    return withTransaction(async db => {
      let adapterProvider = await db.adapterIntegrationProvider.findUniqueOrThrow({
        where: { oid: d.chatConnectionProvider.adapterIntegrationProviderOid }
      });

      await updateAdapterProvider({
        tenant: d.tenant,
        environment: d.environment,
        adapterIntegrationProvider: adapterProvider,
        input: d.input
      });

      let updated = await db.chatConnectionProvider.update({
        where: { oid: d.chatConnectionProvider.oid },
        data: {
          name: d.input.name?.trim() ?? d.chatConnectionProvider.name,
          description:
            d.input.description === undefined
              ? d.chatConnectionProvider.description
              : d.input.description?.trim() || null,
          metadata:
            d.input.metadata === undefined
              ? d.chatConnectionProvider.metadata
              : d.input.metadata
        },
        include: chatConnectionProviderInclude
      });

      await enqueueChatConnectionUpdated(updated.chatConnection.id);

      return updated;
    });
  }

  // Resolves each chat connection's catalog provider id(s) — a connection can back several providers
  // simultaneously — used by the event-destination module to broaden a chat_connection_id listener
  // filter to provider-tier and all-connections listeners as well.
  async getProviderIdsForChatConnectionIdsInternal(
    chatConnectionIds: string[]
  ): Promise<Map<string, string[]>> {
    if (chatConnectionIds.length === 0) return new Map();

    let providers = await db.chatConnectionProvider.findMany({
      where: { status: 'active', chatConnection: { id: { in: chatConnectionIds } } },
      select: {
        chatConnection: { select: { id: true } },
        adapterIntegrationProvider: {
          select: { integrationProvider: { select: { provider: { select: { id: true } } } } }
        }
      }
    });

    let result = new Map<string, string[]>();
    for (let provider of providers) {
      let connectionId = provider.chatConnection.id;
      let providerId = provider.adapterIntegrationProvider.integrationProvider.provider.id;
      result.set(connectionId, [...(result.get(connectionId) ?? []), providerId]);
    }

    return result;
  }

  async archiveChatConnectionProvider(d: MetorialFacing<ArchiveChatConnectionProviderParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.archiveChatConnectionProviderInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async archiveChatConnectionProviderInternal(
    d: { tenant: Tenant; environment: Environment } & ArchiveChatConnectionProviderParams
  ) {
    checkTenant(d, d.chatConnectionProvider);
    checkDeletedEdit(d.chatConnectionProvider, 'archive');

    return withTransaction(async db => {
      let adapterProvider = await db.adapterIntegrationProvider.findUniqueOrThrow({
        where: { oid: d.chatConnectionProvider.adapterIntegrationProviderOid }
      });

      await db.chatConnectionProvider.update({
        where: { oid: d.chatConnectionProvider.oid },
        data: { status: 'archived', archivedAt: new Date() }
      });

      await removeAdapterProvider({
        tenant: d.tenant,
        environment: d.environment,
        adapterIntegrationProvider: adapterProvider
      });

      let archived = await db.chatConnectionProvider.findUniqueOrThrow({
        where: { oid: d.chatConnectionProvider.oid },
        include: chatConnectionProviderInclude
      });
      await enqueueChatConnectionUpdated(archived.chatConnection.id);
      return archived;
    });
  }
}

export let chatConnectionProviderService = Service.create(
  'chatConnectionProvider',
  () => new chatConnectionProviderServiceImpl()
).build();
