import { addDays } from 'date-fns';
import type { SlateAttachment, SlateInvocation } from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId } from '../../id';
import { invocationsBucketRecord, storage } from '../../storage';
import {
  ATTACHMENT_SIGNATURE_MAX_AGE_MS,
  signedIntegrationAttachmentUrl
} from '../attachmentSignature';
import { getStoredAttachmentsStorageKey } from './store';

export type SlateToolCallAttachment = {
  content:
    | {
        type: 'url';
        url: string;
        headers?: Record<string, string>;
        query?: Record<string, string>;
        refreshReference?: unknown;
        refreshAt?: string;
      }
    | {
        type: 'content';
        encoding: 'base64' | 'utf-8';
        content: string;
      }
    | {
        type: 'upload_reference';
        referenceId: string;
      };
  mimeType?: string;
};

let ATTACHMENT_EXPIRATION_DAYS = 7;

let presentStoredAttachment = async (d: {
  attachment: SlateAttachment;
  mimeType?: string;
}) => {
  let url = await signedIntegrationAttachmentUrl(d.attachment.id);
  let ts = Number(new URL(url).searchParams.get('ts'));

  return {
    type: 'url' as const,
    attachmentId: d.attachment.id,
    url,
    mimeType: d.mimeType,
    urlExpiresAt: new Date(ts + ATTACHMENT_SIGNATURE_MAX_AGE_MS)
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
  mimeType?: string;
  invocation: SlateInvocation;
  tenantOid: bigint;
}) => {
  let expiresAt = addDays(new Date(), ATTACHMENT_EXPIRATION_DAYS);

  if (d.content.type === 'upload_reference') {
    let upload = await db.slateAttachmentUpload.findFirst({
      where: { id: d.content.referenceId, invocationOid: d.invocation.oid }
    });
    if (!upload) return null;

    let claimed = await db.slateAttachmentUpload.updateMany({
      where: { oid: upload.oid, status: 'pending' },
      data: { status: 'processing' }
    });
    if (claimed.count === 0) return null;

    let info = await storage
      .headObject(upload.storageBucket, upload.storageKey)
      .catch(() => null);
    if (!info) {
      await db.slateAttachmentUpload.updateMany({
        where: { oid: upload.oid, status: 'processing' },
        data: { status: 'failed' }
      });
      return null;
    }

    let attachment = await db.slateAttachment.create({
      data: {
        ...getId('slateAttachment'),
        tenantOid: d.tenantOid,
        storageBucket: upload.storageBucket,
        storageKey: upload.storageKey,
        mimeType: d.mimeType ?? info.content_type ?? upload.mimeType,
        expiresAt
      }
    });

    await db.slateAttachmentUpload.updateMany({
      where: { oid: upload.oid, status: 'processing' },
      data: { status: 'confirmed', sizeBytes: info.size }
    });
    await linkInvocationToAttachment({ invocation: d.invocation, attachment });

    return presentStoredAttachment({ attachment, mimeType: attachment.mimeType ?? undefined });
  }

  if (d.content.type === 'url') {
    let attachment = await db.slateAttachment.create({
      data: {
        ...getId('slateAttachment'),
        tenantOid: d.tenantOid,
        targetUrl: d.content.url,
        headers: d.content.headers,
        query: d.content.query,
        mimeType: d.mimeType,
        expiresAt
      }
    });

    await linkInvocationToAttachment({ invocation: d.invocation, attachment });
    return presentStoredAttachment({ attachment, mimeType: d.mimeType });
  }

  let contentBuffer = Buffer.from(d.content.content, d.content.encoding);
  let digest = new Uint8Array(await crypto.subtle.digest('SHA-256', contentBuffer));
  let digestString = Buffer.from(digest).toString('hex');
  let blob = await db.slateAttachmentBlob.findUnique({ where: { digest } });

  if (!blob) {
    let storageKey = getStoredAttachmentsStorageKey(digestString);
    await storage.putObject(
      invocationsBucketRecord.bucket,
      storageKey,
      contentBuffer,
      d.mimeType ?? 'application/octet-stream'
    );

    blob = await db.slateAttachmentBlob.upsert({
      where: { digest },
      create: {
        ...getId('slateAttachmentBlob'),
        digest,
        storageBucket: invocationsBucketRecord.bucket,
        storageKey,
        mimeType: d.mimeType,
        sizeBytes: contentBuffer.byteLength
      },
      update: {}
    });
  }

  let attachment = await db.slateAttachment.create({
    data: {
      ...getId('slateAttachment'),
      digest,
      tenantOid: d.tenantOid,
      storageBucket: blob.storageBucket,
      storageKey: blob.storageKey,
      mimeType: d.mimeType,
      expiresAt
    }
  });

  await linkInvocationToAttachment({ invocation: d.invocation, attachment });
  return presentStoredAttachment({ attachment, mimeType: d.mimeType });
};
