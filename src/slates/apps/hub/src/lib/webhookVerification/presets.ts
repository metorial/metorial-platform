import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type {
  SafeWebhookRejectionCode,
  SlateWebhookPresetId,
  WebhookWireRequest,
  WebhookWireResponse
} from '@slates/proto';
import { verifyEd25519 } from './ed25519';
import type { PreparedWebhookItemAdapter } from './itemAdapters';
import { decodeStrictWebhookSignature } from './rawHmac';
import {
  decodeWebhookBody,
  getExactHeaderValues,
  parseWebhookJsonBody,
  type ResolvedWebhookSecret,
  type WebhookVerificationResult
} from './ruleSelection';
import { decodeWebhookSecret } from './staticToken';

let reject = (code: SafeWebhookRejectionCode): WebhookVerificationResult => ({
  status: 'rejected',
  code
});

let exactHeader = (
  request: WebhookWireRequest,
  name: string
):
  | { status: 'selected'; value: string }
  | { status: 'rejected'; code: SafeWebhookRejectionCode } => {
  let values = getExactHeaderValues(request, name);
  if (values.length === 0) return { status: 'rejected', code: 'credential_missing' };
  if (values.length !== 1) return { status: 'rejected', code: 'security_header_ambiguous' };
  return { status: 'selected', value: values[0]! };
};
let secretKeys = (secrets: readonly ResolvedWebhookSecret[]) =>
  secrets.map(decodeWebhookSecret).filter(key => key !== null) as Buffer[];

let safeEqual = (first: Uint8Array, second: Uint8Array) =>
  first.byteLength === second.byteLength &&
  timingSafeEqual(Buffer.from(first), Buffer.from(second));

let verifyHmac = (d: {
  algorithm?: 'sha256' | 'sha512';
  keys: readonly Uint8Array[];
  message: Uint8Array;
  signatures: readonly Uint8Array[];
  all?: boolean;
}) => {
  if (d.keys.length === 0 || d.signatures.length === 0) return false;
  let matches = d.signatures.map(signature =>
    d.keys.some(key =>
      safeEqual(
        createHmac(d.algorithm ?? 'sha256', key)
          .update(d.message)
          .digest(),
        signature
      )
    )
  );
  return d.all ? matches.every(Boolean) : matches.some(Boolean);
};

let bodyBytes = (request: WebhookWireRequest) => decodeWebhookBody(request) ?? Buffer.alloc(0);

let jsonRecord = (request: WebhookWireRequest) => {
  let value = parseWebhookJsonBody(request);
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
};

let strictUtf8Body = (request: WebhookWireRequest) => {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      bodyBytes(request)
    );
  } catch {
    return null;
  }
};

let slackSyncResponse = (request: WebhookWireRequest): WebhookWireResponse | null => {
  let contentTypes = getExactHeaderValues(request, 'content-type');
  if (contentTypes.length !== 1) return null;
  let mediaType = contentTypes[0]!.split(';', 1)[0]!.trim().toLowerCase();
  if (mediaType !== 'application/json') return null;
  let body = strictUtf8Body(request);
  if (body === null) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  let record = payload as Record<string, unknown>;
  if (record.type !== 'url_verification' || typeof record.challenge !== 'string') return null;
  return {
    status: 200,
    headers: [['content-type', 'text/plain; charset=utf-8']],
    body: {
      present: true,
      base64: Buffer.from(record.challenge, 'utf8').toString('base64')
    }
  };
};

let accepted = (
  presetFields: Readonly<Record<string, string>> = {}
): WebhookVerificationResult => ({
  status: 'accepted',
  selection: { scope: 'receiver_trigger' },
  presetFields
});

export let WEBHOOK_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;
export let WEBHOOK_SIGNATURE_MAX_FUTURE_SKEW_MS = 60 * 1000;

