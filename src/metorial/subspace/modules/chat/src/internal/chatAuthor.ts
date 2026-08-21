import { Service } from '@lowerdeck/service';
import { type Author } from '@metorial-subspace/adapter-chat';
import {
  type Chat,
  type ChatAuthor,
  type ChatAuthorRole,
  type ChatAuthorType,
  getId,
  withTransaction
} from '@metorial-subspace/db';
import { isUniqueConstraintError } from '../lib/unique';

export type ChatAuthorWithChat = ChatAuthor & { chat: Chat };

class chatAuthorServiceInternalImpl {
  private authorPayload(author: Author) {
    return {
      userName: author.userName?.trim() || author.userId,
      fullName: author.fullName?.trim() || author.userName?.trim() || author.userId,
      type: author.type as ChatAuthorType,
      role: (author.role ?? 'unknown') as ChatAuthorRole,
      providerType: author.providerType?.trim() || author.type,
      isMe: author.isMe,
      email: author.email?.trim() || null,
      imageUrl: author.imageUrl?.trim() || null,
      raw: (author.raw as any) ?? {}
    };
  }

  async upsertChatAuthors(d: {
    chat: Chat;
    authors: Author[];
  }): Promise<ChatAuthorWithChat[]> {
    if (d.authors.length === 0) return [];

    let run = () =>
      withTransaction(
        async db => {
          let results = new Map<string, ChatAuthorWithChat>();

          for (let author of d.authors) {
            let payload = this.authorPayload(author);

            let upserted = await db.chatAuthor.upsert({
              where: { chatOid_userId: { chatOid: d.chat.oid, userId: author.userId } },
              create: {
                ...getId('chatAuthor'),
                userId: author.userId,
                ...payload,
                chatOid: d.chat.oid
              },
              update: payload
            });

            results.set(author.userId, { ...upserted, chat: d.chat });
          }

          return d.authors.map(author => results.get(author.userId)!);
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

export let chatAuthorServiceInternal = Service.create(
  'chatAuthorServiceInternal',
  () => new chatAuthorServiceInternalImpl()
).build();
