import type { WebhookWireRequest } from './webhookWire';

export let DEFAULT_WEBHOOK_BODY_LIMIT_BYTES = 1024 * 1024;
export let GLOBAL_WEBHOOK_BODY_LIMIT_BYTES = 10 * 1024 * 1024;

let SECURITY_HEADER_NAMES = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'x-auth-token',
  'x-hub-signature',
  'x-hub-signature-256',
  'x-signature',
  'stripe-signature',
  'svix-signature',
  'webhook-signature'
]);

let isSensitiveHeader = (name: string) =>
  SECURITY_HEADER_NAMES.has(name.toLowerCase()) ||
  /(?:token|secret|signature|authorization|api[-_]?key)/i.test(name);

export class WebhookCaptureError extends Error {
  constructor(
    readonly code:
      | 'wire_input_malformed'
      | 'wire_input_oversized'
      | 'security_header_ambiguous',
    message: string
  ) {
    super(message);
  }
}

export let resolveWebhookBodyLimit = (requested?: number) => {
  let value = requested ?? DEFAULT_WEBHOOK_BODY_LIMIT_BYTES;
  if (!Number.isSafeInteger(value) || value < 0 || value > GLOBAL_WEBHOOK_BODY_LIMIT_BYTES) {
    throw new WebhookCaptureError('wire_input_malformed', 'Webhook body limit is invalid');
  }
  return value;
};

let parseContentLength = (headers: readonly (readonly [string, string])[]) => {
  let values = headers
    .filter(([name]) => name.toLowerCase() === 'content-length')
    .map(([, value]) => value);
  if (values.length > 1) {
    throw new WebhookCaptureError('wire_input_malformed', 'Duplicate Content-Length');
  }
  if (values.length === 0) return null;
  if (!/^(0|[1-9][0-9]*)$/.test(values[0]!)) {
    throw new WebhookCaptureError('wire_input_malformed', 'Malformed Content-Length');
  }
  let value = Number(values[0]);
  if (!Number.isSafeInteger(value)) {
    throw new WebhookCaptureError('wire_input_malformed', 'Malformed Content-Length');
  }
  return value;
};