let strictTimestampMs = (
  value: string | number,
  unit: 'seconds' | 'milliseconds' | 'iso8601'
) => {
  if (unit === 'iso8601') {
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    ) {
      return null;
    }
    let parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  let text = typeof value === 'number' ? String(value) : value;
  if (!/^(?:0|[1-9]\d{0,15})$/.test(text)) return null;
  let parsed = Number(text);
  if (!Number.isSafeInteger(parsed)) return null;
  let milliseconds = unit === 'seconds' ? parsed * 1000 : parsed;
  return Number.isSafeInteger(milliseconds) ? milliseconds : null;
};

let enforceAuthenticatedFreshness = (d: {
  result: WebhookVerificationResult;
  value: string | number;
  unit: 'seconds' | 'milliseconds' | 'iso8601';
  nowMs: number;
}) => {
  // This helper must only be called after the signature result is accepted. It deliberately
  // never parses or trusts an attacker-selected timestamp before authentication succeeds.
  if (d.result.status !== 'accepted') return d.result;
  let timestampMs = strictTimestampMs(d.value, d.unit);
  if (timestampMs === null) return reject('credential_invalid');
  if (timestampMs > d.nowMs + WEBHOOK_SIGNATURE_MAX_FUTURE_SKEW_MS) {
    return reject('credential_future');
  }
  if (timestampMs < d.nowMs - WEBHOOK_SIGNATURE_MAX_AGE_MS) {
    return reject('credential_stale');
  }
  return d.result;
};

export type GraphWebhookAuthorityBinding = Readonly<{
  subscriptionId: string;
  clientState: string;
  resource?: string;
  registrationGeneration: number;
  specHash: string;
}>;

let verifySlack = (
  request: WebhookWireRequest,
  keys: readonly Uint8Array[],
  nowMs: number
) => {
  let timestamp = exactHeader(request, 'x-slack-request-timestamp');
  let signature = exactHeader(request, 'x-slack-signature');
  if (timestamp.status === 'rejected') return reject(timestamp.code);
  if (signature.status === 'rejected') return reject(signature.code);
  let decoded = signature.value.startsWith('v0=')
    ? decodeStrictWebhookSignature(signature.value.slice(3), 'hex')
    : null;
  if (!decoded) return reject('credential_invalid');
  let message = Buffer.concat([
    Buffer.from(`v0:${timestamp.value}:`, 'utf8'),
    bodyBytes(request)
  ]);
  let result = verifyHmac({ keys, message, signatures: [decoded] })
    ? accepted({ timestamp: timestamp.value })
    : reject('credential_invalid');
  return enforceAuthenticatedFreshness({
    result,
    value: timestamp.value,
    unit: 'seconds',
    nowMs
  });
};

let verifyStripe = (
  request: WebhookWireRequest,
  keys: readonly Uint8Array[],
  nowMs: number
) => {
  let header = exactHeader(request, 'stripe-signature');
  if (header.status === 'rejected') return reject(header.code);
  let fields = header.value.split(',').map(field => field.trim().split('=', 2));
  let timestamp = fields.find(([name]) => name === 't')?.[1];
  let signatures = fields
    .filter(([name]) => name === 'v1')
    .map(([, value]) => (value ? decodeStrictWebhookSignature(value, 'hex') : null));
  if (
    !timestamp ||
    signatures.length === 0 ||
    signatures.some(signature => signature === null)
  ) {
    return reject('credential_invalid');
  }
  let message = Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), bodyBytes(request)]);
  if (!verifyHmac({ keys, message, signatures: signatures as Uint8Array[] })) {
    return reject('credential_invalid');
  }
  let json = jsonRecord(request);
  return enforceAuthenticatedFreshness({
    result: accepted({
      timestamp,
      ...(typeof json?.id === 'string' ? { event_id: json.id } : {})
    }),
    value: timestamp,
    unit: 'seconds',
    nowMs
  });
};

