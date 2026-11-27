import { delay } from '@lowerdeck/delay';
import { ServiceError, validationError } from '@lowerdeck/error';
import { type Context, createHono } from '@lowerdeck/hono';
import { v, type ValidationType } from '@lowerdeck/validation';
import type { SlateAttachmentUpload } from '../../../prisma/generated/client';
import { db } from '../../db';
import { getId } from '../../id';
import {
  MAX_ATTACHMENTS_PER_INVOCATION,
  maxTotalAttachmentBytesPerInvocation,
  maxAttachmentSizeBytes
} from '../../lib/attachmentLimits';
import {
  type LiveInvocationTokenPayload,
  releaseAttachmentBudget,
  reserveAttachmentBudget,
  resolveLiveInvocationToken
} from '../../lib/invocation/liveToken';
import {
  completeUploadParts,
  isMultipartUpload,
  MAX_PARTS_PER_SIGNING,
  MAX_UPLOAD_PARTS,
  planUploadParts,
  signSingleUpload,
  signUploadParts,
  uploadPartCount
} from '../../lib/invocation/liveUpload';
import { slateAttachmentUploadDeleteQueue } from '../../queues/attachment/uploadDelete';
import { invocationsBucketRecord, storage } from '../../storage';

let UPLOAD_RECORD_TTL_SECONDS = 30 * 60;
let MAX_RECEIPT_LENGTH = 4096;

let registerSchema = v.object({
  attachments: v.array(
    v.object({
      mimeType: v.optional(v.string()),
      filename: v.optional(v.string()),
      sizeBytes: v.optional(v.number({ modifiers: [v.integer(), v.minValue(0)] }))
    })
  )
});

let signPartsSchema = v.object({
  numbers: v.array(v.number({ modifiers: [v.integer(), v.minValue(1)] }), {
    modifiers: [v.minLength(1), v.maxLength(MAX_PARTS_PER_SIGNING)]
  })
});

let completeSchema = v.object({
  receipts: v.array(v.string({ modifiers: [v.maxLength(MAX_RECEIPT_LENGTH)] }), {
    modifiers: [v.minLength(1), v.maxLength(MAX_UPLOAD_PARTS)]
  })
});

type LiveInvocationEnv = {
  Variables: {
    liveInvocationToken: string;
    liveInvocationPayload: LiveInvocationTokenPayload;
  };
};

let getUploadStorageKey = (uploadId: string) => `attachments/uploads/${uploadId}`;

let findInvocationWithRetry = async (invocationId: string) => {
  for (let attempt = 0; attempt < 10; attempt++) {
    let invocation = await db.slateInvocation.findFirst({ where: { id: invocationId } });
    if (invocation) return invocation;
    await delay(150);
  }
  return null;
};

let parseBody = async <T>(c: Context, schema: ValidationType<T>) => {
  let parsed = schema.validate(await c.req.json().catch(() => null));
  if (!parsed.success) {
    throw new ServiceError(validationError({ entity: 'attachment', errors: parsed.errors }));
  }

  return parsed.value;
};

let findPendingUpload = (c: Context<LiveInvocationEnv>) =>
  db.slateAttachmentUpload.findFirst({
    where: {
      id: c.req.param('referenceId'),
      status: 'pending',
      expiresAt: { gt: new Date() },
      invocation: { id: c.get('liveInvocationPayload').invocationId }
    }
  });

// Slates that can't upload in parts get a single URL; object storage holds it to the declared size.
let registerUpload = async (d: {
  invocationOid: bigint;
  mimeType?: string;
  filename?: string;
  sizeBytes: number;
  multipart: boolean;
}) => {
  let { oid, id } = getId('slateAttachmentUpload');
  let storageKey = getUploadStorageKey(id);
  let plan = d.multipart && d.sizeBytes > 0 ? planUploadParts(d.sizeBytes) : null;

  let multipartUploadId = plan
    ? await storage.startMultipartUpload(
        invocationsBucketRecord.bucket,
        storageKey,
        d.mimeType
      )
    : null;

  let upload = await db.slateAttachmentUpload.create({
    data: {
      oid,
      id,
      invocationOid: d.invocationOid,
      mimeType: d.mimeType,
      filename: d.filename,
      status: 'pending',
      storageBucket: invocationsBucketRecord.bucket,
      storageKey,
      declaredSizeBytes: d.sizeBytes,
      multipartUploadId,
      partSizeBytes: plan?.partSizeBytes,
      expiresAt: new Date(Date.now() + UPLOAD_RECORD_TTL_SECONDS * 1000)
    }
  });

  if (!isMultipartUpload(upload)) {
    return {
      referenceId: id,
      uploadMethod: 'PUT' as const,
      ...(await signSingleUpload({ ...upload, declaredSizeBytes: d.sizeBytes }))
    };
  }

  let partCount = uploadPartCount(upload);
  let firstParts = Array.from(
    { length: Math.min(partCount, MAX_PARTS_PER_SIGNING) },
    (_, i) => i + 1
  );

  return {
    referenceId: id,
    uploadMethod: 'MULTIPART' as const,
    partSizeBytes: upload.partSizeBytes,
    partCount,
    parts: await signUploadParts(upload, firstParts),
    expiresAt: upload.expiresAt.toISOString()
  };
};

