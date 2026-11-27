import { createLock } from '@lowerdeck/lock';
import { db } from '@mtsrc/slates-hub-db/db';
import { env } from '@mtsrc/slates-hub-env/env';
import {
  refreshableAttachmentInclude,
  slateAttachmentRefreshService,
  type RefreshableAttachment
} from '../services/slateAttachmentRefresh';

let refreshLock = createLock({
  name: 'shub/att/refresh/lock',
  redisUrl: env.service.REDIS_URL
});

let refreshIfDue = async (
  attachment: RefreshableAttachment
): Promise<RefreshableAttachment> => {
  if (!attachment.refreshAfter || attachment.refreshAfter >= new Date()) return attachment;

  try {
    return await refreshLock.usingLock(
      attachment.id,
      async () => {
        let fresh = await db.slateAttachment.findUniqueOrThrow({
          where: { oid: attachment.oid },
          include: refreshableAttachmentInclude
        });
        if (!fresh.refreshAfter || fresh.refreshAfter >= new Date()) return fresh;

        return slateAttachmentRefreshService.refreshProxiedAttachment({ attachment: fresh });
      },
      { durationMs: 30_000, acquisitionTimeoutMs: 20_000 }
    );
  } catch {
    return attachment;
  }
};

export let getIntegrationAttachment = async (d: { attachmentId: string }) => {
  let attachment = await db.slateAttachment.findFirst({
    where: { id: d.attachmentId },
    include: refreshableAttachmentInclude
  });

  let hasStoredObject = !!(attachment?.storageBucket && attachment?.storageKey);
  if (!attachment || (!attachment.targetUrl && !hasStoredObject)) return null;
  if (attachment.expiresAt < new Date()) return null;

  return refreshIfDue(attachment);
};
