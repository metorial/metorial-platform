import { createHmac, timingSafeEqual } from 'node:crypto';
import { canonicalizeJsonJcs } from '@slates/proto';
import type { WebhookWireRequest } from './webhookWire';

export let DEFAULT_WEBHOOK_BODY_LIMIT_BYTES = 1024 * 1024;
export let GLOBAL_WEBHOOK_BODY_LIMIT_BYTES = 10 * 1024 * 1024;

export let WEBHOOK_CAPTURE_CONFORMANCE_CASES = [
  'unique_mixed_case_headers',
  'case_variant_duplicate_name',
  'ordered_duplicate_headers',
  'comma_containing_single_value',
  'repeated_query_parameters',
  'binary_body',
  'absent_body',
  'present_empty_body'
] as const;

export type WebhookCaptureConformanceReport = {
  version: 1;
  reportId: string;
  deploymentId: string;
  runtime: string;
  buildId: string;
  route: string;
  configDigest: string;
  rawHeaderSource: 'native';
  executedAt: string;
  expiresAt: string;
  cases: Record<(typeof WEBHOOK_CAPTURE_CONFORMANCE_CASES)[number], 'passed' | 'failed'>;
  attestation: {
    scheme: 'slates_hub_service_auth_hmac_sha256_v1';
    actorId: 'slates_hub_internal_service';
    signature: string;
  };
};
export type UnsignedWebhookCaptureConformanceReport = Omit<
  WebhookCaptureConformanceReport,
  'attestation'
>;

let conformanceAttestationPayload = (report: UnsignedWebhookCaptureConformanceReport) =>
  `metorial.webhook-capture-conformance\0v1\0${canonicalizeJsonJcs(report)}`;

export let attestWebhookCaptureConformanceReport = (
  report: UnsignedWebhookCaptureConformanceReport,
  serviceAuthSecret: string
): WebhookCaptureConformanceReport => ({
  ...report,
  attestation: {
    scheme: 'slates_hub_service_auth_hmac_sha256_v1',
    actorId: 'slates_hub_internal_service',
    signature: createHmac('sha256', serviceAuthSecret)
      .update(conformanceAttestationPayload(report))
      .digest('hex')
  }
});

export let validateWebhookCaptureConformanceReport = (
  value: string | undefined,
  deploymentId: string | undefined,
  options?: {
    buildId?: string;
    route?: string;
    configDigest?: string;
    serviceAuthSecret?: string;
    now?: Date;
    usedReportIds?: Set<string>;
  }
) => {
  if (
    !value ||
    !deploymentId ||
    !options?.serviceAuthSecret ||
    !options.buildId ||
    !options.route ||
    !options.configDigest
  )
    return false;
  try {
    let report = JSON.parse(value) as WebhookCaptureConformanceReport;
    if (
      report.version === 1 &&
      typeof report.reportId === 'string' &&
      report.reportId.length >= 16 &&
      report.deploymentId === deploymentId &&
      report.buildId === options.buildId &&
      report.route === options.route &&
      report.configDigest === options.configDigest &&
      // Hub currently has no authenticated gateway-envelope implementation. A deployment
      // report may only enable direct ingress when the runtime itself supplied raw tuples.
      report.rawHeaderSource === 'native' &&
      Number.isFinite(new Date(report.executedAt).getTime()) &&
      Number.isFinite(new Date(report.expiresAt).getTime()) &&
      new Date(report.executedAt) <= (options.now ?? new Date()) &&
      new Date(report.expiresAt) > (options.now ?? new Date()) &&
      report.attestation?.scheme === 'slates_hub_service_auth_hmac_sha256_v1' &&
      report.attestation.actorId === 'slates_hub_internal_service' &&
      WEBHOOK_CAPTURE_CONFORMANCE_CASES.every(name => report.cases?.[name] === 'passed')
    ) {
      let { attestation, ...unsigned } = report;
      let expected = createHmac('sha256', options.serviceAuthSecret)
        .update(conformanceAttestationPayload(unsigned))
        .digest();
      let received = Buffer.from(attestation.signature, 'hex');
      if (
        received.byteLength !== expected.byteLength ||
        !timingSafeEqual(received, expected)
      ) {
        return false;
      }
      if (options.usedReportIds?.has(report.reportId)) return false;
      options.usedReportIds?.add(report.reportId);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

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
      | 'security_header_ambiguous'
      | 'raw_header_capture_unavailable',
    message: string
  ) {
    super(message);
  }
}

export type TrustedRawHeaderRequest = Request & {
  rawHeaders?: readonly (readonly [string, string])[];
};

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
  request: TrustedRawHeaderRequest;
  maxBodyBytes?: number;
  trustedRawHeaders?: readonly (readonly [string, string])[];
  requireTrustedRawHeaders?: boolean;
  supportedDuplicateSecurityHeaders?: readonly string[];
}): Promise<WebhookWireRequest> => {
  let maxBodyBytes = resolveWebhookBodyLimit(d.maxBodyBytes);
  let suppliedHeaders = d.trustedRawHeaders ?? d.request.rawHeaders;
  if (d.requireTrustedRawHeaders && !suppliedHeaders) {
    throw new WebhookCaptureError(
      'raw_header_capture_unavailable',
      'Trusted raw header capture is unavailable'
    );
  }
  let rawHeaders = suppliedHeaders
    ? suppliedHeaders.map(([name, value]) => [name, value] as [string, string])
    : [...d.request.headers.entries()].map(
        ([name, value]) => [name, value] as [string, string]
      );
  validateRawHeaders(rawHeaders);
  assertUnambiguousSecurityHeaders(rawHeaders, d.supportedDuplicateSecurityHeaders);
  let contentLength = parseContentLength(rawHeaders);
  let body = await readBoundedBody(d.request, maxBodyBytes, contentLength);
  let method = d.request.method.toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(method)) {
    throw new WebhookCaptureError('wire_input_malformed', 'Webhook method is invalid');
  }
  return {
    url: d.request.url,
    method: method as WebhookWireRequest['method'],
    headers: rawHeaders,
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
