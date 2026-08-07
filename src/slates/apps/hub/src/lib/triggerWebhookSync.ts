import type { TriggerWebhookRequestPayload } from './triggerWebhook';
import type {
  WebhookHttpResponse,
  WebhookRequestMatcher
} from '../services/slateTriggerReceiverShared';

let MAX_MATCHER_BODY_BYTES = 4 * 1024 * 1024;

let HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'set-cookie'
]);

let getHeader = (headers: Record<string, string>, expectedName: string) => {
  let normalizedName = expectedName.toLowerCase();
  return Object.entries(headers).find(([name]) => name.toLowerCase() === normalizedName)?.[1];
};

let getPathValue = (value: unknown, path: string) => {
  let current = value;
  let found = true;

  for (let segment of path.split('.').filter(Boolean)) {
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      let index = Number(segment);
      if (!(index in current)) {
        found = false;
        break;
      }
      current = current[index];
      continue;
    }

    if (
      current === null ||
      typeof current !== 'object' ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      found = false;
      break;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return { found, value: current };
};

let getMatcherBody = (request: TriggerWebhookRequestPayload) => {
  if (!request.body) return undefined;

  let body = Buffer.from(request.body.content, 'base64');
  if (body.byteLength > MAX_MATCHER_BODY_BYTES) return undefined;

  return body.toString('utf8');
};

let parseMatcherJsonBody = (request: TriggerWebhookRequestPayload) => {
  let body = getMatcherBody(request);
  if (body === undefined) return undefined;

  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
};

let parseMatcherFormBody = (request: TriggerWebhookRequestPayload) => {
  let contentType = getHeader(request.headers, 'content-type')
    ?.split(';', 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== 'application/x-www-form-urlencoded') return undefined;

  let body = getMatcherBody(request);
  return body === undefined ? undefined : new URLSearchParams(body);
};

export let webhookRequestMatches = (
  request: TriggerWebhookRequestPayload,
  matcher: WebhookRequestMatcher
) => {
  if (matcher.method && request.method.toUpperCase() !== matcher.method.toUpperCase()) {
    return false;
  }

  if (matcher.hasQueryParam && !new URL(request.url).searchParams.has(matcher.hasQueryParam)) {
    return false;
  }

  if (matcher.hasHeader) {
    let expectedHeader = matcher.hasHeader.toLowerCase();
    if (
      !Object.keys(request.headers).some(header => header.toLowerCase() === expectedHeader)
    ) {
      return false;
    }
  }

  if (matcher.jsonBodyField) {
    let body = parseMatcherJsonBody(request);
    let resolved = getPathValue(body, matcher.jsonBodyField.path);
    if (!resolved.found) return false;
    if (
      matcher.jsonBodyField.equals !== undefined &&
      String(resolved.value) !== matcher.jsonBodyField.equals
    ) {
      return false;
    }
  }

  if (matcher.formBodyField) {
    let body = parseMatcherFormBody(request);
    if (!body?.has(matcher.formBodyField.path)) return false;
    if (
      matcher.formBodyField.equals !== undefined &&
      body.get(matcher.formBodyField.path) !== matcher.formBodyField.equals
    ) {
      return false;
    }
  }

  return true;
};

export let createSanitizedWebhookResponse = (response: WebhookHttpResponse) => {
  // Fetch Response cannot represent an informational status as a final response. A provider
  // returning schema-valid 1xx therefore becomes an empty 502 instead of throwing after the
  // webhook has already been processed and risking a transport-level retry.
  let informationalStatus = response.status >= 100 && response.status < 200;
  let status = informationalStatus ? 502 : response.status;
  let bodyAllowed = ![204, 205, 304].includes(status) && !informationalStatus;
  let body =
    bodyAllowed && response.body
      ? Buffer.from(response.body.content, 'base64')
      : Buffer.alloc(0);
  let headers = new Headers();
  let connectionHeaders = new Set(
    (getHeader(response.headers, 'connection') ?? '')
      .split(',')
      .map(name => name.trim().toLowerCase())
      .filter(Boolean)
  );

  for (let [name, value] of Object.entries(response.headers)) {
    let normalizedName = name.toLowerCase();
    if (
      !HOP_BY_HOP_RESPONSE_HEADERS.has(normalizedName) &&
      !connectionHeaders.has(normalizedName)
    ) {
      headers.set(name, String(value));
    }
  }

  headers.set('content-length', String(body.byteLength));

  return new Response(bodyAllowed ? body : null, {
    status,
    headers
  });
};
