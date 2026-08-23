import { addDays } from 'date-fns';
import { PublicUrlPurpose } from 'object-storage-client';
import type { SlateAttachment, SlateInvocation } from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId } from '../../id';
import { slateAttachmentReplicateQueue } from '../../queues/attachment/replicate';
import { invocationsBucketRecord, storage } from '../../storage';
import { getAttachmentStorageKey, getStoredAttachmentsStorageKey } from './store';

export type SlateToolCallAttachment = {
  content:
    | {
        type: 'url';
        url: string;
      }
    | {
        type: 'content';
        encoding: 'base64' | 'utf-8';
        content: string;
      };
  mimeType?: string;
  attachmentHash?: string;
};

let ATTACHMENT_EXPIRATION_DAYS = 7;

let presentStoredAttachment = async (d: {
  attachment: SlateAttachment;
  mimeType?: string;
}) => {
  if (d.attachment.sourceUrl) {
    return {
      type: 'url' as const,
      url: d.attachment.sourceUrl,
      mimeType: d.mimeType
    };
  }

  let storageKey = getAttachmentStorageKey(d.attachment);
  let url = await storage.getPublicURL(
    invocationsBucketRecord.bucket,
    storageKey,
    ATTACHMENT_EXPIRATION_DAYS * 24 * 60 * 60,
    PublicUrlPurpose.Retrieve
  );

  return {
    type: 'url' as const,
    url: url.url,
    mimeType: d.mimeType,
    urlExpiresAt: addDays(new Date(), ATTACHMENT_EXPIRATION_DAYS)
  };
};

let linkInvocationToAttachment = (d: {
  invocation: SlateInvocation;
  attachment: SlateAttachment;
}) =>
  db.slateInvocationAttachment.createMany({
    data: {
      ...getId('slateInvocationAttachment'),
      invocationOid: d.invocation.oid,
      attachmentsOid: d.attachment.oid
    }
  });

export let ensureSlateInvocationAttachment = async (d: {
  content: SlateToolCallAttachment['content'];
  mimeType?: string | undefined;
  attachmentHash?: string | undefined;
  invocation: SlateInvocation;
  tenantOid: bigint;
  slateOid: bigint;
  downloadUrlAttachments?: boolean;
}) => {
  if (d.attachmentHash) {
    let existing = await db.slateAttachment.findFirst({
      where: { tenantOid: d.tenantOid, slateOid: d.slateOid, attachmentHash: d.attachmentHash }
    });

    if (existing) {
      let refreshed = await db.slateAttachment.update({
        where: { oid: existing.oid },
        data: {
          expiresAt: addDays(new Date(), ATTACHMENT_EXPIRATION_DAYS),
          lastCreatedAt: new Date()
        }
      });

      await linkInvocationToAttachment({ invocation: d.invocation, attachment: refreshed });

      return presentStoredAttachment({ attachment: refreshed, mimeType: d.mimeType });
    }
  }

  if (d.content.type === 'url') {
    if (!d.downloadUrlAttachments) {
      return {
        type: 'url' as const,
        url: d.content.url,
        mimeType: d.mimeType
      };
    }

    let attachment = await db.slateAttachment.create({
      data: {
        ...getId('slateAttachment'),
        digest: null,
        tenantOid: d.tenantOid,
        slateOid: d.slateOid,
        attachmentHash: d.attachmentHash ?? null,
        sourceUrl: d.content.url,
        expiresAt: addDays(new Date(), ATTACHMENT_EXPIRATION_DAYS),
        lastCreatedAt: new Date()
      }
    });

    await linkInvocationToAttachment({ invocation: d.invocation, attachment });

    await slateAttachmentReplicateQueue.add({
      attachmentId: attachment.id,
      url: d.content.url,
      mimeType: d.mimeType
    });

    return presentStoredAttachment({ attachment, mimeType: d.mimeType });
  }

  let contentBuffer = Buffer.from(d.content.content, d.content.encoding);
  let digest = new Uint8Array(await crypto.subtle.digest('SHA-256', contentBuffer));
  let digestString = Buffer.from(digest).toString('hex');
  let storageKey = getStoredAttachmentsStorageKey(digestString);

  let attachment = await db.slateAttachment.findFirst({
    where: { digest }
  });
  if (!attachment) {
    await storage.putObject(
      invocationsBucketRecord.bucket,
      storageKey,
      contentBuffer,
      d.mimeType ?? 'application/octet-stream'
    );
  }

  let refresh = {
    expiresAt: addDays(new Date(), ATTACHMENT_EXPIRATION_DAYS),
    lastCreatedAt: new Date()
  };

  attachment = await db.slateAttachment.upsert({
    where: { digest },
    create: {
      ...getId('slateAttachment'),
      digest,
      tenantOid: d.tenantOid,
      slateOid: d.slateOid,
      attachmentHash: d.attachmentHash ?? null,
      ...refresh
    },
    update: refresh
  });

  await linkInvocationToAttachment({ invocation: d.invocation, attachment });

  return presentStoredAttachment({ attachment, mimeType: d.mimeType });
};
