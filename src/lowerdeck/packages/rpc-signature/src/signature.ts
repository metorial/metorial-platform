export let rpcSignatureHeader = 'metorial-rpc-signature';
export let rpcSignatureVersion = 'v1';
export let defaultRpcSignatureMaxAgeMs = 60_000;

export type RpcSignatureInput = {
  token: string;
  timestamp: number;
  method: string;
  url: string | URL;
  body: string;
};

export type RpcSignatureVerificationInput = Omit<RpcSignatureInput, 'timestamp'> & {
  signatureHeader: string | null | undefined;
  now?: number;
  maxAgeMs?: number;
};

let encoder = new TextEncoder();
let importedKeys = new Map<string, CryptoKey>();

let getPathAndSearch = (url: string | URL) => {
  let parsedUrl = typeof url == 'string' ? new URL(url) : url;
  return `${parsedUrl.pathname}${parsedUrl.search}`;
};

let getCanonicalPayload = (input: RpcSignatureInput) =>
  [
    rpcSignatureVersion,
    input.timestamp.toString(),
    input.method.toUpperCase(),
    getPathAndSearch(input.url),
    input.body
  ].join('\n');

let importHmacKey = async (token: string) => {
  if (importedKeys.has(token)) return importedKeys.get(token)!;

  let key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(token),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  importedKeys.set(token, key);
  return key;
};

let bufferToHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

export let deriveBoundRpcSignatureToken = async (rootToken: string, binding: string) => {
  let key = await importHmacKey(rootToken);
  let signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`metorial.rpc.bound-token\0v1\0${binding}`)
  );
  return bufferToHex(signatureBuffer);
};

let parseRpcSignatureHeader = (signatureHeader: string | null | undefined) => {
  if (!signatureHeader) return null;

  let parts = signatureHeader.split(',').map(part => part.trim());
  let values = new Map<string, string>();

  for (let part of parts) {
    let separatorIndex = part.indexOf('=');
    if (separatorIndex < 1) return null;

    let key = part.slice(0, separatorIndex);
    let value = part.slice(separatorIndex + 1);
    if (!key || !value) return null;

    values.set(key, value);
  }

  let timestampStr = values.get('t');
  let signature = values.get(rpcSignatureVersion);

  if (!timestampStr || !signature) return null;
  if (!/^\d+$/.test(timestampStr)) return null;
  if (!/^[a-f0-9]{64}$/i.test(signature)) return null;

  let timestamp = Number(timestampStr);
  if (!Number.isSafeInteger(timestamp)) return null;

  return {
    timestamp,
    signature: signature.toLowerCase()
  };
};

let signaturesMatch = (expected: string, actual: string) => {
  if (expected.length != actual.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }

  return mismatch === 0;
};

export let createRpcSignature = async (input: RpcSignatureInput) => {
  let key = await importHmacKey(input.token);
  let signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(getCanonicalPayload(input))
  );

  return bufferToHex(signatureBuffer);
};

export let createRpcSignatureHeader = async (input: RpcSignatureInput) =>
  `t=${input.timestamp},${rpcSignatureVersion}=${await createRpcSignature(input)}`;

export let verifyRpcSignature = async (input: RpcSignatureVerificationInput) => {
  let parsedSignature = parseRpcSignatureHeader(input.signatureHeader);
  if (!parsedSignature) return false;

  let now = input.now ?? Date.now();
  let maxAgeMs = input.maxAgeMs ?? defaultRpcSignatureMaxAgeMs;
  if (Math.abs(now - parsedSignature.timestamp) > maxAgeMs) return false;

  let expected = await createRpcSignature({
    ...input,
    timestamp: parsedSignature.timestamp
  });

  return signaturesMatch(expected, parsedSignature.signature);
};
