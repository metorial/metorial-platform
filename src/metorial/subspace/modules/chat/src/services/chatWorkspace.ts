import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
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

    if (!client.isCapabilityAvailable('workspace_read')) {
      return Paginator.create(() => async () => ({
        items: [] as ChatWorkspaceWithChat[],
        pagination: { hasNextPage: false, hasPreviousPage: false }
      }));
    }

    let search = d.search?.trim() || undefined;

    return Paginator.create(({ externalCursor }) =>
      externalCursor(async page => {
        let listed = await client.call('metorial_chat$workspace.list', {
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
          items: upserted,
          nextCursor: listing.nextCursor,
          prevCursor: listing.prevCursor
        };
      })
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

    if (!client.isCapabilityAvailable('workspace_read')) {
      throw new ServiceError(notFoundError('chatWorkspace', d.workspaceId));
    }

    let local = await db.chatWorkspace.findFirst({
      where: {
        chatIntegrationInstanceProviderOid: d.chatIntegrationInstanceProvider.oid,
        OR: [{ id: d.workspaceId }, { workspaceId: d.workspaceId }]
      }
    });
    let workspaceId = local?.workspaceId ?? d.workspaceId;

    let got = await client.call('metorial_chat$workspace.get', { workspaceId });
    let workspace = unwrapChatCall(got, {
      code: 'chat_workspace_get_failed',
      message: 'Failed to load the workspace from the chat provider.'
    });

    let upserted = await chatWorkspaceInternalService.upsertChatWorkspace({
      chatIntegrationInstanceProvider: d.chatIntegrationInstanceProvider,
      workspace: workspace.workspace
    });

    return upserted;
  }
}

export let chatWorkspaceService = Service.create(
  'chatWorkspaceService',
  () => new chatWorkspaceServiceImpl()
).build();