let verifyZoom = (request: WebhookWireRequest, keys: readonly Uint8Array[], nowMs: number) => {
  let timestamp = exactHeader(request, 'x-zm-request-timestamp');
  let signature = exactHeader(request, 'x-zm-signature');
  if (timestamp.status === 'rejected') return reject(timestamp.code);
  if (signature.status === 'rejected') return reject(signature.code);
  let decoded = signature.value.startsWith('v0=')
    ? decodeStrictWebhookSignature(signature.value.slice(3), 'hex')
    : null;
  if (!decoded) return reject('credential_invalid');
  let message = Buffer.concat([
    Buffer.from(`v0:${timestamp.value}:`, 'utf8'),
    bodyBytes(request)
  ]);
  if (!verifyHmac({ keys, message, signatures: [decoded] })) {
    return reject('credential_invalid');
  }
  let json = jsonRecord(request);
  return enforceAuthenticatedFreshness({
    result: accepted({
      timestamp: timestamp.value,
      ...(typeof json?.event_ts === 'number' ? { event_id: String(json.event_ts) } : {})
    }),
    value: timestamp.value,
    unit: 'seconds',
    nowMs
  });
};

let decodeHubSpotCanonicalUri = (url: string) => {
  let replacements: Record<string, string> = {
    '3a': ':',
    '2f': '/',
    '3f': '?',
    '40': '@',
    '21': '!',
    '24': '$',
    '27': "'",
    '28': '(',
    '29': ')',
    '2a': '*',
    '2c': ',',
    '3b': ';'
  };
  return url.replace(
    /%([0-9a-fA-F]{2})/g,
    (encoded, hex: string) => replacements[hex.toLowerCase()] ?? encoded.toUpperCase()
  );
};

let verifyHubSpot = (
  request: WebhookWireRequest,
  keys: readonly Uint8Array[],
  nowMs: number
) => {
  let timestamp = exactHeader(request, 'x-hubspot-request-timestamp');
  let signature = exactHeader(request, 'x-hubspot-signature-v3');
  if (timestamp.status === 'rejected') return reject(timestamp.code);
  if (signature.status === 'rejected') return reject(signature.code);
  let decoded = decodeStrictWebhookSignature(signature.value, 'base64');
  if (!decoded) return reject('credential_invalid');
  let message = Buffer.concat([
    Buffer.from(request.method, 'utf8'),
    Buffer.from(decodeHubSpotCanonicalUri(request.url), 'utf8'),
    bodyBytes(request),
    Buffer.from(timestamp.value, 'utf8')
  ]);
  let result = verifyHmac({ keys, message, signatures: [decoded] })
    ? accepted({ timestamp: timestamp.value })
    : reject('credential_invalid');
  return enforceAuthenticatedFreshness({
    result,
    value: timestamp.value,
    unit: 'milliseconds',
    nowMs
  });
};

let verifyStaticHeaderPreset = (d: {
  request: WebhookWireRequest;
  keys: readonly Uint8Array[];
  headerName: string;
  eventId?: string;
}) => {
  let selected = exactHeader(d.request, d.headerName);
  if (selected.status === 'rejected') return reject(selected.code);
  let value = Buffer.from(selected.value, 'utf8');
  return d.keys.some(key => safeEqual(value, key))
    ? accepted(d.eventId ? { event_id: d.eventId } : {})
    : reject('credential_invalid');
};

let verifyZendesk = (
  request: WebhookWireRequest,
  keys: readonly Uint8Array[],
  nowMs: number
) => {
  let timestamp = exactHeader(request, 'x-zendesk-webhook-signature-timestamp');
  let signature = exactHeader(request, 'x-zendesk-webhook-signature');
  if (timestamp.status === 'rejected') return reject(timestamp.code);
  if (signature.status === 'rejected') return reject(signature.code);
  let decoded = decodeStrictWebhookSignature(signature.value, 'base64');
  if (!decoded) return reject('credential_invalid');
  let message = Buffer.concat([Buffer.from(timestamp.value), bodyBytes(request)]);
  let result = verifyHmac({ keys, message, signatures: [decoded] })
    ? accepted({ timestamp: timestamp.value })
    : reject('credential_invalid');
  return enforceAuthenticatedFreshness({
    result,
    value: timestamp.value,
    unit: 'iso8601',
    nowMs
  });
};

