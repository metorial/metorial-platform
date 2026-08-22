import { addDays } from 'date-fns';
import type { SlateAttachment, SlateInvocation } from '../../prisma/generated/client';
import { db } from '../db';
import { getAttachmentStorageKey } from '../lib/invocation/store';
import { invocationsBucketRecord, storage } from '../storage';

let ATTACHMENT_PUBLIC_URL_EXPIRATION_DAYS = 7;

type InvocationWithStoredAttachments = SlateInvocation & {
  slateInvocationAttachment?: { attachments: SlateAttachment }[];
};

let getStoredAttachments = async (invocation: InvocationWithStoredAttachments) => {
  if (invocation.slateInvocationAttachment) {
    return invocation.slateInvocationAttachment.map(record => record.attachments);
  }

  let records = await db.slateInvocationAttachment.findMany({
    where: {
      invocationOid: invocation.oid
    },
    include: {
      attachments: true
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  return records.map(record => record.attachments);
};

export let slateStoredAttachmentPresenter = async (attachment: SlateAttachment) => {
  let storageKey = getAttachmentStorageKey(attachment);
  let url = await storage.getPublicURL(
    invocationsBucketRecord.bucket,
    storageKey,
    ATTACHMENT_PUBLIC_URL_EXPIRATION_DAYS * 24 * 60 * 60
  );

  return {
    type: 'url' as const,
    url: url.url,
    urlExpiresAt: addDays(new Date(), ATTACHMENT_PUBLIC_URL_EXPIRATION_DAYS)
  };
};

export let slateInvocationAttachmentsPresenter = async (
  invocation: InvocationWithStoredAttachments
) => {
  return await Promise.all(
    (await getStoredAttachments(invocation)).map(attachment =>
      slateStoredAttachmentPresenter(attachment)
    )
  );
};