export let assertUnambiguousSecurityHeaders = (
  headers: readonly (readonly [string, string])[],
  supportedDuplicateNames: readonly string[] = []
) => {
  let allowed = new Set(supportedDuplicateNames.map(name => name.toLowerCase()));
  let counts = new Map<string, number>();
  for (let [name] of headers) {
    let normalized = name.toLowerCase();
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  for (let [name, count] of counts) {
    if (count > 1 && isSensitiveHeader(name) && !allowed.has(name)) {
      throw new WebhookCaptureError(
        'security_header_ambiguous',
        `Ambiguous security header: ${name}`
      );
    }
  }
};

let readBoundedBody = async (
  request: Request,
  limit: number,
  contentLength: number | null
) => {
  if (contentLength !== null && contentLength > limit) {
    throw new WebhookCaptureError('wire_input_oversized', 'Webhook body is too large');
  }
  if (request.body === null) {
    if (contentLength !== null && contentLength !== 0) {
      throw new WebhookCaptureError(
        'wire_input_malformed',
        'Content-Length does not match body'
      );
    }
    return { present: false } as const;
  }

  let chunks: Uint8Array[] = [];
  let total = 0;
  let reader = request.body.getReader();
  try {
    while (true) {
      let result = await reader.read();
      if (result.done) break;
      let chunk = result.value;
      if (chunk.byteLength > limit - total) {
        await reader.cancel('webhook body limit exceeded');
        throw new WebhookCaptureError('wire_input_oversized', 'Webhook body is too large');
      }
      total += chunk.byteLength;
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  if (contentLength !== null && contentLength !== total) {
    throw new WebhookCaptureError(
      'wire_input_malformed',
      'Content-Length does not match body'
    );
  }

  let body = new Uint8Array(total);
  let offset = 0;
  for (let chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { present: true, base64: Buffer.from(body).toString('base64') } as const;
};

let validateRawHeaders = (headers: readonly (readonly [string, string])[]) => {
  if (
    headers.some(
      header =>
        !Array.isArray(header) ||
        header.length !== 2 ||
        typeof header[0] !== 'string' ||
        typeof header[1] !== 'string' ||
        !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(header[0]) ||
        /[\r\n]/.test(header[0]) ||
        /[\r\n]/.test(header[1])
    )
  ) {
    throw new WebhookCaptureError('wire_input_malformed', 'Raw headers are malformed');
  }
};

export let captureWebhookWireRequest = async (d: {
  request: Request;
  maxBodyBytes?: number;
  supportedDuplicateSecurityHeaders?: readonly string[];
}): Promise<WebhookWireRequest> => {
  let maxBodyBytes = resolveWebhookBodyLimit(d.maxBodyBytes);
  let headers = [...d.request.headers.entries()].map(
    ([name, value]) => [name, value] as [string, string]
  );
  validateRawHeaders(headers);
  assertUnambiguousSecurityHeaders(headers, d.supportedDuplicateSecurityHeaders);
  let contentLength = parseContentLength(headers);
  let body = await readBoundedBody(d.request, maxBodyBytes, contentLength);
  let method = d.request.method.toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(method)) {
    throw new WebhookCaptureError('wire_input_malformed', 'Webhook method is invalid');
  }
  return {
    url: d.request.url,
    method: method as WebhookWireRequest['method'],
    headers,
    body
  };
};

export let getHeaderValues = (request: WebhookWireRequest, name: string) =>
  request.headers
    .filter(([candidate]) => candidate.toLowerCase() === name.toLowerCase())
    .map(([, value]) => value);

export let redactWebhookUrl = (value: string, pathSecret?: string) => {
  let url = new URL(value);
  if (pathSecret) {
    url.pathname = url.pathname
      .split('/')
      .map(part => {
        try {
          return decodeURIComponent(part) === pathSecret ? '[REDACTED]' : part;
        } catch {
          return part;
        }
      })
      .join('/');
  }
  let keys = [...new Set([...url.searchParams.keys()])];
  for (let key of keys) {
    let count = url.searchParams.getAll(key).length;
    url.searchParams.delete(key);
    for (let index = 0; index < count; index += 1) url.searchParams.append(key, '[REDACTED]');
  }
  return url.toString();
};

export let redactWebhookHeaders = (headers: readonly (readonly [string, string])[]) =>
  headers.map(([name]) => [name, '[REDACTED]']);

let pathSecretFromWebhookUrl = (value: string) => {
  try {
    let parts = new URL(value).pathname.split('/').filter(Boolean);
    let routeIndex = parts.findIndex(
      part => part === 'webhook' || part === 'receiver-webhook'
    );
    return routeIndex >= 0 && parts.length > routeIndex + 2
      ? decodeURIComponent(parts[routeIndex + 2]!)
      : undefined;
  } catch {
    return undefined;
  }
};

export let redactWebhookPayloadMetadata = (input: Record<string, any>) => {
  let url = typeof input.url === 'string' ? input.url : undefined;
  let headers =
    input.headers && typeof input.headers === 'object' && !Array.isArray(input.headers)
      ? Object.fromEntries(
          redactWebhookHeaders(
            Object.entries(input.headers).flatMap(([name, value]) =>
              typeof value === 'string' ? ([[name, value]] as [string, string][]) : []
            )
          )
        )
      : input.headers;
  return {
    ...input,
    ...(url ? { url: redactWebhookUrl(url, pathSecretFromWebhookUrl(url)) } : {}),
    ...(headers ? { headers } : {})
  };
};

export let extractExplicitPathSecret = (d: { requestUrl: string; routePrefix: string }) => {
  let pathname = new URL(d.requestUrl).pathname;
  let prefix = d.routePrefix.endsWith('/') ? d.routePrefix : `${d.routePrefix}/`;
  if (!pathname.startsWith(prefix)) return null;
  let raw = pathname.slice(prefix.length);
  if (!raw || raw.includes('/')) return null;
  try {
    let decoded = decodeURIComponent(raw);
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
};
