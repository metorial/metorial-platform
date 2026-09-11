import { delay } from '@lowerdeck/delay';
import { ServiceError, validationError } from '@lowerdeck/error';
import { createHono } from '@lowerdeck/hono';
import { v } from '@lowerdeck/validation';
import { PublicUrlPurpose } from 'object-storage-client';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';
import {
  type LiveInvocationTokenPayload,
  releaseAttachmentBudget,
  reserveAttachmentBudget,
  resolveLiveInvocationToken
} from '../../lib/invocation/liveToken';
import { invocationsBucketRecord, storage } from '../../storage';

let DEFAULT_MAX_ATTACHMENT_SIZE_BYTES = 100 * 1024 * 1024;
let MAX_ATTACHMENT_SIZE_BYTES =
  env.storage.MAX_ATTACHMENT_SIZE_BYTES ?? DEFAULT_MAX_ATTACHMENT_SIZE_BYTES;

let MAX_ATTACHMENTS_PER_INVOCATION = 50;
let MAX_TOTAL_ATTACHMENT_BYTES_PER_INVOCATION = MAX_ATTACHMENT_SIZE_BYTES * 5;

let UPLOAD_URL_TTL_SECONDS = 5 * 60;
let UPLOAD_RECORD_TTL_SECONDS = 30 * 60;

let bodySchema = v.object({
  attachments: v.array(
    v.object({
      mimeType: v.optional(v.string()),
      filename: v.optional(v.string()),
      sizeBytes: v.optional(v.number({ modifiers: [v.positive()] }))
    })
  )
});

let getUploadStorageKey = (uploadId: string) => `attachments/uploads/${uploadId}`;

let findInvocationWithRetry = async (invocationId: string) => {
  for (let attempt = 0; attempt < 10; attempt++) {
    let invocation = await db.slateInvocation.findFirst({ where: { id: invocationId } });
    if (invocation) return invocation;
    await delay(150);
  }
  return null;
};

export let liveInvocationApp = createHono<{
  Variables: {
    liveInvocationToken: string;
    liveInvocationPayload: LiveInvocationTokenPayload;
  };
}>()
  .use('/slates-hub/live-invocation/*', async (c, next) => {
    let auth = c.req.header('authorization');
    let token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    let payload = token ? await resolveLiveInvocationToken(token) : null;
    if (!token || !payload) {
      return c.json({ error: 'invalid_or_expired_token' }, 401);
    }

    c.set('liveInvocationToken', token);
    c.set('liveInvocationPayload', payload);

    await next();
  })
  .post('/slates-hub/live-invocation/attachments', async c => {
    let body = await c.req.json().catch(() => null);
    let parsed = bodySchema.validate(body);
    if (!parsed.success) {
      throw new ServiceError(validationError({ entity: 'attachment', errors: parsed.errors }));
    }

    let input = parsed.value;
    if (input.attachments.length === 0) {
      return c.json({ error: 'empty_request' }, 400);
    }

    let token = c.get('liveInvocationToken');
    let payload = c.get('liveInvocationPayload');

    let declaredSizeSum = input.attachments.reduce((sum, a) => sum + (a.sizeBytes ?? 0), 0);
    let { newCount, newSize } = await reserveAttachmentBudget(token, {
      count: input.attachments.length,
      declaredSizeBytes: declaredSizeSum
    });

    if (
      newCount > MAX_ATTACHMENTS_PER_INVOCATION ||
      newSize > MAX_TOTAL_ATTACHMENT_BYTES_PER_INVOCATION
    ) {
      await releaseAttachmentBudget(token, {
        count: input.attachments.length,
        declaredSizeBytes: declaredSizeSum
      });
      return c.json({ error: 'attachment_budget_exceeded' }, 429);
    }

    let invocation = await findInvocationWithRetry(payload.invocationId);
    if (!invocation) {
      await releaseAttachmentBudget(token, {
        count: input.attachments.length,
        declaredSizeBytes: declaredSizeSum
      });
      return c.json({ error: 'invocation_not_found' }, 404);
    }

    let results = await Promise.all(
      input.attachments.map(async attachment => {
        let { oid, id } = getId('slateAttachmentUpload');
        let storageKey = getUploadStorageKey(id);
        let expiresAt = new Date(Date.now() + UPLOAD_RECORD_TTL_SECONDS * 1000);

        await db.slateAttachmentUpload.create({
          data: {
            oid,
            id,
            invocationOid: invocation.oid,
            mimeType: attachment.mimeType,
            filename: attachment.filename,
            status: 'pending',
            storageBucket: invocationsBucketRecord.bucket,
            storageKey,
            expiresAt
          }
        });

        let signed = await storage.getPublicURL(
          invocationsBucketRecord.bucket,
          storageKey,
          UPLOAD_URL_TTL_SECONDS,
          PublicUrlPurpose.Upload
        );

        return {
          referenceId: id,
          uploadUrl: signed.url,
          uploadMethod: 'PUT' as const,
          expiresAt: new Date(Date.now() + signed.expires_in * 1000).toISOString()
        };
      })
    );

    return c.json({ attachments: results });
  });
