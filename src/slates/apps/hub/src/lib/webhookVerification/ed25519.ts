import { createPublicKey, verify as verifySignature } from 'node:crypto';
import type { SlateWebhookVerifier, WebhookWireRequest } from '@slates/proto';
import {
  buildWebhookSignatureMessage,
  collectWebhookSignatureCandidates
} from './rawHmac';
import { decodeWebhookSecret } from './staticToken';
import type {
  ResolvedWebhookSecret,
  WebhookVerificationResult
} from './ruleSelection';

type Ed25519Verifier = Extract<SlateWebhookVerifier, { type: 'ed25519' }>;

let RAW_ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export let verifyEd25519 = (d: {
  request: WebhookWireRequest;
  verifier: Ed25519Verifier;
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
  let keys = d.secrets
    .filter(secret => secret.name === d.verifier.publicKeyName)
    .map(secret =>
      decodeWebhookSecret({ value: secret.value, encoding: d.verifier.publicKeyEncoding })
    )
    .filter(key => key !== null && key.byteLength === 32) as Buffer[];
  if (keys.length === 0) return { status: 'rejected', code: 'credential_missing' };
  let matches = selected.signatures.map(signature =>
    signature.byteLength === 64 &&
    keys.some(rawKey => {
      try {
        let publicKey = createPublicKey({
          key: Buffer.concat([RAW_ED25519_SPKI_PREFIX, rawKey]),
          format: 'der',
          type: 'spki'
        });
        return verifySignature(null, message, publicKey, Buffer.from(signature));
      } catch {
        return false;
      }
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