let verifyBodyHmac = (d: {
  request: WebhookWireRequest;
  keys: readonly Uint8Array[];
  header: string;
  encoding: 'hex' | 'base64';
  prefix?: string;
  eventId?: string;
}) => {
  let header = exactHeader(d.request, d.header);
  if (header.status === 'rejected') return reject(header.code);
  let encoded = header.value;
  if (d.prefix) {
    if (!encoded.startsWith(d.prefix)) return reject('credential_invalid');
    encoded = encoded.slice(d.prefix.length);
  }
  let signature = decodeStrictWebhookSignature(encoded, d.encoding);
  if (!signature) return reject('credential_invalid');
  return verifyHmac({ keys: d.keys, message: bodyBytes(d.request), signatures: [signature] })
    ? accepted(d.eventId ? { event_id: d.eventId } : {})
    : reject('credential_invalid');
};

let verifyGraph = (d: {
  request: WebhookWireRequest;
  itemAdapter?: PreparedWebhookItemAdapter;
  authorities?: readonly GraphWebhookAuthorityBinding[];
  registrationGeneration?: number;
  specHash?: string;
}): WebhookVerificationResult => {
  if (!d.itemAdapter || d.itemAdapter.id !== 'graph.body_value.v1') {
    return reject('item_adapter_invalid');
  }
  let json = jsonRecord(d.request);
  let values = json?.value;
  if (!Array.isArray(values) || values.length !== d.itemAdapter.candidates.length) {
    return reject('item_adapter_invalid');
  }
  let authorities = (d.authorities ?? []).filter(
    authority =>
      authority.registrationGeneration === d.registrationGeneration &&
      authority.specHash === d.specHash
  );
  if (authorities.length === 0) return reject('credential_missing');
  let acceptedCandidateIds = d.itemAdapter.candidates.flatMap(candidate => {
    let item = values[candidate.index];
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return [];
    let clientState = (item as Record<string, unknown>).clientState;
    let subscriptionId = (item as Record<string, unknown>).subscriptionId;
    let resource = (item as Record<string, unknown>).resource;
    if (typeof clientState !== 'string' || typeof subscriptionId !== 'string') return [];
    let matched = authorities.some(authority => {
      let suppliedState = Buffer.from(clientState, 'utf8');
      let expectedState = Buffer.from(authority.clientState, 'utf8');
      return (
        authority.subscriptionId === subscriptionId &&
        safeEqual(suppliedState, expectedState) &&
        (authority.resource === undefined || authority.resource === resource)
      );
    });
    return matched ? [candidate.candidateId] : [];
  });
  return acceptedCandidateIds.length > 0
    ? {
        status: 'accepted',
        selection: {
          scope: 'verified_items',
          itemAdapterId: 'graph.body_value.v1',
          acceptedCandidateIds
        }
      }
    : reject('credential_invalid');
};

let jiraEncode = (value: string) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );

let compareJiraCanonicalText = (first: string, second: string) =>
  first < second ? -1 : first > second ? 1 : 0;

export let computeJiraCanonicalQsh = (request: WebhookWireRequest) => {
  let url = new URL(request.url);
  let path = url.pathname
    .split('/')
    .map(segment => jiraEncode(decodeURIComponent(segment)))
    .join('/');
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  let grouped = new Map<string, string[]>();
  for (let [name, value] of url.searchParams.entries()) {
    if (name === 'jwt') continue;
    let values = grouped.get(name) ?? [];
    values.push(value);
    grouped.set(name, values);
  }
  let query = [...grouped.entries()]
    .map(
      ([name, values]) => [jiraEncode(name), values.map(jiraEncode).sort().join(',')] as const
    )
    .sort(([first], [second]) => compareJiraCanonicalText(first, second))
    .map(([name, values]) => `${name}=${values}`)
    .join('&');
  return createHash('sha256')
    .update(`${request.method}&${path}&${query}`, 'utf8')
    .digest('hex');
};

