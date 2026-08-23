import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { type ChatAdapterInstance } from '@metorial-subspace/adapter-chat';
import {
  type Chat,
  type ChatIntegrationInstanceProvider,
  type ChatWorkspace,
  db,
  type Environment,
  type Tenant
} from '@metorial-subspace/db';
import {
  checkTenant,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { chatAdapterService } from '../internal/chatAdapter';
import { chatWorkspaceInternalService } from '../internal/chatWorkspace';
import { requireLocalChatEntity, withChatCapabilityFallback } from '../lib/chatCapability';
import { unwrapChatCall } from '../lib/chatError';

export let chatWorkspaceInclude = {
  chat: true
} as const;

export type ChatWorkspaceWithChat = ChatWorkspace & { chat: Chat };

export type ListChatWorkspacesParams = {
  chatIntegrationInstanceProvider: ChatIntegrationInstanceProvider;
  search?: string;
};

export type GetChatWorkspaceParams = {
  chatIntegrationInstanceProvider: ChatIntegrationInstanceProvider;
  workspaceId: string;
};

class chatWorkspaceServiceImpl {
  async listChatWorkspaces(d: MetorialFacing<ListChatWorkspacesParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.listChatWorkspacesInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async listChatWorkspacesInternal(
    d: { tenant: Tenant; environment: Environment } & ListChatWorkspacesParams
  ) {
    checkTenant(d, d.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chatIntegrationInstanceProvider
    });

    return withChatCapabilityFallback(client, 'workspace_read', {
      provider: () => this.listChatWorkspacesFromProvider({ ...d, client }),
      fallback: () => this.listChatWorkspacesFromDb(d)
    });
  }

  private listChatWorkspacesFromProvider(
    d: ListChatWorkspacesParams & { client: ChatAdapterInstance }
  ) {
    let search = d.search?.trim() || undefined;

    return Paginator.create(({ externalCursor }) =>
      externalCursor(async page => {
        let listed = await d.client.call('metorial_chat$workspace.list', {
          cursor: page.cursor,
          limit: page.limit,
          direction: page.direction,
          query: search
        });
        let listing = unwrapChatCall(listed, {
          code: 'chat_workspace_list_failed',
          message: 'Failed to list workspaces from the chat provider.'
        });

        let upserted = await chatWorkspaceInternalService.upsertChatWorkspaces({
          chatIntegrationInstanceProvider: d.chatIntegrationInstanceProvider,
          workspaces: listing.workspaces
        });

        return {
          items: upserted.map(({ chat, workspace }) => ({ ...workspace, chat })),
          nextCursor: listing.nextCursor,
          prevCursor: listing.prevCursor
        };
      })
    );
  }

  private listChatWorkspacesFromDb(d: ListChatWorkspacesParams) {
    let search = d.search?.trim() || undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.chatWorkspace.findMany({
          ...opts,
          where: {
            chatIntegrationInstanceProviderOid: d.chatIntegrationInstanceProvider.oid,
            ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {})
          },
          include: chatWorkspaceInclude
        })
      )
    );
  }

  async getChatWorkspace(d: MetorialFacing<GetChatWorkspaceParams>) {
    let { instance, organizationActor, ...rest } = d;
    let scope = await resolveMetorialFacing(d);
    return this.getChatWorkspaceInternal({
      ...rest,
      tenant: scope.tenant,
      environment: scope.environment
    });
  }

  async getChatWorkspaceInternal(
    d: { tenant: Tenant; environment: Environment } & GetChatWorkspaceParams
  ) {
    checkTenant(d, d.chatIntegrationInstanceProvider);

    let client = await chatAdapterService.getChatAdapterClientInternal({
      tenant: d.tenant,
      environment: d.environment,
      chatIntegrationInstanceProvider: d.chatIntegrationInstanceProvider
    });

    return withChatCapabilityFallback(client, 'workspace_read', {
      provider: () => this.getChatWorkspaceFromProvider({ ...d, client }),
      fallback: () => this.getChatWorkspaceFromDb(d)
    });
  }

  private async getChatWorkspaceFromProvider(
    d: GetChatWorkspaceParams & { client: ChatAdapterInstance }
  ) {
    let local = await db.chatWorkspace.findFirst({
      where: {
        chatIntegrationInstanceProviderOid: d.chatIntegrationInstanceProvider.oid,
        OR: [{ id: d.workspaceId }, { workspaceId: d.workspaceId }]
      }
    });
    let workspaceId = local?.workspaceId ?? d.workspaceId;

    let got = await d.client.call('metorial_chat$workspace.get', { workspaceId });
    let workspace = unwrapChatCall(got, {
      code: 'chat_workspace_get_failed',
      message: 'Failed to load the workspace from the chat provider.'
    });

    let upserted = await chatWorkspaceInternalService.upsertChatWorkspace({
      chatIntegrationInstanceProvider: d.chatIntegrationInstanceProvider,
      workspace: workspace.workspace
    });

    return { ...upserted.workspace, chat: upserted.chat };
  }

  private async getChatWorkspaceFromDb(d: GetChatWorkspaceParams) {
    let local = await db.chatWorkspace.findFirst({
      where: {
        chatIntegrationInstanceProviderOid: d.chatIntegrationInstanceProvider.oid,
        OR: [{ id: d.workspaceId }, { workspaceId: d.workspaceId }]
      },
      include: chatWorkspaceInclude
    });

    return requireLocalChatEntity('chatWorkspace', d.workspaceId, local);
  }
}

export let chatWorkspaceService = Service.create(
  'chatWorkspaceService',
  () => new chatWorkspaceServiceImpl()
).build();
