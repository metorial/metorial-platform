import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import { Service } from '@lowerdeck/service';
import { type Thread } from '@metorial-subspace/adapter-chat';
import {
  type Chat,
  type ChatChannel,
  type ChatThread,
  type ChatThreadType,
  getId,
  withTransaction
} from '@metorial-subspace/db';
import { isUniqueConstraintError } from '../lib/unique';

export type ChatThreadWithChat = ChatThread & { chat: Chat };

class chatThreadServiceInternalImpl {
  private threadPayload(thread: Thread) {
    return {
      type: thread.type as ChatThreadType,
      providerType: thread.providerType?.trim() || thread.type,
      subject: thread.subject?.trim() || null,
      context: (thread.context as any) ?? null,
      permalink: thread.permalink?.trim() || null,
      rootMessageId: thread.rootMessageId?.trim() || null,
      replyCount: thread.replyCount ?? null,
      lastReplyAt: thread.lastReplyAt ? new Date(thread.lastReplyAt) : null,
      raw: (thread.raw as any) ?? {}
    };
  }

  private async hashThreadSync(payload: ReturnType<typeof this.threadPayload>) {
    return Hash.sha256(canonicalize(payload));
  }

  async upsertChatThreads(d: {
    chat: Chat;
    channel: ChatChannel;
    threads: Thread[];
  }): Promise<ChatThreadWithChat[]> {
    if (d.threads.length === 0) return [];

    let run = () =>
      withTransaction(
        async db => {
          let existing = await db.chatThread.findMany({
            where: {
              channelOid: d.channel.oid,
              threadId: { in: d.threads.map(thread => thread.id) }
            }
          });
          let existingByRemoteId = new Map(existing.map(thread => [thread.threadId, thread]));

          let results = new Map<string, ChatThreadWithChat>();

          for (let thread of d.threads) {
            let current = existingByRemoteId.get(thread.id);
            let payload = this.threadPayload(thread);
            let syncHash = await this.hashThreadSync(payload);

            if (!current) {
              let created = await db.chatThread.create({
                data: {
                  ...getId('chatThread'),
                  threadId: thread.id,
                  ...payload,
                  syncHash,
                  channelOid: d.channel.oid,
                  chatOid: d.chat.oid
                }
              });
              results.set(thread.id, { ...created, chat: d.chat });
              continue;
            }

            let localThread = current;
            if (current.syncHash !== syncHash) {
              localThread = await db.chatThread.update({
                where: { oid: current.oid },
                data: { ...payload, syncHash }
              });
            }
            results.set(thread.id, { ...localThread, chat: d.chat });
          }

          return d.threads.map(thread => results.get(thread.id)!);
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

export let chatThreadServiceInternal = Service.create(
  'chatThreadServiceInternal',
  () => new chatThreadServiceInternalImpl()
).build();
