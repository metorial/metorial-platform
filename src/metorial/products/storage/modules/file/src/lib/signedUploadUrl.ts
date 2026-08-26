import { createHmac } from 'node:crypto';
import { getUploadUrlExpiresAt } from './uploadPolicy';

export let uploadTokenPrefix = 'fup_tok_';

let BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export type SignedUploadTokenPayload = {
  u: string;
  k: string;
  e: number;
  s: number;
  c: string;
  m: string[];
};

export let base62Encode = (input: Uint8Array | Buffer) => {
  if (!input || input.length === 0) {
    return '';
  }

  let digits = [0];

  for (let i = 0; i < input.length; i += 1) {
    let carry = input[i]!;

    for (let j = 0; j < digits.length; j += 1) {
      let value = digits[j]! * 256 + carry;

      digits[j] = value % 62;
      carry = Math.floor(value / 62);
    }

    while (carry > 0) {
      digits.push(carry % 62);
      carry = Math.floor(carry / 62);
    }
  }

  for (let i = 0; i < input.length - 1 && input[i] === 0; i += 1) {
    digits.push(0);
  }

  let output = '';

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    output += BASE62_ALPHABET[digits[i]!];
  }

  return output;
};

export let base62Decode = (input: string) => {
  if (!input) {
    return Buffer.alloc(0);
  }

  let bytes = [0];

  for (let i = 0; i < input.length; i += 1) {
    let value = BASE62_ALPHABET.indexOf(input[i]!);

    if (value === -1) {
      throw new Error('Invalid base62 character');
    }

    let carry = value;

    for (let j = 0; j < bytes.length; j += 1) {
      let next = bytes[j]! * 62 + carry;

      bytes[j] = next & 0xff;
      carry = Math.floor(next / 256);
    }

    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry = Math.floor(carry / 256);
    }
  }

  for (let i = 0; i < input.length - 1 && input[i] === '0'; i += 1) {
    bytes.push(0);
  }

  bytes.reverse();

  return Buffer.from(bytes);
};

let hmacSha256 = (secret: string, data: string) =>
  createHmac('sha256', secret).update(data).digest();

export let signUploadToken = (d: {
  secret: string;
  payload: SignedUploadTokenPayload;
}) => {
  let payloadB62 = base62Encode(Buffer.from(JSON.stringify(d.payload), 'utf8'));
  let main = `${uploadTokenPrefix}${payloadB62}`;
  let signatureB62 = base62Encode(hmacSha256(d.secret, main));

  return `${main}_${signatureB62}`;
};

export let verifyUploadToken = (d: { secret: string; token: string }) => {
  if (!d.token.startsWith(uploadTokenPrefix)) return null;

  let rest = d.token.slice(uploadTokenPrefix.length);
  let separator = rest.lastIndexOf('_');
  if (separator <= 0) return null;

  let payloadB62 = rest.slice(0, separator);
  let signatureB62 = rest.slice(separator + 1);
  if (!payloadB62 || !signatureB62) return null;

  let main = `${uploadTokenPrefix}${payloadB62}`;
  let expected = hmacSha256(d.secret, main);
  let actual = (() => {
    try {
      return base62Decode(signatureB62);
    } catch {
      return null;
    }
  })();
  if (!actual || actual.length !== expected.length) return null;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected[i]! ^ actual[i]!;
  }
  if (mismatch !== 0) return null;

  try {
    return JSON.parse(base62Decode(payloadB62).toString('utf8')) as SignedUploadTokenPayload;
  } catch {
    return null;
  }
};

export let getCloudFrontUploadUrl = (d: {
  host: string;
  secret: string;
  uploadId: string;
  storeId: string;
  size: number;
  contentType: string;
  expiresAt?: Date;
}) => {
  let host = d.host.replace(/\/$/, '');
  let token = signUploadToken({
    secret: d.secret,
    payload: {
      u: d.uploadId,
      k: d.storeId,
      e: (d.expiresAt ?? getUploadUrlExpiresAt()).getTime(),
      s: d.size,
      c: d.contentType,
      m: ['PUT']
    }
  });

  return `${host}/${token}`;
};
