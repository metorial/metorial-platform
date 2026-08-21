export type MetorialSignatureBody = string | Uint8Array;
export type MetorialSignatureGenerationBody = MetorialSignatureBody | object;

export type ParsedMetorialSignature = {
  timestamp: number;
  signature: string;
};

export type MetorialSignatureVerificationResult =
  | { valid: true; timestamp: number }
  | {
      valid: false;
      reason: 'malformed' | 'stale' | 'future' | 'signature_mismatch';
      timestamp?: number;
    };

export type MetorialSignatureVerificationOptions = {
  nowSeconds?: number;
  maxAgeSeconds?: number;
  maxFutureSkewSeconds?: number;
};

type SignatureOptions = {
  timestamp?: number;
  scheme?: 'v1';
};

let encoder = new TextEncoder();

let bodyBytes = (body: MetorialSignatureGenerationBody) => {
  if (body instanceof Uint8Array) return body;
  return encoder.encode(typeof body === 'string' ? body : JSON.stringify(body));
};

let bufferToHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

let signedPayload = (body: MetorialSignatureGenerationBody, timestamp: number) => {
  let prefix = encoder.encode(`${timestamp}.`);
  let payload = bodyBytes(body);
  let message = new Uint8Array(prefix.byteLength + payload.byteLength);
  message.set(prefix);
  message.set(payload, prefix.byteLength);
  return message;
};

let signingKey = async (signingSecret: string) =>
  await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

let hexToBytes = (hex: string) => {
  let bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }
  return bytes;
};

export let generateSignature = async (
  body: MetorialSignatureGenerationBody,
  signingSecret: string,
  options: SignatureOptions = {}
) => {
  let timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  if ((options.scheme ?? 'v1') !== 'v1') throw new Error('Unsupported signature scheme');
  let signature = bufferToHex(
    await crypto.subtle.sign(
      'HMAC',
      await signingKey(signingSecret),
      signedPayload(body, timestamp)
    )
  );
  return `t=${timestamp},v1=${signature}`;
};

export let parseMetorialSignature = (header: string): ParsedMetorialSignature => {
  let match = header.match(/^t=(0|[1-9]\d*),v1=([a-f0-9]{64})$/);
  if (!match) throw new Error('Malformed Metorial-Signature header');
  let timestamp = Number(match[1]);
  if (!Number.isSafeInteger(timestamp)) {
    throw new Error('Invalid Metorial-Signature timestamp');
  }
  return { timestamp, signature: match[2]! };
};

let boundedSeconds = (value: number | undefined, fallback: number) => {
  let resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 0) {
    throw new Error('Metorial signature freshness bounds must be non-negative integers');
  }
  return resolved;
};

export let verifyMetorialSignatureDetailed = async (d: {
  header: string;
  body: MetorialSignatureBody;
  signingSecret: string;
  options?: MetorialSignatureVerificationOptions;
}): Promise<MetorialSignatureVerificationResult> => {
  let parsed: ParsedMetorialSignature;
  try {
    parsed = parseMetorialSignature(d.header);
  } catch {
    return { valid: false, reason: 'malformed' };
  }

  let matches = await crypto.subtle.verify(
    'HMAC',
    await signingKey(d.signingSecret),
    hexToBytes(parsed.signature),
    signedPayload(d.body, parsed.timestamp)
  );
  if (!matches) {
    return { valid: false, reason: 'signature_mismatch', timestamp: parsed.timestamp };
  }

  let nowSeconds = d.options?.nowSeconds ?? Math.floor(Date.now() / 1000);
  let maxAgeSeconds = boundedSeconds(d.options?.maxAgeSeconds, 5 * 60);
  let maxFutureSkewSeconds = boundedSeconds(d.options?.maxFutureSkewSeconds, 60);
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 0) {
    throw new Error('Metorial signature verification time must be a non-negative integer');
  }
  if (parsed.timestamp > nowSeconds + maxFutureSkewSeconds) {
    return { valid: false, reason: 'future', timestamp: parsed.timestamp };
  }
  if (parsed.timestamp < nowSeconds - maxAgeSeconds) {
    return { valid: false, reason: 'stale', timestamp: parsed.timestamp };
  }
  return { valid: true, timestamp: parsed.timestamp };
};

export let verifyMetorialSignature = async (d: {
  header: string;
  body: MetorialSignatureBody;
  signingSecret: string;
  options?: MetorialSignatureVerificationOptions;
}) => (await verifyMetorialSignatureDetailed(d)).valid;
