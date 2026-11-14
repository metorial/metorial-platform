import type { webcrypto } from 'node:crypto';
export let ed25519RpcSignatureVersion = 'ed25519-v1';
export let ed25519RpcSignatureMaxAgeMs = 60_000;

export type Ed25519SignatureCredentials = {
  algorithm: 'ed25519';
  keyId: string;
  audience: string;
  privateKey: webcrypto.JsonWebKey;
};

export type Ed25519SignatureMetadata = {
  keyId: string;
  audience: string;
  timestamp: number;
  nonce: string;
};

export type Ed25519SignatureInput = Ed25519SignatureMetadata & {
  method: string;
  url: string | URL;
  authorization: string;
  body: string;
};

let encoder = new TextEncoder();
let safeValue = /^[A-Za-z0-9_.:/-]{1,256}$/;

let encode = (value: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(value)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

let decode = (value: string) =>
  Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

export let rpcSignatureDigest = async (value: string) =>
  encode(await crypto.subtle.digest('SHA-256', encoder.encode(value)));

export let parseEd25519RpcSignature = (header: string | null | undefined) => {
  if (!header || header.length > 2048) return null;

  let values = new Map<string, string>();
  for (let part of header.split(',')) {
    let index = part.indexOf('=');
    if (index < 1) return null;
    let key = part.slice(0, index).trim();
    let value = part.slice(index + 1).trim();
    if (values.has(key) || !value) return null;
    values.set(key, value);
  }

  if (values.size !== 7 || values.get('version') !== ed25519RpcSignatureVersion) return null;

  let keyId = values.get('kid') ?? '';
  let audience = values.get('aud') ?? '';
  let nonce = values.get('nonce') ?? '';
  let timestampValue = values.get('t') ?? '';
  let signature = values.get('sig') ?? '';
  if (values.get('alg') !== 'ed25519' || !safeValue.test(keyId) || !safeValue.test(audience))
    return null;
  if (!/^[A-Za-z0-9_-]{32}$/.test(nonce) || !/^\d{1,16}$/.test(timestampValue)) return null;
  if (!/^[A-Za-z0-9_-]{86}$/.test(signature)) return null;

  let timestamp = Number(timestampValue);
  if (!Number.isSafeInteger(timestamp)) return null;
  return { keyId, audience, timestamp, nonce, signature };
};

let canonicalPayload = async (input: Ed25519SignatureInput) => {
  let url = new URL(input.url);
  return encoder.encode(
    JSON.stringify([
      ed25519RpcSignatureVersion,
      input.keyId,
      input.audience,
      input.timestamp,
      input.nonce,
      input.method.toUpperCase(),
      `${url.pathname}${url.search}`,
      await rpcSignatureDigest(input.authorization),
      await rpcSignatureDigest(input.body)
    ])
  );
};

export let createEd25519RpcSignatureHeader = async (
  input: Omit<Ed25519SignatureInput, 'timestamp' | 'nonce'> & {
    privateKey: webcrypto.JsonWebKey;
    timestamp?: number;
    nonce?: string;
  }
) => {
  let metadata = {
    keyId: input.keyId,
    audience: input.audience,
    timestamp: input.timestamp ?? Date.now(),
    nonce: input.nonce ?? encode(crypto.getRandomValues(new Uint8Array(24)))
  };
  if (!safeValue.test(metadata.keyId) || !safeValue.test(metadata.audience))
    throw new Error('Invalid signature metadata');

  let key = await crypto.subtle.importKey('jwk', input.privateKey, 'Ed25519', false, ['sign']);
  let signature = encode(
    await crypto.subtle.sign('Ed25519', key, await canonicalPayload({ ...input, ...metadata }))
  );
  let header = `version=${ed25519RpcSignatureVersion},alg=ed25519,kid=${metadata.keyId},aud=${metadata.audience},t=${metadata.timestamp},nonce=${metadata.nonce},sig=${signature}`;
  if (!parseEd25519RpcSignature(header)) throw new Error('Invalid signature metadata');
  return header;
};

export let verifyEd25519RpcSignature = async (input: {
  signatureHeader: string | null | undefined;
  publicKey: webcrypto.JsonWebKey;
  audience: string;
  method: string;
  url: string | URL;
  authorization: string;
  body: string;
  now?: number;
  maxAgeMs?: number;
}) => {
  let metadata = parseEd25519RpcSignature(input.signatureHeader);
  if (!metadata || metadata.audience !== input.audience) return false;
  if (
    Math.abs((input.now ?? Date.now()) - metadata.timestamp) >
    (input.maxAgeMs ?? ed25519RpcSignatureMaxAgeMs)
  )
    return false;
  if ('d' in input.publicKey) return false;

  try {
    let key = await crypto.subtle.importKey('jwk', input.publicKey, 'Ed25519', false, [
      'verify'
    ]);
    return await crypto.subtle.verify(
      'Ed25519',
      key,
      decode(metadata.signature),
      await canonicalPayload({ ...input, ...metadata })
    );
  } catch {
    return false;
  }
};