let verifyJira = (
  request: WebhookWireRequest,
  keys: readonly Uint8Array[],
  nowMs = Date.now()
) => {
  let authorization = exactHeader(request, 'authorization');
  if (authorization.status === 'rejected') return reject(authorization.code);
  if (!authorization.value.startsWith('JWT ')) return reject('credential_invalid');
  let token = authorization.value.slice(4);
  let parts = token.split('.');
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) {
    return reject('credential_invalid');
  }
  let signature = decodeStrictWebhookSignature(parts[2]!, 'base64url');
  if (
    !signature ||
    !verifyHmac({
      keys,
      message: Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8'),
      signatures: [signature]
    })
  ) {
    return reject('credential_invalid');
  }
  try {
    let header = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString('utf8'));
    let payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8'));
    if (
      header.alg !== 'HS256' ||
      header.typ !== 'JWT' ||
      typeof payload !== 'object' ||
      payload === null ||
      typeof payload.iss !== 'string' ||
      payload.iss.length === 0 ||
      typeof payload.iat !== 'number' ||
      !Number.isSafeInteger(payload.iat) ||
      typeof payload.exp !== 'number' ||
      !Number.isSafeInteger(payload.exp) ||
      payload.exp < payload.iat ||
      typeof payload.qsh !== 'string' ||
      payload.qsh !== computeJiraCanonicalQsh(request)
    ) {
      return reject('credential_invalid');
    }
    let nowSeconds = Math.floor(nowMs / 1000);
    if (payload.iat > nowSeconds + 60) return reject('credential_future');
    if (payload.iat < nowSeconds - 300) return reject('credential_stale');
    if (payload.nbf !== undefined) {
      if (!Number.isSafeInteger(payload.nbf) || payload.nbf > nowSeconds + 60) {
        return reject('credential_future');
      }
    }
    if (payload.exp < nowSeconds) return reject('credential_stale');
    return accepted({
      issued_at: String(payload.iat),
      ...(typeof payload.webhookId === 'string' ? { webhook_id: payload.webhookId } : {})
    });
  } catch {
    return reject('credential_invalid');
  }
};

