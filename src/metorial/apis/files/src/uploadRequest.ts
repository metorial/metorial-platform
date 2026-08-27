import { badRequestError, ServiceError, validationError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { purposeSlugs } from '@metorial/module-file';

export let uploadModes = ['direct', 'get_upload_url', 'complete'] as const;

export type UploadMode = (typeof uploadModes)[number];

let purposeValidator = v.enumOf(purposeSlugs as unknown as [string, ...string[]], {
  description: 'The purpose the file is uploaded for'
});

export let getUploadUrlRequestSchema = v.object({
  mode: v.literal('get_upload_url'),

  purpose: purposeValidator,
  file_name: v.string(),
  file_size: v.any({ description: 'The size of the file in bytes' }),
  file_type: v.optional(v.string()),
  title: v.optional(v.string()),

  organization_id: v.optional(v.string()),
  instance_id: v.optional(v.string()),

  store_id: v.optional(v.string()),
  path: v.optional(v.string()),
  store_replace: v.optional(v.boolean())
});

export let completeRequestSchema = v.object({
  mode: v.literal('complete'),

  file_upload_id: v.string(),

  organization_id: v.optional(v.string()),
  instance_id: v.optional(v.string())
});

export let parseUploadMode = (value: unknown): UploadMode => {
  if (value === null || value === undefined || value === '') return 'direct';

  if (typeof value !== 'string' || !uploadModes.includes(value as UploadMode)) {
    throw new ServiceError(
      badRequestError({
        message: `mode must be one of ${uploadModes.join(', ')}`
      })
    );
  }

  return value as UploadMode;
};

export let parseUploadRequest = (body: unknown) => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ServiceError(
      badRequestError({
        message: 'Expected a JSON object body'
      })
    );
  }

  let mode = parseUploadMode((body as Record<string, unknown>).mode);

  if (mode === 'direct') {
    throw new ServiceError(
      badRequestError({
        message: 'Direct uploads must be sent as multipart/form-data'
      })
    );
  }

  let schema = mode === 'get_upload_url' ? getUploadUrlRequestSchema : completeRequestSchema;
  let result = schema.validate(body);

  if (!result.success) {
    throw new ServiceError(
      validationError({
        entity: 'body',
        errors: result.errors
      })
    );
  }

  if (
    result.value.mode === 'get_upload_url' &&
    !!result.value.store_id !== !!result.value.path
  ) {
    throw new ServiceError(
      badRequestError({
        message: 'store_id and path must be provided together'
      })
    );
  }

  if (
    result.value.mode === 'get_upload_url' &&
    result.value.store_replace &&
    !result.value.store_id
  ) {
    throw new ServiceError(
      badRequestError({
        message: 'store_replace requires store_id and path'
      })
    );
  }

  return result.value;
};
