import { createHmac } from 'node:crypto';
import { getUploadUrlExpiresAt } from './uploadPolicy';

export let uploadTokenPrefix = 'fup_tok_';

let tokenSubPrefix = 'mtupx';

let tokenSegmentSeparator = '.';

export type SignedUploadTokenPayload = {
  u: string;
  k: string;
  e: number;
  s: number;
  c: string;
  m: string[];
};

let base64urlEncode = (input: Buffer) => input.toString('base64url');
let base64urlDecode = (input: string) => Buffer.from(input, 'base64url');

let hmacSha256 = (secret: string, data: string) =>
  createHmac('sha256', secret).update(data).digest();

export let signUploadToken = (d: { secret: string; payload: SignedUploadTokenPayload }) => {
  let payloadB64 = base64urlEncode(Buffer.from(JSON.stringify(d.payload), 'utf8'));
  let main = `${uploadTokenPrefix}${tokenSubPrefix}${payloadB64}`;
  let signatureB64 = base64urlEncode(hmacSha256(d.secret, main));

  return `${main}${tokenSegmentSeparator}${signatureB64}`;
};

export let verifyUploadToken = (d: { secret: string; token: string }) => {
  if (!d.token.startsWith(uploadTokenPrefix)) return null;

  let rest = d.token.slice(uploadTokenPrefix.length);
  let separator = rest.lastIndexOf(tokenSegmentSeparator);
  if (separator <= 0) return null;

  let payloadSegment = rest.slice(0, separator);
  let signatureB64 = rest.slice(separator + 1);
  if (!payloadSegment || !signatureB64 || !payloadSegment.startsWith(tokenSubPrefix)) {
    return null;
  }

  let main = `${uploadTokenPrefix}${payloadSegment}`;
  let expected = hmacSha256(d.secret, main);
  let actual = (() => {
    try {
      return base64urlDecode(signatureB64);
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

  let payloadB64 = payloadSegment.slice(tokenSubPrefix.length);
  try {
    return JSON.parse(
      base64urlDecode(payloadB64).toString('utf8')
    ) as SignedUploadTokenPayload;
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
