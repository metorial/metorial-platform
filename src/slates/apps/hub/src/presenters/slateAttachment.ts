import type { SlateAttachment, SlateInvocation } from '../../prisma/generated/client';
import { db } from '../db';
import { signedIntegrationAttachmentUrl } from '../lib/attachmentSignature';

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
  if (!attachment.targetUrl && (!attachment.storageBucket || !attachment.storageKey)) {
    throw new Error(`Attachment ${attachment.id} has no stored object`);
  }

  return {
    type: 'url' as const,
    attachmentId: attachment.id,
    url: await signedIntegrationAttachmentUrl(attachment.id),
    urlExpiresAt: attachment.expiresAt
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
