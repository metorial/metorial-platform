import { Service } from '@lowerdeck/service';
import {
  type Chat,
  type ChatAuthor,
  type ChatChannel,
  type ChatMessage,
  type ChatThread,
  db
} from '@metorial-subspace/db';
import type { PresenterContext } from '@metorial/presenter';
import {
  chatAuthorPresenter,
  chatChannelPresenter,
  chatMessagePresenter,
  chatThreadPresenter
} from '@metorial/presenters';
import { chatMessageAttachmentInternalService } from './chatMessageAttachment';

export let chatEventPresenterContext: PresenterContext = {
  apiVersion: 'mt_2026_01_01_magnetar',
  accessType: 'event_system'
};

class chatEventPayloadServiceInternalImpl {
  async buildChatEventPayload(d: {
    chat: Chat;
    channel: ChatChannel | null;
    thread: ChatThread | null;
    message: ChatMessage | null;
    author: ChatAuthor | null;
  }): Promise<PrismaJson.ChatEventPayload> {
    let payload: PrismaJson.ChatEventPayload = {};

    if (d.channel) {
      let workspace = d.channel.workspaceOid
        ? await db.chatWorkspace.findUnique({ where: { oid: d.channel.workspaceOid } })
        : null;
      let recipient = d.channel.recipientOid
        ? await db.chatAuthor.findUnique({ where: { oid: d.channel.recipientOid } })
        : null;

      payload.channel = await chatChannelPresenter
        .present({
          chatChannel: { ...d.channel, chat: d.chat, workspace, recipient }
        })(chatEventPresenterContext)
        .run();
    }

    if (d.thread && d.channel) {
      payload.thread = await chatThreadPresenter
        .present({
          chatThread: { ...d.thread, chat: d.chat, channel: d.channel }
        })(chatEventPresenterContext)
        .run();
    }

    let messageAuthor =
      d.message?.authorOid === d.author?.oid
        ? d.author
        : d.message?.authorOid
          ? await db.chatAuthor.findUnique({ where: { oid: d.message.authorOid } })
          : null;

    if (d.message && d.channel) {
      let attachments =
        await chatMessageAttachmentInternalService.hydrateChatMessageAttachments(
          await db.chatMessageAttachment.findMany({
            where: { messageOid: d.message.oid },
            orderBy: { position: 'asc' }
          })
        );

      payload.message = await chatMessagePresenter
        .present({
          chatMessage: {
            ...d.message,
            chat: d.chat,
            channel: d.channel,
            thread: d.thread,
            author: messageAuthor,
            attachments
          }
        })(chatEventPresenterContext)
        .run();
    }

    if (d.author) {
      payload.author = await chatAuthorPresenter
        .present({
          chatAuthor: { ...d.author, chat: d.chat }
        })(chatEventPresenterContext)
        .run();
    }

    return payload;
  }
}

export let chatEventPayloadServiceInternal = Service.create(
  'chatEventPayloadServiceInternal',
  () => new chatEventPayloadServiceInternalImpl()
).build();
