import { createHmac, timingSafeEqual } from 'node:crypto';

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
  let expectedBuffer = Buffer.from(expected, 'hex');
  let actualBuffer = Buffer.from(actual, 'hex');

  if (expectedBuffer.length != actualBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, actualBuffer);
};

export let createRpcSignature = (input: RpcSignatureInput) =>
  createHmac('sha256', input.token).update(getCanonicalPayload(input)).digest('hex');

export let createRpcSignatureHeader = (input: RpcSignatureInput) =>
  `t=${input.timestamp},${rpcSignatureVersion}=${createRpcSignature(input)}`;

export let verifyRpcSignature = (input: RpcSignatureVerificationInput) => {
  let parsedSignature = parseRpcSignatureHeader(input.signatureHeader);
  if (!parsedSignature) return false;

  let now = input.now ?? Date.now();
  let maxAgeMs = input.maxAgeMs ?? defaultRpcSignatureMaxAgeMs;
  if (Math.abs(now - parsedSignature.timestamp) > maxAgeMs) return false;

  let expected = createRpcSignature({
    ...input,
    timestamp: parsedSignature.timestamp
  });

  return signaturesMatch(expected, parsedSignature.signature);
};
