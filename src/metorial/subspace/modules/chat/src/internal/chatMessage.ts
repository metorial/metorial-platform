import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { Service } from '@lowerdeck/service';
import { type AttachmentRef, type Message } from '@metorial-subspace/adapter-chat';
import {
  type Chat,
  type ChatChannel,
  type ChatMessage,
  type ChatThread,
  type Environment,
  db,
  getId,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { enqueueChatMessageAttachmentSync } from '../queues/attachment/sync';
import { isUniqueConstraintError } from '../lib/unique';
import { chatAuthorServiceInternal } from './chatAuthor';
import { chatMessageGroupServiceInternal } from './chatMessageGroup';

export type ChatMessageWithRelations = ChatMessage & {
  chat: Chat;
  channel: ChatChannel;
  thread: ChatThread | null;
};

class chatMessageServiceInternalImpl {
  private messagePayload(message: Message, threadOid: bigint | null, authorOid: bigint) {
    return {
      providerType: message.providerType?.trim() || 'unknown',
      replyToMessageId: message.reply?.id ?? message.reply?.reference?.id ?? null,
      body: (message.body as any) ?? { parts: [] },
      reactions: message.reactions ? (message.reactions as any) : null,
      unfurls: message.unfurls ? (message.unfurls as any) : null,
      sentAt: new Date(message.metadata.sentAt),
      edited: message.metadata.edited,
      editedAt: message.metadata.editedAt ? new Date(message.metadata.editedAt) : null,
      threadOid,
      authorOid
    };
  }

  private async hashMessageSync(payload: ReturnType<typeof this.messagePayload>) {
    return Hash.sha256(canonicalize(payload));
  }

  private async discoverAndSyncAttachments(d: {
    tenant: Tenant;
    environment: Environment;
    chat: Chat;
    messages: Message[];
    persistedByRemoteId: Map<string, ChatMessage>;
  }) {
    let candidates: Array<{ messageOid: bigint; messageId: string; attachment: AttachmentRef }> =
      [];

    for (let message of d.messages) {
      let persisted = d.persistedByRemoteId.get(message.id);
      let attachments = (message.body as { attachments?: AttachmentRef[] } | null)
        ?.attachments;
      if (!persisted || !attachments?.length) continue;

      for (let attachment of attachments) {
        candidates.push({ messageOid: persisted.oid, messageId: persisted.id, attachment });
      }
    }
    if (candidates.length === 0) return;

    let existing = await db.chatMessageAttachment.findMany({
      where: {
        messageOid: { in: candidates.map(c => c.messageOid) },
        attachmentId: { in: candidates.map(c => c.attachment.id).filter((id): id is string => !!id) }
      },
      select: { messageOid: true, attachmentId: true }
    });
    let existingKeys = new Set(existing.map(row => `${row.messageOid}:${row.attachmentId}`));

    for (let [index, candidate] of candidates.entries()) {
      if (candidate.attachment.id && existingKeys.has(`${candidate.messageOid}:${candidate.attachment.id}`)) {
        continue;
      }

      await enqueueChatMessageAttachmentSync({
        tenantId: d.tenant.id,
        environmentId: d.environment.id,
        chatId: d.chat.id,
        messageId: candidate.messageId,
        attachment: candidate.attachment,
        position: index
      });
    }
  }

  private async syncMessageGroups(d: {
    channel: ChatChannel;
    messages: Message[];
    persistedByRemoteId: Map<string, ChatMessage>;
  }) {
    for (let message of d.messages) {
      if (!message.groupId) continue;
      let persisted = d.persistedByRemoteId.get(message.id);
      if (!persisted) continue;

      await chatMessageGroupServiceInternal.attachInboundMessageToGroup({
        channel: d.channel,
        message: persisted,
        providerGroupKey: message.groupId
      });
    }
  }

  async upsertChatMessages(d: {
    tenant: Tenant;
    environment: Environment;
    chat: Chat;
    channel: ChatChannel;
    messages: Message[];
  }): Promise<ChatMessageWithRelations[]> {
    if (d.messages.length === 0) return [];

    let authors = await chatAuthorServiceInternal.upsertChatAuthors({
      chat: d.chat,
      authors: d.messages.map(message => message.author)
    });
    let authorOidByUserId = new Map(authors.map(author => [author.userId, author.oid]));

    let threadIds = [
      ...new Set(
        d.messages.map(message => message.threadId).filter((id): id is string => !!id)
      )
    ];
    let threads = threadIds.length
      ? await db.chatThread.findMany({
          where: { channelOid: d.channel.oid, threadId: { in: threadIds } }
        })
      : [];
    let threadByRemoteId = new Map(threads.map(thread => [thread.threadId, thread]));

    let run = () =>
      withTransaction(
        async db => {
          let existing = await db.chatMessage.findMany({
            where: {
              channelOid: d.channel.oid,
              messageId: { in: d.messages.map(message => message.id) }
            }
          });
          let existingByRemoteId = new Map(
            existing.map(message => [message.messageId, message])
          );

          let results = new Map<string, ChatMessageWithRelations>();

          for (let message of d.messages) {
            let authorOid = authorOidByUserId.get(message.author.userId);
            if (!authorOid) continue;

            let current = existingByRemoteId.get(message.id);
            let thread = message.threadId
              ? (threadByRemoteId.get(message.threadId) ?? null)
              : null;
            let payload = this.messagePayload(message, thread?.oid ?? null, authorOid);
            let syncHash = await this.hashMessageSync(payload);

            if (!current) {
              let created = await db.chatMessage.create({
                data: {
                  ...getId('chatMessage'),
                  messageId: message.id,
                  ...payload,
                  syncHash,
                  channelOid: d.channel.oid
                }
              });
              results.set(message.id, {
                ...created,
                chat: d.chat,
                channel: d.channel,
                thread
              });
              continue;
            }

            let localMessage = current;
            if (current.syncHash !== syncHash) {
              localMessage = await db.chatMessage.update({
                where: { oid: current.oid },
                data: { ...payload, syncHash }
              });
            }
            results.set(message.id, {
              ...localMessage,
              chat: d.chat,
              channel: d.channel,
              thread
            });
          }

          return d.messages
            .filter(message => results.has(message.id))
            .map(message => results.get(message.id)!);
        },
        { ifExists: true }
      );

    let upserted: ChatMessageWithRelations[];
    try {
      upserted = await run();
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
      upserted = await run();
    }

    let persistedByRemoteId = new Map(upserted.map(message => [message.messageId, message]));
    await this.syncMessageGroups({
      channel: d.channel,
      messages: d.messages,
      persistedByRemoteId
    });
    await this.discoverAndSyncAttachments({
      tenant: d.tenant,
      environment: d.environment,
      chat: d.chat,
      messages: d.messages,
      persistedByRemoteId
    });

    return upserted;
  }
}

export let chatMessageServiceInternal = Service.create(
  'chatMessageServiceInternal',
  () => new chatMessageServiceInternalImpl()
).build();