let discardUpload = async (upload: SlateAttachmentUpload) => {
  if (upload.multipartUploadId) {
    await storage
      .abortMultipartUpload(upload.storageBucket, upload.storageKey, upload.multipartUploadId)
      .catch(() => {});
  }

  await slateAttachmentUploadDeleteQueue.add({
    bucket: upload.storageBucket,
    key: upload.storageKey
  });
};

export let liveInvocationApp = createHono<LiveInvocationEnv>()
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
    let input = await parseBody(c, registerSchema);
    if (input.attachments.length === 0) {
      return c.json({ error: 'empty_request' }, 400);
    }

    let token = c.get('liveInvocationToken');
    let payload = c.get('liveInvocationPayload');
    let multipart = !!payload.multipartUpload;

    let attachments = input.attachments.map(a => ({ ...a, sizeBytes: a.sizeBytes ?? 0 }));
    if (attachments.some(a => a.sizeBytes > maxAttachmentSizeBytes({ multipart }))) {
      return c.json({ error: 'attachment_too_large' }, 413);
    }

    let budget = {
      count: attachments.length,
      declaredSizeBytes: attachments.reduce((sum, a) => sum + a.sizeBytes, 0)
    };
    let { newCount, newSize } = await reserveAttachmentBudget(token, budget);

    if (
      newCount > MAX_ATTACHMENTS_PER_INVOCATION ||
      newSize > maxTotalAttachmentBytesPerInvocation()
    ) {
      await releaseAttachmentBudget(token, budget);
      return c.json({ error: 'attachment_budget_exceeded' }, 429);
    }

    let invocation = await findInvocationWithRetry(payload.invocationId);
    if (!invocation) {
      await releaseAttachmentBudget(token, budget);
      return c.json({ error: 'invocation_not_found' }, 404);
    }

    let results = await Promise.all(
      attachments.map(attachment =>
        registerUpload({
          ...attachment,
          invocationOid: invocation.oid,
          multipart
        })
      )
    );

    return c.json({ attachments: results });
  })
  .post('/slates-hub/live-invocation/attachments/:referenceId/parts', async c => {
    let input = await parseBody(c, signPartsSchema);

    let upload = await findPendingUpload(c);
    if (!upload || !isMultipartUpload(upload)) {
      return c.json({ error: 'upload_not_found' }, 404);
    }

    let partCount = uploadPartCount(upload);
    let numbers = [...new Set(input.numbers)];
    if (numbers.some(number => number > partCount)) {
      return c.json({ error: 'invalid_part_number' }, 400);
    }

    return c.json({ parts: await signUploadParts(upload, numbers) });
  })
  .post('/slates-hub/live-invocation/attachments/:referenceId/complete', async c => {
    let input = await parseBody(c, completeSchema);

    let upload = await findPendingUpload(c);
    if (!upload || !isMultipartUpload(upload)) {
      return c.json({ error: 'upload_not_found' }, 404);
    }
    if (input.receipts.length !== uploadPartCount(upload)) {
      return c.json({ error: 'upload_incomplete' }, 400);
    }

    let object = await completeUploadParts(upload, input.receipts).catch(() => null);
    if (!object) {
      return c.json({ error: 'upload_incomplete' }, 400);
    }

    await db.slateAttachmentUpload.updateMany({
      where: { oid: upload.oid, status: 'pending' },
      data: { status: 'uploaded', sizeBytes: object.size }
    });

    return c.json({ referenceId: upload.id });
  })
  .delete('/slates-hub/live-invocation/attachments/:referenceId', async c => {
    let upload = await findPendingUpload(c);
    if (!upload) {
      return c.json({ error: 'upload_not_found' }, 404);
    }

    let discarded = await db.slateAttachmentUpload.updateMany({
      where: { oid: upload.oid, status: 'pending' },
      data: { status: 'failed' }
    });
    if (discarded.count > 0) await discardUpload(upload);

    return c.body(null, 204);
  });

export let liveInvocationOnlyApp = createHono().route('/', liveInvocationApp);
