import { canonicalize } from '@lowerdeck/canonicalize';
import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { Service } from '@lowerdeck/service';
import {
  type AttachmentRef,
  type Channel,
  type Message,
  type Thread
} from '@metorial-subspace/adapter-chat';
import {
  type Chat,
  type ChatAuthor,
  type ChatChannel,
  type ChatMessage,
  type ChatThread,
  db,
  type Environment,
  getId,
  Prisma,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { isUniqueConstraintError } from '../lib/unique';
import { enqueueChatMessageAttachmentCleanup } from '../queues/attachment/cleanup';
import { enqueueChatMessageAttachmentSync } from '../queues/attachment/sync';
import { chatAuthorServiceInternal } from './chatAuthor';
import { chatChannelServiceInternal } from './chatChannel';
import { chatMessageGroupServiceInternal } from './chatMessageGroup';
import { chatThreadServiceInternal } from './chatThread';

export type ChatMessageWithRelations = ChatMessage & {
  chat: Chat;
  channel: ChatChannel;
  thread: ChatThread | null;
  author: ChatAuthor | null;
};

class chatMessageServiceInternalImpl {
  private messagePayload(message: Message, threadOid: bigint | null, authorOid: bigint) {
    return {
      providerType: message.providerType?.trim() || 'unknown',
      replyToMessageId: message.reply?.id ?? message.reply?.reference?.id ?? null,
      body: this.sanitizeMessageBody(message.body ?? { parts: [] }),
      reactions: message.reactions ? (message.reactions as any) : null,
      unfurls: message.unfurls ? (message.unfurls as any) : null,
      sentAt: new Date(message.metadata.sentAt),
      edited: message.metadata.edited,
      editedAt: message.metadata.editedAt ? new Date(message.metadata.editedAt) : null,
      threadOid,
      authorOid
    };
  }

  private sanitizeMessageBody(body: Message['body']) {
    if (!body || typeof body !== 'object') return null;

    return {
      ...body,
      attachments: body.attachments?.map(a => ({
        id: a.id,
        height: a.height,
        mimeType: a.mimeType,
        name: a.name,
        size: a.size,
        status: a.status,
        type: a.type,
        width: a.width
      }))
    } as any;
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
    let candidates: Array<{
      messageOid: bigint;
      messageId: string;
      attachment: AttachmentRef;
    }> = [];

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
        attachmentId: {
          in: candidates.map(c => c.attachment.id).filter((id): id is string => !!id)
        }
      },
      select: { messageOid: true, attachmentId: true }
    });
    let existingKeys = new Set(existing.map(row => `${row.messageOid}:${row.attachmentId}`));

    for (let [index, candidate] of candidates.entries()) {
      if (
        candidate.attachment.id &&
        existingKeys.has(`${candidate.messageOid}:${candidate.attachment.id}`)
      ) {
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
    let authorByUserId = new Map(authors.map(author => [author.userId, author]));

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
            let author = authorByUserId.get(message.author.userId) ?? null;
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
                thread,
                author
              });
              continue;
            }

            // A tombstone is never revived
            if (current.deletedAt) {
              results.set(message.id, {
                ...current,
                chat: d.chat,
                channel: d.channel,
                thread,
                author
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
              thread,
              author
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

    // Tombstones are returned so callers can see the message, but nothing may be re-materialized
    let persistedByRemoteId = new Map(
      upserted
        .filter(message => !message.deletedAt)
        .map(message => [message.messageId, message])
    );
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

  async persistMessageResult(d: {
    tenant: Tenant;
    environment: Environment;
    chat: Chat;
    localChannel: ChatChannel | null;
    result: { message: Message; channel?: Channel; thread?: Thread };
  }): Promise<ChatMessageWithRelations> {
    let channel = d.result.channel
      ? (
          await chatChannelServiceInternal.upsertChatChannels({
            chat: d.chat,
            channels: [d.result.channel]
          })
        )[0]
      : d.localChannel;
    if (!channel) {
      throw new ServiceError(notFoundError('chatChannel', d.result.message.channelId));
    }

    if (d.result.thread) {
      await chatThreadServiceInternal.upsertChatThreads({
        chat: d.chat,
        channel,
        threads: [d.result.thread]
      });
    }

    let [upserted] = await this.upsertChatMessages({
      tenant: d.tenant,
      environment: d.environment,
      chat: d.chat,
      channel,
      messages: [d.result.message]
    });

    return upserted!;
  }

  async softDeleteChatMessages(d: { messageOids: bigint[]; deletedAt?: Date }) {
    if (d.messageOids.length === 0) return;

    let attachments = await db.chatMessageAttachment.findMany({
      where: { messageOid: { in: d.messageOids } },
      select: { fileId: true, uploadedFileId: true, uploadedFileReferenceId: true }
    });

    await db.chatMessageAttachment.deleteMany({
      where: { messageOid: { in: d.messageOids } }
    });

    await db.chatMessage.updateMany({
      where: { oid: { in: d.messageOids }, deletedAt: null },
      data: {
        deletedAt: d.deletedAt ?? new Date(),
        body: Prisma.DbNull,
        reactions: Prisma.DbNull,
        unfurls: Prisma.DbNull,
        syncHash: null
      }
    });

    await enqueueChatMessageAttachmentCleanup(attachments);
  }

  async tombstoneChatMessage(d: {
    channel: ChatChannel;
    messageId: string;
    threadOid: bigint | null;
    deletedAt: Date;
  }): Promise<ChatMessage> {
    let existing = await db.chatMessage.findUnique({
      where: { channelOid_messageId: { channelOid: d.channel.oid, messageId: d.messageId } }
    });

    if (!existing) {
      try {
        return await db.chatMessage.create({
          data: {
            ...getId('chatMessage'),
            messageId: d.messageId,
            providerType: d.channel.providerType,
            channelOid: d.channel.oid,
            threadOid: d.threadOid,
            sentAt: d.deletedAt,
            deletedAt: d.deletedAt
          }
        });
      } catch (err) {
        if (!isUniqueConstraintError(err)) throw err;

        existing = await db.chatMessage.findUniqueOrThrow({
          where: {
            channelOid_messageId: { channelOid: d.channel.oid, messageId: d.messageId }
          }
        });
      }
    }

    await this.softDeleteChatMessages({
      messageOids: [existing.oid],
      deletedAt: d.deletedAt
    });

    return await db.chatMessage.findUniqueOrThrow({ where: { oid: existing.oid } });
  }
}

export let chatMessageServiceInternal = Service.create(
  'chatMessageServiceInternal',
  () => new chatMessageServiceInternalImpl()
).build();
