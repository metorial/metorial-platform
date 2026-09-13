export * from './services';
import { registerFileContentDelegate } from '@metorial/module-file';
import { db, presentToolCallAttachmentWithTokenExpiry } from '@metorial-subspace/db';
import './listener';
import {
  chatMessageAttachmentDelegatorKey,
  chatMessageAttachmentInternalService
} from './internal/chatMessageAttachment';

void registerFileContentDelegate({
  key: chatMessageAttachmentDelegatorKey,
  resolve: async ({ ref }) => {
    let { chatMessageAttachmentId } = ref as { chatMessageAttachmentId: string };

    let attachment = await db.chatMessageAttachment.findUniqueOrThrow({
      where: { id: chatMessageAttachmentId },
      include: {
        toolCallAttachment: true,
        message: {
          include: {
            channel: {
              include: {
                chat: { include: { chatInstanceProvider: true } }
              }
            }
          }
        }
      }
    });

    let chat = attachment.message.channel.chat;
    let ciip = chat.chatInstanceProvider;

    let [tenant, environment] = await Promise.all([
      db.tenant.findUniqueOrThrow({ where: { oid: ciip.tenantOid } }),
      db.environment.findUniqueOrThrow({ where: { oid: ciip.environmentOid } })
    ]);

    let refreshed =
      await chatMessageAttachmentInternalService.ensureFreshChatMessageAttachment({
        tenant,
        environment,
        chat,
        attachment
      });

    if (!refreshed.toolCallAttachment) {
      throw new Error(`Chat message attachment ${chatMessageAttachmentId} has no content`);
    }

    let presented = await presentToolCallAttachmentWithTokenExpiry(
      refreshed.toolCallAttachment,
      new Date(Date.now() + 24 * 60 * 60_000)
    );

    return {
      type: 'redirect',
      url: presented.url,
      expiresAt: presented.urlExpiresAt
    };
  }
});
