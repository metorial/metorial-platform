import { createQueue } from '@lowerdeck/queue';
import { getSentry } from '@lowerdeck/sentry';
import { db } from '../../db';
import { env } from '../../env';
import { getAttachmentStorageKey } from '../../lib/invocation/store';
import {
  AttachmentDownloadTooLargeError,
  downloadUrlToStream
} from '../../lib/network/ssrfDownload';
import { invocationsBucketRecord, storage } from '../../storage';

let Sentry = getSentry();

let ATTACHMENT_MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;

export let slateAttachmentReplicateQueue = createQueue<{
  attachmentId: string;
  url: string;
  mimeType?: string;
}>({
  name: 'shub/att/replicate',
  redisUrl: env.service.REDIS_URL
});

export let slateAttachmentReplicateQueueProcessor = slateAttachmentReplicateQueue.process(
  async data => {
    let attachment = await db.slateAttachment.findUnique({ where: { id: data.attachmentId } });
    if (!attachment || !attachment.sourceUrl) return;

    try {
      let { stream, mimeType } = await downloadUrlToStream({
        url: data.url,
        maxBytes: ATTACHMENT_MAX_DOWNLOAD_BYTES
      });

      await storage.putObject(
        invocationsBucketRecord.bucket,
        getAttachmentStorageKey(attachment),
        stream,
        data.mimeType ?? mimeType ?? 'application/octet-stream'
      );

      await db.slateAttachment.update({
        where: { oid: attachment.oid },
        data: { sourceUrl: null }
      });
    } catch (err) {
      if (err instanceof AttachmentDownloadTooLargeError) return;

      Sentry.captureException(err, {
        extra: { attachmentId: data.attachmentId, url: data.url }
      });

      throw err;
    }
  }
);
