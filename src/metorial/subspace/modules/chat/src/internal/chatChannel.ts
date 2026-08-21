import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { Service } from '@lowerdeck/service';
import { type Channel } from '@metorial-subspace/adapter-chat';
import {
  type Chat,
  type ChatChannel,
  type ChatChannelType,
  type ChatIntegrationInstanceProvider,
  getId,
  withTransaction
} from '@metorial-subspace/db';
import { isUniqueConstraintError } from '../lib/unique';

export type ChatWithProvider = Chat & {
  chatIntegrationInstanceProvider: ChatIntegrationInstanceProvider;
};

export type ChatChannelWithChat = ChatChannel & { chat: Chat };

class chatChannelServiceInternalImpl {
  private channelPayload(channel: Channel, workspaceOid: bigint | null) {
    return {
      type: channel.type as ChatChannelType,
      providerType: channel.providerType?.trim() || channel.type,
      name: channel.name?.trim() || null,
      topic: channel.topic?.trim() || null,
      subject: channel.subject?.trim() || null,
      memberCount: channel.memberCount ?? null,
      context: (channel.context as any) ?? null,
      permalink: channel.permalink?.trim() || null,
      raw: (channel.raw as any) ?? {},
      workspaceOid
    };
  }

  private async hashChannelSync(payload: ReturnType<typeof this.channelPayload>) {
    return Hash.sha256(canonicalize(payload));
  }

  async upsertChatChannels(d: {
    chat: Chat;
    channels: Channel[];
  }): Promise<ChatChannelWithChat[]> {
    if (d.channels.length === 0) return [];

    let run = () =>
      withTransaction(
        async db => {
          let existing = await db.chatChannel.findMany({
            where: {
              chatOid: d.chat.oid,
              channelId: { in: d.channels.map(channel => channel.id) }
            }
          });
          let existingByRemoteId = new Map(
            existing.map(channel => [channel.channelId, channel])
          );

          let workspaceIds = [
            ...new Set(
              d.channels.map(channel => channel.workspaceId).filter((id): id is string => !!id)
            )
          ];
          let workspaces = workspaceIds.length
            ? await db.chatWorkspace.findMany({
                where: {
                  chatIntegrationInstanceProviderOid:
                    d.chat.chatIntegrationInstanceProviderOid,
                  workspaceId: { in: workspaceIds }
                }
              })
            : [];
          let workspaceOidByRemoteId = new Map(
            workspaces.map(workspace => [workspace.workspaceId, workspace.oid])
          );

          let results = new Map<string, ChatChannelWithChat>();

          for (let channel of d.channels) {
            let current = existingByRemoteId.get(channel.id);
            let workspaceOid = channel.workspaceId
              ? (workspaceOidByRemoteId.get(channel.workspaceId) ?? null)
              : null;
            let payload = this.channelPayload(channel, workspaceOid);
            let syncHash = await this.hashChannelSync(payload);

            if (!current) {
              let created = await db.chatChannel.create({
                data: {
                  ...getId('chatChannel'),
                  channelId: channel.id,
                  ...payload,
                  syncHash,
                  chatOid: d.chat.oid
                }
              });
              results.set(channel.id, { ...created, chat: d.chat });
              continue;
            }

            let localChannel = current;
            if (current.syncHash !== syncHash) {
              localChannel = await db.chatChannel.update({
                where: { oid: current.oid },
                data: { ...payload, syncHash }
              });
            }
            results.set(channel.id, { ...localChannel, chat: d.chat });
          }

          return d.channels.map(channel => results.get(channel.id)!);
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
}

export let chatChannelServiceInternal = Service.create(
  'chatChannelServiceInternal',
  () => new chatChannelServiceInternalImpl()
).build();