export let verifyWebhookPreset = (d: {
  preset: SlateWebhookPresetId;
  request: WebhookWireRequest;
  secrets: readonly ResolvedWebhookSecret[];
  itemAdapter?: PreparedWebhookItemAdapter;
  graphAuthorities?: readonly GraphWebhookAuthorityBinding[];
  registrationGeneration?: number;
  specHash?: string;
  nowMs?: number;
}): WebhookVerificationResult => {
  let keys = secretKeys(d.secrets);
  let nowMs = d.nowMs ?? Date.now();
  if (d.preset === 'slack.v0') return verifySlack(d.request, keys, nowMs);
  if (d.preset === 'stripe.v1') return verifyStripe(d.request, keys, nowMs);
  if (d.preset === 'zoom.v0') return verifyZoom(d.request, keys, nowMs);
  if (d.preset === 'hubspot.v3') return verifyHubSpot(d.request, keys, nowMs);
  if (d.preset === 'gitlab.standard.v1') {
    let eventId = exactHeader(d.request, 'x-gitlab-event-uuid');
    return verifyStaticHeaderPreset({
      request: d.request,
      keys,
      headerName: 'x-gitlab-token',
      eventId: eventId.status === 'selected' ? eventId.value : undefined
    });
  }
  if (d.preset === 'zendesk.v1') return verifyZendesk(d.request, keys, nowMs);
  if (d.preset === 'typeform.v1') {
    let json = jsonRecord(d.request);
    return verifyBodyHmac({
      request: d.request,
      keys,
      header: 'typeform-signature',
      encoding: 'base64',
      prefix: 'sha256=',
      eventId: typeof json?.event_id === 'string' ? json.event_id : undefined
    });
  }
  if (d.preset === 'linear.v1') {
    let json = jsonRecord(d.request);
    let result = verifyBodyHmac({
      request: d.request,
      keys,
      header: 'linear-signature',
      encoding: 'hex',
      eventId: typeof json?.webhookId === 'string' ? json.webhookId : undefined
    });
    if (result.status !== 'accepted') return result;
    if (
      typeof json?.webhookTimestamp !== 'number' ||
      !Number.isSafeInteger(json.webhookTimestamp)
    ) {
      return reject('credential_invalid');
    }
    return enforceAuthenticatedFreshness({
      result: {
        ...result,
        presetFields: { ...result.presetFields, timestamp: String(json.webhookTimestamp) }
      },
      value: json.webhookTimestamp,
      unit: 'milliseconds',
      nowMs
    });
  }
  if (d.preset === 'graph.change_notification.v1') {
    return verifyGraph({
      request: d.request,
      itemAdapter: d.itemAdapter,
      authorities: d.graphAuthorities,
      registrationGeneration: d.registrationGeneration,
      specHash: d.specHash
    });
  }
  if (d.preset === 'jira.oauth_dynamic_webhook.v1') return verifyJira(d.request, keys);
  if (d.preset === 'discord.interactions.v1') {
    let secret = d.secrets[0];
    if (!secret) return reject('credential_missing');
    let result = verifyEd25519({
      request: d.request,
      secrets: d.secrets,
      verifier: {
        type: 'ed25519',
        publicKeyName: secret.name,
        publicKeyEncoding: secret.encoding === 'utf8' ? 'hex' : secret.encoding,
        signature: {
          headerName: 'x-signature-ed25519',
          encoding: 'hex',
          duplicateHeaderPolicy: 'reject',
          multipleSignaturePolicy: 'reject'
        },
        message: [
          { source: 'header', headerName: 'x-signature-timestamp' },
          { source: 'body' }
        ]
      }
    });
    if (result.status === 'accepted') {
      let timestamp = exactHeader(d.request, 'x-signature-timestamp');
      let json = jsonRecord(d.request);
      let acceptedResult = {
        ...result,
        presetFields: {
          ...(timestamp.status === 'selected' ? { timestamp: timestamp.value } : {}),
          ...(typeof json?.id === 'string' ? { interaction_id: json.id } : {})
        }
      };
      if (timestamp.status !== 'selected') return reject('credential_missing');
      return enforceAuthenticatedFreshness({
        result: acceptedResult,
        value: timestamp.value,
        unit: 'seconds',
        nowMs
      });
    }
    return result;
  }
  return reject('routing_projection_stale');
};

export let renderPresetSyncResponse = (d: {
  preset: SlateWebhookPresetId;
  request: WebhookWireRequest;
  secrets: readonly ResolvedWebhookSecret[];
}): WebhookWireResponse | null => {
  if (d.preset === 'slack.v0') {
    return slackSyncResponse(d.request);
  }
  if (d.preset === 'discord.interactions.v1') {
    let json = jsonRecord(d.request);
    if (json?.type === 1) {
      return {
        status: 200,
        headers: [['content-type', 'application/json']],
        body: { present: true, base64: Buffer.from('{"type":1}').toString('base64') }
      };
    }
  }
  if (d.preset === 'zoom.v0') {
    let json = jsonRecord(d.request);
    let payload =
      typeof json?.payload === 'object' && json.payload !== null
        ? (json.payload as Record<string, unknown>)
        : null;
    let plainToken = payload?.plainToken;
    let key = secretKeys(d.secrets)[0];
    if (json?.event === 'endpoint.url_validation' && typeof plainToken === 'string' && key) {
      let encryptedToken = createHmac('sha256', key).update(plainToken).digest('hex');
      return {
        status: 200,
        headers: [['content-type', 'application/json']],
        body: {
          present: true,
          base64: Buffer.from(JSON.stringify({ plainToken, encryptedToken })).toString(
            'base64'
          )
        }
      };
    }
  }
  if (d.preset === 'graph.change_notification.v1') {
    let values = new URL(d.request.url).searchParams.getAll('validationToken');
    if (values.length === 1) {
      return {
        status: 200,
        headers: [['content-type', 'text/plain; charset=utf-8']],
        body: { present: true, base64: Buffer.from(values[0]!, 'utf8').toString('base64') }
      };
    }
  }
  return null;
};
