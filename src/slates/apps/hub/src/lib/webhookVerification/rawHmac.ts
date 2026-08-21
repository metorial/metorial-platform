import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  SlateWebhookMessagePart,
  SlateWebhookSignatureSource,
  SlateWebhookVerifier,
  WebhookWireRequest
} from '@slates/proto';
import { decodeWebhookSecret } from './staticToken';
import {
  decodeWebhookBody,
  getExactHeaderValues,
  type ResolvedWebhookSecret,
  type WebhookVerificationResult
} from './ruleSelection';

type RawHmacVerifier = Extract<SlateWebhookVerifier, { type: 'raw_hmac' }>;

export let decodeStrictWebhookSignature = (
  encoded: string,
  encoding: SlateWebhookSignatureSource['encoding']
) => {
  if (encoding === 'hex') {
    if (!/^(?:[0-9a-fA-F]{2})+$/.test(encoded)) return null;
    return Buffer.from(encoded, 'hex');
  }
  if (encoding === 'base64') {
    if (
      encoded.length === 0 ||
      encoded.length % 4 !== 0 ||
      Buffer.from(encoded, 'base64').toString('base64') !== encoded
    ) {
      return null;
    }
    return Buffer.from(encoded, 'base64');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  let decoded = Buffer.from(encoded, 'base64url');
  return decoded.toString('base64url') === encoded ? decoded : null;
};
let oneExactValue = (values: string[]) => {
  if (values.length !== 1) throw new Error('ambiguous');
  return values[0]!;
};

export let buildWebhookSignatureMessage = (d: {
  request: WebhookWireRequest;
  parts: readonly SlateWebhookMessagePart[];
}) => {
  let chunks = d.parts.map(part => {
    if (part.source === 'body') return decodeWebhookBody(d.request) ?? Buffer.alloc(0);
    if (part.source === 'method') return Buffer.from(d.request.method, 'utf8');
    if (part.source === 'url') return Buffer.from(d.request.url, 'utf8');
    if (part.source === 'literal') return Buffer.from(part.value, 'utf8');
    if (part.source === 'header') {
      return Buffer.from(
        oneExactValue(getExactHeaderValues(d.request, part.headerName)),
        'utf8'
      );
    }
    let values = new URL(d.request.url).searchParams.getAll(part.queryParam);
    return Buffer.from(oneExactValue(values), 'utf8');
  });
  return Buffer.concat(chunks);
};

export let collectWebhookSignatureCandidates = (d: {
  request: WebhookWireRequest;
  source: SlateWebhookSignatureSource;
}):
  | { status: 'selected'; signatures: Uint8Array[] }
  | { status: 'rejected'; code: 'credential_missing' | 'credential_invalid' | 'security_header_ambiguous' } => {
  let values = getExactHeaderValues(d.request, d.source.headerName);
  if (values.length === 0) return { status: 'rejected', code: 'credential_missing' };
  if (values.length > 1) {
    if (d.source.duplicateHeaderPolicy === 'reject') {
      return { status: 'rejected', code: 'security_header_ambiguous' };
    }
    if (
      d.source.duplicateHeaderPolicy === 'allow_identical' &&
      values.some(value => value !== values[0])
    ) {
      return { status: 'rejected', code: 'security_header_ambiguous' };
    }
    if (d.source.duplicateHeaderPolicy === 'allow_identical') values = [values[0]!];
  }
  let encodedCandidates = values.flatMap(value =>
    d.source.multipleSignaturePolicy === 'reject'
      ? [value]
      : value.split(',').map(candidate => candidate.trim())
  );
  if (
    encodedCandidates.length === 0 ||
    (d.source.multipleSignaturePolicy === 'reject' && encodedCandidates.length !== 1)
  ) {
    return { status: 'rejected', code: 'credential_invalid' };
  }
  let decoded = encodedCandidates.map(candidate => {
    if (d.source.prefix !== undefined) {
      if (!candidate.startsWith(d.source.prefix)) return null;
      candidate = candidate.slice(d.source.prefix.length);
    }
    return decodeStrictWebhookSignature(candidate, d.source.encoding);
  });
  return decoded.some(signature => signature === null)
    ? { status: 'rejected', code: 'credential_invalid' }
    : { status: 'selected', signatures: decoded as Uint8Array[] };
};

export let verifyRawHmac = (d: {
  request: WebhookWireRequest;
  verifier: RawHmacVerifier;
  secrets: readonly ResolvedWebhookSecret[];
}): WebhookVerificationResult => {
  let selected = collectWebhookSignatureCandidates({
    request: d.request,
    source: d.verifier.signature
  });
  if (selected.status === 'rejected') return selected;
  let message: Uint8Array;
  try {
    message = buildWebhookSignatureMessage({ request: d.request, parts: d.verifier.message });
  } catch {
    return { status: 'rejected', code: 'security_header_ambiguous' };
  }
  let secrets = d.secrets
    .filter(secret => secret.name === d.verifier.secretName)
    .map(decodeWebhookSecret)
    .filter(secret => secret !== null) as Buffer[];
  if (secrets.length === 0) return { status: 'rejected', code: 'credential_missing' };
  let matches = selected.signatures.map(signature =>
    secrets.some(secret => {
      let expected = createHmac(d.verifier.algorithm, secret).update(message).digest();
      return (
        expected.byteLength === signature.byteLength &&
        timingSafeEqual(expected, Buffer.from(signature))
      );
    })
  );
  let accepted =
    d.verifier.signature.multipleSignaturePolicy === 'all_valid'
      ? matches.every(Boolean)
      : matches.some(Boolean);
  return accepted
    ? { status: 'accepted', selection: { scope: 'receiver_trigger' } }
    : { status: 'rejected', code: 'credential_invalid' };
};
