import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type ChatIntegrationInstance,
  type ChatStatus,
  db,
  type Environment,
  type Tenant
} from '@metorial-subspace/db';
import {
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList
} from '@metorial-subspace/list-utils';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { syncChatWorkspacesForProviderQueue } from '../queues/sync/workspaces';

export let chatInclude = {
  workspace: true,
  chatIntegrationInstance: true,
  chatIntegrationInstanceProvider: true
} as const;

export type ListChatsParams = {
  search?: string;
  status?: ChatStatus[];
  allowDeleted?: boolean;
  ids?: string[];
  chatIntegrationInstanceIds?: string[];
  chatIntegrationInstanceProviderIds?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
};

export type GetChatByIdParams = {
  chatId: string;
  allowDeleted?: boolean;
};

export type SyncChatsParams = {
  chatIntegrationInstance: ChatIntegrationInstance;
};

class chatServiceImpl {
  async listChats(d: MetorialFacing<ListChatsParams>) {
    let { instance, organizationActor, ...rest } = d;

    let scope = await resolveMetorialFacing(d);

    return this.listChatsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listChatsInternal(d: { tenant: Tenant; environment: Environment } & ListChatsParams) {
    let solution = await getMetorialSolution();

    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.chat.findMany({
            ...opts,
            where: {
              chatIntegrationInstance: {
                tenantOid: d.tenant.oid,
                solutionOid: solution.oid,
                environmentOid: d.environment.oid
              },
              ...normalizeStatusForList(d).hasParent,
              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.chatIntegrationInstanceIds
                  ? { chatIntegrationInstance: { id: { in: d.chatIntegrationInstanceIds } } }
                  : undefined!,
                d.chatIntegrationInstanceProviderIds
                  ? {
                      chatIntegrationInstanceProvider: {
                        id: { in: d.chatIntegrationInstanceProviderIds }
                      }
                    }
                  : undefined!,
                d.search
                  ? {
                      OR: [
                        { name: { contains: d.search, mode: 'insensitive' as const } },
                        {
                          workspace: {
                            name: { contains: d.search, mode: 'insensitive' as const }
                          }
                        }
                      ]
                    }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: chatInclude
          })
      )
    );
  }

  async getChatById(d: MetorialFacing<GetChatByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.getChatByIdInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getChatByIdInternal(
    d: { tenant: Tenant; environment: Environment } & GetChatByIdParams
  ) {
    let solution = await getMetorialSolution();
    let chat = await db.chat.findFirst({
      where: {
        id: d.chatId,
        chatIntegrationInstance: {
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid,
          environmentOid: d.environment.oid
        },
        ...normalizeStatusForGet(d).hasParent
      },
      include: chatInclude
    });

    if (!chat) {
      throw new ServiceError(notFoundError('chat', d.chatId));
    }

    return chat;
  }

  async syncChats(d: MetorialFacing<SyncChatsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);

    return this.syncChatsInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async syncChatsInternal(d: { tenant: Tenant; environment: Environment } & SyncChatsParams) {
    checkTenant(d, d.chatIntegrationInstance);

    let providers = await db.chatIntegrationInstanceProvider.findMany({
      where: {
        chatIntegrationInstanceOid: d.chatIntegrationInstance.oid,
        status: 'active',
        isParentDeleted: false
      },
      include: {
        chatIntegrationInstance: true,
        chatIntegrationProvider: true,
        adapterIntegrationInstanceProvider: true
      }
    });

    await syncChatWorkspacesForProviderQueue.addManyWithOps(
      providers.map(provider => ({
        data: { chatIntegrationInstanceProviderId: provider.id },
        opts: { id: `ws-sync-${provider.id}` }
      }))
    );

    return { providers };
  }
}

export let chatService = Service.create('chatService', () => new chatServiceImpl()).build();
