import { createError } from '@lowerdeck/error';

export let routeNotFoundError = createError({
  status: 404,
  code: 'route_not_found',
  message: 'The requested ingest route does not exist.'
});

export let methodNotAllowedError = createError({
  status: 405,
  code: 'method_not_allowed',
  message: 'The method is not allowed for this ingest route.'
});

export let unsupportedMediaTypeError = createError({
  status: 415,
  code: 'unsupported_media_type',
  message: 'The Content-Type is not supported by this ingest route.'
});

export let unsupportedContentEncodingError = createError({
  status: 415,
  code: 'unsupported_content_encoding',
  message: 'The Content-Encoding is not supported.',
  hint: 'Use gzip, zstd or no compression.'
});

export let payloadTooLargeError = createError({
  status: 413,
  code: 'payload_too_large',
  message: 'The request body is too large.',
  hint: 'The limit applies to the compressed and the decompressed body. Send smaller batches.'
});

export let unreadableBodyError = createError({
  status: 400,
  code: 'unreadable_body',
  message: 'The request body could not be read.',
  hint: 'Check that the body matches its Content-Encoding and is valid UTF-8 where text is expected.'
});

export {
  invalidBatchHeaderError,
  invalidClientError,
  invalidPayloadError
} from '@mtsrc/agent-tracking-module-ingest';
