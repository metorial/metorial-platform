export let LIST_PAYLOAD_LIMIT_BYTES = 16 * 1024;
export let GET_PAYLOAD_LIMIT_BYTES = 1024 * 1024;

export let getJsonSizeBytes = (value: unknown) => {
  if (value === null || value === undefined) return 0;

  return Buffer.byteLength(JSON.stringify(value) ?? '');
};

export let presentOmittedBody = (size: number | null) => ({
  object: 'session.message.omitted_body' as const,
  reason: 'body_too_large' as const,
  size
});
