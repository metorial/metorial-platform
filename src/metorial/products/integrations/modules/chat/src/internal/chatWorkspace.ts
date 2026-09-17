import { canonicalize } from '@lowerdeck/canonicalize';
import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { Service } from '@lowerdeck/service';
import { type Workspace } from '@metorial-subspace/adapter-chat';
import {
  type Chat,
  type ChatInstanceProvider,
  type ChatWorkspace,
  db,
  getId,
  withTransaction
} from '@metorial-subspace/db';
import { chatPresenter, chatWorkspacePresenter } from '@metorial/presenters';
import { isUniqueConstraintError } from '../lib/unique';
import { chatInclude } from '../services/chat';
import { enqueueIndexChats } from '../queues/search/chat';
import { enqueueIndexChatWorkspaces } from '../queues/search/chatWorkspace';
import { chatEventInternalService } from './chatEvent';
import { chatEventPresenterContext } from './chatEventPayload';

export type UpsertChatWorkspaceParams = {
  chatInstanceProvider: ChatInstanceProvider;
  workspace: Workspace;
};

export type UpsertChatWorkspacesParams = {
  chatInstanceProvider: ChatInstanceProvider;
  workspaces: Workspace[];
};

export type UpsertedChatWorkspace = {
  chat: Chat;
  workspace: ChatWorkspace;
};

export type ResolvedChatForAuthorLink = {
  chat: Chat;
  workspace: ChatWorkspace | null;
};

let adapterBindingInclude = {
  adapterIntegrationProvider: {
    include: {
      adapterIntegration: true,
      integrationProvider: true
    }
  }
} as const;

class chatWorkspaceInternalServiceImpl {
  async upsertChatWorkspace(d: UpsertChatWorkspaceParams) {
    let [result] = await this.upsertChatWorkspaces({
      chatInstanceProvider: d.chatInstanceProvider,
      workspaces: [d.workspace]
    });

    return result!;
  }

  async resolveChatForAuthorLink(d: {
    chatInstanceProvider: ChatInstanceProvider;
    workspace?: Workspace;
  }): Promise<ResolvedChatForAuthorLink | null> {
    if (d.workspace) {
      return await this.upsertChatWorkspace({
        chatInstanceProvider: d.chatInstanceProvider,
        workspace: d.workspace
      });
    }

    let chat = await db.chat.findFirst({
      where: { chatInstanceProviderOid: d.chatInstanceProvider.oid, status: 'active' },
      orderBy: { createdAt: 'asc' },
      include: { workspace: true }
    });
    if (!chat) return null;

    return { chat, workspace: chat.workspace };
  }

  async upsertChatWorkspaces(d: UpsertChatWorkspacesParams): Promise<UpsertedChatWorkspace[]> {
    if (d.workspaces.length === 0) return [];

    let run = () =>
      withTransaction(
        async db => {
          let existing = await db.chatWorkspace.findMany({
            where: {
              chatInstanceProviderOid: d.chatInstanceProvider.oid,
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
            ? await this.resolveChatAdapterBinding(d.chatInstanceProvider)
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
                  chatConnectionOid: d.chatInstanceProvider.chatConnectionOid,
                  chatInstanceOid: d.chatInstanceProvider.chatInstanceOid,
                  chatInstanceProviderOid: d.chatInstanceProvider.oid,
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
                  chatInstanceProviderOid: d.chatInstanceProvider.oid
                }
              });

              await this.recordChatLifecycleEvents({
                chatInstanceProvider: d.chatInstanceProvider,
                chat,
                workspace: created,
                isNew: true
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

              await this.recordChatLifecycleEvents({
                chatInstanceProvider: d.chatInstanceProvider,
                chat,
                workspace: localWorkspace,
                isNew: false
              });
            }

            results.set(workspace.id, { chat, workspace: localWorkspace });
          }

          let workspaces = d.workspaces.map(workspace => results.get(workspace.id)!);
          await enqueueIndexChats(workspaces.map(workspace => workspace.chat.id));
          await enqueueIndexChatWorkspaces(
            workspaces.map(workspace => workspace.workspace.id)
          );
          return workspaces;
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

  private async recordChatLifecycleEvents(d: {
    chatInstanceProvider: ChatInstanceProvider;
    chat: Chat;
    workspace: ChatWorkspace;
    isNew: boolean;
  }) {
    let scope = {
      tenantOid: d.chatInstanceProvider.tenantOid,
      projectOid: d.chatInstanceProvider.projectOid,
      environmentOid: d.chatInstanceProvider.environmentOid,
      instanceOid: d.chatInstanceProvider.instanceOid,
      solutionOid: d.chatInstanceProvider.solutionOid,
      chatConnectionOid: d.chatInstanceProvider.chatConnectionOid,
      chatInstanceOid: d.chatInstanceProvider.chatInstanceOid,
      chatInstanceProviderOid: d.chatInstanceProvider.oid,
      chatOid: d.chat.oid
    };

    // The event payload needs the same relations the public chat/workspace presenters need
    // (chatConnection, chatInstance, provider, ...) -- neither the just-written Chat nor
    // ChatWorkspace row carries them, so hydrate once via withTransaction so it joins the
    // ambient transaction if one is active.
    let hydratedChat = await withTransaction(
      db => db.chat.findUniqueOrThrow({ where: { oid: d.chat.oid }, include: chatInclude }),
      { ifExists: true }
    );

    await chatEventInternalService.recordLifecycleEvent({
      ...scope,
      type: d.isNew ? 'chat.created' : 'chat.updated',
      payload: {
        chat: await chatPresenter
          .present({ chat: hydratedChat })(chatEventPresenterContext)
          .run()
      }
    });

    await chatEventInternalService.recordLifecycleEvent({
      ...scope,
      type: d.isNew ? 'chat.workspace.created' : 'chat.workspace.updated',
      payload: {
        chatWorkspace: await chatWorkspacePresenter
          .present({ chatWorkspace: { ...d.workspace, chat: hydratedChat } })(
            chatEventPresenterContext
          )
          .run()
      }
    });
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

  private async resolveChatAdapterBinding(chatInstanceProvider: ChatInstanceProvider) {
    return await withTransaction(
      async db => {
        let loaded = await db.chatInstanceProvider.findUniqueOrThrow({
          where: { oid: chatInstanceProvider.oid },
          include: adapterBindingInclude
        });

        let integrationProvider = loaded.adapterIntegrationProvider.integrationProvider;
        let providerAdapter = await db.providerAdapter.findUnique({
          where: {
            providerOid_globalOid: {
              providerOid: integrationProvider.providerOid,
              globalOid: loaded.adapterIntegrationProvider.adapterIntegration.adapterGlobalOid
            }
          }
        });
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
