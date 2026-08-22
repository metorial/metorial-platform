import { addDays } from 'date-fns';
import { PublicUrlPurpose } from 'object-storage-client';
import type { SlateInvocation } from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId } from '../../id';
import { invocationsBucketRecord, storage } from '../../storage';
import { getStoredAttachmentsStorageKey } from './store';

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
};

let ATTACHMENT_EXPIRATION_DAYS = 7;

export let ensureSlateInvocationAttachment = async (d: {
  content: SlateToolCallAttachment['content'];
  mimeType?: string | undefined;
  invocation: SlateInvocation;
}) => {
  if (d.content.type === 'url') {
    return {
      type: 'url' as const,
      url: d.content.url,
      mimeType: d.mimeType
    };
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

  let expiresAt = addDays(new Date(), ATTACHMENT_EXPIRATION_DAYS);
  let inner = {
    digest,
    expiresAt,
    lastCreatedAt: new Date()
  };

  attachment = await db.slateAttachment.upsert({
    where: { digest },
    create: {
      ...getId('slateAttachment'),
      ...inner
    },
    update: inner
  });

  await db.slateInvocationAttachment.createMany({
    data: {
      ...getId('slateInvocationAttachment'),
      invocationOid: d.invocation.oid,
      attachmentsOid: attachment.oid
    }
  });

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
