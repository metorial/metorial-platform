export type MetorialSignatureBody = string | Uint8Array;
export type MetorialSignatureGenerationBody = MetorialSignatureBody | object;

export type ParsedMetorialSignature = {
  timestamp: number;
  signatures: string[];
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

let sign = async (
  body: MetorialSignatureGenerationBody,
  signingSecret: string,
  timestamp: number
) => {
  let key = await signingKey(signingSecret);
  return bufferToHex(await crypto.subtle.sign('HMAC', key, signedPayload(body, timestamp)));
};

let hexToBytes = (hex: string) => {
  let bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }
  return bytes;
};

let verifyHmac = async (
  body: MetorialSignatureBody,
  signingSecret: string,
  timestamp: number,
  candidate: string
) =>
  await crypto.subtle.verify(
    'HMAC',
    await signingKey(signingSecret),
    hexToBytes(candidate),
    signedPayload(body, timestamp)
  );

/**
 * Metorial-Signature = t=<unix-seconds>,v1=<active-lowercase-hex>
 *                      [,v1=<retiring-lowercase-hex>...]
 */
export let generateSignatures = async (
  body: MetorialSignatureGenerationBody,
  signingSecrets: readonly string[],
  options: SignatureOptions = {}
) => {
  if (signingSecrets.length === 0) throw new Error('At least one signing secret is required');
  let timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  let signatures = await Promise.all(
    signingSecrets.map(signingSecret => sign(body, signingSecret, timestamp))
  );
  return `t=${timestamp},${signatures.map(signature => `v1=${signature}`).join(',')}`;
};

export let generateSignature = async (
  body: MetorialSignatureGenerationBody,
  signingSecret: string,
  options: SignatureOptions = {}
) => {
  let timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  if ((options.scheme ?? 'v1') !== 'v1') throw new Error('Unsupported signature scheme');
  return await generateSignatures(body, [signingSecret], { timestamp });
};

export let parseMetorialSignature = (header: string): ParsedMetorialSignature => {
  let fields = header.split(',');
  if (fields.length < 2 || !/^t=(0|[1-9]\d*)$/.test(fields[0] ?? '')) {
    throw new Error('Malformed Metorial-Signature timestamp');
  }
  let timestamp = Number(fields[0]!.slice(2));
  if (!Number.isSafeInteger(timestamp)) {
    throw new Error('Invalid Metorial-Signature timestamp');
  }
  let signatures = fields.slice(1).map(field => {
    if (!/^v1=[a-f0-9]{64}$/.test(field)) {
      throw new Error('Malformed Metorial-Signature v1 field');
    }
    return field.slice(3);
  });
  return { timestamp, signatures };
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
  signingSecrets: readonly string[];
  options?: MetorialSignatureVerificationOptions;
}): Promise<MetorialSignatureVerificationResult> => {
  let parsed: ParsedMetorialSignature;
  try {
    parsed = parseMetorialSignature(d.header);
  } catch {
    return { valid: false, reason: 'malformed' };
  }

  let nowSeconds = d.options?.nowSeconds ?? Math.floor(Date.now() / 1000);
  let maxAgeSeconds = boundedSeconds(d.options?.maxAgeSeconds, 5 * 60);
  let maxFutureSkewSeconds = boundedSeconds(d.options?.maxFutureSkewSeconds, 60);
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 0) {
    throw new Error('Metorial signature verification time must be a non-negative integer');
  }
  let matches = await Promise.all(
    parsed.signatures.flatMap(candidate =>
      d.signingSecrets.map(secret => verifyHmac(d.body, secret, parsed.timestamp, candidate))
    )
  );
  if (!matches.some(Boolean)) {
    return { valid: false, reason: 'signature_mismatch', timestamp: parsed.timestamp };
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
  signingSecrets: readonly string[];
  options?: MetorialSignatureVerificationOptions;
}) => (await verifyMetorialSignatureDetailed(d)).valid;
