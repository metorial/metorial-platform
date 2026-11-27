import { ServiceError, validationError } from '@lowerdeck/error';
import { type Context, createHono } from '@lowerdeck/hono';
import { v, type ValidationType } from '@lowerdeck/validation';
import {
  MAX_ATTACHMENTS_PER_INVOCATION,
  maxTotalAttachmentBytesPerInvocation,
  maxAttachmentSizeBytes
} from '@mtsrc/slates-hub-module-invocations/attachmentLimits';
import {
  type LiveInvocationTokenPayload,
  releaseAttachmentBudget,
  reserveAttachmentBudget,
  resolveLiveInvocationToken
} from '@mtsrc/slates-hub-module-invocations/liveToken';
import {
  completeUploadParts,
  isMultipartUpload,
  MAX_PARTS_PER_SIGNING,
  MAX_UPLOAD_PARTS,
  signUploadParts,
  uploadPartCount
} from '@mtsrc/slates-hub-module-invocations/liveUpload';
import {
  discardUpload,
  findInvocationWithRetry,
  findPendingUpload,
  recordUploadedSize,
  registerUpload
} from '@mtsrc/slates-hub-module-invocations/liveAttachmentUpload';

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

let parseBody = async <T>(c: Context, schema: ValidationType<T>) => {
  let parsed = schema.validate(await c.req.json().catch(() => null));
  if (!parsed.success) {
    throw new ServiceError(validationError({ entity: 'attachment', errors: parsed.errors }));
  }

  return parsed.value;
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

    let upload = await findPendingUpload({
      referenceId: c.req.param('referenceId'),
      invocationId: c.get('liveInvocationPayload').invocationId
    });
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

    let upload = await findPendingUpload({
      referenceId: c.req.param('referenceId'),
      invocationId: c.get('liveInvocationPayload').invocationId
    });
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

    await recordUploadedSize({ uploadOid: upload.oid, size: object.size });

    return c.json({ referenceId: upload.id });
  })
  .delete('/slates-hub/live-invocation/attachments/:referenceId', async c => {
    let upload = await findPendingUpload({
      referenceId: c.req.param('referenceId'),
      invocationId: c.get('liveInvocationPayload').invocationId
    });
    if (!upload) {
      return c.json({ error: 'upload_not_found' }, 404);
    }

    await discardUpload(upload);

    return c.body(null, 204);
  });

export let liveInvocationOnlyApp = createHono().route('/', liveInvocationApp);
