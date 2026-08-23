export * from './services';
import { registerFileContentDelegate } from '@metorial/module-file';
import { db } from '@metorial-subspace/db';
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
                chat: { include: { chatIntegrationInstanceProvider: true } }
              }
            }
          }
        }
      }
    });

    let chat = attachment.message.channel.chat;
    let ciip = chat.chatIntegrationInstanceProvider;

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

    return {
      type: 'url',
      url: refreshed.toolCallAttachment.url,
      expiresAt: refreshed.toolCallAttachment.expiresAt ?? undefined
    };
  }
});
