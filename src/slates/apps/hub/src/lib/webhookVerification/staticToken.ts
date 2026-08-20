import { timingSafeEqual } from 'node:crypto';
import type { SlateWebhookVerifier, WebhookWireRequest } from '@slates/proto';
import {
  getExactHeaderValues,
  parseWebhookJsonBody,
  resolveJsonPointer,
  type ResolvedWebhookSecret,
  type WebhookVerificationResult
} from './ruleSelection';

type StaticTokenVerifier = Extract<SlateWebhookVerifier, { type: 'static_token' }>;

let constantTimeEqual = (first: Uint8Array, second: Uint8Array) =>
  first.byteLength === second.byteLength &&
  timingSafeEqual(Buffer.from(first), Buffer.from(second));

export let decodeWebhookSecret = (secret: Pick<ResolvedWebhookSecret, 'value' | 'encoding'>) => {
  if (secret.encoding === 'utf8') return Buffer.from(secret.value, 'utf8');
  if (secret.encoding === 'hex') {
    if (!/^(?:[0-9a-fA-F]{2})+$/.test(secret.value)) return null;
    return Buffer.from(secret.value, 'hex');
  }
  if (secret.encoding === 'base64') {
    if (
      secret.value.length % 4 !== 0 ||
      Buffer.from(secret.value, 'base64').toString('base64') !== secret.value
    ) {
      return null;
    }
    return Buffer.from(secret.value, 'base64');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(secret.value)) return null;
  let decoded = Buffer.from(secret.value, 'base64url');
  return decoded.toString('base64url') === secret.value ? decoded : null;
};

export let extractStaticToken = (
  request: WebhookWireRequest,
  selector: StaticTokenVerifier['selector']
): { status: 'selected'; value: string } | { status: 'rejected'; ambiguous: boolean } => {
  if (selector.source === 'header') {
    let values = getExactHeaderValues(request, selector.headerName);
    return values.length === 1
      ? { status: 'selected', value: values[0]! }
      : { status: 'rejected', ambiguous: values.length > 1 };
  }
  if (selector.source === 'query') {
    let values: string[];
    try {
      values = new URL(request.url).searchParams.getAll(selector.queryParam);
    } catch {
      return { status: 'rejected', ambiguous: false };
    }
    return values.length === 1
      ? { status: 'selected', value: values[0]! }
      : { status: 'rejected', ambiguous: values.length > 1 };
  }
  try {
    let value = resolveJsonPointer(parseWebhookJsonBody(request), selector.pointer);
    return typeof value === 'string'
      ? { status: 'selected', value }
      : { status: 'rejected', ambiguous: false };
  } catch {
    return { status: 'rejected', ambiguous: false };
  }
};

export let verifyStaticToken = (d: {
  request: WebhookWireRequest;
  verifier: StaticTokenVerifier;
  secrets: readonly ResolvedWebhookSecret[];
}): WebhookVerificationResult => {
  let selected = extractStaticToken(d.request, d.verifier.selector);
  if (selected.status === 'rejected') {
    return {
      status: 'rejected',
      code: selected.ambiguous ? 'security_header_ambiguous' : 'credential_missing'
    };
  }
  let selectedBytes = Buffer.from(selected.value, 'utf8');
  let candidates = d.secrets.filter(secret => secret.name === d.verifier.secretName);
  if (candidates.length === 0) return { status: 'rejected', code: 'credential_missing' };
  return candidates.some(secret => {
    let decoded = decodeWebhookSecret(secret);
    return decoded !== null && constantTimeEqual(selectedBytes, decoded);
  })
    ? { status: 'accepted', selection: { scope: 'receiver_trigger' } }
    : { status: 'rejected', code: 'credential_invalid' };
};
