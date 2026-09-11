import { canonicalize } from '@lowerdeck/canonicalize';
import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { Service } from '@lowerdeck/service';
import { type Workspace } from '@metorial-subspace/adapter-chat';
import {
  type Chat,
  type ChatIntegrationInstanceProvider,
  type ChatWorkspace,
  getId,
  withTransaction
} from '@metorial-subspace/db';
import { isUniqueConstraintError } from '../lib/unique';

export type UpsertChatWorkspaceParams = {
  chatIntegrationInstanceProvider: ChatIntegrationInstanceProvider;
  workspace: Workspace;
};

export type UpsertChatWorkspacesParams = {
  chatIntegrationInstanceProvider: ChatIntegrationInstanceProvider;
  workspaces: Workspace[];
};

export type UpsertedChatWorkspace = {
  chat: Chat;
  workspace: ChatWorkspace;
};

let adapterBindingInclude = {
  adapterIntegrationProvider: {
    include: {
      integrationProvider: {
        include: {
          provider: {
            include: {
              providerAdapters: {
                where: { identifier: 'chat' }
              }
            }
          }
        }
      }
    }
  }
} as const;

class chatWorkspaceInternalServiceImpl {
  async upsertChatWorkspace(d: UpsertChatWorkspaceParams) {
    let [result] = await this.upsertChatWorkspaces({
      chatIntegrationInstanceProvider: d.chatIntegrationInstanceProvider,
      workspaces: [d.workspace]
    });

    return result!;
  }

  async upsertChatWorkspaces(d: UpsertChatWorkspacesParams): Promise<UpsertedChatWorkspace[]> {
    if (d.workspaces.length === 0) return [];

    let run = () =>
      withTransaction(
        async db => {
          let existing = await db.chatWorkspace.findMany({
            where: {
              chatIntegrationInstanceProviderOid: d.chatIntegrationInstanceProvider.oid,
              workspaceId: { in: d.workspaces.map(workspace => workspace.id) }
            },
            include: { chat: true }
          });
          let existingByRemoteId = new Map(
            existing.map(workspace => [workspace.workspaceId, workspace])
          );

          let needsCreate = d.workspaces.some(
            workspace => !existingByRemoteId.has(workspace.id)
          );
          let binding = needsCreate
            ? await this.resolveChatAdapterBinding(d.chatIntegrationInstanceProvider)
            : null;

          let results = new Map<string, UpsertedChatWorkspace>();

          for (let workspace of d.workspaces) {
            let current = existingByRemoteId.get(workspace.id);
            if (current?.chat.status === 'deleted') {
              results.set(workspace.id, { chat: current.chat, workspace: current });
              continue;
            }

            let payload = this.workspacePayload(workspace);
            let workspaceSyncHash = await this.hashWorkspaceSync(payload);

            if (!current) {
              let chat = await db.chat.create({
                data: {
                  ...getId('chat'),
                  status: 'active',
                  name: workspace.name?.trim() || workspace.id,
                  chatIntegrationOid: d.chatIntegrationInstanceProvider.chatIntegrationOid,
                  chatIntegrationInstanceOid:
                    d.chatIntegrationInstanceProvider.chatIntegrationInstanceOid,
                  chatIntegrationInstanceProviderOid: d.chatIntegrationInstanceProvider.oid,
                  adapterOid: binding!.adapterOid,
                  providerOid: binding!.providerOid
                }
              });

              let created = await db.chatWorkspace.create({
                data: {
                  ...getId('chatWorkspace'),
                  workspaceId: workspace.id,
                  ...payload,
                  syncHash: workspaceSyncHash,
                  chatOid: chat.oid,
                  chatIntegrationInstanceProviderOid: d.chatIntegrationInstanceProvider.oid
                }
              });
              results.set(workspace.id, { chat, workspace: created });
              continue;
            }

            let chat = current.chat;
            let localWorkspace = current as ChatWorkspace;
            if (current.syncHash !== workspaceSyncHash) {
              [chat, localWorkspace] = await Promise.all([
                db.chat.update({
                  where: { oid: chat.oid },
                  data: {
                    name: payload.name || chat.name,
                    status: 'active',
                    archivedAt: null,
                    isParentDeleted: false
                  }
                }),
                db.chatWorkspace.update({
                  where: { oid: current.oid },
                  data: {
                    ...payload,
                    syncHash: workspaceSyncHash
                  }
                })
              ]);
            }

            results.set(workspace.id, { chat, workspace: localWorkspace });
          }

          return d.workspaces.map(workspace => results.get(workspace.id)!);
        },
        { ifExists: true }
      );

    try {
      return await run();
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;

      return await run();
    }
  }

  private workspacePayload(workspace: Workspace) {
    return {
      name: workspace.name?.trim() || null,
      domain: workspace.domain?.trim() || null,
      imageUrl: workspace.imageUrl?.trim() || null,
      raw: (workspace.raw as any) ?? {}
    };
  }

  private async hashWorkspaceSync(payload: ReturnType<typeof this.workspacePayload>) {
    return Hash.sha256(canonicalize(payload));
  }

  private async resolveChatAdapterBinding(
    chatIntegrationInstanceProvider: ChatIntegrationInstanceProvider
  ) {
    return await withTransaction(
      async db => {
        let loaded = await db.chatIntegrationInstanceProvider.findUniqueOrThrow({
          where: { oid: chatIntegrationInstanceProvider.oid },
          include: adapterBindingInclude
        });

        let integrationProvider = loaded.adapterIntegrationProvider.integrationProvider;
        let providerAdapter = integrationProvider.provider.providerAdapters[0];
        if (!providerAdapter) {
          throw new ServiceError(
            badRequestError({
              code: 'provider_does_not_implement_adapter',
              message: 'The provider does not implement the requested adapter.'
            })
          );
        }

        return {
          adapterOid: providerAdapter.oid,
          providerOid: integrationProvider.providerOid
        };
      },
      { ifExists: true }
    );
  }
}

export let chatWorkspaceInternalService = Service.create(
  'chatWorkspaceInternalService',
  () => new chatWorkspaceInternalServiceImpl()
).build();
